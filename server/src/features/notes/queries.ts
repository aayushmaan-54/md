import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { notes } from "@/db/schema";

// Same single-statement conditional write as the old workspace push, just
// scoped to one note (userId, id) instead of the whole account. Zero rows
// back means the caller is stale and must pull that note before retrying.
export const upsertNote = (
  db: Db,
  userId: string,
  id: string,
  data: unknown,
  expectedVersion: number,
) =>
  db
    .insert(notes)
    .values({ userId, id, data, version: 1 })
    .onConflictDoUpdate({
      target: [notes.userId, notes.id],
      set: { data, version: sql`${notes.version} + 1` },
      where: eq(notes.version, expectedVersion),
    })
    .returning({ id: notes.id, version: notes.version });

export const getNoteVersions = (db: Db, userId: string, ids: string[]) =>
  db
    .select({ id: notes.id, version: notes.version })
    .from(notes)
    .where(and(eq(notes.userId, userId), inArray(notes.id, ids)));

export const getAllNotes = (db: Db, userId: string) =>
  db
    .select({ id: notes.id, data: notes.data, version: notes.version })
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updatedAt));

export const deleteNote = (db: Db, userId: string, id: string) =>
  db
    .delete(notes)
    .where(and(eq(notes.userId, userId), eq(notes.id, id)))
    .returning({ id: notes.id });
