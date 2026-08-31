import { createMiddleware } from "hono/factory";
import { getCookie, setCookie } from "hono/cookie";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { AppEnv } from "@/types";
import { Unauthorized } from "@/lib/api-error";
import { createDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { createRedis, getSessionKey, type SessionCache } from "@/lib/redis";
import { generateSha256Hex } from "@/utils/crypto";
import { SESSION_REFRESH_THRESHOLD_RATIO } from "@/config/constants";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionTtlSeconds,
} from "@/features/auth/session-cookie";
import * as authQueries from "@/features/auth/queries";

type Session = { userId: string; username: string; expiresAt: Date };

export const sessionAuth = createMiddleware<AppEnv>(async (c, next) => {
  const logger = c.get("logger").child({ middleware: "sessionAuth" });

  const token = getCookie(c, SESSION_COOKIE);
  if (!token) throw new Unauthorized();

  const tokenHash = await generateSha256Hex(token);
  const redis = createRedis(c.env);
  const db = createDb(c.env.DATABASE_URL_POOLED);
  const ttlSeconds = sessionTtlSeconds(c);
  const refreshThresholdMs = ttlSeconds * 1000 * SESSION_REFRESH_THRESHOLD_RATIO;

  let session: Session | undefined;
  let fromCache = false;

  try {
    const raw = await redis.get<SessionCache>(getSessionKey(tokenHash));
    if (raw) {
      const cached = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (cached?.userId && cached.username && cached.expiresAt) {
        session = {
          userId: cached.userId,
          username: cached.username,
          expiresAt: new Date(cached.expiresAt),
        };
        fromCache = true;
      }
    }
  } catch (err) {
    logger.warn("session cache read failed", { reason: String(err) });
  }

  if (!session) {
    const [row] = await db
      .select({
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        username: users.username,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row) throw new Unauthorized("Invalid or expired session");
    session = row;
  }

  c.set("userId", session.userId);
  c.set("username", session.username);

  // Sliding expiry: once a session is more than halfway to expiring, push
  // it (and its cookie) back out to a full TTL instead of letting it lapse.
  const shouldRefresh =
    session.expiresAt.getTime() - Date.now() < refreshThresholdMs;

  let expiresAt = session.expiresAt;
  let refreshed = false;

  if (shouldRefresh) {
    const nextExpiresAt = new Date(Date.now() + ttlSeconds * 1000);
    try {
      await authQueries.touchSession(db, tokenHash, nextExpiresAt);
      expiresAt = nextExpiresAt;
      refreshed = true;
      setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(c));
    } catch (err) {
      logger.warn("session refresh db write failed", { reason: String(err) });
    }
  }

  if (refreshed || !fromCache) {
    const cacheTtlSeconds = Math.max(
      1,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );
    try {
      const cacheValue: SessionCache = {
        userId: session.userId,
        username: session.username,
        expiresAt: expiresAt.toISOString(),
      };
      await redis.set(getSessionKey(tokenHash), JSON.stringify(cacheValue), {
        ex: cacheTtlSeconds,
      });
    } catch (err) {
      logger.warn("session cache write failed", { reason: String(err) });
    }
  }

  await next();
});
