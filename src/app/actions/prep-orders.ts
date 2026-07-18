"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { convert, convertToPieces } from "@/lib/units";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const createPrepOrderSchema = z.object({
  recipe_id: z.string().uuid(),
  product_id: z.string().uuid(),
  batch_count: z.coerce.number().positive(),
  target_qty: z.coerce.number().positive(),
  unit: z.string().min(1),
  prep_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
  items: z.array(
    z.object({
      item_id: z.string().uuid(),
      qty_needed: z.coerce.number().positive(),
      unit: z.string().min(1),
    })
  ).min(1, "Recipe must have at least one ingredient"),
});

export async function createPrepOrder(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.PREP_ORDERS_WRITE)) return { ok: false, error: "No permission" };

  const parsed = createPrepOrderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { recipe_id, product_id, batch_count, target_qty, unit, prep_date, notes, items } = parsed.data;

  const supabase = await createClient();

  // Insert prep order as pending — no stock changes yet
  const { data: order, error: orderError } = await supabase
    .from("prep_orders")
    .insert({
      recipe_id,
      product_id,
      batch_count,
      target_qty,
      unit,
      planned_date: prep_date,
      notes: notes || null,
      status: "pending",
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (orderError || !order) return { ok: false, error: orderError?.message ?? "Failed to create prep order" };

  // Insert prep order items (for reference, no deduction yet)
  const { error: itemsError } = await supabase
    .from("prep_order_items")
    .insert(items.map((it) => ({
      prep_order_id: order.id,
      item_id: it.item_id,
      qty_needed: it.qty_needed,
      unit: it.unit,
    })));

  if (itemsError) return { ok: false, error: itemsError.message };

  revalidatePath("/prep-orders");
  return { ok: true, id: order.id };
}

export async function completePrepOrder(id: string, actualQty: number, varianceReason?: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.PREP_ORDERS_COMPLETE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  // Fetch prep order with items and product
  const { data: order, error: fetchError } = await supabase
    .from("prep_orders")
    .select(`
      id, status, batch_count, unit, product_id,
      prep_order_items(item_id, qty_needed, unit),
      recipe:recipes!recipe_id(weight_per_pcs, weight_unit)
    `)
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !order) return { ok: false, error: "Prep order not found" };
  if (order.status !== "pending") return { ok: false, error: "Only pending orders can be completed" };
  if (actualQty <= 0) return { ok: false, error: "Actual yield must be greater than 0" };

  const items = order.prep_order_items as { item_id: string; qty_needed: number; unit: string }[];
  const recipe = order.recipe as unknown as { weight_per_pcs: number | null; weight_unit: string | null } | null;

  // Resolve the yield conversion up front — if the recipe's unit doesn't
  // match the product's own stock unit (e.g. recipe yields in g but the
  // product is stocked in pcs), fall back to the recipe's "weight per pcs"
  // to derive a piece count. Bail out before touching any stock if neither
  // works, so a bad conversion can't leave ingredients deducted with no
  // output added.
  const { data: product } = await supabase
    .from("items")
    .select("id, unit, on_hand, reserved")
    .eq("id", order.product_id)
    .maybeSingle();

  if (!product) return { ok: false, error: "Output item not found" };

  const outputQty =
    order.unit === product.unit
      ? actualQty
      : convert(actualQty, order.unit, product.unit) ??
        convertToPieces(actualQty, order.unit, recipe?.weight_per_pcs, recipe?.weight_unit);

  if (outputQty == null) {
    return {
      ok: false,
      error: `Can't convert ${order.unit} to ${product.unit} — set "Weight per pcs" on this recipe first.`,
    };
  }

  // Fetch current ingredient stock
  const itemIds = items.map((it) => it.item_id);
  const { data: dbItems } = await supabase
    .from("items")
    .select("id, unit, on_hand, reserved")
    .in("id", itemIds);

  if (!dbItems) return { ok: false, error: "Failed to fetch ingredient data" };

  // Deduct ingredients as planned
  for (const it of items) {
    const dbItem = dbItems.find((d) => d.id === it.item_id);
    if (!dbItem) continue;

    const converted = convert(it.qty_needed, it.unit, dbItem.unit) ?? it.qty_needed;
    const newOnHand = Number(dbItem.on_hand) - converted;
    const newReserved = Math.max(0, Number(dbItem.reserved));

    await supabase
      .from("items")
      .update({ on_hand: newOnHand, updated_by: profile.id })
      .eq("id", it.item_id);

    await supabase.from("stock_ledger").insert({
      item_id: it.item_id,
      type: "prep_consumption",
      ref_id: id,
      qty_delta: -converted,
      on_hand_after: newOnHand,
      reserved_after: newReserved,
      created_by: profile.id,
    });

    dbItem.on_hand = newOnHand;
  }

  // Add actual yield to prep item on_hand
  const newProductOnHand = Number(product.on_hand) + outputQty;
  const currentReserved = Number(product.reserved);

  await supabase
    .from("items")
    .update({ on_hand: newProductOnHand, updated_by: profile.id })
    .eq("id", order.product_id);

  await supabase.from("stock_ledger").insert({
    item_id: order.product_id,
    type: "prep_output",
    ref_id: id,
    qty_delta: outputQty,
    on_hand_after: newProductOnHand,
    reserved_after: currentReserved,
    created_by: profile.id,
  });

  // Mark order as completed
  await supabase
    .from("prep_orders")
    .update({
      status: "completed",
      qty_to_prep: actualQty,
      yield_variance_reason: varianceReason ?? null,
      completed_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq("id", id);

  revalidatePath("/prep-orders");
  revalidatePath(`/prep-orders/${id}`);
  revalidatePath("/inventory", "layout");
  return { ok: true };
}

export async function cancelPrepOrder(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.PREP_ORDERS_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("prep_orders")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (!order) return { ok: false, error: "Prep order not found" };
  if (order.status !== "pending") return { ok: false, error: "Only pending orders can be cancelled" };

  const { error } = await supabase
    .from("prep_orders")
    .update({ status: "cancelled", updated_by: profile.id })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/prep-orders");
  revalidatePath(`/prep-orders/${id}`);
  return { ok: true };
}
