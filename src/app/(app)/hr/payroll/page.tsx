import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { getPayrollSettingsVersions } from "@/app/actions/payroll";
import { activeSettingsVersion } from "@/lib/payroll-settings";
import { getRunByAnchor, getRunPayslips } from "@/app/actions/payroll-run";
import { payrollPeriod, currentPeriodAnchor } from "@/lib/payroll";
import { formatRp, formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { PayrollRunBar } from "@/components/employees/payroll-run-bar";

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
  const payslips = run ? await getRunPayslips(run.id) : [];
  const totalThp = payslips.reduce((s, p) => s + p.thp, 0);

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

      {!run ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Payroll hasn&rsquo;t been run for this period yet.
          {isAdmin && " Click Run payroll to generate payslips."}
        </div>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-auto min-w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Crew</TableHead>
                <TableHead className="w-[110px]">Present</TableHead>
                <TableHead className="w-[110px]">Day off</TableHead>
                <TableHead className="w-[110px]">Absent</TableHead>
                <TableHead className="w-[110px]">Overtime</TableHead>
                <TableHead className="w-[150px]">Earnings</TableHead>
                <TableHead className="w-[150px]">Deductions</TableHead>
                <TableHead className="w-[160px]">Take home pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslips.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No crew in this period.</TableCell>
                </TableRow>
              )}
              {payslips.map((p) => (
                <ClickableTableRow key={p.id} href={`/hr/crew/${p.employee_id}`}>
                  <TableCell className="font-medium">
                    <Link href={`/hr/crew/${p.employee_id}`} className="hover:underline">
                      {p.employee?.name ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{p.present_days}/{p.working_days}</TableCell>
                  <TableCell className="text-sm tabular-nums">{p.day_off_days || "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums">{p.absent_days || "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums">{p.overtime_hours ? `${p.overtime_hours}h` : "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums">{formatRp(p.earnings_total)}</TableCell>
                  <TableCell className="text-sm tabular-nums">{p.deductions_total ? `−${formatRp(p.deductions_total)}` : "—"}</TableCell>
                  <TableCell className="text-sm font-medium tabular-nums">{formatRp(p.thp)}</TableCell>
                </ClickableTableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {run && payslips.length > 0 && (
        <div className="flex justify-end text-sm">
          <span className="text-muted-foreground">Total take home pay:&nbsp;</span>
          <span className="font-semibold tabular-nums">{formatRp(totalThp)}</span>
        </div>
      )}
    </div>
  );
}
