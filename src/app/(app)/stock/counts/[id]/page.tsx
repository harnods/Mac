import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { formatId, formatDate, formatDateTime, updaterName } from "@/lib/format";
import type { Updater } from "@/lib/supabase/types";
import { CountWorkspace } from "@/components/stock/count-workspace";

export const dynamic = "force-dynamic";

type CountItemRecord = {
  id: string;
  item_id: string;
  qty_system: number;
  qty_counted: number | null;
  unit: string;
  note: string | null;
  item: { name: string; unit: string } | null;
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
        id, item_id, qty_system, qty_counted, unit, note,
        item:items(name, unit)
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const count = data as unknown as CountRecord;
  const items = count.stock_count_items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2 mt-0.5">
          <Link href="/stock/counts">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Stock count {formatId(count.id)}
          </h1>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm max-w-md">
        <span className="text-muted-foreground">Status</span>
        <span>{statusBadge(count.status)}</span>
        <span className="text-muted-foreground">Count date</span>
        <span>
          {count.count_date ? (
            formatDate(count.count_date)
          ) : (
            <span className="text-muted-foreground">Not started</span>
          )}
        </span>
        <span className="text-muted-foreground">Created by</span>
        <span>{updaterName(count.creator)}</span>
        <span className="text-muted-foreground">Created at</span>
        <span>{formatDateTime(count.created_at)}</span>
        {count.started_at && (
          <>
            <span className="text-muted-foreground">Started by</span>
            <span>{updaterName(count.starter)}</span>
            <span className="text-muted-foreground">Started at</span>
            <span>{formatDateTime(count.started_at)}</span>
          </>
        )}
        {count.completed_at && (
          <>
            <span className="text-muted-foreground">Finished by</span>
            <span>{updaterName(count.completer)}</span>
            <span className="text-muted-foreground">Finished at</span>
            <span>{formatDateTime(count.completed_at)}</span>
          </>
        )}
        {count.note && (
          <>
            <span className="text-muted-foreground">Global note</span>
            <span>{count.note}</span>
          </>
        )}
      </div>

      {/* Items table */}
      {items.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          No items in this count.
        </div>
      ) : (
        <CountWorkspace count={count} items={items} canEdit={isAdmin} />
      )}
    </div>
  );
}
