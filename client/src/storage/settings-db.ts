import { SETTINGS_STORE, withStore } from "./db";

export function getSetting(key: string): Promise<string | undefined> {
  return withStore(SETTINGS_STORE, "readonly", (store) => store.get(key));
}

export async function putSetting(key: string, value: string): Promise<void> {
  await withStore(SETTINGS_STORE, "readwrite", (store) => store.put(value, key));
}
