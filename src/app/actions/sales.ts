"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { convert } from "@/lib/units";
import { applySalesConsumption } from "@/lib/sales-stock";

type ActionResult = { ok: true; id: string } | { ok: false; error: string };

// Restaurant charges: service charge on gross (before discount), PB1 tax on the
// discounted amount plus service charge.
const SERVICE_CHARGE_RATE = 0.05;
const TAX_RATE = 0.10;

const paymentSchema = z.object({
  method: z.string().trim().min(1, "Payment method is required").max(60),
  amount: z.coerce.number().nonnegative(),
});

const createSalesEntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift: z.string().trim().max(60).optional(),
  total_discount: z.coerce.number().nonnegative().optional().default(0),
  payments: z.array(paymentSchema).optional().default([]),
  notes: z.string().max(500).optional(),
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      qty: z.coerce.number().positive(),
      unit: z.string().min(1),
    })
  ).min(1, "Add at least one product"),
});

export async function createSalesEntry(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SALES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = createSalesEntrySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { entry_date, shift, total_discount, payments, notes, items } = parsed.data;

  // Check for duplicate products
  const productIds = items.map((i) => i.product_id);
  if (new Set(productIds).size !== productIds.length)
    return { ok: false, error: "Duplicate products are not allowed" };

  const supabase = await createClient();

  // Gross sales = Σ qty × sell price, snapshotted so it stays correct if prices
  // change later. Service charge is 5% of gross (before discount); PB1 tax is
  // 10% of (gross − discount + service charge); net = gross − discount + SC + tax.
  const { data: priceRows } = await supabase.from("items").select("id, sell_price").in("id", productIds);
  const priceMap = new Map((priceRows ?? []).map((p: { id: string; sell_price: number | null }) => [p.id, Number(p.sell_price ?? 0)]));
  const grossSales = items.reduce((sum, it) => sum + it.qty * (priceMap.get(it.product_id) ?? 0), 0);
  const discount = Math.min(total_discount, grossSales);
  const serviceCharge = Math.round(grossSales * SERVICE_CHARGE_RATE);
  const taxTotal = Math.round((grossSales - discount + serviceCharge) * TAX_RATE);
  const netSales = grossSales - discount + serviceCharge + taxTotal;

  // Payments (how net sales was collected) must reconcile to net sales.
  if (payments.length) {
    const paySum = payments.reduce((s, p) => s + p.amount, 0);
    if (Math.round(paySum) !== Math.round(netSales))
      return { ok: false, error: `Payments (Rp ${Math.round(paySum).toLocaleString("id-ID")}) must equal net sales (Rp ${Math.round(netSales).toLocaleString("id-ID")})` };
  }

  // Create the sales entry
  const { data: entry, error: entryError } = await supabase
    .from("sales_entries")
    .insert({
      entry_date,
      shift: shift || null,
      notes: notes || null,
      gross_sales: grossSales,
      total_discount: discount,
      service_charge: serviceCharge,
      tax_total: taxTotal,
      net_sales: netSales,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (entryError || !entry) return { ok: false, error: entryError?.message ?? "Failed to create sales entry" };

  // Payment split
  if (payments.length) {
    const { error: payError } = await supabase
      .from("sales_entry_payments")
      .insert(payments.map((p) => ({ entry_id: entry.id, method: p.method, amount: p.amount })));
    if (payError) return { ok: false, error: payError.message };
  }

  // Insert line items
  const { error: lineError } = await supabase
    .from("sales_entry_items")
    .insert(items.map((it) => ({
      entry_id: entry.id,
      product_id: it.product_id,
      qty: it.qty,
      unit: it.unit,
    })));

  if (lineError) return { ok: false, error: lineError.message };

  // Deduct ingredient stock consumed by the sold products (shared with POS settle).
  await applySalesConsumption(supabase, {
    entryId: entry.id,
    items,
    profileId: profile.id,
    note: `Sales entry ${entry_date}`,
  });

  revalidatePath("/sales");
  revalidatePath("/inventory", "layout");
  return { ok: true, id: entry.id };
}

const updateSalesEntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift: z.string().trim().max(60).optional(),
  total_discount: z.coerce.number().nonnegative().optional().default(0),
  payments: z.array(paymentSchema).optional().default([]),
  notes: z.string().max(500).optional(),
});

/**
 * Edit a sales entry's header (date, shift, notes) and total discount, and
 * recompute the money breakdown. Gross is unchanged (line items are fixed), so
 * this touches no stock. To change sold products, delete and re-create.
 */
