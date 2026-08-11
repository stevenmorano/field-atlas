import type { LocalAnchorDraft } from "@/features/anchor/local-draft-store";
import type { TargetViewRotation } from "@/features/anchor/target-view-rotation";
import type { DemoBasemapMode } from "@/features/anchor/demo-basemap-style";
import type {
  LocalSavedMap,
  SavedMapImportLineage,
  SavedMapMetadata,
} from "@/features/maps/saved-map-types";
import type { AnchorPair } from "@/lib/georeferencing/types";

const MAGIC_TEXT = "FATLAS01";
const MAGIC_BYTES = new TextEncoder().encode(MAGIC_TEXT);
const HEADER_BYTES = 12;
const FORMAT_NAME = "field-atlas-backup";
const SCHEMA_VERSION = 1;
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;
const MAX_MAPS = 10_000;
const MAX_ASSETS = 10_000;
const MAX_ANCHORS = 10_000;
const MAX_TEXT = 100_000;
const SHA_256_PATTERN = /^[a-f0-9]{64}$/;

type BackupAsset = Readonly<{
  id: string;
  mimeType: string;
  byteLength: number;
  offset: number;
}>;

type PortableSavedMap = Readonly<{
  id: string;
  version: 1;
  createdAt: number;
  updatedAt: number;
  metadata: SavedMapMetadata;
  imageName: string;
  imageDimensions: Readonly<{ width: number; height: number }>;
  anchors: readonly AnchorPair[];
  targetZoom: number;
  basemapMode: DemoBasemapMode;
  assetId: string;
  preserveAsVariant?: boolean;
  importLineage?: SavedMapImportLineage;
}>;

type PortableAnchorDraft = Readonly<{
  id: "current";
  version: 1;
  savedAt: number;
  imageName: string;
  imageDimensions: Readonly<{ width: number; height: number }>;
  anchors: readonly AnchorPair[];
  targetZoom: number;
  targetRotation?: TargetViewRotation;
  basemapMode: DemoBasemapMode;
  savedMapId?: string;
  assetId: string;
}>;

type BackupManifest = Readonly<{
  format: typeof FORMAT_NAME;
  schemaVersion: typeof SCHEMA_VERSION;
  exportedAt: number;
  appVersion: string;
  maps: readonly PortableSavedMap[];
  draft: PortableAnchorDraft | null;
  assets: readonly BackupAsset[];
}>;

export type DecodedFieldAtlasBackup = Readonly<{
  exportedAt: number;
  appVersion: string;
  maps: readonly LocalSavedMap[];
  draft: LocalAnchorDraft | null;
  assetCount: number;
  totalAssetBytes: number;
}>;

export class FieldAtlasBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FieldAtlasBackupError";
  }
}

function backupError(message: string): never {
  throw new FieldAtlasBackupError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string, maxLength = MAX_TEXT) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    return backupError(`${label} is invalid.`);
  }
  return value;
}

function optionalString(value: unknown, label: string, maxLength = MAX_TEXT) {
  if (value === undefined) {
    return undefined;
  }
  return requiredString(value, label, maxLength);
}

function finiteNumber(value: unknown, label: string, minimum?: number, maximum?: number) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (minimum !== undefined && value < minimum) ||
    (maximum !== undefined && value > maximum)
  ) {
    return backupError(`${label} is invalid.`);
  }
  return value;
}

function safeInteger(value: unknown, label: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const number = finiteNumber(value, label, minimum, maximum);
  if (!Number.isSafeInteger(number)) {
    return backupError(`${label} must be a safe integer.`);
  }
  return number;
}

function validateDimensions(value: unknown, label: string) {
  if (!isRecord(value)) {
    return backupError(`${label} is invalid.`);
  }
  return {
    width: safeInteger(value.width, `${label} width`, 1),
    height: safeInteger(value.height, `${label} height`, 1),
  };
}

