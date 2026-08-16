import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P, allowedRecipeStations, canAccessRecipeStation } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PrepOrdersFilter } from "@/components/prep-orders/prep-orders-filter";
import { PrepOrdersTable, type PrepOrderListItem } from "@/components/prep-orders/prep-orders-table";
import { PaginationBar, parsePageSize, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination-bar";

export const dynamic = "force-dynamic";

export default async function PrepOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; size?: string }>;
}) {
  const { q = "", page: rawPageStr, size: rawSizeStr } = await searchParams;
  const rawPage = Number(rawPageStr ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const PAGE_SIZE = parsePageSize(rawSizeStr);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.PREP_ORDERS_WRITE);
  const supabase = await createClient();

  // Use !inner join when searching by product name so PostgREST can push the filter to the join
  const productJoin = q.trim()
    ? "product:items!product_id!inner(id,name)"
    : "product:items!product_id(id,name)";

  let query = supabase
    .from("prep_orders")
    .select(`id, status, target_qty, qty_to_prep, unit, planned_date, ${productJoin}, creator:profiles!created_by(full_name,email)`, { count: "exact" })
    .order("planned_date", { ascending: false })
    .range(from, to);

  if (q.trim()) query = query.ilike("items.name", `%${q.trim()}%`);

  // Station scope: hide prep orders whose recipe is outside this role's station.
  const allowedStations = allowedRecipeStations(profile);
  if (allowedStations) {
    const { data: recs } = await supabase.from("recipes").select("id, station").not("station", "is", null);
    const hidden = (recs ?? [])
      .filter((r: { id: string; station: string | null }) => !canAccessRecipeStation(profile, r.station))
      .map((r: { id: string }) => r.id);
    if (hidden.length) query = query.not("recipe_id", "in", `(${hidden.join(",")})`);
  }

  const { data, count } = await query;
  const list = (data ?? []) as unknown as PrepOrderListItem[];
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const buildHref = (p: number, size: number = PAGE_SIZE) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (size !== DEFAULT_PAGE_SIZE) sp.set("size", String(size));
    if (p > 1) sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

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
        <PrepOrdersTable list={list} />
      )}
      <PaginationBar page={page} totalPages={totalPages} pageSize={PAGE_SIZE} buildHref={buildHref} buildSizeHref={(s) => buildHref(1, s)} />
    </div>
  );
}
