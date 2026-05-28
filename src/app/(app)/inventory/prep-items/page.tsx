import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { ItemsFilter } from "@/components/inventory/items-filter";
import { Plus } from "lucide-react";
import { formatNum } from "@/lib/units";
import { formatDate, updaterName } from "@/lib/format";
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
  const isAdmin = profile?.role === "admin";
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
          <ItemFormDialog
            itemTypeSlug="prep-items"
            trigger={
              <Button>
                <Plus className="size-4" /> Add prep item
              </Button>
            }
          />
        )}
      </div>

      <Suspense fallback={null}>
        <ItemsFilter categories={[]} label="prep items" />
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
        <div className="border table-outer rounded-lg overflow-hidden">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-36">On hand</TableHead>
                <TableHead className="w-44">Last updated</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((item) => {
                const available = Number(item.on_hand) - Number(item.reserved);

                return (
                  <ClickableTableRow key={item.id} href={`/inventory/prep-items/${item.id}`}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatNum(available)}{" "}
                      <span className="text-muted-foreground">{item.unit}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{updaterName(item.updater)}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(item.updated_at)}</div>
                    </TableCell>
                    <TableCell />
                  </ClickableTableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
