import type { Db } from "@/db";
import { NotFound } from "@/lib/api-error";
import type { PushNoteInput } from "./schema";
import type { notesOptions } from "./types";
import * as q from "./queries";

type PushResult =
  | { id: string; status: "ok"; version: number }
  | { id: string; status: "conflict"; currentVersion: number };

// Each note is an independent conditional write — a batch can land as a mix
// of ok/conflict results, unlike the old whole-blob push which was all or
// nothing.
export async function pushNotes(
  db: Db,
  items: PushNoteInput[],
  options: notesOptions,
): Promise<PushResult[]> {
  const logger = options.logger.child({ feature: "notes", action: "push" });
  const results: PushResult[] = [];

  for (const note of items) {
    const [row] = await q.upsertNote(
      db,
      options.userId,
      note.id,
      note.data,
      note.version,
    );

    if (row) {
      results.push({ id: note.id, status: "ok", version: row.version });
      continue;
    }

    const [current] = await q.getNoteVersions(db, options.userId, [note.id]);
    logger.warn("note push stale version", {
      noteId: note.id,
      sent: note.version,
      currentVersion: current?.version ?? 0,
    });
    results.push({
      id: note.id,
      status: "conflict",
      currentVersion: current?.version ?? 0,
    });
  }

  logger.info("notes pushed", {
    count: items.length,
    conflicts: results.filter((r) => r.status === "conflict").length,
  });

  return results;
}

export async function pullNotes(db: Db, options: notesOptions) {
  const logger = options.logger.child({ feature: "notes", action: "pull" });

  const rows = await q.getAllNotes(db, options.userId);

  logger.info("notes pulled", { count: rows.length });

  return rows;
}

export async function deleteNote(
  db: Db,
  id: string,
  options: notesOptions,
) {
  const logger = options.logger.child({ feature: "notes", action: "delete" });

  const [deleted] = await q.deleteNote(db, options.userId, id);

  if (!deleted) {
    logger.warn("note not found for delete", { noteId: id });
    throw new NotFound("Note not found");
  }

  logger.info("note deleted", { noteId: id });
}
