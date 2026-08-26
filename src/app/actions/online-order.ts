"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { getPaymentProvider, type Charge } from "@/lib/payments";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function service() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function orderBaseUrl() {
  return process.env.ORDER_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://order.machimoto.cafe";
}

// ─── Menu (public) ────────────────────────────────────────────────────────────

export type MenuItem = { id: string; name: string; description: string | null; price: number; imageUrl: string | null };
export type MenuCategory = { id: string; name: string; items: MenuItem[] };

/** Sellable products grouped by category, for the storefront. */
export async function getMenu(): Promise<MenuCategory[]> {
  const db = service();
  const [{ data: items }, { data: cats }] = await Promise.all([
    db.from("items").select("id,name,description,sell_price,image_url,category_id,is_sellable,is_addon,deleted_at,status").eq("is_sellable", true).is("deleted_at", null),
    db.from("categories").select("id,name,type"),
  ]);
  const catName = new Map((((cats ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])));
  const groups = new Map<string, MenuCategory>();
  const order: string[] = [];
  for (const it of (items ?? []) as { id: string; name: string; description: string | null; sell_price: number | null; image_url: string | null; category_id: string | null; is_addon: boolean | null; status: string | null }[]) {
    if (it.is_addon) continue; // add-ons aren't standalone menu items
    if (/\[wip\]/i.test(it.name) || it.status === "archived") continue;
    const key = it.category_id ?? "_uncat";
    if (!groups.has(key)) { groups.set(key, { id: key, name: it.category_id ? catName.get(it.category_id) ?? "Other" : "Other", items: [] }); order.push(key); }
    groups.get(key)!.items.push({ id: it.id, name: it.name, description: it.description, price: Number(it.sell_price ?? 0), imageUrl: it.image_url });
  }
  const list = order.map((k) => groups.get(k)!).filter((g) => g.items.length > 0);
  for (const g of list) g.items.sort((a, b) => a.name.localeCompare(b.name));
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

// ─── Order lifecycle (public) ─────────────────────────────────────────────────

export type OnlineOrder = {
  id: string; order_number: string; pickup_code: string;
  customer_name: string; customer_phone: string; note: string | null;
  status: "pending_payment" | "paid" | "preparing" | "ready" | "picked_up" | "cancelled";
  payment_status: "unpaid" | "paid" | "failed" | "expired";
  payment_method: string | null; subtotal: number; total: number;
  created_at: string; paid_at: string | null;
};
export type OnlineOrderItem = { id: string; name_snapshot: string; unit_price: number; qty: number; line_total: number };

const phoneOk = (p: string) => /^[0-9+][0-9\s-]{6,}$/.test(p.trim());

/** Create a guest take-away order from a cart, priced server-side. Contact
 *  (name + WhatsApp) is optional here — for the take-away flow it's collected
 *  after payment via setOnlineOrderContact. */
export async function createOnlineOrder(input: {
  name?: string; phone?: string; note?: string;
  items: { itemId: string; qty: number }[];
}): Promise<ActionResult<{ token: string }>> {
  const name = input.name?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  if (phone && !phoneOk(phone)) return { ok: false, error: "Please enter a valid WhatsApp number." };
  const wanted = (input.items ?? []).filter((i) => i.itemId && i.qty > 0);
  if (wanted.length === 0) return { ok: false, error: "Your cart is empty." };

  const db = service();
  const ids = [...new Set(wanted.map((i) => i.itemId))];
  const { data: prods } = await db.from("items").select("id,name,sell_price,is_sellable,deleted_at").in("id", ids);
  const valid = new Map((((prods ?? []) as { id: string; name: string; sell_price: number | null; is_sellable: boolean; deleted_at: string | null }[])
    .filter((p) => p.is_sellable && !p.deleted_at).map((p) => [p.id, p])));

  const lines = wanted
    .map((w) => { const p = valid.get(w.itemId); if (!p) return null; const qty = Math.min(99, Math.max(1, Math.floor(w.qty))); const unit = Number(p.sell_price ?? 0); return { item_id: p.id, name_snapshot: p.name, unit_price: unit, qty, line_total: unit * qty }; })
    .filter(Boolean) as { item_id: string; name_snapshot: string; unit_price: number; qty: number; line_total: number }[];
  if (lines.length === 0) return { ok: false, error: "Those items are no longer available." };

  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);

  const { data: order, error: oErr } = await db
    .from("online_orders")
    .insert({ order_number: "", pickup_code: "", customer_name: name, customer_phone: phone, note: input.note?.trim() || null, subtotal, total: subtotal })
    .select("id, access_token, order_number")
    .single();
  if (oErr || !order) return { ok: false, error: oErr?.message ?? "Could not create order." };

  const { error: iErr } = await db.from("online_order_items").insert(lines.map((l) => ({ ...l, order_id: order.id })));
  if (iErr) return { ok: false, error: iErr.message };

  const token = order.access_token as string;

  // Start the payment. A redirect provider (DOKU) gives us a hosted page URL
  // to store; the mock provider is generated lazily on the order page.
  try {
    const charge = await getPaymentProvider().createCharge({
      orderId: order.id,
      orderNumber: order.order_number,
      amount: subtotal,
      customerName: name || "Machimoto Customer",
      customerPhone: phone || "0000000000",
      callbackUrl: `${orderBaseUrl()}/takeaway/o/${token}`,
    });
    await db.from("online_orders").update({
      payment_method: charge.method,
      payment_ref: charge.providerRef,
      payment_url: charge.paymentUrl ?? null,
      payment_expires_at: charge.expiresAt,
    }).eq("id", order.id);
  } catch (e) {
    await db.from("online_orders").delete().eq("id", order.id); // roll back so retry is clean
    return { ok: false, error: e instanceof Error ? e.message : "Payment could not be started. Please try again." };
  }

  return { ok: true, data: { token } };
}

