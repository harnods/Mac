import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, canViewCost, itemWritePermission, itemReadPermission, allowedRecipeStations, type RecipeStationKey } from "@/lib/permissions";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Qty } from "@/components/ui/qty";
import { ItemsFilter } from "@/components/inventory/items-filter";
import { ItemBulkTable } from "@/components/inventory/item-bulk-table";
import { ImportItemsButton } from "@/components/inventory/import-items-button";
import { ITEM_TYPE_CONFIG, type ItemTypeSlug } from "@/lib/item-types";
import type { Category, ItemWithCategory } from "@/lib/supabase/types";
import { PaginationBar, parsePageSize, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination-bar";

export const dynamic = "force-dynamic";


export default async function ItemTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ itemType: string }>;
  searchParams: Promise<{ q?: string; cat?: string; page?: string; size?: string }>;
}) {
  const { itemType } = await params;
  const { q = "", cat, page: rawPageStr, size: rawSizeStr } = await searchParams;
  const rawPage = Number(rawPageStr ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const PAGE_SIZE = parsePageSize(rawSizeStr);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const config = ITEM_TYPE_CONFIG[itemType as ItemTypeSlug];
  if (!config) notFound();

  const profile = await getCurrentProfile();
  if (!can(profile, itemReadPermission(config.dbType))) return <AccessDenied label={config.label} />;
  const supabase = await createClient();
  const isAdmin = can(profile, itemWritePermission(config.dbType));
  // Cost is confidential — only the Super admin role may see it. Non-super-admins
  // get the cost columns hidden AND the values stripped from the payload below.
  const viewCost = canViewCost(profile);
  const showCost = config.showCost && viewCost;
  const showDefaultCost = config.showDefaultCost && viewCost;
  const isFiltered = !!q.trim() || !!cat;

  let query = supabase
    .from("items")
    .select("*, categories(id,name), location:locations(id,name), updater:profiles!updated_by(full_name,email), item_unit_conversions(from_unit, factor, to_unit)", { count: "exact" })
    .eq("type", config.dbType)
    .is("deleted_at", null)
    .order("name")
    .range(from, to);

  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  if (cat) query = query.eq("category_id", cat);

  // For products, resolve their linked product-recipes up front (with station) so
  // we can badge them AND hide products whose recipe station this role can't
  // access (e.g. a kitchen-only role never sees bar/drink products).
  const productRecipes: { product_id: string; station: string | null }[] =
    config.dbType === "product"
      ? ((
          await supabase
            .from("recipes")
            .select("product_id, station")
            .eq("recipe_type", "product")
            .not("product_id", "is", null)
        ).data ?? [])
      : [];

  const allowedStations = allowedRecipeStations(profile);
  if (config.dbType === "product" && allowedStations) {
    const hidden = productRecipes
      .filter((r) => r.station != null && !allowedStations.includes(r.station as RecipeStationKey))
      .map((r) => r.product_id);
    if (hidden.length) query = query.not("id", "in", `(${hidden.join(",")})`);
  }

  const [{ data: items, count }, { data: categories }, { data: locationsData }] = await Promise.all([
    query,
    config.hasCategories
      ? supabase.from("categories").select("id,name").eq("type", config.dbType).order("name")
      : Promise.resolve({ data: [] }),
    config.dbType === "supply"
      ? supabase.from("locations").select("id,name").order("name")
      : Promise.resolve({ data: [] }),
  ]);

  const rawList = (items ?? []) as ItemWithCategory[];
  // Never send cost fields to a client that isn't allowed to view them.
  const list: ItemWithCategory[] = viewCost
    ? rawList
    : rawList.map((it) => ({
        ...it,
        last_purchase_cost: null,
        avg_purchase_cost: null,
        default_purchase_cost: null,
        default_purchase_cost_unit: null,
      }));
  const cats = (categories ?? []) as Category[];
  const locs = (locationsData ?? []) as { id: string; name: string }[];
  const linkedRecipeProductIds = new Set(productRecipes.map((r) => r.product_id));
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const buildHref = (p: number, size: number = PAGE_SIZE) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (cat) sp.set("cat", cat);
    if (size !== DEFAULT_PAGE_SIZE) sp.set("size", String(size));
    if (p > 1) sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{config.label}</h1>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <ImportItemsButton itemTypeSlug={itemType as ItemTypeSlug} />
            <Button asChild>
              <Link href={`/inventory/${itemType}/new`}>
                <Plus className="size-4" /> Add {config.singular.toLowerCase()}
              </Link>
            </Button>
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <ItemsFilter
          categories={cats}
          label={config.label.toLowerCase()}
          itemTypeSlug={itemType as ItemTypeSlug}
          columnFlags={{
            showBrand: config.dbType === "supply",
            showCategory: config.hasCategories,
            showLocation: config.dbType === "supply",
            stockMode: config.stockMode,
            showCost,
            showSellable: config.showSellable,
            showDefaultCost,
            hasRecipeColumn: config.dbType === "product",
          }}
        />
      </Suspense>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {isFiltered ? `No ${config.label.toLowerCase()} match your search.` : `No ${config.label.toLowerCase()} yet.`}
          {!isFiltered && isAdmin && (
            <>
              {" "}
              <Link href={`/inventory/${itemType}/new`} className="underline">
                Add the first {config.singular.toLowerCase()}
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <>
          <ItemBulkTable
            items={list}
            categories={cats}
            locations={locs}
            isAdmin={isAdmin}
            itemTypeSlug={itemType as ItemTypeSlug}
            showPhoto={config.showPhoto}
            showBrand={config.dbType === "supply"}
            showCategory={config.hasCategories}
            showLocation={config.dbType === "supply"}
            stockMode={config.stockMode}
            showCost={showCost}
            showSellable={config.showSellable}
            showDefaultCost={showDefaultCost}
            linkedRecipeProductIds={config.dbType === "product" ? linkedRecipeProductIds : undefined}
          />

          <div className="grid gap-3 md:hidden">
            {list.map((it) => (
              <Link
                key={it.id}
                href={`/inventory/${itemType}/${it.id}`}
                className="border rounded-lg p-4 flex items-center justify-between gap-3 hover:bg-accent/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{it.name}</div>
                  {config.hasCategories && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {it.categories?.name ?? "Uncategorized"}
                    </div>
                  )}
                </div>
                {config.stockMode !== 'none' && (
                  <div className="text-sm tabular-nums whitespace-nowrap">
                    <Qty value={Number(it.on_hand) - Number(it.reserved)} unit={it.unit} />
                  </div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
      <PaginationBar page={page} totalPages={totalPages} pageSize={PAGE_SIZE} buildHref={buildHref} buildSizeHref={(s) => buildHref(1, s)} />
    </div>
  );
}
