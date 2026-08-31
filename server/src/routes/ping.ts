import { Hono } from "hono";
import type { AppEnv } from "@/types";
import { createDb } from "@/db";
import { sql } from "drizzle-orm";

const ping = new Hono<AppEnv>().get("/", async (c) => {
  const checks: Record<string, string> = {};
  let pgVersion: string | undefined;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const db = createDb(c.env.DATABASE_URL_POOLED);

    const result = await Promise.race([
      db.execute<{ version: string }>(sql`SELECT version()`),
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new Error("db timeout")), 3000);
      }),
    ]);

    pgVersion = result.rows[0]?.version;
    checks.database = "up";
  } catch (error) {
    console.error("[ping] db check failed", error);
    checks.database = "down";
  } finally {
    clearTimeout(timer);
  }

  const healthy = Object.values(checks).every((check) => check === "up");

  return c.json(
    {
      message: healthy ? "🟢 PONG" : "🔴 DEGRADED",
      version: "v1.0.0",
      postgres: pgVersion ?? "unknown",
      ...checks,
      requestId: c.get("requestId"),
      timestamp: new Date().toISOString(),
    },
    healthy ? 200 : 503,
  );
});

export default ping;
