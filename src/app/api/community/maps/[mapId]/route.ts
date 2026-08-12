import { cloudErrorResponse, CloudApiError } from "@/lib/cloud/cloud-api";
import { readPublicMapData } from "@/lib/community/community-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Context = Readonly<{ params: Promise<{ mapId: string }> }>;

export async function GET(request: Request, context: Context) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) throw new CloudApiError("Community maps are not configured yet.", 503);
    const { mapId } = await context.params;
    const shareToken = new URL(request.url).searchParams.get("share");
    const response = Response.json(await readPublicMapData(supabase, mapId, shareToken));
    response.headers.set("Cache-Control", shareToken ? "private, no-store" : "public, max-age=60, stale-while-revalidate=300");
    return response;
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
