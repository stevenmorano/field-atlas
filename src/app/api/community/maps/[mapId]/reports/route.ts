import { parseReportRequest } from "@/features/community/community-contract";
import { cloudErrorResponse, CloudApiError } from "@/lib/cloud/cloud-api";
import { createAnonymousDailyToken, hashShareToken } from "@/lib/community/community-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Context = Readonly<{ params: Promise<{ mapId: string }> }>;

export async function POST(request: Request, context: Context) {
  try {
    const { mapId } = await context.params;
    const input = parseReportRequest(await request.json());
    if (input.website) return Response.json({ success: true });
    const supabase = await createServerSupabaseClient();
    if (!supabase) throw new CloudApiError("Community reports are not configured yet.", 503);
    const { data, error } = await supabase.rpc("submit_map_report", {
      p_publication_id: input.publicationId,
      p_category: input.category,
      p_note: input.note,
      p_anonymous_daily_token: createAnonymousDailyToken(request),
      p_share_token_hash: hashShareToken(input.shareToken),
    });
    if (error) throw new CloudApiError(error.message || "Report could not be submitted.", 429);
    return Response.json({ success: true, reportId: data, mapId });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
