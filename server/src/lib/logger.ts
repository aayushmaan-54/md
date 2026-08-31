type LEVEL = "debug" | "info" | "warn" | "error";

type SerializedError =
  | {
      name: string;
      message: string;
      stack?: string | undefined;
      cause?: SerializedError;
    }
  | { value: string };

const serialize = (err: unknown): SerializedError => {
  return err instanceof Error
    ? {
        name: err.name,
        message: err.message,
        stack: err.stack,
        ...(err.cause ? { cause: serialize(err.cause) } : {}),
      }
    : { value: String(err) };
};

export const createLogger = (ctx: Record<string, unknown>, isDev = false) => {
  const emit = (
    level: LEVEL,
    message: string,
    data?: Record<string, unknown>,
  ) => {
    if (level === "debug" && !isDev) return;

    const entry = {
      level,
      message,
      ...ctx,
      ...data,
      time: new Date().toISOString(),
    };
    const fn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;

    fn(entry);
  };

  return {
    debug: (message: string, data?: Record<string, unknown>) =>
      emit("debug", message, data),
    info: (message: string, data?: Record<string, unknown>) =>
      emit("info", message, data),
    warn: (message: string, data?: Record<string, unknown>) =>
      emit("warn", message, data),
    error: (message: string, err?: unknown, data?: Record<string, unknown>) =>
      emit("error", message, {
        ...data,
        ...(err !== undefined && { err: serialize(err) }),
      }),
    child: (extra: Record<string, unknown>) =>
      createLogger({ ...ctx, ...extra }, isDev),
  };
};

export type Logger = ReturnType<typeof createLogger>;
