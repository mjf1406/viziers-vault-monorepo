import { Hono } from "hono";
import type { RuntimeConfig } from "@workspace/shared";
import type { PostgresDb, PgliteDb } from "@workspace/db";
import type { GetUserContext } from "./middleware/user-context";
import { createHealthRoute } from "./routes/health";
import { createConfigRoute } from "./routes/config";
import { createNotesRoute } from "./routes/notes";

type Db = PostgresDb | PgliteDb;

export type CreateCoreRouterOptions = {
  db: Db;
  getUserContext: GetUserContext;
  runtimeConfig: RuntimeConfig;
};

/**
 * Creates the core Hono router with health, config, and notes routes.
 * Consumer mounts this at /api so paths become /api/health, /api/config, /api/notes.
 */
export function createCoreRouter(options: CreateCoreRouterOptions): Hono {
  const { db, getUserContext, runtimeConfig } = options;
  const app = new Hono();

  app.route("/", createHealthRoute());
  app.route("/", createConfigRoute(runtimeConfig));
  app.route("/", createNotesRoute(db, getUserContext));

  return app;
}

export type { GetUserContext } from "./middleware/user-context";
