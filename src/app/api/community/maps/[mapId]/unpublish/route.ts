import { cloudErrorResponse, CloudApiError, requireCloudUser } from "@/lib/cloud/cloud-api";
import { readOwnerPublicationStatus } from "@/lib/community/community-server";

type Context = Readonly<{ params: Promise<{ mapId: string }> }>;

export async function POST(request: Request, context: Context) {
  try {
    const body = await request.json() as { expectedPublicationId?: unknown };
    if (typeof body.expectedPublicationId !== "string") throw new CloudApiError("Publication ID is invalid.", 400);
    const { mapId } = await context.params;
    const { supabase, user } = await requireCloudUser();
    const status = await readOwnerPublicationStatus(supabase, mapId, user.id);
    if (status.publicationHold) {
      throw new CloudApiError(
        status.publicationHoldReason || "This map is on a moderation hold and cannot be made private until an administrator restores it.",
        403,
      );
    }
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
