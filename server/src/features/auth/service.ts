import type { Redis } from "@upstash/redis";
import type { Db } from "@/db";
import { Conflict, InternalServerError, Unauthorized } from "@/lib/api-error";
import { getSessionKey } from "@/lib/redis";
import {
  generateRandomToken,
  generateSha256Hex,
  generateUuidV7,
  hashPassword,
  verifyPassword,
} from "@/utils/crypto";
import * as q from "./queries";
import type { authOptions } from "./types";
import type { LoginData, SignupData } from "./schema";
import type { Logger } from "@/lib/logger";

const isUniqueViolation = (err: unknown): err is { code: "23505" } =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  err.code === "23505";

export async function signup(
  db: Db,
  redis: Redis,
  data: SignupData,
  options: authOptions,
) {
  const logger = options.logger.child({ feature: "auth", action: "signup" });

  logger.info("signup started", { username: data.username });

  if (await q.findUserByUsername(db, data.username)) {
    logger.warn("signup username already taken", { username: data.username });
    throw new Conflict("Username is already taken");
  }

  const userId = generateUuidV7();
  const token = generateRandomToken();
  const hashedToken = await generateSha256Hex(token);
  const expiresAt = new Date(Date.now() + options.sessionTtlSeconds * 1000);

  let rows;
  try {
    [rows] = await db.batch([
      q.insertUser(db, {
        id: userId,
        username: data.username,
        passwordHash: await hashPassword(data.password),
        lastLoginAt: new Date(),
      }),
      q.insertSession(db, {
        tokenHash: hashedToken,
        userId,
        expiresAt,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      }),
    ]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      logger.warn("signup username already taken", { username: data.username });
      throw new Conflict("Username is already taken");
    }
    throw err;
  }

  const user = rows?.[0];
  if (!user) throw new InternalServerError("Failed to create user");

  try {
    await redis.set(
      getSessionKey(hashedToken),
      JSON.stringify({
        userId: user.id,
        username: user.username,
        expiresAt: expiresAt.toISOString(),
      }),
      { ex: options.sessionTtlSeconds },
    );
  } catch (err) {
    logger.warn("signup session cache write failed", {
      userId: user.id,
      reason: String(err),
    });
  }

  logger.info("signup user and session created", {
    userId: user.id,
    username: user.username,
    expiresAt: expiresAt.toISOString(),
  });

  return { user, session: { token, expiresAt } };
}

export async function login(
  db: Db,
  redis: Redis,
  data: LoginData,
  options: authOptions,
) {
  const logger = options.logger.child({ feature: "auth", action: "login" });

  const user = await q.findUserByUsername(db, data.username);

  if (!user || !(await verifyPassword(user.passwordHash, data.password))) {
    logger.warn("wrong username or password", { username: data.username });
    throw new Unauthorized("Either Username or Password is wrong");
  }

  const token = generateRandomToken();
  const hashedToken = await generateSha256Hex(token);
  const expiresAt = new Date(Date.now() + options.sessionTtlSeconds * 1000);

  await db.batch([
    q.insertSession(db, {
      tokenHash: hashedToken,
      userId: user.id,
      expiresAt,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    }),
    q.updateUserLastLogin(db, user.id),
  ]);

  try {
    await redis.set(
      getSessionKey(hashedToken),
      JSON.stringify({
        userId: user.id,
        username: user.username,
        expiresAt: expiresAt.toISOString(),
      }),
      { ex: options.sessionTtlSeconds },
    );
  } catch (err) {
    logger.warn("login session cache write failed", {
      userId: user.id,
      reason: String(err),
    });
  }

  logger.info("login user session created", {
    userId: user.id,
    username: user.username,
    expiresAt: expiresAt.toISOString(),
  });

  return { user, session: { token, expiresAt } };
}

export async function logout(
  db: Db,
  redis: Redis,
  token: string,
  options: { logger: Logger },
) {
  const logger = options.logger.child({ feature: "auth", action: "logout" });
  const tokenHash = await generateSha256Hex(token);

  await q.revokeSessionByTokenHash(db, tokenHash);

  try {
    await redis.del(getSessionKey(tokenHash));
  } catch (err) {
    logger.warn("logout session cache delete failed", {
      reason: String(err),
    });
  }

  logger.info("logout completed");
}

export async function purgeExpiredSessions(db: Db, options: { logger: Logger }) {
  const logger = options.logger.child({ feature: "auth", action: "purge-expired-sessions" });

  const deleted = await q.deleteExpiredSessions(db);

  logger.info("expired sessions purged", { count: deleted.length });

  return deleted.length;
}
