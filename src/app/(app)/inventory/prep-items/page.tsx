import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { ImportItemsButton } from "@/components/inventory/import-items-button";
import { ItemsFilter } from "@/components/inventory/items-filter";
import { PrepItemsTable } from "@/components/inventory/prep-items-table";
import { Plus } from "lucide-react";
import { ITEM_TYPE_CONFIG } from "@/lib/item-types";
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
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.INVENTORY_WRITE);
  const supabase = await createClient();

  let itemsQuery = supabase
    .from("items")
    .select("id, name, unit, on_hand, reserved, updated_at, updater:profiles!updated_by(full_name,email)")
    .eq("type", "prep_item")
    .is("deleted_at", null)
    .order("name");

  if (q.trim()) {
    itemsQuery = itemsQuery.ilike("name", `%${q.trim()}%`);
  }

  const { data: items } = await itemsQuery;
  const list = (items ?? []) as unknown as PrepItemRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Prep items</h1>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <ImportItemsButton itemTypeSlug="prep-items" />
            <ItemFormDialog
              itemTypeSlug="prep-items"
              trigger={
                <Button>
                  <Plus className="size-4" /> Add prep item
                </Button>
              }
            />
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
            <ItemFormDialog
              itemTypeSlug="prep-items"
              trigger={<button className="underline"> Add the first one</button>}
            />
          )}
        </div>
      ) : (
        <PrepItemsTable list={list} />
      )}
    </div>
  );
}
