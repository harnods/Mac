"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setEmployeeActive } from "@/app/actions/employees";

function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

/** Confirm marking a crew inactive, capturing the effective date. After this
 *  date the crew no longer appears in the schedule. */
export function EmployeeInactivateDialog({
  id,
  name,
  open,
  onOpenChange,
}: {
  id: string;
  name: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(todayISO());
  const [pending, start] = useTransition();

  function confirm() {
    if (!date) { toast.error("Pick the effective date"); return; }
    start(async () => {
      const res = await setEmployeeActive(id, false, date);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${name} marked inactive`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark &ldquo;{name}&rdquo; inactive</DialogTitle>
          <DialogDescription>
            From the effective date, this crew drops off the schedule. You can
            reactivate them anytime.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="inactive-date">Effective date</Label>
          <Input id="inactive-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={confirm} disabled={pending}>
            {pending ? "Saving..." : "Mark inactive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
