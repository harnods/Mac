import { effectiveUnitCost, type CostableItem, type CostSource } from "@/lib/cogs";
import { convertToItemUnit } from "@/lib/units";
import { createClient } from "@/lib/supabase/server";
import type { UnitCode } from "@/lib/supabase/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type RecipeCostSource = CostSource | "recipe";

export type ItemForCost = CostableItem & { id: string; type: string };

export type RecipeCostLine = {
  cost: number | null;
  source: RecipeCostSource | null;
};

export type RecipeCostSummary = {
  lines: RecipeCostLine[];
  totalCost: number;
  hasIncompleteCost: boolean;
  costPerYieldUnit: number;
};

type RecipeItemForCost = { quantity: number; unit: UnitCode; item: ItemForCost | null };

type ProducingRecipe = {
  yield_qty: number;
  unit: string | null;
  recipe_items: RecipeItemForCost[];
};

/** The recipe whose output (`product_id`) is this item, if any — i.e. the
 * recipe that produces this prep item in-house. */
async function fetchProducingRecipe(supabase: Supabase, itemId: string): Promise<ProducingRecipe | null> {
  const { data: recipe } = await supabase
    .from("recipes")
    .select(
      "yield_qty, unit, recipe_items(quantity, unit, item:items(id,unit,type,last_purchase_cost,avg_purchase_cost,default_purchase_cost,default_purchase_cost_unit,purchase_unit,purchase_unit_qty))"
    )
    .eq("product_id", itemId)
    .maybeSingle();

  if (!recipe || !recipe.recipe_items?.length) return null;
  return recipe as unknown as ProducingRecipe;
}

/**
 * Resolves an item's effective cost per its own base unit. Purchased items
 * are priced from purchase history (avg/last) or a manual default estimate.
 * Prep items (WIP) with none of those — because they're produced in-house,
 * not bought — are priced by recursively computing the COGS of the recipe
 * that produces them, divided by that recipe's own yield.
 *
 * `visited` tracks the ancestor chain (not a global "already seen" set) so
 * the same prep item can legitimately appear more than once across sibling
 * branches without being mistaken for a cycle.
 */
async function resolveItemCost(
  supabase: Supabase,
  item: ItemForCost,
  visited: ReadonlySet<string>,
): Promise<{ value: number; source: RecipeCostSource; incomplete: boolean } | null> {
  const direct = effectiveUnitCost(item);
  if (direct) return { ...direct, incomplete: false };

  if (item.type !== "prep_item" || visited.has(item.id)) return null;

  const recipe = await fetchProducingRecipe(supabase, item.id);
  if (!recipe) return null;

  const nextVisited = new Set(visited);
  nextVisited.add(item.id);

  const summary = await calculateRecipeCostRecursive(supabase, recipe.recipe_items, recipe.yield_qty, nextVisited);

  return { value: summary.costPerYieldUnit, source: "recipe", incomplete: summary.hasIncompleteCost };
}

/**
 * Sums ingredient cost across a recipe's lines, recursing into any prep-item
 * ingredient's own recipe when that prep item has no purchase cost of its
 * own. Each line's quantity is converted into its ingredient's base unit
 * first (recipe lines can record quantity in a different, compatible unit).
 */
export async function calculateRecipeCostRecursive(
  supabase: Supabase,
  recipeItems: RecipeItemForCost[],
  yieldQty: number,
  visited: ReadonlySet<string> = new Set(),
): Promise<RecipeCostSummary> {
  let totalCost = 0;
  let hasIncompleteCost = false;
  const lines: RecipeCostLine[] = [];

  for (const ri of recipeItems) {
    if (!ri.item) {
      hasIncompleteCost = true;
      lines.push({ cost: null, source: null });
      continue;
    }
    const unitCost = await resolveItemCost(supabase, ri.item, visited);
    if (!unitCost) {
      hasIncompleteCost = true;
      lines.push({ cost: null, source: null });
      continue;
    }
    if (unitCost.incomplete) hasIncompleteCost = true;
    const qtyInItemUnit = convertToItemUnit(ri.quantity, ri.unit, ri.item);
    const lineCost = qtyInItemUnit * unitCost.value;
    totalCost += lineCost;
    lines.push({ cost: lineCost, source: unitCost.source });
  }

  return {
    lines,
    totalCost,
    hasIncompleteCost,
    costPerYieldUnit: yieldQty > 0 ? totalCost / yieldQty : totalCost,
  };
}

export type ComputedRecipeCost = {
  totalCost: number;
  yieldQty: number;
  yieldUnit: string;
  costPerBaseUnit: number;
  hasIncompleteCost: boolean;
};

/**
 * For display purposes (e.g. an ingredient drawer): resolves the recipe
 * that produces a prep item and summarizes its cost, yield, and the
 * resulting cost-per-base-unit — the same number `resolveItemCost` uses
 * when this item is priced as an ingredient elsewhere. Returns null if the
 * item isn't produced by any recipe (e.g. a purchased ingredient, or a prep
 * item with no recipe set up yet).
 */
export async function resolveComputedRecipeCost(
  supabase: Supabase,
  itemId: string,
  itemUnit: string,
): Promise<ComputedRecipeCost | null> {
  const recipe = await fetchProducingRecipe(supabase, itemId);
  if (!recipe) return null;

  const summary = await calculateRecipeCostRecursive(supabase, recipe.recipe_items, recipe.yield_qty, new Set([itemId]));

  return {
    totalCost: summary.totalCost,
    yieldQty: recipe.yield_qty,
    yieldUnit: recipe.unit ?? itemUnit,
    costPerBaseUnit: summary.costPerYieldUnit,
    hasIncompleteCost: summary.hasIncompleteCost,
  };
}
