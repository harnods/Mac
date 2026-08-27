"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRp } from "@/lib/format";
import { addPayrollAdjustment, deletePayrollAdjustment } from "@/app/actions/payroll-run";

type Line = { kind: "earning" | "deduction"; label: string; detail: string | null; amount: number };
type RateUnit = "day" | "week" | "month";
type Adjustment = {
  id: string;
  label: string;
  type: "earning" | "deduction";
  amount: number;
  rateUnit: RateUnit;
  perAttendance: boolean;
  isFormula: boolean;
};

export type ComponentOption = { id: string; name: string; type: "earning" | "deduction"; isFormula: boolean };

export type PayrollRow = {
  id: string;
  name: string;
  baseSalary: number | null;
  salaryUnit: "day" | "month" | null;
  fixed: { name: string; type: "earning" | "deduction"; amount: number; rateUnit: RateUnit; perAttendance: boolean }[];
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
const UNIT_LABEL: Record<RateUnit, string> = { day: "/day", week: "/week", month: "/month" };

const rateCaption = (amount: number, unit: RateUnit, perAttendance: boolean) =>
  `Rp ${amount.toLocaleString("id-ID")} ${UNIT_LABEL[unit]}${unit === "day" && perAttendance ? " · per attendance" : ""}`;

export function PayrollTable({
  rows, components, anchorYear, anchorMonth, isAdmin,
}: {
  rows: PayrollRow[];
  components: ComponentOption[];
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
                  <td className="px-3 py-2 font-medium">{r.name}</td>
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
                      <PayrollDetail row={r} components={components} anchorYear={anchorYear} anchorMonth={anchorMonth} isAdmin={isAdmin} />
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

function PayrollDetail({ row, components, anchorYear, anchorMonth, isAdmin }: {
  row: PayrollRow; components: ComponentOption[]; anchorYear: number; anchorMonth: number; isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState<"earning" | "deduction" | null>(null);
  const [componentId, setComponentId] = useState("");
  const [amount, setAmount] = useState("");

  const ps = row.payslip;
  const selected = components.find((c) => c.id === componentId);

  // Assigned components previewed before a run; computed payslip lines after.
  function items(kind: "earning" | "deduction"): Item[] {
    if (ps) {
      return ps.lines
        .filter((l) => l.kind === kind && !(l.detail ?? "").startsWith("One-time"))
        .map((l) => ({ label: l.label, caption: l.detail, amount: l.amount }));
    }
    const out: Item[] = [];
    if (kind === "earning") {
      out.push({ label: `Basic salary (${row.salaryUnit === "day" ? "per day" : "monthly"})`, caption: "computed at run", amount: null });
    }
    for (const c of row.fixed.filter((c) => c.type === kind)) {
      if (c.rateUnit === "month") {
        out.push({ label: c.name, caption: null, amount: c.amount });
      } else {
        out.push({ label: c.name, caption: `${rateCaption(c.amount, c.rateUnit, c.perAttendance)} · computed at run`, amount: null });
      }
    }
    for (const c of row.formula.filter((c) => c.type === kind)) out.push({ label: c.name, caption: "formula · computed at run", amount: null });
    return out;
  }

  // Post-run amount for a one-time adjustment: the computed one-time line with the same label.
  function oneTimeAmount(kind: "earning" | "deduction", label: string): number | null {
    if (!ps) return null;
    const line = ps.lines.find((l) => l.kind === kind && l.label === label && (l.detail ?? "").startsWith("One-time"));
    return line ? line.amount : null;
  }

  function add(kind: "earning" | "deduction") {
    if (!selected) { toast.error("Select a component"); return; }
    if (!selected.isFormula && !(Number(amount) > 0)) { toast.error("Enter an amount"); return; }
    start(async () => {
      const res = await addPayrollAdjustment({
        anchorYear, anchorMonth, employeeId: row.id,
        label: selected.name, type: kind,
        amount: selected.isFormula ? 0 : Number(amount),
        allowanceId: selected.id,
        // Components added from a payroll run are always a one-time, flat amount.
        // Recurring per day/week/month lives on the crew profile instead.
        rateUnit: "month",
        perAttendance: false,
      });
      if (!res.ok) { toast.error(res.error); return; }
      resetForm();
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
  function resetForm() {
    setAdding(null); setComponentId(""); setAmount("");
  }

  function Section({ kind, title }: { kind: "earning" | "deduction"; title: string }) {
    const sign = kind === "deduction" ? "−" : "";
    const cls = kind === "deduction" ? "text-red-600 dark:text-red-400" : "";
    const adjustments = row.adjustments.filter((a) => a.type === kind);
    const list = items(kind);
    const options = components.filter((c) => c.type === kind);
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
          {adjustments.map((a) => {
            const amt = oneTimeAmount(kind, a.label) ?? (!a.isFormula && a.rateUnit === "month" ? a.amount : null);
            const caption = a.isFormula
              ? "one-time · formula · computed at run"
              : a.rateUnit === "month"
                ? "one-time"
                : `one-time · ${rateCaption(a.amount, a.rateUnit, a.perAttendance)}${ps ? "" : " · computed at run"}`;
            return (
              <li key={a.id} className="flex items-baseline justify-between gap-3">
                <span>
                  <span className="inline-flex items-center gap-1.5">
                    {a.label}
                    {isAdmin && (
                      <button type="button" disabled={pending} onClick={() => remove(a.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">{caption}</span>
                </span>
                <span className={`shrink-0 tabular-nums ${cls}`}>{amt != null ? `${sign}${formatRp(amt)}` : ""}</span>
              </li>
            );
          })}
          {list.length === 0 && adjustments.length === 0 && <li className="text-xs text-muted-foreground">None.</li>}
        </ul>
        {isAdmin && (
          adding === kind ? (
            <div className="space-y-2 rounded-lg border p-3">
              <Select value={componentId} onValueChange={(v) => { setComponentId(v); setAmount(""); }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select component" /></SelectTrigger>
                <SelectContent>
                  {options.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No {kind} components.</div>}
                  {options.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.isFormula && <span className="ml-1 text-muted-foreground">· formula</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selected && (selected.isFormula ? (
                <p className="text-xs text-muted-foreground">Auto calculated — computed by formula at payroll run.</p>
              ) : (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                  <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 pl-9" autoFocus />
                </div>
              ))}

              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={pending} onClick={() => add(kind)}>Add</Button>
                <Button type="button" size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { resetForm(); setAdding(kind); }} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <Plus className="size-3.5" /> Add component
            </button>
          )
        )}
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <Section kind="earning" title="Earning components" />
      <Section kind="deduction" title="Deduction components" />
    </div>
  );
}
