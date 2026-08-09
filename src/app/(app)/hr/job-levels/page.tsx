import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { MasterDataManager } from "@/components/employees/master-data-manager";
import { AddMasterDataButton } from "@/components/employees/add-master-data-button";
import { MasterDataFilter } from "@/components/employees/master-data-filter";
import { createJobLevel, updateJobLevel, deleteJobLevel } from "@/app/actions/employees";

export const dynamic = "force-dynamic";

export default async function JobLevelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const supabase = await createClient();

  let query = supabase
    .from("job_levels")
    .select("id,name,updated_at,updater:profiles!updated_by(full_name,email)")
    .order("name");
  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const [{ data }, { data: empRows }] = await Promise.all([
    query,
    supabase.from("employees").select("job_level_id").is("deleted_at", null),
  ]);
  const counts = new Map<string, number>();
  for (const r of (empRows ?? []) as { job_level_id: string | null }[]) {
    if (r.job_level_id) counts.set(r.job_level_id, (counts.get(r.job_level_id) ?? 0) + 1);
  }
  const items = ((data ?? []) as unknown as { id: string; name: string; updated_at: string; updater: { full_name: string | null; email: string } | null }[])
    .map((it) => ({ ...it, crew_count: counts.get(it.id) ?? 0 }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Job levels</h1>
        {isAdmin && (
          <AddMasterDataButton
            title="Job level"
            onCreate={createJobLevel}
          />
        )}
      </div>

      <Suspense fallback={null}>
        <MasterDataFilter placeholder="Search job levels..." title="Job level" />
      </Suspense>

      <MasterDataManager
        title="Job level"
        items={items}
        isAdmin={isAdmin}
        onUpdate={updateJobLevel}
        onDelete={deleteJobLevel}
      />
    </div>
  );
}
