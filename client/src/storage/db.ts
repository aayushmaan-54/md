// Single shared IndexedDB database for the whole app — notes-db.ts and
// images-db.ts both open through here so there's one version number and
// one upgrade path, instead of each module racing to open "md" with its
// own (possibly conflicting) version.
const DB_NAME = "md";
const DB_VERSION = 4;

export const NOTES_STORE = "notes";
export const IMAGES_STORE = "images";
export const SETTINGS_STORE = "settings";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(NOTES_STORE)) {
          db.createObjectStore(NOTES_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(IMAGES_STORE)) {
          db.createObjectStore(IMAGES_STORE, { keyPath: "id" });
        }
        // Plain key/value store (no keyPath — the key is passed
        // explicitly to put/get) for small app settings like theme/font.
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE);
        }
      };

      // If another tab (or, during development, a pre-HMR-reload instance
      // of this same tab) is still holding an older-version connection
      // open, the browser can't run the upgrade above and this request
      // just hangs — the caller sees it as a stuck promise rather than an
      // error. Surface that instead of failing silently.
      request.onblocked = () => {
        console.warn(
          "IndexedDB upgrade blocked — close other tabs with this app open and reload.",
        );
      };

      request.onsuccess = () => {
        const db = request.result;
        // Self-close on a future version bump instead of blocking it (the
        // scenario above) — the next openDb() call in this tab just
        // reopens fresh.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

export function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(storeName, mode).objectStore(storeName);
        const request = run(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}
