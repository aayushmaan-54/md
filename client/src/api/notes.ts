import { apiFetch } from "./client";

// The server never interprets a note's `data` — it's an opaque blob owned
// by the client.
export type RemoteNoteData = {
  title: string;
  titleIsManual: boolean;
  content: string;
  createdAt: number;
};

export type PulledNote = { id: string; data: RemoteNoteData; version: number };

export const pullNotes = () => apiFetch<{ notes: PulledNote[] }>("/notes");

export type PushNoteInput = {
  id: string;
  data: RemoteNoteData;
  version: number;
};

export type PushResult =
  | { id: string; status: "ok"; version: number }
  | { id: string; status: "conflict"; currentVersion: number };

export const pushNotes = (notes: PushNoteInput[]) =>
  apiFetch<{ results: PushResult[] }>("/notes", {
    method: "PUT",
    body: JSON.stringify({ notes }),
  });

export const deleteRemoteNote = (id: string) =>
  apiFetch<undefined>(`/notes/${id}`, { method: "DELETE" });
