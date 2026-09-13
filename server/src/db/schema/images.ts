import { relations } from "drizzle-orm";
import { bigint, index, pgTable, text } from "drizzle-orm/pg-core";
import { users } from "./users";
import { createdAt, id, userId } from "./constants";

export const images = pgTable(
  "images",
  {
    id: id,
    userId: userId,
    key: text("key").notNull().unique(),
    bytes: bigint("bytes", { mode: "number" }).notNull(),
    createdAt: createdAt,
  },
  // FK-column hygiene, not a current lookup path — getImageForUser/
  // deleteImageForUser both key off the id PK, with userId only as an
  // ownership check on the row already found.
  (t) => [index("images_userid_idx").on(t.userId)],
);

export const imagesRelations = relations(images, ({ one }) => ({
  user: one(users, {
    fields: [images.userId],
    references: [users.id],
  }),
}));
