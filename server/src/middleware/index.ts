import type { Hono } from "hono";
import type { AppEnv } from "@/types";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { prettyJSON } from "hono/pretty-json";
import { timing } from "hono/timing";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { bodyLimit } from "hono/body-limit";
import { loggerMiddleware } from "./logger";
import { rateLimit } from "./rate-limit";
import { API_PREFIX } from "@/config/constants";

export const registerMiddleware = (app: Hono<AppEnv>) => {
  app.use("*", requestId({ headerName: "cf-ray" }));
  app.use("*", loggerMiddleware);
  app.use("*", secureHeaders());
  app.use("*", prettyJSON()); // add ?pretty to query params to pretty print JSON responses
  app.use("*", timing({ enabled: (c) => c.env.ENVIRONMENT !== "production" }));

  app.use(
    `${API_PREFIX}/*`,
    cors({
      origin: (origin, c) => (origin === c.env.FRONTEND_URL ? origin : null),
      credentials: true,
    }),
  );

  app.use(
    `${API_PREFIX}/*`,
    csrf({ origin: (origin, c) => origin === c.env.FRONTEND_URL }),
  );

  app.use(`${API_PREFIX}/*`, bodyLimit({ maxSize: 25 * 1024 * 1024 })); // 25 MB

  app.use(`${API_PREFIX}/*`, rateLimit("API_LIMITER", "api"));
};
