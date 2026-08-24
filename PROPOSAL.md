# file-share — Proposal

Port of `~/projects/file-share` (Deno + JSX SSR + Deno KV + S3) to a modern full-stack
Cloudflare Workers app: **Hono** (API) + **React + Vite** (SPA) + **shadcn/ui**,
using only Cloudflare primitives (R2, Workers KV, Workers Assets).

---

## 1. What exists today (../file-share)

Flow reverse-engineered from the old codebase:

1. User picks a file, an expiry (**5 min / 1 h / 24 h**) and optionally
   "end-to-end encryption".
2. `POST /api/upload` validates payload (zod), generates a **6-digit numeric
   id**, stores metadata `{name, size, expire, url, encrypt}` in **Deno KV**, and
   returns an S3 **presigned PUT url** + redirect `/download/:id`.
3. Browser PUTs the blob straight to S3. If encryption was chosen, the browser
   AES-GCM encrypts before uploading (client-side code in `assets/upload.js`).
4. `/download/:id` shows a QR code of `/f/:id`, copy button, expiry info.
   `/f/:id` redirects to a presigned GET url (or decrypts client-side when
   encrypted).
5. After expiry, KV entry is gone → 404/410 pages.

Known issues worth fixing in the port:
- **Encryption bug**: decrypt.js uses an all-zero IV (`new Uint8Array(12)`),
  i.e. the IV is never stored — decryption only works by luck/collision.
  the port stores the IV alongside the ciphertext (proper construction).
- Ids are sequential-ish numbers (`Math.random` between 100000–999999) — the port uses
  crypto-random alphanumeric ids.
- Presigned GET url lifetime is capped at the share duration at creation time;
  the port serves downloads through the Worker so expiry is enforced per-request.
- AWS SDK presigning doesn't work inside Workers runtime anyway (needs Node APIs).

## 2. Target architecture

Single Cloudflare Worker serving both the SPA and the API.

```
Browser (React SPA)
  │
  ├── static assets ──► Workers Assets (Vite build output, SPA fallback)
  │
  ├── POST /api/uploads          create share → {id, uploadUrl}
  ├── PUT   /api/uploads/:id     upload bytes (Worker proxies into R2)
  ├── GET   /api/files/:id       metadata (name, size, expiresAt, encrypted)
  └── GET   /api/files/:id/blob  stream download from R2 (enforces expiry)

Worker (Hono)
  ├── metadata ──► Workers KV  (native expirationTtl — entries auto-expire)
  └── blobs    ──► R2 bucket   (binding, key = <id>)
```

### Stack choices

| Concern      | Choice | Why |
|---|---|---|
| Frontend     | React 19 + Vite + React Router (SPA) | requested |
| UI           | shadcn/ui (preset `b7C9wSiPY`: base-lyra style, mist base color, JetBrains Mono, pointer cursors) + Tailwind CSS v4 | requested |
| Auth (later) | better-auth — minimal auth unlocks higher size limits / longer expiry for logged-in users | planned post-MVP |
| Backend      | Hono on Workers | requested; first-class CF support |
| Local dev    | `@cloudflare/vite-plugin` | one `vite dev` runs SPA + Worker + real R2/KV bindings (miniflare); no CORS juggling |
| File storage | **R2 via binding** (not presigned URLs) | zero credentials, streams through the Worker, expiry enforced server-side, no bucket CORS config needed |
| Metadata/TTL | **Workers KV** | native `expirationTtl` maps 1:1 to "file disappears"; replaces Deno KV |
| QR code      | client-side (`qrcode` pkg rendered to canvas/SVG in React) | old version rendered it server-side; SPA makes client-side simpler |

### Wrangler config sketch

```jsonc
{
  "name": "file-share",
  "main": "worker/index.ts",
  "compatibility_date": "<today>",
  "assets": {
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "kv_namespaces": [{ "binding": "METADATA", "id": "..." }],
  "r2_buckets":   [{ "binding": "FILES", "bucket_name": "file-share" }],
  "vars": { "MAX_FILE_SIZE": "104857600", "BASE_URL": "" }
}
```

### Project layout

