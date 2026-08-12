import type { SupabaseClient } from "@supabase/supabase-js";

import { CloudApiError } from "@/lib/cloud/cloud-api";

type MapRow = Readonly<{
  id: string;
  publication_status: string;
  current_revision_id: string | null;
  created_at: string;
  updated_at: string;
}>;

type RevisionRow = Readonly<{
  id: string;
  map_id: string;
  asset_id: string;
  metadata: unknown;
  anchors: unknown;
  target_zoom: number;
  basemap_mode: string;
  client_updated_at: string;
}>;

type AssetRow = Readonly<{
  id: string;
  original_file_name: string;
  sha256: string;
  width: number;
  height: number;
}>;

function timestamp(value: string, label: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new CloudApiError(`${label} is invalid.`, 502);
  }
  return parsed;
}

function buildCloudMap(map: MapRow, revision: RevisionRow, asset: AssetRow, includeAnchors: boolean) {
  const anchors = Array.isArray(revision.anchors) ? revision.anchors : [];
  return {
    id: map.id,
    metadata: revision.metadata,
    publicationStatus: map.publication_status,
    currentRevisionId: revision.id,
    assetId: asset.id,
    assetSha256: asset.sha256,
    imageName: asset.original_file_name,
    imageDimensions: { width: asset.width, height: asset.height },
    anchorCount: anchors.length,
    ...(includeAnchors ? {
      anchors,
      targetZoom: revision.target_zoom,
      basemapMode: revision.basemap_mode,
      createdAt: timestamp(map.created_at, "Created time"),
    } : {}),
    clientUpdatedAt: timestamp(revision.client_updated_at, "Client update time"),
    updatedAt: timestamp(map.updated_at, "Updated time"),
  };
}

export async function listCloudMapData(supabase: SupabaseClient, ownerId: string) {
  const { data: rawMaps, error: mapsError } = await supabase
    .from("maps")
    .select("id, publication_status, current_revision_id, created_at, updated_at")
    .eq("owner_id", ownerId)
    .not("current_revision_id", "is", null)
    .order("updated_at", { ascending: false });
  if (mapsError) {
    throw new CloudApiError("Cloud maps could not be listed. Apply the database migration and try again.", 502);
  }
  const maps = (rawMaps ?? []) as MapRow[];
  const revisionIds = maps.flatMap((map) => map.current_revision_id ? [map.current_revision_id] : []);
  if (revisionIds.length === 0) {
    return [];
  }

  const { data: rawRevisions, error: revisionsError } = await supabase
    .from("map_revisions")
    .select("id, map_id, asset_id, metadata, anchors, target_zoom, basemap_mode, client_updated_at")
    .in("id", revisionIds);
  if (revisionsError) {
    throw new CloudApiError("Cloud map revisions could not be listed.", 502);
  }
  const revisions = (rawRevisions ?? []) as RevisionRow[];
  const assetIds = revisions.map((revision) => revision.asset_id);
  const { data: rawAssets, error: assetsError } = await supabase
    .from("map_assets")
    .select("id, original_file_name, sha256, width, height")
    .in("id", assetIds);
  if (assetsError) {
    throw new CloudApiError("Cloud map images could not be listed.", 502);
  }
  const revisionById = new Map(revisions.map((revision) => [revision.id, revision]));
  const assetById = new Map(((rawAssets ?? []) as AssetRow[]).map((asset) => [asset.id, asset]));

  return maps.flatMap((map) => {
    const revision = map.current_revision_id ? revisionById.get(map.current_revision_id) : undefined;
    const asset = revision ? assetById.get(revision.asset_id) : undefined;
    return revision && asset ? [buildCloudMap(map, revision, asset, false)] : [];
  });
}

export async function readCloudMapData(supabase: SupabaseClient, mapId: string) {
  const { data: rawMap, error: mapError } = await supabase
    .from("maps")
    .select("id, publication_status, current_revision_id, created_at, updated_at")
    .eq("id", mapId)
    .maybeSingle();
  if (mapError) {
    throw new CloudApiError("Cloud map could not be opened.", 502);
  }
  const map = rawMap as MapRow | null;
  if (!map?.current_revision_id) {
    throw new CloudApiError("Cloud map was not found.", 404);
  }

  const { data: rawRevision, error: revisionError } = await supabase
    .from("map_revisions")
    .select("id, map_id, asset_id, metadata, anchors, target_zoom, basemap_mode, client_updated_at")
    .eq("id", map.current_revision_id)
    .maybeSingle();
  if (revisionError || !rawRevision) {
    throw new CloudApiError("Cloud map revision was not found.", 404);
  }
  const revision = rawRevision as RevisionRow;

  const { data: rawAsset, error: assetError } = await supabase
    .from("map_assets")
    .select("id, original_file_name, sha256, width, height")
    .eq("id", revision.asset_id)
    .eq("status", "ready")
    .maybeSingle();
  if (assetError || !rawAsset) {
    throw new CloudApiError("Cloud map image was not found.", 404);
  }

  return buildCloudMap(map, revision, rawAsset as AssetRow, true);
}
