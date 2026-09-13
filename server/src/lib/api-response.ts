import type { Context } from "hono";
import type { AppEnv } from "@/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";

type ResponseOptions<T> = {
  data: T;
  message?: string;
  status?: ContentfulStatusCode;
};

export const ok = <T>(
  c: Context<AppEnv>,
  { data, message = "Success", status = 200 }: ResponseOptions<T>,
) =>
  c.json(
    { success: true as const, message, data, requestId: c.get("requestId") },
    status,
  );

export const created = <T>(
  c: Context<AppEnv>,
  { data, message = "Created", status = 201 }: ResponseOptions<T>,
) =>
  c.json(
    { success: true as const, message, data, requestId: c.get("requestId") },
    status,
  );

export const noContent = (c: Context<AppEnv>) => c.body(null, 204);
