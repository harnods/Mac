import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { getMyAttendance } from "@/app/actions/crew-self";
import { getAttendanceSettings } from "@/app/actions/attendance";
import { attendanceStatuses, workDurationMinutes, formatMinutes, formatTime } from "@/lib/attendance";
import { formatWeekdayDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; className: string }> = {
  present: { label: "Present", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  late: { label: "Late", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  "early-leave": { label: "Early leave", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

export default async function MyHistoryPage() {
  const profile = await getCurrentProfile();
  if (profile?.must_change_password) redirect("/me/change-password");

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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/me" className="rounded p-1 hover:bg-muted"><ArrowLeft className="size-5" /></Link>
        <h1 className="text-lg font-semibold tracking-tight">My attendance</h1>
      </div>

      {records.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No attendance yet.</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => {
            const dayOff = !!r.shifts && !r.shifts.start_time && !r.shifts.end_time;
            const statuses = attendanceStatuses(r, grace);
            const duration = workDurationMinutes(r);
            return (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-medium ${dayOff ? "text-red-600 dark:text-red-400" : ""}`}>{formatWeekdayDate(r.work_date)}</span>
                  <span className={`text-sm ${dayOff ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>{r.shifts?.name ?? "—"}</span>
                </div>
                {!dayOff && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>In <span className="text-foreground tabular-nums">{formatTime(r.clock_in) || "—"}</span></span>
                    <span>Out <span className="text-foreground tabular-nums">{formatTime(r.clock_out) || "—"}</span></span>
                    {r.break_minutes > 0 && <span>Break <span className="text-foreground tabular-nums">{r.break_minutes}m</span></span>}
                    <span>Duration <span className="text-foreground tabular-nums">{duration != null ? formatMinutes(duration) : "—"}</span></span>
                  </div>
                )}
                {statuses.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {statuses.map((s) => (
                      <Badge key={s} variant="secondary" className={STATUS_META[s].className}>{STATUS_META[s].label}</Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
