import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { getPayrollSettingsVersions } from "@/app/actions/payroll";
import { activeSettingsVersion } from "@/lib/payroll-settings";
import { getRunByAnchor } from "@/app/actions/payroll-run";
import { payrollPeriod, currentPeriodAnchor } from "@/lib/payroll";
import { formatRp, formatDate } from "@/lib/format";
import { PayrollRunBar } from "@/components/employees/payroll-run-bar";
import { PayrollTable, type PayrollRow } from "@/components/employees/payroll-table";

export const dynamic = "force-dynamic";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ ym?: string }> }) {
  const { ym: ymParam } = await searchParams;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const settings = activeSettingsVersion(await getPayrollSettingsVersions(), today);
  const cutoffStart = settings?.cutoff_start_day ?? 21;
  const cutoffEnd = settings?.cutoff_end_day ?? 20;

  // Anchor (end-month) from ?ym=YYYY-MM, else the current period.
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

  // Month options: 14 months back through current period.
  const monthOptions = Array.from({ length: 15 }, (_, i) => {
    const d = new Date(def.year, def.month - 14 + i, 1);
    return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: `${MONTH[d.getMonth()]} ${d.getFullYear()}` };
  }).reverse();

  const run = await getRunByAnchor(anchorYear, anchorMonth);

  const supabase = await createClient();
  const { data: owner } = await supabase.from("profiles").select("id").eq("is_owner", true).maybeSingle();

  let crewQ = supabase
    .from("employees")
    .select("id,name,basic_salary,salary_unit,daily_allowance,allowances,join_date,termination_date,last_day,employment_statuses(name)")
    .is("deleted_at", null)
    .order("name");
  if (owner?.id) crewQ = crewQ.or(`user_id.is.null,user_id.neq.${owner.id}`);

  const [{ data: crewData }, { data: compData }, { data: fverData }, { data: adjData }, { data: attData }] = await Promise.all([
    crewQ,
    supabase.from("allowances").select("id,name,type"),
    supabase.from("payroll_component_versions").select("component_id").not("formula_basis", "is", null),
    supabase.from("payroll_adjustments").select("id,employee_id,label,type,amount").eq("anchor_year", anchorYear).eq("anchor_month", anchorMonth).order("created_at"),
    supabase.from("attendance").select("employee_id,work_date,clock_in").gte("work_date", period.start).lte("work_date", period.end).not("clock_in", "is", null),
  ]);

  const compMeta = new Map((((compData ?? []) as { id: string; name: string; type: "earning" | "deduction" }[]).map((c) => [c.id, c])));
  const formulaSet = new Set(((fverData ?? []) as { component_id: string }[]).map((v) => v.component_id));
  const presentByEmp = new Map<string, Set<string>>();
  for (const a of (attData ?? []) as { employee_id: string; work_date: string }[]) {
    (presentByEmp.get(a.employee_id) ?? presentByEmp.set(a.employee_id, new Set()).get(a.employee_id)!).add(a.work_date);
  }
  const adjByEmp = new Map<string, PayrollRow["adjustments"]>();
  for (const a of (adjData ?? []) as { id: string; employee_id: string; label: string; type: "earning" | "deduction"; amount: number }[]) {
    (adjByEmp.get(a.employee_id) ?? adjByEmp.set(a.employee_id, []).get(a.employee_id)!).push({ id: a.id, label: a.label, type: a.type, amount: Number(a.amount) });
  }

  // Payslips for this run (with line items), keyed by employee.
  const payslipByEmp = new Map<string, PayrollRow["payslip"]>();
  if (run) {
    const { data: psData } = await supabase
      .from("payslips")
      .select("employee_id,present_days,working_days,day_off_days,absent_days,overtime_hours,earnings_total,deductions_total,thp,lines:payslip_lines(kind,label,detail,amount,sort)")
      .eq("run_id", run.id);
    for (const p of (psData ?? []) as unknown as (NonNullable<PayrollRow["payslip"]> & { employee_id: string; lines: (NonNullable<PayrollRow["payslip"]>["lines"][number] & { sort: number })[] })[]) {
      const lines = [...(p.lines ?? [])].sort((a, b) => a.sort - b.sort);
      payslipByEmp.set(p.employee_id, { ...p, lines });
    }
  }

  type CrewRaw = {
    id: string; name: string; basic_salary: number | null; salary_unit: "day" | "month" | null;
    daily_allowance: number | null; allowances: { allowance_id: string; amount: number }[] | null;
    join_date: string | null; termination_date: string | null; last_day: string | null;
    employment_statuses: { name: string } | null;
  };

  const rows: PayrollRow[] = ((crewData ?? []) as unknown as CrewRaw[])
    .filter((c) => (!c.join_date || c.join_date <= period.end) && (!c.termination_date || (c.last_day ?? c.termination_date) >= period.start))
    .map((c) => {
      const isPT = (c.employment_statuses?.name ?? "").toLowerCase().includes("part");
      const presentDays = presentByEmp.get(c.id)?.size ?? 0;
      const fixed: PayrollRow["fixed"] = [];
      const formula: PayrollRow["formula"] = [];
      for (const a of c.allowances ?? []) {
        const m = compMeta.get(a.allowance_id);
        if (!m) continue;
        if (formulaSet.has(a.allowance_id)) formula.push({ name: m.name, type: m.type });
        else if (a.amount) fixed.push({ name: m.name, type: m.type, amount: Number(a.amount) });
      }
      return {
        id: c.id, name: c.name, baseSalary: c.basic_salary, salaryUnit: c.salary_unit,
        dailyAllowance: c.daily_allowance, fixed, formula,
        adjustments: adjByEmp.get(c.id) ?? [],
        payslip: payslipByEmp.get(c.id) ?? null,
        presentDays, isPartTime: isPT,
      };
    })
    // Part-timers only appear if they actually attended in the period.
    .filter((r) => !r.isPartTime || r.presentDays > 0 || r.payslip);

  const totalThp = rows.reduce((s, r) => s + (r.payslip?.thp ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
        <PayrollRunBar
          ym={ym}
          monthOptions={monthOptions}
          anchorYear={anchorYear}
          anchorMonth={anchorMonth}
          runId={run?.id ?? null}
          status={run?.status ?? null}
          sentAt={run?.sent_at ?? null}
          isAdmin={isAdmin}
        />
      </div>

      <div className="text-sm text-muted-foreground">
        Period <span className="text-foreground">{formatDate(period.start)} – {formatDate(period.end)}</span>
        {run && <> · Payday <span className="text-foreground">{formatDate(run.payday)}</span></>}
      </div>

      {run?.status === "draft" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          <span className="font-medium">Preview.</span> Review the figures below, then Confirm payroll. Payslips aren&rsquo;t shared with crew until confirmed.
        </div>
      )}
      {run?.status === "finalized" && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-400">
          <span className="font-medium">Confirmed.</span> {run.sent_at ? `Payslips sent ${formatDate(run.sent_at)}.` : "Payslips are visible on each crew’s profile. You can send them now."}
        </div>
      )}

      {!run && (
        <div className="rounded-lg border border-dashed px-4 py-2.5 text-sm text-muted-foreground">
          Preview below — review each crew&rsquo;s components and add any one-time items, then Run payroll to compute.
        </div>
      )}

      <PayrollTable rows={rows} anchorYear={anchorYear} anchorMonth={anchorMonth} isAdmin={isAdmin} />

      {run && rows.length > 0 && (
        <div className="flex justify-end text-sm">
          <span className="text-muted-foreground">Total take home pay:&nbsp;</span>
          <span className="font-semibold tabular-nums">{formatRp(totalThp)}</span>
        </div>
      )}
    </div>
  );
}
