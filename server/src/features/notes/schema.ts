import { z } from "zod";
import { MAX_NOTES_PER_PUSH } from "@/config/constants";

// The server never interprets a note's internal shape — it's an opaque
// blob owned by the client. Only object shapes are accepted (not
// null/undefined/primitives) so a malformed push fails validation with
// a 400 instead of a DB not-null violation.
const noteInputSchema = z.object({
  id: z.uuid("Invalid note id"),
  data: z.record(z.string(), z.unknown()),
  version: z.number().int().min(0),
});

export const pushNotesSchema = z.object({
  notes: z.array(noteInputSchema).min(1).max(MAX_NOTES_PER_PUSH),
});

export const noteIdParamSchema = z.object({
  id: z.uuid("Invalid note id"),
});

export type PushNoteInput = z.infer<typeof noteInputSchema>;
