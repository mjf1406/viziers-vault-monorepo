/**
 * Runtime config returned by GET /api/config.
 * Server is the source of truth; frontend uses this to drive auth UI and routing.
 */
export type RuntimeConfig = {
  deploymentMode: "cloud" | "self-host" | "desktop";
  auth: {
    enabled: boolean;
    providers: {
      emailPassword: boolean;
      google: boolean;
    };
  };
};
