import { getAllNotes, putNote, deleteNoteRecord } from "../storage/notes-db";
import { createNote, deriveTitle } from "./model";
import type { Note } from "./model";
import { debounce } from "../lib/debounce";
import { deleteRemoteNote, pullNotes, pushNotes } from "../api/notes";
import type { PushNoteInput } from "../api/notes";
import { findLocalImageIds } from "../images/model";
import { deleteImageRecord, getImage } from "../storage/images-db";
import { deleteRemoteImage } from "../api/images";
import { releaseLocalImageUrl } from "../preview/render";

const SAVE_DEBOUNCE_MS = 400;

// Mirrors server/src/config/constants.ts MAX_NOTES_PER_PUSH, which
// rejects a larger batch outright — pushAll() chunks to this size.
const MAX_NOTES_PER_PUSH = 200;

export type SaveState = "saving" | "saved";

export type NotesStoreEvents = {
  onListChanged?: (notes: Note[]) => void;
  onSaveStateChanged?: (state: SaveState) => void;
};

function uniqueTitle(desired: string, existingTitles: Set<string>): string {
  if (!existingTitles.has(desired)) return desired;
  let n = 2;
  while (existingTitles.has(`${desired} ${n}`)) n++;
  return `${desired} ${n}`;
}

// Owns the in-memory note list and mirrors every mutation to IndexedDB.
// Content edits are saved debounced (see updateContent/flush); everything
// else (create/delete/import) writes immediately.
export class NotesStore {
  private notes: Note[] = [];
  private events: NotesStoreEvents;
  private persistDebouncers = new Map<string, (note: Note) => void>();
  private pendingDeletes = new Map<string, Note>();

  constructor(events: NotesStoreEvents = {}) {
    this.events = events;
  }

  async load(): Promise<Note[]> {
    this.notes = await getAllNotes();
    this.sortAndNotify();
    return this.notes;
  }

  list(): Note[] {
    return this.notes;
  }

  get(id: string): Note | undefined {
    return this.notes.find((note) => note.id === id);
  }

  async create(content = "", fallbackTitle = "Untitled"): Promise<Note> {
    const note = createNote(content, fallbackTitle);
    this.notes.unshift(note);
    await putNote(note);
    this.sortAndNotify();
    return note;
  }

  // Soft delete, for the undo-toast flow in the UI: removes the note
  // from the visible list immediately, but doesn't touch IndexedDB or
  // the server until the undo window expires (commitDelete). undelete()
  // restores it if the user clicks Undo in time.
  softDelete(id: string): Note | undefined {
    const index = this.notes.findIndex((note) => note.id === id);
    if (index === -1) return undefined;

    const [note] = this.notes.splice(index, 1);
    this.pendingDeletes.set(id, note);
    this.notifyListChanged();
    return note;
  }

  undelete(id: string): void {
    const note = this.pendingDeletes.get(id);
    if (!note) return;

    this.pendingDeletes.delete(id);
    this.notes.unshift(note);
    this.sortAndNotify();
  }

  async commitDelete(id: string): Promise<void> {
    const note = this.pendingDeletes.get(id);
    if (!note) return;
    this.pendingDeletes.delete(id);

    await deleteNoteRecord(id);
    this.persistDebouncers.delete(id);

    // Best-effort: local delete must succeed regardless of sync state
    // (not logged in, offline, note never pushed => 404). Without this,
    // a note deleted locally would still exist server-side and a later
    // Pull would resurrect it, since Pull only skips ids already local.
    if (note.version > 0) deleteRemoteNote(id).catch(() => {});

    // Clean up images only this note referenced, freeing quota — but
    // not ones still referenced by another live or pending-delete note.
    const stillReferenced = new Set<string>();
    for (const other of this.notes) {
      for (const imageId of findLocalImageIds(other.content)) stillReferenced.add(imageId);
    }
    for (const pending of this.pendingDeletes.values()) {
      for (const imageId of findLocalImageIds(pending.content)) stillReferenced.add(imageId);
    }

    for (const imageId of findLocalImageIds(note.content)) {
      if (stillReferenced.has(imageId)) continue;
      const image = await getImage(imageId);
      await deleteImageRecord(imageId);
      releaseLocalImageUrl(imageId);
      if (image?.remoteId) deleteRemoteImage(image.remoteId).catch(() => {});
    }
  }

