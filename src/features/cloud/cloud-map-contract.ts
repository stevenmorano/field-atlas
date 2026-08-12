import type { LocalSavedMap, SavedMapMetadata } from "@/features/maps/saved-map-types";
import type { DemoBasemapMode } from "@/features/anchor/demo-basemap-style";
import type { AnchorPair } from "@/lib/georeferencing/types";

export const MAX_CLOUD_IMAGE_BYTES = 100 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_256_PATTERN = /^[a-f0-9]{64}$/;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export type CloudAssetUploadRequest = Readonly<{
  fileName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  width: number;
  height: number;
}>;

export type CloudMapSummary = Readonly<{
  id: string;
  metadata: SavedMapMetadata;
  publicationStatus: "private" | "draft" | "pending_review" | "published" | "rejected";
  currentRevisionId: string;
  assetId: string;
  assetSha256: string;
  imageName: string;
  imageDimensions: Readonly<{ width: number; height: number }>;
  anchorCount: number;
  clientUpdatedAt: number;
  updatedAt: number;
}>;

export type CloudMapDownload = CloudMapSummary & Readonly<{
  anchors: readonly AnchorPair[];
  targetZoom: number;
  basemapMode: DemoBasemapMode;
  createdAt: number;
}>;

export type CloudSyncResult = Readonly<{
  status: "synced" | "unchanged" | "conflict";
  mapId: string;
  revisionId: string;
  currentRevisionId: string;
  revisionNumber: number;
}>;

