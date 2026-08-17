"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentProfile } from "@/lib/auth";
import { getLoyaltySettings } from "@/app/actions/loyalty";
import { calculateOrderCharges, PBJT_RATE, SERVICE_CHARGE_RATE } from "@/lib/order-charges";
import { applySalesConsumption, type SaleLine } from "@/lib/sales-stock";

type ActionResult = { ok: true; id: string } | { ok: false; error: string };
type CreateOrderResult =
  | { ok: true; id: string; orderNumber: string }
  | { ok: false; error: string };

const ORDER_STATUSES = ["new", "preparing", "ready", "completed", "cancelled"] as const;

const createOrderSchema = z.object({
  phone: z.string().trim().min(6, "Enter a valid WhatsApp number").max(20).optional(),
  name: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
  tableId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        qty: z.coerce.number().int().positive(),
      }),
    )
    .min(1, "Add at least one product"),
});

/** Normalise an Indonesian WhatsApp number to digits only, 0-prefix → 62. */
function normalisePhone(raw: string): string {
  let digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  return digits;
}

/**
 * Place a customer order. Runs with the service-role client (customer has no
 * auth session). Prices are re-read server-side — never trust the client.
 */
export async function createCustomerOrder(raw: unknown): Promise<CreateOrderResult> {
  const parsed = createOrderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { phone, name, notes, tableId, items } = parsed.data;

  // Merge duplicate item rows defensively.
  const qtyByItem = new Map<string, number>();
  for (const it of items) {
    qtyByItem.set(it.item_id, (qtyByItem.get(it.item_id) ?? 0) + it.qty);
  }
  const itemIds = [...qtyByItem.keys()];

  const supabase = createServiceClient();

  // Re-read the products: must be sellable, not deleted. Snapshot name + price.
  const { data: products, error: prodError } = await supabase
    .from("items")
    .select("id, name, sell_price, is_sellable, deleted_at")
    .in("id", itemIds);

  if (prodError) return { ok: false, error: prodError.message };

  const valid = (products ?? []).filter((p) => p.is_sellable && !p.deleted_at);
  if (valid.length === 0) return { ok: false, error: "None of the selected products are available" };

  let customerId: string | null = null;
  let phoneNorm: string | null = null;
  if (phone) {
    phoneNorm = normalisePhone(phone);
    const { data: customer, error: custError } = await supabase
      .from("customers")
      .upsert({ phone: phoneNorm, name: name || null }, { onConflict: "phone" })
      .select("id")
      .single();
    if (custError) return { ok: false, error: custError.message };
    customerId = customer.id as string;
  }

  let tableNameSnapshot: string | null = null;
  if (tableId) {
    const { data: tableRow } = await supabase
      .from("tables")
      .select("name")
      .eq("id", tableId)
      .maybeSingle();
    tableNameSnapshot = tableRow?.name ?? null;
  }

  const lines = valid.map((p) => {
    const qty = qtyByItem.get(p.id)!;
    const unitPrice = Number(p.sell_price ?? 0);
    return {
      item_id: p.id,
      name_snapshot: p.name as string,
      qty,
      unit_price: unitPrice,
      line_total: unitPrice * qty,
    };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.line_total, 0);
  const { serviceCharge, taxTotal, total } = calculateOrderCharges(subtotal);
  const { rpPerPoint } = await getLoyaltySettings();
  const pointsEarned = Math.floor(total / rpPerPoint);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customerId,
      customer_phone: phoneNorm,
      customer_name: name || null,
      table_id: tableId || null,
      table_name_snapshot: tableNameSnapshot,
      notes: notes || null,
      subtotal,
      service_charge: serviceCharge,
      tax_total: taxTotal,
      total,
      points_earned: pointsEarned,
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) return { ok: false, error: orderError?.message ?? "Failed to create order" };

  const { error: lineError } = await supabase
    .from("order_items")
    .insert(lines.map((l) => ({ ...l, order_id: order.id })));

  if (lineError) return { ok: false, error: lineError.message };

  return { ok: true, id: order.id as string, orderNumber: order.order_number as string };
}

