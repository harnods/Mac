import { createClient } from "@supabase/supabase-js";
import { encryptAuthCode, isAllowedRedirectUri } from "@/lib/mcp/oauth";

export async function POST(req: Request) {
  try {
    const { access_token, refresh_token, user_id, redirect_uri, state, client_id } =
      await req.json();

    if (!access_token || !refresh_token || !user_id || !redirect_uri) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    if (!isAllowedRedirectUri(redirect_uri)) {
      return Response.json({ error: "Unauthorized redirect_uri" }, { status: 403 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return Response.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await admin.auth.getUser(access_token);
    if (userErr || !userData.user) {
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }

    if (userData.user.id !== user_id) {
      return Response.json({ error: "Token/user mismatch" }, { status: 403 });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user_id)
      .single();

    if (profile?.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }

    const code = encryptAuthCode({
      access_token,
      refresh_token,
      user_id,
      redirect_uri,
      client_id: client_id || "unknown",
    });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if (state) redirectUrl.searchParams.set("state", state);

    return Response.json({ redirect_url: redirectUrl.toString() });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
