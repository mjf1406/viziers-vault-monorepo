import { Hono } from "hono";
import type { RuntimeConfig } from "@workspace/shared";

export function createConfigRoute(runtimeConfig: RuntimeConfig) {
  const app = new Hono();
  app.get("/config", (c) => c.json(runtimeConfig));
  return app;
}