/** Staff updates an order's status (authenticated, RLS-enforced). */
export async function updateOrderStatus(orderId: string, status: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number]))
    return { ok: false, error: "Invalid status" };

  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/orders");
  revalidatePath("/orders/bar");
  revalidatePath("/orders/kitchen");
  return { ok: true, id: orderId };
}

/** Close all open orders for a table (cashier closes the bill). */
export async function closeTableBill(tableId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };

  const service = createServiceClient();
  const closedAt = new Date().toISOString();
  const { data: ordersToClose, error: findError } = await service
    .from("orders")
    .select("id")
    .eq("table_id", tableId)
    .in("status", ["new", "preparing", "ready"]);

  if (findError) return { ok: false, error: findError.message };

  const orderIds = (ordersToClose ?? []).map((order) => order.id as string);
  if (orderIds.length > 0) {
    const { error: itemError } = await service
      .from("order_items")
      .update({ closed_at: closedAt, closed_by: profile.id })
      .in("order_id", orderIds)
      .is("closed_at", null);
    if (itemError) return { ok: false, error: itemError.message };
  }

  const { error } = await service
    .from("orders")
    .update({ status: "completed" })
    .eq("table_id", tableId)
    .in("status", ["new", "preparing", "ready"]);
  if (error) return { ok: false, error: error.message };

  await service
    .from("orders")
    .update({ points_void: true })
    .eq("table_id", tableId)
    .is("points_claimed_at", null)
    .gt("points_earned", 0);

  revalidatePath("/orders");
  revalidatePath("/orders/bills");
  revalidatePath("/orders/bar");
  revalidatePath("/orders/kitchen");
  return { ok: true, id: tableId };
}

export async function closeOrderItems(orderItemIds: string[]): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };

  const parsed = z.array(z.string().uuid()).min(1).safeParse(orderItemIds);
  if (!parsed.success) return { ok: false, error: "Select at least one item" };

  const service = createServiceClient();
  const closedAt = new Date().toISOString();
  const { data: items, error: itemFindError } = await service
    .from("order_items")
    .select("id, order_id")
    .in("id", parsed.data)
    .is("closed_at", null);

  if (itemFindError) return { ok: false, error: itemFindError.message };
  if (!items || items.length === 0) return { ok: false, error: "Selected items are already closed" };

  const itemIds = items.map((item) => item.id as string);
  const orderIds = [...new Set(items.map((item) => item.order_id as string))];

  const { error: closeError } = await service
    .from("order_items")
    .update({ closed_at: closedAt, closed_by: profile.id })
    .in("id", itemIds);

  if (closeError) return { ok: false, error: closeError.message };

  for (const orderId of orderIds) {
    const { count, error: countError } = await service
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId)
      .is("closed_at", null);

    if (countError) return { ok: false, error: countError.message };
    if ((count ?? 0) === 0) {
      const { error: orderError } = await service
        .from("orders")
        .update({ status: "completed" })
        .eq("id", orderId);
      if (orderError) return { ok: false, error: orderError.message };
    }
  }

  revalidatePath("/orders");
  revalidatePath("/orders/bills");
  revalidatePath("/orders/bar");
  revalidatePath("/orders/kitchen");
  return { ok: true, id: itemIds[0] };
}

function jakartaDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

type OpenSaleItem = { item_id: string | null; qty: number; line_total: number };

/**
 * Record a paid POS bill into the Sales module: creates a sales entry (charges
 * match the order-charges the customer saw, so it reconciles exactly), one
 * payment row for the full net, aggregated line items, and deducts ingredient
 * stock via recipes. Returns the new sales entry id.
 */
