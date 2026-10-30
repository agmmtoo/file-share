import { Hono } from "hono"
import { createMiddleware } from "hono/factory"
import { createAuth } from "./auth"
import type { AppEnv, Bindings, SessionUser } from "./bindings"
import {
  EXPIRY_OPTIONS,
  MAX_DOWNLOAD_LIMIT,
  TIERS,
  isExpiryOption,
  type AppConfig,
  type FileMeta,
  type ShareList,
  type StoredMeta,
  type Tier,
  type TierLimits,
} from "../shared/types"

export type { AppEnv, Bindings }

/** A row of the shares table, snake_case as SQLite returns it. */
type ShareRow = {
  id: string
  user_id: string | null
  name: string
  size: number
  content_type: string
  encrypted: number
  finalized: number
  created_at: number
  expires_at: number
  max_downloads: number | null
  downloads: number
}

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
const ID_LENGTH = 6
const SHARE_ID = /^[a-z0-9]{6}$/

/** Upper bound on a share listing; nothing here pages yet. */
const SHARE_LIST_LIMIT = 100

/** Expired rows cleared per upload. D1 has no TTL, and there is no cron. */
const PRUNE_BATCH = 50

function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH))
  let id = ""
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ID_ALPHABET[bytes[i] % ID_ALPHABET.length]
  }
  return id
}

/**
 * Rate limit by client IP. Cloudflare sets CF-Connecting-IP at the edge; it is
 * absent in local dev, where every request then shares one bucket.
 */
async function overLimit(
  limiter: RateLimit | undefined,
  req: Request
): Promise<boolean> {
  if (!limiter) return false
  const ip = req.headers.get("cf-connecting-ip") ?? "local"
  const { success } = await limiter.limit({ key: ip })
  return !success
}

function toMeta(row: ShareRow): StoredMeta {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    contentType: row.content_type,
    encrypted: row.encrypted === 1,
    finalized: row.finalized === 1,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    maxDownloads: row.max_downloads,
    downloads: row.downloads,
  }
}

/** The fields a share exposes over the API; the rest stay server-side. */
function toSummary(meta: StoredMeta): FileMeta {
  return {
    id: meta.id,
    name: meta.name,
    size: meta.size,
    encrypted: meta.encrypted,
    createdAt: meta.createdAt,
    expiresAt: meta.expiresAt,
    maxDownloads: meta.maxDownloads,
    downloads: meta.downloads,
  }
}

/** Signed-in callers get the member tier; everyone else the anonymous one. */
function tierOf(user: SessionUser | null): { tier: Tier; limits: TierLimits } {
  const tier: Tier = user ? "member" : "anon"
  return { tier, limits: TIERS[tier] }
}

async function getMeta(
  env: Bindings,
  id: string
): Promise<StoredMeta | "not_found" | "expired" | "exhausted"> {
  const row = await env.DB.prepare("SELECT * FROM shares WHERE id = ?")
    .bind(id)
    .first<ShareRow>()
  if (!row) return "not_found"
  const meta = toMeta(row)
  if (!meta.finalized || meta.expiresAt < Date.now()) return "expired"
  // Reported before the blob is offered, so a used-up link says so up front
  // instead of showing a download button that cannot work.
  if (meta.maxDownloads !== null && meta.downloads >= meta.maxDownloads) {
    return "exhausted"
  }
  return meta
}

async function deleteShare(env: Bindings, id: string, meta: StoredMeta | null) {
  if (meta && !meta.finalized) {
    await env.FILES.delete(id)
  }
  await env.DB.prepare("DELETE FROM shares WHERE id = ?").bind(id).run()
}

/**
 * KV used to drop expired metadata on its own via expirationTtl; a D1 row sits
 * there until something deletes it. Rather than run a cron for it, each upload
 * clears a small batch, which keeps the table proportional to live shares.
 * The blobs themselves are reclaimed by the bucket's expire-stale lifecycle rule.
 */
async function pruneExpired(env: Bindings, now: number) {
  await env.DB.prepare(
    `DELETE FROM shares WHERE id IN (
       SELECT id FROM shares WHERE expires_at < ? LIMIT ?
     )`
  )
    .bind(now, PRUNE_BATCH)
    .run()
}

const app = new Hono<AppEnv>().basePath("/api")

/**
 * Resolves the session once and hands routes `c.get("user")`. Applied only to
 * the routes that branch on it, so anonymous downloads cost no auth query.
 */
const withUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({
    headers: c.req.raw.headers,
  })
  c.set(
    "user",
    session ? { id: session.user.id, email: session.user.email } : null
  )
  await next()
})

// Sign-in and sign-up are the obvious credential-stuffing target, so they get
// their own per-IP limiter rather than sharing the upload one. Only the writes
// are counted: every page load reads the session over GET, and charging those
// to the same bucket makes an ordinary refresh look like a signed-out user.
app.on(["GET", "POST"], "/auth/*", async (c) => {
  if (
    c.req.method === "POST" &&
    (await overLimit(c.env.AUTH_LIMIT, c.req.raw))
  ) {
    return c.json({ error: "rate_limited" }, 429)
  }
  return createAuth(c.env).handler(c.req.raw)
})

app.get("/health", (c) => c.json({ ok: true }))

app.get("/config", withUser, (c) => {
  const { tier, limits } = tierOf(c.get("user"))
  const config: AppConfig = { tier, ...limits }
  return c.json(config)
})

app.post("/uploads", withUser, async (c) => {
  if (await overLimit(c.env.SHARE_LIMIT, c.req.raw)) {
    return c.json({ error: "rate_limited" }, 429)
  }

  const body = (await c.req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  if (
    !body ||
    typeof body.name !== "string" ||
    body.name.length === 0 ||
    body.name.length > 255 ||
    typeof body.size !== "number" ||
    !Number.isSafeInteger(body.size) ||
    body.size <= 0 ||
    typeof body.encrypted !== "boolean" ||
    !isExpiryOption(body.expiresIn)
  ) {
    return c.json({ error: "invalid_request" }, 400)
  }

  const user = c.get("user")
  const { limits } = tierOf(user)

  if (body.size > limits.maxFileSize) {
    return c.json({ error: "file_too_large", maxSize: limits.maxFileSize }, 413)
  }
  if (!limits.expiryOptions.includes(body.expiresIn)) {
    return c.json({ error: "expiry_not_allowed" }, 403)
  }

  // Download caps are a signed-in feature, so an anonymous caller asking for
  // one is rejected rather than quietly ignored.
  let maxDownloads: number | null = null
  if (body.maxDownloads !== undefined && body.maxDownloads !== null) {
    if (!limits.canLimitDownloads) {
      return c.json({ error: "download_limit_not_allowed" }, 403)
    }
    if (
      typeof body.maxDownloads !== "number" ||
      !Number.isSafeInteger(body.maxDownloads) ||
      body.maxDownloads < 1 ||
      body.maxDownloads > MAX_DOWNLOAD_LIMIT
    ) {
      return c.json({ error: "invalid_request" }, 400)
    }
    maxDownloads = body.maxDownloads
  }

  const now = Date.now()
  await pruneExpired(c.env, now)

  const ttl = EXPIRY_OPTIONS[body.expiresIn]
  const contentType =
    typeof body.contentType === "string" && body.contentType.length > 0
      ? body.contentType
      : "application/octet-stream"

  // INSERT OR IGNORE settles collisions in the write itself: a losing insert
  // reports zero changes, where a SELECT-then-INSERT could race another request.
  const insert = c.env.DB.prepare(
    `INSERT OR IGNORE INTO shares
       (id, user_id, name, size, content_type, encrypted, finalized,
        created_at, expires_at, max_downloads)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
  )
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generateId()
    const result = await insert
      .bind(
        id,
        user?.id ?? null,
        body.name,
        body.size,
        contentType,
        body.encrypted ? 1 : 0,
        now,
        now + ttl * 1000,
        maxDownloads
      )
      .run()
    if (result.meta.changes === 1) return c.json({ id }, 201)
  }

  return c.json({ error: "id_exhausted" }, 500)
})

app.put("/uploads/:id", async (c) => {
  const { FILES, DB } = c.env
  const id = c.req.param("id")
  if (!SHARE_ID.test(id)) return c.json({ error: "invalid_id" }, 400)

  const row = await DB.prepare("SELECT * FROM shares WHERE id = ?")
    .bind(id)
    .first<ShareRow>()
  if (!row) return c.json({ error: "not_found" }, 404)
  const meta = toMeta(row)
  if (meta.finalized) return c.json({ error: "already_uploaded" }, 409)
  if (meta.expiresAt < Date.now()) {
    await deleteShare(c.env, id, meta)
    return c.json({ error: "expired" }, 410)
  }

  // Checked against the size this share was created with, not the caller's tier:
  // that size already passed the tier check, and the session is not needed here.
  const contentLength = Number(c.req.header("content-length") ?? "-1")
  if (contentLength < 0 || contentLength > meta.size) {
    return c.json({ error: "file_too_large", maxSize: meta.size }, 413)
  }

  if (!c.req.raw.body) return c.json({ error: "missing_body" }, 400)

  await FILES.put(id, c.req.raw.body, {
    httpMetadata: { contentType: meta.contentType },
  })

  await DB.prepare("UPDATE shares SET finalized = 1 WHERE id = ?")
    .bind(id)
    .run()

  return c.json({ ok: true })
})

app.get("/files/:id", async (c) => {
  const id = c.req.param("id")
  const result = await getMeta(c.env, id)
  if (result === "not_found") return c.json({ error: "not_found" }, 404)
  if (result === "exhausted") {
    return c.json({ error: "download_limit_reached" }, 410)
  }
  if (result === "expired") {
    await deleteShare(c.env, id, null)
    return c.json({ error: "expired" }, 410)
  }
  const fileMeta: FileMeta & { contentType: string } = {
    ...toSummary(result),
    contentType: result.contentType,
  }
  return c.json(fileMeta)
})

app.get("/files/:id/blob", async (c) => {
  if (await overLimit(c.env.DOWNLOAD_LIMIT, c.req.raw)) {
    return c.json({ error: "rate_limited" }, 429)
  }

  const id = c.req.param("id")
  const result = await getMeta(c.env, id)
  if (result === "not_found") return c.json({ error: "not_found" }, 404)
  if (result === "exhausted") {
    return c.json({ error: "download_limit_reached" }, 410)
  }
  if (result === "expired") {
    await deleteShare(c.env, id, null)
    return c.json({ error: "expired" }, 410)
  }
  const meta = result

  // Claim the download before serving it. Checking and incrementing in one
  // statement is what makes the cap real: two parallel requests cannot both
  // read "one left" and both win, the way they could against KV.
  if (meta.maxDownloads !== null) {
    const claim = await c.env.DB.prepare(
      `UPDATE shares SET downloads = downloads + 1
       WHERE id = ? AND expires_at > ?
         AND (max_downloads IS NULL OR downloads < max_downloads)`
    )
      .bind(id, Date.now())
      .run()
    if (claim.meta.changes !== 1) {
      return c.json({ error: "download_limit_reached" }, 410)
    }
  }

  const object = await c.env.FILES.get(id)
  if (!object) return c.json({ error: "blob_missing" }, 404)

  const headers = new Headers()
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType ?? "application/octet-stream"
  )
  headers.set("Content-Length", object.size.toString())
  headers.set("Cache-Control", "no-store")
  headers.set(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`
  )

  return new Response(object.body, { headers })
})

/**
 * The caller's own live shares, newest first. Unfinalized and expired rows are
 * left out: neither has a link worth showing, and the expired ones are on their
 * way out via pruneExpired().
 */
app.get("/shares", withUser, async (c) => {
  const user = c.get("user")
  if (!user) return c.json({ error: "unauthorized" }, 401)

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM shares
     WHERE user_id = ? AND finalized = 1 AND expires_at > ?
     ORDER BY created_at DESC
     LIMIT ?`
  )
    .bind(user.id, Date.now(), SHARE_LIST_LIMIT)
    .all<ShareRow>()

  const body: ShareList = {
    shares: results.map((row) => toSummary(toMeta(row))),
  }
  return c.json(body)
})

app.delete("/shares/:id", withUser, async (c) => {
  const user = c.get("user")
  if (!user) return c.json({ error: "unauthorized" }, 401)

  const id = c.req.param("id")
  if (!SHARE_ID.test(id)) return c.json({ error: "invalid_id" }, 400)

  // Ownership rides along in the DELETE, so a row belonging to someone else
  // cannot be removed and is indistinguishable from one that never existed.
  const result = await c.env.DB.prepare(
    "DELETE FROM shares WHERE id = ? AND user_id = ?"
  )
    .bind(id, user.id)
    .run()
  if (result.meta.changes !== 1) return c.json({ error: "not_found" }, 404)

  // Dropped eagerly rather than left to the bucket lifecycle rule: the link is
  // already dead, so keeping the bytes only costs storage.
  await c.env.FILES.delete(id)
  return c.json({ ok: true })
})

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: "internal_error" }, 500)
})

export default app
