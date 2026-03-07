/**
 * Permission primitives and domain-level permission checks.
 * This package is the semantic source of truth for app roles.
 * packages/db roleEnum must stay synchronized with ROLES.
 */
export const ROLES = ["owner", "gm", "player", "viewer"] as const
export type Role = (typeof ROLES)[number]

export function canManageCampaign(role: Role): boolean {
  return role === "owner" || role === "gm"
}

export function canInvite(role: Role): boolean {
  return role === "owner" || role === "gm"
}
