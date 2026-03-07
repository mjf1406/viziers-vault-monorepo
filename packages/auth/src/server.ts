/**
 * Better Auth server-side factory. Thin boundary; app/domain logic owns permissions.
 * This package does not read process.env — apps/server passes options in.
 */
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

export type CreateAuthOptions = {
  db: Parameters<typeof drizzleAdapter>[0]
  secret: string
  baseURL: string
}

export function createAuth({ db, secret, baseURL }: CreateAuthOptions) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    emailAndPassword: { enabled: true },
    secret,
    baseURL,
  })
}

export type Auth = ReturnType<typeof createAuth>
