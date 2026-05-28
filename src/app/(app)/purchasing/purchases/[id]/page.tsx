import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { formatDate, formatDateTime, updaterName, formatId } from "@/lib/format";
import { formatNum } from "@/lib/units";
import { Qty } from "@/components/ui/qty";
import { DeletedItemBadge } from "@/components/ui/deleted-item-badge";
import type { Updater } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type PurchaseDetail = {
  id: string;
  note: string | null;
  transaction_date: string;
  created_at: string;
  updater: Updater | null;
  purchase_purchase_requests: { purchase_request_id: string }[];
  purchase_items: {
    id: string;
    qty_requested: number | null;
    requested_unit: string | null;
    qty_purchased: number;
    unit: string;
    cost_per_unit: number | null;
    cost_total: number | null;
    row_note: string | null;
    item: { id: string; name: string; unit: string; deleted_at: string | null } | null;
  }[];
};

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getCurrentProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("purchases")
    .select(`
      id, note, transaction_date, created_at,
      updater:profiles!updated_by(full_name,email),
      purchase_purchase_requests(purchase_request_id),
      purchase_items(id, qty_requested, requested_unit, qty_purchased, unit, cost_per_unit, cost_total, row_note, item:items(id,name,unit,deleted_at))
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const purchase = data as unknown as PurchaseDetail;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2 mt-0.5">
            <Link href="/purchasing/purchases"><ArrowLeft className="size-4" /></Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Purchase <span className="text-muted-foreground font-normal">{formatId(id)}</span>
          </h1>
        </div>
      </div>

      <div className="max-w-2xl space-y-4">
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm text-foreground">
          <span className="text-muted-foreground">Transaction date</span>
          <span>{formatDate(purchase.transaction_date)}</span>

          <span className="text-muted-foreground">Recorded</span>
          <span>{formatDateTime(purchase.created_at)}</span>

          <span className="text-muted-foreground">Recorded by</span>
          <span>{updaterName(purchase.updater) ?? "—"}</span>
        </div>

        {purchase.purchase_purchase_requests.length > 0 && (
          <div className="border rounded-lg px-4 py-3 space-y-2">
            <div className="text-xs uppercase text-muted-foreground tracking-wide">
              Linked purchase request{purchase.purchase_purchase_requests.length > 1 ? "s" : ""}
            </div>
            {purchase.purchase_purchase_requests.map(({ purchase_request_id }) => (
              <div key={purchase_request_id} className="flex items-center gap-3 text-sm">
                <Link
                  href={`/purchasing/requests/${purchase_request_id}`}
                  className="font-medium underline hover:text-muted-foreground"
                >
                  {formatId(purchase_request_id)}
                </Link>
              </div>
            ))}
          </div>
        )}

        {purchase.note && (
          <div className="space-y-1">
            <h2 className="text-sm font-medium">Notes</h2>
            <p className="text-sm whitespace-pre-wrap">{purchase.note}</p>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h2 className="text-sm font-medium">Purchased items</h2>
        {purchase.purchase_items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No items.</p>
        ) : (
          <div>
            <div className="grid grid-cols-[2rem_1fr_10rem_10rem_9rem] gap-x-6 py-2 border-b text-xs text-muted-foreground">
              <span />
              <span>Item</span>
              <span className="text-right">Requested</span>
              <span className="text-right">Purchased</span>
              <span className="text-right">Cost</span>
            </div>
            {purchase.purchase_items.map((pi, idx) => {
              const perUnit = pi.cost_per_unit != null
                ? pi.cost_per_unit
                : pi.cost_total != null && pi.qty_purchased > 0
                ? pi.cost_total / pi.qty_purchased
                : null;
              const costDisplay = pi.cost_total != null
                ? `Rp${formatNum(pi.cost_total)} / ${formatNum(pi.qty_purchased)} ${pi.unit}`
                : pi.cost_per_unit != null
                ? `Rp${formatNum(pi.cost_per_unit)}/${pi.unit}`
                : null;
              return (
                <div key={pi.id} className="border-b last:border-0">
                  <div className="grid grid-cols-[2rem_1fr_10rem_10rem_9rem] gap-x-6 items-center py-2">
                    <span className="text-sm text-muted-foreground text-right">{idx + 1}.</span>
                    <span className="font-medium text-sm flex items-center">
                      {pi.item?.name ?? "—"}
                      {pi.item?.deleted_at && <DeletedItemBadge />}
                    </span>
                    <span className="tabular-nums text-sm text-right">
                      {pi.qty_requested != null
                        ? <Qty value={pi.qty_requested} unit={pi.requested_unit ?? pi.unit} />
                        : "—"}
                    </span>
                    <span className="tabular-nums text-sm text-right">
                      <Qty value={pi.qty_purchased} unit={pi.unit} />
                    </span>
                    <div className="text-right">
                      <div className="tabular-nums text-sm">
                        {costDisplay ?? "—"}
                      </div>
                      {pi.cost_total != null && perUnit != null && (
                        <div className="tabular-nums text-xs text-muted-foreground">
                          Rp{formatNum(perUnit)}/{pi.unit}
                        </div>
                      )}
                    </div>
                  </div>
                  {pi.row_note && (
                    <div className="ml-14 pb-2 text-xs text-muted-foreground">Note: {pi.row_note}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
