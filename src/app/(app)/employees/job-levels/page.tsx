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
    .select("id,name,sort_order,updated_at")
    .order("sort_order")
    .order("name");
  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const { data } = await query;
  const items = (data ?? []) as { id: string; name: string; sort_order: number }[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Job levels</h1>
        {isAdmin && (
          <AddMasterDataButton
            title="Job level"
            showSortOrder
            onCreate={createJobLevel}
          />
        )}
      </div>

      <Suspense fallback={null}>
        <MasterDataFilter placeholder="Search job levels..." />
      </Suspense>

      <MasterDataManager
        title="Job level"
        items={items}
        isAdmin={isAdmin}
        showSortOrder
        onUpdate={updateJobLevel}
        onDelete={deleteJobLevel}
      />
    </div>
  );
}
