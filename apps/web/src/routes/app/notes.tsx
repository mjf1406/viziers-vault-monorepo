import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@workspace/ui/components/button";
import type { Note } from "@workspace/shared";
import { useState } from "react";

/** API returns ISO date strings */
type NoteFromApi = Omit<Note, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export const Route = createFileRoute("/app/notes")({
  component: NotesPage,
});

const notesQueryKey = ["notes"] as const;

function NotesPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { data: notes = [], isPending } = useQuery({
    queryKey: notesQueryKey,
    queryFn: () => apiFetch<NoteFromApi[]>("/notes"),
  });

  const createMutation = useMutation({
    mutationFn: (body: { title: string; content: string }) =>
      apiFetch<Note>("/notes", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onMutate: async (newNote) => {
      await queryClient.cancelQueries({ queryKey: notesQueryKey });
      const previous = queryClient.getQueryData<Note[]>(notesQueryKey);
      queryClient.setQueryData<NoteFromApi[]>(notesQueryKey, (old = []) => [
        ...old,
        {
          id: "temp-" + Date.now(),
          userId: "",
          title: newNote.title,
          content: newNote.content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notesQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notesQueryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { title?: string; content?: string };
    }) =>
      apiFetch<NoteFromApi>(`/notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: notesQueryKey });
      const previous = queryClient.getQueryData<Note[]>(notesQueryKey);
      queryClient.setQueryData<NoteFromApi[]>(notesQueryKey, (old = []) =>
        old.map((n) =>
          n.id === id
            ? { ...n, ...body, updatedAt: new Date().toISOString() }
            : n
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notesQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notesQueryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/notes/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notesQueryKey });
      const previous = queryClient.getQueryData<Note[]>(notesQueryKey);
      queryClient.setQueryData<NoteFromApi[]>(notesQueryKey, (old = []) =>
        old.filter((n) => n.id !== id)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notesQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notesQueryKey });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({ title: title.trim(), content });
    setTitle("");
    setContent("");
  };

  if (isPending) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Loading notes…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-medium">Notes</h2>
        <Link to="/app" className="text-muted-foreground text-sm hover:underline">
          Back to app
        </Link>
      </div>
      <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border-input bg-background flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Content (optional)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="border-input bg-background flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={createMutation.isPending}>
          Add note
        </Button>
      </form>
      <ul className="space-y-2">
        {notes.map((note) => (
          <li
            key={note.id}
            className="border-border flex items-center justify-between gap-2 rounded-lg border p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{note.title}</p>
              {note.content && (
                <p className="text-muted-foreground text-sm">{note.content}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newTitle = prompt("New title", note.title);
                if (newTitle != null && newTitle !== note.title) {
                  updateMutation.mutate({ id: note.id, body: { title: newTitle } });
                }
              }}
              disabled={updateMutation.isPending}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteMutation.mutate(note.id)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
      {notes.length === 0 && (
        <p className="text-muted-foreground text-sm">No notes yet. Create one above.</p>
      )}
    </div>
  );
}
