import { Hono } from "hono"
import {
  EXPIRY_OPTIONS,
  isExpiryOption,
  type AppConfig,
  type ExpiryOption,
  type FileMeta,
  type StoredMeta,
} from "../shared/types"

export type Bindings = {
  file_share: KVNamespace
  FILES: R2Bucket
  MAX_FILE_SIZE: string
  /** Rate limiters, keyed by client IP. Absent when the binding is unconfigured. */
  SHARE_LIMIT?: RateLimit
  DOWNLOAD_LIMIT?: RateLimit
}

export type AppEnv = { Bindings: Bindings }

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
const ID_LENGTH = 6
const KV_PREFIX = "file:"
const MIN_TTL = 60

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

function metaKey(id: string) {
  return `${KV_PREFIX}${id}`
}

async function getMeta(
  env: Bindings,
  id: string
): Promise<StoredMeta | "not_found" | "expired"> {
  const raw = await env.file_share.get(metaKey(id))
  if (!raw) return "not_found"
  const meta = JSON.parse(raw) as StoredMeta
  if (!meta.finalized || meta.expiresAt < Date.now()) return "expired"
  return meta
}

async function deleteShare(env: Bindings, id: string, meta: StoredMeta | null) {
  if (meta && !meta.finalized) {
    await env.FILES.delete(id)
  }
  await env.file_share.delete(metaKey(id))
}

const app = new Hono<AppEnv>().basePath("/api")

app.get("/health", (c) => c.json({ ok: true }))

app.get("/config", (c) => {
  const config: AppConfig = {
    maxFileSize: Number(c.env.MAX_FILE_SIZE),
    expiryOptions: Object.keys(EXPIRY_OPTIONS) as ExpiryOption[],
  }
  return c.json(config)
})

app.post("/uploads", async (c) => {
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

  const maxSize = Number(c.env.MAX_FILE_SIZE)
  if (body.size > maxSize) {
    return c.json({ error: "file_too_large", maxSize }, 413)
  }

  let id = ""
  for (let attempt = 0; attempt < 5; attempt++) {
    id = generateId()
    if (!(await c.env.file_share.get(metaKey(id)))) break
    if (attempt === 4) return c.json({ error: "id_exhausted" }, 500)
  }

  const ttl = EXPIRY_OPTIONS[body.expiresIn]
  const now = Date.now()
  const meta: StoredMeta = {
    id,
    name: body.name,
    size: body.size,
    contentType:
      typeof body.contentType === "string" && body.contentType.length > 0
        ? body.contentType
        : "application/octet-stream",
    encrypted: body.encrypted,
    finalized: false,
    createdAt: now,
    expiresAt: now + ttl * 1000,
  }

  await c.env.file_share.put(metaKey(id), JSON.stringify(meta), {
    expirationTtl: ttl,
  })

  return c.json({ id }, 201)
})

app.put("/uploads/:id", async (c) => {
  const { FILES, file_share } = c.env
  const id = c.req.param("id")
  if (!/^[a-z0-9]{6}$/.test(id)) return c.json({ error: "invalid_id" }, 400)

  const raw = await file_share.get(metaKey(id))
  if (!raw) return c.json({ error: "not_found" }, 404)
  const meta = JSON.parse(raw) as StoredMeta
  if (meta.finalized) return c.json({ error: "already_uploaded" }, 409)
  if (meta.expiresAt < Date.now()) {
    await deleteShare(c.env, id, meta)
    return c.json({ error: "expired" }, 410)
  }

  const contentLength = Number(c.req.header("content-length") ?? "-1")
  const maxSize = Number(c.env.MAX_FILE_SIZE)
  if (contentLength < 0 || contentLength > maxSize) {
    return c.json({ error: "file_too_large", maxSize }, 413)
  }

  if (!c.req.raw.body) return c.json({ error: "missing_body" }, 400)

  await FILES.put(id, c.req.raw.body, {
    httpMetadata: { contentType: meta.contentType },
  })

  meta.finalized = true
  await file_share.put(metaKey(id), JSON.stringify(meta), {
    expirationTtl: Math.max(MIN_TTL, Math.ceil((meta.expiresAt - Date.now()) / 1000)),
  })

  return c.json({ ok: true })
})

app.get("/files/:id", async (c) => {
  const id = c.req.param("id")
  const result = await getMeta(c.env, id)
  if (result === "not_found") return c.json({ error: "not_found" }, 404)
  if (result === "expired") {
    await deleteShare(c.env, id, null)
    return c.json({ error: "expired" }, 410)
  }
  const { name, size, encrypted, contentType, createdAt, expiresAt } = result
  const fileMeta: FileMeta & { contentType: string } = {
    id, name, size, encrypted, contentType, createdAt, expiresAt,
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
  if (result === "expired") {
    await deleteShare(c.env, id, null)
    return c.json({ error: "expired" }, 410)
  }
  const meta = result

  const object = await c.env.FILES.get(id)
  if (!object) return c.json({ error: "blob_missing" }, 404)

  const headers = new Headers()
  headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream")
  headers.set("Content-Length", object.size.toString())
  headers.set("Cache-Control", "no-store")
  headers.set(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`
  )

  return new Response(object.body, { headers })
})

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: "internal_error" }, 500)
})

export default app
