import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReportYearFilter } from "@/components/employees/report-year-filter";
import { TurnoverTrendChart } from "@/components/employees/turnover-trend-chart";
import { turnoverForYear, leaversInYear, formatPercent, type TurnoverEmployee } from "@/lib/turnover";
import { formatDate, durationSince } from "@/lib/format";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default async function TurnoverReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: rawYear } = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const currentYear = Number(today.slice(0, 4));

  const supabase = await createClient();
  const { data: owner } = await supabase.from("profiles").select("id").eq("is_owner", true).maybeSingle();
  let empQuery = supabase
    .from("employees")
    .select("id,name,join_date,termination_date,last_day,active,departments(name)")
    .is("deleted_at", null);
  if (owner?.id) empQuery = empQuery.or(`user_id.is.null,user_id.neq.${owner.id}`);
  const { data } = await empQuery;

  const emps: TurnoverEmployee[] = (data ?? []).map((e) => {
    const r = e as unknown as {
      id: string; name: string; join_date: string | null;
      termination_date: string | null; last_day: string | null; active: boolean;
      departments: { name: string } | null;
    };
    return {
      id: r.id,
      name: r.name,
      department: r.departments?.name ?? null,
      join_date: r.join_date,
      leave_date: r.last_day ?? r.termination_date ?? null,
      active: r.active,
    };
  });

  // Years present in the data (join or leave), plus the current year.
  const yearsSet = new Set<number>([currentYear]);
  for (const e of emps) {
    if (e.join_date) yearsSet.add(Number(e.join_date.slice(0, 4)));
    if (e.leave_date) yearsSet.add(Number(e.leave_date.slice(0, 4)));
  }
  const years = [...yearsSet].sort((a, b) => b - a);
  const year = rawYear && years.includes(Number(rawYear)) ? Number(rawYear) : currentYear;

  const summary = turnoverForYear(emps, year, today);
  const leavers = leaversInYear(emps, year);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Turnover report</h1>
        <Suspense fallback={null}>
          <ReportYearFilter years={years} value={year} />
        </Suspense>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active crew" value={summary.activeNow} hint="As of today" />
        <Stat label="Joined" value={summary.joined} hint={`In ${year}`} />
        <Stat label="Left" value={summary.left} hint={`In ${year}`} />
        <Stat label="Turnover rate" value={formatPercent(summary.turnover)} hint={`${year}, of avg headcount`} />
      </div>

      {/* Monthly breakdown */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Monthly breakdown</h2>
        {summary.months.length > 0 && (
          <TurnoverTrendChart data={summary.months.map((m) => ({ label: m.label, end: m.end }))} />
        )}
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-auto min-w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Month</TableHead>
                <TableHead className="w-[120px] text-right">Start</TableHead>
                <TableHead className="w-[120px] text-right">Joined</TableHead>
                <TableHead className="w-[120px] text-right">Left</TableHead>
                <TableHead className="w-[120px] text-right">End</TableHead>
                <TableHead className="w-[140px] text-right">Turnover</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.months.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No data for {year} yet.</TableCell>
                </TableRow>
              ) : (
                summary.months.map((m) => (
                  <TableRow key={m.label}>
                    <TableCell className="text-sm">{m.label}</TableCell>
                    <TableCell className="text-sm tabular-nums text-right">{m.start}</TableCell>
                    <TableCell className="text-sm tabular-nums text-right text-emerald-600">{m.joined ? `+${m.joined}` : "—"}</TableCell>
                    <TableCell className="text-sm tabular-nums text-right text-destructive">{m.left ? `−${m.left}` : "—"}</TableCell>
                    <TableCell className="text-sm tabular-nums text-right">{m.end}</TableCell>
                    <TableCell className="text-sm tabular-nums text-right">{formatPercent(m.turnover)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Leavers */}
      <div>
        <h2 className="mb-2 text-base font-semibold">Leavers in {year}</h2>
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-auto min-w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Name</TableHead>
                <TableHead className="w-[160px]">Department</TableHead>
                <TableHead className="w-[150px]">Join date</TableHead>
                <TableHead className="w-[150px]">Last day</TableHead>
                <TableHead className="w-[160px]">Tenure</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leavers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No leavers in {year}.</TableCell>
                </TableRow>
              ) : (
                leavers.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-sm">{e.department ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{e.join_date ? formatDate(e.join_date) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{e.leave_date ? formatDate(e.leave_date) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{e.join_date && e.leave_date ? durationSince(e.join_date, e.leave_date) : <span className="text-muted-foreground">—</span>}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
