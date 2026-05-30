import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Suspense } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddUnitForm } from "@/components/inventory/add-unit-form";
import { UnitRowActions } from "@/components/inventory/unit-row-actions";
import { UnitsFilter } from "@/components/inventory/units-filter";

export const dynamic = "force-dynamic";

const CONVERSION_LABEL: Record<string, string> = {
  g: "g ↔ kg",
  kg: "g ↔ kg",
  ml: "ml ↔ l",
  l: "ml ↔ l",
};

type UnitRow = { code: string; is_system: boolean };

export default async function SettingsUnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Units</h1>
        {isAdmin && <AddUnitForm />}
      </div>

      <Suspense fallback={null}>
        <UnitsFilter />
      </Suspense>

      <div className="border table-outer rounded-lg overflow-x-auto">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Code</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="w-32">Conversion</TableHead>
              <TableHead />
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10 text-sm">
                  {q.trim() ? "No units match your search." : "No units found."}
                </TableCell>
              </TableRow>
            ) : (
              units.map((u) => (
                <TableRow key={u.code}>
                  <TableCell className="font-medium">{u.code}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {u.is_system ? "System" : "Custom"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {CONVERSION_LABEL[u.code] ?? "—"}
                  </TableCell>
                  <TableCell />
                  <TableCell>
                    {isAdmin && !u.is_system && <UnitRowActions code={u.code} />}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
