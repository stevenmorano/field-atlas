import type { LocalAnchorDraft } from "@/features/anchor/local-draft-store";
import {
  sha256Blob,
  sha256Text,
  type DecodedFieldAtlasBackup,
} from "@/features/backup/field-atlas-package";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";

export type FieldAtlasMapImportDecision = Readonly<{
  sourceId: string;
  targetId: string;
  title: string;
  anchorCount: number;
  status: "new" | "duplicate" | "conflict";
}>;

export type PreparedFieldAtlasImport = Readonly<{
  backup: DecodedFieldAtlasBackup;
  mapsToAdd: readonly LocalSavedMap[];
  decisions: readonly FieldAtlasMapImportDecision[];
  incomingDraft: LocalAnchorDraft | null;
  existingDraft: LocalAnchorDraft | null;
  summary: Readonly<{
    newMapCount: number;
    duplicateMapCount: number;
    conflictMapCount: number;
  }>;
}>;

function mapFingerprintPayload(map: LocalSavedMap, imageHash: string) {
  return JSON.stringify({
    version: map.version,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
    metadata: map.metadata,
    imageName: map.imageName,
    imageType: map.imageBlob.type,
    imageHash,
    imageDimensions: map.imageDimensions,
    anchors: map.anchors,
    targetZoom: map.targetZoom,
    basemapMode: map.basemapMode,
  });
}

export async function savedMapFingerprint(map: LocalSavedMap) {
  const imageHash = await sha256Blob(map.imageBlob);
  return sha256Text(mapFingerprintPayload(map, imageHash));
}

function importedCopyTitle(title: string) {
  return title.endsWith(" (Imported copy)") ? title : `${title} (Imported copy)`;
}

function uniqueId(usedIds: Set<string>, createId: () => string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = createId();
    if (candidate && !usedIds.has(candidate)) {
      usedIds.add(candidate);
      return candidate;
    }
  }
  throw new Error("Could not create a unique ID for an imported map.");
}

export async function prepareFieldAtlasImport(input: Readonly<{
  backup: DecodedFieldAtlasBackup;
  existingMaps: readonly LocalSavedMap[];
  existingDraft: LocalAnchorDraft | null;
  createId?: () => string;
  importedAt?: number;
}>): Promise<PreparedFieldAtlasImport> {
  const createId = input.createId ?? (() => crypto.randomUUID());
  const importedAt = input.importedAt ?? Date.now();
  const existingById = new Map(input.existingMaps.map((map) => [map.id, map]));
  const usedIds = new Set([
    ...input.existingMaps.map((map) => map.id),
    ...input.backup.maps.map((map) => map.id),
  ]);
  const existingFingerprints = new Map<string, string>();
  const sourceFingerprints = new Map<string, string>();
  const decisions: FieldAtlasMapImportDecision[] = [];
  const mapsToAdd: LocalSavedMap[] = [];
  const idRemap = new Map<string, string>();

  await Promise.all(input.existingMaps.map(async (map) => {
    existingFingerprints.set(map.id, await savedMapFingerprint(map));
  }));

  for (const incoming of input.backup.maps) {
    const fingerprint = await savedMapFingerprint(incoming);
    sourceFingerprints.set(incoming.id, fingerprint);
    const repeatedImportedCopy = input.existingMaps.find((map) =>
      map.importLineage?.sourceMapId === incoming.id &&
      map.importLineage.sourceFingerprint === fingerprint);

    if (repeatedImportedCopy) {
      idRemap.set(incoming.id, repeatedImportedCopy.id);
      decisions.push({
        sourceId: incoming.id,
        targetId: repeatedImportedCopy.id,
        title: incoming.metadata.title,
        anchorCount: incoming.anchors.length,
        status: "duplicate",
      });
      continue;
    }

    const existing = existingById.get(incoming.id);
    if (!existing) {
      idRemap.set(incoming.id, incoming.id);
      mapsToAdd.push({ ...incoming, supersededBy: undefined });
      decisions.push({
        sourceId: incoming.id,
        targetId: incoming.id,
        title: incoming.metadata.title,
        anchorCount: incoming.anchors.length,
        status: "new",
      });
      continue;
    }

    if (existingFingerprints.get(existing.id) === fingerprint) {
      idRemap.set(incoming.id, existing.id);
      decisions.push({
        sourceId: incoming.id,
        targetId: existing.id,
        title: incoming.metadata.title,
        anchorCount: incoming.anchors.length,
        status: "duplicate",
      });
      continue;
    }

    const targetId = uniqueId(usedIds, createId);
    idRemap.set(incoming.id, targetId);
    mapsToAdd.push({
      ...incoming,
      id: targetId,
      metadata: {
        ...incoming.metadata,
        title: importedCopyTitle(incoming.metadata.title),
      },
      supersededBy: undefined,
      preserveAsVariant: true,
      importLineage: {
        sourceMapId: incoming.id,
        sourceFingerprint: fingerprint,
        importedAt,
      },
    });
    decisions.push({
      sourceId: incoming.id,
      targetId,
      title: incoming.metadata.title,
      anchorCount: incoming.anchors.length,
      status: "conflict",
    });
  }

  const incomingDraft = input.backup.draft
    ? {
        ...input.backup.draft,
        savedMapId: input.backup.draft.savedMapId
          ? idRemap.get(input.backup.draft.savedMapId) ?? input.backup.draft.savedMapId
          : undefined,
      }
    : null;

  return {
    backup: input.backup,
    mapsToAdd,
    decisions,
    incomingDraft,
    existingDraft: input.existingDraft,
    summary: {
      newMapCount: decisions.filter((decision) => decision.status === "new").length,
      duplicateMapCount: decisions.filter((decision) => decision.status === "duplicate").length,
      conflictMapCount: decisions.filter((decision) => decision.status === "conflict").length,
    },
  };
}
