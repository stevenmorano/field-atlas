import type {
  LocalSavedMap,
  SavedMapContent,
  SavedMapMetadata,
} from "@/features/maps/saved-map-types";
import {
  consolidateExactSourceMaps,
  savedMapAssetSignature,
} from "@/features/maps/saved-map-deduplication";
import {
  openLocalDatabase,
  requestResult,
  SAVED_MAPS_STORE,
  transactionCompletion,
} from "@/lib/local-database";

async function readSavedMapRecord(mapId: string) {
  const database = await openLocalDatabase();

  try {
    const transaction = database.transaction(SAVED_MAPS_STORE, "readonly");
    const completed = transactionCompletion(transaction);
    const request = transaction.objectStore(SAVED_MAPS_STORE).get(mapId) as IDBRequest<
      LocalSavedMap | undefined
    >;
    const map = await requestResult(request, "Could not read the saved map.");
    await completed;
    return map ?? null;
  } finally {
    database.close();
  }
}

export async function readAllSavedMapRecords() {
  const database = await openLocalDatabase();

  try {
    const transaction = database.transaction(SAVED_MAPS_STORE, "readonly");
    const completed = transactionCompletion(transaction);
    const request = transaction.objectStore(SAVED_MAPS_STORE).getAll() as IDBRequest<
      LocalSavedMap[]
    >;
    const maps = await requestResult(request, "Could not list saved maps.");
    await completed;
    return maps;
  } finally {
    database.close();
  }
}

export async function readSavedMap(mapId: string) {
  let map = await readSavedMapRecord(mapId);
  const visitedIds = new Set<string>();

  while (map?.supersededBy && !visitedIds.has(map.id)) {
    visitedIds.add(map.id);
    map = await readSavedMapRecord(map.supersededBy);
  }

  return map;
}

async function writeSavedMap(map: LocalSavedMap) {
  const database = await openLocalDatabase();

  try {
    const transaction = database.transaction(SAVED_MAPS_STORE, "readwrite");
    const completed = transactionCompletion(transaction);
    transaction.objectStore(SAVED_MAPS_STORE).put(map);
    await completed;
  } finally {
    database.close();
  }
}

export async function storeDownloadedCloudMap(
  map: LocalSavedMap,
  options: Readonly<{ replaceIfOlder?: boolean; replaceExisting?: boolean }> = {},
) {
  const existing = await readSavedMapRecord(map.id);
  if (existing) {
    if (options.replaceExisting || (options.replaceIfOlder && map.updatedAt > existing.updatedAt)) {
      await writeSavedMap(map);
      return { map, added: false, updated: true } as const;
    }
    return { map: existing, added: false, updated: false } as const;
  }

  await writeSavedMap(map);
  return { map, added: true, updated: false } as const;
}

async function writeSavedMaps(maps: readonly LocalSavedMap[]) {
  if (maps.length === 0) {
    return;
  }

  const database = await openLocalDatabase();

  try {
    const transaction = database.transaction(SAVED_MAPS_STORE, "readwrite");
    const completed = transactionCompletion(transaction);
    const store = transaction.objectStore(SAVED_MAPS_STORE);
    for (const map of maps) {
      store.put(map);
    }
    await completed;
  } finally {
    database.close();
  }
}

export async function listSavedMaps() {
  const records = await readAllSavedMapRecords();
  const consolidation = consolidateExactSourceMaps(records);
  await writeSavedMaps(consolidation.recordsToWrite);
  return consolidation.visibleMaps;
}

export async function saveNamedMap(input: Readonly<{
  mapId?: string | null;
  metadata: SavedMapMetadata;
  content: SavedMapContent;
}>) {
  const now = Date.now();
  let existing = input.mapId ? await readSavedMap(input.mapId) : null;

  if (!existing) {
    const consolidation = consolidateExactSourceMaps(await readAllSavedMapRecords());
    await writeSavedMaps(consolidation.recordsToWrite);
    const signature = savedMapAssetSignature(input.content);
    existing = consolidation.visibleMaps.find(
      (map) => savedMapAssetSignature(map) === signature,
    ) ?? null;
  }

  const map: LocalSavedMap = {
    id: existing?.id ?? crypto.randomUUID(),
    version: 1,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    metadata: input.metadata,
    supersededBy: undefined,
    preserveAsVariant: existing?.preserveAsVariant,
    importLineage: existing?.importLineage,
    ...input.content,
  };

  await writeSavedMap(map);
  return map;
}

export async function updateSavedMapContent(mapId: string, content: SavedMapContent) {
  const existing = await readSavedMap(mapId);
  if (!existing) {
    return null;
  }

  const contentUnchanged = existing.imageName === content.imageName
    && existing.imageBlob.size === content.imageBlob.size
    && existing.imageBlob.type === content.imageBlob.type
    && existing.imageDimensions.width === content.imageDimensions.width
    && existing.imageDimensions.height === content.imageDimensions.height
    && existing.targetZoom === content.targetZoom
    && existing.basemapMode === content.basemapMode
    && JSON.stringify(existing.anchors) === JSON.stringify(content.anchors);
  if (contentUnchanged) {
    return existing;
  }

  const updated: LocalSavedMap = {
    ...existing,
    ...content,
    updatedAt: Date.now(),
  };
  await writeSavedMap(updated);
  return updated;
}

export async function deleteSavedMap(mapId: string) {
  const database = await openLocalDatabase();

  try {
    const transaction = database.transaction(SAVED_MAPS_STORE, "readwrite");
    const completed = transactionCompletion(transaction);
    transaction.objectStore(SAVED_MAPS_STORE).delete(mapId);
    await completed;
  } finally {
    database.close();
  }
}