```
file-share/
├── src/                    # React SPA
│   ├── routes/
│   │   ├── UploadPage.tsx        # dropzone, expiry picker, encrypt toggle
│   │   └── DownloadPage.tsx      # /f/:id — copy link, QR, download button
│   ├── lib/
│   │   ├── crypto.ts             # WebCrypto AES-GCM encrypt/decrypt (+IV!)
│   │   ├── api.ts                # typed fetch client
│   │   └── qr.tsx
│   └── components/ui/            # shadcn
├── worker/
│   └── index.ts                  # Hono app: /api/*, typed Bindings
├── shared/types.ts               # shared API types (imported by both sides)
├── wrangler.jsonc
├── vite.config.ts                # react + @cloudflare/vite-plugin + tailwind
└── package.json
```

## 3. Core flows

### Upload

1. `POST /api/uploads` `{ name, size, expiresIn: "5m"|"1h"|"24h", encrypted }`
   → server generates id (6 chars, `a-z0-9`, `crypto.getRandomValues`,
   KV-collision-checked), writes KV record with
   `expirationTtl`, returns `{ id, uploadUrl }`.
2. Client (optionally encrypts in-browser: random AES-GCM-256 key, random 12-byte
   IV prepended to ciphertext; key lives **only** in the URL fragment) then
   `PUT /api/uploads/:id` with the bytes. Worker verifies size + not-yet-finalized,
   streams into R2 (`env.FILES.put(id, req.body)`), marks record finalized.
3. Client shows result page: short URL `BASE/f/:id`, copy button, QR code.
   If encrypted: URL includes `#<key>` — fragment never sent to the server,
   giving true E2E semantics (server stores only ciphertext).

### Download

1. Recipient opens `/f/:id` → SPA loads, fetches `GET /api/files/:id`.
2. Missing → "not found" state; expired → KV already deleted → same state;
   expired-but-not-yet-swept → server returns 410 explicitly.
3. Download button hits `GET /api/files/:id/blob`; Worker checks expiry, streams
   R2 object with original filename via `Content-Disposition`.
4. If `encrypted`: client pulls key from `location.hash`, decrypts in-browser
   (with correct per-file IV this time), triggers save. Server never sees plaintext.

### Expiry

KV `put(key, value, { expirationTtl })` handles deletion automatically.
R2 blobs are swept lazily: if the KV record is gone, the blob is unreachable;
an optional scheduled Worker (cron trigger) deletes orphaned R2 objects later —
listed as an enhancement, not MVP-blocking.

## 4. Constraints & decisions to be aware of

- **Size limit**: requests through a Worker are capped (~100 MB free plan /
  500 MB enterprise). MVP enforces a configurable max (default 100 MB).
  If larger files matter later, switch step 2 to **direct-to-R2 presigned PUT**
  via `aws4fetch` (the AWS SDK does not run in Workers) — API shape above stays
  compatible.
- **KV eventual consistency**: a just-written share may briefly miss on read
  from a different colo. Acceptable for this use case; noted as known trade-off
  (D1 would give strong consistency if it ever matters).
- **Id space**: 6 chars of `[a-z0-9]` ≈ 2.2 B combinations; collisions handled
  by retry loop against KV.

## 5. Milestones

1. **M1 — Scaffold**: `npm create cloudflare@latest -- --framework=react`
   (React SPA + Hono worker + Vite plugin), `shadcn init`, wrangler bindings
   (R2 + KV) wired, CI-ready build.
2. **M2 — Share core**: upload flow end-to-end (no encryption), download page,
   copy link + QR, expiry working locally & deployed.
3. **M3 — E2E encryption**: client encrypt/decrypt module (correct IV handling),
   key-in-fragment UX, encrypted download path.
4. **M4 — Polish**: progress bar during upload, drag-and-drop, error states,
   rate-limit-ish protections, deploy to production domain.

Later enhancements (not scoped now): **better-auth integration** — minimal
auth (email/pass or social) so anonymous users get the default limits
(100 MB / 5m–24h) while signed-in users get higher size limits and longer
expiry options; password-protected links, direct-to-R2 large uploads, cron
cleanup, view-count/download limits, custom expiry input, preview for
images/text.

---

If this looks right, say the word and I'll start with M1.