  async importFiles(files: FileList | File[]): Promise<Note[]> {
    const created: Note[] = [];
    for (const file of Array.from(files)) {
      const content = await file.text();
      const fallbackTitle = file.name.replace(/\.[^/.]+$/, "") || "Untitled";
      created.push(await this.create(content, fallbackTitle));
    }
    return created;
  }

  // Debounced per note: content is only written to IndexedDB (and the
  // sidebar re-sorted/re-titled) once typing pauses, not on every
  // keystroke. Call flush() to force it immediately (e.g. before
  // switching to a different note).
  updateContent(id: string, content: string): void {
    const note = this.get(id);
    if (!note) return;

    note.content = content;
    if (!note.titleIsManual) note.title = deriveTitle(content, note.title);
    note.updatedAt = Date.now();
    this.events.onSaveStateChanged?.("saving");

    let persist = this.persistDebouncers.get(id);
    if (!persist) {
      persist = debounce((n: Note) => {
        void putNote(n).then(() => this.events.onSaveStateChanged?.("saved"));
        this.sortAndNotify();
      }, SAVE_DEBOUNCE_MS);
      this.persistDebouncers.set(id, persist);
    }
    persist(note);
  }

  async flush(id: string): Promise<void> {
    const note = this.get(id);
    if (note) await putNote(note);
    this.events.onSaveStateChanged?.("saved");
  }

  // Explicit rename (double-click in the sidebar): locks the title so
  // later content edits stop re-deriving it from the first heading.
  async rename(id: string, title: string): Promise<void> {
    const note = this.get(id);
    const trimmed = title.trim();
    if (!note || !trimmed) return;

    note.title = trimmed;
    note.titleIsManual = true;
    note.updatedAt = Date.now();
    await putNote(note);
    this.sortAndNotify();
  }

  // Pushes every local note to the server as a checkpoint. Per-note
  // optimistic concurrency: a note whose local version is behind the
  // server's is reported as a conflict, the rest of the batch still lands.
  async pushAll(): Promise<{ pushed: number; conflicts: number }> {
    if (this.notes.length === 0) return { pushed: 0, conflicts: 0 };

    let pushed = 0;
    let conflicts = 0;

    for (let i = 0; i < this.notes.length; i += MAX_NOTES_PER_PUSH) {
      const batch = this.notes.slice(i, i + MAX_NOTES_PER_PUSH);
      const inputs: PushNoteInput[] = batch.map((note) => ({
        id: note.id,
        version: note.version,
        data: {
          title: note.title,
          titleIsManual: note.titleIsManual,
          content: note.content,
          createdAt: note.createdAt,
        },
      }));

      const { results } = await pushNotes(inputs);

      for (const result of results) {
        const note = this.get(result.id);
        if (!note) continue;

        if (result.status === "ok") {
          note.version = result.version;
          await putNote(note);
          pushed++;
        } else {
          conflicts++;
        }
      }
    }

    this.notifyListChanged();
    return { pushed, conflicts };
  }

  // Additive merge: a note the server has that isn't known locally becomes
  // a new local note (title-collision gets a Windows-style " 2" suffix);
  // a note that already exists locally by id is left untouched — pull
  // never silently overwrites local edits.
  async pull(): Promise<{ added: number; skipped: number }> {
    const { notes: pulled } = await pullNotes();
    const existingTitles = new Set(this.notes.map((note) => note.title));

    let added = 0;
    let skipped = 0;

    for (const remote of pulled) {
      if (this.get(remote.id)) {
        skipped++;
        continue;
      }

      const title = uniqueTitle(remote.data.title || "Untitled", existingTitles);
      existingTitles.add(title);

      const note: Note = {
        id: remote.id,
        title,
        titleIsManual: remote.data.titleIsManual ?? false,
        content: remote.data.content ?? "",
        createdAt: remote.data.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        version: remote.version,
      };

      this.notes.unshift(note);
      await putNote(note);
      added++;
    }

    this.sortAndNotify();
    return { added, skipped };
  }

  private sortAndNotify() {
    this.notes.sort((a, b) => b.updatedAt - a.updatedAt);
    this.notifyListChanged();
  }

  private notifyListChanged() {
    this.events.onListChanged?.(this.notes);
  }
}
