import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AdjustmentsFilter } from "@/components/stock/adjustments-filter";
import { AdjustmentsTable } from "@/components/stock/adjustments-table";
import type { AdjustmentRecord } from "@/components/stock/adjustments-table-row";
import { PaginationBar, parsePageSize, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination-bar";

export const dynamic = "force-dynamic";

export default async function StockAdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; direction?: string; page?: string; size?: string }>;
}) {
  const { q = "", direction, page: rawPageStr, size: rawSizeStr } = await searchParams;
  const rawPage = Number(rawPageStr ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const PAGE_SIZE = parsePageSize(rawSizeStr);
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.STOCK_WRITE);
  const supabase = await createClient();

  let query = supabase
    .from("stock_adjustments")
    .select("id, direction, qty, unit, reason, adjustment_date, created_at, item:items(name), creator:profiles!created_by(full_name, email)")
    .order("created_at", { ascending: false });

  if (direction === "in" || direction === "out") {
    query = query.eq("direction", direction);
  }

  const { data } = await query;
  const list = (data ?? []) as unknown as AdjustmentRecord[];

  const filtered = q.trim()
    ? list.filter(
        (a) =>
          a.item?.name.toLowerCase().includes(q.trim().toLowerCase()) ||
          (a.reason ?? "").toLowerCase().includes(q.trim().toLowerCase()),
      )
    : list;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const paged = filtered.slice(from, from + PAGE_SIZE);

  const buildHref = (p: number, size: number = PAGE_SIZE) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (direction) sp.set("direction", direction);
    if (size !== DEFAULT_PAGE_SIZE) sp.set("size", String(size));
    if (p > 1) sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

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
        <AdjustmentsTable list={paged} />
      )}

      <PaginationBar
        page={page}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        buildHref={buildHref}
        buildSizeHref={(s) => buildHref(1, s)}
      />
    </div>
  );
}
