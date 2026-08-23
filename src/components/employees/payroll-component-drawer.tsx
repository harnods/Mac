"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { createAllowance, updateAllowance } from "@/app/actions/employees";
import type { PayrollComponentType } from "@/lib/supabase/types";

export type ComponentPrefill = {
  id: string;
  name: string;
  type: PayrollComponentType;
  effective_date: string;
  formula_basis?: string | null;
  formula_rate?: number | null;
};

const FORMULA_OPTIONS: { value: string; label: string }[] = [
  { value: "late_days", label: "Late days" },
  { value: "missing_clock_in_days", label: "Missing clock-in days" },
  { value: "missing_clock_out_days", label: "Missing clock-out days" },
  { value: "incomplete_days", label: "Incomplete days (missing in/out)" },
  { value: "absent_days", label: "Absent days" },
  { value: "present_days", label: "Present days" },
  { value: "working_days", label: "Working days" },
  { value: "overtime_hours", label: "Overtime hours" },
];

const NO_FORMULA = "__none__";

export function PayrollComponentDrawer({
  open,
  onOpenChange,
  prefill,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: ComponentPrefill;
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isEdit = !!prefill;

  const [name, setName] = useState("");
  const [type, setType] = useState<PayrollComponentType>("earning");
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [formulaBasis, setFormulaBasis] = useState<string>(NO_FORMULA);
  const [formulaRate, setFormulaRate] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(prefill?.name ?? "");
    setType(prefill?.type ?? "earning");
    setEffectiveDate(prefill?.effective_date ?? today);
    setFormulaBasis(prefill?.formula_basis ?? NO_FORMULA);
    setFormulaRate(prefill?.formula_rate != null ? String(prefill.formula_rate) : "");
  }, [open, prefill, today]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hasFormula = formulaBasis !== NO_FORMULA;
    if (hasFormula && !(Number(formulaRate) > 0)) { toast.error("Enter an amount per unit for the formula"); return; }
    start(async () => {
      const input = {
        name: name.trim(),
        type,
        effective_date: effectiveDate,
        formula_basis: hasFormula ? formulaBasis : null,
        formula_rate: hasFormula ? Number(formulaRate) : null,
      };
      const res = isEdit ? await updateAllowance(prefill.id, input) : await createAllowance(input);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(isEdit ? "Payroll component updated" : "Payroll component created");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit payroll component" : "Add payroll component"}</SheetTitle>
          <SheetClose />
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pc-name">Name</Label>
              <Input id="pc-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as PayrollComponentType)}>
                <SelectTrigger id="pc-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="earning">Earning</SelectItem>
                  <SelectItem value="deduction">Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-effective">Effective date</Label>
              <Input id="pc-effective" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="w-full" />
              {isEdit && (
                <p className="text-xs text-muted-foreground">
                  A new effective date adds a new entry to this component&rsquo;s history.
                </p>
              )}
              <p className="text-xs text-muted-foreground">Fixed amounts are set per crew.</p>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <Label htmlFor="pc-formula">Formula (optional)</Label>
              <p className="text-xs text-muted-foreground">
                Compute the amount from attendance instead of a fixed amount, e.g. Rp30.000 × late days.
              </p>
              <Select value={formulaBasis} onValueChange={setFormulaBasis}>
                <SelectTrigger id="pc-formula" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FORMULA}>No formula (fixed amount)</SelectItem>
                  {FORMULA_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {formulaBasis !== NO_FORMULA && (
                <div className="space-y-1.5">
                  <Label htmlFor="pc-rate" className="text-xs">Amount per unit (Rp)</Label>
                  <Input id="pc-rate" type="number" min="0" step="1000" value={formulaRate} onChange={(e) => setFormulaRate(e.target.value)} className="w-full" placeholder="e.g. 30000" />
                </div>
              )}
            </div>
          </SheetBody>
          <SheetFooter className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Saving..." : isEdit ? "Save changes" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
