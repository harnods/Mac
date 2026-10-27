import {
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMachitoriServer } from "@/lib/mcp/server";

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function checkAuth(req: Request): boolean {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${apiKey}`;
}

async function handleMcp(req: Request): Promise<Response> {
  if (!checkAuth(req)) return unauthorized();

  const server = createMachitoriServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    return await transport.handleRequest(req);
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

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
    },
  });
}
