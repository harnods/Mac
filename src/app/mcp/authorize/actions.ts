"use server";

import { createClient } from "@supabase/supabase-js";
import { encryptAuthCode, isAllowedRedirectUri } from "@/lib/mcp/oauth";

export async function mcpAuthorize(formData: FormData): Promise<{
  redirect_url?: string;
  error?: string;
}> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();

  if (!email || !password) return { error: "Email dan password wajib diisi" };
  if (!redirectUri) return { error: "Missing redirect_uri" };

  if (!isAllowedRedirectUri(redirectUri)) {
    return { error: "Unauthorized redirect_uri" };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    return { error: "Server misconfigured" };
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  const { data: auth, error: authErr } =
    await supabase.auth.signInWithPassword({ email, password });

  if (authErr || !auth.session) {
    return { error: "Email atau password salah" };
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Hanya admin yang bisa menghubungkan MCP" };
  }

  const code = encryptAuthCode({
    access_token: auth.session.access_token,
    refresh_token: auth.session.refresh_token,
    user_id: auth.user.id,
    redirect_uri: redirectUri,
    client_id: clientId || "unknown",
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);

  return { redirect_url: redirectUrl.toString() };
}
