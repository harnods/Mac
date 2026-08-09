import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { getOvertimeRequests } from "@/app/actions/overtime-request";
import { OvertimeRequestManager } from "@/components/employees/overtime-request-manager";

export const dynamic = "force-dynamic";

export default async function OvertimePage() {
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const supabase = await createClient();

  const [requests, { data: crewData }] = await Promise.all([
    getOvertimeRequests(),
    supabase.from("employees").select("id,name").is("deleted_at", null).order("name"),
  ]);
  const crew = (crewData ?? []) as { id: string; name: string }[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Overtime</h1>
      </div>
      <OvertimeRequestManager requests={requests} crew={crew} isAdmin={isAdmin} />
    </div>
  );
}
