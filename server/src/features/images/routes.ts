import { validate } from "@/middleware/validate";
import { sessionAuth } from "@/middleware/auth";
import type { AppEnv } from "@/types";
import { Hono } from "hono";
import { imageIdParamSchema } from "./schema";
import { createDb } from "@/db";
import * as images from "./service";
import { created, noContent } from "@/lib/api-response";

export const imagesRoutes = new Hono<AppEnv>()
  .post("/", sessionAuth, async (c) => {
    const db = createDb(c.env.DATABASE_URL_POOLED);
    const bucket = c.env.IMAGES_BUCKET;

    const body = await c.req.arrayBuffer();
    const logger = c.get("logger").child({ route: "images.upload" });

    const { image } = await images.uploadImage(db, bucket, body, {
      userId: c.get("userId"),
      logger,
    });

    return created(c, {
      data: { id: image.id, bytes: image.bytes },
    });
  })
  .get(
    "/:id",
    sessionAuth,
    validate("param", imageIdParamSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL_POOLED);
      const bucket = c.env.IMAGES_BUCKET;

      const { id } = c.req.valid("param");
      const logger = c.get("logger").child({ route: "images.get" });

      const { image, body } = await images.getImage(db, bucket, id, {
        userId: c.get("userId"),
        logger,
      });

      return c.body(body, 200, {
        "Content-Type": images.IMAGE_CONTENT_TYPE,
        "Content-Length": String(image.bytes),
      });
    },
  )
  .delete(
    "/:id",
    sessionAuth,
    validate("param", imageIdParamSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL_POOLED);
      const bucket = c.env.IMAGES_BUCKET;

      const { id } = c.req.valid("param");
      const logger = c.get("logger").child({ route: "images.delete" });

      await images.deleteImage(db, bucket, id, {
        userId: c.get("userId"),
        logger,
      });

      return noContent(c);
    },
  );

export default imagesRoutes;
