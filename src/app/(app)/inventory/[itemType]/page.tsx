import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatQty } from "@/lib/units";
import { ItemsFilter } from "@/components/inventory/items-filter";
import { ItemBulkTable } from "@/components/inventory/item-bulk-table";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { ImportItemsButton } from "@/components/inventory/import-items-button";
import { ITEM_TYPE_CONFIG, type ItemTypeSlug } from "@/lib/item-types";
import type { Category, ItemWithCategory } from "@/lib/supabase/types";
import { PaginationBar } from "@/components/ui/pagination-bar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function ItemTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ itemType: string }>;
  searchParams: Promise<{ q?: string; cat?: string; page?: string }>;
}) {
  const { itemType } = await params;
  const { q = "", cat, page: rawPageStr } = await searchParams;
  const rawPage = Number(rawPageStr ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const config = ITEM_TYPE_CONFIG[itemType as ItemTypeSlug];
  if (!config) notFound();

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const isAdmin = can(profile, P.INVENTORY_WRITE);
  const isFiltered = !!q.trim() || !!cat;

  let query = supabase
    .from("items")
    .select("*, categories(id,name), updater:profiles!updated_by(full_name,email)", { count: "exact" })
    .eq("type", config.dbType)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  if (cat) query = query.eq("category_id", cat);

  const [{ data: items, count }, { data: categories }, { data: recipeLinks }] = await Promise.all([
    query,
    config.hasCategories
      ? supabase.from("categories").select("id,name").eq("type", config.dbType).order("name")
      : Promise.resolve({ data: [] }),
    config.dbType === "product"
      ? supabase.from("recipes").select("product_id").eq("recipe_type", "product").not("product_id", "is", null)
      : Promise.resolve({ data: [] }),
  ]);

  const list = (items ?? []) as ItemWithCategory[];
  const cats = (categories ?? []) as Category[];
  const linkedRecipeProductIds = new Set((recipeLinks ?? []).map((r: { product_id: string }) => r.product_id));
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const buildHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (cat) sp.set("cat", cat);
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
            <ItemFormDialog
              itemTypeSlug={itemType as ItemTypeSlug}
              trigger={
                <Button>
                  <Plus className="size-4" /> Add {config.singular.toLowerCase()}
                </Button>
              }
            />
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <ItemsFilter categories={cats} label={config.label.toLowerCase()} />
      </Suspense>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {isFiltered ? `No ${config.label.toLowerCase()} match your search.` : `No ${config.label.toLowerCase()} yet.`}
          {!isFiltered && isAdmin && (
            <>
              {" "}
              <ItemFormDialog
                itemTypeSlug={itemType as ItemTypeSlug}
                trigger={
                  <button className="underline">
                    Add the first {config.singular.toLowerCase()}
                  </button>
                }
              />
              .
            </>
          )}
        </div>
      ) : (
        <>
          <ItemBulkTable
            items={list}
            categories={cats}
            isAdmin={isAdmin}
            itemTypeSlug={itemType as ItemTypeSlug}
            showCategory={config.hasCategories}
            stockMode={config.stockMode}
            showCost={config.showCost}
            showSellable={config.showSellable}
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
                    {formatQty(Number(it.on_hand) - Number(it.reserved), it.unit)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
      <PaginationBar page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