function validateAnchors(
  value: unknown,
  dimensions: Readonly<{ width: number; height: number }>,
  label: string,
) {
  if (!Array.isArray(value) || value.length > MAX_ANCHORS) {
    return backupError(`${label} has too many or invalid anchors.`);
  }

  const ids = new Set<string>();
  return value.map((candidate, index): AnchorPair => {
    const anchorLabel = `${label} anchor ${index + 1}`;
    if (!isRecord(candidate) || !isRecord(candidate.image) || !isRecord(candidate.geographic)) {
      return backupError(`${anchorLabel} is invalid.`);
    }
    const id = requiredString(candidate.id, `${anchorLabel} ID`, 500);
    if (ids.has(id)) {
      return backupError(`${label} contains duplicate anchor IDs.`);
    }
    ids.add(id);

    return {
      id,
      image: {
        x: finiteNumber(candidate.image.x, `${anchorLabel} image x`, 0, dimensions.width),
        y: finiteNumber(candidate.image.y, `${anchorLabel} image y`, 0, dimensions.height),
      },
      geographic: {
        longitude: finiteNumber(candidate.geographic.longitude, `${anchorLabel} longitude`, -180, 180),
        latitude: finiteNumber(candidate.geographic.latitude, `${anchorLabel} latitude`, -90, 90),
      },
    };
  });
}

function validateBasemapMode(value: unknown, label: string): DemoBasemapMode {
  if (value !== "street" && value !== "satellite" && value !== "hybrid") {
    return backupError(`${label} is invalid.`);
  }
  return value;
}

function validateRotation(value: unknown, label: string): TargetViewRotation | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value !== 0 && value !== 90 && value !== 180 && value !== 270) {
    return backupError(`${label} is invalid.`);
  }
  return value;
}

function validateMetadata(value: unknown, label: string): SavedMapMetadata {
  if (!isRecord(value) || !Array.isArray(value.activities)) {
    return backupError(`${label} is invalid.`);
  }
  if (value.activities.length > 100) {
    return backupError(`${label} has too many activities.`);
  }
  const mapDateKind = value.mapDateKind;
  if (
    mapDateKind !== "unknown" &&
    mapDateKind !== "current" &&
    mapDateKind !== "exact" &&
    mapDateKind !== "approximate"
  ) {
    return backupError(`${label} date kind is invalid.`);
  }
  const visibility = value.visibility;
  if (visibility !== "private" && visibility !== "public-ready") {
    return backupError(`${label} visibility is invalid.`);
  }
  const mapYear = value.mapYear === null
    ? null
    : safeInteger(value.mapYear, `${label} year`, 0, 100_000);

  return {
    title: requiredString(value.title, `${label} title`),
    description: typeof value.description === "string" && value.description.length <= MAX_TEXT
      ? value.description
      : backupError(`${label} description is invalid.`),
    placeName: typeof value.placeName === "string" && value.placeName.length <= MAX_TEXT
      ? value.placeName
      : backupError(`${label} place is invalid.`),
    subject: requiredString(value.subject, `${label} subject`),
    visualStyle: requiredString(value.visualStyle, `${label} visual style`),
    mapDateKind,
    mapYear,
    activities: value.activities.map((activity, index) =>
      requiredString(activity, `${label} activity ${index + 1}`, 500)),
    source: typeof value.source === "string" && value.source.length <= MAX_TEXT
      ? value.source
      : backupError(`${label} source is invalid.`),
    visibility,
  };
}

function validateImportLineage(value: unknown, label: string): SavedMapImportLineage | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    return backupError(`${label} is invalid.`);
  }
  const sourceFingerprint = requiredString(value.sourceFingerprint, `${label} fingerprint`, 64);
  if (!SHA_256_PATTERN.test(sourceFingerprint)) {
    return backupError(`${label} fingerprint is invalid.`);
  }
  return {
    sourceMapId: requiredString(value.sourceMapId, `${label} map ID`, 500),
    sourceFingerprint,
    importedAt: safeInteger(value.importedAt, `${label} timestamp`),
  };
}

