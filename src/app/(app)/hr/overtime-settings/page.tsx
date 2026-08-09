import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { getOvertimeCompensations } from "@/app/actions/overtime";
import { OvertimeCompManager, type OvertimeRow } from "@/components/employees/overtime-comp-manager";
import { AddOvertimeCompButton } from "@/components/employees/add-overtime-comp-button";

export const dynamic = "force-dynamic";

export default async function OvertimeSettingsPage() {
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const supabase = await createClient();

  const [{ compensations, versions }, { data: levelData }] = await Promise.all([
    getOvertimeCompensations(),
    supabase.from("job_levels").select("id,name").order("name"),
  ]);
  const jobLevels = (levelData ?? []) as { id: string; name: string }[];
  const levelName = (id: string | null) => (id ? jobLevels.find((l) => l.id === id)?.name ?? null : null);

  const items: OvertimeRow[] = compensations.map((compensation) => ({
    compensation,
    versions: versions.filter((v) => v.compensation_id === compensation.id),
    jobLevelName: levelName(compensation.job_level_id),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Overtime</h1>
        {isAdmin && <AddOvertimeCompButton jobLevels={jobLevels} today={today} />}
      </div>

      <OvertimeCompManager items={items} jobLevels={jobLevels} isAdmin={isAdmin} today={today} />
    </div>
  );
}
