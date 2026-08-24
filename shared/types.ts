export const EXPIRY_OPTIONS = {
  "5m": 5 * 60,
  "1h": 60 * 60,
  "24h": 24 * 60 * 60,
} as const

export type ExpiryOption = keyof typeof EXPIRY_OPTIONS

export type StoredMeta = {
  id: string
  name: string
  size: number
  contentType: string
  encrypted: boolean
  finalized: boolean
  createdAt: number
  expiresAt: number
}

export type FileMeta = Pick<
  StoredMeta,
  "id" | "name" | "size" | "encrypted" | "createdAt" | "expiresAt"
>

export type CreateUploadInput = {
  name: string
  size: number
  contentType?: string
  encrypted: boolean
  expiresIn: ExpiryOption
}

export type CreateUploadResult = { id: string }

export type AppConfig = {
  maxFileSize: number
  expiryOptions: ExpiryOption[]
}

export function isExpiryOption(v: unknown): v is ExpiryOption {
  return typeof v === "string" && v in EXPIRY_OPTIONS
}
