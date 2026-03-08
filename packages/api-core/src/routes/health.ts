import { Hono } from "hono";

export function createHealthRoute() {
  const app = new Hono();
  app.get("/health", (c) => c.json({ ok: true }));
  return app;
}
