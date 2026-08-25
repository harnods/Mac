"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { payrollPeriod } from "@/lib/payroll";
import { activeSettingsVersion } from "@/lib/payroll-settings";
import { activeOvertimeVersion } from "@/lib/overtime";
import { computePayslip, type CalcAttendance, type ComponentMeta, type FormulaBasis } from "@/lib/payroll-calc";
import { getAttendanceSettings } from "@/app/actions/attendance";
import type {
  PayrollSettingsVersion,
  OvertimeCompensation,
  OvertimeCompensationVersion,
  PayrollRun,
  Payslip,
  PayslipLine,
  EmployeeAllowance,
} from "@/lib/supabase/types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Clamp payday day-of-month to the anchor month's length, as YYYY-MM-DD. */
function paydayISO(year: number, month: number, day: number) {
  const last = new Date(year, month + 1, 0).getDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(day, last))}`;
}

type CrewRow = {
  id: string;
  name: string;
  basic_salary: number | null;
  salary_unit: "day" | "month" | null;
  daily_allowance: number | null;
  allowances: EmployeeAllowance[] | null;
  job_level_id: string | null;
  join_date: string | null;
  termination_date: string | null;
  last_day: string | null;
  employment_statuses: { name: string } | null;
};

/** Generate (or regenerate) payroll for a cutoff period, identified by its end-month anchor. */
export async function runPayroll(anchorYear: number, anchorMonth: number): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  // Settings version in effect for this period (as of the anchor month end).
  const { data: sv } = await supabase
    .from("payroll_settings_versions")
    .select("id,effective_date,cutoff_start_day,cutoff_end_day,payday,daily_allowance_by_attendance,deduct_absence_from_salary,created_by,created_at");
  const settingsVersions = (sv ?? []) as PayrollSettingsVersion[];
  const anchorProbe = `${anchorYear}-${pad(anchorMonth + 1)}-28`;
  const settings = activeSettingsVersion(settingsVersions, anchorProbe);
  if (!settings) return { ok: false, error: "No payroll settings configured." };

  const period = payrollPeriod(anchorYear, anchorMonth, settings.cutoff_start_day, settings.cutoff_end_day);
  const payday = paydayISO(anchorYear, anchorMonth, settings.payday);
  const attSettings = await getAttendanceSettings();
  const workingDaysPerWeek = attSettings?.working_days_per_week ?? 6;

  // The account owner (admin/CEO) isn't crew — never payroll them.
  const { data: ownerRow } = await supabase.from("profiles").select("id").eq("is_owner", true).maybeSingle();

  // Inputs: crew active in the period, payroll components, overtime rates, attendance.
  const [{ data: crewData }, { data: compData }, { data: compVerData }, { data: otComps }, { data: otVers }, { data: attData }, { data: otReqData }] = await Promise.all([
    (() => {
      let q = supabase
        .from("employees")
        .select("id,name,basic_salary,salary_unit,daily_allowance,allowances,job_level_id,join_date,termination_date,last_day,employment_statuses(name)")
        .is("deleted_at", null);
      if (ownerRow?.id) q = q.or(`user_id.is.null,user_id.neq.${ownerRow.id}`);
      return q;
    })(),
    supabase.from("allowances").select("id,name,type"),
    supabase.from("payroll_component_versions").select("component_id,effective_date,formula_basis,formula_rate"),
    supabase.from("overtime_compensations").select("id,job_level_id"),
    supabase.from("overtime_compensation_versions").select("id,compensation_id,effective_date,amount_per_hour,cap_hours,max_hours_per_day,created_by,created_at"),
    supabase
      .from("attendance")
      .select("employee_id,work_date,clock_in,clock_out,break_minutes,shifts(name,start_time,end_time)")
      .gte("work_date", period.start)
      .lte("work_date", period.end),
    supabase
      .from("overtime_requests")
      .select("employee_id,work_date,hours")
      .eq("status", "approved")
      .gte("work_date", period.start)
      .lte("work_date", period.end),
  ]);

  // One-time adjustments for this period, grouped by crew.
  const { data: adjData } = await supabase
    .from("payroll_adjustments")
    .select("employee_id,label,type,amount,allowance_id,rate_unit,per_attendance")
    .eq("anchor_year", anchorYear)
    .eq("anchor_month", anchorMonth);
  type AdjArg = { label: string; type: "earning" | "deduction"; amount: number; allowance_id: string | null; rate_unit: "day" | "week" | "month"; per_attendance: boolean };
  const adjByEmp = new Map<string, AdjArg[]>();
  for (const a of (adjData ?? []) as { employee_id: string; label: string; type: "earning" | "deduction"; amount: number; allowance_id: string | null; rate_unit: "day" | "week" | "month" | null; per_attendance: boolean | null }[]) {
    const list = adjByEmp.get(a.employee_id) ?? [];
    list.push({ label: a.label, type: a.type, amount: Number(a.amount), allowance_id: a.allowance_id, rate_unit: a.rate_unit ?? "month", per_attendance: !!a.per_attendance });
    adjByEmp.set(a.employee_id, list);
  }

  const crew = (crewData ?? []) as unknown as CrewRow[];
  // Active formula per component (latest version effective on/before period end).
  const activeFormula = new Map<string, { basis: string; rate: number; eff: string }>();
  for (const v of (compVerData ?? []) as { component_id: string; effective_date: string; formula_basis: string | null; formula_rate: number | null }[]) {
    if (!v.formula_basis || v.formula_rate == null) continue;
    if (v.effective_date > period.end) continue;
    const cur = activeFormula.get(v.component_id);
    if (!cur || v.effective_date > cur.eff) {
      activeFormula.set(v.component_id, { basis: v.formula_basis, rate: Number(v.formula_rate), eff: v.effective_date });
    }
  }

  const components: Record<string, ComponentMeta> = {};
  for (const c of (compData ?? []) as { id: string; name: string; type: "earning" | "deduction" }[]) {
    const f = activeFormula.get(c.id);
    components[c.id] = { name: c.name, type: c.type, formula: f ? { basis: f.basis as FormulaBasis, rate: f.rate } : null };
  }

  // Active overtime version per job level (as of period end).
  const otByComp = new Map<string, OvertimeCompensationVersion[]>();
  for (const v of (otVers ?? []) as OvertimeCompensationVersion[]) {
    const list = otByComp.get(v.compensation_id) ?? [];
    list.push(v);
    otByComp.set(v.compensation_id, list);
  }
  const overtimeByLevel = new Map<string, { amount_per_hour: number; cap_hours: boolean; max_hours_per_day: number }>();
  for (const c of (otComps ?? []) as Pick<OvertimeCompensation, "id" | "job_level_id">[]) {
    if (!c.job_level_id) continue;
    const active = activeOvertimeVersion(otByComp.get(c.id) ?? [], period.end);
    if (active) overtimeByLevel.set(c.job_level_id, { amount_per_hour: active.amount_per_hour, cap_hours: active.cap_hours, max_hours_per_day: active.max_hours_per_day });
  }

  // Attendance grouped by employee.
  const attByEmp = new Map<string, CalcAttendance[]>();
  for (const a of (attData ?? []) as unknown as (CalcAttendance & { employee_id: string; shifts: CalcAttendance["shift"] })[]) {
    const list = attByEmp.get(a.employee_id) ?? [];
    list.push({ work_date: a.work_date, clock_in: a.clock_in, clock_out: a.clock_out, break_minutes: a.break_minutes, shift: a.shifts });
    attByEmp.set(a.employee_id, list);
  }

  // Approved overtime requests grouped by employee.
  const otByEmp = new Map<string, { work_date: string; hours: number }[]>();
  for (const r of (otReqData ?? []) as { employee_id: string; work_date: string; hours: number }[]) {
    const list = otByEmp.get(r.employee_id) ?? [];
    list.push({ work_date: r.work_date, hours: r.hours });
    otByEmp.set(r.employee_id, list);
  }

  // Only crew employed during the period: joined on/before it ends, not gone
  // before it starts. Part-timers are paid per attended day, so they're only
  // included if they actually clocked in during the period.
  const hasPresent = (id: string) => (attByEmp.get(id) ?? []).some((a) => a.clock_in);
  const activeCrew = crew.filter((c) => {
    const employed = (!c.join_date || c.join_date <= period.end) && (!c.termination_date || (c.last_day ?? c.termination_date) >= period.start);
    if (!employed) return false;
    const isPT = (c.employment_statuses?.name ?? "").toLowerCase().includes("part");
    if (isPT && !hasPresent(c.id)) return false;
    return true;
  });

  // Upsert the run and clear its previous payslips.
  const { data: runRow, error: runErr } = await supabase
    .from("payroll_runs")
    .upsert(
      { anchor_year: anchorYear, anchor_month: anchorMonth, period_start: period.start, period_end: period.end, payday, status: "draft", created_by: profile.id, updated_at: new Date().toISOString() },
      { onConflict: "anchor_year,anchor_month" },
    )
    .select("id")
    .single();
  if (runErr || !runRow) return { ok: false, error: runErr?.message ?? "Could not create run" };
  const runId = runRow.id as string;

  await supabase.from("payslips").delete().eq("run_id", runId);

  for (const c of activeCrew) {
    const salaryPerDay = c.salary_unit === "day";
    const overtime = c.job_level_id ? overtimeByLevel.get(c.job_level_id) ?? null : null;
    // Prorate to the crew's tenure within the period: joined mid-period → count
    // only from the join date; resigned mid-period → up to the last day.
    const effStart = c.join_date && c.join_date > period.start ? c.join_date : period.start;
    const effEndRaw = c.last_day ?? c.termination_date;
    const effEnd = effEndRaw && effEndRaw < period.end ? effEndRaw : period.end;
    const result = computePayslip({
      period: { start: effStart, end: effEnd },
      employee: {
        basic_salary: c.basic_salary,
        allowances: c.allowances ?? [],
        salary_per_day: salaryPerDay,
      },
      attendance: attByEmp.get(c.id) ?? [],
      overtimeEntries: otByEmp.get(c.id) ?? [],
      settings: {
        deduct_absence_from_salary: settings.deduct_absence_from_salary,
        working_days_per_week: workingDaysPerWeek,
        late_grace_minutes: attSettings?.late_grace_minutes ?? 0,
        late_tolerance_direction: attSettings?.late_tolerance_direction ?? "after",
      },
      overtime,
      components,
      adjustments: adjByEmp.get(c.id) ?? [],
    });

    const { data: ps, error: psErr } = await supabase
      .from("payslips")
      .insert({
        run_id: runId,
        employee_id: c.id,
        working_days: result.working_days,
        present_days: result.present_days,
        absent_days: result.absent_days,
        day_off_days: result.day_off_days,
        overtime_hours: result.overtime_hours,
        earnings_total: result.earnings_total,
        deductions_total: result.deductions_total,
        thp: result.thp,
      })
      .select("id")
      .single();
    if (psErr || !ps) return { ok: false, error: psErr?.message ?? "Could not create payslip" };

    if (result.lines.length > 0) {
      const { error: lineErr } = await supabase.from("payslip_lines").insert(
        result.lines.map((l, i) => ({ payslip_id: ps.id, kind: l.kind, label: l.label, detail: l.detail, amount: l.amount, sort: i })),
      );
      if (lineErr) return { ok: false, error: lineErr.message };
    }
  }

  revalidatePath("/hr", "layout");
  return { ok: true, id: runId };
}

// ─── Reads ──────────────────────────────────────────────────────────────────

const RUN_COLUMNS = "id,anchor_year,anchor_month,period_start,period_end,payday,status,sent_at,created_by,created_at,updated_at";

/** Confirm (finalize) a draft run — payslips become official and visible to crew. */
export async function confirmPayrollRun(runId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll_runs")
    .update({ status: "finalized", updated_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true, id: runId };
}

/** Send payslips to crew for a finalized run (records the send time). */
export async function sendPayslips(runId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { data: run } = await supabase.from("payroll_runs").select("status").eq("id", runId).maybeSingle();
  if (!run) return { ok: false, error: "Run not found" };
  if (run.status !== "finalized") return { ok: false, error: "Confirm the payroll before sending payslips." };

  const { error } = await supabase
    .from("payroll_runs")
    .update({ sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true, id: runId };
}

export async function getPayrollRuns(): Promise<PayrollRun[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("payroll_runs").select(RUN_COLUMNS).order("period_end", { ascending: false });
  return (data ?? []) as PayrollRun[];
}

export async function getRunByAnchor(anchorYear: number, anchorMonth: number): Promise<PayrollRun | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("payroll_runs").select(RUN_COLUMNS).eq("anchor_year", anchorYear).eq("anchor_month", anchorMonth).maybeSingle();
  return (data ?? null) as PayrollRun | null;
}

export type RunPayslip = Payslip & { employee: { id: string; name: string } | null };

export async function getRunPayslips(runId: string): Promise<RunPayslip[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payslips")
    .select("*, employee:employees(id,name)")
    .eq("run_id", runId)
    .order("thp", { ascending: false });
  return (data ?? []) as unknown as RunPayslip[];
}

export type PayslipWithDetail = Payslip & { run: PayrollRun; lines: PayslipLine[] };

/** All payslips for one crew (newest period first), with their run + line items. */
export async function getCrewPayslips(employeeId: string): Promise<PayslipWithDetail[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payslips")
    .select("*, run:payroll_runs(*), lines:payslip_lines(*)")
    .eq("employee_id", employeeId);
  const rows = (data ?? []) as unknown as PayslipWithDetail[];
  // Only finalized runs are visible to crew — drafts (previews) stay hidden.
  const finalized = rows.filter((r) => r.run?.status === "finalized");
  finalized.sort((a, b) => (b.run?.period_end ?? "").localeCompare(a.run?.period_end ?? ""));
  for (const r of finalized) r.lines?.sort((a, b) => a.sort - b.sort);
  return finalized;
}

// ─── One-time payroll adjustments (per crew, per period) ─────────────────────

export type PayrollAdjustment = {
  id: string;
  employee_id: string;
  label: string;
  type: "earning" | "deduction";
  amount: number;
  allowance_id: string | null;
  rate_unit: "day" | "week" | "month";
  per_attendance: boolean;
};

export async function getPayrollAdjustments(anchorYear: number, anchorMonth: number): Promise<PayrollAdjustment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payroll_adjustments")
    .select("id,employee_id,label,type,amount,allowance_id,rate_unit,per_attendance")
    .eq("anchor_year", anchorYear)
    .eq("anchor_month", anchorMonth)
    .order("created_at");
  return (data ?? []) as PayrollAdjustment[];
}

export async function addPayrollAdjustment(input: {
  anchorYear: number; anchorMonth: number; employeeId: string;
  label: string; type: "earning" | "deduction"; amount: number;
  allowanceId?: string | null; rateUnit?: "day" | "week" | "month"; perAttendance?: boolean;
}): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };
  if (!input.label.trim()) return { ok: false, error: "Select a component" };
  // Free items and non-formula components need an amount; formula components
  // (which carry a component id but compute at run) are allowed a zero amount.
  if (!input.allowanceId && !(input.amount > 0)) return { ok: false, error: "Enter an amount" };

  const supabase = await createClient();
  const { error } = await supabase.from("payroll_adjustments").insert({
    anchor_year: input.anchorYear,
    anchor_month: input.anchorMonth,
    employee_id: input.employeeId,
    label: input.label.trim(),
    type: input.type,
    amount: input.amount,
    allowance_id: input.allowanceId ?? null,
    rate_unit: input.rateUnit ?? "month",
    per_attendance: !!input.perAttendance,
    created_by: profile.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr/payroll");
  return { ok: true };
}

export async function deletePayrollAdjustment(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };
  const supabase = await createClient();
  const { error } = await supabase.from("payroll_adjustments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr/payroll");
  return { ok: true };
}
