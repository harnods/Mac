import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { MasterDataManager } from "@/components/employees/master-data-manager";
import {
  createJobPosition,
  updateJobPosition,
  deleteJobPosition,
} from "@/app/actions/employees";
import type { JobPosition } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function JobPositionsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);

  const { data } = await supabase
    .from("job_positions")
    .select("id,name,updated_at")
    .order("name");

  const items = (data ?? []) as JobPosition[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job positions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage job position master data for employees.
        </p>
      </div>

      <MasterDataManager
        title="Job position"
        items={items}
        isAdmin={isAdmin}
        onCreate={createJobPosition}
        onUpdate={updateJobPosition}
        onDelete={deleteJobPosition}
      />
    </div>
  );
}
