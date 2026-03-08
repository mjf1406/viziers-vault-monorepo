import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Shared Drizzle schema — single source of truth for apps/server (Postgres/Neon)
 * and apps/electron (PGlite). Add tables here and run `pnpm generate` in packages/db.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const parties = pgTable("parties", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const partyCharacters = pgTable("party_characters", {
  id: text("id").primaryKey(),
  partyId: text("party_id")
    .notNull()
    .references(() => parties.id, { onDelete: "cascade" }),
  level: integer("level").notNull(),
  quantity: integer("quantity").notNull(),
});

export const partiesRelations = relations(parties, ({ many }) => ({
  partyCharacters: many(partyCharacters),
}));

export const partyCharactersRelations = relations(partyCharacters, ({ one }) => ({
  party: one(parties, {
    fields: [partyCharacters.partyId],
    references: [parties.id],
  }),
}));

export type Party = typeof parties.$inferSelect;
export type NewParty = typeof parties.$inferInsert;
export type PartyCharacter = typeof partyCharacters.$inferSelect;
export type NewPartyCharacter = typeof partyCharacters.$inferInsert;
