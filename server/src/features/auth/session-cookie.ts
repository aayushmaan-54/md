import type { Context } from "hono";
import type { CookieOptions } from "hono/utils/cookie";
import type { AppEnv } from "@/types";
import { deleteCookie } from "hono/cookie";

export const SESSION_COOKIE = "ams.md.session";

export const sessionTtlSeconds = (c: Context<AppEnv>) =>
  Number(c.env.SESSION_TTL_SECONDS);

export const sessionCookieOptions = (
  c: Context<AppEnv>,
  overrides: Partial<CookieOptions> = {},
): CookieOptions => ({
  httpOnly: true,
  secure: c.env.ENVIRONMENT === "production",
  sameSite: "Lax",
  path: "/",
  maxAge: sessionTtlSeconds(c),
  ...overrides,
});

export const deleteSessionCookie = (c: Context<AppEnv>) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
};
