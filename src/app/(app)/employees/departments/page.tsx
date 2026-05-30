import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { MasterDataManager } from "@/components/employees/master-data-manager";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/app/actions/employees";
import type { Department } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);

  const { data } = await supabase
    .from("departments")
    .select("id,name,updated_at")
    .order("name");

  const items = (data ?? []) as Department[];

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
