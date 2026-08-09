// Pure payroll calculation for one crew over one cutoff period. Kept free of
// DB/Supabase so it's easy to reason about and test.

export type CalcLine = { kind: "earning" | "deduction"; label: string; detail: string | null; amount: number };

export type CalcAttendance = {
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  shift: { start_time: string | null; end_time: string | null } | null;
};

export type CalcEmployee = {
  basic_salary: number | null;
  daily_allowance: number | null;
  allowances: { allowance_id: string; amount: number }[];
  /** Basic salary is quoted per day (paid × present days) rather than a monthly amount. */
  salary_per_day: boolean;
};

export type CalcSettings = {
  daily_allowance_by_attendance: boolean;
  deduct_absence_from_salary: boolean;
  /** Working days per 7-day week (rest are day off). Drives the working-day entitlement. */
  working_days_per_week: number;
};

export type CalcOvertime = { amount_per_hour: number; cap_hours: boolean; max_hours_per_day: number } | null;

export type ComponentMeta = { name: string; type: "earning" | "deduction" };

export type PayslipResult = {
  working_days: number;
  present_days: number;
  absent_days: number;
  day_off_days: number;
  overtime_hours: number;
  earnings_total: number;
  deductions_total: number;
  thp: number;
  lines: CalcLine[];
};

function daysInclusive(startISO: string, endISO: string): number {
  const [ys, ms, ds] = startISO.slice(0, 10).split("-").map(Number);
  const [ye, me, de] = endISO.slice(0, 10).split("-").map(Number);
  const a = Date.UTC(ys, ms - 1, ds);
  const b = Date.UTC(ye, me - 1, de);
  return Math.floor((b - a) / 86400000) + 1;
}

const round = (n: number) => Math.round(n);

export function computePayslip(args: {
  period: { start: string; end: string };
  employee: CalcEmployee;
  attendance: CalcAttendance[];
  /** Approved overtime requests in the period (by request, not from attendance). */
  overtimeEntries: { work_date: string; hours: number }[];
  settings: CalcSettings;
  overtime: CalcOvertime;
  components: Record<string, ComponentMeta>;
}): PayslipResult {
  const { period, employee, attendance, overtimeEntries, settings, overtime, components } = args;

  const periodDays = daysInclusive(period.start, period.end);

  // Working days come from the entitlement (e.g. 6 of every 7 days), so each
  // crew has the same working-day base regardless of which days they took off.
  // The remaining days are the day-off entitlement (~4 for a monthly period).
  const workingDays = Math.round((periodDays * settings.working_days_per_week) / 7);
  const dayOffDays = Math.max(0, periodDays - workingDays);

  // Present = distinct days actually clocked in. Absent = working days not worked.
  const presentDates = new Set(attendance.filter((a) => a.clock_in).map((a) => a.work_date));
  const presentDays = presentDates.size;
  const absentDays = Math.max(0, workingDays - presentDays);

  // Overtime is by approved request. Sum per day, capping each day at the
  // configured max hours (when the cap is on).
  let overtimeHours = 0;
  if (overtime) {
    const byDate = new Map<string, number>();
    for (const e of overtimeEntries) byDate.set(e.work_date, (byDate.get(e.work_date) ?? 0) + (e.hours || 0));
    for (const [, hrs] of byDate) {
      overtimeHours += overtime.cap_hours ? Math.min(hrs, overtime.max_hours_per_day) : hrs;
    }
    overtimeHours = Math.round(overtimeHours * 100) / 100;
  }

  const basic = employee.basic_salary ?? 0;
  const dailyAllowance = employee.daily_allowance ?? 0;
  const lines: CalcLine[] = [];

  // ── Earnings ──────────────────────────────────────────────────────────────
  if (employee.salary_per_day) {
    const amount = round(basic * presentDays);
    lines.push({ kind: "earning", label: "Basic salary", detail: `${presentDays} day(s) × Rp ${basic.toLocaleString("id-ID")}/day`, amount });
  } else {
    lines.push({ kind: "earning", label: "Basic salary", detail: "Monthly", amount: round(basic) });
  }

  if (dailyAllowance > 0) {
    const days = settings.daily_allowance_by_attendance ? presentDays : workingDays;
    lines.push({
      kind: "earning",
      label: "Daily allowance",
      detail: `${days} ${settings.daily_allowance_by_attendance ? "attended" : "working"} day(s) × Rp ${dailyAllowance.toLocaleString("id-ID")}`,
      amount: round(dailyAllowance * days),
    });
  }

  if (overtime && overtimeHours > 0) {
    lines.push({
      kind: "earning",
      label: "Overtime",
      detail: `${overtimeHours} hr(s) × Rp ${overtime.amount_per_hour.toLocaleString("id-ID")}/hr`,
      amount: round(overtimeHours * overtime.amount_per_hour),
    });
  }

  // Per-employee allowances, split by their component type.
  for (const a of employee.allowances) {
    const meta = components[a.allowance_id];
    if (!meta || !a.amount) continue;
    lines.push({ kind: meta.type, label: meta.name, detail: null, amount: round(a.amount) });
  }

  // ── Deductions ──────────────────────────────────────────────────────────────
  if (settings.deduct_absence_from_salary && !employee.salary_per_day && workingDays > 0 && absentDays > 0) {
    const amount = round((basic / workingDays) * absentDays);
    lines.push({
      kind: "deduction",
      label: "Absence deduction",
      detail: `${absentDays} absent day(s) × (Rp ${basic.toLocaleString("id-ID")} ÷ ${workingDays})`,
      amount,
    });
  }

  const earnings_total = lines.filter((l) => l.kind === "earning").reduce((s, l) => s + l.amount, 0);
  const deductions_total = lines.filter((l) => l.kind === "deduction").reduce((s, l) => s + l.amount, 0);

  return {
    working_days: workingDays,
    present_days: presentDays,
    absent_days: absentDays,
    day_off_days: dayOffDays,
    overtime_hours: overtimeHours,
    earnings_total,
    deductions_total,
    thp: earnings_total - deductions_total,
    lines,
  };
}