async function recordBillSale(
  service: ReturnType<typeof createServiceClient>,
  openItems: OpenSaleItem[],
  method: string,
  profileId: string,
  label: string,
): Promise<{ ok: true; entryId: string } | { ok: false; error: string }> {
  const gross = openItems.reduce((sum, it) => sum + Number(it.line_total), 0);
  const serviceCharge = Math.round(gross * SERVICE_CHARGE_RATE);
  const taxTotal = Math.round((gross + serviceCharge) * PBJT_RATE);
  const netSales = gross + serviceCharge + taxTotal;
  const entryDate = jakartaDate();

  const { data: entry, error: entryError } = await service
    .from("sales_entries")
    .insert({
      entry_date: entryDate,
      shift: null,
      notes: label,
      gross_sales: gross,
      total_discount: 0,
      service_charge: serviceCharge,
      tax_total: taxTotal,
      net_sales: netSales,
      created_by: profileId,
    })
    .select("id")
    .single();

  if (entryError || !entry) return { ok: false, error: entryError?.message ?? "Failed to record sale" };
  const entryId = entry.id as string;

  const { error: payError } = await service
    .from("sales_entry_payments")
    .insert({ entry_id: entryId, method, amount: netSales });
  if (payError) return { ok: false, error: payError.message };

  // Aggregate qty per product (skip lines whose product was deleted).
  const qtyByProduct = new Map<string, number>();
  for (const it of openItems) {
    if (!it.item_id) continue;
    qtyByProduct.set(it.item_id, (qtyByProduct.get(it.item_id) ?? 0) + Number(it.qty));
  }
  const productIds = [...qtyByProduct.keys()];

  if (productIds.length > 0) {
    const { data: prods } = await service.from("items").select("id, unit").in("id", productIds);
    const unitMap = new Map(((prods ?? []) as { id: string; unit: string }[]).map((p) => [p.id, p.unit]));
    const lines: SaleLine[] = productIds.map((id) => ({
      product_id: id,
      qty: qtyByProduct.get(id)!,
      unit: unitMap.get(id) ?? "unit",
    }));

    const { error: lineError } = await service
      .from("sales_entry_items")
      .insert(lines.map((l) => ({ entry_id: entryId, product_id: l.product_id, qty: l.qty, unit: l.unit })));
    if (lineError) return { ok: false, error: lineError.message };

    await applySalesConsumption(service, { entryId, items: lines, profileId, note: label });
  }

  return { ok: true, entryId };
}

/**
 * Settle a whole table's open bill: records the sale (payment + stock), then
 * closes all open items, completes the orders, links them to the sales entry,
 * and voids unclaimed loyalty points.
 */
export async function settleTableBill(tableId: string, method: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  const cleanMethod = (method ?? "").trim();
  if (!cleanMethod) return { ok: false, error: "Pilih metode pembayaran" };

  const service = createServiceClient();
  const { data: orders, error: findError } = await service
    .from("orders")
    .select("id, table_name_snapshot, order_number, order_items(id, item_id, qty, line_total, closed_at)")
    .eq("table_id", tableId)
    .in("status", ["new", "preparing", "ready"]);

  if (findError) return { ok: false, error: findError.message };

  type OrderRow = {
    id: string;
    table_name_snapshot: string | null;
    order_number: string;
    order_items: { id: string; item_id: string | null; qty: number; line_total: number; closed_at: string | null }[];
  };
  const rows = (orders ?? []) as unknown as OrderRow[];
  const openItems: OpenSaleItem[] = [];
  const orderIds: string[] = [];
  for (const o of rows) {
    const open = o.order_items.filter((i) => !i.closed_at);
    if (open.length === 0) continue;
    orderIds.push(o.id);
    for (const i of open) openItems.push({ item_id: i.item_id, qty: Number(i.qty), line_total: Number(i.line_total) });
  }
  if (openItems.length === 0) return { ok: false, error: "Tidak ada tagihan terbuka untuk meja ini" };

  const tableName = rows.find((o) => o.table_name_snapshot)?.table_name_snapshot ?? "Table";
  const label = `POS · ${tableName} · ${rows.map((o) => o.order_number).join(", ")}`;

  const sale = await recordBillSale(service, openItems, cleanMethod, profile.id, label);
  if (!sale.ok) return { ok: false, error: sale.error };

  const closedAt = new Date().toISOString();
  const { error: itemError } = await service
    .from("order_items")
    .update({ closed_at: closedAt, closed_by: profile.id })
    .in("order_id", orderIds)
    .is("closed_at", null);
  if (itemError) return { ok: false, error: itemError.message };

  const { error: orderError } = await service
    .from("orders")
    .update({ status: "completed", sales_entry_id: sale.entryId })
    .in("id", orderIds);
  if (orderError) return { ok: false, error: orderError.message };

  await service
    .from("orders")
    .update({ points_void: true })
    .in("id", orderIds)
    .is("points_claimed_at", null)
    .gt("points_earned", 0);

  revalidatePath("/orders");
  revalidatePath("/orders/bills");
  revalidatePath("/orders/bar");
  revalidatePath("/orders/kitchen");
  revalidatePath("/sales");
  revalidatePath("/inventory", "layout");
  return { ok: true, id: sale.entryId };
}

