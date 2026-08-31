import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { images } from "@/db/schema";

export const insertImage = (db: Db, image: typeof images.$inferInsert) =>
  db.insert(images).values(image).returning();

export const getImageForUser = async (
  db: Db,
  id: string,
  userId: string,
) => {
  const [image] = await db
    .select()
    .from(images)
    .where(and(eq(images.id, id), eq(images.userId, userId)))
    .limit(1);

  return image;
};

export const deleteImageForUser = (db: Db, id: string, userId: string) =>
  db
    .delete(images)
    .where(and(eq(images.id, id), eq(images.userId, userId)))
    .returning();
