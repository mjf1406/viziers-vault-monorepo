/**
 * Application domain tables.
 * Role enum values must stay in sync with ROLES in packages/domain (source of truth).
 */
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { pgEnum } from "drizzle-orm/pg-core"
import { user } from "./auth.js"

export const roleEnum = pgEnum("role", ["owner", "gm", "player", "viewer"])

export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: text("ownerId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
})

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaignId")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: roleEnum().notNull().default("player"),
    joinedAt: timestamp("joinedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memberships_campaign_user").on(t.campaignId, t.userId)],
)

export const invites = pgTable("invites", {
  id: text("id").primaryKey(),
  campaignId: text("campaignId")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: roleEnum().notNull().default("player"),
  tokenHash: text("tokenHash").notNull().unique(),
  invitedByUserId: text("invitedByUserId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("acceptedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
})
