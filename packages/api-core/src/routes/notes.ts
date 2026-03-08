import { Hono } from "hono";
import type { GetUserContext } from "../middleware/user-context";
import * as notesService from "../services/notes";
import type { PostgresDb, PgliteDb } from "@workspace/db";
import { createNoteSchema, updateNoteSchema } from "@workspace/shared";

type Db = PostgresDb | PgliteDb;

function noteToResponse(row: {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createNotesRoute(db: Db, getUserContext: GetUserContext) {
  const app = new Hono();

  app.get("/notes", async (c) => {
    const user = await Promise.resolve(getUserContext(c));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const list = await notesService.listNotes(db, user.userId);
    return c.json(list.map(noteToResponse));
  });

  app.get("/notes/:id", async (c) => {
    const user = await Promise.resolve(getUserContext(c));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const id = c.req.param("id");
    const note = await notesService.getNote(db, id, user.userId);
    if (!note) return c.json({ error: "Not found" }, 404);
    return c.json(noteToResponse(note));
  });

  app.post("/notes", async (c) => {
    const user = await Promise.resolve(getUserContext(c));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const body = await c.req.json();
    const parsed = createNoteSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", issues: parsed.error.issues }, 400);
    }
    const note = await notesService.createNote(db, user.userId, parsed.data);
    return c.json(noteToResponse(note), 201);
  });

  app.patch("/notes/:id", async (c) => {
    const user = await Promise.resolve(getUserContext(c));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const id = c.req.param("id");
    const body = await c.req.json();
    const parsed = updateNoteSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", issues: parsed.error.issues }, 400);
    }
    const note = await notesService.updateNote(db, id, user.userId, parsed.data);
    if (!note) return c.json({ error: "Not found" }, 404);
    return c.json(noteToResponse(note));
  });

  app.delete("/notes/:id", async (c) => {
    const user = await Promise.resolve(getUserContext(c));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const id = c.req.param("id");
    const note = await notesService.deleteNote(db, id, user.userId);
    if (!note) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });

  return app;
}
