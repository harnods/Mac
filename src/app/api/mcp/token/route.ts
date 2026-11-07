import { createClient } from "@supabase/supabase-js";
import { decryptAuthCode } from "@/lib/mcp/oauth";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const grantType = params.get("grant_type");

    if (grantType === "authorization_code") {
      return handleAuthorizationCode(params);
    }

    if (grantType === "refresh_token") {
      return handleRefreshToken(params.get("refresh_token"));
    }

    return jsonError("unsupported_grant_type", 400);
  } catch (e: any) {
    return jsonError(e.message, 500);
  }
}

async function handleAuthorizationCode(params: URLSearchParams) {
  const code = params.get("code");
  const redirectUri = params.get("redirect_uri");
  const clientId = params.get("client_id");

  if (!code) return jsonError("Missing code", 400);
  if (!redirectUri) return jsonError("Missing redirect_uri", 400);
  if (!clientId) return jsonError("Missing client_id", 400);

  const payload = decryptAuthCode(code, redirectUri, clientId);

  return Response.json({
    access_token: payload.access_token,
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: payload.refresh_token,
  });
}

async function handleRefreshToken(refreshToken: string | null) {
  if (!refreshToken) return jsonError("Missing refresh_token", 400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return jsonError("Server misconfigured", 500);

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    return jsonError("Invalid or expired refresh token", 401);
  }

  return Response.json({
    access_token: data.session.access_token,
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: data.session.refresh_token,
  });
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
