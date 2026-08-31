import { Hono } from "hono";
import * as auth from "./service";
import { getCookie, setCookie } from "hono/cookie";
import { createDb } from "@/db";
import type { AppEnv } from "@/types";
import { validate } from "@/middleware/validate";
import { rateLimit } from "@/middleware/rate-limit";
import { sessionAuth } from "@/middleware/auth";
import { created, noContent, ok } from "@/lib/api-response";
import { createRedis } from "@/lib/redis";
import {
  SESSION_COOKIE,
  deleteSessionCookie,
  sessionCookieOptions,
  sessionTtlSeconds,
} from "./session-cookie";
import { loginSchema, signupSchema } from "./schema";

const authLimiter = rateLimit("AUTH_LIMITER", "auth");

export const authRoutes = new Hono<AppEnv>()
  .post("/signup", authLimiter, validate("json", signupSchema), async (c) => {
    const db = createDb(c.env.DATABASE_URL_POOLED);
    const redis = createRedis(c.env);

    const data = c.req.valid("json");
    const logger = c.get("logger").child({ route: "auth.signup" });
    const ttl = sessionTtlSeconds(c);

    const { user, session } = await auth.signup(db, redis, data, {
      sessionTtlSeconds: ttl,
      ipAddress: c.req.header("cf-connecting-ip"),
      userAgent: c.req.header("user-agent"),
      logger,
    });

    setCookie(c, SESSION_COOKIE, session.token, sessionCookieOptions(c));

    logger.info("signup completed", { userId: user.id });

    return created(c, { data: { id: user.id, username: user.username } });
  })
  .post("/login", authLimiter, validate("json", loginSchema), async (c) => {
    const db = createDb(c.env.DATABASE_URL_POOLED);
    const redis = createRedis(c.env);

    const data = c.req.valid("json");
    const logger = c.get("logger").child({ route: "auth.login" });
    const ttl = sessionTtlSeconds(c);

    const { user, session } = await auth.login(db, redis, data, {
      sessionTtlSeconds: ttl,
      ipAddress: c.req.header("cf-connecting-ip"),
      userAgent: c.req.header("user-agent"),
      logger,
    });

    setCookie(c, SESSION_COOKIE, session.token, sessionCookieOptions(c));

    logger.info("login completed", { userId: user.id });

    return ok(c, { data: { id: user.id, username: user.username } });
  })
  .post("/logout", sessionAuth, async (c) => {
    const db = createDb(c.env.DATABASE_URL_POOLED);
    const redis = createRedis(c.env);
    const logger = c.get("logger").child({ route: "auth.logout" });

    const token = getCookie(c, SESSION_COOKIE)!;
    await auth.logout(db, redis, token, { logger });

    deleteSessionCookie(c);

    return noContent(c);
  })
  .get("/me", sessionAuth, (c) =>
    ok(c, {
      data: { id: c.get("userId"), username: c.get("username") },
    }),
  );

export default authRoutes;
