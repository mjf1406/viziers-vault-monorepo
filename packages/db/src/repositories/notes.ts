import { and, desc, eq } from "drizzle-orm";
import type { PostgresDb } from "../connections/postgres";
import type { PgliteDb } from "../connections/pglite";
import { notes as notesTable } from "../schema";

type Db = PostgresDb | PgliteDb;

export async function listNotes(db: Db, userId: string) {
  return db
    .select()
    .from(notesTable)
    .where(eq(notesTable.userId, userId))
    .orderBy(desc(notesTable.updatedAt));
}

export async function getNoteById(db: Db, id: string, userId: string) {
  const rows = await db
    .select()
    .from(notesTable)
    .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createNote(
  db: Db,
  userId: string,
  data: { title: string; content: string }
) {
  const [row] = await db
    .insert(notesTable)
    .values({
      userId,
      title: data.title,
      content: data.content ?? "",
    })
    .returning();
  return row!;
}

export async function updateNote(
  db: Db,
  id: string,
  userId: string,
  data: { title?: string; content?: string }
) {
  const [row] = await db
    .update(notesTable)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteNote(db: Db, id: string, userId: string) {
  const [row] = await db
    .delete(notesTable)
    .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)))
    .returning();
  return row ?? null;
}
