import { Hono } from "hono";
import routes from "./routes";
import { registerMiddleware } from "./middleware";
import type { AppEnv, Bindings } from "@/types";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { API_PREFIX } from "@/config/constants";
import { createDb } from "@/db";
import { createLogger } from "@/lib/logger";
import { purgeExpiredSessions } from "@/features/auth/service";

const app = new Hono<AppEnv>();

registerMiddleware(app);

app.route(API_PREFIX, routes);

app.onError(errorHandler);
app.notFound(notFoundHandler);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings) {
    const logger = createLogger(
      { scheduled: true },
      env.ENVIRONMENT === "development",
    );
    const db = createDb(env.DATABASE_URL_POOLED);

    await purgeExpiredSessions(db, { logger });
  },
};
