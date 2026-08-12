import "server-only";

import { createHash, createHmac } from "node:crypto";
import sharp from "sharp";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  publicationMatchesSettings,
  type OwnerPublication,
  type PublishMapRequest,
} from "@/features/community/community-contract";
import { CloudApiError, firstRpcRow } from "@/lib/cloud/cloud-api";
import { deleteR2Object, readR2Object, writeR2Object } from "@/lib/cloud/r2";

type MapRow = Readonly<{
  id: string;
  owner_id: string;
  current_revision_id: string | null;
  current_publication_id: string | null;
  publication_hold: boolean;
  publication_hold_reason: string | null;
}>;

type RevisionRow = Readonly<{
  id: string;
  asset_id: string;
  anchors: unknown;
  metadata: unknown;
}>;

type AssetRow = Readonly<{
  id: string;
  object_key: string;
  status: string;
  sha256: string;
}>;

type PublicationRetryRow = Readonly<{
  id: string;
  map_id: string;
  revision_id: string;
  public_asset_id: string;
  publication_number: number;
  moderation_status: string;
  visibility: string;
  rights_basis: string;
  source_url: string;
  license_name: string;
  attribution: string;
}>;

type OwnerPublicationRow = Readonly<{
  id: string;
  revision_id: string;
  visibility: OwnerPublication["visibility"];
  moderation_status: OwnerPublication["moderationStatus"];
  published_at: string;
  rights_basis: OwnerPublication["rightsBasis"];
  source_url: string;
  license_name: string;
  attribution: string;
}>;

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function pointDistanceMeters(
  first: Readonly<{ latitude: number; longitude: number }>,
  second: Readonly<{ latitude: number; longitude: number }>,
) {
  const radians = Math.PI / 180;
  const deltaLatitude = (second.latitude - first.latitude) * radians;
  const deltaLongitude = (second.longitude - first.longitude) * radians;
  const firstLatitude = first.latitude * radians;
  const secondLatitude = second.latitude * radians;
  const haversine = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function coverageFromAnchors(value: unknown) {
  if (!Array.isArray(value)) return { latitude: null, longitude: null, radiusMeters: null };
  const points = value.flatMap((anchor) => {
    if (typeof anchor !== "object" || anchor === null || !("geographic" in anchor)) return [];
    const geographic = anchor.geographic;
    if (typeof geographic !== "object" || geographic === null) return [];
    const latitude = "latitude" in geographic ? geographic.latitude : null;
    const longitude = "longitude" in geographic ? geographic.longitude : null;
    return typeof latitude === "number" && typeof longitude === "number"
      ? [{ latitude, longitude }]
      : [];
  });
  if (points.length === 0) return { latitude: null, longitude: null, radiusMeters: null };
  const center = points.reduce(
    (total, point) => ({ latitude: total.latitude + point.latitude, longitude: total.longitude + point.longitude }),
    { latitude: 0, longitude: 0 },
  );
  center.latitude /= points.length;
  center.longitude /= points.length;
  return {
    ...center,
    radiusMeters: Math.max(...points.map((point) => pointDistanceMeters(center, point))),
  };
}

async function makePublicImages(source: Uint8Array) {
  const image = sharp(source, {
    failOn: "error",
    limitInputPixels: 120_000_000,
    sequentialRead: true,
  }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new CloudApiError("The map image dimensions could not be verified.", 422);
  }

  const highQuality = await image
    .clone()
    .resize({ width: 12_000, height: 12_000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 92, effort: 4, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });
  const thumbnail = await image
    .clone()
    .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4, smartSubsample: true })
    .toBuffer();

  return {
    highQuality: highQuality.data,
    thumbnail,
    width: highQuality.info.width,
    height: highQuality.info.height,
    sha256: sha256(highQuality.data),
  };
}

export function hashShareToken(token: string | null | undefined) {
  return token ? sha256(token) : null;
}

function publicationResponse(mapId: string, row: PublicationRetryRow, shareToken: string | null) {
  return {
    mapId,
    publicationId: row.id,
    publicationNumber: Number(row.publication_number),
    moderationStatus: row.moderation_status,
    visibility: row.visibility,
    shareToken,
    sharePath: shareToken ? `/maps/${mapId}?share=${encodeURIComponent(shareToken)}` : `/maps/${mapId}`,
  };
}

