import { cloudErrorResponse, CloudApiError, requireCloudUser } from "@/lib/cloud/cloud-api";

type Context = Readonly<{ params: Promise<{ mapId: string }> }>;

export async function POST(request: Request, context: Context) {
  try {
    const body = await request.json() as { expectedPublicationId?: unknown };
    if (typeof body.expectedPublicationId !== "string") throw new CloudApiError("Publication ID is invalid.", 400);
    const { mapId } = await context.params;
    const { supabase } = await requireCloudUser();
    const { error } = await supabase.rpc("unpublish_map", {
      p_map_id: mapId,
      p_expected_publication_id: body.expectedPublicationId,
    });
    if (error) throw new CloudApiError(error.message || "Map could not be made private.", 409);
    return Response.json({ success: true });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
