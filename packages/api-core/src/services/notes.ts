import {
  type PostgresDb,
  type PgliteDb,
  listNotes as repoListNotes,
  getNoteById as repoGetNoteById,
  createNote as repoCreateNote,
  updateNote as repoUpdateNote,
  deleteNote as repoDeleteNote,
} from "@workspace/db";
import type { CreateNoteInput, UpdateNoteInput } from "@workspace/shared";

type Db = PostgresDb | PgliteDb;

export async function listNotes(db: Db, userId: string) {
  return repoListNotes(db, userId);
}

export async function getNote(db: Db, id: string, userId: string) {
  return repoGetNoteById(db, id, userId);
}

export async function createNote(db: Db, userId: string, data: CreateNoteInput) {
  return repoCreateNote(db, userId, {
    title: data.title,
    content: data.content ?? "",
  });
}

export async function updateNote(
  db: Db,
  id: string,
  userId: string,
  data: UpdateNoteInput
) {
  return repoUpdateNote(db, id, userId, data);
}

export async function deleteNote(db: Db, id: string, userId: string) {
  return repoDeleteNote(db, id, userId);
}
