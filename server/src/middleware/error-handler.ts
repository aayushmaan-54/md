import { HTTPException } from "hono/http-exception";
import {
  APIError,
  BadRequest,
  Conflict,
  InternalServerError,
  NotFound,
} from "@/lib/api-error";
import { ZodError } from "zod";
import type { ErrorHandler, NotFoundHandler } from "hono";
import type { AppEnv } from "@/types";

const isPostgresError = (err: unknown): err is { code: string } =>
  typeof err === "object" && err !== null && "code" in err;

const normalizeError = (err: unknown): APIError => {
  if (err instanceof APIError) return err;

  // Hono uses HTTPException for errors
  if (err instanceof HTTPException) {
    return new APIError({
      status: err.status || 500,
      message: err.message || "Request Failed",
    });
  }

  // Handling Zod validation errors
  if (err instanceof ZodError) {
    return new BadRequest(
      "Validation failed",
      err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  // c.req.json() on a malformed body
  if (err instanceof SyntaxError) return new BadRequest("Malformed JSON body");

  if (isPostgresError(err)) {
    if (err.code === "23505") return new Conflict("Resource already exists");
    if (err.code === "23503")
      return new BadRequest("Referenced resource does not exist");
  }

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
