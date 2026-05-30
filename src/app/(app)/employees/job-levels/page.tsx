import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { MasterDataManager } from "@/components/employees/master-data-manager";
import {
  createJobLevel,
  updateJobLevel,
  deleteJobLevel,
} from "@/app/actions/employees";
import type { JobLevel } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function JobLevelsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const isAdmin = profile?.role === "admin";

  const { data } = await supabase
    .from("job_levels")
    .select("id,name,sort_order,updated_at")
    .order("sort_order")
    .order("name");

  const items = (data ?? []) as JobLevel[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job levels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage job level master data. Items are ordered by their sort order value. Drag-reorder is not supported — edit the sort order number to reorder.
        </p>
      </div>

      <MasterDataManager
        title="Job level"
        items={items}
        isAdmin={isAdmin}
        showSortOrder
        onCreate={createJobLevel}
        onUpdate={updateJobLevel}
        onDelete={deleteJobLevel}
      />
    </div>
  );
}
