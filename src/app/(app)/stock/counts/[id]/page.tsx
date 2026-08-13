import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { formatId, formatDateTime, updaterName } from "@/lib/format";
import type { Updater } from "@/lib/supabase/types";
import { CountWorkspace } from "@/components/stock/count-workspace";
import { DetailSection, DetailRow } from "@/components/ui/detail-list";

export const dynamic = "force-dynamic";

type CountItemRecord = {
  id: string;
  item_id: string;
  qty_system: number;
  qty_counted: number | null;
  unit: string;
  unopened_qty: number | null;
  unopened_unit: string | null;
  in_use_qty: number | null;
  in_use_unit: string | null;
  note: string | null;
  item: {
    name: string;
    type: string;
    unit: string;
    purchase_unit: string | null;
    purchase_unit_qty: number | null;
    item_unit_conversions: { from_unit: string; factor: number; to_unit: string }[];
  } | null;
};

type CountRecord = {
  id: string;
  count_date: string | null;
  status: "draft" | "counting" | "completed";
  note: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  creator: Updater | null;
  starter: Updater | null;
  completer: Updater | null;
  stock_count_items: CountItemRecord[];
};

function statusBadge(status: CountRecord["status"]) {
  if (status === "completed") return <Badge variant="success">Completed</Badge>;
  if (status === "counting") return <Badge>Counting</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

export default async function StockCountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.STOCK_WRITE);
  const supabase = await createClient();

  const { data } = await supabase
    .from("stock_counts")
    .select(`
      id, count_date, status, note, started_at, completed_at, created_at,
      creator:profiles!created_by(full_name, email),
      starter:profiles!started_by(full_name, email),
      completer:profiles!completed_by(full_name, email),
      stock_count_items(
        id, item_id, qty_system, qty_counted, unit, unopened_qty, unopened_unit, in_use_qty, in_use_unit, note,
        item:items(name, type, unit, purchase_unit, purchase_unit_qty, item_unit_conversions(from_unit, factor, to_unit))
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const count = data as unknown as CountRecord;
  const items = count.stock_count_items ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2">
            <Link href="/stock/counts">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Stock count {formatId(count.id)}
          </h1>
          {statusBadge(count.status)}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 lg:col-span-6">
          <DetailSection title="Details">
            <DetailRow
              label="Created"
              value={
                <div>
                  <div>{formatDateTime(count.created_at)}</div>
                  <div className="text-muted-foreground">{updaterName(count.creator)}</div>
                </div>
              }
            />
            {count.started_at && (
              <DetailRow
                label="Started"
                value={
                  <div>
                    <div>{formatDateTime(count.started_at)}</div>
                    <div className="text-muted-foreground">{updaterName(count.starter)}</div>
                  </div>
                }
              />
            )}
            {count.completed_at && (
              <DetailRow
                label="Finished"
                value={
                  <div>
                    <div>{formatDateTime(count.completed_at)}</div>
                    <div className="text-muted-foreground">{updaterName(count.completer)}</div>
                  </div>
                }
              />
            )}
            {count.note && <DetailRow label="Global note" value={count.note} />}
          </DetailSection>
        </div>
      </div>

      {/* Items */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Items</h2>
        {items.length === 0 ? (
          <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
            No items in this count.
          </div>
        ) : (
          <CountWorkspace count={count} items={items} canEdit={isAdmin} />
        )}
      </section>
    </div>
  );
}
