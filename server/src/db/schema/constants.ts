import { sql } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const id = uuid("id")
  .primaryKey()
  .default(sql`uuidv7()`);

export const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow();

export const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());

export const userId = uuid("user_id")
  .notNull()
  .references(() => users.id, { onDelete: "cascade" });
