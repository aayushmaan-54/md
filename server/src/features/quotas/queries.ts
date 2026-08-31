import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { quotas } from "@/db/schema";

export const reserveQuotaBytes = (
  db: Db,
  userId: string,
  type: string,
  bytes: number,
) =>
  db
    .insert(quotas)
    .values({ userId, type, bytes })
    .onConflictDoUpdate({
      target: [quotas.userId, quotas.type],
      set: { bytes: sql`${quotas.bytes} + ${bytes}` },
    })
    .returning({ bytes: quotas.bytes });

export const releaseQuotaBytes = (
  db: Db,
  userId: string,
  type: string,
  bytes: number,
) =>
  db
    .update(quotas)
    .set({ bytes: sql`GREATEST(${quotas.bytes} - ${bytes}, 0)` })
    .where(and(eq(quotas.userId, userId), eq(quotas.type, type)))
    .returning({ bytes: quotas.bytes });

export const getQuotaBytes = async (db: Db, userId: string, type: string) => {
  const [row] = await db
    .select({ bytes: quotas.bytes })
    .from(quotas)
    .where(and(eq(quotas.userId, userId), eq(quotas.type, type)))
    .limit(1);

  return row?.bytes ?? 0;
};
