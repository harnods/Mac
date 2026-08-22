import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { EmployeesFilter } from "@/components/employees/employees-filter";
import { EmployeeTable } from "@/components/employees/employee-table";
import { GenerateCrewLoginsButton } from "@/components/employees/generate-crew-logins-button";
import { PaginationBar, parsePageSize, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination-bar";
import type { EmployeeWithRelations } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";


export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string; status?: string; page?: string; size?: string }>;
}) {
  const { q = "", dept, status = "active", page: rawPageStr, size: rawSizeStr } = await searchParams;
  const rawPage = Number(rawPageStr ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const PAGE_SIZE = parsePageSize(rawSizeStr);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const canWrite = can(profile, P.EMPLOYEES_WRITE);
  const isFiltered = !!q.trim() || !!dept || status !== "active";

  const [{ data: items, count }, { data: departmentsData }] = await Promise.all([
    (() => {
      let query = supabase
        .from("employees")
        .select(
          "*, departments(id,name), job_positions(id,name), job_levels(id,name), employment_statuses(id,name), updater:profiles!updated_by(full_name,email), mac_user:profiles!user_id(id,email,role,is_owner)",
          { count: "exact" },
        )
        .is("deleted_at", null)
        .order("name")
        .range(from, to);
      if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
      if (dept) query = query.eq("department_id", dept);
      if (status === "active") query = query.is("termination_date", null).eq("active", true);
      else if (status === "inactive") query = query.is("termination_date", null).eq("active", false);
      else if (status === "resigned") query = query.not("termination_date", "is", null);
      return query;
    })(),
    supabase.from("departments").select("id,name").order("name"),
  ]);

  const list = (items ?? []) as EmployeeWithRelations[];
  const departments = (departmentsData ?? []) as { id: string; name: string }[];
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const buildHref = (p: number, size: number = PAGE_SIZE) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (dept) sp.set("dept", dept);
    if (status !== "active") sp.set("status", status);
    if (size !== DEFAULT_PAGE_SIZE) sp.set("size", String(size));
    if (p > 1) sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Crew</h1>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <GenerateCrewLoginsButton />
            <Button asChild>
              <Link href="/hr/crew/new">
                <Plus className="size-4" /> New crew
              </Link>
            </Button>
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <EmployeesFilter departments={departments} />
      </Suspense>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {isFiltered ? "No crew match your search." : "No crew yet."}
          {!isFiltered && canWrite && (
            <>
              {" "}
              <Link href="/hr/crew/new" className="underline">
                Add the first one
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <EmployeeTable list={list} canWrite={canWrite} showLastDay={status === "resigned"} />

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {list.map((emp) => (
              <Link
                key={emp.id}
                href={`/hr/crew/${emp.id}`}
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

      <PaginationBar page={page} totalPages={totalPages} pageSize={PAGE_SIZE} buildHref={buildHref} buildSizeHref={(s) => buildHref(1, s)} />
    </div>
  );
}
