import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { formatId, formatDate, updaterName } from "@/lib/format";
import { formatNum } from "@/lib/units";
import { Qty } from "@/components/ui/qty";
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

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:   { label: "Pending",   className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
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

  const statusCfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const yieldUnit = order.product?.unit ?? order.unit;

  const variance = order.qty_to_prep != null ? order.qty_to_prep - order.target_qty : null;

  return (
    <div className="space-y-4">
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
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
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

      {/* Metadata */}
      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm max-w-lg">
        <span className="text-muted-foreground">Date</span>
        <span>{formatDate(order.planned_date)}</span>

        <span className="text-muted-foreground">Product</span>
        <span>{order.product?.name ?? "—"}</span>

        <span className="text-muted-foreground">Target qty</span>
        <span className="tabular-nums"><Qty value={order.target_qty} unit={yieldUnit} /></span>

        {order.qty_to_prep != null && (
          <>
            <span className="text-muted-foreground">Actual yield</span>
            <span className="tabular-nums"><Qty value={order.qty_to_prep} unit={yieldUnit} /></span>
          </>
        )}

        {variance !== null && variance !== 0 && (
          <>
            <span className="text-muted-foreground">Variance</span>
            <span className={`tabular-nums font-medium ${variance < 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
              {variance > 0 ? "+" : ""}<Qty value={Math.abs(variance)} unit={yieldUnit} />
              <span className="font-normal text-muted-foreground ml-1.5 text-xs">
                {variance < 0 ? "waste" : "non-standard"}
              </span>
            </span>
          </>
        )}

        {order.yield_variance_reason && (
          <>
            <span className="text-muted-foreground">Reason</span>
            <span className="text-sm">{order.yield_variance_reason}</span>
          </>
        )}

        <span className="text-muted-foreground">Created by</span>
        <span>{updaterName(order.creator)}</span>

        {order.notes && (
          <>
            <span className="text-muted-foreground">Notes</span>
            <span className="whitespace-pre-wrap">{order.notes}</span>
          </>
        )}
      </div>

      {/* Ingredients table */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Ingredients</h2>

        {order.prep_order_items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No ingredients.</p>
        ) : (
          <PrepOrderIngredientsTable
            items={order.prep_order_items}
            columnLabel={order.status === "completed" ? "Used" : "Planned"}
          />
        )}
      </div>
    </div>
  );
}
