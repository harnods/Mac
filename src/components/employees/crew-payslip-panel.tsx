"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRp, formatDate } from "@/lib/format";
import type { Payslip, PayslipLine, PayrollRun } from "@/lib/supabase/types";

type PayslipWithDetail = Payslip & { run: PayrollRun; lines: PayslipLine[] };

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function periodLabel(run: PayrollRun) {
  return `${MONTH[run.anchor_month]} ${run.anchor_year}`;
}

function LineRows({ lines }: { lines: PayslipLine[] }) {
  if (lines.length === 0) return <p className="py-1 text-sm text-muted-foreground">None</p>;
  return (
    <div className="divide-y">
      {lines.map((l) => (
        <div key={l.id} className="flex items-start justify-between gap-4 py-2">
          <div className="min-w-0">
            <div className="text-sm">{l.label}</div>
            {l.detail && <div className="text-xs text-muted-foreground">{l.detail}</div>}
          </div>
          <div className="shrink-0 text-sm tabular-nums">{formatRp(l.amount)}</div>
        </div>
      ))}
    </div>
  );
}

export function CrewPayslipPanel({ payslips }: { payslips: PayslipWithDetail[] }) {
  const [selectedId, setSelectedId] = useState(payslips[0]?.id ?? "");
  const slip = payslips.find((p) => p.id === selectedId) ?? payslips[0];

  if (!slip) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No payslips yet. Run payroll for a period to generate one.</p>;
  }

  const earnings = slip.lines.filter((l) => l.kind === "earning");
  const deductions = slip.lines.filter((l) => l.kind === "deduction");

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={slip.id} onValueChange={setSelectedId}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {payslips.map((p) => (
              <SelectItem key={p.id} value={p.id}>{periodLabel(p.run)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground">
          {formatDate(slip.run.period_start)} – {formatDate(slip.run.period_end)} · Payday {formatDate(slip.run.payday)}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <span>Present <span className="text-foreground tabular-nums">{slip.present_days}/{slip.working_days}</span></span>
        {slip.absent_days > 0 && <span>Absent <span className="text-foreground tabular-nums">{slip.absent_days}</span></span>}
        {slip.day_off_days > 0 && <span>Day off <span className="text-foreground tabular-nums">{slip.day_off_days}</span></span>}
        {slip.overtime_hours > 0 && <span>Overtime <span className="text-foreground tabular-nums">{slip.overtime_hours}h</span></span>}
      </div>

      <section className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Earnings</h3>
          <span className="text-sm font-medium tabular-nums">{formatRp(slip.earnings_total)}</span>
        </div>
        <LineRows lines={earnings} />
      </section>

      <section className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Deductions</h3>
          <span className="text-sm font-medium tabular-nums">{deductions.length ? `−${formatRp(slip.deductions_total)}` : formatRp(0)}</span>
        </div>
        <LineRows lines={deductions} />
      </section>

      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-sm font-semibold">Take home pay</span>
        <span className="text-lg font-semibold tabular-nums">{formatRp(slip.thp)}</span>
      </div>
    </div>
  );
}
