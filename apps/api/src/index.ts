import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createCoreRouter } from "@workspace/api-core";
import { parseEnv } from "./env";
import { createDb } from "./db";
import { createAuth } from "./auth";
import { getRuntimeConfig } from "./runtime-config";
import { devCors } from "./middleware/cors";

async function main() {
  const env = parseEnv();
  const db = createDb(env);
  const auth = createAuth(env, db);
  const runtimeConfig = getRuntimeConfig(env);

  const getUserContext = async (c: { req: { raw: Request } }) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) return null;
    return { userId: session.user.id };
  };

  const app = new Hono();

  if (process.env.NODE_ENV === "development") {
    app.use("/api/*", devCors());
  }

  app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  app.route("/api", createCoreRouter({ db, getUserContext, runtimeConfig }));

  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.log(`API listening on http://127.0.0.1:${info.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
