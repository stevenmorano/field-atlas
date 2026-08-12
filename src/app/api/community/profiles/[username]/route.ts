import { cloudErrorResponse, CloudApiError } from "@/lib/cloud/cloud-api";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Context = Readonly<{ params: Promise<{ username: string }> }>;

export async function GET(_request: Request, context: Context) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) throw new CloudApiError("Community profiles are not configured yet.", 503);
    const { username } = await context.params;
    const { data, error } = await supabase.rpc("list_public_profile", { p_username: username });
    if (error) throw new CloudApiError("Profile could not be loaded.", 502);
    if (!data) throw new CloudApiError("Profile was not found.", 404);
    return Response.json(data);
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
