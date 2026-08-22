"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  STICKY_ACTION_HEAD,
  STICKY_ACTION_CELL,
} from "@/components/ui/table";
import { createShift, updateShift, deleteShift, setShiftActive } from "@/app/actions/shifts";
import type { Shift } from "@/lib/supabase/types";

const LOCKED_SHIFTS = ["Day off", "Unpaid", "No schedule"];

/** "07:00:00" -> "07:00" */
function hhmm(t: string | null) {
  return t ? t.slice(0, 5) : "";
}

/** minutes -> "1h 30m" / "45m" / "None" */
function breakLabel(min: number) {
  if (!min) return "None";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ");
}

type ModalState =
  | { type: "add" }
  | { type: "edit"; shift: Shift }
  | { type: "delete"; shift: Shift }
  | { type: "deactivate"; shift: Shift }
  | null;

export function ShiftsManager({ shifts, isAdmin }: { shifts: Shift[]; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<ModalState>(null);

  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");

  // Filter bar state (client-side; the shift list is small).
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [query, setQuery] = useState("");
  const hasFilter = statusFilter !== "all" || query.trim() !== "";
  const visibleShifts = shifts.filter((s) => {
    const statusOk =
      statusFilter === "all" ||
      (statusFilter === "active" ? s.active !== false : s.active === false);
    const nameOk = s.name.toLowerCase().includes(query.trim().toLowerCase());
    return statusOk && nameOk;
  });

  const isForm = modal?.type === "add" || modal?.type === "edit";
  const isEdit = modal?.type === "edit";

  function openAdd() {
    setName(""); setStartTime(""); setEndTime(""); setBreakMinutes("0");
    setModal({ type: "add" });
  }

  function openEdit(shift: Shift) {
    setName(shift.name);
    setStartTime(hhmm(shift.start_time));
    setEndTime(hhmm(shift.end_time));
    setBreakMinutes(String(shift.break_minutes ?? 0));
    setModal({ type: "edit", shift });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Shift name is required"); return; }
    if (!startTime) { toast.error("Start time is required"); return; }
    if (!endTime) { toast.error("End time is required"); return; }
    start(async () => {
      const input = { name: name.trim(), start_time: startTime, end_time: endTime, break_minutes: Number(breakMinutes) || 0 };
      const res = modal?.type === "edit"
        ? await updateShift(modal.shift.id, input)
        : await createShift(input);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(isEdit ? "Shift updated" : "Shift created");
      setModal(null);
      router.refresh();
    });
  }

  function handleDelete() {
    if (modal?.type !== "delete") return;
    start(async () => {
      const res = await deleteShift(modal.shift.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Shift deleted");
      setModal(null);
      router.refresh();
    });
  }

  function setActive(shift: Shift, active: boolean) {
    start(async () => {
      const res = await setShiftActive(shift.id, active);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(active ? "Shift activated" : "Shift marked inactive");
      setModal(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Shifts</h1>
        {isAdmin && (
          <Button onClick={openAdd}>
            <Plus className="size-4" /> Add shift
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStatusFilter("all"); setQuery(""); }}
              className="text-muted-foreground"
            >
              <X className="size-4" /> Clear
            </Button>
          )}
        </div>
        <Input
          placeholder="Search shifts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>

      <div className="border table-outer rounded-lg overflow-x-auto">
        <Table className="w-auto min-w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[240px]">Shift name</TableHead>
              <TableHead className="w-[140px]">Start time</TableHead>
              <TableHead className="w-[140px]">End time</TableHead>
              <TableHead className="w-[140px]">Break</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              {isAdmin && <TableHead className="p-0" />}
              {isAdmin && <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleShifts.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 5} className="text-center text-sm text-muted-foreground py-8">
                  {shifts.length === 0 ? "No shifts yet." : "No shifts match your filter."}
                </TableCell>
              </TableRow>
            )}
            {visibleShifts.map((shift) => {
              const dayOff = !shift.start_time && !shift.end_time;
              const locked = LOCKED_SHIFTS.includes(shift.name);
              return (
              <TableRow key={shift.id}>
                <TableCell className="font-medium truncate">
                  <span className="inline-flex items-center gap-2">
                    {shift.name}
                    {locked && <Badge variant="secondary">Default</Badge>}
                  </span>
                </TableCell>
                <TableCell className="text-sm tabular-nums">{shift.start_time ? hhmm(shift.start_time) : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm tabular-nums">{shift.end_time ? hhmm(shift.end_time) : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm">{dayOff ? <span className="text-muted-foreground">—</span> : breakLabel(shift.break_minutes ?? 0)}</TableCell>
                <TableCell>
                  {locked ? (
                    <span className="text-muted-foreground">—</span>
                  ) : shift.active === false ? (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Inactive</Badge>
                  ) : (
                    <Badge variant="success">Active</Badge>
                  )}
                </TableCell>
                {isAdmin && <TableCell className="p-0" />}
                {isAdmin && (
                  <TableCell className={STICKY_ACTION_CELL}>
                    {!locked && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-auto">
                        <DropdownMenuItem onSelect={() => openEdit(shift)}>Edit</DropdownMenuItem>
                        {shift.active === false ? (
                          <DropdownMenuItem onSelect={() => setActive(shift, true)}>Mark as active</DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => setModal({ type: "deactivate", shift })}>Mark as inactive</DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => setModal({ type: "delete", shift })}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                  </TableCell>
                )}
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add / edit dialog */}
      <Dialog open={isForm} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit shift" : "Add shift"}</DialogTitle>
            <DialogDescription>
              Name the shift and set when it starts, ends, and how long the break is. The break can be taken anytime within the shift hours.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shift-name">Shift name</Label>
              <Input id="shift-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Opening" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shift-start">Start time</Label>
                <Input id="shift-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shift-end">End time</Label>
                <Input id="shift-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift-break">Break (minutes)</Label>
              <Input id="shift-break" type="number" min="0" step="5" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} className="w-40" />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : isEdit ? "Save changes" : "Add shift"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={modal?.type === "delete"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{modal?.type === "delete" ? modal.shift.name : ""}&rdquo;?</DialogTitle>
            <DialogDescription>
              This shift will no longer be available for attendance. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button disabled={pending} onClick={handleDelete}>
              {pending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirmation */}
      <Dialog open={modal?.type === "deactivate"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark &ldquo;{modal?.type === "deactivate" ? modal.shift.name : ""}&rdquo; inactive?</DialogTitle>
            <DialogDescription>
              Crew won&rsquo;t see this shift when clocking in on me.machimoto. Existing
              attendance already using it stays unchanged, and you can reactivate it anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              disabled={pending}
              onClick={() => modal?.type === "deactivate" && setActive(modal.shift, false)}
            >
              {pending ? "Saving..." : "Mark inactive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
