"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentProfile } from "@/lib/auth";
import { getLoyaltySettings } from "@/app/actions/loyalty";
import { calculateOrderCharges } from "@/lib/order-charges";

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
