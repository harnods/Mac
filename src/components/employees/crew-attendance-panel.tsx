"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import { ShiftEditDialog } from "@/components/employees/shift-edit-dialog";
import { getEmployeeAttendance, assignAttendanceShift } from "@/app/actions/attendance";
import { payrollPeriod, currentPeriodAnchor } from "@/lib/payroll";
import { attendanceStatuses, workDurationMinutes, formatMinutes, formatTime } from "@/lib/attendance";
import { formatWeekdayDate } from "@/lib/format";
import type { AttendanceWithRelations } from "@/lib/supabase/types";

const STATUS_META: Record<string, { label: string; variant: "success" | "secondary"; className?: string }> = {
  present: { label: "Present", variant: "success" },
  late: { label: "Late", variant: "secondary", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  "early-leave": { label: "Early leave", variant: "secondary", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dash = <span className="text-muted-foreground">—</span>;

/** Mandatory days off every crew gets per payroll period (subtracted from the
 *  calendar days to get working days). */
const MANDATORY_DAYS_OFF = 4;

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
}
function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Every calendar day from start to end (inclusive), as YYYY-MM-DD. */
function eachDay(startISO: string, endISO: string) {
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  const cur = new Date(s.y, s.m, s.d);
  const end = new Date(e.y, e.m, e.d);
  const out: string[] = [];
  while (cur <= end) {
    out.push(toISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function CrewAttendancePanel({
  employeeId,
  joinDate = null,
  stopDate = null,
  cutoffStartDay,
  cutoffEndDay,
  lateGraceMinutes = 0,
  lateToleranceDirection = "after",
  earlyLeaveGraceMinutes = 0,
  today,
  shifts = [],
  canWrite = false,
}: {
  employeeId: string;
  joinDate?: string | null;
  stopDate?: string | null;
  cutoffStartDay: number;
  cutoffEndDay: number;
  lateGraceMinutes?: number;
  lateToleranceDirection?: "before" | "after";
  earlyLeaveGraceMinutes?: number;
  today: string;
  shifts?: { id: string; name: string; start_time: string | null; end_time: string | null }[];
  canWrite?: boolean;
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const [editState, setEditState] = useState<{ day: string; shiftId: string | null } | null>(null);
  const current = useMemo(() => {
    const t = parseISO(today);
    return currentPeriodAnchor(new Date(t.y, t.m, t.d), cutoffStartDay, cutoffEndDay);
  }, [today, cutoffStartDay, cutoffEndDay]);

  const [anchorKey, setAnchorKey] = useState(`${current.year}-${pad(current.month + 1)}`);
  const [rows, setRows] = useState<AttendanceWithRelations[]>([]);
  const [pending, start] = useTransition();

  const [aY, aM] = anchorKey.split("-").map(Number);
  const period = payrollPeriod(aY, aM - 1, cutoffStartDay, cutoffEndDay);

  // Month options: 12 months back through 1 month ahead of the current period.
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date(current.year, current.month - 12 + i, 1);
        return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: `${MONTH[d.getMonth()]} ${d.getFullYear()}` };
      }).reverse(),
    [current],
  );

  useEffect(() => {
    start(async () => {
      const data = await getEmployeeAttendance(employeeId, period.start, period.end);
      setRows(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, period.start, period.end, reloadKey]);

  // Payroll-period stats shown above the table. Working days = calendar days in
  // the 21st–20th window minus the 4 mandatory days off each crew gets. The
  // rest are counted per distinct day from the actual records.
  const stats = useMemo(() => {
    const periodDays = eachDay(period.start, period.end).length;
    const workingDays = Math.max(0, periodDays - MANDATORY_DAYS_OFF);
    const present = new Set<string>();
    const dayOff = new Set<string>();
    const late = new Set<string>();
    const early = new Set<string>();
    const onTime = new Set<string>();
    const byDate = new Map<string, AttendanceWithRelations[]>();
    for (const r of rows) {
      byDate.set(r.work_date, [...(byDate.get(r.work_date) ?? []), r]);
      // Only the mandatory "Day off" shift counts as a (paid) day off. Other
      // no-times shifts like "Unpaid" are treated as absent/unpaid below.
      if (r.shifts?.name === "Day off") dayOff.add(r.work_date);
      if (r.clock_in) {
        present.add(r.work_date);
        const st = attendanceStatuses(r, { lateGraceMinutes, lateToleranceDirection, earlyLeaveGraceMinutes });
        if (st.includes("late")) late.add(r.work_date);
        else onTime.add(r.work_date);
        if (st.includes("early-leave")) early.add(r.work_date);
      }
    }

    // Unpaid = a FULL absence: a past day with NEITHER a clock-in nor a
    // clock-out that isn't excused. A day with just one punch is "incomplete",
    // not absent. "Day off" (paid) and "No schedule" (not rostered) are excused.
    const EXCUSED = new Set(["Day off", "No schedule"]);
    let absent = 0;
    let incomplete = 0;
    for (const day of eachDay(period.start, period.end)) {
      if (day >= today) continue; // don't count today or future days
      if (joinDate && day < joinDate) continue; // not employed yet
      if (stopDate && day > stopDate) continue; // no longer working
      const recs = byDate.get(day);
      if (!recs?.length) continue; // no scheduled record → not counted
      const isExcused = recs.every((r) => EXCUSED.has(r.shifts?.name ?? ""));
      if (isExcused) continue;
      const hasClockIn = recs.some((r) => r.clock_in);
      const hasClockOut = recs.some((r) => r.clock_out);
      if (!hasClockIn && !hasClockOut) absent++; // neither punch → unpaid
      else if (hasClockIn !== hasClockOut) incomplete++; // exactly one → incomplete
    }

    return {
      workingDays,
      present: present.size,
      dayOff: dayOff.size,
      late: late.size,
      early: early.size,
      onTime: onTime.size,
      absent,
      incomplete,
    };
  }, [rows, period.start, period.end, today, joinDate, stopDate, lateGraceMinutes, lateToleranceDirection, earlyLeaveGraceMinutes]);

  // One row per calendar day in the period; days with attendance show it,
  // days without stay blank (crew simply didn't clock in).
  const displayRows = useMemo(() => {
    type DisplayRow = { day: string; rec: AttendanceWithRelations | null; key: string; showDate: boolean };
    const byDate = new Map<string, AttendanceWithRelations[]>();
    for (const r of rows) {
      const list = byDate.get(r.work_date) ?? [];
      list.push(r);
      byDate.set(r.work_date, list);
    }
    return eachDay(period.start, period.end).flatMap((day): DisplayRow[] => {
      const recs = byDate.get(day);
      if (recs && recs.length) return recs.map((rec, i): DisplayRow => ({ day, rec, key: rec.id, showDate: i === 0 }));
      return [{ day, rec: null, key: day, showDate: true }];
    });
  }, [rows, period.start, period.end]);

  return (
    <div className="space-y-3">
      <Select value={anchorKey} onValueChange={setAnchorKey}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((o) => (
            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className={`grid gap-2 sm:grid-cols-3 ${pending ? "opacity-60" : ""}`}>
        {/* Box 1 — working days */}
        <div className="flex flex-col justify-center rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Working days</div>
          <div className="mt-0.5 text-3xl font-semibold tabular-nums">{stats.workingDays}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">21st–20th − 4 days off</div>
        </div>

        {/* Box 2 — attendance breakdown */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
          {([
            { label: "Present", value: stats.present },
            { label: "Day offs", value: stats.dayOff },
            { label: "Unpaid", value: stats.absent },
            { label: "Incomplete", value: stats.incomplete },
          ] as const).map((s) => (
            <div key={s.label}>
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-0.5 text-2xl font-semibold tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Box 3 — punctuality */}
        <div className="grid grid-cols-3 gap-3 rounded-lg border p-3">
          {([
            { label: "On time", value: stats.onTime },
            { label: "Late", value: stats.late },
            { label: "Early leave", value: stats.early },
          ] as const).map((s) => (
            <div key={s.label}>
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-0.5 text-2xl font-semibold tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={`border table-outer rounded-lg overflow-x-auto ${pending ? "opacity-60" : ""}`}>
        <Table className="w-auto min-w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[170px]">Date</TableHead>
              <TableHead className="w-[120px]">Shift</TableHead>
              <TableHead className="w-[110px]">Clock in</TableHead>
              <TableHead className="w-[110px]">Clock out</TableHead>
              <TableHead className="w-[100px]">Break</TableHead>
              <TableHead className="w-[120px]">Duration</TableHead>
              <TableHead className="w-[160px]">Status</TableHead>
              <TableHead className="w-[200px]">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map(({ day, rec, key, showDate }) => {
              const statuses = rec ? attendanceStatuses(rec, { lateGraceMinutes, lateToleranceDirection, earlyLeaveGraceMinutes }) : [];
              const duration = rec ? workDurationMinutes(rec) : null;
              const isDayOff = !!rec?.shifts && !rec.shifts.start_time && !rec.shifts.end_time;
              const beforeJoin = !!joinDate && day < joinDate;
              const afterStop = !!stopDate && day > stopDate;
              const outside = beforeJoin || afterStop;
              return (
                <TableRow key={key} className={outside ? "opacity-50" : ""}>
                  <TableCell className={`text-sm ${isDayOff ? "text-red-600 dark:text-red-400" : ""}`}>{showDate ? formatWeekdayDate(day) : ""}</TableCell>
                  <TableCell className="text-sm">
                    {outside ? (
                      <span className="text-xs text-muted-foreground">{beforeJoin ? "Before join date" : "No longer active"}</span>
                    ) : (
                    <div className="group/shift flex items-start justify-between gap-1">
                      <div>
                        {rec?.shifts ? (
                          <>
                            <div className={isDayOff ? "text-red-600 dark:text-red-400" : ""}>{rec.shifts.name}</div>
                            {rec.shifts.start_time && rec.shifts.end_time && (
                              <div className="text-xs text-muted-foreground tabular-nums">
                                {formatTime(rec.shifts.start_time)}–{formatTime(rec.shifts.end_time)}
                              </div>
                            )}
                          </>
                        ) : dash}
                      </div>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => setEditState({ day, shiftId: rec?.shifts?.id ?? null })}
                          aria-label="Edit shift"
                          className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/shift:opacity-100"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      )}
                    </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{formatTime(rec?.clock_in) || dash}</TableCell>
                  <TableCell className="text-sm tabular-nums">{formatTime(rec?.clock_out) || dash}</TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">{rec?.clock_in ? `${rec.break_minutes}m` : dash}</TableCell>
                  <TableCell className="text-sm tabular-nums">{duration != null ? formatMinutes(duration) : dash}</TableCell>
                  <TableCell>
                    {statuses.length === 0 ? dash : (
                      <div className="flex flex-wrap gap-1">
                        {statuses.map((s) => {
                          const meta = STATUS_META[s];
                          return <Badge key={s} variant={meta.variant} className={meta.className}>{meta.label}</Badge>;
                        })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-normal">{rec?.note || dash}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {canWrite && (
        <ShiftEditDialog
          shifts={shifts}
          currentShiftId={editState?.shiftId ?? null}
          contextLabel={editState ? formatWeekdayDate(editState.day) : undefined}
          open={!!editState}
          onOpenChange={(o) => { if (!o) setEditState(null); }}
          onSave={(sid) => assignAttendanceShift(employeeId, editState!.day, sid)}
          onSaved={() => { setEditState(null); setReloadKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}
