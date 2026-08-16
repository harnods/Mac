import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CountsFilter } from "@/components/stock/counts-filter";
import { CountsTable, type CountRecord } from "@/components/stock/counts-table";
import { PaginationBar, parsePageSize, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination-bar";

export const dynamic = "force-dynamic";


export default async function StockCountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; size?: string }>;
}) {
  const { q = "", status, page: rawPageStr, size: rawSizeStr } = await searchParams;
  const rawPage = Number(rawPageStr ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const PAGE_SIZE = parsePageSize(rawSizeStr);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const profile = await getCurrentProfile();
  if (!can(profile, P.STOCK_COUNTS_READ)) return <AccessDenied label="Stock count" />;
  const isAdmin = can(profile, P.STOCK_COUNTS_WRITE);
  const supabase = await createClient();

  let query = supabase
    .from("stock_counts")
    .select("id, count_date, status, note, started_at, completed_at, created_at, creator:profiles!created_by(full_name, email), stock_count_items(id)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status === "draft" || status === "counting" || status === "completed") {
    query = query.eq("status", status);
  }
  if (q.trim()) {
    query = query.ilike("note", `%${q.trim()}%`);
  }

  const { data, count } = await query;
  const list = (data ?? []) as unknown as CountRecord[];
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const buildHref = (p: number, size: number = PAGE_SIZE) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (status) sp.set("status", status);
    if (size !== DEFAULT_PAGE_SIZE) sp.set("size", String(size));
    if (p > 1) sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Stock counts</h1>
        {isAdmin && (
          <Button asChild>
            <Link href="/stock/counts/new">
              <Plus className="size-4" /> New cycle count
            </Link>
          </Button>
        )}
      </div>

      <Suspense fallback={null}>
        <CountsFilter />
      </Suspense>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {q || status ? "No counts match your filter." : "No stock counts yet."}
          {!q && !status && isAdmin && (
            <> <Link href="/stock/counts/new" className="underline">Start one</Link>.</>
          )}
        </div>
      ) : (
        <CountsTable list={list} />
      )}
      <PaginationBar page={page} totalPages={totalPages} pageSize={PAGE_SIZE} buildHref={buildHref} buildSizeHref={(s) => buildHref(1, s)} />
    </div>
  );
}
