import { NextResponse } from "next/server";

import { cloudErrorResponse, CloudApiError } from "@/lib/cloud/cloud-api";
import { createR2DownloadUrl } from "@/lib/cloud/r2";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = Readonly<{ params: Promise<{ assetId: string }> }>;

export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      throw new CloudApiError("Cloud accounts are not configured yet.", 503);
    }
    const { assetId } = await context.params;
    const { data: asset, error } = await supabase
      .from("map_assets")
      .select("object_key, mime_type, status")
      .eq("id", assetId)
      .eq("status", "ready")
      .maybeSingle();
    if (error || !asset) {
      throw new CloudApiError("Cloud image was not found or is private.", 404);
    }

    const signedUrl = await createR2DownloadUrl(asset.object_key, asset.mime_type);
    const response = NextResponse.redirect(signedUrl, 307);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
