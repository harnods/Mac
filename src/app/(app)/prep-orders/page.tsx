import Link from "next/link";
import { Suspense } from "react";
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
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { Plus } from "lucide-react";
import { formatId, formatDate, updaterName } from "@/lib/format";
import { formatNum } from "@/lib/units";
import { Qty } from "@/components/ui/qty";
import { PrepOrdersFilter } from "@/components/prep-orders/prep-orders-filter";
import type { Updater } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type PrepOrderRecord = {
  id: string;
  status: string;
  target_qty: number;
  qty_to_prep: number | null;
  unit: string | null;
  planned_date: string;
  product: { id: string; name: string } | null;
  creator: Updater | null;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:   { label: "Pending",   className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

export default async function PrepOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.PREP_ORDERS_WRITE);
  const supabase = await createClient();

  // Use !inner join when searching by product name so PostgREST can push the filter to the join
  const productJoin = q.trim()
    ? "product:items!product_id!inner(id,name)"
    : "product:items!product_id(id,name)";

  let query = supabase
    .from("prep_orders")
    .select(`id, status, target_qty, qty_to_prep, unit, planned_date, ${productJoin}, creator:profiles!created_by(full_name,email)`)
    .order("planned_date", { ascending: false });

  if (q.trim()) query = query.ilike("items.name", `%${q.trim()}%`);

  const { data } = await query;
  const list = (data ?? []) as unknown as PrepOrderRecord[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Prep orders</h1>
        {isAdmin && (
          <Button asChild>
            <Link href="/prep-orders/new">
              <Plus className="size-4" /> New prep order
            </Link>
          </Button>
        )}
      </div>

      <Suspense fallback={null}>
        <PrepOrdersFilter />
      </Suspense>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {q ? "No prep orders match your search." : "No prep orders yet."}
          {!q && isAdmin && (
            <> <Link href="/prep-orders/new" className="underline">Create one</Link>.</>
          )}
        </div>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">No</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-28">Qty</TableHead>
                <TableHead className="w-36">Date</TableHead>
                <TableHead className="w-44">Created by</TableHead>
                <TableHead className="w-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((order) => (
                <ClickableTableRow key={order.id} href={`/prep-orders/${order.id}`}>
                  <TableCell className="font-medium tabular-nums">
                    {formatId(order.id)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {order.product?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
                      return (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.className}`}>
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {order.qty_to_prep != null
                      ? <Qty value={order.qty_to_prep} unit={order.unit ?? "pcs"} />
                      : <span className="text-muted-foreground">— {formatNum(order.target_qty)} target</span>
                    }
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(order.planned_date)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {updaterName(order.creator)}
                  </TableCell>
                  <TableCell />
                </ClickableTableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
