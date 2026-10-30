import { betterAuth } from "better-auth"
import type { Bindings } from "./bindings"

/**
 * Built per request, not at module scope: bindings only exist inside a request,
 * so there is no env to close over when the isolate starts.
 */
export function createAuth(env: Bindings) {
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    basePath: "/api/auth",
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Verification needs an email provider, which this app does not have yet.
      requireEmailVerification: false,
    },
    advanced: {
      // The SPA is served from the same origin, so a lax host-only cookie is
      // enough and keeps the session off any other site.
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      },
    },
  })
}
