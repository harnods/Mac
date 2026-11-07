"use server";

import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { encryptAuthCode, isAllowedRedirectUri } from "@/lib/mcp/oauth";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

export async function mcpAuthorize(formData: FormData): Promise<{
  redirect_url?: string;
  error?: string;
}> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();

  if (!email || !password) return { error: "Email dan password wajib diisi" };
  if (!redirectUri) return { error: "Missing redirect_uri" };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitKey = `${ip}:${email}`;

  if (isRateLimited(rateLimitKey)) {
    return { error: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit." };
  }

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
