import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { ItemActions } from "@/components/inventory/item-actions";
import { SellableToggleButton } from "@/components/inventory/sellable-toggle-button";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { formatNum } from "@/lib/units";
import { Qty } from "@/components/ui/qty";
import { formatDate, updaterName } from "@/lib/format";
import { VarianceIcon } from "@/components/prep-orders/variance-icon";
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
  const isAdmin = can(profile, P.INVENTORY_WRITE);
  const supabase = await createClient();

  const [{ data: itemData, error }, { data: ordersData }] =
    await Promise.all([
      supabase
        .from("items")
        .select("id, name, unit, on_hand, reserved, is_sellable, updated_at, updater:profiles!updated_by(full_name,email)")
        .eq("id", id)
        .eq("type", "prep_item")
        .maybeSingle(),
      supabase
        .from("prep_orders")
        .select("id, status, target_qty, qty_to_prep, yield_variance_reason, planned_date")
        .eq("product_id", id)
        .order("planned_date", { ascending: false }),
    ]);

  if (error || !itemData) notFound();

  const item = itemData as unknown as { id: string; name: string; unit: string; on_hand: number; reserved: number; is_sellable: boolean; updated_at: string; updater: Updater | null };
  const orders = (ordersData ?? []) as PrepOrder[];

  const available = Number(item.on_hand) - Number(item.reserved);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <PageBreadcrumb items={[{ label: "Prep items", href: "/inventory/prep-items" }]} />
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              Prep item
            </span>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <SellableToggleButton id={item.id} isSellable={item.is_sellable} />
            <ItemFormDialog
              itemTypeSlug="prep-items"
              itemId={id}
              trigger={<Button size="sm" variant="outline">Edit</Button>}
            />
            <ItemActions id={item.id} name={item.name} backUrl="/inventory/prep-items" />
          </div>
        )}
      </div>

      {/* Stock */}
      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm max-w-sm">
        <span className="text-muted-foreground">On hand</span>
        <span className="tabular-nums"><Qty value={available} unit={item.unit} /></span>
        <span className="text-muted-foreground">Last updated</span>
        <span>{updaterName(item.updater)} · {formatDate(item.updated_at)}</span>
      </div>

      {/* Prep orders */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Prep orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No prep orders yet.</p>
        ) : (
          <div className="border table-outer rounded-lg overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">No</TableHead>
                  <TableHead className="w-36">Date</TableHead>
                  <TableHead className="w-28">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="text-sm font-medium tabular-nums">
                      <Link href={`/prep-orders/${order.id}`} className="hover:underline">
                        {order.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(order.planned_date)}</TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {order.qty_to_prep != null ? (
                        <span className="flex items-center gap-1.5">
                          <Qty value={order.qty_to_prep} unit={item.unit} />
                          {order.target_qty != null && order.qty_to_prep !== order.target_qty && (
                            <VarianceIcon
                              targetQty={order.target_qty}
                              actualQty={order.qty_to_prep}
                              unit={item.unit}
                              reason={order.yield_variance_reason}
                            />
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
