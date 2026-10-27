import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "http";

import { registerEmployeeTools } from "./tools/employees.js";
import { registerAttendanceTools } from "./tools/attendance.js";
import { registerOrderTools } from "./tools/orders.js";
import { registerMenuStockTools } from "./tools/menu-stock.js";
import { registerPayrollTools } from "./tools/payroll.js";
import { registerRecruitmentTools } from "./tools/recruitment.js";
import { registerScheduleTools } from "./tools/schedule.js";

const server = new McpServer({
  name: "machitori",
  version: "1.0.0",
});

registerEmployeeTools(server);
registerAttendanceTools(server);
registerOrderTools(server);
registerMenuStockTools(server);
registerPayrollTools(server);
registerRecruitmentTools(server);
registerScheduleTools(server);

const transport = process.argv.includes("--sse")
  ? "sse"
  : process.argv.includes("--stdio")
    ? "stdio"
    : "stdio";

function checkAuth(req: import("http").IncomingMessage, res: import("http").ServerResponse): boolean {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) return true;

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${apiKey}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return false;
  }
  return true;
}

if (transport === "sse") {
  const PORT = parseInt(process.env.MCP_PORT ?? "3100", 10);
  const sessions = new Map<string, SSEServerTransport>();

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === "/sse" && req.method === "GET") {
      if (!checkAuth(req, res)) return;
      const sseTransport = new SSEServerTransport("/messages", res);
      sessions.set(sseTransport.sessionId, sseTransport);

      res.on("close", () => {
        sessions.delete(sseTransport.sessionId);
      });

      await server.connect(sseTransport);
      return;
    }

    if (url.pathname === "/messages" && req.method === "POST") {
      if (!checkAuth(req, res)) return;
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId || !sessions.has(sessionId)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid or missing sessionId" }));
        return;
      }

      const body: Buffer[] = [];
      req.on("data", (chunk) => body.push(chunk));
      req.on("end", async () => {
        try {
          await sessions.get(sessionId)!.handlePostMessage(
            req,
            res,
            Buffer.concat(body).toString()
          );
        } catch (e: any) {
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        }
      });
      return;
    }

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", sessions: sessions.size }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  httpServer.listen(PORT, () => {
    console.error(`Machitori MCP server (SSE) listening on http://localhost:${PORT}`);
    console.error(`  SSE endpoint: http://localhost:${PORT}/sse`);
    console.error(`  Health:       http://localhost:${PORT}/health`);
  });
} else {
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
  console.error("Machitori MCP server running on stdio");
}
