import type { LocalImage } from "../images/model";
import { IMAGES_STORE, withStore } from "./db";
import { getSetting, putSetting } from "./settings-db";

// A running total kept in the settings store, adjusted incrementally —
// avoids reading every stored image's full Blob just to sum .bytes.
const TOTAL_BYTES_KEY = "imageTotalBytes";

async function adjustTotalBytes(delta: number): Promise<void> {
  if (delta === 0) return;
  const current = Number(await getSetting(TOTAL_BYTES_KEY)) || 0;
  await putSetting(TOTAL_BYTES_KEY, String(Math.max(0, current + delta)));
}

export function getImage(id: string): Promise<LocalImage | undefined> {
  return withStore(IMAGES_STORE, "readonly", (store) => store.get(id));
}

export function getAllImages(): Promise<LocalImage[]> {
  return withStore(IMAGES_STORE, "readonly", (store) => store.getAll());
}

export async function putImage(image: LocalImage): Promise<void> {
  const previous = await getImage(image.id);
  await withStore(IMAGES_STORE, "readwrite", (store) => store.put(image));
  await adjustTotalBytes(image.bytes - (previous?.bytes ?? 0));
}

export async function deleteImageRecord(id: string): Promise<void> {
  const previous = await getImage(id);
  await withStore(IMAGES_STORE, "readwrite", (store) => store.delete(id));
  if (previous) await adjustTotalBytes(-previous.bytes);
}

export async function getTotalImageBytes(): Promise<number> {
  return Number(await getSetting(TOTAL_BYTES_KEY)) || 0;
}

export async function setImageRemoteId(
  id: string,
  remoteId: string,
): Promise<void> {
  const record = await getImage(id);
  if (record) await putImage({ ...record, remoteId });
}
