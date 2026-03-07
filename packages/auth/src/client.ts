/**
 * Better Auth React client. Same-origin /api/auth when baseURL omitted (verify in docs).
 */
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient()
export const { signIn, signUp, signOut, useSession } = authClient