function validatePortableSavedMap(value: unknown, index: number): PortableSavedMap {
  const label = `Map ${index + 1}`;
  if (!isRecord(value) || value.version !== 1) {
    return backupError(`${label} is invalid or unsupported.`);
  }
  const imageDimensions = validateDimensions(value.imageDimensions, `${label} dimensions`);
  return {
    id: requiredString(value.id, `${label} ID`, 500),
    version: 1,
    createdAt: safeInteger(value.createdAt, `${label} created timestamp`),
    updatedAt: safeInteger(value.updatedAt, `${label} updated timestamp`),
    metadata: validateMetadata(value.metadata, `${label} metadata`),
    imageName: requiredString(value.imageName, `${label} image name`),
    imageDimensions,
    anchors: validateAnchors(value.anchors, imageDimensions, label),
    targetZoom: finiteNumber(value.targetZoom, `${label} zoom`, 0.01, 100),
    basemapMode: validateBasemapMode(value.basemapMode, `${label} basemap`),
    assetId: requiredString(value.assetId, `${label} asset ID`, 64),
    preserveAsVariant: value.preserveAsVariant === true ? true : undefined,
    importLineage: validateImportLineage(value.importLineage, `${label} import lineage`),
  };
}

function validatePortableDraft(value: unknown): PortableAnchorDraft | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value) || value.id !== "current" || value.version !== 1) {
    return backupError("The active draft is invalid or unsupported.");
  }
  const imageDimensions = validateDimensions(value.imageDimensions, "Draft dimensions");
  return {
    id: "current",
    version: 1,
    savedAt: safeInteger(value.savedAt, "Draft saved timestamp"),
    imageName: requiredString(value.imageName, "Draft image name"),
    imageDimensions,
    anchors: validateAnchors(value.anchors, imageDimensions, "Draft"),
    targetZoom: finiteNumber(value.targetZoom, "Draft zoom", 0.01, 100),
    targetRotation: validateRotation(value.targetRotation, "Draft rotation"),
    basemapMode: validateBasemapMode(value.basemapMode, "Draft basemap"),
    savedMapId: optionalString(value.savedMapId, "Draft saved map ID", 500),
    assetId: requiredString(value.assetId, "Draft asset ID", 64),
  };
}

function validateAsset(value: unknown, index: number): BackupAsset {
  const label = `Asset ${index + 1}`;
  if (!isRecord(value)) {
    return backupError(`${label} is invalid.`);
  }
  const id = requiredString(value.id, `${label} ID`, 64);
  if (!SHA_256_PATTERN.test(id)) {
    return backupError(`${label} checksum is invalid.`);
  }
  const mimeType = requiredString(value.mimeType, `${label} MIME type`, 100);
  if (!mimeType.startsWith("image/") && mimeType !== "application/octet-stream") {
    return backupError(`${label} is not an image asset.`);
  }
  return {
    id,
    mimeType,
    byteLength: safeInteger(value.byteLength, `${label} byte length`, 1),
    offset: safeInteger(value.offset, `${label} offset`),
  };
}

function validateManifest(value: unknown, payloadBytes: number): BackupManifest {
  if (!isRecord(value) || value.format !== FORMAT_NAME || value.schemaVersion !== SCHEMA_VERSION) {
    return backupError("This Field Atlas backup version is not supported.");
  }
  if (!Array.isArray(value.maps) || value.maps.length > MAX_MAPS) {
    return backupError("The backup contains too many or invalid map records.");
  }
  if (!Array.isArray(value.assets) || value.assets.length > MAX_ASSETS) {
    return backupError("The backup contains too many or invalid image assets.");
  }

  const maps = value.maps.map(validatePortableSavedMap);
  const mapIds = new Set<string>();
  for (const map of maps) {
    if (mapIds.has(map.id)) {
      return backupError("The backup contains duplicate map IDs.");
    }
    mapIds.add(map.id);
  }

  const assets = value.assets.map(validateAsset);
  const assetIds = new Set<string>();
  for (const asset of assets) {
    if (assetIds.has(asset.id)) {
      return backupError("The backup contains duplicate image asset IDs.");
    }
    assetIds.add(asset.id);
  }

  const orderedAssets = [...assets].sort((left, right) => left.offset - right.offset);
  let occupiedThrough = 0;
  for (const asset of orderedAssets) {
    if (asset.offset !== occupiedThrough || asset.offset + asset.byteLength > payloadBytes) {
      return backupError("The backup contains missing, overlapping, or out-of-bounds image data.");
    }
    occupiedThrough = asset.offset + asset.byteLength;
  }
  if (occupiedThrough !== payloadBytes) {
    return backupError("The backup contains unexpected trailing image data.");
  }

  const draft = validatePortableDraft(value.draft);
  if (draft?.savedMapId && !mapIds.has(draft.savedMapId)) {
    return backupError("The active draft references a saved map that is missing from the backup.");
  }
  const referencedAssetIds = new Set(maps.map((map) => map.assetId));
  if (draft) {
    referencedAssetIds.add(draft.assetId);
  }
  for (const assetId of referencedAssetIds) {
    if (!assetIds.has(assetId)) {
      return backupError("A map references image data that is missing from the backup.");
    }
  }
  if (assets.some((asset) => !referencedAssetIds.has(asset.id))) {
    return backupError("The backup contains unreferenced image data.");
  }

  return {
    format: FORMAT_NAME,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: safeInteger(value.exportedAt, "Export timestamp"),
    appVersion: requiredString(value.appVersion, "Application version", 100),
    maps,
    draft,
    assets,
  };
}

