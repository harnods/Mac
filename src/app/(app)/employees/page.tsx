import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { EmployeesFilter } from "@/components/employees/employees-filter";
import { EmployeeTableRow } from "@/components/employees/employee-table-row";
import { PaginationBar } from "@/components/ui/pagination-bar";
import type { EmployeeWithRelations } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string; page?: string }>;
}) {
  const { q = "", dept, page: rawPageStr } = await searchParams;
  const rawPage = Number(rawPageStr ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const canWrite = can(profile, P.EMPLOYEES_WRITE);
  const isFiltered = !!q.trim() || !!dept;

  const [{ data: items, count }, { data: departmentsData }] = await Promise.all([
    (() => {
      let query = supabase
        .from("employees")
        .select(
          "*, departments(id,name), job_positions(id,name), job_levels(id,name), employment_statuses(id,name), updater:profiles!updated_by(full_name,email), mac_user:profiles!user_id(id,email,role,is_owner)",
          { count: "exact" },
        )
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
      if (dept) query = query.eq("department_id", dept);
      return query;
    })(),
    supabase.from("departments").select("id,name").order("name"),
  ]);

  const list = (items ?? []) as EmployeeWithRelations[];
  const departments = (departmentsData ?? []) as { id: string; name: string }[];
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const buildHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (dept) sp.set("dept", dept);
    if (p > 1) sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        </div>
        {canWrite && (
          <Button asChild>
            <Link href="/employees/new">
              <Plus className="size-4" /> Add employee
            </Link>
          </Button>
        )}
      </div>

      <Suspense fallback={null}>
        <EmployeesFilter departments={departments} />
      </Suspense>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {isFiltered ? "No employees match your search." : "No employees yet."}
          {!isFiltered && canWrite && (
            <>
              {" "}
              <Link href="/employees/new" className="underline">
                Add the first one
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="border table-outer rounded-lg overflow-x-auto hidden md:block">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Name</TableHead>
                  <TableHead className="w-36">Department</TableHead>
                  <TableHead className="w-40">Job position</TableHead>
                  <TableHead className="w-32">Job level</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                  <TableHead className="w-44">Last updated</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((emp) => (
                  <EmployeeTableRow
                    key={emp.id}
                    employee={emp}
                    canWrite={canWrite}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {list.map((emp) => (
              <Link
                key={emp.id}
                href={`/employees/${emp.id}`}
                className="border rounded-lg p-4 flex items-center justify-between gap-3 hover:bg-accent/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{emp.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {[emp.departments?.name, emp.employment_statuses?.name]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <PaginationBar page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
