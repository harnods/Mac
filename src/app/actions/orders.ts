"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentProfile } from "@/lib/auth";

type ActionResult = { ok: true; id: string } | { ok: false; error: string };
type CreateOrderResult =
  | { ok: true; id: string; orderNumber: string }
  | { ok: false; error: string };

const ORDER_STATUSES = ["new", "preparing", "ready", "completed", "cancelled"] as const;

const createOrderSchema = z.object({
  phone: z.string().trim().min(6, "Enter a valid WhatsApp number").max(20),
  name: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
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
  const { phone, name, notes, items } = parsed.data;

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

  const phoneNorm = normalisePhone(phone);

  // Upsert customer by phone.
  const { data: customer, error: custError } = await supabase
    .from("customers")
    .upsert({ phone: phoneNorm, name: name || null }, { onConflict: "phone" })
    .select("id")
    .single();

  if (custError) return { ok: false, error: custError.message };

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
  const total = lines.reduce((sum, l) => sum + l.line_total, 0);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customer.id,
      customer_phone: phoneNorm,
      customer_name: name || null,
      notes: notes || null,
      total,
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
  return { ok: true, id: orderId };
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
