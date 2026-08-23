"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Smartphone, Monitor, Pencil, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { TableCell, TableRow, STICKY_ACTION_CELL } from "@/components/ui/table";
import { AttendanceFormDialog } from "@/components/employees/attendance-form-dialog";
import { ShiftEditDialog } from "@/components/employees/shift-edit-dialog";
import { deleteAttendance, updateAttendanceShift, type AttendanceFormData } from "@/app/actions/attendance";
import { formatDate, formatDateTime, updaterName } from "@/lib/format";
import { attendanceStatuses, workDurationMinutes, formatMinutes, formatTime, type AttendanceGrace } from "@/lib/attendance";
import type { AttendanceWithRelations } from "@/lib/supabase/types";
import type { OvertimeSummary } from "@/components/employees/attendance-table";

const STATUS_META: Record<string, { label: string; variant: "success" | "secondary"; className?: string }> = {
  present: { label: "Present", variant: "success" },
  late: { label: "Late", variant: "secondary", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  "early-leave": { label: "Early leave", variant: "secondary", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

const dash = <span className="text-muted-foreground">—</span>;

export function AttendanceTableRow({
  record,
  overtime = null,
  canWrite,
  formData,
  grace,
  showDate = true,
  showShift = true,
  showClockIn = true,
  showClockOut = true,
  showBreak = true,
  showOtClockIn = false,
  showOtClockOut = false,
  showOtBreak = false,
  showDuration = true,
  showStatus = true,
  showNote = true,
  showSource = true,
  showLocation = false,
  showRecordedBy = true,
  showLastUpdated = true,
}: {
  record: AttendanceWithRelations;
  overtime?: OvertimeSummary | null;
  canWrite: boolean;
  formData: AttendanceFormData;
  grace?: AttendanceGrace;
  showDate?: boolean;
  showShift?: boolean;
  showClockIn?: boolean;
  showClockOut?: boolean;
  showBreak?: boolean;
  showOtClockIn?: boolean;
  showOtClockOut?: boolean;
  showOtBreak?: boolean;
  showDuration?: boolean;
  showStatus?: boolean;
  showNote?: boolean;
  showSource?: boolean;
  showLocation?: boolean;
  showRecordedBy?: boolean;
  showLastUpdated?: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [shiftEditOpen, setShiftEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, start] = useTransition();

  const statuses = attendanceStatuses(record, grace);
  const shiftDuration = workDurationMinutes(record);
  const otMinutes = overtime ? Math.round((overtime.hours || 0) * 60) : 0;
  // Total = shift worked + overtime. Dash only when there's neither.
  const duration = shiftDuration == null && otMinutes === 0 ? null : (shiftDuration ?? 0) + otMinutes;

  function handleDelete() {
    start(async () => {
      const res = await deleteAttendance(record.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Attendance deleted");
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-medium truncate">{record.employees?.name ?? dash}</TableCell>
        {showDate && <TableCell className="text-sm">{formatDate(record.work_date)}</TableCell>}
        {showShift && (
          <TableCell className="text-sm">
            <div className="group/shift flex items-start justify-between gap-1">
              <div>
                {record.shifts ? (
                  <>
                    <div>{record.shifts.name}</div>
                    {record.shifts.start_time && record.shifts.end_time && (
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {formatTime(record.shifts.start_time)}–{formatTime(record.shifts.end_time)}
                      </div>
                    )}
                  </>
                ) : (
                  dash
                )}
              </div>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => setShiftEditOpen(true)}
                  aria-label="Edit shift"
                  className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/shift:opacity-100"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
            </div>
          </TableCell>
        )}
        {showClockIn && <TableCell className="text-sm tabular-nums">{formatTime(record.clock_in) || dash}</TableCell>}
        {showClockOut && <TableCell className="text-sm tabular-nums">{formatTime(record.clock_out) || dash}</TableCell>}
        {showBreak && <TableCell className="text-sm tabular-nums text-muted-foreground">{record.clock_in ? `${record.break_minutes}m` : dash}</TableCell>}
        {showOtClockIn && <TableCell className="text-sm tabular-nums">{overtime?.clock_in ? formatTime(overtime.clock_in) : dash}</TableCell>}
        {showOtClockOut && <TableCell className="text-sm tabular-nums">{overtime?.clock_out ? formatTime(overtime.clock_out) : dash}</TableCell>}
        {showOtBreak && <TableCell className="text-sm tabular-nums text-muted-foreground">{overtime?.clock_in ? `${overtime.break_minutes}m` : dash}</TableCell>}
        {showDuration && <TableCell className="text-sm tabular-nums">{duration != null ? formatMinutes(duration) : dash}</TableCell>}
        {showStatus && (
          <TableCell>
            {statuses.length === 0 ? (
              dash
            ) : (
              <div className="flex flex-wrap gap-1">
                {statuses.map((s) => {
                  const meta = STATUS_META[s];
                  return (
                    <Badge key={s} variant={meta.variant} className={meta.className}>{meta.label}</Badge>
                  );
                })}
              </div>
            )}
          </TableCell>
        )}
        {showNote && (
          <TableCell className="text-sm text-muted-foreground whitespace-normal">{record.note || dash}</TableCell>
        )}
        {showSource && (
          <TableCell className="text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              {record.source === "mobile" ? <Smartphone className="size-3.5" /> : <Monitor className="size-3.5" />}
              {record.source === "mobile" ? "Mobile" : "Web"}
            </span>
          </TableCell>
        )}
        {showLocation && (
          <TableCell className="text-sm">
            {record.clock_in_ip || (record.clock_in_lat != null && record.clock_in_lng != null) ? (
              <div className="space-y-0.5">
                {record.clock_in_ip && <div className="font-mono text-xs text-muted-foreground">{record.clock_in_ip}</div>}
                {record.clock_in_lat != null && record.clock_in_lng != null && (
                  <a
                    href={`https://maps.google.com/?q=${record.clock_in_lat},${record.clock_in_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <MapPin className="size-3" /> View on map
                  </a>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{dash}</span>
            )}
          </TableCell>
        )}
        {showRecordedBy && (
          <TableCell className="text-sm">{updaterName(record.creator)}</TableCell>
        )}
        {showLastUpdated && (
          <TableCell className="text-sm tabular-nums text-muted-foreground">
            {formatDateTime(record.updated_at)}
          </TableCell>
        )}
        <TableCell className="p-0" />
        {canWrite && (
          <TableCell className={STICKY_ACTION_CELL}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        )}
      </TableRow>

      {canWrite && editOpen && (
        <AttendanceFormDialog formData={formData} record={record} open={editOpen} onOpenChange={setEditOpen} />
      )}

      {canWrite && (
        <ShiftEditDialog
          shifts={formData.shifts}
          currentShiftId={record.shifts?.id ?? null}
          contextLabel={`${record.employees?.name ?? "Crew"} · ${formatDate(record.work_date)}`}
          open={shiftEditOpen}
          onOpenChange={setShiftEditOpen}
          onSave={(sid) => updateAttendanceShift(record.id, sid)}
          onSaved={() => router.refresh()}
        />
      )}

      {canWrite && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete attendance record?</DialogTitle>
              <DialogDescription>
                This will remove {record.employees?.name}&rsquo;s attendance for {formatDate(record.work_date)}. This action cannot be undone.
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
      )}
    </>
  );
}
