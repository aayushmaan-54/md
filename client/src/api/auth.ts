import { apiFetch } from "./client";

export type User = { id: string; username: string };

export const signup = (
  username: string,
  password: string,
  confirmPassword: string,
) =>
  apiFetch<User>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, password, confirmPassword }),
  });

export const login = (username: string, password: string) =>
  apiFetch<User>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

export const logout = () => apiFetch<undefined>("/auth/logout", { method: "POST" });

export const me = () => apiFetch<User>("/auth/me");
