import { convert, convertToItemUnit } from "@/lib/units";
import type { UnitCode } from "@/lib/supabase/types";

export type CostSource = "avg" | "last" | "default";

export type CostableItem = {
  unit: UnitCode;
  last_purchase_cost: number | null;
  avg_purchase_cost: number | null;
  default_purchase_cost: number | null;
  default_purchase_cost_unit: UnitCode | null;
  purchase_unit?: UnitCode | null;
  purchase_unit_qty?: number | null;
};

/**
 * Converts a cost value denominated in `costUnit` into cost-per-`item.unit`.
 * Cost conversion is the inverse of quantity conversion (Rp10/g → Rp10000/kg,
 * not Rp10/1000), so the universal-group args are swapped relative to
 * convertToItemUnit, and the custom purchase-unit ratio divides instead of
 * multiplies.
 */
export function costToItemUnit(
  cost: number,
  costUnit: UnitCode,
  item: { unit: UnitCode; purchase_unit?: UnitCode | null; purchase_unit_qty?: number | null },
): number | null {
  if (costUnit === item.unit) return cost;
  const viaGroup = convert(cost, item.unit, costUnit);
  if (viaGroup != null) return viaGroup;
  if (item.purchase_unit && costUnit === item.purchase_unit && item.purchase_unit_qty) {
    return cost / item.purchase_unit_qty;
  }
  return null;
}

/**
 * Picks the best available cost-per-base-unit for an ingredient: average
 * purchase cost (most representative of real spend) > last purchase cost
 * (most recent) > default purchase cost (a manual estimate used before any
 * purchase has been recorded).
 */
export function effectiveUnitCost(item: CostableItem): { value: number; source: CostSource } | null {
  if (item.avg_purchase_cost != null) return { value: item.avg_purchase_cost, source: "avg" };
  if (item.last_purchase_cost != null) return { value: item.last_purchase_cost, source: "last" };
  if (item.default_purchase_cost != null) {
    const unit = item.default_purchase_cost_unit ?? item.unit;
    const converted = costToItemUnit(item.default_purchase_cost, unit, item);
    if (converted != null) return { value: converted, source: "default" };
  }
  return null;
}

/**
 * When default_purchase_cost is denominated in something other than the
 * item's own base unit (e.g. Rp130,000/pack for a pcs-based item), returns
 * the equivalent cost per base unit for display as a breakdown line (e.g.
 * "Rp2,600/pcs"). Returns null if there's nothing to break down (no default
 * cost, or it's already per base unit).
 */
export function defaultCostBreakdown(item: CostableItem): number | null {
  if (item.default_purchase_cost == null) return null;
  const unit = item.default_purchase_cost_unit ?? item.unit;
  if (unit === item.unit) return null;
  return costToItemUnit(item.default_purchase_cost, unit, item);
}

export type RecipeCostLine = {
  cost: number | null;
  source: CostSource | null;
};

export type RecipeCostSummary = {
  lines: RecipeCostLine[];
  totalCost: number;
  hasIncompleteCost: boolean;
  costPerYieldUnit: number;
};

/**
 * Sums ingredient cost across a recipe's lines. Each recipe_item's quantity
 * is first converted into its ingredient's own base unit (recipe lines can
 * record quantity in a different — but compatible — unit), then priced at
 * that ingredient's effective unit cost.
 */
export function calculateRecipeCost(
  recipeItems: { quantity: number; unit: UnitCode; item: CostableItem | null }[],
  yieldQty: number,
): RecipeCostSummary {
  let totalCost = 0;
  let hasIncompleteCost = false;
  const lines: RecipeCostLine[] = [];

  for (const ri of recipeItems) {
    if (!ri.item) {
      hasIncompleteCost = true;
      lines.push({ cost: null, source: null });
      continue;
    }
    const unitCost = effectiveUnitCost(ri.item);
    if (!unitCost) {
      hasIncompleteCost = true;
      lines.push({ cost: null, source: null });
      continue;
    }
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
