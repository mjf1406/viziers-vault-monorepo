import type { Context } from "hono";

/**
 * Abstraction for extracting user identity from a request.
 * Cloud/self-host: Better Auth session.
 * Desktop: hardcoded local profile ID from closure.
 */
export type GetUserContext = (
  c: Context
) => { userId: string } | null | Promise<{ userId: string } | null>;
