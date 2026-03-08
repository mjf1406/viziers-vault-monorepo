import { createPostgresConnection } from "@workspace/db";
import type { Env } from "./env";

export function createDb(env: Env) {
  return createPostgresConnection(env.DATABASE_URL);
}
