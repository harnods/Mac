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
import { resignEmployee } from "@/app/actions/employees";

export function EmployeeResignDialog({
  id,
  name,
  terminationDate: initialTermination,
  lastDay: initialLastDay,
  open,
  onOpenChange,
}: {
  id: string;
  name: string;
  terminationDate?: string | null;
  lastDay?: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [terminationDate, setTerminationDate] = useState(initialTermination ?? "");
  const [lastDay, setLastDay] = useState(initialLastDay ?? "");

  function handleResign() {
    if (!terminationDate) { toast.error("Termination date is required"); return; }
    if (!lastDay) { toast.error("Last day is required"); return; }
    start(async () => {
      const res = await resignEmployee(id, { termination_date: terminationDate, last_day: lastDay });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${name} marked as resigned`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resign &ldquo;{name}&rdquo;?</DialogTitle>
          <DialogDescription>
            Mark this crew as resigned. Set the termination date and last working day.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="termination-date">Termination date</Label>
            <Input
              id="termination-date"
              type="date"
              value={terminationDate}
              onChange={(e) => setTerminationDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-day">Last day</Label>
            <Input
              id="last-day"
              type="date"
              value={lastDay}
              onChange={(e) => setLastDay(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={handleResign} disabled={pending}>
            {pending ? "Saving..." : "Confirm resign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
