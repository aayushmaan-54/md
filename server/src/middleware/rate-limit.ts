import { createMiddleware } from "hono/factory";
import type { AppEnv, Bindings } from "@/types";
import { TooManyRequests } from "@/lib/api-error";

type LimiterKey = {
  [K in keyof Bindings]: Bindings[K] extends RateLimit ? K : never;
}[keyof Bindings];

export const rateLimit = (binding: LimiterKey, prefix: string) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const { success } = await (c.env[binding] as RateLimit).limit({
      key: `${prefix}:${ip}`,
    });

    if (!success) {
      throw new TooManyRequests();
    }
    await next();
  });
