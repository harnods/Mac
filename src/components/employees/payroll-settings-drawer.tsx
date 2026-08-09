"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { updatePayrollSettings } from "@/app/actions/payroll";
import { ordinal } from "@/lib/payroll-settings";

export type SettingsPrefill = {
  effective_date: string;
  cutoff_start_day: number;
  cutoff_end_day: number;
  payday: number;
  daily_allowance_by_attendance: boolean;
  deduct_absence_from_salary: boolean;
};

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

function DaySelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent className="max-h-72">
        {DAY_OPTIONS.map((d) => (
          <SelectItem key={d} value={String(d)}>{ordinal(d)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PayrollSettingsDrawer({
  open,
  onOpenChange,
  prefill,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill: SettingsPrefill;
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [effectiveDate, setEffectiveDate] = useState(today);
  const [cutoffStart, setCutoffStart] = useState("21");
  const [cutoffEnd, setCutoffEnd] = useState("20");
  const [payday, setPayday] = useState("27");
  const [dailyByAttendance, setDailyByAttendance] = useState(true);
  const [deductAbsence, setDeductAbsence] = useState(false);

  // Reset the form each time the drawer opens, from the current values.
  useEffect(() => {
    if (!open) return;
    setEffectiveDate(prefill.effective_date.slice(0, 10));
    setCutoffStart(String(prefill.cutoff_start_day));
    setCutoffEnd(String(prefill.cutoff_end_day));
    setPayday(String(prefill.payday));
    setDailyByAttendance(prefill.daily_allowance_by_attendance);
    setDeductAbsence(prefill.deduct_absence_from_salary);
  }, [open, prefill, today]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveDate) { toast.error("Effective date is required"); return; }
    start(async () => {
      const res = await updatePayrollSettings({
        effective_date: effectiveDate,
        cutoff_start_day: Number(cutoffStart),
        cutoff_end_day: Number(cutoffEnd),
        payday: Number(payday),
        daily_allowance_by_attendance: dailyByAttendance,
        deduct_absence_from_salary: deductAbsence,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Payroll settings saved");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit payroll settings</SheetTitle>
          <SheetClose />
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ps-effective">Effective date</Label>
              <Input id="ps-effective" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="w-full" />
              <p className="text-xs text-muted-foreground">
                Keeping the same date updates the current settings. A new effective date adds a new entry to the history.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ps-cutoff-start">Cutoff start day</Label>
              <DaySelect id="ps-cutoff-start" value={cutoffStart} onChange={setCutoffStart} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ps-cutoff-end">Cutoff end day</Label>
              <DaySelect id="ps-cutoff-end" value={cutoffEnd} onChange={setCutoffEnd} />
              <p className="text-xs text-muted-foreground">
                Each period runs from the {ordinal(Number(cutoffStart))} to the {ordinal(Number(cutoffEnd))} of the next month.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ps-payday">Payday</Label>
              <DaySelect id="ps-payday" value={payday} onChange={setPayday} />
              <p className="text-xs text-muted-foreground">If a month has fewer days, payday falls on the last day of that month.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="ps-daily">Daily allowance by attendance</Label>
                <Switch id="ps-daily" checked={dailyByAttendance} onCheckedChange={setDailyByAttendance} />
              </div>
              <p className="text-xs text-muted-foreground">
                {dailyByAttendance
                  ? "Paid only for days the crew clocked in — absent days and day off earn no daily allowance."
                  : "Paid for every working day in the period (total days minus Day off shifts). Crew on leave or sick still receive it."}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="ps-deduct">Deduct absence from basic salary</Label>
                <Switch id="ps-deduct" checked={deductAbsence} onCheckedChange={setDeductAbsence} />
              </div>
              <p className="text-xs text-muted-foreground">
                {deductAbsence
                  ? "Days absent (not a Day off) — permit, sick, or no-show — are deducted: basic salary ÷ working days in the period × days absent."
                  : "Absent days are not deducted from basic salary."}
              </p>
            </div>
          </SheetBody>
          <SheetFooter className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save changes"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
