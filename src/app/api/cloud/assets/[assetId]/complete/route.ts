import { cloudErrorResponse, CloudApiError, requireCloudUser } from "@/lib/cloud/cloud-api";
import { readR2ObjectMetadata } from "@/lib/cloud/r2";

type RouteContext = Readonly<{ params: Promise<{ assetId: string }> }>;

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    const { supabase, user } = await requireCloudUser();
    const { data: asset, error } = await supabase
      .from("map_assets")
      .select("id, object_key, byte_size, mime_type, status")
      .eq("id", assetId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error || !asset) {
      throw new CloudApiError("Cloud image record was not found.", 404);
    }
    if (asset.status === "ready") {
      return Response.json({ assetId, ready: true });
    }

    const object = await readR2ObjectMetadata(asset.object_key);
    if (object.ContentLength !== asset.byte_size || object.ContentType !== asset.mime_type) {
      throw new CloudApiError("The uploaded image did not match its signed file details.", 409);
    }

    const { error: completeError } = await supabase.rpc("complete_map_asset", { p_asset_id: assetId });
    if (completeError) {
      throw new CloudApiError("The uploaded image could not be finalized.", 502);
    }
    return Response.json({ assetId, ready: true });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
