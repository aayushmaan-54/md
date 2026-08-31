import type { Note } from "../notes/model";
import { NOTES_STORE, withStore } from "./db";

export function getAllNotes(): Promise<Note[]> {
  return withStore(NOTES_STORE, "readonly", (store) => store.getAll());
}

export async function putNote(note: Note): Promise<void> {
  await withStore(NOTES_STORE, "readwrite", (store) => store.put(note));
}

export async function deleteNoteRecord(id: string): Promise<void> {
  await withStore(NOTES_STORE, "readwrite", (store) => store.delete(id));
}
