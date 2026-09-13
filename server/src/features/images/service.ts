import type { Db } from "@/db";
import { BadRequest, NotFound } from "@/lib/api-error";
import {
  reserveImageQuota,
  releaseImageQuota,
} from "@/features/quotas/service";
import { generateUuidV7 } from "@/utils/crypto";
import type { imagesOptions } from "./types";
import * as q from "./queries";

// Images are always stored as webp — client-side compression/conversion
// normalizes every upload before it reaches this endpoint.
export const IMAGE_CONTENT_TYPE = "image/webp";

// RIFF....WEBP container check — never trust the client-declared type.
function isWebp(body: ArrayBuffer): boolean {
  if (body.byteLength < 12) return false;
  const bytes = new Uint8Array(body, 0, 12);
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end));
  return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}

export async function uploadImage(
  db: Db,
  bucket: R2Bucket,
  body: ArrayBuffer,
  options: imagesOptions,
) {
  const logger = options.logger.child({
    feature: "images",
    action: "upload",
  });

  if (body.byteLength === 0) {
    throw new BadRequest("Image is empty");
  }

  if (!isWebp(body)) {
    throw new BadRequest("Image must be a valid WEBP file");
  }

  await reserveImageQuota(db, options.userId, body.byteLength, { logger });

  const id = generateUuidV7();
  const key = `${options.userId}/${id}`;

  try {
    await bucket.put(key, body, {
      httpMetadata: { contentType: IMAGE_CONTENT_TYPE },
    });
  } catch (err) {
    await releaseImageQuota(db, options.userId, body.byteLength, {
      logger,
    }).catch(() => {});
    throw err;
  }

  let image;
  try {
    [image] = await q.insertImage(db, {
      id,
      userId: options.userId,
      key,
      bytes: body.byteLength,
    });
  } catch (err) {
    await bucket.delete(key).catch(() => {});
    await releaseImageQuota(db, options.userId, body.byteLength, {
      logger,
    }).catch(() => {});
    throw err;
  }

  logger.info("image uploaded", { imageId: image.id, bytes: image.bytes });

  return { image };
}

export async function getImage(
  db: Db,
  bucket: R2Bucket,
  imageId: string,
  options: imagesOptions,
) {
  const logger = options.logger.child({ feature: "images", action: "get" });

  const image = await q.getImageForUser(db, imageId, options.userId);
  if (!image) {
    logger.warn("image not found", { imageId });
    throw new NotFound("Image not found");
  }

  const object = await bucket.get(image.key);
  if (!object) {
    logger.error("image row exists but object missing from storage", {
      imageId,
      key: image.key,
    });
    throw new NotFound("Image not found");
  }

  return { image, body: object.body };
}

export async function deleteImage(
  db: Db,
  bucket: R2Bucket,
  imageId: string,
  options: imagesOptions,
) {
  const logger = options.logger.child({
    feature: "images",
    action: "delete",
  });

  const [deleted] = await q.deleteImageForUser(db, imageId, options.userId);

  if (!deleted) {
    logger.warn("image not found for delete", { imageId });
    throw new NotFound("Image not found");
  }

  // release quota even if the R2 delete fails; the DB row is already gone
  await bucket.delete(deleted.key).catch((err) => {
    logger.error("failed to delete r2 object after db row removed", {
      imageId,
      key: deleted.key,
      reason: String(err),
    });
  });
  await releaseImageQuota(db, options.userId, deleted.bytes, { logger });

  logger.info("image deleted", { imageId });
}
