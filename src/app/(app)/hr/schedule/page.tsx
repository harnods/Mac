import Link from "next/link";
import { CalendarCog } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { getPayrollSettings } from "@/app/actions/payroll";
import { getScheduleLogs } from "@/app/actions/schedule";
import { ScheduleGrid } from "@/components/employees/schedule-grid";
import { ScheduleChangelog } from "@/components/employees/schedule-changelog";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const canWrite = can(profile, P.EMPLOYEES_WRITE);

  const payroll = await getPayrollSettings();
  const cutoffStartDay = payroll?.cutoff_start_day ?? 21;
  const cutoffEndDay = payroll?.cutoff_end_day ?? 20;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  // Active roster (exclude resigned and the account owner/CEO).
  const { data: owner } = await supabase.from("profiles").select("id").eq("is_owner", true).maybeSingle();
  // Load the full roster with the dates that bound each crew's employment; the
  // grid shows only crew whose window overlaps the viewed period.
  let crewQuery = supabase
    .from("employees")
    .select("id,name,join_date,inactive_date,termination_date,last_day")
    .is("deleted_at", null)
    .order("name");
  if (owner?.id) crewQuery = crewQuery.or(`user_id.is.null,user_id.neq.${owner.id}`);

  const [{ data: crewData }, { data: shiftRows }, scheduleLogs] = await Promise.all([
    crewQuery,
    supabase.from("shifts").select("id,name,start_time,end_time,active").order("start_time", { nullsFirst: true }),
    getScheduleLogs(),
  ]);

  const crew = (crewData ?? []) as {
    id: string; name: string; join_date: string | null; inactive_date: string | null;
    termination_date: string | null; last_day: string | null;
  }[];
  const shifts = (shiftRows ?? []) as { id: string; name: string; start_time: string | null; end_time: string | null; active: boolean }[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        {canWrite && (
          <Button asChild variant="outline">
            <Link href="/hr/schedule-patterns"><CalendarCog className="size-4" /> Manage schedules</Link>
          </Button>
        )}
      </div>
      <ScheduleGrid
        crew={crew}
        shifts={shifts}
        cutoffStartDay={cutoffStartDay}
        cutoffEndDay={cutoffEndDay}
        today={today}
        canWrite={canWrite}
      />
      <ScheduleChangelog logs={scheduleLogs} />
    </div>
  );
}
