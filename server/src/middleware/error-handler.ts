import { HTTPException } from "hono/http-exception";
import {
  APIError,
  BadRequest,
  Conflict,
  InternalServerError,
  NotFound,
} from "@/lib/api-error";
import { isPostgresErrorCode } from "@/lib/postgres-error";
import { ZodError } from "zod";
import type { ErrorHandler, NotFoundHandler } from "hono";
import type { AppEnv } from "@/types";

const normalizeError = (err: unknown): APIError => {
  if (err instanceof APIError) return err;

  if (err instanceof HTTPException) {
    return new APIError({
      status: err.status || 500,
      message: err.message || "Request Failed",
    });
  }

  if (err instanceof ZodError) {
    return new BadRequest(
      "Validation failed",
      err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  // c.req.json() throws a bare SyntaxError on a malformed body
  if (err instanceof SyntaxError) return new BadRequest("Malformed JSON body");

  if (isPostgresErrorCode(err, "23505"))
    return new Conflict("Resource already exists");
  if (isPostgresErrorCode(err, "23503"))
    return new BadRequest("Referenced resource does not exist");
  if (isPostgresErrorCode(err, "23514"))
    return new BadRequest("Request violates a data constraint");

  return new InternalServerError();
};

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const apiError = normalizeError(err);
  const requestId = c.get("requestId");
  const isDev = c.env.ENVIRONMENT === "development";

  const log = { requestId, path: c.req.path, method: c.req.method, err };

  if (apiError.isOperational) {
    console.warn({ ...log, message: apiError.message });
  } else {
    console.error({ ...log, message: "Unexpected error occurred" });
  }

  return c.json(
    {
      success: false,
      message: apiError.message,
      requestId,
      ...(apiError.errors.length > 0 && { errors: apiError.errors }),
      ...(isDev && err instanceof Error && { stack: err.stack }),
    },
    apiError.status,
  );
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) =>
  errorHandler(new NotFound("Route not found"), c);
