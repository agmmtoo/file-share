import { createAuthClient } from "better-auth/react"

/** Same origin as the SPA, so the default baseURL is correct. */
export const authClient = createAuthClient({ basePath: "/api/auth" })

export const { useSession, signIn, signUp, signOut } = authClient
