import type { ContentfulStatusCode } from "hono/utils/http-status";

type APIErrorOptions = {
  status: ContentfulStatusCode;
  message: string;
  errors?: unknown[];
  isOperational?: boolean;
};

export class APIError extends Error {
  readonly status: ContentfulStatusCode;
  readonly errors: unknown[];
  readonly isOperational: boolean;

  constructor({
    status,
    message,
    errors = [],
    isOperational = true,
  }: APIErrorOptions) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.errors = errors;
    this.isOperational = isOperational;
  }
}

export class BadRequest extends APIError {
  constructor(message = "Bad Request", errors: unknown[] = []) {
    super({ status: 400, message, errors });
  }
}

export class Unauthorized extends APIError {
  constructor(message = "Unauthorized") {
    super({ status: 401, message });
  }
}

export class Forbidden extends APIError {
  constructor(message = "Forbidden") {
    super({ status: 403, message });
  }
}

export class NotFound extends APIError {
  constructor(message = "Not Found") {
    super({ status: 404, message });
  }
}

export class Conflict extends APIError {
  constructor(message = "Conflict", errors: unknown[] = []) {
    super({ status: 409, message, errors });
  }
}

export class TooManyRequests extends APIError {
  constructor(message = "Too Many Requests") {
    super({ status: 429, message });
  }
}

export class InternalServerError extends APIError {
  constructor(message = "Internal Server Error") {
    super({ status: 500, message, isOperational: false });
  }
}
