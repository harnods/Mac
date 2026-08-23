"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShiftEditDialog } from "@/components/employees/shift-edit-dialog";
import { getScheduleRange, setSchedule } from "@/app/actions/schedule";
import { payrollPeriod, currentPeriodAnchor } from "@/lib/payroll";

type ShiftOpt = { id: string; name: string; start_time: string | null; end_time: string | null; active: boolean };

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function parseISO(s: string) { const [y, m, d] = s.split("-").map(Number); return { y, m: m - 1, d }; }
function toISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function eachDay(startISO: string, endISO: string) {
  const s = parseISO(startISO), e = parseISO(endISO);
  const cur = new Date(s.y, s.m, s.d), end = new Date(e.y, e.m, e.d);
  const out: string[] = [];
  while (cur <= end) { out.push(toISO(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
}

/** Short cell label for a shift. */
function shiftShort(s: ShiftOpt | undefined) {
  if (!s) return null;
  if (s.start_time && s.end_time) return `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`;
  return s.name; // Day off / Unpaid / No schedule
}

export function ScheduleGrid({
  crew,
  shifts,
  cutoffStartDay,
  cutoffEndDay,
  today,
  canWrite = false,
}: {
  crew: {
    id: string; name: string; join_date?: string | null; inactive_date?: string | null;
    termination_date?: string | null; last_day?: string | null;
  }[];
  shifts: ShiftOpt[];
  cutoffStartDay: number;
  cutoffEndDay: number;
  today: string;
  canWrite?: boolean;
}) {
  const current = useMemo(() => {
    const t = parseISO(today);
    return currentPeriodAnchor(new Date(t.y, t.m, t.d), cutoffStartDay, cutoffEndDay);
  }, [today, cutoffStartDay, cutoffEndDay]);

  const [anchorKey, setAnchorKey] = useState(`${current.year}-${pad(current.month + 1)}`);
  const [aY, aM] = anchorKey.split("-").map(Number);
  const period = payrollPeriod(aY, aM - 1, cutoffStartDay, cutoffEndDay);
  const days = useMemo(() => eachDay(period.start, period.end), [period.start, period.end]);

  // A crew's last working day: the earliest of inactive / last-day / termination.
  const stopDate = (c: (typeof crew)[number]) => {
    const ds = [c.inactive_date, c.last_day, c.termination_date].filter(Boolean) as string[];
    return ds.length ? ds.sort()[0] : null;
  };

  // Show only crew whose employment window overlaps the viewed period:
  // joined on/before the period ends, and hadn't stopped before it starts.
  const visibleCrew = useMemo(
    () => crew.filter((c) => {
      const joinedInTime = !c.join_date || c.join_date <= period.end;
      const s = stopDate(c);
      const stillActive = !s || s >= period.start;
      return joinedInTime && stillActive;
    }),
    [crew, period.start, period.end],
  );

  const shiftById = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);
  // Show every shift in the picker — including inactive ones — so backdated
  // schedules can still use shifts that are no longer active. The dialog sorts
  // them and flags inactive ones.
  const pickable = shifts;

  const [cells, setCells] = useState<Map<string, string | null>>(new Map());
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState<{ employeeId: string; day: string; shiftId: string | null } | null>(null);

  const monthOptions = useMemo(
    () => Array.from({ length: 14 }, (_, i) => {
      const d = new Date(current.year, current.month - 12 + i, 1);
      return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: `${MONTH[d.getMonth()]} ${d.getFullYear()}` };
    }).reverse(),
    [current],
  );

  useEffect(() => {
    start(async () => {
      const rows = await getScheduleRange(period.start, period.end);
      const map = new Map<string, string | null>();
      for (const r of rows) map.set(`${r.employee_id}|${r.work_date}`, r.shift_id);
      setCells(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.start, period.end]);

  function label(day: string) {
    const { y, m, d } = parseISO(day);
    const wd = new Date(y, m, d).getDay();
    return { wd: WD[wd], dm: `${d}/${m + 1}` };
  }

  return (
    <div className="space-y-3">
      <Select value={anchorKey} onValueChange={setAnchorKey}>
        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          {monthOptions.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <div className={`border table-outer rounded-lg overflow-x-auto ${pending ? "opacity-60" : ""}`}>
        <table className="border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="sticky left-0 z-30 bg-muted border-b border-r px-3 py-2 text-left font-medium w-[180px] min-w-[180px]">Crew</th>
              {days.map((day) => {
                const { wd, dm } = label(day);
                const isToday = day === today;
                return (
                  <th key={day} className={`border-b border-l px-2 py-1.5 text-center font-medium w-[78px] min-w-[78px] ${isToday ? "bg-foreground text-background" : ""}`}>
                    <div className={`text-[11px] ${isToday ? "text-background/80" : "text-muted-foreground"}`}>{wd}</div>
                    <div className="tabular-nums">{dm}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleCrew.map((c) => (
              <tr key={c.id} className="border-b last:border-b-0">
                <td className="sticky left-0 z-20 bg-background border-r px-3 py-1.5 font-medium w-[180px] min-w-[180px] max-w-[180px]">
                  <div className="max-w-[156px] truncate" title={c.name}>{c.name}</div>
                </td>
                {days.map((day) => {
                  // Not schedulable before join date or after they stopped working.
                  const beforeJoin = !!c.join_date && day < c.join_date;
                  const stop = stopDate(c);
                  const afterStop = !!stop && day > stop;
                  if (beforeJoin || afterStop) {
                    return (
                      <td key={day} className="border-l p-0 text-center align-middle bg-muted/40">
                        <div className="h-11 w-full" title={beforeJoin ? "Before join date" : "No longer active"} />
                      </td>
                    );
                  }
                  const sid = cells.get(`${c.id}|${day}`) ?? null;
                  const s = sid ? shiftById.get(sid) : undefined;
                  const off = s && !s.start_time && !s.end_time;
                  return (
                    <td key={day} className="border-l p-0 text-center align-middle">
                      <button
                        type="button"
                        disabled={!canWrite}
                        onClick={() => setEdit({ employeeId: c.id, day, shiftId: sid })}
                        className={`h-11 w-full px-1 text-[11px] leading-tight tabular-nums transition-colors ${canWrite ? "hover:bg-accent cursor-pointer" : "cursor-default"} ${off ? "text-red-600 dark:text-red-400" : ""}`}
                        title={s?.name ?? "No shift"}
                      >
                        {shiftShort(s) ?? <span className="text-muted-foreground">—</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {visibleCrew.length === 0 && (
              <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={days.length + 1}>No crew.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {canWrite && (
        <ShiftEditDialog
          shifts={pickable}
          currentShiftId={edit?.shiftId ?? null}
          contextLabel={edit ? `${crew.find((c) => c.id === edit.employeeId)?.name ?? ""} · ${edit.day}` : undefined}
          open={!!edit}
          onOpenChange={(o) => { if (!o) setEdit(null); }}
          onSave={async (sid) => {
            const res = await setSchedule(edit!.employeeId, edit!.day, sid);
            if (res.ok) {
              const key = `${edit!.employeeId}|${edit!.day}`;
              setCells((prev) => new Map(prev).set(key, sid));
            }
            return res;
          }}
          onSaved={() => setEdit(null)}
        />
      )}
    </div>
  );
}