export async function updateSalesEntry(id: string, raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SALES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = updateSalesEntrySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { entry_date, shift, total_discount, payments, notes } = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("sales_entries")
    .select("gross_sales")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Sales entry not found" };

  const grossSales = Number(existing.gross_sales);
  const discount = Math.min(total_discount, grossSales);
  const serviceCharge = Math.round(grossSales * SERVICE_CHARGE_RATE);
  const taxTotal = Math.round((grossSales - discount + serviceCharge) * TAX_RATE);
  const netSales = grossSales - discount + serviceCharge + taxTotal;

  if (payments.length) {
    const paySum = payments.reduce((s, p) => s + p.amount, 0);
    if (Math.round(paySum) !== Math.round(netSales))
      return { ok: false, error: `Payments (Rp ${Math.round(paySum).toLocaleString("id-ID")}) must equal net sales (Rp ${Math.round(netSales).toLocaleString("id-ID")})` };
  }

  const { error } = await supabase
    .from("sales_entries")
    .update({
      entry_date,
      shift: shift || null,
      notes: notes || null,
      total_discount: discount,
      service_charge: serviceCharge,
      tax_total: taxTotal,
      net_sales: netSales,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Replace the payment split.
  await supabase.from("sales_entry_payments").delete().eq("entry_id", id);
  if (payments.length) {
    const { error: payError } = await supabase
      .from("sales_entry_payments")
      .insert(payments.map((p) => ({ entry_id: id, method: p.method, amount: p.amount })));
    if (payError) return { ok: false, error: payError.message };
  }

  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
  return { ok: true, id };
}

export async function deleteSalesEntry(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SALES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  const { data: entry } = await supabase
    .from("sales_entries")
    .select("entry_date")
    .eq("id", id)
    .maybeSingle();

  if (!entry) return { ok: false, error: "Sales entry not found" };

  const { data: entryItems } = await supabase
    .from("sales_entry_items")
    .select("product_id, qty, unit")
    .eq("entry_id", id);

  const productIds = (entryItems ?? []).map((i) => i.product_id);

  // Fetch recipes for all sold products — same lookup createSalesEntry uses to compute deductions
  const { data: recipes } = productIds.length
    ? await supabase
        .from("recipes")
        .select(`
          product_id, yield_qty, recipe_type,
          recipe_items(item_id, quantity, unit, item:items(id, unit, type, on_hand, reserved))
        `)
        .in("product_id", productIds)
    : { data: [] };

  type RecipeRow = {
    product_id: string;
    yield_qty: number;
    recipe_type: string;
    recipe_items: {
      item_id: string;
      quantity: number;
      unit: string;
      item: { id: string; unit: string; type: string; on_hand: number; reserved: number } | null;
    }[];
  };
  const recipeMap = new Map<string, RecipeRow>();
  for (const r of (recipes ?? []) as unknown as RecipeRow[]) {
    recipeMap.set(r.product_id, r);
  }

  // The sold products' own stock — mirrors createSalesEntry's WIP handling
  const { data: soldItems } = productIds.length
    ? await supabase.from("items").select("id, unit, on_hand, reserved").in("id", productIds)
    : { data: [] };
  const soldItemMap = new Map((soldItems ?? []).map((i) => [i.id, i]));

  // Accumulate restorations per ingredient — mirrors createSalesEntry's deduction math, added back
  const restorations = new Map<string, {
    item: { id: string; unit: string; type: string; on_hand: number; reserved: number };
    totalDelta: number; // in item's base unit
  }>();

  for (const it of entryItems ?? []) {
    const recipe = recipeMap.get(it.product_id);
    if (!recipe || !recipe.yield_qty) continue;

    const qtyInBase = Number(it.qty);

    if (recipe.recipe_type === "wip") {
      const soldItem = soldItemMap.get(it.product_id);
      if (!soldItem) continue;

      const neededInBase = convert(qtyInBase, it.unit, soldItem.unit) ?? qtyInBase;
      const existing = restorations.get(it.product_id);
      if (existing) {
        existing.totalDelta += neededInBase;
      } else {
        restorations.set(it.product_id, {
          item: {
            id: soldItem.id,
            unit: soldItem.unit,
            type: "prep_item",
            on_hand: Number(soldItem.on_hand),
            reserved: Number(soldItem.reserved),
          },
          totalDelta: neededInBase,
        });
      }
      continue;
    }

    for (const ri of recipe.recipe_items) {
      if (!ri.item) continue;

      const recipeQtyInBase = convert(ri.quantity, ri.unit, ri.item.unit) ?? ri.quantity;
      const neededInBase = (recipeQtyInBase / recipe.yield_qty) * qtyInBase;

      const existing = restorations.get(ri.item_id);
      if (existing) {
        existing.totalDelta += neededInBase;
      } else {
        restorations.set(ri.item_id, {
          item: {
            id: ri.item.id,
            unit: ri.item.unit,
            type: ri.item.type,
            on_hand: Number(ri.item.on_hand),
            reserved: Number(ri.item.reserved),
          },
          totalDelta: neededInBase,
        });
      }
    }
  }

  // Restore stock (add back what was consumed)
  for (const [itemId, { item, totalDelta }] of restorations) {
    const newOnHand = item.on_hand + totalDelta;
    const currentReserved = item.reserved;

    await supabase
      .from("items")
      .update({ on_hand: newOnHand, updated_by: profile.id })
      .eq("id", itemId);

    await supabase.from("stock_ledger").insert({
      item_id: itemId,
      type: "sales_reversal",
      ref_id: id,
      qty_delta: totalDelta,
      on_hand_after: newOnHand,
      reserved_after: currentReserved,
      note: `Sales entry ${entry.entry_date} deleted — stock restored`,
      created_by: profile.id,
    });
  }

  const { error: deleteError } = await supabase.from("sales_entries").delete().eq("id", id);
  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath("/sales");
  revalidatePath("/inventory", "layout");
  return { ok: true, id };
}