export type CloudMapSyncRequest = Readonly<{
  mapId: string;
  assetId: string;
  metadata: SavedMapMetadata;
  anchors: readonly AnchorPair[];
  targetZoom: number;
  basemapMode: DemoBasemapMode;
  clientUpdatedAt: number;
  contentFingerprint: string;
  baseRevisionId: string | null;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, maximum = 100_000) {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function optionalText(value: unknown, label: string, maximum = 100_000) {
  if (typeof value !== "string" || value.length > maximum) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function finiteNumber(value: unknown, label: string, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function safeInteger(value: unknown, label: string, minimum: number, maximum: number) {
  const number = finiteNumber(value, label, minimum, maximum);
  if (!Number.isSafeInteger(number)) {
    throw new Error(`${label} is invalid.`);
  }
  return number;
}

export function normalizeCloudImageMimeType(fileName: string, candidate: string) {
  const normalized = candidate.trim().toLocaleLowerCase();
  if (ALLOWED_IMAGE_TYPES.has(normalized)) {
    return normalized;
  }

  const extension = fileName.split(".").pop()?.toLocaleLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  throw new Error("Only JPEG, PNG, WebP, HEIC, and HEIF map images can be synced.");
}

export function parseCloudAssetUploadRequest(value: unknown): CloudAssetUploadRequest {
  if (!isRecord(value)) {
    throw new Error("Invalid upload request.");
  }

  const fileName = requiredText(value.fileName, "File name", 500);
  const mimeType = normalizeCloudImageMimeType(fileName, optionalText(value.mimeType, "Image type", 100));
  const byteSize = safeInteger(value.byteSize, "File size", 1, MAX_CLOUD_IMAGE_BYTES);
  const sha256 = requiredText(value.sha256, "Image checksum", 64);
  if (!SHA_256_PATTERN.test(sha256)) {
    throw new Error("Image checksum is invalid.");
  }

  return {
    fileName,
    mimeType,
    byteSize,
    sha256,
    width: safeInteger(value.width, "Image width", 1, 1_000_000),
    height: safeInteger(value.height, "Image height", 1, 1_000_000),
  };
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

export function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: Blob | string) {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : new Uint8Array(await value.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

export async function createCloudContentFingerprint(map: LocalSavedMap, assetSha256: string) {
  return sha256Hex(stableJson({
    schemaVersion: 1,
    assetSha256,
    metadata: map.metadata,
    imageName: map.imageName,
    imageDimensions: map.imageDimensions,
    anchors: map.anchors,
    targetZoom: map.targetZoom,
    basemapMode: map.basemapMode,
  }));
}

function parseMetadata(value: unknown): SavedMapMetadata {
  if (!isRecord(value)) {
    throw new Error("Map metadata is invalid.");
  }
  const dateKind = value.mapDateKind;
  if (dateKind !== "unknown" && dateKind !== "current" && dateKind !== "exact" && dateKind !== "approximate") {
    throw new Error("Map date is invalid.");
  }
  const visibility = value.visibility;
  if (visibility !== "private" && visibility !== "public-ready") {
    throw new Error("Map visibility is invalid.");
  }
  if (!Array.isArray(value.activities) || value.activities.some((item) => typeof item !== "string")) {
    throw new Error("Map activities are invalid.");
  }

  return {
    title: requiredText(value.title, "Map title", 500),
    description: optionalText(value.description, "Map description"),
    placeName: optionalText(value.placeName, "Map place", 500),
    subject: requiredText(value.subject, "Map subject", 200),
    visualStyle: requiredText(value.visualStyle, "Map style", 200),
    mapDateKind: dateKind,
    mapYear: value.mapYear === null ? null : safeInteger(value.mapYear, "Map year", -10_000, 20_000),
    activities: value.activities.map((item) => requiredText(item, "Map activity", 200)),
    source: optionalText(value.source, "Map source"),
    visibility,
  };
}

function parseAnchors(value: unknown, dimensions: Readonly<{ width: number; height: number }>) {
  if (!Array.isArray(value) || value.length > 10_000) {
    throw new Error("Map anchors are invalid.");
  }

  return value.map((candidate, index): AnchorPair => {
    if (!isRecord(candidate) || !isRecord(candidate.image) || !isRecord(candidate.geographic)) {
      throw new Error(`Anchor ${index + 1} is invalid.`);
    }
    return {
      id: requiredText(candidate.id, `Anchor ${index + 1} ID`, 500),
      image: {
        x: finiteNumber(candidate.image.x, `Anchor ${index + 1} x`, 0, dimensions.width),
        y: finiteNumber(candidate.image.y, `Anchor ${index + 1} y`, 0, dimensions.height),
      },
      geographic: {
        longitude: finiteNumber(candidate.geographic.longitude, `Anchor ${index + 1} longitude`, -180, 180),
        latitude: finiteNumber(candidate.geographic.latitude, `Anchor ${index + 1} latitude`, -90, 90),
      },
    };
  });
}

export function parseCloudMapSyncRequest(value: unknown): CloudMapSyncRequest {
  if (!isRecord(value)) {
    throw new Error("Cloud map request is invalid.");
  }
  for (const [label, candidate] of [
    ["Map ID", value.mapId],
    ["Asset ID", value.assetId],
  ] as const) {
    if (typeof candidate !== "string" || !UUID_PATTERN.test(candidate)) {
      throw new Error(`${label} is invalid.`);
    }
  }
  if (
    value.baseRevisionId !== null &&
    (typeof value.baseRevisionId !== "string" || !UUID_PATTERN.test(value.baseRevisionId))
  ) {
    throw new Error("Base revision ID is invalid.");
  }
  if (typeof value.contentFingerprint !== "string" || !SHA_256_PATTERN.test(value.contentFingerprint)) {
    throw new Error("Content fingerprint is invalid.");
  }
  const basemapMode = value.basemapMode;
  if (basemapMode !== "street" && basemapMode !== "satellite" && basemapMode !== "hybrid") {
    throw new Error("Basemap mode is invalid.");
  }

  return {
    mapId: value.mapId as string,
    assetId: value.assetId as string,
    metadata: parseMetadata(value.metadata),
    anchors: parseAnchors(value.anchors, { width: 1_000_000, height: 1_000_000 }),
    targetZoom: finiteNumber(value.targetZoom, "Target zoom", 0.01, 32),
    basemapMode,
    clientUpdatedAt: safeInteger(value.clientUpdatedAt, "Client update time", 0, Number.MAX_SAFE_INTEGER),
    contentFingerprint: value.contentFingerprint,
    baseRevisionId: value.baseRevisionId as string | null,
  };
}

export function parseCloudMapDownload(value: unknown): CloudMapDownload {
  if (!isRecord(value) || !isRecord(value.imageDimensions)) {
    throw new Error("Cloud map is invalid.");
  }
  const dimensions = {
    width: safeInteger(value.imageDimensions.width, "Image width", 1, 1_000_000),
    height: safeInteger(value.imageDimensions.height, "Image height", 1, 1_000_000),
  };
  const publicationStatus = value.publicationStatus;
  if (
    publicationStatus !== "private" && publicationStatus !== "draft" &&
    publicationStatus !== "pending_review" && publicationStatus !== "published" &&
    publicationStatus !== "rejected"
  ) {
    throw new Error("Publication status is invalid.");
  }
  const basemapMode = value.basemapMode;
  if (basemapMode !== "street" && basemapMode !== "satellite" && basemapMode !== "hybrid") {
    throw new Error("Basemap mode is invalid.");
  }
  for (const [label, candidate] of [
    ["Map ID", value.id],
    ["Revision ID", value.currentRevisionId],
    ["Asset ID", value.assetId],
  ] as const) {
    if (typeof candidate !== "string" || !UUID_PATTERN.test(candidate)) {
      throw new Error(`${label} is invalid.`);
    }
  }

  const assetSha256 = requiredText(value.assetSha256, "Asset checksum", 64);
  if (!SHA_256_PATTERN.test(assetSha256)) {
    throw new Error("Asset checksum is invalid.");
  }
  const anchors = parseAnchors(value.anchors, dimensions);
  return {
    id: value.id as string,
    metadata: parseMetadata(value.metadata),
    publicationStatus,
    currentRevisionId: value.currentRevisionId as string,
    assetId: value.assetId as string,
    assetSha256,
    imageName: requiredText(value.imageName, "Image name", 500),
    imageDimensions: dimensions,
    anchorCount: anchors.length,
    anchors,
    targetZoom: finiteNumber(value.targetZoom, "Target zoom", 0.01, 32),
    basemapMode,
    clientUpdatedAt: safeInteger(value.clientUpdatedAt, "Client update time", 0, Number.MAX_SAFE_INTEGER),
    createdAt: safeInteger(value.createdAt, "Created time", 0, Number.MAX_SAFE_INTEGER),
    updatedAt: safeInteger(value.updatedAt, "Updated time", 0, Number.MAX_SAFE_INTEGER),
  };
}

export function parseCloudMapSummaries(value: unknown): readonly CloudMapSummary[] {
  if (!Array.isArray(value)) {
    throw new Error("Cloud map list is invalid.");
  }
  return value.map((item) => {
    const parsed = parseCloudMapDownload({
      ...isRecord(item) ? item : {},
      anchors: [],
      targetZoom: 1,
      basemapMode: "street",
      createdAt: isRecord(item) ? item.updatedAt : undefined,
    });
    return {
      id: parsed.id,
      metadata: parsed.metadata,
      publicationStatus: parsed.publicationStatus,
      currentRevisionId: parsed.currentRevisionId,
      assetId: parsed.assetId,
      assetSha256: parsed.assetSha256,
      imageName: parsed.imageName,
      imageDimensions: parsed.imageDimensions,
      anchorCount: isRecord(item) ? safeInteger(item.anchorCount, "Anchor count", 0, 10_000) : 0,
      clientUpdatedAt: parsed.clientUpdatedAt,
      updatedAt: parsed.updatedAt,
    };
  });
}
