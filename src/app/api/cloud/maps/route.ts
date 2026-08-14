import {
  parseCloudMapSyncRequest,
  type CloudSyncResult,
} from "@/features/cloud/cloud-map-contract";
import { decideCloudSave } from "@/features/cloud/cloud-save-guard";
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
    const { supabase, user } = await requireCloudUser();

    // Keep the client cooldown honest on the server as well. A matching current
    // fingerprint is always an idempotent no-op; a different payload must wait
    // before it can create another immutable revision for this map.
    const { data: currentMap, error: currentMapError } = await supabase
      .from("maps")
      .select("current_revision_id")
      .eq("id", input.mapId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (currentMapError) {
      throw new CloudApiError("The current cloud map could not be checked.", 502);
    }

    if (currentMap?.current_revision_id) {
      const { data: currentRevision, error: currentRevisionError } = await supabase
        .from("map_revisions")
        .select("id, revision_number, content_fingerprint, created_at")
        .eq("id", currentMap.current_revision_id)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (currentRevisionError || !currentRevision) {
        throw new CloudApiError("The current cloud revision could not be checked.", 502);
      }

      const decision = decideCloudSave({
        id: String(currentRevision.id),
        revisionNumber: Number(currentRevision.revision_number),
        contentFingerprint: String(currentRevision.content_fingerprint),
        createdAt: Date.parse(String(currentRevision.created_at)),
      }, input.contentFingerprint);

      if (decision.status === "unchanged") {
        return Response.json({
          status: "unchanged",
          mapId: input.mapId,
          revisionId: decision.revision.id,
          currentRevisionId: decision.revision.id,
          revisionNumber: decision.revision.revisionNumber,
        } satisfies CloudSyncResult);
      }

      if (decision.status === "rate-limited") {
        throw new CloudApiError("This map was just backed up. Wait 30 seconds before saving another cloud checkpoint.", 429);
      }
    }

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
