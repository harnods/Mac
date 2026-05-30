import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { MasterDataManager } from "@/components/employees/master-data-manager";
import { AddMasterDataButton } from "@/components/employees/add-master-data-button";
import { MasterDataFilter } from "@/components/employees/master-data-filter";
import { createJobPosition, updateJobPosition, deleteJobPosition } from "@/app/actions/employees";

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

  let query = supabase.from("job_positions").select("id,name,updated_at").order("name");
  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const { data } = await query;
  const items = (data ?? []) as { id: string; name: string }[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Job positions</h1>
        {isAdmin && <AddMasterDataButton title="Job position" onCreate={createJobPosition} />}
      </div>

      <Suspense fallback={null}>
        <MasterDataFilter placeholder="Search job positions..." />
      </Suspense>

      <MasterDataManager
        title="Job position"
        items={items}
        isAdmin={isAdmin}
        onUpdate={updateJobPosition}
        onDelete={deleteJobPosition}
      />
    </div>
  );
}
