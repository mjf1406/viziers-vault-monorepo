import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDb } from "./connections/pglite";

/**
 * Run all pending migrations against a PGlite instance.
 * Used by the Electron main process at startup.
 * migrationsFolder must point to the directory containing the SQL migration files
 * (e.g. in packaged app this may be a path to bundled assets).
 */
export async function migratePglite(
  db: PgliteDb,
  migrationsFolder: string
): Promise<void> {
  await migrate(db, { migrationsFolder });
}
