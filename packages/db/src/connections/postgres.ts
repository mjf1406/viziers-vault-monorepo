import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";

/**
 * Create a Drizzle client for PostgreSQL (cloud, self-host, local dev).
 * Use with drizzle-kit for migrations.
 */
export function createPostgresConnection(connectionString: string) {
  const client = postgres(connectionString, { max: 1 });
  return drizzle(client, { schema });
}

export type PostgresDb = ReturnType<typeof createPostgresConnection>;
