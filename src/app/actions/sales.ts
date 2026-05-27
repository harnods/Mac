"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { convert } from "@/lib/units";

type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const createSalesEntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
  if (!profile || profile.role !== "admin") return { ok: false, error: "Admin only" };

  const parsed = createSalesEntrySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { entry_date, notes, items } = parsed.data;

  // Check for duplicate products
  const productIds = items.map((i) => i.product_id);
  if (new Set(productIds).size !== productIds.length)
    return { ok: false, error: "Duplicate products are not allowed" };

  const supabase = await createClient();

  // Create the sales entry
  const { data: entry, error: entryError } = await supabase
    .from("sales_entries")
    .insert({ entry_date, notes: notes || null, created_by: profile.id })
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
      product_id, yield_qty,
      recipe_items(item_id, quantity, unit, item:items(id, unit, type, on_hand, reserved))
    `)
    .in("product_id", productIds);

  // Build map: product_id → recipe
  type RecipeRow = {
    product_id: string;
    yield_qty: number;
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
