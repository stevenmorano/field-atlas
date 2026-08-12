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
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.publicationId !== "string" || typeof body.action !== "string" || typeof body.reason !== "string" || body.reason.length > 2000) {
      throw new CloudApiError("Moderation action is invalid.", 400);
    }
    const { supabase } = await requireCloudUser();
    const { error } = await supabase.rpc("moderate_publication", {
      p_publication_id: body.publicationId,
      p_action: body.action,
      p_reason: body.reason,
    });
    if (error) throw new CloudApiError(error.message || "Moderation action failed.", 403);
    return Response.json({ success: true });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
