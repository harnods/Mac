const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mac-nu-vert.vercel.app";

export async function GET() {
  return Response.json({
    issuer: BASE,
    authorization_endpoint: `${BASE}/mcp/authorize`,
    token_endpoint: `${BASE}/api/mcp/token`,
    registration_endpoint: `${BASE}/api/mcp/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["read", "write"],
  });
}
