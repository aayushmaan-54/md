import { Redis } from "@upstash/redis";
import type { Bindings } from "@/types";

export const createRedis = (env: Bindings) =>
  new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

export const getSessionKey = (tokenHash: string) => `session:${tokenHash}`;

export type SessionCache = {
  userId: string;
  username: string;
  expiresAt: string;
};
