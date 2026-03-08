import { eq } from "drizzle-orm";
import type { PgliteDb } from "../connections/pglite";
import { localProfile } from "../schema";

const DEFAULT_PROFILE_ID = "default-local-profile";

/**
 * Get or create the single local profile for desktop mode.
 * Only used with PGlite; not used in cloud/self-host.
 */
export async function getOrCreateLocalProfile(db: PgliteDb): Promise<{ id: string }> {
  const existing = await db
    .select()
    .from(localProfile)
    .where(eq(localProfile.id, DEFAULT_PROFILE_ID))
    .limit(1);
  if (existing[0]) {
    return { id: existing[0].id };
  }
  const [row] = await db
    .insert(localProfile)
    .values({
      id: DEFAULT_PROFILE_ID,
      name: "Local User",
    })
    .returning();
  return { id: row!.id };
}
