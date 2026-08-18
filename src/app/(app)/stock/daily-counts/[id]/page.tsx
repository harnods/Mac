import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { DetailBackButton } from "@/components/employees/detail-back-button";
import { formatDate, formatDateTime, updaterName } from "@/lib/format";
import type { Updater } from "@/lib/supabase/types";
import {
  DailyCountWorkspace,
  type DailyCountItem,
} from "@/components/stock/daily-count-workspace";
import { DetailSection, DetailRow } from "@/components/ui/detail-list";

export const dynamic = "force-dynamic";

type CountRecord = {
  id: string;
  count_date: string;
  status: "draft" | "counting" | "completed";
  note: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  creator: Updater | null;
  starter: Updater | null;
  completer: Updater | null;
  daily_stock_count_items: DailyCountItem[];
};

function statusBadge(status: CountRecord["status"]) {
  if (status === "completed") return <Badge variant="success">Completed</Badge>;
  if (status === "counting") return <Badge>Counting</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

export default async function DailyStockCountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  const viewOnly = view === "1";

  const profile = await getCurrentProfile();
  if (!can(profile, P.DAILY_STOCK_COUNTS_READ)) notFound();
  const canWrite = can(profile, P.DAILY_STOCK_COUNTS_WRITE);
  const supabase = await createClient();

  const { data } = await supabase
    .from("daily_stock_counts")
    .select(`
      id, count_date, status, note, started_at, completed_at, created_at,
      creator:profiles!created_by(full_name, email),
      starter:profiles!started_by(full_name, email),
      completer:profiles!completed_by(full_name, email),
      daily_stock_count_items(
        id, item_id, unit, opening_qty, received_qty, sold_qty, rnd_qty, waste_qty, counted_qty, variance_note,
        item:items(name, brand, type, unit)
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const count = data as unknown as CountRecord;
  const items = [...(count.daily_stock_count_items ?? [])].sort((a, b) =>
    (a.item?.name ?? "").localeCompare(b.item?.name ?? ""),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DetailBackButton href="/stock/daily-counts" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Daily stock count {formatDate(count.count_date)}
          </h1>
          {statusBadge(count.status)}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 lg:col-span-6">
          <DetailSection title="Details">
            <DetailRow label="Count date" value={formatDate(count.count_date)} />
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

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Items</h2>
        {items.length === 0 ? (
          <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
            No items in this count.
          </div>
        ) : (
          <DailyCountWorkspace
            count={count}
            items={items}
            canEdit={canWrite}
            viewOnly={viewOnly}
          />
        )}
      </section>
    </div>
  );
}