async function readMatchingPublicationRetry(
  supabase: SupabaseClient,
  ownerId: string,
  mapId: string,
  revisionId: string,
  effectiveSourceUrl: string,
  input: PublishMapRequest,
) {
  const { data, error } = await supabase
    .from("map_publications")
    .select("id, map_id, revision_id, public_asset_id, publication_number, moderation_status, visibility, rights_basis, source_url, license_name, attribution")
    .eq("owner_id", ownerId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (error) throw new CloudApiError("Publication retry state could not be checked.", 502);
  if (!data) return null;
  const row = data as PublicationRetryRow;
  if (
    row.map_id !== mapId
    || row.revision_id !== revisionId
    || row.visibility !== input.visibility
    || row.rights_basis !== input.rightsBasis
    || row.source_url !== effectiveSourceUrl
    || row.license_name !== input.licenseName
    || row.attribution !== input.attribution
  ) {
    throw new CloudApiError("This publication retry ID was already used for different sharing choices.", 409);
  }
  if (row.visibility === "unlisted") {
    const tokenResult = await supabase
      .from("map_share_tokens")
      .select("token_hash")
      .eq("publication_id", row.id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (tokenResult.error || !tokenResult.data) throw new CloudApiError("The unlisted link could not be recovered.", 409);
    const storedHash = String(tokenResult.data.token_hash);
    const normalizedStoredHash = storedHash.startsWith("\\x") ? storedHash.slice(2) : storedHash;
    if (normalizedStoredHash !== hashShareToken(input.shareToken)) {
      throw new CloudApiError("This publication retry ID belongs to a different unlisted link.", 409);
    }
  }
  return publicationResponse(mapId, row, input.shareToken);
}

export function createAnonymousDailyToken(request: Request) {
  const secret = process.env.REPORT_FINGERPRINT_SECRET?.trim()
    || process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!secret) {
    throw new CloudApiError("Anonymous reports are not configured yet.", 503);
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim() || "local";
  const day = new Date().toISOString().slice(0, 10);
  return createHmac("sha256", secret).update(`${day}|${address}`).digest("hex");
}

export async function readOwnerPublicationStatus(
  supabase: SupabaseClient,
  mapId: string,
  ownerId: string,
) {
  const { data, error } = await supabase
    .from("maps")
    .select("id, owner_id, current_revision_id, current_publication_id, publication_hold, publication_hold_reason")
    .eq("id", mapId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) {
    throw new CloudApiError("Community sharing needs the latest database migration.", 503);
  }
  if (!data) throw new CloudApiError("Sync this map privately before sharing it.", 404);
  const map = data as MapRow;
  let publication: OwnerPublication | null = null;
  if (map.current_publication_id) {
    const result = await supabase
      .from("map_publications")
      .select("id, revision_id, visibility, moderation_status, published_at, rights_basis, source_url, license_name, attribution")
      .eq("id", map.current_publication_id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (result.error) throw new CloudApiError("Publication status could not be loaded.", 502);
    if (result.data) {
      const row = result.data as OwnerPublicationRow;
      publication = {
        id: row.id,
        revisionId: row.revision_id,
        visibility: row.visibility,
        moderationStatus: row.moderation_status,
        publishedAt: row.published_at,
        rightsBasis: row.rights_basis,
        sourceUrl: row.source_url,
        licenseName: row.license_name,
        attribution: row.attribution,
      };
    }
  }
  return {
    mapId: map.id,
    currentRevisionId: map.current_revision_id,
    currentPublicationId: map.current_publication_id,
    publicationHold: map.publication_hold,
    publicationHoldReason: map.publication_hold_reason,
    publication,
  };
}

export async function publishOwnerMap(
  supabase: SupabaseClient,
  ownerId: string,
  mapId: string,
  input: PublishMapRequest,
) {
  const status = await readOwnerPublicationStatus(supabase, mapId, ownerId);
  if (!status.currentRevisionId) throw new CloudApiError("Sync a finished revision before sharing.", 409);
  if (status.publicationHold) throw new CloudApiError(status.publicationHoldReason || "This map is on hold.", 403);

  const { data: rawRevision, error: revisionError } = await supabase
    .from("map_revisions")
    .select("id, asset_id, anchors, metadata")
    .eq("id", status.currentRevisionId)
    .eq("map_id", mapId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (revisionError || !rawRevision) throw new CloudApiError("The synced revision was not found.", 404);
  const revision = rawRevision as RevisionRow;
  if (!Array.isArray(revision.anchors) || revision.anchors.length < 2) {
    throw new CloudApiError("Add at least two anchors before sharing.", 422);
  }

  const metadataSource = typeof revision.metadata === "object" && revision.metadata !== null && "source" in revision.metadata
    && typeof revision.metadata.source === "string" ? revision.metadata.source.trim() : "";
  const effectiveSourceUrl = input.sourceUrl || metadataSource;
  const previousResult = await readMatchingPublicationRetry(supabase, ownerId, mapId, revision.id, effectiveSourceUrl, input);
  if (previousResult) return previousResult;
  if (publicationMatchesSettings(status.publication, status.currentRevisionId, {
    visibility: input.visibility,
    rightsBasis: input.rightsBasis,
    sourceUrl: effectiveSourceUrl,
    licenseName: input.licenseName,
    attribution: input.attribution,
  })) {
    throw new CloudApiError("This exact map revision and sharing setup are already published.", 409);
  }

  const { data: rawAsset, error: assetError } = await supabase
    .from("map_assets")
    .select("id, object_key, status, sha256")
    .eq("id", revision.asset_id)
    .eq("owner_id", ownerId)
    .eq("status", "ready")
    .maybeSingle();
  if (assetError || !rawAsset) throw new CloudApiError("The private source image was not found.", 404);
  const asset = rawAsset as AssetRow;

  const publicAssetId = crypto.randomUUID();
  const keyPrefix = `public/${ownerId}/${publicAssetId}`;
  const mapObjectKey = `${keyPrefix}/map.webp`;
  const thumbnailObjectKey = `${keyPrefix}/thumbnail.webp`;
  const shareToken = input.shareToken;
  const shareTokenHash = hashShareToken(shareToken);
  let imagesWritten = false;

  try {
    const source = await readR2Object(asset.object_key);
    if (sha256(source) !== asset.sha256) {
      throw new CloudApiError("The private source image failed its checksum verification.", 409);
    }
    const images = await makePublicImages(source);
    imagesWritten = true;
    await Promise.all([
      writeR2Object(mapObjectKey, images.highQuality, "image/webp"),
      writeR2Object(thumbnailObjectKey, images.thumbnail, "image/webp"),
    ]);
    const coverage = coverageFromAnchors(revision.anchors);
    const { data, error } = await supabase.rpc("publish_map_revision", {
      p_map_id: mapId,
      p_revision_id: revision.id,
      p_public_asset_id: publicAssetId,
      p_high_quality_object_key: mapObjectKey,
      p_thumbnail_object_key: thumbnailObjectKey,
      p_mime_type: "image/webp",
      p_high_quality_byte_size: images.highQuality.byteLength,
      p_thumbnail_byte_size: images.thumbnail.byteLength,
      p_sha256: images.sha256,
      p_width: images.width,
      p_height: images.height,
      p_visibility: input.visibility,
      p_rights_basis: input.rightsBasis,
      p_source_url: input.sourceUrl,
      p_license_name: input.licenseName,
      p_attribution: input.attribution,
      p_coverage_center_lat: coverage.latitude,
      p_coverage_center_lng: coverage.longitude,
      p_coverage_radius_m: coverage.radiusMeters,
      p_share_token_hash: shareTokenHash,
      p_idempotency_key: input.idempotencyKey,
      p_expected_publication_id: input.expectedPublicationId,
    });
    if (error) {
      const recovered = await readMatchingPublicationRetry(supabase, ownerId, mapId, revision.id, effectiveSourceUrl, input);
      if (recovered) {
        await Promise.allSettled([deleteR2Object(mapObjectKey), deleteR2Object(thumbnailObjectKey)]);
        imagesWritten = false;
        return recovered;
      }
      throw new CloudApiError(error.message || "The publication could not be activated.", 409);
    }
    const row = firstRpcRow(data);
    const publicationId = String(row.publication_id ?? "");
    const assetResult = await supabase
      .from("map_publications")
      .select("public_asset_id")
      .eq("id", publicationId)
      .eq("owner_id", ownerId)
      .single();
    if (assetResult.error) throw new CloudApiError("The publication result could not be verified.", 502);
    if (assetResult.data.public_asset_id !== publicAssetId) {
      await Promise.allSettled([deleteR2Object(mapObjectKey), deleteR2Object(thumbnailObjectKey)]);
      imagesWritten = false;
    }
    return publicationResponse(mapId, {
      id: publicationId,
      map_id: mapId,
      revision_id: revision.id,
      public_asset_id: String(assetResult.data.public_asset_id),
      publication_number: Number(row.publication_number),
      moderation_status: String(row.moderation_status ?? "needs_review"),
      visibility: input.visibility,
      rights_basis: input.rightsBasis,
      source_url: input.sourceUrl,
      license_name: input.licenseName,
      attribution: input.attribution,
    }, shareToken);
  } catch (error) {
    if (imagesWritten) {
      await Promise.allSettled([deleteR2Object(mapObjectKey), deleteR2Object(thumbnailObjectKey)]);
    }
    if (error instanceof CloudApiError) throw error;
    throw new CloudApiError("The public image could not be decoded. Try a JPEG, PNG, or WebP image.", 422);
  }
}
