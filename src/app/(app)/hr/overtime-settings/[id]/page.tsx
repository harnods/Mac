import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { getOvertimeCompensation } from "@/app/actions/overtime";
import { activeOvertimeVersion } from "@/lib/overtime";
import { DetailBackButton } from "@/components/employees/detail-back-button";
import { OvertimeCompDetail } from "@/components/employees/overtime-comp-detail";
import { EditOvertimeCompButton } from "@/components/employees/edit-overtime-comp-button";

export const dynamic = "force-dynamic";

export default async function OvertimeCompDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const supabase = await createClient();

  const [{ compensation, versions }, { data: levelData }] = await Promise.all([
    getOvertimeCompensation(id),
    supabase.from("job_levels").select("id,name").order("name"),
  ]);
  if (!compensation) notFound();

  const jobLevels = (levelData ?? []) as { id: string; name: string }[];
  const jobLevelName = compensation.job_level_id
    ? jobLevels.find((l) => l.id === compensation.job_level_id)?.name ?? null
    : null;
  const current = activeOvertimeVersion(versions, today);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DetailBackButton href="/hr/overtime-settings" />
          <h1 className="text-2xl font-semibold tracking-tight">{compensation.name}</h1>
        </div>
        {isAdmin && (
          <EditOvertimeCompButton
            jobLevels={jobLevels}
            today={today}
            prefill={{
              id: compensation.id,
              name: compensation.name,
              job_level_id: compensation.job_level_id,
              amount_per_hour: current?.amount_per_hour ?? 0,
              cap_hours: current?.cap_hours ?? true,
              max_hours_per_day: current?.max_hours_per_day ?? 4.5,
              effective_date: current?.effective_date ?? today,
            }}
          />
        )}
      </div>

      <OvertimeCompDetail compensation={compensation} versions={versions} jobLevelName={jobLevelName} today={today} />
    </div>
  );
}
