import crypto from "crypto";

export async function POST(req: Request) {
  const body = await req.json();

  const clientId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  return Response.json(
    {
      client_id: clientId,
      client_name: body.client_name ?? "MCP Client",
      redirect_uris: body.redirect_uris ?? [],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: now,
    },
    { status: 201 }
  );
}
