import type { Db } from "@/db";
import { QUOTA_TYPES } from "@/db/schema";
import { Forbidden } from "@/lib/api-error";
import type { Logger } from "@/lib/logger";
import * as q from "./queries";

const isCheckViolation = (err: unknown): err is { code: "23514" } =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  err.code === "23514";

export async function reserveImageQuota(
  db: Db,
  userId: string,
  bytes: number,
  options: { logger: Logger },
) {
  const logger = options.logger.child({
    feature: "quotas",
    action: "reserve",
  });

  try {
    const [row] = await q.reserveQuotaBytes(
      db,
      userId,
      QUOTA_TYPES.IMAGE,
      bytes,
    );

    logger.info("image quota reserved", { userId, bytes, total: row.bytes });

    return row.bytes;
  } catch (err) {
    if (isCheckViolation(err)) {
      logger.warn("image quota exceeded", { userId, bytes });
      throw new Forbidden("Image storage quota exceeded");
    }
    throw err;
  }
}

export async function releaseImageQuota(
  db: Db,
  userId: string,
  bytes: number,
  options: { logger: Logger },
) {
  const logger = options.logger.child({
    feature: "quotas",
    action: "release",
  });

  const [row] = await q.releaseQuotaBytes(
    db,
    userId,
    QUOTA_TYPES.IMAGE,
    bytes,
  );

  logger.info("image quota released", { userId, bytes, total: row?.bytes });
}

export async function getImageQuotaUsage(db: Db, userId: string) {
  return q.getQuotaBytes(db, userId, QUOTA_TYPES.IMAGE);
}
