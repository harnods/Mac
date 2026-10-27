import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb, paginate } from "../db.js";

export function registerAttendanceTools(server: McpServer) {
  server.tool(
    "list_attendance",
    "List attendance records with filters. Returns clock_in, clock_out, break_minutes, employee name, shift.",
    {
      date: z.string().optional().describe("Filter by work_date (YYYY-MM-DD)"),
      date_from: z.string().optional().describe("Start of date range (YYYY-MM-DD)"),
      date_to: z.string().optional().describe("End of date range (YYYY-MM-DD)"),
      employee_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ date, date_from, date_to, employee_id, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb()
        .from("attendance")
        .select(
          "id, employee_id, shift_id, work_date, clock_in, clock_out, break_minutes, breaks, note, source, employees(id,name), shifts(id,name,start_time,end_time)"
        )
        .order("work_date", { ascending: false })
        .range(from, to);

      if (date) q = q.eq("work_date", date);
      if (date_from) q = q.gte("work_date", date_from);
      if (date_to) q = q.lte("work_date", date_to);
      if (employee_id) q = q.eq("employee_id", employee_id);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "clock_in",
    "Record a clock-in for an employee on a given date.",
    {
      employee_id: z.string().uuid(),
      work_date: z.string().describe("YYYY-MM-DD"),
      clock_in: z.string().describe("HH:MM or HH:MM:SS"),
      shift_id: z.string().uuid().optional(),
      note: z.string().optional(),
      source: z.enum(["web", "mobile"]).optional().default("web"),
    },
    async ({ employee_id, work_date, clock_in, shift_id, note, source }) => {
      const { data: existing } = await getDb()
        .from("attendance")
        .select("id")
        .eq("employee_id", employee_id)
        .eq("work_date", work_date)
        .maybeSingle();

      if (existing) {
        const { data, error } = await getDb()
          .from("attendance")
          .update({ clock_in, shift_id, note, source })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
        return { content: [{ type: "text" as const, text: `Updated existing record:\n${JSON.stringify(data, null, 2)}` }] };
      }

      const { data, error } = await getDb()
        .from("attendance")
        .insert({ employee_id, work_date, clock_in, shift_id, note, source })
        .select()
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "clock_out",
    "Record a clock-out for an employee on a given date.",
    {
      employee_id: z.string().uuid(),
      work_date: z.string().describe("YYYY-MM-DD"),
      clock_out: z.string().describe("HH:MM or HH:MM:SS"),
      break_minutes: z.number().int().optional(),
      note: z.string().optional(),
    },
    async ({ employee_id, work_date, clock_out, break_minutes, note }) => {
      const updates: Record<string, unknown> = { clock_out };
      if (break_minutes !== undefined) updates.break_minutes = break_minutes;
      if (note !== undefined) updates.note = note;

      const { data, error } = await getDb()
        .from("attendance")
        .update(updates)
        .eq("employee_id", employee_id)
        .eq("work_date", work_date)
        .select()
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_attendance_summary",
    "Get attendance summary for a date range. Returns per-employee counts: present, absent, late, etc.",
    {
      date_from: z.string().describe("YYYY-MM-DD"),
      date_to: z.string().describe("YYYY-MM-DD"),
      employee_id: z.string().uuid().optional(),
    },
    async ({ date_from, date_to, employee_id }) => {
      let q = getDb()
        .from("attendance")
        .select("employee_id, work_date, clock_in, clock_out, break_minutes, employees(id,name), shifts(start_time)")
        .gte("work_date", date_from)
        .lte("work_date", date_to);

      if (employee_id) q = q.eq("employee_id", employee_id);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const summary: Record<string, { name: string; present: number; no_clock_in: number; no_clock_out: number; total_records: number }> = {};

      for (const row of data ?? []) {
        const eid = row.employee_id;
        if (!summary[eid]) {
          summary[eid] = {
            name: (row.employees as any)?.name ?? "Unknown",
            present: 0,
            no_clock_in: 0,
            no_clock_out: 0,
            total_records: 0,
          };
        }
        summary[eid].total_records++;
        if (row.clock_in && row.clock_out) summary[eid].present++;
        if (!row.clock_in) summary[eid].no_clock_in++;
        if (!row.clock_out) summary[eid].no_clock_out++;
      }

      return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
    }
  );

  server.tool(
    "get_attendance_settings",
    "Get current attendance settings (grace minutes, geofence, working days, etc).",
    {},
    async () => {
      const { data, error } = await getDb()
        .from("attendance_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_overtime_requests",
    "List overtime requests with filters.",
    {
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      employee_id: z.string().uuid().optional(),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ status, employee_id, date_from, date_to, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb()
        .from("overtime_requests")
        .select("*, employees(id,name)")
        .order("work_date", { ascending: false })
        .range(from, to);

      if (status) q = q.eq("status", status);
      if (employee_id) q = q.eq("employee_id", employee_id);
      if (date_from) q = q.gte("work_date", date_from);
      if (date_to) q = q.lte("work_date", date_to);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
