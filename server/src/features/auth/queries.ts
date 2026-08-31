import { and, eq, isNull, lt } from "drizzle-orm";
import type { Db } from "@/db";
import { sessions, users } from "@/db/schema";

export const findUserByUsername = async (db: Db, username: string) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  return user;
};

export const insertUser = (db: Db, user: typeof users.$inferInsert) =>
  db.insert(users).values(user).returning();

export const insertSession = (db: Db, session: typeof sessions.$inferInsert) =>
  db.insert(sessions).values(session);

export const updateUserLastLogin = (db: Db, userId: string) =>
  db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId));

export const touchSession = (db: Db, tokenHash: string, expiresAt: Date) =>
  db
    .update(sessions)
    .set({ expiresAt, lastUsedAt: new Date() })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));

export const revokeSessionByTokenHash = async (
  db: Db,
  tokenHash: string,
) => {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
};

export const deleteExpiredSessions = (db: Db) =>
  db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });
