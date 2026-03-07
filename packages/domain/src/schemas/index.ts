/**
 * Shared domain schemas (Zod) for API and domain models.
 */
import { z } from "zod"
import { ROLES } from "../permissions/index.js"

export const roleSchema = z.enum(ROLES)

export const campaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  ownerId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type Campaign = z.infer<typeof campaignSchema>

export const membershipSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  userId: z.string(),
  role: roleSchema,
  joinedAt: z.coerce.date(),
})
export type Membership = z.infer<typeof membershipSchema>

export const inviteSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  email: z.string().email(),
  role: roleSchema,
  tokenHash: z.string(),
  invitedByUserId: z.string(),
  expiresAt: z.coerce.date(),
  acceptedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type Invite = z.infer<typeof inviteSchema>
