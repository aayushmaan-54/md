import { createMiddleware } from "hono/factory";
import type { AppEnv } from "@/types";
import { createLogger } from "@/lib/logger";

export const loggerMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const log = createLogger(
    {
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
    },
    c.env.ENVIRONMENT === "development",
  );

  c.set("logger", log);

  const start = Date.now();
  try {
    await next();
  } finally {
    log.info("request complete", {
      status: c.res.status,
      durationMs: Date.now() - start,
    });
  }
});
