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
};

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

  useEffect(() => {
    if (!open) return;
    setName(prefill?.name ?? "");
    setType(prefill?.type ?? "earning");
    setEffectiveDate(prefill?.effective_date ?? today);
  }, [open, prefill, today]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const input = { name: name.trim(), type, effective_date: effectiveDate };
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
              <p className="text-xs text-muted-foreground">Amounts are set per job level.</p>
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
