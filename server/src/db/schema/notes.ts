import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { createdAt, updatedAt, userId } from "./constants";

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").notNull(), // Client side generated
    userId: userId,
    data: jsonb("data").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: createdAt,
    updatedAt: updatedAt,
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index("notes_userId_updatedAt_idx").on(t.userId, t.updatedAt),
  ],
);

export const notesRelations = relations(notes, ({ one }) => ({
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
}));
