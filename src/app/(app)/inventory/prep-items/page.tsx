import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ImportItemsButton } from "@/components/inventory/import-items-button";
import { ItemsFilter } from "@/components/inventory/items-filter";
import { PrepItemsTable } from "@/components/inventory/prep-items-table";
import { Plus } from "lucide-react";
import { ITEM_TYPE_CONFIG } from "@/lib/item-types";
import { PaginationBar, parsePageSize, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination-bar";
import type { Updater } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type PrepItemRow = {
  id: string;
  name: string;
  unit: string;
  on_hand: number;
  reserved: number;
  updated_at: string;
  updater: Updater | null;
};

export default async function PrepItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; size?: string }>;
}) {
  const { q = "", page: rawPageStr, size: rawSizeStr } = await searchParams;
  const rawPage = Number(rawPageStr ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const PAGE_SIZE = parsePageSize(rawSizeStr);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.INVENTORY_WRITE);
  const supabase = await createClient();

  let itemsQuery = supabase
    .from("items")
    .select("id, name, unit, on_hand, reserved, updated_at, updater:profiles!updated_by(full_name,email)", { count: "exact" })
    .eq("type", "prep_item")
    .is("deleted_at", null)
    .order("name")
    .range(from, to);

  if (q.trim()) {
    itemsQuery = itemsQuery.ilike("name", `%${q.trim()}%`);
  }

  const { data: items, count } = await itemsQuery;
  const list = (items ?? []) as unknown as PrepItemRow[];
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const buildHref = (p: number, size: number = PAGE_SIZE) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (size !== DEFAULT_PAGE_SIZE) sp.set("size", String(size));
    if (p > 1) sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Prep items</h1>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <ImportItemsButton itemTypeSlug="prep-items" />
            <Button asChild>
              <Link href="/inventory/prep-items/new">
                <Plus className="size-4" /> Add prep item
              </Link>
            </Button>
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <ItemsFilter
          categories={[]}
          label="prep items"
          itemTypeSlug="prep-items"
          columnFlags={{
            showCategory: ITEM_TYPE_CONFIG["prep-items"].hasCategories,
            stockMode: ITEM_TYPE_CONFIG["prep-items"].stockMode,
            showCost: ITEM_TYPE_CONFIG["prep-items"].showCost,
            showSellable: ITEM_TYPE_CONFIG["prep-items"].showSellable,
            showDefaultCost: ITEM_TYPE_CONFIG["prep-items"].showDefaultCost,
          }}
        />
      </Suspense>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {q ? "No prep items match your search." : "No prep items yet."}
          {!q && isAdmin && (
            <>
              {" "}
              <Link href="/inventory/prep-items/new" className="underline">
                Add the first one
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <PrepItemsTable list={list} />
      )}
      <PaginationBar page={page} totalPages={totalPages} pageSize={PAGE_SIZE} buildHref={buildHref} buildSizeHref={(s) => buildHref(1, s)} />
    </div>
  );
}
