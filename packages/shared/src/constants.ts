/**
 * Deployment mode — server-side only; frontend learns capabilities from GET /api/config.
 */
export const DeploymentMode = {
  CLOUD: "cloud",
  SELF_HOST: "self-host",
  DESKTOP: "desktop",
} as const;

export type DeploymentMode = (typeof DeploymentMode)[keyof typeof DeploymentMode];
