"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatRp } from "@/lib/format";
import { addPayrollAdjustment, deletePayrollAdjustment } from "@/app/actions/payroll-run";

type Line = { kind: "earning" | "deduction"; label: string; detail: string | null; amount: number };
type Adjustment = { id: string; label: string; type: "earning" | "deduction"; amount: number };

export type PayrollRow = {
  id: string;
  name: string;
  baseSalary: number | null;
  salaryUnit: "day" | "month" | null;
  dailyAllowance: number | null;
  fixed: { name: string; type: "earning" | "deduction"; amount: number }[];
  formula: { name: string; type: "earning" | "deduction" }[];
  adjustments: Adjustment[];
  presentDays: number;
  isPartTime: boolean;
  payslip: {
    present_days: number; working_days: number; day_off_days: number; absent_days: number;
    overtime_hours: number; earnings_total: number; deductions_total: number; thp: number; lines: Line[];
  } | null;
};

const dash = <span className="text-muted-foreground">—</span>;

export function PayrollTable({
  rows, anchorYear, anchorMonth, isAdmin,
}: {
  rows: PayrollRow[];
  anchorYear: number;
  anchorMonth: number;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpen((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="w-8" />
            <th className="px-3 py-2 text-left font-medium">Crew</th>
            <th className="px-3 py-2 text-left font-medium w-[110px]">Present</th>
            <th className="px-3 py-2 text-left font-medium w-[90px]">Absent</th>
            <th className="px-3 py-2 text-left font-medium w-[140px]">Earnings</th>
            <th className="px-3 py-2 text-left font-medium w-[140px]">Deductions</th>
            <th className="px-3 py-2 text-left font-medium w-[150px]">Take home pay</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No crew in this period.</td></tr>
          )}
          {rows.map((r) => {
            const isOpen = open.has(r.id);
            const ps = r.payslip;
            return (
              <>
                <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer" onClick={() => toggle(r.id)}>
                  <td className="pl-3 text-muted-foreground">
                    <ChevronRight className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/hr/crew/${r.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{r.name}</Link>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{ps ? (r.isPartTime ? `${ps.present_days}d` : `${ps.present_days}/${ps.working_days}`) : (r.presentDays ? `${r.presentDays}d` : dash)}</td>
                  <td className="px-3 py-2 tabular-nums">{ps ? (ps.absent_days || dash) : dash}</td>
                  <td className="px-3 py-2 tabular-nums">{ps ? formatRp(ps.earnings_total) : dash}</td>
                  <td className="px-3 py-2 tabular-nums">{ps ? (ps.deductions_total ? `−${formatRp(ps.deductions_total)}` : dash) : dash}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">{ps ? formatRp(ps.thp) : dash}</td>
                </tr>
                {isOpen && (
                  <tr className="border-b last:border-b-0 bg-muted/20">
                    <td />
                    <td colSpan={6} className="px-3 py-3">
                      <PayrollDetail row={r} anchorYear={anchorYear} anchorMonth={anchorMonth} isAdmin={isAdmin} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PayrollDetail({ row, anchorYear, anchorMonth, isAdmin }: { row: PayrollRow; anchorYear: number; anchorMonth: number; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"earning" | "deduction">("earning");
  const [amount, setAmount] = useState("");

  function add() {
    if (!label.trim()) { toast.error("Label is required"); return; }
    if (!(Number(amount) > 0)) { toast.error("Enter an amount"); return; }
    start(async () => {
      const res = await addPayrollAdjustment({ anchorYear, anchorMonth, employeeId: row.id, label: label.trim(), type, amount: Number(amount) });
      if (!res.ok) { toast.error(res.error); return; }
      setLabel(""); setAmount(""); setType("earning");
      router.refresh();
    });
  }
  function remove(id: string) {
    start(async () => {
      const res = await deletePayrollAdjustment(id);
      if (!res.ok) { toast.error(res.error); return; }
      router.refresh();
    });
  }

  const ps = row.payslip;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Components / breakdown */}
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Components</div>
        {ps ? (
          <ul className="space-y-1">
            {ps.lines.map((l, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span>
                  {l.label}
                  {l.detail && <span className="ml-1 text-xs text-muted-foreground">· {l.detail}</span>}
                </span>
                <span className={`tabular-nums ${l.kind === "deduction" ? "text-red-600 dark:text-red-400" : ""}`}>
                  {l.kind === "deduction" ? "−" : ""}{formatRp(l.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-1">
            <li className="flex justify-between gap-3"><span>Basic salary {row.salaryUnit === "day" ? "(per day)" : "(monthly)"}</span><span className="text-xs text-muted-foreground">computed at run</span></li>
            {row.dailyAllowance ? <li className="flex justify-between gap-3"><span>Daily allowance</span><span className="text-xs text-muted-foreground">computed at run</span></li> : null}
            {row.fixed.map((c, i) => (
              <li key={`f${i}`} className="flex justify-between gap-3">
                <span>{c.name}</span>
                <span className={`tabular-nums ${c.type === "deduction" ? "text-red-600 dark:text-red-400" : ""}`}>{c.type === "deduction" ? "−" : ""}{formatRp(c.amount)}</span>
              </li>
            ))}
            {row.formula.map((c, i) => (
              <li key={`fo${i}`} className="flex justify-between gap-3">
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground">formula · computed at run</span>
              </li>
            ))}
            {row.fixed.length === 0 && row.formula.length === 0 && !row.dailyAllowance && (
              <li className="text-xs text-muted-foreground">Only basic salary. Add one-time components on the right if needed.</li>
            )}
          </ul>
        )}
      </div>

      {/* One-time components for this period */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">One-time this period</div>
        {row.adjustments.length === 0 && <p className="text-xs text-muted-foreground">None.</p>}
        {row.adjustments.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
            <span>{a.label} <span className="text-xs text-muted-foreground">({a.type})</span></span>
            <span className="flex items-center gap-2">
              <span className={`tabular-nums ${a.type === "deduction" ? "text-red-600 dark:text-red-400" : ""}`}>{a.type === "deduction" ? "−" : ""}{formatRp(a.amount)}</span>
              {isAdmin && (
                <button type="button" disabled={pending} onClick={() => remove(a.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </span>
          </div>
        ))}
        {isAdmin && (
          <div className="flex flex-wrap items-end gap-2 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "earning" | "deduction")}>
                <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="earning">Earning</SelectItem>
                  <SelectItem value="deduction">Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount (Rp)</Label>
              <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 w-32" />
            </div>
            <Button type="button" size="sm" disabled={pending} onClick={add}><Plus className="size-4" /> Add</Button>
          </div>
        )}
        {row.adjustments.length > 0 && !ps && (
          <p className="text-[11px] text-muted-foreground">These apply when you run payroll for this period.</p>
        )}
      </div>
    </div>
  );
}
