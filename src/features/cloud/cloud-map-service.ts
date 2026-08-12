"use client";

import {
  createCloudContentFingerprint,
  normalizeCloudImageMimeType,
  parseCloudMapDownload,
  parseCloudMapSummaries,
  sha256Hex,
  type CloudMapSummary,
  type CloudSyncResult,
} from "@/features/cloud/cloud-map-contract";
import {
  readCloudSyncState,
  writeCloudSyncState,
} from "@/features/cloud/local-cloud-sync-store";
import { storeDownloadedCloudMap } from "@/features/maps/local-saved-map-store";
import type { LocalSavedMap } from "@/features/maps/saved-map-types";

async function responseError(response: Response) {
  try {
    const body = await response.json() as { error?: unknown };
    if (typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // Use the status fallback below.
  }
  return `Cloud request failed (${response.status}).`;
}

async function requireJson(response: Response) {
  if (!response.ok) {
    throw new Error(await responseError(response));
  }
  return response.json() as Promise<unknown>;
}

export async function listCloudMaps() {
  const response = await fetch("/api/cloud/maps", { cache: "no-store" });
  return parseCloudMapSummaries(await requireJson(response));
}

export async function syncLocalMapToCloud(map: LocalSavedMap, userId: string) {
  const mimeType = normalizeCloudImageMimeType(map.imageName, map.imageBlob.type);
  const assetSha256 = await sha256Hex(map.imageBlob);
  const contentFingerprint = await createCloudContentFingerprint(map, assetSha256);
  const existingState = await readCloudSyncState(map.id);
  const baseRevisionId = existingState?.userId === userId
    ? existingState.remoteRevisionId
    : null;

  const presignResponse = await fetch("/api/cloud/assets/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: map.imageName,
      mimeType,
      byteSize: map.imageBlob.size,
      sha256: assetSha256,
      width: map.imageDimensions.width,
      height: map.imageDimensions.height,
    }),
  });
  const presign = await requireJson(presignResponse) as Record<string, unknown>;
  const assetId = typeof presign.assetId === "string" ? presign.assetId : "";
  const needsUpload = presign.needsUpload === true;
  const uploadUrl = typeof presign.uploadUrl === "string" ? presign.uploadUrl : null;
  if (!assetId || (needsUpload && !uploadUrl)) {
    throw new Error("The cloud image upload response was invalid.");
  }

  if (needsUpload && uploadUrl) {
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: map.imageBlob,
    });
    if (!uploadResponse.ok) {
      throw new Error("The original map image could not be uploaded to private storage.");
    }
    await requireJson(await fetch(`/api/cloud/assets/${assetId}/complete`, { method: "POST" }));
  }

  const syncResponse = await fetch("/api/cloud/maps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mapId: map.id,
      assetId,
      metadata: map.metadata,
      anchors: map.anchors,
      targetZoom: map.targetZoom,
      basemapMode: map.basemapMode,
      clientUpdatedAt: map.updatedAt,
      contentFingerprint,
      baseRevisionId,
    }),
  });
  const syncBody = await syncResponse.json() as CloudSyncResult & { error?: string };
  if (!syncResponse.ok && syncResponse.status !== 409) {
    throw new Error(syncBody.error ?? `Cloud map sync failed (${syncResponse.status}).`);
  }
  if (
    syncBody.status !== "synced" && syncBody.status !== "unchanged" &&
    syncBody.status !== "conflict"
  ) {
    throw new Error("The cloud map sync response was invalid.");
  }

  if (syncBody.status !== "conflict") {
    await writeCloudSyncState({
      mapId: map.id,
      userId,
      remoteRevisionId: syncBody.currentRevisionId,
      contentFingerprint,
      syncedAt: Date.now(),
    });
  }
  return syncBody;
}

export async function downloadCloudMapToDevice(summary: CloudMapSummary, userId: string) {
  const detailResponse = await fetch(`/api/cloud/maps/${summary.id}`, { cache: "no-store" });
  const cloudMap = parseCloudMapDownload(await requireJson(detailResponse));
  const imageResponse = await fetch(`/api/cloud/assets/${cloudMap.assetId}`, { cache: "no-store" });
  if (!imageResponse.ok) {
    throw new Error(await responseError(imageResponse));
  }
  const imageBlob = await imageResponse.blob();
  if (await sha256Hex(imageBlob) !== cloudMap.assetSha256) {
    throw new Error("The downloaded image did not match its cloud checksum.");
  }

  const localMap: LocalSavedMap = {
    id: cloudMap.id,
    version: 1,
    createdAt: cloudMap.createdAt,
    updatedAt: cloudMap.clientUpdatedAt,
    metadata: cloudMap.metadata,
    imageName: cloudMap.imageName,
    imageBlob,
    imageDimensions: cloudMap.imageDimensions,
    anchors: cloudMap.anchors,
    targetZoom: cloudMap.targetZoom,
    basemapMode: cloudMap.basemapMode,
  };
  const stored = await storeDownloadedCloudMap(localMap);
  if (stored.added) {
    await writeCloudSyncState({
      mapId: localMap.id,
      userId,
      remoteRevisionId: cloudMap.currentRevisionId,
      contentFingerprint: await createCloudContentFingerprint(localMap, cloudMap.assetSha256),
      syncedAt: Date.now(),
    });
  }
  return stored;
}
