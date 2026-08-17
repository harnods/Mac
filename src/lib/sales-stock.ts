import type { SupabaseClient } from "@supabase/supabase-js";
import { convert } from "@/lib/units";

/** One sold product line, quantity expressed in `unit`. */
export type SaleLine = { product_id: string; qty: number; unit: string };

// Works for both the request-scoped client and the service-role client.
type StockClient = SupabaseClient;

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

/**
 * Deduct ingredient stock consumed by a set of sold products, following each
 * product's recipe (WIP prep items draw down their own prepped stock directly),
 * and write a `sales_consumption` stock_ledger row per affected item.
 *
 * This is the single source of truth for sales→stock math, shared by the
 * nightly Sales recap (createSalesEntry) and the POS settle-bill flow.
 */
export async function applySalesConsumption(
  supabase: StockClient,
  opts: { entryId: string; items: SaleLine[]; profileId: string; note: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { entryId, items, profileId, note } = opts;
  const productIds = items.map((i) => i.product_id);
  if (productIds.length === 0) return { ok: true };

  // Fetch recipes for all sold products.
  const { data: recipes } = await supabase
    .from("recipes")
    .select(`
      product_id, yield_qty, recipe_type,
      recipe_items(item_id, quantity, unit, item:items(id, unit, type, on_hand, reserved))
    `)
    .in("product_id", productIds);

  const recipeMap = new Map<string, RecipeRow>();
  for (const r of (recipes ?? []) as unknown as RecipeRow[]) {
    recipeMap.set(r.product_id, r);
  }

  // The sold products' own stock — needed for WIP prep items, whose already-
  // prepped on_hand gets drawn down directly.
  const { data: soldItems } = await supabase
    .from("items")
    .select("id, unit, on_hand, reserved")
    .in("id", productIds);
  const soldItemMap = new Map(
    ((soldItems ?? []) as { id: string; unit: string; on_hand: number; reserved: number }[]).map((i) => [i.id, i]),
  );

  // Accumulate deductions per ingredient (multiple products may share ingredients).
  const deductions = new Map<string, {
    item: { id: string; unit: string; type: string; on_hand: number; reserved: number };
    totalDelta: number; // in item's base unit
  }>();

  for (const it of items) {
    const recipe = recipeMap.get(it.product_id);
    if (!recipe || !recipe.yield_qty) continue; // no recipe → skip deduction

    const qtyInBase = it.qty; // in the unit the caller entered

    // A WIP recipe (prep item) was already cooked and stocked via a prep order —
    // selling it draws down that prepped stock directly, not the raw ingredients.
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

  // Apply deductions.
  for (const [itemId, { item, totalDelta }] of deductions) {
    const newOnHand = item.on_hand - totalDelta;
    const currentReserved = item.reserved;

    await supabase
      .from("items")
      .update({ on_hand: newOnHand, updated_by: profileId })
      .eq("id", itemId);

    await supabase.from("stock_ledger").insert({
      item_id: itemId,
      type: "sales_consumption",
      ref_id: entryId,
      qty_delta: -totalDelta,
      on_hand_after: newOnHand,
      reserved_after: currentReserved,
      note,
      created_by: profileId,
    });
  }

  return { ok: true };
}
