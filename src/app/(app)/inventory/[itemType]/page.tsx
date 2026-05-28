import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { formatQty } from "@/lib/units";
import { ItemsFilter } from "@/components/inventory/items-filter";
import { ItemTableRow } from "@/components/inventory/item-table-row";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { ITEM_TYPE_CONFIG, type ItemTypeSlug } from "@/lib/item-types";
import type { Category, ItemWithCategory } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ItemTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ itemType: string }>;
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const { itemType } = await params;
  const { q = "", cat } = await searchParams;

  const config = ITEM_TYPE_CONFIG[itemType as ItemTypeSlug];
  if (!config) notFound();

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const isAdmin = profile?.role === "admin";
  const isFiltered = !!q.trim() || !!cat;

  let query = supabase
    .from("items")
    .select("*, categories(id,name), updater:profiles!updated_by(full_name,email)")
    .eq("type", config.dbType)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  if (cat) query = query.eq("category_id", cat);

  const [{ data: items }, { data: categories }] = await Promise.all([
    query,
    config.hasCategories
      ? supabase.from("categories").select("id,name").eq("type", config.dbType).order("name")
      : Promise.resolve({ data: [] }),
  ]);

  const list = (items ?? []) as ItemWithCategory[];
  const cats = (categories ?? []) as Category[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{config.label}</h1>
        </div>
        {isAdmin && (
          <ItemFormDialog
            itemTypeSlug={itemType as ItemTypeSlug}
            trigger={
              <Button>
                <Plus className="size-4" /> Add {config.singular.toLowerCase()}
              </Button>
            }
          />
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
          <div className="border table-outer rounded-lg overflow-x-auto hidden md:block">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Name</TableHead>
                  {config.hasCategories && <TableHead className="w-36">Category</TableHead>}
                  {config.stockMode === 'full' && <TableHead className="w-32">On hand</TableHead>}
                  {config.stockMode === 'full' && <TableHead className="w-32">Reserved</TableHead>}
                  {config.stockMode !== 'none' && <TableHead className="w-32">Available</TableHead>}
                  {config.showCost && <TableHead className="w-32 text-right">Last cost</TableHead>}
                  {config.showCost && <TableHead className="w-32 text-right">Avg. cost</TableHead>}
                  <TableHead className="w-44">Last updated</TableHead>
                  <TableHead />
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((it) => (
                  <ItemTableRow
                    key={it.id}
                    item={it}
                    isAdmin={isAdmin}
                    itemTypeSlug={itemType}
                    showCategory={config.hasCategories}
                    stockMode={config.stockMode}
                    showCost={config.showCost}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

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
    </div>
  );
}
