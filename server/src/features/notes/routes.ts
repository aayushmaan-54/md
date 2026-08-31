import { validate } from "@/middleware/validate";
import { sessionAuth } from "@/middleware/auth";
import type { AppEnv } from "@/types";
import { Hono } from "hono";
import { pushNotesSchema, noteIdParamSchema } from "./schema";
import { createDb } from "@/db";
import * as notes from "./service";
import { noContent, ok } from "@/lib/api-response";

export const notesRoutes = new Hono<AppEnv>()
  .get("/", sessionAuth, async (c) => {
    const db = createDb(c.env.DATABASE_URL_POOLED);
    const logger = c.get("logger").child({ route: "notes.pull" });

    const items = await notes.pullNotes(db, {
      userId: c.get("userId"),
      logger,
    });

    return ok(c, { data: { notes: items } });
  })
  .put("/", sessionAuth, validate("json", pushNotesSchema), async (c) => {
    const db = createDb(c.env.DATABASE_URL_POOLED);
    const { notes: items } = c.req.valid("json");
    const logger = c.get("logger").child({ route: "notes.push" });

    const results = await notes.pushNotes(db, items, {
      userId: c.get("userId"),
      logger,
    });

    return ok(c, { data: { results } });
  })
  .delete(
    "/:id",
    sessionAuth,
    validate("param", noteIdParamSchema),
    async (c) => {
      const db = createDb(c.env.DATABASE_URL_POOLED);
      const { id } = c.req.valid("param");
      const logger = c.get("logger").child({ route: "notes.delete" });

      await notes.deleteNote(db, id, {
        userId: c.get("userId"),
        logger,
      });

      return noContent(c);
    },
  );

export default notesRoutes;
