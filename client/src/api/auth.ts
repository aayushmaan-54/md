import { apiFetch } from "./client";
import { deleteSetting, getSetting, putSetting } from "../storage/settings-db";

export type User = { id: string; username: string };

const HAS_LOGGED_IN_KEY = "hasLoggedIn";

// Persisted locally so bootstrap() can skip calling me() — a guaranteed
// 401 — for a device that's never authenticated.
export const hasLoggedInBefore = async (): Promise<boolean> =>
  (await getSetting(HAS_LOGGED_IN_KEY)) === "true";

export const markLoggedIn = () => putSetting(HAS_LOGGED_IN_KEY, "true");

export const clearLoggedIn = () => deleteSetting(HAS_LOGGED_IN_KEY);

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