function mapToPortable(map: LocalSavedMap, assetId: string): PortableSavedMap {
  return {
    id: map.id,
    version: 1,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
    metadata: map.metadata,
    imageName: map.imageName,
    imageDimensions: map.imageDimensions,
    anchors: map.anchors,
    targetZoom: map.targetZoom,
    basemapMode: map.basemapMode,
    assetId,
    preserveAsVariant: map.preserveAsVariant,
    importLineage: map.importLineage,
  };
}

function draftToPortable(draft: LocalAnchorDraft, assetId: string): PortableAnchorDraft {
  return {
    id: "current",
    version: 1,
    savedAt: draft.savedAt,
    imageName: draft.imageName,
    imageDimensions: draft.imageDimensions,
    anchors: draft.anchors,
    targetZoom: draft.targetZoom,
    targetRotation: draft.targetRotation,
    basemapMode: draft.basemapMode,
    savedMapId: draft.savedMapId,
    assetId,
  };
}

export async function sha256Blob(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Text(value: string) {
  return sha256Blob(new Blob([value], { type: "text/plain;charset=utf-8" }));
}

export async function encodeFieldAtlasBackup(input: Readonly<{
  maps: readonly LocalSavedMap[];
  draft: LocalAnchorDraft | null;
  exportedAt?: number;
  appVersion?: string;
}>) {
  if (input.maps.length > MAX_MAPS) {
    return backupError("There are too many maps to place in one backup.");
  }

  const assets = new Map<string, Readonly<{ blob: Blob; mimeType: string }>>();
  const portableMaps: PortableSavedMap[] = [];

  for (const map of input.maps) {
    const assetId = await sha256Blob(map.imageBlob);
    if (!assets.has(assetId)) {
      assets.set(assetId, {
        blob: map.imageBlob,
        mimeType: map.imageBlob.type || "application/octet-stream",
      });
    }
    portableMaps.push(mapToPortable(map, assetId));
  }

  let portableDraft: PortableAnchorDraft | null = null;
  if (input.draft) {
    const assetId = await sha256Blob(input.draft.imageBlob);
    if (!assets.has(assetId)) {
      assets.set(assetId, {
        blob: input.draft.imageBlob,
        mimeType: input.draft.imageBlob.type || "application/octet-stream",
      });
    }
    portableDraft = draftToPortable(input.draft, assetId);
  }

  let offset = 0;
  const assetManifest: BackupAsset[] = [];
  const assetBlobs: Blob[] = [];
  for (const [id, asset] of assets) {
    if (asset.blob.size === 0) {
      return backupError("A map image is empty and cannot be backed up.");
    }
    assetManifest.push({
      id,
      mimeType: asset.mimeType,
      byteLength: asset.blob.size,
      offset,
    });
    assetBlobs.push(asset.blob);
    offset += asset.blob.size;
  }

  const manifest: BackupManifest = {
    format: FORMAT_NAME,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: input.exportedAt ?? Date.now(),
    appVersion: input.appVersion ?? "0.1.0",
    maps: portableMaps,
    draft: portableDraft,
    assets: assetManifest,
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) {
    return backupError("The backup manifest is too large.");
  }

  const header = new ArrayBuffer(HEADER_BYTES);
  const headerBytes = new Uint8Array(header);
  headerBytes.set(MAGIC_BYTES, 0);
  new DataView(header).setUint32(MAGIC_BYTES.byteLength, manifestBytes.byteLength, true);

  return new Blob([header, manifestBytes, ...assetBlobs], {
    type: "application/x-field-atlas",
  });
}

export async function decodeFieldAtlasBackup(packageBlob: Blob): Promise<DecodedFieldAtlasBackup> {
  if (packageBlob.size < HEADER_BYTES) {
    return backupError("This file is too small to be a Field Atlas backup.");
  }
  const header = await packageBlob.slice(0, HEADER_BYTES).arrayBuffer();
  const headerBytes = new Uint8Array(header);
  const magic = new TextDecoder().decode(headerBytes.slice(0, MAGIC_BYTES.byteLength));
  if (magic !== MAGIC_TEXT) {
    return backupError("This is not a supported Field Atlas backup file.");
  }
  const manifestByteLength = new DataView(header).getUint32(MAGIC_BYTES.byteLength, true);
  if (manifestByteLength === 0 || manifestByteLength > MAX_MANIFEST_BYTES) {
    return backupError("The backup manifest length is invalid.");
  }
  const payloadStart = HEADER_BYTES + manifestByteLength;
  if (payloadStart > packageBlob.size) {
    return backupError("The backup file is truncated before its image data.");
  }

  let rawManifest: unknown;
  try {
    const manifestText = await packageBlob
      .slice(HEADER_BYTES, payloadStart)
      .text();
    rawManifest = JSON.parse(manifestText) as unknown;
  } catch {
    return backupError("The backup manifest is not valid JSON.");
  }

  const manifest = validateManifest(rawManifest, packageBlob.size - payloadStart);
  const assetBlobs = new Map<string, Blob>();
  for (const asset of manifest.assets) {
    const blob = packageBlob.slice(
      payloadStart + asset.offset,
      payloadStart + asset.offset + asset.byteLength,
      asset.mimeType,
    );
    const actualHash = await sha256Blob(blob);
    if (actualHash !== asset.id) {
      return backupError("An image checksum does not match. The backup may be damaged.");
    }
    assetBlobs.set(asset.id, blob);
  }

  const maps = manifest.maps.map((map): LocalSavedMap => ({
    id: map.id,
    version: 1,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
    metadata: map.metadata,
    imageName: map.imageName,
    imageBlob: assetBlobs.get(map.assetId) as Blob,
    imageDimensions: map.imageDimensions,
    anchors: map.anchors,
    targetZoom: map.targetZoom,
    basemapMode: map.basemapMode,
    preserveAsVariant: map.preserveAsVariant,
    importLineage: map.importLineage,
  }));

  const draft = manifest.draft
    ? {
        id: "current" as const,
        version: 1 as const,
        savedAt: manifest.draft.savedAt,
        imageName: manifest.draft.imageName,
        imageBlob: assetBlobs.get(manifest.draft.assetId) as Blob,
        imageDimensions: manifest.draft.imageDimensions,
        anchors: manifest.draft.anchors,
        targetZoom: manifest.draft.targetZoom,
        targetRotation: manifest.draft.targetRotation,
        basemapMode: manifest.draft.basemapMode,
        savedMapId: manifest.draft.savedMapId,
      }
    : null;

  return {
    exportedAt: manifest.exportedAt,
    appVersion: manifest.appVersion,
    maps,
    draft,
    assetCount: manifest.assets.length,
    totalAssetBytes: manifest.assets.reduce((total, asset) => total + asset.byteLength, 0),
  };
}

export function fieldAtlasBackupFilename(timestamp = Date.now()) {
  return `field-atlas-backup-${new Date(timestamp).toISOString().slice(0, 10)}.fieldatlas`;
}
