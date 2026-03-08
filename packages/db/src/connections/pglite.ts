import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../schema";

/**
 * Create a Drizzle client for PGlite (Electron desktop).
 * Path is typically app.getPath('userData')/db or similar.
 */
export function createPgliteConnection(dataPath: string) {
  const client = new PGlite(dataPath);
  return drizzle(client, { schema });
}

export type PgliteDb = ReturnType<typeof createPgliteConnection>;
