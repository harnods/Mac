import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb, paginate } from "../db.js";

export function registerMenuStockTools(server: McpServer) {
  server.tool(
    "list_menu_items",
    "List menu/product items (sellable). Returns name, price, category, stock on hand.",
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
      let q = getDb()
        .from("items")
        .select("id, name, brand, type, unit, on_hand, reserved, is_sellable, sell_price, is_addon, image_url, description, station, categories(id,name)")
        .is("deleted_at", null)
        .order("name")
        .range(from, to);

      if (type) q = q.eq("type", type);
      if (is_sellable !== undefined) q = q.eq("is_sellable", is_sellable);
      if (category_id) q = q.eq("category_id", category_id);
      if (search) q = q.ilike("name", `%${search}%`);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_item",
    "Get full details of a single item (ingredient, product, supply) by ID.",
    { id: z.string().uuid() },
    async ({ id }) => {
      const { data, error } = await getDb()
        .from("items")
        .select("*, categories(id,name), locations(id,name)")
        .eq("id", id)
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_item",
    "Update an item (change name, price, category, etc).",
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
      const { data, error } = await getDb()
        .from("items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_categories",
    "List item categories.",
    { type: z.enum(["ingredient", "supply", "product"]).optional() },
    async ({ type }) => {
      let q = getDb().from("categories").select("id, name, type").order("name");
      if (type) q = q.eq("type", type);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_stock_levels",
    "Get current stock levels. Returns items with on_hand, reserved, and available quantities.",
    {
      type: z.enum(["ingredient", "supply", "product", "prep_item"]).optional(),
      low_stock_only: z.boolean().optional().describe("Only items where on_hand <= 0"),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ type, low_stock_only, search, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb()
        .from("items")
        .select("id, name, type, unit, on_hand, reserved, categories(id,name)")
        .is("deleted_at", null)
        .order("name")
        .range(from, to);

      if (type) q = q.eq("type", type);
      if (low_stock_only) q = q.lte("on_hand", 0);
      if (search) q = q.ilike("name", `%${search}%`);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const enriched = (data ?? []).map((item) => ({
        ...item,
        available: (item.on_hand ?? 0) - (item.reserved ?? 0),
      }));

      return { content: [{ type: "text" as const, text: JSON.stringify(enriched, null, 2) }] };
    }
  );

  server.tool(
    "list_recipes",
    "List recipes (bill of materials). Shows what ingredients go into each product.",
    {
      search: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ search, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb()
        .from("recipes")
        .select("id, name, station, yield_qty, product_id, recipe_items(id, item_id, quantity, unit, items:item_id(id, name, unit))")
        .order("name")
        .range(from, to);

      if (search) q = q.ilike("name", `%${search}%`);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_suppliers",
    "List suppliers.",
    { search: z.string().optional() },
    async ({ search }) => {
      let q = getDb()
        .from("suppliers")
        .select("id, name, supplier_pics(id, name, whatsapp)")
        .order("name");

      if (search) q = q.ilike("name", `%${search}%`);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "list_purchases",
    "List purchase records (stock receiving).",
    {
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      supplier_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({ date_from, date_to, supplier_id, limit, offset }) => {
      const { from, to } = paginate({ limit, offset });
      let q = getDb()
        .from("purchases")
        .select("*, purchase_items(id, item_id, qty_purchased, unit, cost_per_unit, cost_total, items:item_id(id,name)), suppliers(id,name)")
        .order("transaction_date", { ascending: false })
        .range(from, to);

      if (date_from) q = q.gte("transaction_date", date_from);
      if (date_to) q = q.lte("transaction_date", date_to);
      if (supplier_id) q = q.eq("supplier_id", supplier_id);

      const { data, error } = await q;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
