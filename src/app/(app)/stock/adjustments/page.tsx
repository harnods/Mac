import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
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
import { Plus } from "lucide-react";
import { formatDate, updaterName } from "@/lib/format";
import { formatNum } from "@/lib/units";
import { Qty } from "@/components/ui/qty";
import { AdjustmentsFilter } from "@/components/stock/adjustments-filter";
import type { Updater } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type AdjustmentRecord = {
  id: string;
  direction: "in" | "out";
  qty: number;
  unit: string;
  reason: string | null;
  adjustment_date: string;
  created_at: string;
  item: { name: string } | null;
  creator: Updater | null;
};

export default async function StockAdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; direction?: string }>;
}) {
  const { q = "", direction } = await searchParams;
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const supabase = await createClient();

  let query = supabase
    .from("stock_adjustments")
    .select("id, direction, qty, unit, reason, adjustment_date, created_at, item:items(name), creator:profiles!created_by(full_name, email)")
    .order("created_at", { ascending: false });

  if (direction === "in" || direction === "out") {
    query = query.eq("direction", direction);
  }
  if (q.trim()) {
    query = query.ilike("reason", `%${q.trim()}%`);
  }

  const { data } = await query;
  const list = (data ?? []) as unknown as AdjustmentRecord[];

  // Client-side filter by item name if q is set (reason filter already applied server-side,
  // additionally filter by item name for broader search)
  const filtered = q.trim()
    ? list.filter(
        (a) =>
          a.item?.name.toLowerCase().includes(q.trim().toLowerCase()) ||
          (a.reason ?? "").toLowerCase().includes(q.trim().toLowerCase()),
      )
    : list;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Stock adjustments</h1>
        {isAdmin && (
          <Button asChild>
            <Link href="/stock/adjustments/new">
              <Plus className="size-4" /> Add adjustment
            </Link>
          </Button>
        )}
      </div>

      <Suspense fallback={null}>
        <AdjustmentsFilter />
      </Suspense>

      {filtered.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {q || direction ? "No adjustments match your filter." : "No adjustments yet."}
          {!q && !direction && isAdmin && (
            <> <Link href="/stock/adjustments/new" className="underline">Add one</Link>.</>
          )}
        </div>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Date</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="w-20">Direction</TableHead>
                <TableHead className="w-32 text-right">Qty</TableHead>
                <TableHead className="w-48">Reason</TableHead>
                <TableHead className="w-40">Recorded by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((adj) => (
                <TableRow key={adj.id}>
                  <TableCell>{formatDate(adj.adjustment_date)}</TableCell>
                  <TableCell className="font-medium truncate">{adj.item?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={adj.direction === "in" ? "success" : "destructive"}>
                      {adj.direction === "in" ? "In" : "Out"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Qty value={adj.qty} unit={adj.unit} />
                  </TableCell>
                  <TableCell className="truncate text-sm">
                    {adj.reason ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{updaterName(adj.creator)}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(adj.created_at)}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
