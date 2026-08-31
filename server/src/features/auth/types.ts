import type { Logger } from "@/lib/logger";

export type authOptions = {
  sessionTtlSeconds: number;
  ipAddress?: string;
  userAgent?: string;
  logger: Logger;
};
