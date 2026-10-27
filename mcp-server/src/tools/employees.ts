import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb, paginate } from "../db.js";

export function registerEmployeeTools(server: McpServer) {
  server.tool(
    "list_employees",
    "List crew/employees with optional filters. Returns name, department, position, status, active flag.",
    {
      active: z.boolean().optional().describe("Filter by active status"),
      department_id: z.string().uuid().optional(),
      search: z.string().optional().describe("Search by name"),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ active, department_id, search, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb()
        .from("employees")
        .select(
          "id, name, email, phone, join_date, active, department_id, job_position_id, job_level_id, employment_status_id, basic_salary, salary_unit, departments(id,name), job_positions(id,name), job_levels(id,name), employment_statuses(id,name)"
        )
        .is("deleted_at", null)
        .order("name")
        .range(from, to);

      if (active !== undefined) q = q.eq("active", active);
      if (department_id) q = q.eq("department_id", department_id);
      if (search) q = q.ilike("name", `%${search}%`);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_employee",
    "Get full details of a single employee by ID.",
    { id: z.string().uuid() },
    async ({ id }) => {
      const { data, error } = await getDb()
        .from("employees")
        .select(
          "*, departments(id,name), job_positions(id,name), job_levels(id,name), employment_statuses(id,name)"
        )
        .eq("id", id)
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_employee",
    "Create a new crew member. Required: name. Optional: email, phone, join_date, department_id, job_position_id, basic_salary, etc.",
    {
      name: z.string(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      birthdate: z.string().optional().describe("YYYY-MM-DD"),
      join_date: z.string().optional().describe("YYYY-MM-DD"),
      gender: z.enum(["male", "female"]).optional(),
      marital_status: z.enum(["single", "married", "divorced", "widowed"]).optional(),
      address: z.string().optional(),
      nik: z.string().optional().describe("Employee ID number"),
      department_id: z.string().uuid().optional(),
      job_position_id: z.string().uuid().optional(),
      job_level_id: z.string().uuid().optional(),
      employment_status_id: z.string().uuid().optional(),
      basic_salary: z.number().optional(),
      salary_unit: z.enum(["day", "month"]).optional(),
      bank_name: z.string().optional(),
      bank_account_no: z.string().optional(),
      account_holder_name: z.string().optional(),
    },
    async (params) => {
      const { data, error } = await getDb().from("employees").insert(params).select().single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_employee",
    "Update an existing employee's details.",
    {
      id: z.string().uuid(),
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      birthdate: z.string().optional(),
      join_date: z.string().optional(),
      termination_date: z.string().nullable().optional(),
      last_day: z.string().nullable().optional(),
      active: z.boolean().optional(),
      gender: z.enum(["male", "female"]).optional(),
      marital_status: z.enum(["single", "married", "divorced", "widowed"]).optional(),
      address: z.string().optional(),
      nik: z.string().optional(),
      department_id: z.string().uuid().nullable().optional(),
      job_position_id: z.string().uuid().nullable().optional(),
      job_level_id: z.string().uuid().nullable().optional(),
      employment_status_id: z.string().uuid().nullable().optional(),
      basic_salary: z.number().nullable().optional(),
      salary_unit: z.enum(["day", "month"]).nullable().optional(),
      bank_name: z.string().nullable().optional(),
      bank_account_no: z.string().nullable().optional(),
      account_holder_name: z.string().nullable().optional(),
    },
    async ({ id, ...updates }) => {
      const { data, error } = await getDb()
        .from("employees")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_departments",
    "List all departments.",
    {},
    async () => {
      const { data, error } = await getDb()
        .from("departments")
        .select("id, name")
        .order("name");
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_job_positions",
    "List all job positions.",
    {},
    async () => {
      const { data, error } = await getDb()
        .from("job_positions")
        .select("id, name, department_id, departments(id,name)")
        .order("name");
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_shifts",
    "List all work shifts.",
    {},
    async () => {
      const { data, error } = await getDb()
        .from("shifts")
        .select("id, name, start_time, end_time, break_minutes, active")
        .order("name");
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
