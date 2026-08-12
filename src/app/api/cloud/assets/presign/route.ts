import { parseCloudAssetUploadRequest } from "@/features/cloud/cloud-map-contract";
import { cloudErrorResponse, CloudApiError, firstRpcRow, requireCloudUser } from "@/lib/cloud/cloud-api";
import { createR2ObjectKey, createR2UploadUrl } from "@/lib/cloud/r2";

export async function POST(request: Request) {
  try {
    const input = parseCloudAssetUploadRequest(await request.json());
    const { supabase, user } = await requireCloudUser();
    const proposedAssetId = crypto.randomUUID();
    const proposedObjectKey = createR2ObjectKey(user.id, proposedAssetId, input.fileName);
    const { data, error } = await supabase.rpc("prepare_map_asset", {
      p_asset_id: proposedAssetId,
      p_object_key: proposedObjectKey,
      p_original_file_name: input.fileName,
      p_mime_type: input.mimeType,
      p_byte_size: input.byteSize,
      p_sha256: input.sha256,
      p_width: input.width,
      p_height: input.height,
    });
    if (error) {
      throw new CloudApiError("The cloud image record could not be prepared.", 502);
    }
    const row = firstRpcRow(data);
    const assetId = String(row.asset_id ?? "");
    const objectKey = String(row.object_key ?? "");
    const needsUpload = row.needs_upload === true;
    const uploadUrl = needsUpload ? await createR2UploadUrl(objectKey, input.mimeType) : null;
    return Response.json({ assetId, needsUpload, uploadUrl, mimeType: input.mimeType });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
