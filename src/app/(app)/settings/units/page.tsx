import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Suspense } from "react";
import { AddUnitForm } from "@/components/inventory/add-unit-form";
import { UnitsFilter } from "@/components/inventory/units-filter";
import { UnitsTable, type UnitRow } from "@/components/settings/units-table";
import { PaginationBar, parsePageSize, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination-bar";

export const dynamic = "force-dynamic";

export default async function SettingsUnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; size?: string }>;
}) {
  const { q = "", page: rawPageStr, size: rawSizeStr } = await searchParams;
  const rawPage = Number(rawPageStr ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const PAGE_SIZE = parsePageSize(rawSizeStr);
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.INVENTORY_WRITE);
  const supabase = await createClient();

  let unitsQuery = supabase
    .from("units")
    .select("code, is_system")
    .order("is_system", { ascending: false })
    .order("code");
  if (q.trim()) unitsQuery = unitsQuery.ilike("code", `%${q.trim()}%`);
  const { data: unitsData } = await unitsQuery;

  const units = (unitsData ?? []) as UnitRow[];
  const totalPages = Math.ceil(units.length / PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const paged = units.slice(from, from + PAGE_SIZE);

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
        <h1 className="text-2xl font-semibold tracking-tight">Units</h1>
        {isAdmin && <AddUnitForm />}
      </div>

      <Suspense fallback={null}>
        <UnitsFilter />
      </Suspense>

      {units.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {q.trim() ? "No units match your search." : "No units found."}
        </div>
      ) : (
        <UnitsTable units={paged} isAdmin={isAdmin} />
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
