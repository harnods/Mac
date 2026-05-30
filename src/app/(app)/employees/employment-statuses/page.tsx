import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { MasterDataManager } from "@/components/employees/master-data-manager";
import {
  createEmploymentStatus,
  updateEmploymentStatus,
  deleteEmploymentStatus,
} from "@/app/actions/employees";
import { getEmploymentStatuses } from "@/lib/cached-queries";

export default async function EmploymentStatusesPage() {
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);

  const items = await getEmploymentStatuses();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Employment statuses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage employment status master data. Seeded defaults: Permanent, Contract, Part-time.
        </p>
      </div>

      <MasterDataManager
        title="Employment status"
        items={items}
        isAdmin={isAdmin}
        onCreate={createEmploymentStatus}
        onUpdate={updateEmploymentStatus}
        onDelete={deleteEmploymentStatus}
      />
    </div>
  );
}
