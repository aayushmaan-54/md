import { relations, sql } from "drizzle-orm";
import {
  index,
  inet,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { createdAt, id, userId } from "./constants";

export const sessions = pgTable(
  "sessions",
  {
    id: id,
    tokenHash: text("token_hash").notNull().unique(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    userId: userId,
    createdAt: createdAt,
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("sessions_tokenhash_unique_idx").on(t.tokenHash),
    index("sessions_tokenhash_expiresat_idx").on(t.tokenHash, t.expiresAt),
  ],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
