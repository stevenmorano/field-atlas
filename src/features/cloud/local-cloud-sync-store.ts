import {
  CLOUD_SYNC_STATE_STORE,
  openLocalDatabase,
  requestResult,
  transactionCompletion,
} from "@/lib/local-database";

export type LocalCloudSyncState = Readonly<{
  mapId: string;
  userId: string;
  remoteRevisionId: string;
  contentFingerprint: string;
  /** The local map version that produced the cloud checkpoint. */
  localUpdatedAt?: number;
  syncedAt: number;
}>;

export async function readCloudSyncState(mapId: string) {
  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction(CLOUD_SYNC_STATE_STORE, "readonly");
    const completed = transactionCompletion(transaction);
    const request = transaction.objectStore(CLOUD_SYNC_STATE_STORE).get(mapId) as IDBRequest<
      LocalCloudSyncState | undefined
    >;
    const state = await requestResult(request, "Could not read cloud sync state.");
    await completed;
    return state ?? null;
  } finally {
    database.close();
  }
}

export async function readAllCloudSyncStates() {
  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction(CLOUD_SYNC_STATE_STORE, "readonly");
    const completed = transactionCompletion(transaction);
    const request = transaction.objectStore(CLOUD_SYNC_STATE_STORE).getAll() as IDBRequest<
      LocalCloudSyncState[]
    >;
    const states = await requestResult(request, "Could not read cloud sync state.");
    await completed;
    return states;
  } finally {
    database.close();
  }
}

export async function writeCloudSyncState(state: LocalCloudSyncState) {
  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction(CLOUD_SYNC_STATE_STORE, "readwrite");
    const completed = transactionCompletion(transaction);
    transaction.objectStore(CLOUD_SYNC_STATE_STORE).put(state);
    await completed;
  } finally {
    database.close();
  }
}
