import { config as loadEnv } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { serve } from "@hono/node-server";
import { drizzle } from "drizzle-orm/postgres-js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import postgres from "postgres";
import * as schema from "@workspace/db/schema";
import { partyCharacters, parties } from "@workspace/db/schema";

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

const app = new Hono();
app.use("/*", cors());

app.get("/", (c) => c.json({ ok: true, service: "viziers-vault-api" }));

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/parties", async (c) => {
  const list = await db.query.parties.findMany({
    with: { partyCharacters: true },
  });
  return c.json(list);
});

type PostPartyBody = {
  id: string;
  name: string;
  characters: { id: string; level: number; quantity: number }[];
};

app.post("/parties", async (c) => {
  const body = (await c.req.json()) as PostPartyBody;
  const [party] = await db
    .insert(parties)
    .values({ id: body.id, name: body.name })
    .returning();
  if (!party) return c.json({ error: "Failed to create party" }, 500);
  if (body.characters.length > 0) {
    await db.insert(partyCharacters).values(
      body.characters.map((ch) => ({
        id: ch.id,
        partyId: body.id,
        level: ch.level,
        quantity: ch.quantity,
      }))
    );
  }
  const [created] = await db.query.parties.findMany({
    where: (p, { eq }) => eq(p.id, body.id),
    with: { partyCharacters: true },
  });
  return c.json(created ?? party);
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(`Server listening on http://localhost:${port}`);
