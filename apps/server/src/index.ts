import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { serve } from "@hono/node-server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@workspace/db/schema";
import { createApp } from "@workspace/api";

// Load root .env when running server#dev (monorepo root is three levels up from src/)
const __dirname = fileURLToPath(new URL(".", import.meta.url));
loadEnv({ path: resolve(__dirname, "../../../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 10 });
export const db = drizzle(client, { schema });

const app = createApp(db);

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(`Server listening on http://localhost:${port}`);
