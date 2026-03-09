import { Hono } from "hono";
import { cors } from "hono/cors";
import * as schema from "@workspace/db/schema";
import { partyCharacters, parties } from "@workspace/db/schema";

/** Drizzle instance with shared schema (postgres-js or PGlite). Both drivers satisfy this shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createApp(db: any): Hono {
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

  return app;
}
