export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
  requestId: string;
};

export type ApiFieldError = { path: string; message: string };

export type ApiErrorBody = {
  success: false;
  message: string;
  requestId: string;
  errors?: ApiFieldError[];
};

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

const API_BASE = import.meta.env.VITE_API_BASE as string;

export class ApiRequestError extends Error {
  errors: ApiFieldError[];
  status: number;

  constructor(message: string, status: number, errors: ApiFieldError[] = []) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.errors = errors;
  }
}

export const isUnauthorized = (err: unknown): boolean =>
  err instanceof ApiRequestError && err.status === 401;

export const isForbidden = (err: unknown): boolean =>
  err instanceof ApiRequestError && err.status === 403;

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  if (res.status === 204) return undefined as T;

  const body = (await res.json()) as ApiResponse<T>;

  if (!body.success) {
    throw new ApiRequestError(body.message, res.status, body.errors ?? []);
  }

  return body.data;
}
