"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };
type ShiftOption = { id: string; name: string; start_time: string | null; end_time: string | null; active?: boolean };

const NO_SHIFT = "__none__";

function shiftLabel(s: ShiftOption) {
  return s.start_time && s.end_time
    ? `${s.name} (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})`
    : s.name;
}

/** Alphabetical by name, then by start time. */
function sortShifts(shifts: ShiftOption[]) {
  return [...shifts].sort(
    (a, b) => a.name.localeCompare(b.name) || (a.start_time ?? "").localeCompare(b.start_time ?? ""),
  );
}

export function ShiftEditDialog({
  shifts,
  currentShiftId,
  contextLabel,
  open,
  onOpenChange,
  onSave,
  onSaved,
}: {
  shifts: ShiftOption[];
  currentShiftId: string | null;
  contextLabel?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (shiftId: string | null) => Promise<ActionResult>;
  onSaved?: () => void;
}) {
  const [value, setValue] = useState(currentShiftId ?? NO_SHIFT);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) setValue(currentShiftId ?? NO_SHIFT);
  }, [open, currentShiftId]);

  function handleSave() {
    start(async () => {
      const res = await onSave(value === NO_SHIFT ? null : value);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Shift updated");
      onOpenChange(false);
      onSaved?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change shift</DialogTitle>
          <DialogDescription>
            {contextLabel ?? "Pick a shift for this day. Choose Day off if the crew isn't working."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="shift-select">Shift</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger id="shift-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SHIFT}>No shift</SelectItem>
              {sortShifts(shifts).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex flex-col">
                    <span>{shiftLabel(s)}</span>
                    {s.active === false && (
                      <span className="text-xs text-muted-foreground">Inactive</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
