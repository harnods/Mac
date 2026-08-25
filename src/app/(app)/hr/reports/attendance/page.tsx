import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { getAttendanceSettings } from "@/app/actions/attendance";
import { getPayrollSettingsVersions } from "@/app/actions/payroll";
import { activeSettingsVersion } from "@/lib/payroll-settings";
import { payrollPeriod, currentPeriodAnchor } from "@/lib/payroll";
import { attendanceStatuses, workDurationMinutes } from "@/lib/attendance";
import { formatDate } from "@/lib/format";
import { AttendanceReportView, type ReportRow } from "@/components/employees/attendance-report-view";
import type { AttendanceWithRelations } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

type AttRow = { employee_id: string; work_date: string; clock_in: string | null; clock_out: string | null; break_minutes: number; shifts: { name: string | null; start_time: string | null; end_time: string | null } | null };
type CrewRow = { id: string; name: string; join_date: string | null; termination_date: string | null; last_day: string | null; inactive_date: string | null; active: boolean | null; departments: { name: string } | null };

export default async function AttendanceReportPage({ searchParams }: { searchParams: Promise<{ ym?: string }> }) {
  const { ym: ymParam } = await searchParams;
  const profile = await getCurrentProfile();
  if (!can(profile, P.EMPLOYEES_READ) && !can(profile, P.EMPLOYEES_WRITE)) {
    return <p className="text-sm text-muted-foreground">You don&rsquo;t have access to attendance reports.</p>;
  }
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const settings = activeSettingsVersion(await getPayrollSettingsVersions(), today);
  const cutoffStart = settings?.cutoff_start_day ?? 21;
  const cutoffEnd = settings?.cutoff_end_day ?? 20;

  const [ty, tm, td] = today.split("-").map(Number);
  const def = currentPeriodAnchor(new Date(ty, tm - 1, td), cutoffStart, cutoffEnd);
  let anchorYear = def.year;
  let anchorMonth = def.month;
  if (ymParam && /^\d{4}-\d{2}$/.test(ymParam)) {
    const [y, m] = ymParam.split("-").map(Number);
    anchorYear = y;
    anchorMonth = m - 1;
  }
  const ym = `${anchorYear}-${pad(anchorMonth + 1)}`;
  const period = payrollPeriod(anchorYear, anchorMonth, cutoffStart, cutoffEnd);

  const monthOptions = Array.from({ length: 15 }, (_, i) => {
    const d = new Date(def.year, def.month - 14 + i, 1);
    return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: `${MONTH[d.getMonth()]} ${d.getFullYear()}` };
  }).reverse();

  const attSettings = await getAttendanceSettings();
  const graceCfg = {
    lateGraceMinutes: attSettings?.late_grace_minutes ?? 0,
    lateToleranceDirection: attSettings?.late_tolerance_direction ?? ("after" as const),
    earlyLeaveGraceMinutes: attSettings?.early_leave_grace_minutes ?? 0,
  };

  // The account owner (admin/CEO) isn't crew — exclude from the report.
  const { data: owner } = await supabase.from("profiles").select("id").eq("is_owner", true).maybeSingle();

  const [{ data: crewData }, { data: attData }, { data: schedData }, { data: otData }, { data: deptData }] = await Promise.all([
    (() => {
      let q = supabase.from("employees").select("id,name,join_date,termination_date,last_day,inactive_date,active,departments(name)").is("deleted_at", null).order("name");
      if (owner?.id) q = q.or(`user_id.is.null,user_id.neq.${owner.id}`);
      return q;
    })(),
    supabase.from("attendance").select("employee_id,work_date,clock_in,clock_out,break_minutes,shifts(name,start_time,end_time)").gte("work_date", period.start).lte("work_date", period.end),
    supabase.from("schedules").select("employee_id,work_date,shifts(name,start_time,end_time)").gte("work_date", period.start).lte("work_date", period.end),
    supabase.from("overtime_requests").select("employee_id,hours,work_date").eq("status", "approved").gte("work_date", period.start).lte("work_date", period.end),
    supabase.from("departments").select("id,name").order("name"),
  ]);

  const crew = (crewData ?? []) as unknown as CrewRow[];
  const departments = (deptData ?? []) as { id: string; name: string }[];

  // Attendance indexed by employee → date, for looking up punches on a rostered day.
  const attByEmpDate = new Map<string, Map<string, AttRow>>();
  for (const a of (attData ?? []) as unknown as AttRow[]) {
    const m = attByEmpDate.get(a.employee_id) ?? new Map<string, AttRow>();
    m.set(a.work_date, a);
    attByEmpDate.set(a.employee_id, m);
  }
  // Roster (schedule) rows per crew — the source of truth for what they were
  // expected to do each day (works even for days not yet elapsed).
  type SchedRow = { employee_id: string; work_date: string; shifts: { name: string | null; start_time: string | null; end_time: string | null } | null };
  const schedByEmp = new Map<string, SchedRow[]>();
  for (const s of (schedData ?? []) as unknown as SchedRow[]) {
    const list = schedByEmp.get(s.employee_id) ?? [];
    list.push(s);
    schedByEmp.set(s.employee_id, list);
  }
  const otByEmp = new Map<string, number>();
  for (const r of (otData ?? []) as { employee_id: string; hours: number }[]) {
    otByEmp.set(r.employee_id, (otByEmp.get(r.employee_id) ?? 0) + (r.hours || 0));
  }

  // Earliest date the crew stops appearing (resigned or marked inactive).
  const stopDateOf = (c: CrewRow) =>
    [c.inactive_date, c.last_day, c.termination_date].filter(Boolean).sort()[0] ?? null;
  const activeCrew = crew.filter((c) => {
    if (c.join_date && c.join_date > period.end) return false; // not yet joined
    const stop = stopDateOf(c);
    if (stop && stop < period.start) return false; // already inactive/resigned before this period
    if (c.active === false && !stop) return false; // inactive with no date → not active
    return true;
  });

  const rows: ReportRow[] = activeCrew.map((c) => {
    const sched = schedByEmp.get(c.id) ?? [];
    const attMap = attByEmpDate.get(c.id) ?? new Map<string, AttRow>();

    // Roster totals for the FULL period — a fixed number, independent of how
    // many days have elapsed. Working days = rostered real shifts.
    let workingDays = 0;
    let dayOff = 0;
    let noSchedule = 0;
    // Attendance outcomes, evaluated against each rostered real-shift day.
    let present = 0;
    let late = 0;
    let earlyLeave = 0;
    let workedMinutes = 0;
    let noClockIn = 0;
    let noClockOut = 0;
    let absent = 0;

    for (const s of sched) {
      const name = s.shifts?.name ?? null;
      const isRealShift = !!s.shifts?.start_time;
      if (name === "Day off") { dayOff++; continue; }
      if (name === "No schedule") { noSchedule++; continue; }
      if (!isRealShift) continue; // Unpaid or unknown → not a rostered work day
      workingDays++;

      const att = attMap.get(s.work_date);
      const hasIn = !!att?.clock_in;
      const hasOut = !!att?.clock_out;
      if (hasIn) {
        present++;
        const pseudo = { clock_in: att!.clock_in, clock_out: att!.clock_out, break_minutes: att!.break_minutes, shifts: att!.shifts } as unknown as AttendanceWithRelations;
        const st = attendanceStatuses(pseudo, graceCfg);
        if (st.includes("late")) late++;
        if (st.includes("early-leave")) earlyLeave++;
        workedMinutes += workDurationMinutes(pseudo) ?? 0;
      }
      // Absent only when BOTH punches missing (and the day has elapsed). One
      // missing punch is incomplete (no clock-in / no clock-out).
      if (!hasIn && !hasOut) {
        if (s.work_date < today) absent++; // don't count future rostered days
      } else if (!hasIn) {
        noClockIn++; // clocked out but never in
      } else if (!hasOut) {
        noClockOut++; // clocked in but never out
      }
    }

    const joinedMid = !!c.join_date && c.join_date > period.start && c.join_date <= period.end;
    return {
      employeeId: c.id,
      name: c.name,
      department: c.departments?.name ?? null,
      workingDays,
      present,
      dayOff,
      absent,
      noSchedule,
      noClockIn,
      noClockOut,
      late,
      earlyLeave,
      workedHours: Math.round((workedMinutes / 60) * 10) / 10,
      overtimeHours: Math.round((otByEmp.get(c.id) ?? 0) * 10) / 10,
      rate: workingDays > 0 ? present / workingDays : 0,
      joinedDate: joinedMid ? c.join_date : null,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Attendance report</h1>
      <AttendanceReportView
        rows={rows}
        departments={departments}
        monthOptions={monthOptions}
        ym={ym}
        periodLabel={`${formatDate(period.start)} – ${formatDate(period.end)}`}
      />
    </div>
  );
}
