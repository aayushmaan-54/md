import type { Logger } from "@/lib/logger";

export type Bindings = {
  DATABASE_URL: string;
  DATABASE_URL_POOLED: string;
  ENVIRONMENT: "production" | "development";
  BACKEND_BASE_URL: string;
  FRONTEND_URL: string;
  SESSION_TTL_SECONDS: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  AUTH_LIMITER: RateLimit;
  API_LIMITER: RateLimit;
  IMAGES_BUCKET: R2Bucket;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    userId: string;
    username: string;
    requestId: string;
    logger: Logger;
  };
};
