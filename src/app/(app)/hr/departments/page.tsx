import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { MasterDataManager } from "@/components/employees/master-data-manager";
import { AddMasterDataButton } from "@/components/employees/add-master-data-button";
import { MasterDataFilter } from "@/components/employees/master-data-filter";
import { createDepartment, updateDepartment, deleteDepartment } from "@/app/actions/employees";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const supabase = await createClient();

  let query = supabase.from("departments").select("id,name,updated_at,updater:profiles!updated_by(full_name,email)").order("name");
  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  const { data } = await query;
  const items = (data ?? []) as unknown as { id: string; name: string; updated_at: string; updater: { full_name: string | null; email: string } | null }[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
        {isAdmin && <AddMasterDataButton title="Department" onCreate={createDepartment} />}
      </div>

      <Suspense fallback={null}>
        <MasterDataFilter placeholder="Search departments..." title="Department" />
      </Suspense>

      <MasterDataManager
        title="Department"
        items={items}
        isAdmin={isAdmin}
        onUpdate={updateDepartment}
        onDelete={deleteDepartment}
      />
    </div>
  );
}
