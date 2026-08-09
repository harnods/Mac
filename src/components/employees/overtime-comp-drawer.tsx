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
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { createOvertimeCompensation, updateOvertimeCompensation } from "@/app/actions/overtime";

export type OvertimePrefill = {
  id: string;
  name: string;
  job_level_id: string | null;
  amount_per_hour: number;
  cap_hours: boolean;
  max_hours_per_day: number;
  effective_date: string;
};

type JobLevel = { id: string; name: string };

export function OvertimeCompDrawer({
  open,
  onOpenChange,
  jobLevels,
  prefill,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobLevels: JobLevel[];
  prefill?: OvertimePrefill;
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isEdit = !!prefill;

  const [name, setName] = useState("");
  const [jobLevelId, setJobLevelId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [capHours, setCapHours] = useState(true);
  const [maxHours, setMaxHours] = useState("4.5");
  const [effectiveDate, setEffectiveDate] = useState(today);

  useEffect(() => {
    if (!open) return;
    setName(prefill?.name ?? "");
    setJobLevelId(prefill?.job_level_id ?? "");
    setAmount(prefill ? String(prefill.amount_per_hour) : "");
    setCapHours(prefill?.cap_hours ?? true);
    setMaxHours(prefill ? String(prefill.max_hours_per_day) : "4.5");
    setEffectiveDate(prefill?.effective_date ?? today);
  }, [open, prefill, today]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!jobLevelId) { toast.error("Job level is required"); return; }
    start(async () => {
      const input = {
        name: name.trim(),
        job_level_id: jobLevelId,
        amount_per_hour: amount === "" ? 0 : Number(amount),
        cap_hours: capHours,
        max_hours_per_day: maxHours === "" ? 0 : Number(maxHours),
        effective_date: effectiveDate,
      };
      const res = isEdit
        ? await updateOvertimeCompensation(prefill.id, input)
        : await createOvertimeCompensation(input);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(isEdit ? "Overtime compensation updated" : "Overtime compensation created");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit overtime compensation" : "Add overtime compensation"}</SheetTitle>
          <SheetClose />
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ot-name">Name</Label>
              <Input id="ot-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ot-level">Job level</Label>
              <Select value={jobLevelId} onValueChange={setJobLevelId}>
                <SelectTrigger id="ot-level" className="w-full"><SelectValue placeholder="Select job level" /></SelectTrigger>
                <SelectContent>
                  {jobLevels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Overtime compensation is set per job level.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ot-amount">Amount per hour</Label>
              <InputGroup className="h-10">
                <InputGroupAddon align="inline-start"><InputGroupText>Rp</InputGroupText></InputGroupAddon>
                <InputGroupInput id="ot-amount" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <InputGroupAddon align="inline-end"><InputGroupText>/hour</InputGroupText></InputGroupAddon>
              </InputGroup>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="ot-cap">Cap overtime hours counted</Label>
                <Switch id="ot-cap" checked={capHours} onCheckedChange={setCapHours} />
              </div>
              {capHours ? (
                <div className="pt-1">
                  <InputGroup className="h-10 w-48">
                    <InputGroupInput id="ot-max" type="number" min="0" step="0.5" value={maxHours} onChange={(e) => setMaxHours(e.target.value)} />
                    <InputGroupAddon align="inline-end"><InputGroupText>hrs/day</InputGroupText></InputGroupAddon>
                  </InputGroup>
                  <p className="mt-1 text-xs text-muted-foreground">Overtime beyond this many hours per day is not counted. Default 4.5.</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">All overtime hours are counted.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ot-effective">Effective date</Label>
              <Input id="ot-effective" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="w-full" />
              {isEdit && (
                <p className="text-xs text-muted-foreground">A new effective date adds a new entry to this compensation&rsquo;s history.</p>
              )}
            </div>
          </SheetBody>
          <SheetFooter className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : isEdit ? "Save changes" : "Save"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
