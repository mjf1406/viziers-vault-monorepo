import type { RuntimeConfig } from "@workspace/shared";

declare global {
  interface Window {
    __APP_RUNTIME__?: {
      apiBaseUrl: string;
      deploymentMode: RuntimeConfig["deploymentMode"];
    };
  }
}

export {};
