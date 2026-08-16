"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { convert } from "@/lib/units";

type ActionResult = { ok: true; id: string } | { ok: false; error: string };

// Restaurant charges: service charge on gross (before discount), PB1 tax on the
// discounted amount plus service charge.
const SERVICE_CHARGE_RATE = 0.05;
const TAX_RATE = 0.10;

const createSalesEntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift: z.string().trim().max(60).optional(),
  total_discount: z.coerce.number().nonnegative().optional().default(0),
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
  const { entry_date, shift, total_discount, notes, items } = parsed.data;

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

  // Fetch recipes for all sold products
  const { data: recipes } = await supabase
    .from("recipes")
    .select(`
      product_id, yield_qty, recipe_type,
      recipe_items(item_id, quantity, unit, item:items(id, unit, type, on_hand, reserved))
    `)
    .in("product_id", productIds);

  // Build map: product_id → recipe
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

  // Fetch the sold products' own stock — needed for WIP prep items, whose
  // already-prepped on_hand gets drawn down directly (see below).
  const { data: soldItems } = await supabase
    .from("items")
    .select("id, unit, on_hand, reserved")
    .in("id", productIds);
  const soldItemMap = new Map((soldItems ?? []).map((i) => [i.id, i]));

  // Accumulate deductions per ingredient (multiple products may share ingredients)
  const deductions = new Map<string, {
    item: { id: string; unit: string; type: string; on_hand: number; reserved: number };
    totalDelta: number; // in item's base unit
  }>();

  for (const it of items) {
    const recipe = recipeMap.get(it.product_id);
    if (!recipe || !recipe.yield_qty) continue; // no recipe → skip deduction

    // qty sold in the product's base unit
    const qtyInBase = it.qty; // already in the unit the user entered

    // A WIP recipe (prep item) was already cooked and stocked via a prep
    // order — selling it draws down that already-prepped stock directly,
    // it does NOT re-consume the WIP recipe's raw ingredients again.
    if (recipe.recipe_type === "wip") {
      const soldItem = soldItemMap.get(it.product_id);
      if (!soldItem) continue;

      const neededInBase = convert(it.qty, it.unit, soldItem.unit) ?? qtyInBase;
      const existing = deductions.get(it.product_id);
      if (existing) {
        existing.totalDelta += neededInBase;
      } else {
        deductions.set(it.product_id, {
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

      // qty of this ingredient needed per 1 sold unit = recipe_qty / yield_qty
      // total needed = (recipe_qty / yield_qty) × qty_sold
      const recipeQtyInBase = convert(ri.quantity, ri.unit, ri.item.unit) ?? ri.quantity;
      const neededInBase = (recipeQtyInBase / recipe.yield_qty) * qtyInBase;

      const existing = deductions.get(ri.item_id);
      if (existing) {
        existing.totalDelta += neededInBase;
      } else {
        deductions.set(ri.item_id, {
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

  // Apply deductions
  for (const [itemId, { item, totalDelta }] of deductions) {
    const newOnHand = item.on_hand - totalDelta;
    const currentReserved = item.reserved;

    await supabase
      .from("items")
      .update({ on_hand: newOnHand, updated_by: profile.id })
      .eq("id", itemId);

    await supabase.from("stock_ledger").insert({
      item_id: itemId,
      type: "sales_consumption",
      ref_id: entry.id,
      qty_delta: -totalDelta,
      on_hand_after: newOnHand,
      reserved_after: currentReserved,
      note: `Sales entry ${entry_date}`,
      created_by: profile.id,
    });
  }

  revalidatePath("/sales");
  revalidatePath("/inventory", "layout");
  return { ok: true, id: entry.id };
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
