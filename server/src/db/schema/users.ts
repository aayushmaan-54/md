import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sessions } from "./sessions";
import { notes } from "./notes";
import { quotas } from "./quotas";
import { createdAt, id, updatedAt } from "./constants";
import { images } from "./images";

export const users = pgTable("users", {
  id: id,
  username: varchar("username", { length: 30 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt,
  updatedAt: updatedAt,
});

export const usersRelations = relations(users, ({ one, many }) => ({
  sessions: many(sessions),
  notes: many(notes),
  images: many(images),
  quota: one(quotas), // only one quota type (image) exists today
}));
