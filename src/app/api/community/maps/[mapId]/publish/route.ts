import { parsePublishMapRequest } from "@/features/community/community-contract";
import { cloudErrorResponse, requireCloudUser } from "@/lib/cloud/cloud-api";
import { publishOwnerMap } from "@/lib/community/community-server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Context = Readonly<{ params: Promise<{ mapId: string }> }>;

export async function POST(request: Request, context: Context) {
  try {
    const input = parsePublishMapRequest(await request.json());
    const { mapId } = await context.params;
    const { supabase, user } = await requireCloudUser();
    return Response.json(await publishOwnerMap(supabase, user.id, mapId, input));
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
