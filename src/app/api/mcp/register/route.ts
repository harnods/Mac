import crypto from "crypto";
import { isAllowedRedirectUri } from "@/lib/mcp/oauth";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const redirectUris: string[] = Array.isArray(body.redirect_uris)
    ? body.redirect_uris
    : [];

  for (const uri of redirectUris) {
    if (typeof uri !== "string" || !isAllowedRedirectUri(uri)) {
      return Response.json(
        { error: `Disallowed redirect_uri: ${uri}` },
        { status: 400 },
      );
    }
  }

  const clientId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  return Response.json(
    {
      client_id: clientId,
      client_name: body.client_name ?? "MCP Client",
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: now,
    },
    { status: 201 },
  );
}
