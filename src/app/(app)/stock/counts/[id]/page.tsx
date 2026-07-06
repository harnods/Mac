import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { formatId, formatDate, formatDateTime, updaterName } from "@/lib/format";
import { formatNum } from "@/lib/units";
import { Qty } from "@/components/ui/qty";
import { cn } from "@/lib/utils";
import type { Updater } from "@/lib/supabase/types";
import { CompleteCountButton } from "@/components/stock/complete-count-button";

export const dynamic = "force-dynamic";

type CountItemRecord = {
  id: string;
  item_id: string;
  qty_system: number;
  qty_counted: number | null;
  unit: string;
  note: string | null;
  item: { name: string } | null;
};

type CountRecord = {
  id: string;
  count_date: string;
  status: "draft" | "completed";
  note: string | null;
  created_at: string;
  creator: Updater | null;
  stock_count_items: CountItemRecord[];
};

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
      id, count_date, status, note, created_at,
      creator:profiles!created_by(full_name, email),
      stock_count_items(
        id, item_id, qty_system, qty_counted, unit, note,
        item:items(name)
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
        <span>
          <Badge variant={count.status === "completed" ? "success" : "outline"}>
            {count.status === "completed" ? "Completed" : "Draft"}
          </Badge>
        </span>
        <span className="text-muted-foreground">Count date</span>
        <span>{formatDate(count.count_date)}</span>
        <span className="text-muted-foreground">Recorded by</span>
        <span>{updaterName(count.creator)}</span>
        <span className="text-muted-foreground">Created at</span>
        <span>{formatDateTime(count.created_at)}</span>
        {count.note && (
          <>
            <span className="text-muted-foreground">Note</span>
            <span>{count.note}</span>
          </>
        )}
      </div>

      {/* Complete button for draft counts (admin only) */}
      {count.status === "draft" && isAdmin && (
        <CompleteCountButton countId={count.id} />
      )}

      {/* Items table */}
      {items.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          No items in this count.
        </div>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-20">Unit</TableHead>
                <TableHead className="w-32 text-right">System qty</TableHead>
                <TableHead className="w-32 text-right">Counted qty</TableHead>
                <TableHead className="w-32 text-right">Discrepancy</TableHead>
                <TableHead className="w-48">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                const discrepancy =
                  row.qty_counted != null
                    ? Number(row.qty_counted) - Number(row.qty_system)
                    : null;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium truncate">
                      {row.item?.name ?? "—"}
                    </TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Qty value={Number(row.qty_system)} unit={row.unit} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.qty_counted != null ? (
                        <Qty value={Number(row.qty_counted)} unit={row.unit} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {discrepancy == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            "font-medium",
                            discrepancy > 0
                              ? "text-green-600 dark:text-green-400"
                              : discrepancy < 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                          )}
                        >
                          {discrepancy > 0 ? "+" : ""}
                          <Qty value={Math.abs(discrepancy)} unit={row.unit} />
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="truncate text-sm">
                      {row.note ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
