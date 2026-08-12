import {
  parseCloudMapSyncRequest,
  type CloudSyncResult,
} from "@/features/cloud/cloud-map-contract";
import { cloudErrorResponse, CloudApiError, firstRpcRow, requireCloudUser } from "@/lib/cloud/cloud-api";
import { listCloudMapData } from "@/lib/cloud/cloud-map-data";

export async function GET() {
  try {
    const { supabase, user } = await requireCloudUser();
    return Response.json(await listCloudMapData(supabase, user.id));
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = parseCloudMapSyncRequest(await request.json());
    const { supabase } = await requireCloudUser();
    const { data, error } = await supabase.rpc("sync_map_revision", {
      p_map_id: input.mapId,
      p_asset_id: input.assetId,
      p_metadata: input.metadata,
      p_anchors: input.anchors,
      p_target_zoom: input.targetZoom,
      p_basemap_mode: input.basemapMode,
      p_client_updated_at: new Date(input.clientUpdatedAt).toISOString(),
      p_content_fingerprint: input.contentFingerprint,
      p_base_revision_id: input.baseRevisionId,
    });
    if (error) {
      throw new CloudApiError("The cloud map revision could not be saved.", 502);
    }
    const row = firstRpcRow(data);
    const result: CloudSyncResult = {
      status: row.sync_status as CloudSyncResult["status"],
      mapId: String(row.map_id ?? ""),
      revisionId: String(row.revision_id ?? ""),
      currentRevisionId: String(row.current_revision_id ?? ""),
      revisionNumber: Number(row.revision_number),
    };
    return Response.json(result, { status: result.status === "conflict" ? 409 : 200 });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
