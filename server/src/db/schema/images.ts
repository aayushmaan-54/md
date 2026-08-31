import { relations } from "drizzle-orm";
import { bigint, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";
import { createdAt, id, userId } from "./constants";

export const images = pgTable("images", {
  id: id,
  userId: userId,
  key: text("key").notNull().unique(),
  bytes: bigint("bytes", { mode: "number" }).notNull(),
  createdAt: createdAt,
});

export const imagesRelations = relations(images, ({ one }) => ({
  user: one(users, {
    fields: [images.userId],
    references: [users.id],
  }),
}));
