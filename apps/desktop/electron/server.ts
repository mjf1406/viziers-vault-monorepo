import { createCoreRouter } from "@workspace/api-core";
import {
  createPgliteConnection,
  migratePglite,
  getOrCreateLocalProfile,
  type PgliteDb,
} from "@workspace/db";
import type { RuntimeConfig } from "@workspace/shared";
import { Hono } from "hono";
import { serve } from "@hono/node-server";

const DESKTOP_API_PORT = 3099;

const desktopRuntimeConfig: RuntimeConfig = {
  deploymentMode: "desktop",
  auth: {
    enabled: false,
    providers: { emailPassword: false, google: false },
  },
};

export async function createDesktopServer(
  dbPath: string,
  migrationsFolder: string
): Promise<{ port: number; db: PgliteDb }> {
  const db = createPgliteConnection(dbPath);
  await migratePglite(db, migrationsFolder);
  const { id: userId } = await getOrCreateLocalProfile(db);

  const getUserContext = () => ({ userId });

  const app = new Hono();
  app.route(
    "/api",
    createCoreRouter({ db, getUserContext, runtimeConfig: desktopRuntimeConfig })
  );

  serve(
    { fetch: app.fetch, port: DESKTOP_API_PORT, hostname: "127.0.0.1" },
    (info) => {
      console.log(`Desktop API on http://127.0.0.1:${info.port}`);
    }
  );

  return { port: DESKTOP_API_PORT, db };
}
