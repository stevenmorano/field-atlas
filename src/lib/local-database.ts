export const LOCAL_DATABASE_NAME = "field-atlas-local";
export const LOCAL_DATABASE_VERSION = 3;
export const ANCHOR_DRAFTS_STORE = "anchor-drafts";
export const SAVED_MAPS_STORE = "saved-maps";
export const CLOUD_SYNC_STATE_STORE = "cloud-sync-state";

export function openLocalDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DATABASE_NAME, LOCAL_DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(ANCHOR_DRAFTS_STORE)) {
        database.createObjectStore(ANCHOR_DRAFTS_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(SAVED_MAPS_STORE)) {
        database.createObjectStore(SAVED_MAPS_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(CLOUD_SYNC_STATE_STORE)) {
        database.createObjectStore(CLOUD_SYNC_STATE_STORE, { keyPath: "mapId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local map storage."));
    request.onblocked = () => reject(new Error("Local map storage upgrade is blocked by another tab."));
  });
}

export function transactionCompletion(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("Local storage transaction was cancelled."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Local storage transaction failed."));
  });
}

export function requestResult<T>(request: IDBRequest<T>, errorMessage: string) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(errorMessage));
  });
}
