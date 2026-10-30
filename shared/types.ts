export const EXPIRY_OPTIONS = {
  "5m": 5 * 60,
  "1h": 60 * 60,
  "24h": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
  "30d": 30 * 24 * 60 * 60,
} as const

export type ExpiryOption = keyof typeof EXPIRY_OPTIONS

export type Tier = "anon" | "member"

export type TierLimits = {
  maxFileSize: number
  expiryOptions: readonly ExpiryOption[]
  canLimitDownloads: boolean
}

/**
 * What each kind of caller may ask for. The server reads these on every upload,
 * so the client cannot buy a longer expiry or a bigger file by editing a form.
 *
 * `member` stops at 90 MB because Cloudflare caps a Worker request body at
 * 100 MB on Free/Pro. Going higher means uploading straight to R2 instead.
 */
export const TIERS = {
  anon: {
    maxFileSize: 64 * 1024 * 1024,
    expiryOptions: ["5m", "1h", "24h"],
    canLimitDownloads: false,
  },
  member: {
    maxFileSize: 90 * 1024 * 1024,
    expiryOptions: ["5m", "1h", "24h", "7d", "30d"],
    canLimitDownloads: true,
  },
} as const satisfies Record<Tier, TierLimits>

/** Guards against a caller asking for an absurd counter. */
export const MAX_DOWNLOAD_LIMIT = 1000

export type StoredMeta = {
  id: string
  name: string
  size: number
  contentType: string
  encrypted: boolean
  finalized: boolean
  createdAt: number
  expiresAt: number
  /** null means unlimited. */
  maxDownloads: number | null
  downloads: number
}

export type FileMeta = Pick<
  StoredMeta,
  | "id"
  | "name"
  | "size"
  | "encrypted"
  | "createdAt"
  | "expiresAt"
  | "maxDownloads"
  | "downloads"
>

export type CreateUploadInput = {
  name: string
  size: number
  contentType?: string
  encrypted: boolean
  expiresIn: ExpiryOption
  /** Signed-in callers only; null or omitted means unlimited. */
  maxDownloads?: number | null
}

export type CreateUploadResult = { id: string }

/** A signed-in caller's own live shares. */
export type ShareList = { shares: FileMeta[] }

export type AppConfig = TierLimits & { tier: Tier }

export function isExpiryOption(v: unknown): v is ExpiryOption {
  return typeof v === "string" && v in EXPIRY_OPTIONS
}
