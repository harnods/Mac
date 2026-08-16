import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { AccessDenied } from "@/components/access-denied";
import { formatRp, formatDate } from "@/lib/format";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ReportDateFilter } from "@/components/reports/report-date-filter";

export const dynamic = "force-dynamic";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function ServiceChargeReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!can(profile, P.SALES_READ)) return <AccessDenied label="Service charge report" />;

  const sp = await searchParams;
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : isoDaysAgo(29);
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : todayIso();

  const supabase = await createClient();
  const { data } = await supabase
    .from("sales_entries")
    .select("entry_date, service_charge, net_sales")
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date");
  const entries = (data ?? []) as { entry_date: string; service_charge: number; net_sales: number }[];

  // Group by day.
  const byDay = new Map<string, { sc: number; entries: number }>();
  let totalSc = 0;
  for (const e of entries) {
    totalSc += Number(e.service_charge);
    const cur = byDay.get(e.entry_date) ?? { sc: 0, entries: 0 };
    cur.sc += Number(e.service_charge);
    cur.entries += 1;
    byDay.set(e.entry_date, cur);
  }
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Service charge report</h1>
        <ReportDateFilter from={from} to={to} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total service charge</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{formatRp(totalSc)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Days with sales</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{byDay.size}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Entries</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{entries.length}</div>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">By day</h2>
        {days.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No sales in this range.</div>
        ) : (
          <div className="table-outer overflow-x-auto rounded-lg border">
            <Table className="w-auto min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[240px]">Date</TableHead>
                  <TableHead className="text-right w-[120px]">Entries</TableHead>
                  <TableHead className="text-right w-[180px]">Service charge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map(([date, d]) => (
                  <TableRow key={date}>
                    <TableCell className="font-medium">{formatDate(date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.entries}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRp(d.sc)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
