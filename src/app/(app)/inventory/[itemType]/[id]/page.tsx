import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { ItemStockSection } from "@/components/inventory/item-stock-section";
import { ItemPhotoThumbnail } from "@/components/inventory/item-photo-thumbnail";
import { LinkedRecipeIngredientsTable } from "@/components/inventory/linked-recipe-ingredients-table";
import { SetIncludedProductsTable } from "@/components/inventory/set-included-products-table";
import { updaterName } from "@/lib/format";
import { ItemDetailActions } from "@/components/inventory/item-detail-actions";
import { ProductStatusButton } from "@/components/inventory/product-status-button";
import { ITEM_TYPE_CONFIG, type ItemTypeSlug } from "@/lib/item-types";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { ItemUsageTabs, type LedgerRow, type UsedInRecipeRow } from "@/components/inventory/item-usage-tabs";
import type { UnitConversionRow } from "@/components/inventory/unit-conversions-panel";
import type { ItemWithCategory } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ itemType: string; id: string }>;
}) {
  const { itemType, id } = await params;
  const config = ITEM_TYPE_CONFIG[itemType as ItemTypeSlug];
  if (!config) notFound();

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [
    { data, error },
    { data: ledgerData },
    { data: setItemsData },
    { data: recipeData },
    { data: usageData },
    { data: conversionData },
  ] = await Promise.all([
    supabase
      .from("items")
      .select("*, categories(id,name), updater:profiles!updated_by(full_name,email)")
      .eq("id", id)
      .eq("type", config.dbType)
      .maybeSingle(),
    config.stockMode !== 'none'
      ? supabase
          .from("stock_ledger")
          .select("id, type, ref_id, qty_delta, on_hand_after, reserved_after, note, created_at")
          .eq("item_id", id)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    config.dbType === 'product'
      ? supabase
          .from("product_set_items")
          .select("product_id, qty, product:items!product_id(id, name, unit)")
          .eq("set_id", id)
      : Promise.resolve({ data: [] }),
    config.dbType === 'product'
      ? supabase
          .from("recipes")
          .select("id, name, recipe_items(id, quantity, unit, item:items!item_id(id, name, deleted_at))")
          .eq("product_id", id)
          .eq("recipe_type", "product")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    config.dbType === 'ingredient'
      ? supabase
          .from("recipe_items")
          .select("quantity, unit, recipe:recipes(id, name, recipe_type, product:items!product_id(id, name, type, unit))")
          .eq("item_id", id)
      : Promise.resolve({ data: [] }),
    config.dbType === 'ingredient'
      ? supabase
          .from("item_unit_conversions")
          .select("id, from_unit, factor, to_unit")
          .eq("item_id", id)
          .order("from_unit")
      : Promise.resolve({ data: [] }),
  ]);

  if (error || !data) notFound();
  const item = data as ItemWithCategory & { product_kind?: string; status?: string };
  const isAdmin = can(profile, P.INVENTORY_WRITE);
  const ledger = (ledgerData ?? []) as LedgerRow[];
  const unitConversions = (conversionData ?? []) as UnitConversionRow[];
  const setItems = (setItemsData ?? []) as unknown as { product_id: string; qty: number; product: { id: string; name: string; unit: string } | null }[];
  const usedInRecipes = ((usageData ?? []) as unknown as {
    quantity: number;
    unit: string;
    recipe: {
      id: string;
      name: string;
      recipe_type: string;
      product: { id: string; name: string; type: string; unit: string } | null;
    } | null;
  }[])
    .filter((row) => row.recipe)
    .map((row) => ({
      id: row.recipe!.id,
      name: row.recipe!.name,
      recipeType: row.recipe!.recipe_type,
      quantity: row.quantity,
      unit: row.unit,
      product: row.recipe!.product,
    })) satisfies UsedInRecipeRow[];

  type RecipeIngredient = { id: string; quantity: number; unit: string; item: { id: string; name: string; deleted_at: string | null } | null };
  type LinkedRecipe = { id: string; name: string; recipe_items: RecipeIngredient[] };
  const linkedRecipe = recipeData as LinkedRecipe | null;

  const onHand = Number(item.on_hand);
  const reserved = Number(item.reserved);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {config.showPhoto && (
            <ItemPhotoThumbnail imageUrl={item.image_url} name={item.name} className="size-16" />
          )}
          <div>
            <PageBreadcrumb
              items={[{ label: config.label, href: `/inventory/${itemType}` }]}
            />
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
              {item.status === "draft" && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Draft
                </span>
              )}
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {config.dbType === "product" && item.status != null && (
              <ProductStatusButton
                id={id}
                status={(item.status ?? "active") as "active" | "draft"}
              />
            )}
            <ItemDetailActions
              itemTypeSlug={itemType as ItemTypeSlug}
              itemId={item.id}
              name={item.name}
              backUrl={`/inventory/${itemType}`}
            />
          </div>
        )}
      </div>

      <div className="max-w-2xl">
        <ItemStockSection
          baseUnit={item.unit}
          onHand={onHand}
          reserved={reserved}
          stockMode={config.stockMode}
          hasCategories={config.hasCategories}
          categoryName={item.categories?.name ?? null}
          lastPurchaseCost={item.last_purchase_cost}
          avgPurchaseCost={item.avg_purchase_cost}
          defaultPurchaseCost={item.default_purchase_cost}
          defaultPurchaseCostUnit={item.default_purchase_cost_unit}
          purchaseUnit={item.purchase_unit}
          purchaseUnitQty={item.purchase_unit_qty}
          updatedAt={item.updated_at}
          updaterLabel={item.updater ? updaterName(item.updater) : null}
        />
      </div>

      {/* Recipe — product only */}
      {config.dbType === "product" && !linkedRecipe && isAdmin && (
        <div className="space-y-2 max-w-2xl">
          <h2 className="text-sm font-medium">Recipe</h2>
          <p className="text-sm text-muted-foreground">
            No recipe yet.{" "}
            <Link href={`/recipes/new?productId=${item.id}&type=product`} className="underline hover:text-foreground">
              Create recipe
            </Link>
          </p>
        </div>
      )}
      {linkedRecipe && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium">Recipe</h2>
            <Link href={`/recipes/${linkedRecipe.id}`} className="text-xs text-muted-foreground hover:text-foreground underline">
              {linkedRecipe.name} →
            </Link>
          </div>
          {linkedRecipe.recipe_items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ingredients in recipe.</p>
          ) : (
            <LinkedRecipeIngredientsTable ingredients={linkedRecipe.recipe_items} />
          )}
        </div>
      )}

      {/* Included products — set only */}
      {item.product_kind === "set" && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Included products</h2>
          {setItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No products in this set.</p>
          ) : (
            <SetIncludedProductsTable items={setItems} />
          )}
        </div>
      )}

      {/* Stock and usage — only for items with stock */}
      {config.stockMode !== 'none' && (
        <ItemUsageTabs
          ledger={ledger}
          itemUnit={item.unit}
          usedInRecipes={config.dbType === "ingredient" ? usedInRecipes : undefined}
          unitConversions={config.dbType === "ingredient" ? unitConversions : undefined}
          itemId={item.id}
          canEditConversions={isAdmin}
          itemName={item.name}
          onHand={onHand}
          purchaseUnit={item.purchase_unit}
          purchaseUnitQty={item.purchase_unit_qty}
          canManualAdjust={isAdmin && (config.dbType === "ingredient" || config.dbType === "supply")}
          showReserved={config.stockMode === "full"}
        />
      )}
    </div>
  );
}
