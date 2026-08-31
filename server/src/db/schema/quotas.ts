import { relations, sql } from "drizzle-orm";
import { bigint, check, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { IMAGE_QUOTA_BYTES } from "@/config/constants";
import { users } from "./users";
import { createdAt, updatedAt, userId } from "./constants";

export const QUOTA_TYPES = {
  IMAGE: "image",
} as const;

export const quotas = pgTable(
  "quotas",
  {
    userId: userId,
    type: text("type").notNull(),
    bytes: bigint("bytes", { mode: "number" }).notNull().default(0),
    createdAt: createdAt,
    updatedAt: updatedAt,
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.type] }),
    check(
      "quotas_bytes_within_limit",
      sql`${t.bytes} >= 0 AND ${t.bytes} <= ${sql.raw(String(IMAGE_QUOTA_BYTES))}`,
    ),
  ],
);

export const quotasRelations = relations(quotas, ({ one }) => ({
  user: one(users, {
    fields: [quotas.userId],
    references: [users.id],
  }),
}));
