import { cloudErrorResponse, requireCloudUser } from "@/lib/cloud/cloud-api";
import { readOwnerPublicationStatus } from "@/lib/community/community-server";

type Context = Readonly<{ params: Promise<{ mapId: string }> }>;

export async function GET(_request: Request, context: Context) {
  try {
    const { mapId } = await context.params;
    const { supabase, user } = await requireCloudUser();
    return Response.json(await readOwnerPublicationStatus(supabase, mapId, user.id));
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
