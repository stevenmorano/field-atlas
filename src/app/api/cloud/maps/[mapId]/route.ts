import { cloudErrorResponse, CloudApiError } from "@/lib/cloud/cloud-api";
import { readCloudMapData } from "@/lib/cloud/cloud-map-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = Readonly<{ params: Promise<{ mapId: string }> }>;

export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      throw new CloudApiError("Cloud accounts are not configured yet.", 503);
    }
    const { mapId } = await context.params;
    return Response.json(await readCloudMapData(supabase, mapId));
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
