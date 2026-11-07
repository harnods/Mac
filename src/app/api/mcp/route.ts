import {
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createClient } from "@supabase/supabase-js";
import { createMachitoriServer } from "@/lib/mcp/server";
import { getDbForUser } from "@/lib/mcp/db";
import { getMcpCorsOrigin } from "@/lib/mcp/oauth";

function jsonResponse(body: object, status: number, req?: Request) {
  const origin = getMcpCorsOrigin(req?.headers.get("origin") ?? null);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function authenticate(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { error: "Missing Authorization header. Use: Bearer <supabase_access_token>" };
  }
  const token = auth.slice(7);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { error: "Server misconfigured" };
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Invalid or expired token" };
  }

  return { user: data.user, token };
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = getMcpCorsOrigin(req.headers.get("origin") ?? null);
  const headers: Record<string, string> = {};
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

async function handleMcp(req: Request): Promise<Response> {
  const auth = await authenticate(req);
  if ("error" in auth) return jsonResponse({ error: auth.error }, 401, req);

  const db = getDbForUser(auth.token);
  const server = createMachitoriServer(db);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    const response = await transport.handleRequest(req);
    const extra = corsHeaders(req);
    for (const [k, v] of Object.entries(extra)) {
      response.headers.set(k, v);
    }
    return response;
  } finally {
    await transport.close();
    await server.close();
  }
}

export async function GET(req: Request) {
  return handleMcp(req);
}

export async function POST(req: Request) {
  return handleMcp(req);
}

export async function DELETE(req: Request) {
  return handleMcp(req);
}

export async function OPTIONS(req: Request) {
  const origin = getMcpCorsOrigin(req.headers.get("origin") ?? null);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
    "Access-Control-Max-Age": "86400",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return new Response(null, { status: 204, headers });
}
