import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { MasterDataManager } from "@/components/employees/master-data-manager";
import {
  createJobLevel,
  updateJobLevel,
  deleteJobLevel,
} from "@/app/actions/employees";
import { getJobLevels } from "@/lib/cached-queries";

export default async function JobLevelsPage() {
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);

  const items = await getJobLevels();

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
