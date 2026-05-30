import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { MasterDataManager } from "@/components/employees/master-data-manager";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/app/actions/employees";
import { getDepartments } from "@/lib/cached-queries";

export default async function DepartmentsPage() {
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);

  const items = await getDepartments();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage department master data for employees.
        </p>
      </div>

      <MasterDataManager
        title="Department"
        items={items}
        isAdmin={isAdmin}
        onCreate={createDepartment}
        onUpdate={updateDepartment}
        onDelete={deleteDepartment}
      />
    </div>
  );
}
