import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb, paginate } from "./db";

function txt(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function json(data: unknown) {
  return txt(JSON.stringify(data, null, 2));
}

function err(e: { message: string }) {
  return txt(`Error: ${e.message}`);
}

export function createMachitoriServer() {
  const server = new McpServer({
    name: "machitori",
    version: "1.0.0",
  });

  // ── Employees ────────────────────────────────────────────────────────

  server.tool(
    "list_employees",
    "List crew/employees. Returns name, department, position, status, salary.",
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
        .select("id,name,email,phone,join_date,active,basic_salary,salary_unit,department_id,job_position_id,job_level_id,employment_status_id,departments(id,name),job_positions(id,name),job_levels(id,name),employment_statuses(id,name)")
        .is("deleted_at", null)
        .order("name")
        .range(from, to);
      if (active !== undefined) q = q.eq("active", active);
      if (department_id) q = q.eq("department_id", department_id);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      return error ? err(error) : json(data);
    }
  );

  server.tool(
    "get_employee",
    "Get full details of a single employee by ID.",
    { id: z.string().uuid() },
    async ({ id }) => {
      const { data, error } = await getDb()
        .from("employees")
        .select("*,departments(id,name),job_positions(id,name),job_levels(id,name),employment_statuses(id,name)")
        .eq("id", id)
        .single();
      return error ? err(error) : json(data);
    }
  );

  server.tool(
    "create_employee",
    "Create a new crew member.",
    {
      name: z.string(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      birthdate: z.string().optional().describe("YYYY-MM-DD"),
      join_date: z.string().optional().describe("YYYY-MM-DD"),
      gender: z.enum(["male", "female"]).optional(),
      marital_status: z.enum(["single", "married", "divorced", "widowed"]).optional(),
      address: z.string().optional(),
      nik: z.string().optional(),
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
      return error ? err(error) : json(data);
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
      active: z.boolean().optional(),
      gender: z.enum(["male", "female"]).optional(),
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
      const { data, error } = await getDb().from("employees").update(updates).eq("id", id).select().single();
      return error ? err(error) : json(data);
    }
  );

  server.tool("list_departments", "List all departments.", {}, async () => {
    const { data, error } = await getDb().from("departments").select("id,name").order("name");
    return error ? err(error) : json(data);
  });

  server.tool("list_job_positions", "List all job positions.", {}, async () => {
    const { data, error } = await getDb().from("job_positions").select("id,name,department_id,departments(id,name)").order("name");
    return error ? err(error) : json(data);
  });

  server.tool("list_shifts", "List all work shifts.", {}, async () => {
    const { data, error } = await getDb().from("shifts").select("id,name,start_time,end_time,break_minutes,active").order("name");
    return error ? err(error) : json(data);
  });

  // ── Attendance ───────────────────────────────────────────────────────

  server.tool(
    "list_attendance",
    "List attendance records with filters.",
    {
      date: z.string().optional().describe("YYYY-MM-DD"),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      employee_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ date, date_from, date_to, employee_id, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb()
        .from("attendance")
        .select("id,employee_id,shift_id,work_date,clock_in,clock_out,break_minutes,breaks,note,source,employees(id,name),shifts(id,name,start_time,end_time)")
        .order("work_date", { ascending: false })
        .range(from, to);
      if (date) q = q.eq("work_date", date);
      if (date_from) q = q.gte("work_date", date_from);
      if (date_to) q = q.lte("work_date", date_to);
      if (employee_id) q = q.eq("employee_id", employee_id);
      const { data, error } = await q;
      return error ? err(error) : json(data);
    }
  );

  server.tool(
    "clock_in",
    "Record a clock-in for an employee on a given date.",
    {
      employee_id: z.string().uuid(),
      work_date: z.string().describe("YYYY-MM-DD"),
      clock_in: z.string().describe("HH:MM"),
      shift_id: z.string().uuid().optional(),
      note: z.string().optional(),
      source: z.enum(["web", "mobile"]).optional().default("web"),
    },
    async ({ employee_id, work_date, clock_in, shift_id, note, source }) => {
      const { data: existing } = await getDb()
        .from("attendance").select("id").eq("employee_id", employee_id).eq("work_date", work_date).maybeSingle();
      if (existing) {
        const { data, error } = await getDb().from("attendance").update({ clock_in, shift_id, note, source }).eq("id", existing.id).select().single();
        return error ? err(error) : json(data);
      }
      const { data, error } = await getDb().from("attendance").insert({ employee_id, work_date, clock_in, shift_id, note, source }).select().single();
      return error ? err(error) : json(data);
    }
  );

  server.tool(
    "clock_out",
    "Record a clock-out for an employee on a given date.",
    {
      employee_id: z.string().uuid(),
      work_date: z.string().describe("YYYY-MM-DD"),
      clock_out: z.string().describe("HH:MM"),
      break_minutes: z.number().int().optional(),
      note: z.string().optional(),
    },
    async ({ employee_id, work_date, clock_out, break_minutes, note }) => {
      const updates: Record<string, unknown> = { clock_out };
      if (break_minutes !== undefined) updates.break_minutes = break_minutes;
      if (note !== undefined) updates.note = note;
      const { data, error } = await getDb().from("attendance").update(updates).eq("employee_id", employee_id).eq("work_date", work_date).select().single();
      return error ? err(error) : json(data);
    }
  );

  server.tool(
    "get_attendance_summary",
    "Get attendance summary for a date range — per-employee present/absent counts.",
    {
      date_from: z.string().describe("YYYY-MM-DD"),
      date_to: z.string().describe("YYYY-MM-DD"),
      employee_id: z.string().uuid().optional(),
    },
    async ({ date_from, date_to, employee_id }) => {
      let q = getDb()
        .from("attendance")
        .select("employee_id,work_date,clock_in,clock_out,employees(id,name)")
        .gte("work_date", date_from)
        .lte("work_date", date_to);
      if (employee_id) q = q.eq("employee_id", employee_id);
      const { data, error } = await q;
      if (error) return err(error);

      const summary: Record<string, { name: string; present: number; no_clock_in: number; no_clock_out: number; total: number }> = {};
      for (const r of data ?? []) {
        const eid = r.employee_id;
        if (!summary[eid]) summary[eid] = { name: (r.employees as any)?.name ?? "", present: 0, no_clock_in: 0, no_clock_out: 0, total: 0 };
        summary[eid].total++;
        if (r.clock_in && r.clock_out) summary[eid].present++;
        if (!r.clock_in) summary[eid].no_clock_in++;
        if (!r.clock_out) summary[eid].no_clock_out++;
      }
      return json(summary);
    }
  );

  server.tool("get_attendance_settings", "Get attendance settings (grace, geofence, etc).", {}, async () => {
    const { data, error } = await getDb().from("attendance_settings").select("*").limit(1).single();
    return error ? err(error) : json(data);
  });

  server.tool(
    "list_overtime_requests",
    "List overtime requests.",
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
      let q = getDb().from("overtime_requests").select("*,employees(id,name)").order("work_date", { ascending: false }).range(from, to);
      if (status) q = q.eq("status", status);
      if (employee_id) q = q.eq("employee_id", employee_id);
      if (date_from) q = q.gte("work_date", date_from);
      if (date_to) q = q.lte("work_date", date_to);
      const { data, error } = await q;
      return error ? err(error) : json(data);
    }
  );

  // ── Orders & Sales ──────────────────────────────────────────────────

  server.tool(
    "list_orders",
    "List orders with filters.",
    {
      date: z.string().optional(),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ date, date_from, date_to, status, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb().from("orders").select("*,order_items(id,item_id,name,qty,unit_price,subtotal,note)").order("created_at", { ascending: false }).range(from, to);
      if (date) q = q.eq("order_date", date);
      if (date_from) q = q.gte("order_date", date_from);
      if (date_to) q = q.lte("order_date", date_to);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      return error ? err(error) : json(data);
    }
  );

  server.tool("get_order", "Get full order details by ID.", { id: z.string().uuid() }, async ({ id }) => {
    const { data, error } = await getDb().from("orders").select("*,order_items(id,item_id,name,qty,unit_price,subtotal,note,addons)").eq("id", id).single();
    return error ? err(error) : json(data);
  });

  server.tool(
    "get_sales_summary",
    "Sales summary: total revenue, order count, avg value.",
    { date_from: z.string().describe("YYYY-MM-DD"), date_to: z.string().describe("YYYY-MM-DD") },
    async ({ date_from, date_to }) => {
      const { data, error } = await getDb().from("orders").select("id,grand_total,status,order_date").gte("order_date", date_from).lte("order_date", date_to);
      if (error) return err(error);
      const ok = (data ?? []).filter((o) => o.status !== "cancelled");
      const rev = ok.reduce((s, o) => s + (o.grand_total ?? 0), 0);
      return json({ date_from, date_to, total_orders: ok.length, cancelled: (data ?? []).length - ok.length, total_revenue: rev, avg_order_value: ok.length ? Math.round(rev / ok.length) : 0 });
    }
  );

  server.tool(
    "list_sales_entries",
    "List manual sales entries.",
    { date_from: z.string().optional(), date_to: z.string().optional(), limit: z.number().int().min(1).max(200).optional(), offset: z.number().int().min(0).optional() },
    async ({ date_from, date_to, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb().from("sales_entries").select("*,sales_entry_items(id,item_id,qty,unit_price,total),sales_entry_payments(id,method,amount)").order("entry_date", { ascending: false }).range(from, to);
      if (date_from) q = q.gte("entry_date", date_from);
      if (date_to) q = q.lte("entry_date", date_to);
      const { data, error } = await q;
      return error ? err(error) : json(data);
    }
  );

  server.tool("list_payment_methods", "List payment methods.", {}, async () => {
    const { data, error } = await getDb().from("payment_methods").select("*").order("name");
    return error ? err(error) : json(data);
  });

  server.tool(
    "list_customers",
    "List customers.",
    { search: z.string().optional(), limit: z.number().int().min(1).max(200).optional(), offset: z.number().int().min(0).optional() },
    async ({ search, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb().from("customers").select("*").order("name").range(from, to);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      return error ? err(error) : json(data);
    }
  );

  // ── Menu & Stock ────────────────────────────────────────────────────

  server.tool(
    "list_menu_items",
    "List menu/product items with filters.",
    {
      type: z.enum(["ingredient", "supply", "product", "prep_item"]).optional(),
      is_sellable: z.boolean().optional(),
      category_id: z.string().uuid().optional(),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ type, is_sellable, category_id, search, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb().from("items").select("id,name,brand,type,unit,on_hand,reserved,is_sellable,sell_price,is_addon,image_url,description,station,categories(id,name)").is("deleted_at", null).order("name").range(from, to);
      if (type) q = q.eq("type", type);
      if (is_sellable !== undefined) q = q.eq("is_sellable", is_sellable);
      if (category_id) q = q.eq("category_id", category_id);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      return error ? err(error) : json(data);
    }
  );

  server.tool("get_item", "Get full item details.", { id: z.string().uuid() }, async ({ id }) => {
    const { data, error } = await getDb().from("items").select("*,categories(id,name),locations(id,name)").eq("id", id).single();
    return error ? err(error) : json(data);
  });

  server.tool(
    "update_item",
    "Update an item (price, name, category, etc).",
    {
      id: z.string().uuid(),
      name: z.string().optional(),
      sell_price: z.number().nullable().optional(),
      is_sellable: z.boolean().optional(),
      is_addon: z.boolean().optional(),
      description: z.string().nullable().optional(),
      category_id: z.string().uuid().nullable().optional(),
      station: z.enum(["bar", "kitchen"]).nullable().optional(),
    },
    async ({ id, ...updates }) => {
      const { data, error } = await getDb().from("items").update(updates).eq("id", id).select().single();
      return error ? err(error) : json(data);
    }
  );

  server.tool("list_categories", "List item categories.", { type: z.enum(["ingredient", "supply", "product"]).optional() }, async ({ type }) => {
    let q = getDb().from("categories").select("id,name,type").order("name");
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    return error ? err(error) : json(data);
  });

  server.tool(
    "get_stock_levels",
    "Current stock levels with available qty.",
    {
      type: z.enum(["ingredient", "supply", "product", "prep_item"]).optional(),
      low_stock_only: z.boolean().optional().describe("Only items where on_hand <= 0"),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ type, low_stock_only, search, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb().from("items").select("id,name,type,unit,on_hand,reserved,categories(id,name)").is("deleted_at", null).order("name").range(from, to);
      if (type) q = q.eq("type", type);
      if (low_stock_only) q = q.lte("on_hand", 0);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      if (error) return err(error);
      return json((data ?? []).map((i) => ({ ...i, available: (i.on_hand ?? 0) - (i.reserved ?? 0) })));
    }
  );

  server.tool(
    "list_recipes",
    "List recipes (bill of materials).",
    { search: z.string().optional(), limit: z.number().int().min(1).max(200).optional(), offset: z.number().int().min(0).optional() },
    async ({ search, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb().from("recipes").select("id,name,station,yield_qty,product_id,recipe_items(id,item_id,quantity,unit,items:item_id(id,name,unit))").order("name").range(from, to);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      return error ? err(error) : json(data);
    }
  );

  server.tool("list_suppliers", "List suppliers.", { search: z.string().optional() }, async ({ search }) => {
    let q = getDb().from("suppliers").select("id,name,supplier_pics(id,name,whatsapp)").order("name");
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    return error ? err(error) : json(data);
  });

  server.tool(
    "list_purchases",
    "List purchase/receiving records.",
    { date_from: z.string().optional(), date_to: z.string().optional(), supplier_id: z.string().uuid().optional(), limit: z.number().int().min(1).max(200).optional(), offset: z.number().int().min(0).optional() },
    async ({ date_from, date_to, supplier_id, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb().from("purchases").select("*,purchase_items(id,item_id,qty_purchased,unit,cost_per_unit,cost_total,items:item_id(id,name)),suppliers(id,name)").order("transaction_date", { ascending: false }).range(from, to);
      if (date_from) q = q.gte("transaction_date", date_from);
      if (date_to) q = q.lte("transaction_date", date_to);
      if (supplier_id) q = q.eq("supplier_id", supplier_id);
      const { data, error } = await q;
      return error ? err(error) : json(data);
    }
  );

  // ── Payroll ─────────────────────────────────────────────────────────

  server.tool(
    "list_payroll_runs",
    "List payroll runs.",
    {
      status: z.enum(["draft", "finalized"]).optional(),
      year: z.number().int().optional(),
      month: z.number().int().min(1).max(12).optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ status, year, month, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb().from("payroll_runs").select("*").order("anchor_year", { ascending: false }).order("anchor_month", { ascending: false }).range(from, to);
      if (status) q = q.eq("status", status);
      if (year) q = q.eq("anchor_year", year);
      if (month) q = q.eq("anchor_month", month);
      const { data, error } = await q;
      return error ? err(error) : json(data);
    }
  );

  server.tool("get_payroll_run", "Get payroll run with all payslips.", { id: z.string().uuid() }, async ({ id }) => {
    const { data: run, error: e1 } = await getDb().from("payroll_runs").select("*").eq("id", id).single();
    if (e1) return err(e1);
    const { data: payslips, error: e2 } = await getDb().from("payslips").select("*,employees(id,name),payslip_lines(id,kind,label,detail,amount,sort)").eq("run_id", id);
    if (e2) return err(e2);
    return json({ ...run, payslips });
  });

  server.tool("get_payslip", "Get a single payslip with breakdown.", { id: z.string().uuid() }, async ({ id }) => {
    const { data, error } = await getDb().from("payslips").select("*,employees(id,name),payslip_lines(id,kind,label,detail,amount,sort)").eq("id", id).single();
    return error ? err(error) : json(data);
  });

  server.tool("get_payroll_settings", "Get payroll settings.", {}, async () => {
    const { data, error } = await getDb().from("payroll_settings").select("*").limit(1).single();
    return error ? err(error) : json(data);
  });

  server.tool("list_allowances", "List payroll components (earnings/deductions).", {}, async () => {
    const { data, error } = await getDb().from("allowances").select("id,name,type,is_default").order("name");
    return error ? err(error) : json(data);
  });

  // ── Recruitment ─────────────────────────────────────────────────────

  server.tool(
    "list_candidates",
    "List recruitment candidates.",
    {
      stage: z.string().optional(),
      job_position_id: z.string().uuid().optional(),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ stage, job_position_id, search, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb().from("candidates").select("id,name,email,phone,stage,source,applied_at,job_position_id,job_positions(id,name),created_at").order("created_at", { ascending: false }).range(from, to);
      if (stage) q = q.eq("stage", stage);
      if (job_position_id) q = q.eq("job_position_id", job_position_id);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      return error ? err(error) : json(data);
    }
  );

  server.tool("get_candidate", "Get full candidate details with comments and events.", { id: z.string().uuid() }, async ({ id }) => {
    const { data, error } = await getDb().from("candidates").select("*,job_positions(id,name),candidate_comments(id,body,created_by,created_at),candidate_events(id,type,detail,created_at)").eq("id", id).single();
    return error ? err(error) : json(data);
  });

  server.tool("update_candidate_stage", "Move a candidate to a new pipeline stage.", { id: z.string().uuid(), stage: z.string() }, async ({ id, stage }) => {
    const { data, error } = await getDb().from("candidates").update({ stage }).eq("id", id).select("id,name,stage").single();
    return error ? err(error) : json(data);
  });

  server.tool("add_candidate_comment", "Add a note to a candidate.", { candidate_id: z.string().uuid(), body: z.string() }, async ({ candidate_id, body }) => {
    const { data, error } = await getDb().from("candidate_comments").insert({ candidate_id, body }).select().single();
    return error ? err(error) : json(data);
  });

  // ── Schedule ────────────────────────────────────────────────────────

  server.tool(
    "list_schedules",
    "List crew schedules for a date range.",
    {
      date_from: z.string().describe("YYYY-MM-DD"),
      date_to: z.string().describe("YYYY-MM-DD"),
      employee_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ date_from, date_to, employee_id, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb().from("schedules").select("id,employee_id,shift_id,work_date,day_off,employees(id,name),shifts(id,name,start_time,end_time)").gte("work_date", date_from).lte("work_date", date_to).order("work_date").range(from, to);
      if (employee_id) q = q.eq("employee_id", employee_id);
      const { data, error } = await q;
      return error ? err(error) : json(data);
    }
  );

  server.tool(
    "set_schedule",
    "Set/update a crew member's schedule for a date.",
    {
      employee_id: z.string().uuid(),
      work_date: z.string().describe("YYYY-MM-DD"),
      shift_id: z.string().uuid().nullable(),
      day_off: z.boolean().optional().default(false),
    },
    async ({ employee_id, work_date, shift_id, day_off }) => {
      const { data: existing } = await getDb().from("schedules").select("id").eq("employee_id", employee_id).eq("work_date", work_date).maybeSingle();
      if (existing) {
        const { data, error } = await getDb().from("schedules").update({ shift_id, day_off }).eq("id", existing.id).select().single();
        return error ? err(error) : json(data);
      }
      const { data, error } = await getDb().from("schedules").insert({ employee_id, work_date, shift_id, day_off }).select().single();
      return error ? err(error) : json(data);
    }
  );

  server.tool("list_roster_patterns", "List roster patterns.", {}, async () => {
    const { data, error } = await getDb().from("roster_patterns").select("*").order("name");
    return error ? err(error) : json(data);
  });

  server.tool("list_tables", "List restaurant tables.", {}, async () => {
    const { data, error } = await getDb().from("tables").select("*").order("name");
    return error ? err(error) : json(data);
  });

  return server;
}
