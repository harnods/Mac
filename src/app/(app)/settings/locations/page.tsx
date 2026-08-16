import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Suspense } from "react";
import { AddLocationForm } from "@/components/inventory/add-location-form";
import { LocationsFilter } from "@/components/inventory/locations-filter";
import { LocationsTable, type LocationRow } from "@/components/settings/locations-table";
import { PaginationBar, parsePageSize, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination-bar";
import type { Location } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function SettingsLocationsPage({
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

  let query = supabase.from("locations").select("id, name").order("name");
  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);

  const [{ data: locData }, { data: itemRows }] = await Promise.all([
    query,
    supabase.from("items").select("location_id").not("location_id", "is", null).is("deleted_at", null),
  ]);

  const counts: Record<string, number> = {};
  for (const row of (itemRows ?? []) as { location_id: string }[]) {
    counts[row.location_id] = (counts[row.location_id] ?? 0) + 1;
  }

  const locations = ((locData ?? []) as Pick<Location, "id" | "name">[]).map((l) => ({
    ...l,
    itemCount: counts[l.id] ?? 0,
  })) satisfies LocationRow[];

  const totalPages = Math.ceil(locations.length / PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;
  const paged = locations.slice(from, from + PAGE_SIZE);

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
        <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
        {isAdmin && <AddLocationForm />}
      </div>

      <Suspense fallback={null}>
        <LocationsFilter />
      </Suspense>

      {locations.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {q.trim() ? "No locations match your search." : "No locations yet."}
        </div>
      ) : (
        <LocationsTable locations={paged} isAdmin={isAdmin} />
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
