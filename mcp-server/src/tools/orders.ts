import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb, paginate } from "../db.js";

export function registerOrderTools(server: McpServer) {
  server.tool(
    "list_orders",
    "List orders with filters. Returns order details, items, and payment info.",
    {
      date: z.string().optional().describe("Filter by date (YYYY-MM-DD)"),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      status: z.string().optional().describe("e.g. completed, pending, cancelled"),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ date, date_from, date_to, status, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb()
        .from("orders")
        .select("*, order_items(id, item_id, name, qty, unit_price, subtotal, note)")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (date) q = q.eq("order_date", date);
      if (date_from) q = q.gte("order_date", date_from);
      if (date_to) q = q.lte("order_date", date_to);
      if (status) q = q.eq("status", status);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_order",
    "Get full details of a single order by ID, including items.",
    { id: z.string().uuid() },
    async ({ id }) => {
      const { data, error } = await getDb()
        .from("orders")
        .select("*, order_items(id, item_id, name, qty, unit_price, subtotal, note, addons)")
        .eq("id", id)
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_sales_summary",
    "Get sales summary for a date range — total revenue, order count, average order value.",
    {
      date_from: z.string().describe("YYYY-MM-DD"),
      date_to: z.string().describe("YYYY-MM-DD"),
    },
    async ({ date_from, date_to }) => {
      const { data: orders, error } = await getDb()
        .from("orders")
        .select("id, grand_total, status, order_date")
        .gte("order_date", date_from)
        .lte("order_date", date_to);

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const completed = (orders ?? []).filter((o) => o.status !== "cancelled");
      const totalRevenue = completed.reduce((sum, o) => sum + (o.grand_total ?? 0), 0);
      const summary = {
        date_from,
        date_to,
        total_orders: completed.length,
        cancelled_orders: (orders ?? []).length - completed.length,
        total_revenue: totalRevenue,
        average_order_value: completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
    }
  );

  server.tool(
    "list_sales_entries",
    "List manual sales entries (for reconciliation).",
    {
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ date_from, date_to, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb()
        .from("sales_entries")
        .select("*, sales_entry_items(id, item_id, qty, unit_price, total), sales_entry_payments(id, method, amount)")
        .order("entry_date", { ascending: false })
        .range(from, to);

      if (date_from) q = q.gte("entry_date", date_from);
      if (date_to) q = q.lte("entry_date", date_to);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_payment_methods",
    "List configured payment methods.",
    {},
    async () => {
      const { data, error } = await getDb()
        .from("payment_methods")
        .select("*")
        .order("name");
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_customers",
    "List customers (for dine-in tables or loyalty).",
    {
      search: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ search, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb()
        .from("customers")
        .select("*")
        .order("name")
        .range(from, to);

      if (search) q = q.ilike("name", `%${search}%`);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
