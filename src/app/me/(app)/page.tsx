import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getMyContext, getMyAttendance } from "@/app/actions/crew-self";
import { getAttendanceSettings } from "@/app/actions/attendance";
import { ClockCard } from "@/components/crew/clock-card";
import { AttendanceList } from "@/components/crew/attendance-list";

export const dynamic = "force-dynamic";

export default async function MeAttendancePage() {
  const profile = await getCurrentProfile();
  if (profile?.must_change_password) redirect("/me/change-password");

  const context = await getMyContext();
  if (!context?.employee) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        This account isn&rsquo;t linked to a crew profile. Ask an admin to set it up.
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const [ty, tm, tdd] = today.split("-").map(Number);
  const startD = new Date(ty, tm - 1, tdd - 59);
  const p = (n: number) => String(n).padStart(2, "0");
  const start = `${startD.getFullYear()}-${p(startD.getMonth() + 1)}-${p(startD.getDate())}`;

  const [records, settings] = await Promise.all([getMyAttendance(start, today), getAttendanceSettings()]);
  const grace = {
    lateGraceMinutes: settings?.late_grace_minutes ?? 0,
    lateToleranceDirection: settings?.late_tolerance_direction ?? ("after" as const),
    earlyLeaveGraceMinutes: settings?.early_leave_grace_minutes ?? 0,
  };

  return (
    <div className="space-y-6">
      <ClockCard context={context} />
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">History</h2>
          <Link href="/me/attendance" className="text-sm font-medium text-primary">
            View all
          </Link>
        </div>
        <AttendanceList records={records} grace={grace} />
      </div>
    </div>
  );
}
