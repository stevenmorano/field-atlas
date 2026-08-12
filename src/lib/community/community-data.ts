import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { CloudApiError } from "@/lib/cloud/cloud-api";
import { hashShareToken } from "@/lib/community/community-server";

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function listPublicMapData(
  supabase: SupabaseClient,
  options: Readonly<{ query: string; subject: string | null; before: string | null }>,
) {
  const { data, error } = await supabase.rpc("list_public_maps", {
    p_query: options.query,
    p_subject: options.subject,
    p_limit: 24,
    p_before: options.before,
  });
  if (error) throw new CloudApiError("Public maps could not be loaded.", 502);
  if (!Array.isArray(data)) throw new CloudApiError("Public map data was invalid.", 502);
  return data.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      mapId: String(item.map_id ?? ""),
      publicationId: String(item.publication_id ?? ""),
      publicAssetId: String(item.public_asset_id ?? ""),
      title: String(item.title ?? ""),
      description: String(item.description ?? ""),
      placeName: String(item.place_name ?? ""),
      subject: String(item.subject ?? ""),
      visualStyle: String(item.visual_style ?? ""),
      mapDateKind: String(item.map_date_kind ?? "unknown"),
      mapYear: nullableNumber(item.map_year),
      activities: Array.isArray(item.activities) ? item.activities.filter((entry): entry is string => typeof entry === "string") : [],
      anchorCount: Number(item.anchor_count ?? 0),
      publishedAt: String(item.published_at ?? ""),
      username: String(item.username ?? ""),
      adminChecked: item.admin_checked === true,
      coverage: {
        latitude: nullableNumber(item.coverage_center_lat),
        longitude: nullableNumber(item.coverage_center_lng),
        radiusMeters: nullableNumber(item.coverage_radius_m),
      },
    };
  });
}

export async function readPublicMapData(supabase: SupabaseClient, mapId: string, shareToken: string | null) {
  const { data, error } = await supabase.rpc("get_public_map", {
    p_map_id: mapId,
    p_share_token_hash: hashShareToken(shareToken),
  });
  if (error) throw new CloudApiError("Public map could not be opened.", 502);
  if (!data) throw new CloudApiError("Public map was not found or its link is no longer active.", 404);
  return data;
}