/** Settle a subset of a bill's items (split payment): records the sale, closes
 *  those items, and completes any order left with nothing open. */
export async function settleOrderItems(orderItemIds: string[], method: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  const cleanMethod = (method ?? "").trim();
  if (!cleanMethod) return { ok: false, error: "Pilih metode pembayaran" };

  const parsed = z.array(z.string().uuid()).min(1).safeParse(orderItemIds);
  if (!parsed.success) return { ok: false, error: "Pilih minimal satu item" };

  const service = createServiceClient();
  const { data: items, error: itemFindError } = await service
    .from("order_items")
    .select("id, order_id, item_id, qty, line_total, closed_at")
    .in("id", parsed.data)
    .is("closed_at", null);

  if (itemFindError) return { ok: false, error: itemFindError.message };
  type ItemRow = { id: string; order_id: string; item_id: string | null; qty: number; line_total: number };
  const rows = (items ?? []) as unknown as ItemRow[];
  if (rows.length === 0) return { ok: false, error: "Item terpilih sudah ditutup" };

  const orderIds = [...new Set(rows.map((i) => i.order_id))];
  const { data: ordersInfo } = await service
    .from("orders")
    .select("id, table_name_snapshot")
    .in("id", orderIds);
  const tableName =
    ((ordersInfo ?? []) as { table_name_snapshot: string | null }[]).find((o) => o.table_name_snapshot)
      ?.table_name_snapshot ?? "Table";
  const label = `POS · ${tableName} · split`;

  const sale = await recordBillSale(
    service,
    rows.map((i) => ({ item_id: i.item_id, qty: Number(i.qty), line_total: Number(i.line_total) })),
    cleanMethod,
    profile.id,
    label,
  );
  if (!sale.ok) return { ok: false, error: sale.error };

  const closedAt = new Date().toISOString();
  const { error: closeError } = await service
    .from("order_items")
    .update({ closed_at: closedAt, closed_by: profile.id })
    .in("id", rows.map((i) => i.id));
  if (closeError) return { ok: false, error: closeError.message };

  for (const orderId of orderIds) {
    const { count } = await service
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId)
      .is("closed_at", null);
    if ((count ?? 0) === 0) {
      await service.from("orders").update({ status: "completed", sales_entry_id: sale.entryId }).eq("id", orderId);
    }
  }

  revalidatePath("/orders");
  revalidatePath("/orders/bills");
  revalidatePath("/orders/bar");
  revalidatePath("/orders/kitchen");
  revalidatePath("/sales");
  revalidatePath("/inventory", "layout");
  return { ok: true, id: sale.entryId };
}

/** Mark an order as printed (called by the print station after a successful print). */
export async function markOrderPrinted(orderId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ printed_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: orderId };
}

export async function openOrderShift(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };

  const supabase = await createClient();
  const { data: openShift } = await supabase
    .from("order_shifts")
    .select("id")
    .is("closed_at", null)
    .maybeSingle();

  if (openShift) return { ok: false, error: "A shift is already open" };

  const { data, error } = await supabase
    .from("order_shifts")
    .insert({ opened_by: profile.id })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/orders");
  return { ok: true, id: data.id as string };
}

export async function closeOrderShift(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };

  const supabase = await createClient();
  const { data: openShift, error: findError } = await supabase
    .from("order_shifts")
    .select("id")
    .is("closed_at", null)
    .maybeSingle();

  if (findError) return { ok: false, error: findError.message };
  if (!openShift) return { ok: false, error: "No open shift to close" };

  const { error } = await supabase
    .from("order_shifts")
    .update({ closed_at: new Date().toISOString(), closed_by: profile.id })
    .eq("id", openShift.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/orders");
  return { ok: true, id: openShift.id as string };
}
