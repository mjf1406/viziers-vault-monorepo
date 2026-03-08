/**
 * Desktop-only: single local user profile. No Better Auth; one row per install.
 */
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const localProfile = pgTable("local_profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Local User"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
