import { parseProfileUpdate } from "@/features/community/community-contract";
import { cloudErrorResponse, CloudApiError, firstRpcRow, requireCloudUser } from "@/lib/cloud/cloud-api";

export async function GET() {
  try {
    const { supabase, user } = await requireCloudUser();
    const [{ data: profile, error: profileError }, { data: role, error: roleError }] = await Promise.all([
      supabase.from("profiles").select("username, bio, avatar_seed").eq("user_id", user.id).maybeSingle(),
      supabase.from("site_roles").select("role").eq("user_id", user.id).maybeSingle(),
    ]);
    if (profileError) throw new CloudApiError("Profile needs the latest database migration.", 503);
    if (roleError) throw new CloudApiError("Account role could not be checked.", 502);
    if (!profile) throw new CloudApiError("Profile was not found.", 404);
    return Response.json({
      username: profile.username,
      bio: profile.bio,
      avatarSeed: profile.avatar_seed,
      role: role?.role ?? null,
    });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const input = parseProfileUpdate(await request.json());
    const { supabase } = await requireCloudUser();
    const { data, error } = await supabase.rpc("update_public_profile", {
      p_username: input.username,
      p_bio: input.bio,
    });
    if (error) throw new CloudApiError(error.message || "Profile could not be updated.", 409);
    return Response.json(firstRpcRow(data));
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
