import { cn } from "@/lib/utils";
import {
  attendanceStatuses,
  workDurationMinutes,
  formatMinutes,
  formatTime,
  type AttendanceGrace,
  type AttendanceStatus,
} from "@/lib/attendance";
import { formatWeekdayDate } from "@/lib/format";
import type { AttendanceWithRelations } from "@/lib/supabase/types";

const STATUS_TEXT: Record<AttendanceStatus, { label: string; className: string }> = {
  present: { label: "Present", className: "text-green-600 dark:text-green-400" },
  late: { label: "Late", className: "text-amber-600 dark:text-amber-400" },
  "early-leave": { label: "Early leave", className: "text-orange-600 dark:text-orange-400" },
};

export function AttendanceList({
  records,
  grace,
}: {
  records: AttendanceWithRelations[];
  grace: AttendanceGrace;
}) {
  if (records.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No attendance yet.</p>;
  }
  return (
    <ul className="divide-y">
      {records.map((r) => {
        const dayOff = !!r.shifts && !r.shifts.start_time && !r.shifts.end_time;
        const statuses = attendanceStatuses(r, grace);
        const dur = workDurationMinutes(r);
        return (
          <li key={r.id} className="py-3">
            <div className="text-sm font-medium">{formatWeekdayDate(r.work_date)}</div>
            <div className={cn("text-sm", dayOff ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
              {r.shifts?.name ?? "—"}
            </div>
            {!dayOff && r.clock_in && (
              <div className="text-sm tabular-nums text-muted-foreground">
                {formatTime(r.clock_in)} - {formatTime(r.clock_out) || "…"}
                {dur != null ? ` (${formatMinutes(dur)})` : ""}
              </div>
            )}
            {!dayOff && statuses.length > 0 && (
              <div className="text-sm">
                {statuses.map((s, i) => (
                  <span key={s} className={STATUS_TEXT[s].className}>
                    {i > 0 ? ", " : ""}
                    {STATUS_TEXT[s].label}
                  </span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
