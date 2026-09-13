import { relations } from "drizzle-orm";
import { index, inet, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    // No query filters by userId alone yet — this is FK-column hygiene
    // (an unindexed FK means a future user-deletion cascade sequential-
    // scans this table), not a currently-exercised lookup path.
    index("sessions_userid_idx").on(t.userId),
    index("sessions_expiresat_idx").on(t.expiresAt),
  ],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
