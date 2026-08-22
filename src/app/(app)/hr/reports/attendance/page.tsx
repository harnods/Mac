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

function daysInclusive(start: string, end: string) {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  return Math.floor((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86400000) + 1;
}

type AttRow = { employee_id: string; work_date: string; clock_in: string | null; clock_out: string | null; break_minutes: number; shifts: { start_time: string | null; end_time: string | null } | null };
type CrewRow = { id: string; name: string; join_date: string | null; termination_date: string | null; last_day: string | null; departments: { name: string } | null };

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
  const periodDays = daysInclusive(period.start, period.end);

  const monthOptions = Array.from({ length: 15 }, (_, i) => {
    const d = new Date(def.year, def.month - 14 + i, 1);
    return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: `${MONTH[d.getMonth()]} ${d.getFullYear()}` };
  }).reverse();

  const attSettings = await getAttendanceSettings();
  const workingDaysPerWeek = attSettings?.working_days_per_week ?? 6;
  const graceCfg = {
    lateGraceMinutes: attSettings?.late_grace_minutes ?? 0,
    lateToleranceDirection: attSettings?.late_tolerance_direction ?? ("after" as const),
    earlyLeaveGraceMinutes: attSettings?.early_leave_grace_minutes ?? 0,
  };

  // The account owner (admin/CEO) isn't crew — exclude from the report.
  const { data: owner } = await supabase.from("profiles").select("id").eq("is_owner", true).maybeSingle();

  const [{ data: crewData }, { data: attData }, { data: otData }, { data: deptData }] = await Promise.all([
    (() => {
      let q = supabase.from("employees").select("id,name,join_date,termination_date,last_day,departments(name)").is("deleted_at", null).order("name");
      if (owner?.id) q = q.or(`user_id.is.null,user_id.neq.${owner.id}`);
      return q;
    })(),
    supabase.from("attendance").select("employee_id,work_date,clock_in,clock_out,break_minutes,shifts(start_time,end_time)").gte("work_date", period.start).lte("work_date", period.end),
    supabase.from("overtime_requests").select("employee_id,hours,work_date").eq("status", "approved").gte("work_date", period.start).lte("work_date", period.end),
    supabase.from("departments").select("id,name").order("name"),
  ]);

  const crew = (crewData ?? []) as unknown as CrewRow[];
  const departments = (deptData ?? []) as { id: string; name: string }[];

  const attByEmp = new Map<string, AttRow[]>();
  for (const a of (attData ?? []) as unknown as AttRow[]) {
    const list = attByEmp.get(a.employee_id) ?? [];
    list.push(a);
    attByEmp.set(a.employee_id, list);
  }
  const otByEmp = new Map<string, number>();
  for (const r of (otData ?? []) as { employee_id: string; hours: number }[]) {
    otByEmp.set(r.employee_id, (otByEmp.get(r.employee_id) ?? 0) + (r.hours || 0));
  }

  const activeCrew = crew.filter(
    (c) => (!c.join_date || c.join_date <= period.end) && (!c.termination_date || (c.last_day ?? c.termination_date) >= period.start),
  );

  const rows: ReportRow[] = activeCrew.map((c) => {
    const recs = attByEmp.get(c.id) ?? [];
    const present = new Set(recs.filter((r) => r.clock_in).map((r) => r.work_date));
    let late = 0;
    let earlyLeave = 0;
    let workedMinutes = 0;
    let noClockIn = 0;
    let noClockOut = 0;
    for (const r of recs) {
      const pseudo = { clock_in: r.clock_in, clock_out: r.clock_out, break_minutes: r.break_minutes, shifts: r.shifts } as unknown as AttendanceWithRelations;
      const st = attendanceStatuses(pseudo, graceCfg);
      if (st.includes("late")) late++;
      if (st.includes("early-leave")) earlyLeave++;
      workedMinutes += workDurationMinutes(pseudo) ?? 0;
      const isDayOff = !!r.shifts && !r.shifts.start_time && !r.shifts.end_time;
      if (!r.clock_in && !isDayOff) noClockIn++; // scheduled shift, never tapped in
      if (r.clock_in && !r.clock_out) noClockOut++; // tapped in, never tapped out
    }
    const presentDays = present.size;
    // Prorate working days to the crew's tenure within the period.
    const effStart = c.join_date && c.join_date > period.start ? c.join_date : period.start;
    const effEndRaw = c.last_day ?? c.termination_date;
    const effEnd = effEndRaw && effEndRaw < period.end ? effEndRaw : period.end;
    const effDays = daysInclusive(effStart, effEnd);
    const workingDays = Math.round((effDays * workingDaysPerWeek) / 7);
    const dayOff = Math.max(0, effDays - workingDays);
    const joinedMid = !!c.join_date && c.join_date > period.start && c.join_date <= period.end;
    return {
      employeeId: c.id,
      name: c.name,
      department: c.departments?.name ?? null,
      workingDays,
      present: presentDays,
      dayOff,
      absent: Math.max(0, workingDays - presentDays),
      noClockIn,
      noClockOut,
      late,
      earlyLeave,
      workedHours: Math.round((workedMinutes / 60) * 10) / 10,
      overtimeHours: Math.round((otByEmp.get(c.id) ?? 0) * 10) / 10,
      rate: workingDays > 0 ? presentDays / workingDays : 0,
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
