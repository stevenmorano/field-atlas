import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export class CloudApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CloudApiError";
  }
}

export async function requireCloudUser(): Promise<Readonly<{
  supabase: SupabaseClient;
  user: User;
}>> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    throw new CloudApiError("Cloud accounts are not configured yet.", 503);
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new CloudApiError("Sign in to use cloud maps.", 401);
  }

  return { supabase, user: data.user };
}

export function cloudErrorResponse(error: unknown) {
  if (error instanceof CloudApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof SyntaxError) {
    return Response.json({ error: "The request body is invalid." }, { status: 400 });
  }
  if (error instanceof Error && error.message) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return Response.json({ error: "Cloud request failed." }, { status: 500 });
}

export function firstRpcRow(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || typeof value[0] !== "object" || value[0] === null) {
    throw new CloudApiError("The cloud database returned an invalid response.", 502);
  }
  return value[0] as Record<string, unknown>;
}
