import { NextResponse } from "next/server";

import { cloudErrorResponse, CloudApiError, firstRpcRow } from "@/lib/cloud/cloud-api";
import { createR2DownloadUrl } from "@/lib/cloud/r2";
import { hashShareToken } from "@/lib/community/community-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Context = Readonly<{ params: Promise<{ assetId: string }> }>;

export async function GET(request: Request, context: Context) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) throw new CloudApiError("Community maps are not configured yet.", 503);
    const { assetId } = await context.params;
    const url = new URL(request.url);
    const variant = url.searchParams.get("variant") === "thumbnail" ? "thumbnail" : "map";
    const shareToken = url.searchParams.get("share");
    const { data, error } = await supabase.rpc("get_public_asset_delivery", {
      p_public_asset_id: assetId,
      p_variant: variant,
      p_share_token_hash: hashShareToken(shareToken),
    });
    if (error || !Array.isArray(data) || data.length === 0) {
      throw new CloudApiError("Public map image was not found.", 404);
    }
    const row = firstRpcRow(data);
    const signedUrl = await createR2DownloadUrl(String(row.object_key ?? ""), String(row.mime_type ?? "image/webp"));
    const response = NextResponse.redirect(signedUrl, 307);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