/** Fetch an order + items by its access token (public status/pay page). */
export async function getOnlineOrder(token: string): Promise<{ order: OnlineOrder; items: OnlineOrderItem[]; charge: Charge | null } | null> {
  const db = service();
  const { data: order } = await db
    .from("online_orders")
    .select("id,order_number,pickup_code,customer_name,customer_phone,note,status,payment_status,payment_method,payment_url,payment_expires_at,subtotal,total,created_at,paid_at")
    .eq("access_token", token)
    .maybeSingle();
  if (!order) return null;
  const { data: items } = await db.from("online_order_items").select("id,name_snapshot,unit_price,qty,line_total").eq("order_id", order.id);

  let charge: Charge | null = null;
  if (order.payment_status === "unpaid" && order.status === "pending_payment") {
    if (order.payment_url) {
      // Redirect provider (DOKU): reuse the stored hosted-checkout URL.
      charge = { kind: "redirect", method: order.payment_method ?? "doku", paymentUrl: order.payment_url, providerRef: "", expiresAt: order.payment_expires_at ?? "", mock: false };
    } else {
      // Mock provider: generate the QR for display.
      charge = await getPaymentProvider().createCharge({ orderId: order.id, orderNumber: order.order_number, amount: Number(order.total), customerName: order.customer_name, customerPhone: order.customer_phone, callbackUrl: `${orderBaseUrl()}/takeaway/o/${token}` });
    }
  }
  return { order: order as OnlineOrder, items: (items ?? []) as OnlineOrderItem[], charge };
}

/** Save the pickup contact after payment (take-away collects it last). */
export async function setOnlineOrderContact(token: string, name: string, phone: string): Promise<ActionResult> {
  const n = name?.trim();
  const p = phone?.trim();
  if (!n) return { ok: false, error: "Please enter your name." };
  if (!p || !phoneOk(p)) return { ok: false, error: "Please enter a valid WhatsApp number." };
  const db = service();
  const { error } = await db.from("online_orders").update({ customer_name: n, customer_phone: p, updated_at: new Date().toISOString() }).eq("access_token", token);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/orders/online");
  return { ok: true };
}

/** Light poll for the pay/status page. */
export async function getOrderStatus(token: string): Promise<{ status: OnlineOrder["status"]; payment_status: OnlineOrder["payment_status"] } | null> {
  const db = service();
  const { data } = await db.from("online_orders").select("status,payment_status").eq("access_token", token).maybeSingle();
  return (data as { status: OnlineOrder["status"]; payment_status: OnlineOrder["payment_status"] } | null) ?? null;
}

/** Mock: mark an order paid (stands in for a Midtrans webhook). */
export async function simulatePayment(token: string): Promise<ActionResult> {
  const db = service();
  const { data: order } = await db.from("online_orders").select("id,payment_status").eq("access_token", token).maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.payment_status === "paid") return { ok: true };
  const { error } = await db
    .from("online_orders")
    .update({ payment_status: "paid", status: "paid", paid_at: new Date().toISOString(), payment_ref: `MOCK-${order.id.slice(0, 8).toUpperCase()}`, updated_at: new Date().toISOString() })
    .eq("id", order.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/orders/online");
  return { ok: true };
}

// ─── Admin board ──────────────────────────────────────────────────────────────

export type AdminOnlineOrder = OnlineOrder & { items: OnlineOrderItem[] };

export async function getOnlineOrders(): Promise<AdminOnlineOrder[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("online_orders")
    .select("id,order_number,pickup_code,customer_name,customer_phone,note,status,payment_status,payment_method,subtotal,total,created_at,paid_at, items:online_order_items(id,name_snapshot,unit_price,qty,line_total)")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as unknown as AdminOnlineOrder[];
}

export async function setOnlineOrderStatus(id: string, status: OnlineOrder["status"]): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SALES_WRITE)) return { ok: false, error: "No permission" };
  const supabase = await createClient();
  const { error } = await supabase.from("online_orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/orders/online");
  return { ok: true };
}
