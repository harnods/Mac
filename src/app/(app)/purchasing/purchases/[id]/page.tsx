import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { formatDate, formatDateTime, updaterName, formatId } from "@/lib/format";
import { PurchaseItemsList } from "@/components/purchasing/purchase-items-list";
import { DetailSection, DetailRow } from "@/components/ui/detail-list";
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2">
            <Link href="/purchasing/purchases"><ArrowLeft className="size-4" /></Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Purchase <span className="text-muted-foreground font-normal">{formatId(id)}</span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 lg:col-span-6">
          <DetailSection title="Details">
            <DetailRow label="Transaction date" value={formatDate(purchase.transaction_date)} />
            <DetailRow label="Recorded" value={formatDateTime(purchase.created_at)} />
            <DetailRow label="Recorded by" value={updaterName(purchase.updater)} />
          </DetailSection>
        </div>
      </div>

      {purchase.purchase_purchase_requests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">
            Linked purchase request{purchase.purchase_purchase_requests.length > 1 ? "s" : ""}
          </h2>
          <div className="border rounded-lg px-4 py-3 space-y-2">
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
        </section>
      )}

      {purchase.note && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{purchase.note}</p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Purchased items</h2>
        {purchase.purchase_items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No items.</p>
        ) : (
          <PurchaseItemsList items={purchase.purchase_items} />
        )}
      </section>
    </div>
  );
}
