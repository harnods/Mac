import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P, canAccessRecipeStation } from "@/lib/permissions";
import { ItemDetailActions } from "@/components/inventory/item-detail-actions";
import { PrepItemSaleSection } from "@/components/inventory/prep-item-sale-section";
import { RecipeDrawerTrigger } from "@/components/recipes/recipe-drawer";
import { DetailBackButton } from "@/components/employees/detail-back-button";
import { DetailSection, DetailRow } from "@/components/ui/detail-list";
import { Badge } from "@/components/ui/badge";
import { Qty } from "@/components/ui/qty";
import { formatDate, updaterName } from "@/lib/format";
import { PrepOrderHistoryTable } from "@/components/inventory/prep-order-history-table";
import { ItemUsageTabs, type LedgerRow, type UsedInRecipeRow } from "@/components/inventory/item-usage-tabs";
import type { Updater } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type PrepOrder = {
  id: string;
  status: string;
  target_qty: number | null;
  qty_to_prep: number | null;
  yield_variance_reason: string | null;
  planned_date: string;
};

export default async function PrepItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!can(profile, P.PREP_ITEMS_READ)) notFound();
  const isAdmin = can(profile, P.PREP_ITEMS_WRITE);
  const supabase = await createClient();

  const [{ data: itemData, error }, { data: ordersData }, { data: recipeData }, { data: catData }, { data: unitData }, { data: ledgerData }, { data: usageData }] =
    await Promise.all([
      supabase
        .from("items")
        .select("id, name, unit, on_hand, reserved, is_sellable, sell_price, station, description, category_id, image_url, updated_at, updater:profiles!updated_by(full_name,email)")
        .eq("id", id)
        .eq("type", "prep_item")
        .maybeSingle(),
      supabase
        .from("prep_orders")
        .select("id, status, target_qty, qty_to_prep, yield_variance_reason, planned_date")
        .eq("product_id", id)
        .order("planned_date", { ascending: false }),
      supabase
        .from("recipes")
        .select("id, name, station")
        .eq("product_id", id)
        .maybeSingle(),
      supabase.from("categories").select("id, name").eq("type", "product").order("name"),
      supabase.from("units").select("code").order("is_system", { ascending: false }).order("code"),
      supabase
        .from("stock_ledger")
        .select("id, type, ref_id, qty_delta, on_hand_after, reserved_after, note, created_at")
        .eq("item_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("recipe_items")
        .select("quantity, unit, recipe:recipes(id, name, recipe_type, product:items!product_id(id, name, type, unit))")
        .eq("item_id", id),
    ]);

  if (error || !itemData) notFound();
  // Station scope: hide a prep item whose producing recipe is outside this role's station.
  if (!canAccessRecipeStation(profile, (recipeData as { station?: string | null } | null)?.station ?? null)) notFound();

  const item = itemData as unknown as {
    id: string; name: string; unit: string; on_hand: number; reserved: number;
    is_sellable: boolean; sell_price: number | null; station: string | null;
    description: string | null; category_id: string | null; image_url: string | null;
    updated_at: string; updater: Updater | null;
  };
  const orders = (ordersData ?? []) as PrepOrder[];
  const recipe = recipeData as { id: string; name: string } | null;
  const productCategories = (catData ?? []) as { id: string; name: string }[];
  const unitList = (unitData ?? []).map((u: { code: string }) => u.code);
  const ledger = (ledgerData ?? []) as LedgerRow[];
  const usedInRecipes = ((usageData ?? []) as unknown as {
    quantity: number;
    unit: string;
    recipe: { id: string; name: string; recipe_type: string; product: { id: string; name: string; type: string; unit: string } | null } | null;
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

  const available = Number(item.on_hand) - Number(item.reserved);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DetailBackButton href="/inventory/prep-items" />
          <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
          <Badge variant="secondary">Prep item</Badge>
        </div>
        {isAdmin && (
          <ItemDetailActions
            itemTypeSlug="prep-items"
            itemId={item.id}
            name={item.name}
            backUrl="/inventory/prep-items"
          />
        )}
      </div>

      {isAdmin && (
        <PrepItemSaleSection
          item={{
            id: item.id,
            is_sellable: item.is_sellable,
            sell_price: item.sell_price,
            station: item.station,
            description: item.description,
            category_id: item.category_id,
            image_url: item.image_url,
            unit: item.unit,
          }}
          categories={productCategories}
          units={unitList}
        />
      )}

      {/* Details */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 lg:col-span-6">
          <DetailSection title="Details">
            <DetailRow label="On hand" value={<span className="tabular-nums"><Qty value={available} unit={item.unit} /></span>} />
            <DetailRow
              label="Recipe"
              value={recipe ? (
                <RecipeDrawerTrigger recipeId={recipe.id} recipeName={recipe.name} />
              ) : (
                <span className="text-muted-foreground">
                  No recipe yet.{" "}
                  <Link href={`/recipes/new?productId=${item.id}&type=wip`} className="underline hover:text-foreground">
                    Create recipe
                  </Link>
                </span>
              )}
            />
            <DetailRow label="Last updated" value={`${updaterName(item.updater)} · ${formatDate(item.updated_at)}`} />
          </DetailSection>
        </div>
      </div>

      {/* Stock history + used-in-recipes tabs (same as ingredients) */}
      <ItemUsageTabs
        ledger={ledger}
        itemUnit={item.unit}
        usedInRecipes={usedInRecipes}
        onHand={Number(item.on_hand)}
        showReserved
      />

      {/* Prep orders */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Prep orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No prep orders yet.</p>
        ) : (
          <PrepOrderHistoryTable orders={orders} itemUnit={item.unit} />
        )}
      </section>
    </div>
  );
}
