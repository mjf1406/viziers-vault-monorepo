/**
 * Shared auth type aliases for use across server and client.
 * Aligned with Better Auth session/user shapes.
 */
export type Session = {
  id: string
  userId: string
  expiresAt: Date
  user?: User
}

export type User = {
  id: string
  email: string | null
  name: string | null
  image: string | null
}
