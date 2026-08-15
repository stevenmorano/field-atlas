import { cloudErrorResponse, CloudApiError } from "@/lib/cloud/cloud-api";
import { listPublicMapData } from "@/lib/community/community-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) throw new CloudApiError("Community maps are not configured yet.", 503);
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").slice(0, 200);
    const subject = url.searchParams.get("subject")?.slice(0, 200) || null;
    const before = url.searchParams.get("before");
    return Response.json(await listPublicMapData(supabase, { query, subject, before }), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
