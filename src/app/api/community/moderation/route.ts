import { parseModerationRequest } from "@/features/community/community-contract";
import { cloudErrorResponse, CloudApiError, requireCloudUser } from "@/lib/cloud/cloud-api";

export async function GET() {
  try {
    const { supabase } = await requireCloudUser();
    const { data, error } = await supabase.rpc("list_moderation_queue", { p_limit: 50 });
    if (error) throw new CloudApiError("Moderation queue could not be loaded.", 502);
    if (data === null) throw new CloudApiError("Staff access is required.", 403);
    return Response.json(data);
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = parseModerationRequest(await request.json());
    const { supabase } = await requireCloudUser();
    const { error } = await supabase.rpc("moderate_publication", {
      p_publication_id: input.publicationId,
      p_action: input.action,
      p_reason: input.reason,
    });
    if (error) throw new CloudApiError(error.message || "Moderation action failed.", 403);
    return Response.json({ success: true });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
