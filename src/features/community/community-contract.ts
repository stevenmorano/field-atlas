import type { DemoBasemapMode } from "@/features/anchor/demo-basemap-style";
import type { AnchorPair } from "@/lib/georeferencing/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PUBLICATION_VISIBILITIES = ["public", "unlisted"] as const;
export const RIGHTS_BASES = ["own_or_authorized", "permission", "public_domain", "open_license"] as const;
export const REPORT_CATEGORIES = ["gps_inaccurate", "bad_quality", "wrong_details", "duplicate", "copyright", "unsafe_or_abusive", "other"] as const;
export const MODERATION_ACTIONS = ["admin_checked", "changes_requested", "hidden", "restored"] as const;

export type PublicationVisibility = typeof PUBLICATION_VISIBILITIES[number];
export type RightsBasis = typeof RIGHTS_BASES[number];
export type ReportCategory = typeof REPORT_CATEGORIES[number];
export type ModerationAction = typeof MODERATION_ACTIONS[number];
export type ModerationStatus = "needs_review" | "admin_checked" | "changes_requested" | "hidden";

export type OwnerPublication = Readonly<{
  id: string;
  revisionId: string;
  visibility: PublicationVisibility;
  moderationStatus: ModerationStatus;
  publishedAt: string;
  rightsBasis: RightsBasis;
  sourceUrl: string;
  licenseName: string;
  attribution: string;
}>;

export type OwnerPublicationStatus = Readonly<{
  currentRevisionId: string | null;
  currentPublicationId: string | null;
  publicationHold: boolean;
  publicationHoldReason: string | null;
  publication: OwnerPublication | null;
}>;

export type PublicationSettings = Readonly<{
  visibility: PublicationVisibility;
  rightsBasis: RightsBasis;
  sourceUrl: string;
  licenseName: string;
  attribution: string;
}>;

export type PublishMapRequest = Readonly<{
  visibility: PublicationVisibility;
  rightsBasis: RightsBasis;
  sourceUrl: string;
  licenseName: string;
  attribution: string;
  shareToken: string | null;
  idempotencyKey: string;
  expectedPublicationId: string | null;
}>;

export function publicationMatchesSettings(
  publication: OwnerPublication | null,
  currentRevisionId: string | null,
  settings: PublicationSettings,
) {
  return Boolean(
    publication
    && currentRevisionId
    && publication.revisionId === currentRevisionId
    && publication.visibility === settings.visibility
    && publication.rightsBasis === settings.rightsBasis
    && publication.sourceUrl.trim() === settings.sourceUrl.trim()
    && publication.licenseName.trim() === settings.licenseName.trim()
    && publication.attribution.trim() === settings.attribution.trim(),
  );
}

export function publicationModerationLabel(
  visibility: PublicationVisibility,
  moderationStatus: ModerationStatus,
) {
  if (moderationStatus === "hidden") return "Temporarily hidden by administrator";
  if (moderationStatus === "admin_checked") {
    return "Admin checked · not an accuracy or ownership guarantee";
  }
  if (moderationStatus === "changes_requested") {
    return visibility === "public"
      ? "Listed publicly · updates requested · still visible"
      : "Shared by link · updates requested · still visible";
  }
  return visibility === "public"
    ? "Listed publicly · awaiting admin check"
    : "Shared by link · awaiting admin check";
}

export type PublicMapSummary = Readonly<{
  mapId: string;
  publicationId: string;
  publicAssetId: string;
  title: string;
  description: string;
  placeName: string;
  subject: string;
  visualStyle: string;
  mapDateKind: "unknown" | "current" | "exact" | "approximate";
  mapYear: number | null;
  activities: readonly string[];
  anchorCount: number;
  publishedAt: string;
  username: string;
  adminChecked: boolean;
  coverage: Readonly<{
    latitude: number | null;
    longitude: number | null;
    radiusMeters: number | null;
  }>;
}>;

export type PublicMapDetail = PublicMapSummary & Readonly<{
  schemaVersion: 1;
  visibility: PublicationVisibility;
  moderationStatus: "needs_review" | "admin_checked" | "changes_requested";
  sourceUrl: string;
  licenseName: string;
  attribution: string;
  author: Readonly<{ username: string; avatarSeed: string }>;
  image: Readonly<{ width: number; height: number; mimeType: string }>;
  anchors: readonly AnchorPair[];
  targetZoom: number;
  basemapMode: DemoBasemapMode;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string" || value.length > maximum) {
    throw new Error(`${label} is invalid.`);
  }
  return value.trim();
}

function uuid(value: unknown, label: string) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

export function parsePublishMapRequest(value: unknown): PublishMapRequest {
  if (!isRecord(value)) throw new Error("Publication request is invalid.");
  if (!PUBLICATION_VISIBILITIES.includes(value.visibility as PublicationVisibility)) {
    throw new Error("Choose public or unlisted sharing.");
  }
  if (!RIGHTS_BASES.includes(value.rightsBasis as RightsBasis)) {
    throw new Error("Choose why you are allowed to share this map.");
  }
  const licenseName = text(value.licenseName, "License", 500);
  if (value.rightsBasis === "open_license" && !licenseName) {
    throw new Error("Name the open license.");
  }
  const sourceUrl = text(value.sourceUrl, "Source or reference", 2000);
  const expectedPublicationId = value.expectedPublicationId === null
    ? null
    : uuid(value.expectedPublicationId, "Current publication");
  const shareToken = value.shareToken === null ? null : text(value.shareToken, "Share token", 128);
  if (value.visibility === "unlisted" && !/^[A-Za-z0-9_-]{43,128}$/.test(shareToken ?? "")) {
    throw new Error("The unlisted share token is invalid.");
  }
  if (value.visibility === "public" && shareToken !== null) {
    throw new Error("Public maps cannot include an unlisted share token.");
  }
  return {
    visibility: value.visibility as PublicationVisibility,
    rightsBasis: value.rightsBasis as RightsBasis,
    sourceUrl,
    licenseName,
    attribution: text(value.attribution, "Attribution", 2000),
    shareToken,
    idempotencyKey: uuid(value.idempotencyKey, "Publication request ID"),
    expectedPublicationId,
  };
}

export function parseModerationRequest(value: unknown) {
  if (!isRecord(value)) throw new Error("Moderation action is invalid.");
  if (!MODERATION_ACTIONS.includes(value.action as ModerationAction)) {
    throw new Error("Moderation action is invalid.");
  }
  const action = value.action as ModerationAction;
  const reason = text(value.reason, "Moderation reason", 2000);
  if (action !== "admin_checked" && !reason) {
    throw new Error("Add a reason for this moderation action.");
  }
  return {
    publicationId: uuid(value.publicationId, "Publication"),
    action,
    reason,
  };
}

export function parseReportRequest(value: unknown) {
  if (!isRecord(value)) throw new Error("Report is invalid.");
  if (!REPORT_CATEGORIES.includes(value.category as ReportCategory)) {
    throw new Error("Choose a report category.");
  }
  return {
    publicationId: uuid(value.publicationId, "Publication"),
    category: value.category as ReportCategory,
    note: text(value.note, "Report note", 2000),
    shareToken: value.shareToken === undefined ? "" : text(value.shareToken, "Share token", 500),
    website: value.website === undefined ? "" : text(value.website, "Website", 500),
  };
}

export function parseProfileUpdate(value: unknown) {
  if (!isRecord(value)) throw new Error("Profile is invalid.");
  return {
    username: text(value.username, "Username", 30).toLocaleLowerCase(),
    bio: text(value.bio, "Bio", 280),
  };
}
