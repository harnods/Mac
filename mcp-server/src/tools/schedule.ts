import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb, paginate } from "../db.js";

export function registerScheduleTools(server: McpServer) {
  server.tool(
    "list_schedules",
    "List crew schedules / roster for a date range.",
    {
      date_from: z.string().describe("YYYY-MM-DD"),
      date_to: z.string().describe("YYYY-MM-DD"),
      employee_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ date_from, date_to, employee_id, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb()
        .from("schedules")
        .select("id, employee_id, shift_id, work_date, day_off, employees(id,name), shifts(id,name,start_time,end_time)")
        .gte("work_date", date_from)
        .lte("work_date", date_to)
        .order("work_date")
        .range(from, to);

      if (employee_id) q = q.eq("employee_id", employee_id);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "set_schedule",
    "Set or update a crew member's schedule for a specific date.",
    {
      employee_id: z.string().uuid(),
      work_date: z.string().describe("YYYY-MM-DD"),
      shift_id: z.string().uuid().nullable().describe("Shift ID, or null for day off"),
      day_off: z.boolean().optional().default(false),
    },
    async ({ employee_id, work_date, shift_id, day_off }) => {
      const { data: existing } = await getDb()
        .from("schedules")
        .select("id")
        .eq("employee_id", employee_id)
        .eq("work_date", work_date)
        .maybeSingle();

      if (existing) {
        const { data, error } = await getDb()
          .from("schedules")
          .update({ shift_id, day_off })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
        return { content: [{ type: "text" as const, text: `Updated:\n${JSON.stringify(data, null, 2)}` }] };
      }

      const { data, error } = await getDb()
        .from("schedules")
        .insert({ employee_id, work_date, shift_id, day_off })
        .select()
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_roster_patterns",
    "List roster patterns (recurring schedule templates).",
    {},
    async () => {
      const { data, error } = await getDb()
        .from("roster_patterns")
        .select("*")
        .order("name");
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_tables",
    "List restaurant tables (for dine-in orders).",
    {},
    async () => {
      const { data, error } = await getDb()
        .from("tables")
        .select("*")
        .order("name");
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
