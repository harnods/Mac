import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { formatId, formatDate, updaterName } from "@/lib/format";
import { Qty } from "@/components/ui/qty";
import { DetailSection, DetailRow } from "@/components/ui/detail-list";
import { CompletePrepButton } from "@/components/prep-orders/complete-prep-button";
import { CancelPrepButton } from "@/components/prep-orders/cancel-prep-button";
import { PrepOrderIngredientsTable } from "@/components/prep-orders/prep-order-ingredients-table";
import type { Updater } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type PrepOrderDetail = {
  id: string;
  status: string;
  batch_count: number;
  target_qty: number;
  qty_to_prep: number | null;
  yield_variance_reason: string | null;
  unit: string;
  notes: string | null;
  planned_date: string;
  created_at: string;
  product: { id: string; name: string; unit: string } | null;
  creator: Updater | null;
  prep_order_items: {
    id: string;
    item_id: string;
    qty_needed: number;
    unit: string;
    item: { id: string; name: string } | null;
  }[];
};

const STATUS_BADGE: Record<string, { label: string; variant: "secondary" | "success" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

export default async function PrepOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.PREP_ORDERS_WRITE);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("prep_orders")
    .select(
      `id, status, batch_count, target_qty, qty_to_prep, yield_variance_reason, unit, notes, planned_date, created_at,
       product:items!product_id(id,name,unit),
       creator:profiles!created_by(full_name,email),
       prep_order_items(id, item_id, qty_needed, unit, item:items(id,name))`
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const order = data as unknown as PrepOrderDetail;

  const statusCfg = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending;
  const yieldUnit = order.product?.unit ?? order.unit;

  const variance = order.qty_to_prep != null ? order.qty_to_prep - order.target_qty : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2">
            <Link href="/prep-orders">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Prep order{" "}
            <span className="text-muted-foreground font-normal">
              {formatId(id)}
            </span>
          </h1>
          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
        </div>

        {isAdmin && order.status === "pending" && (
          <div className="flex gap-2">
            <CancelPrepButton id={id} />
            <CompletePrepButton
              id={id}
              targetQty={order.target_qty}
              unit={yieldUnit}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 lg:col-span-6">
          <DetailSection title="Details">
            <DetailRow label="Date" value={formatDate(order.planned_date)} />
            <DetailRow label="Product" value={order.product?.name} />
            <DetailRow label="Target qty" value={<span className="tabular-nums"><Qty value={order.target_qty} unit={yieldUnit} /></span>} />
            {order.qty_to_prep != null && (
              <DetailRow label="Actual yield" value={<span className="tabular-nums"><Qty value={order.qty_to_prep} unit={yieldUnit} /></span>} />
            )}
            {variance !== null && variance !== 0 && (
              <DetailRow
                label="Variance"
                value={
                  <span className={`tabular-nums font-medium ${variance < 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {variance > 0 ? "+" : ""}<Qty value={Math.abs(variance)} unit={yieldUnit} />
                    <span className="font-normal text-muted-foreground ml-1.5 text-xs">
                      {variance < 0 ? "waste" : "non-standard"}
                    </span>
                  </span>
                }
              />
            )}
            {order.yield_variance_reason && (
              <DetailRow label="Reason" value={order.yield_variance_reason} />
            )}
            <DetailRow label="Created by" value={updaterName(order.creator)} />
            {order.notes && (
              <DetailRow label="Notes" value={<span className="whitespace-pre-wrap">{order.notes}</span>} />
            )}
          </DetailSection>
        </div>
      </div>

      {/* Ingredients table */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Ingredients</h2>

        {order.prep_order_items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No ingredients.</p>
        ) : (
          <PrepOrderIngredientsTable
            items={order.prep_order_items}
            columnLabel={order.status === "completed" ? "Used" : "Planned"}
          />
        )}
      </section>
    </div>
  );
}
