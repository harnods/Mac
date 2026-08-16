import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailBackButton } from "@/components/employees/detail-back-button";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P, canAccessRecipeStation, canViewCost } from "@/lib/permissions";
import { convertToPieces, formatNum } from "@/lib/units";
import { formatRp, formatDate, updaterName } from "@/lib/format";
import { Qty } from "@/components/ui/qty";
import { DetailSection, DetailRow } from "@/components/ui/detail-list";
import { RecipeDetailActions } from "@/components/recipes/recipe-detail-actions";
import { RecipeIngredientsList } from "@/components/recipes/recipe-ingredients-list";
import type { CostableItem } from "@/lib/cogs";
import { calculateRecipeCostRecursive } from "@/lib/cogs-server";
import type { RecipeWithItems } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recipes")
    .select(
      "*, recipe_items(id, item_id, quantity, unit, item:items(id,name,unit,type,deleted_at,last_purchase_cost,avg_purchase_cost,default_purchase_cost,default_purchase_cost_unit,purchase_unit,purchase_unit_qty)), updater:profiles!updated_by(full_name,email), product:items!product_id(id,name,unit,type,sell_price)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  type RecipeItemWithCost = {
    id: string;
    item_id: string;
    quantity: number;
    unit: string;
    item: (CostableItem & { id: string; name: string; type: string; deleted_at: string | null }) | null;
  };
  const recipe = data as Omit<RecipeWithItems, "recipe_items"> & {
    recipe_items: RecipeItemWithCost[];
    recipe_type?: string | null;
    unit?: string | null;
    weight_per_pcs?: number | null;
    weight_unit?: string | null;
    product: { id: string; name: string; unit: string; type: string; sell_price: number | null } | null;
  };
  const recipeType: "wip" | "product" =
    recipe.recipe_type === "product" ? "product"
    : recipe.recipe_type === "wip"    ? "wip"
    : recipe.product?.type === "prep_item" ? "wip" : "product";
  const isWip = recipeType === "wip";
  if (!canAccessRecipeStation(profile, recipe.station)) notFound();
  const isAdmin = can(profile, P.RECIPES_WRITE);
  // COGS / margin is confidential — Super admin only.
  const viewCost = canViewCost(profile);

  const cogs = await calculateRecipeCostRecursive(supabase, recipe.recipe_items, recipe.yield_qty);
  const sellPrice = recipe.product?.sell_price ?? null;
  const cogsPercent = !isWip && sellPrice != null && sellPrice > 0 ? (cogs.costPerYieldUnit / sellPrice) * 100 : null;
  const yieldUnit = isWip ? (recipe.unit ?? recipe.product?.unit ?? null) : (recipe.product?.unit ?? null);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DetailBackButton href="/recipes" />
          <h1 className="text-2xl font-semibold tracking-tight">{recipe.name}</h1>
        </div>
        {isAdmin && <RecipeDetailActions id={id} name={recipe.name} />}
      </div>

      {recipe.product && (
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 space-y-8 lg:col-span-6">
            <DetailSection title="Details">
              <DetailRow label="Recipe type" value={isWip ? "For prep item" : "Product"} />
              <DetailRow label="Output" value={recipe.product.name} />
              <DetailRow
                label="Category"
                value={recipe.station ? (recipe.station === "bar" ? "Bar" : "Kitchen") : null}
              />
              <DetailRow
                label="Yield"
                value={
                  <span className="tabular-nums">
                    <Qty value={recipe.yield_qty} unit={isWip ? (recipe.unit ?? recipe.product.unit) : recipe.product.unit} /> per prep
                  </span>
                }
              />
              {recipe.weight_per_pcs != null && (
                <DetailRow
                  label="Weight per pcs"
                  value={
                    <span className="tabular-nums">
                      <Qty value={recipe.weight_per_pcs} unit={recipe.weight_unit ?? "g"} />
                      {yieldUnit != null && (() => {
                        const pcs = convertToPieces(recipe.yield_qty, yieldUnit, recipe.weight_per_pcs, recipe.weight_unit);
                        return pcs != null && isFinite(pcs) ? (
                          <span className="text-muted-foreground"> — {formatNum(pcs)} pcs total</span>
                        ) : null;
                      })()}
                    </span>
                  }
                />
              )}
              <DetailRow
                label="Last updated"
                value={`${formatDate(recipe.updated_at)} by ${updaterName(recipe.updater)}`}
              />
            </DetailSection>
          </div>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Ingredients</h2>
        {recipe.recipe_items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ingredients.</p>
        ) : (
          <RecipeIngredientsList
            showCost={viewCost}
            rows={recipe.recipe_items.map((ri, idx) => ({
              ri,
              // Withhold cost figures from non-super-admins entirely.
              line: viewCost ? cogs.lines[idx] : { ...cogs.lines[idx], cost: null, source: null },
            }))}
          />
        )}
      </section>

      {viewCost && recipe.recipe_items.length > 0 && (
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 space-y-8 lg:col-span-6">
            <DetailSection title="Cost">
              <DetailRow
                label="Total COGS"
                value={
                  <span className="tabular-nums font-medium">
                    {formatRp(cogs.totalCost)}
                    {cogs.hasIncompleteCost && (
                      <span className="text-muted-foreground text-xs font-normal"> (incomplete — some ingredients have no cost data)</span>
                    )}
                  </span>
                }
              />
              {recipe.yield_qty !== 1 && yieldUnit && (
                <DetailRow label={`Cost per ${yieldUnit}`} value={<span className="tabular-nums">{formatRp(cogs.costPerYieldUnit)}</span>} />
              )}
              {sellPrice != null && (
                <DetailRow label="Sell price" value={<span className="tabular-nums">{formatRp(sellPrice)}</span>} />
              )}
              {cogsPercent != null && (
                <DetailRow label="COGS %" value={<span className="tabular-nums">{formatNum(cogsPercent)}%</span>} />
              )}
            </DetailSection>
          </div>
        </div>
      )}
    </div>
  );
}
