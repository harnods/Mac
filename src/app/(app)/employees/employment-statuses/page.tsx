import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { MasterDataManager } from "@/components/employees/master-data-manager";
import {
  createEmploymentStatus,
  updateEmploymentStatus,
  deleteEmploymentStatus,
} from "@/app/actions/employees";
import type { EmploymentStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function EmploymentStatusesPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const isAdmin = profile?.role === "admin";

  const { data } = await supabase
    .from("employment_statuses")
    .select("id,name,updated_at")
    .order("name");

  const items = (data ?? []) as EmploymentStatus[];

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
