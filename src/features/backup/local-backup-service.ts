import {
  readCurrentAnchorDraft,
  type LocalAnchorDraft,
} from "@/features/anchor/local-draft-store";
import {
  decodeFieldAtlasBackup,
  encodeFieldAtlasBackup,
  type DecodedFieldAtlasBackup,
} from "@/features/backup/field-atlas-package";
import {
  prepareFieldAtlasImport,
  type PreparedFieldAtlasImport,
} from "@/features/backup/plan-field-atlas-import";
import {
  readAllSavedMapRecords,
} from "@/features/maps/local-saved-map-store";
import {
  consolidateExactSourceMaps,
  savedMapAssetSignature,
} from "@/features/maps/saved-map-deduplication";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";
import {
  ANCHOR_DRAFTS_STORE,
  openLocalDatabase,
  SAVED_MAPS_STORE,
  transactionCompletion,
} from "@/lib/local-database";

export function prepareDraftForFieldAtlasBackup(
  draft: LocalAnchorDraft | null,
  records: readonly LocalSavedMap[],
  visibleMaps: readonly LocalSavedMap[],
) {
  if (!draft?.savedMapId) {
    return draft;
  }

  const visibleIds = new Set(visibleMaps.map((map) => map.id));
  if (visibleIds.has(draft.savedMapId)) {
    return draft;
  }

  const linkedRecord = records.find((map) => map.id === draft.savedMapId);
  const directSuccessor = linkedRecord?.supersededBy;
  const matchingVisibleMap = linkedRecord
    ? visibleMaps.find((map) =>
        !map.preserveAsVariant &&
        savedMapAssetSignature(map) === savedMapAssetSignature(linkedRecord))
    : undefined;
  const savedMapId = directSuccessor && visibleIds.has(directSuccessor)
    ? directSuccessor
    : matchingVisibleMap?.id;

  return {
    ...draft,
    savedMapId,
  };
}

export async function createLocalFieldAtlasBackup() {
  const [records, draft] = await Promise.all([
    readAllSavedMapRecords(),
    readCurrentAnchorDraft(),
  ]);
  const maps = consolidateExactSourceMaps(records).visibleMaps;
  const backupDraft = prepareDraftForFieldAtlasBackup(draft, records, maps);
  const exportedAt = Date.now();
  const blob = await encodeFieldAtlasBackup({ maps, draft: backupDraft, exportedAt });
  return { blob, exportedAt, mapCount: maps.length, hasDraft: backupDraft !== null };
}

export async function previewLocalFieldAtlasBackup(
  file: Blob,
): Promise<PreparedFieldAtlasImport> {
  const backup: DecodedFieldAtlasBackup = await decodeFieldAtlasBackup(file);
  const [existingMaps, existingDraft] = await Promise.all([
    readAllSavedMapRecords(),
    readCurrentAnchorDraft(),
  ]);
  return prepareFieldAtlasImport({ backup, existingMaps, existingDraft });
}

export async function applyLocalFieldAtlasImport(
  prepared: PreparedFieldAtlasImport,
  options: Readonly<{ replaceCurrentDraft: boolean }>,
) {
  const shouldRestoreDraft = prepared.incomingDraft !== null &&
    (prepared.existingDraft === null || options.replaceCurrentDraft);

  if (prepared.mapsToAdd.length === 0 && !shouldRestoreDraft) {
    return {
      importedMapCount: 0,
      skippedMapCount: prepared.summary.duplicateMapCount,
      restoredDraft: false,
    };
  }

  const database = await openLocalDatabase();
  try {
    const transaction = database.transaction(
      [SAVED_MAPS_STORE, ANCHOR_DRAFTS_STORE],
      "readwrite",
    );
    const completed = transactionCompletion(transaction);
    const mapStore = transaction.objectStore(SAVED_MAPS_STORE);
    for (const map of prepared.mapsToAdd) {
      mapStore.add(map);
    }

    if (shouldRestoreDraft && prepared.incomingDraft) {
      const draftStore = transaction.objectStore(ANCHOR_DRAFTS_STORE);
      if (prepared.existingDraft === null) {
        draftStore.add(prepared.incomingDraft);
      } else {
        draftStore.put(prepared.incomingDraft);
      }
    }

    await completed;
  } finally {
    database.close();
  }

  return {
    importedMapCount: prepared.mapsToAdd.length,
    skippedMapCount: prepared.summary.duplicateMapCount,
    restoredDraft: shouldRestoreDraft,
  };
}
