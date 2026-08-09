import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { MasterDataManager } from "@/components/employees/master-data-manager";
import { AddMasterDataButton } from "@/components/employees/add-master-data-button";
import { MasterDataFilter } from "@/components/employees/master-data-filter";
import { createEmploymentStatus, updateEmploymentStatus, deleteEmploymentStatus } from "@/app/actions/employees";

export const dynamic = "force-dynamic";

export default async function EmploymentStatusesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const supabase = await createClient();

  let query = supabase.from("employment_statuses").select("id,name,updated_at,updater:profiles!updated_by(full_name,email)").order("name");
  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const [{ data }, { data: empRows }] = await Promise.all([
    query,
    supabase.from("employees").select("employment_status_id").is("deleted_at", null),
  ]);
  const counts = new Map<string, number>();
  for (const r of (empRows ?? []) as { employment_status_id: string | null }[]) {
    if (r.employment_status_id) counts.set(r.employment_status_id, (counts.get(r.employment_status_id) ?? 0) + 1);
  }
  const items = ((data ?? []) as unknown as { id: string; name: string; updated_at: string; updater: { full_name: string | null; email: string } | null }[])
    .map((it) => ({ ...it, crew_count: counts.get(it.id) ?? 0 }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Employment type</h1>
        {isAdmin && <AddMasterDataButton title="Employment type" onCreate={createEmploymentStatus} />}
      </div>

      <Suspense fallback={null}>
        <MasterDataFilter placeholder="Search employment type..." title="Employment type" />
      </Suspense>

      <MasterDataManager
        title="Employment type"
        items={items}
        isAdmin={isAdmin}
        defaultNames={["Permanent", "Contract", "Part-time"]}
        onUpdate={updateEmploymentStatus}
        onDelete={deleteEmploymentStatus}
      />
    </div>
  );
}
