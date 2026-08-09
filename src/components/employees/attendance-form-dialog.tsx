"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createAttendance, updateAttendance } from "@/app/actions/attendance";
import type { AttendanceFormData } from "@/app/actions/attendance";
import type { AttendanceWithRelations } from "@/lib/supabase/types";

const NO_SHIFT = "__none__";

type Props = {
  formData: AttendanceFormData;
  record?: AttendanceWithRelations;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function todayJakarta() {
  // en-CA gives YYYY-MM-DD
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

export function AttendanceFormDialog({ formData, record, trigger, open: controlledOpen, onOpenChange }: Props) {
  const router = useRouter();
  const isEdit = !!record;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState(record?.employee_id ?? "");
  const [shiftId, setShiftId] = useState(record?.shift_id ?? NO_SHIFT);
  const [workDate, setWorkDate] = useState(record?.work_date ?? todayJakarta());
  const [clockIn, setClockIn] = useState(record?.clock_in?.slice(0, 5) ?? "");
  const [clockOut, setClockOut] = useState(record?.clock_out?.slice(0, 5) ?? "");
  const [breakMinutes, setBreakMinutes] = useState(String(record?.break_minutes ?? 0));
  const [note, setNote] = useState(record?.note ?? "");

  function reset() {
    setError(null);
    if (isEdit) return;
    setEmployeeId("");
    setShiftId(NO_SHIFT);
    setWorkDate(todayJakarta());
    setClockIn("");
    setClockOut("");
    setBreakMinutes("0");
    setNote("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const input = {
        employee_id: employeeId,
        shift_id: shiftId === NO_SHIFT ? null : shiftId,
        work_date: workDate,
        clock_in: clockIn,
        clock_out: clockOut,
        break_minutes: Number(breakMinutes) || 0,
        note,
      };
      const res = isEdit ? await updateAttendance(record.id, input) : await createAttendance(input);
      if (!res.ok) { setError(res.error); return; }
      toast.success(isEdit ? "Attendance updated" : "Attendance recorded");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit attendance" : "Add attendance"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="att-crew">Crew</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger id="att-crew" className="w-full">
                  <SelectValue placeholder="Select crew" />
                </SelectTrigger>
                <SelectContent>
                  {formData.crew.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="att-date">Date</Label>
              <Input id="att-date" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="att-shift">Shift</Label>
              <Select value={shiftId} onValueChange={setShiftId}>
                <SelectTrigger id="att-shift" className="w-full">
                  <SelectValue placeholder="No shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SHIFT}>No shift</SelectItem>
                  {formData.shifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.start_time && s.end_time
                        ? `${s.name} (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})`
                        : s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="att-in">Clock in</Label>
              <Input id="att-in" type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="att-out">Clock out</Label>
              <Input id="att-out" type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="att-break">Break (minutes)</Label>
              <Input id="att-break" type="number" min={0} value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="att-note">Note</Label>
              <Textarea id="att-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional" />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : isEdit ? "Save changes" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
