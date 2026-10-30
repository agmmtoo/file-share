/** Worker bindings and the Hono context shape, shared by the app and auth. */

export type Bindings = {
  DB: D1Database
  FILES: R2Bucket
  BETTER_AUTH_SECRET: string
  /** Rate limiters, keyed by client IP. Absent when the binding is unconfigured. */
  SHARE_LIMIT?: RateLimit
  DOWNLOAD_LIMIT?: RateLimit
  AUTH_LIMIT?: RateLimit
}

/** Only what routes actually need off the session. */
export type SessionUser = { id: string; email: string }

export type AppEnv = {
  Bindings: Bindings
  Variables: { user: SessionUser | null }
}
