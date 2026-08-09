import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { MasterDataManager } from "@/components/employees/master-data-manager";
import { AddMasterDataButton } from "@/components/employees/add-master-data-button";
import { MasterDataFilter } from "@/components/employees/master-data-filter";
import { createJobPosition, updateJobPosition, deleteJobPosition, createDepartment } from "@/app/actions/employees";

export const dynamic = "force-dynamic";

export default async function JobPositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const supabase = await createClient();

  let query = supabase
    .from("job_positions")
    .select("id,name,department_id,updated_at,departments(id,name),updater:profiles!updated_by(full_name,email)")
    .order("name");
  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const [{ data }, { data: empRows }, { data: departmentsData }] = await Promise.all([
    query,
    supabase.from("employees").select("job_position_id").is("deleted_at", null),
    supabase.from("departments").select("id,name").order("name"),
  ]);
  const counts = new Map<string, number>();
  for (const r of (empRows ?? []) as { job_position_id: string | null }[]) {
    if (r.job_position_id) counts.set(r.job_position_id, (counts.get(r.job_position_id) ?? 0) + 1);
  }
  const items = ((data ?? []) as unknown as { id: string; name: string; department_id: string | null; departments: { id: string; name: string } | null; updated_at: string; updater: { full_name: string | null; email: string } | null }[])
    .map((it) => ({ ...it, crew_count: counts.get(it.id) ?? 0 }));
  const departments = (departmentsData ?? []) as { id: string; name: string }[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Job positions</h1>
        {isAdmin && (
          <AddMasterDataButton
            title="Job position"
            departmentOptions={departments}
            onCreateDepartment={createDepartment}
            onCreate={createJobPosition}
          />
        )}
      </div>

      <Suspense fallback={null}>
        <MasterDataFilter placeholder="Search job positions..." title="Job position" />
      </Suspense>

      <MasterDataManager
        title="Job position"
        items={items}
        isAdmin={isAdmin}
        departmentOptions={departments}
        onCreateDepartment={createDepartment}
        onUpdate={updateJobPosition}
        onDelete={deleteJobPosition}
      />
    </div>
  );
}
