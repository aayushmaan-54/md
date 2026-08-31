import { apiFetch } from "./client";

export type UploadedImage = { id: string; bytes: number };

export const uploadImage = (blob: Blob) =>
  apiFetch<UploadedImage>("/images", {
    method: "POST",
    body: blob,
    headers: { "Content-Type": "image/webp" },
  });

export const deleteRemoteImage = (id: string) =>
  apiFetch<undefined>(`/images/${id}`, { method: "DELETE" });
