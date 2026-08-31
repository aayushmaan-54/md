import type { Context } from "hono";
import type { AppEnv } from "@/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";

type Meta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ResponseOptions<T> = {
  data: T;
  message?: string;
  status?: ContentfulStatusCode;
};

type PaginatedOptions<T> = {
  data: T[];
  meta: Omit<Meta, "totalPages">;
  message?: string;
};

type CursorMeta = {
  limit: number;
  nextCursor: string | null;
};

type CursorPaginatedOptions<T> = {
  data: T[];
  meta: CursorMeta;
  message?: string;
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

export const paginated = <T>(
  c: Context<AppEnv>,
  { data, meta, message = "Success" }: PaginatedOptions<T>,
) =>
  c.json({
    success: true as const,
    message,
    data,
    meta: { ...meta, totalPages: Math.ceil(meta.total / meta.limit) },
    requestId: c.get("requestId"),
  });

export const cursorPaginated = <T>(
  c: Context<AppEnv>,
  { data, meta, message = "Success" }: CursorPaginatedOptions<T>,
) =>
  c.json({
    success: true as const,
    message,
    data,
    meta,
    requestId: c.get("requestId"),
  });

export const noContent = (c: Context<AppEnv>) => c.body(null, 204);
