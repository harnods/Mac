import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb, paginate } from "../db.js";

export function registerPayrollTools(server: McpServer) {
  server.tool(
    "list_payroll_runs",
    "List payroll runs. Each run covers a pay period for all employees.",
    {
      status: z.enum(["draft", "finalized"]).optional(),
      year: z.number().int().optional(),
      month: z.number().int().min(1).max(12).optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ status, year, month, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb()
        .from("payroll_runs")
        .select("*")
        .order("anchor_year", { ascending: false })
        .order("anchor_month", { ascending: false })
        .range(from, to);

      if (status) q = q.eq("status", status);
      if (year) q = q.eq("anchor_year", year);
      if (month) q = q.eq("anchor_month", month);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_payroll_run",
    "Get a payroll run with all payslips and line items.",
    { id: z.string().uuid() },
    async ({ id }) => {
      const { data: run, error: runErr } = await getDb()
        .from("payroll_runs")
        .select("*")
        .eq("id", id)
        .single();
      if (runErr) return { content: [{ type: "text" as const, text: `Error: ${runErr.message}` }] };

      const { data: payslips, error: psErr } = await getDb()
        .from("payslips")
        .select("*, employees(id,name), payslip_lines(id, kind, label, detail, amount, sort)")
        .eq("run_id", id)
        .order("employees(name)");
      if (psErr) return { content: [{ type: "text" as const, text: `Error: ${psErr.message}` }] };

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ ...run, payslips }, null, 2) }],
      };
    }
  );

  server.tool(
    "get_payslip",
    "Get a single payslip with earnings/deductions breakdown.",
    { id: z.string().uuid() },
    async ({ id }) => {
      const { data, error } = await getDb()
        .from("payslips")
        .select("*, employees(id,name,department_id,departments(name)), payslip_lines(id, kind, label, detail, amount, sort)")
        .eq("id", id)
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_payroll_settings",
    "Get current payroll settings (cutoff dates, payday, deduction rules).",
    {},
    async () => {
      const { data, error } = await getDb()
        .from("payroll_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_allowances",
    "List payroll components (allowances and deductions).",
    {},
    async () => {
      const { data, error } = await getDb()
        .from("allowances")
        .select("id, name, type, is_default")
        .order("name");
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
