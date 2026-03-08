import type { RuntimeConfig } from "@workspace/shared";
import type { Env } from "./env";

export function getRuntimeConfig(env: Env): RuntimeConfig {
  const hasGoogle =
    env.DEPLOYMENT_MODE === "cloud" &&
    !!env.GOOGLE_CLIENT_ID &&
    !!env.GOOGLE_CLIENT_SECRET;

  return {
    deploymentMode: env.DEPLOYMENT_MODE,
    auth: {
      enabled: true,
      providers: {
        emailPassword: true,
        google: hasGoogle,
      },
    },
  };
}
