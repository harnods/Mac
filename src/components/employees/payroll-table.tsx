"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Item = { label: string; caption: string | null; amount: number | null };

function PayrollDetail({ row, anchorYear, anchorMonth, isAdmin }: { row: PayrollRow; anchorYear: number; anchorMonth: number; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState<"earning" | "deduction" | null>(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");

  const ps = row.payslip;

  // Items per kind. After a run, use the computed payslip lines (with their
  // breakdown caption) except the one-time ones (shown editable below);
  // before a run, preview the assigned components.
  function items(kind: "earning" | "deduction"): Item[] {
    if (ps) {
      return ps.lines
        .filter((l) => l.kind === kind && l.detail !== "One-time")
        .map((l) => ({ label: l.label, caption: l.detail, amount: l.amount }));
    }
    const out: Item[] = [];
    if (kind === "earning") {
      out.push({ label: `Basic salary (${row.salaryUnit === "day" ? "per day" : "monthly"})`, caption: "computed at run", amount: null });
      if (row.dailyAllowance) out.push({ label: "Daily allowance", caption: `Rp ${row.dailyAllowance.toLocaleString("id-ID")}/day · computed at run`, amount: null });
    }
    for (const c of row.fixed.filter((c) => c.type === kind)) out.push({ label: c.name, caption: null, amount: c.amount });
    for (const c of row.formula.filter((c) => c.type === kind)) out.push({ label: c.name, caption: "formula · computed at run", amount: null });
    return out;
  }

  function add(kind: "earning" | "deduction") {
    if (!label.trim()) { toast.error("Label is required"); return; }
    if (!(Number(amount) > 0)) { toast.error("Enter an amount"); return; }
    start(async () => {
      const res = await addPayrollAdjustment({ anchorYear, anchorMonth, employeeId: row.id, label: label.trim(), type: kind, amount: Number(amount) });
      if (!res.ok) { toast.error(res.error); return; }
      setLabel(""); setAmount(""); setAdding(null);
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

  function Section({ kind, title }: { kind: "earning" | "deduction"; title: string }) {
    const sign = kind === "deduction" ? "−" : "";
    const cls = kind === "deduction" ? "text-red-600 dark:text-red-400" : "";
    const adjustments = row.adjustments.filter((a) => a.type === kind);
    const list = items(kind);
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
        <ul className="space-y-1.5">
          {list.map((it, i) => (
            <li key={`i${i}`} className="flex items-baseline justify-between gap-3">
              <span>
                {it.label}
                {it.caption && <span className="block text-xs text-muted-foreground">{it.caption}</span>}
              </span>
              <span className={`shrink-0 tabular-nums ${cls}`}>{it.amount != null ? `${sign}${formatRp(it.amount)}` : ""}</span>
            </li>
          ))}
          {adjustments.map((a) => (
            <li key={a.id} className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-1.5">
                {a.label} <span className="text-xs text-muted-foreground">(one-time)</span>
                {isAdmin && (
                  <button type="button" disabled={pending} onClick={() => remove(a.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </span>
              <span className={`shrink-0 tabular-nums ${cls}`}>{sign}{formatRp(a.amount)}</span>
            </li>
          ))}
          {list.length === 0 && adjustments.length === 0 && <li className="text-xs text-muted-foreground">None.</li>}
        </ul>
        {isAdmin && (
          adding === kind ? (
            <div className="flex flex-wrap items-end gap-2 pt-1">
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-9 w-40" autoFocus />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount (Rp)</Label>
                <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 w-32" />
              </div>
              <Button type="button" size="sm" disabled={pending} onClick={() => add(kind)}>Add</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(null); setLabel(""); setAmount(""); }}>Cancel</Button>
            </div>
          ) : (
            <button type="button" onClick={() => { setAdding(kind); setLabel(""); setAmount(""); }} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <Plus className="size-3.5" /> Add component
            </button>
          )
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Section kind="earning" title="Earning components" />
      <Section kind="deduction" title="Deduction components" />
    </div>
  );
}
