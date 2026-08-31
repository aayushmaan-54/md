import type { LocalImage } from "../images/model";
import { IMAGES_STORE, withStore } from "./db";

export function getImage(id: string): Promise<LocalImage | undefined> {
  return withStore(IMAGES_STORE, "readonly", (store) => store.get(id));
}

export function getAllImages(): Promise<LocalImage[]> {
  return withStore(IMAGES_STORE, "readonly", (store) => store.getAll());
}

export async function putImage(image: LocalImage): Promise<void> {
  await withStore(IMAGES_STORE, "readwrite", (store) => store.put(image));
}

export async function deleteImageRecord(id: string): Promise<void> {
  await withStore(IMAGES_STORE, "readwrite", (store) => store.delete(id));
}

export async function getTotalImageBytes(): Promise<number> {
  const images = await getAllImages();
  return images.reduce((sum, image) => sum + image.bytes, 0);
}

export async function setImageRemoteId(
  id: string,
  remoteId: string,
): Promise<void> {
  const record = await getImage(id);
  if (record) await putImage({ ...record, remoteId });
}
