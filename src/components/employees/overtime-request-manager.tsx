"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  createOvertimeRequest,
  updateOvertimeRequest,
  setOvertimeRequestStatus,
  deleteOvertimeRequest,
} from "@/app/actions/overtime-request";
import { formatDate } from "@/lib/format";
import { formatTime, formatMinutes } from "@/lib/attendance";
import type { OvertimeRequestWithCrew } from "@/lib/supabase/types";

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const dash = <span className="text-muted-foreground">—</span>;

type ModalState = { type: "add" } | { type: "edit"; req: OvertimeRequestWithCrew } | null;

export function OvertimeRequestManager({
  requests,
  crew,
  isAdmin,
}: {
  requests: OvertimeRequestWithCrew[];
  crew: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [reasonIn, setReasonIn] = useState("");
  const [reasonOut, setReasonOut] = useState("");
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");

  const isForm = modal?.type === "add" || modal?.type === "edit";
  const isEdit = modal?.type === "edit";

  function openAdd() {
    setEmployeeId(""); setWorkDate(""); setClockIn(""); setClockOut(""); setBreakMinutes("0");
    setReasonIn(""); setReasonOut(""); setStatus("pending");
    setModal({ type: "add" });
  }
  function openEdit(req: OvertimeRequestWithCrew) {
    setEmployeeId(req.employee_id);
    setWorkDate(req.work_date.slice(0, 10));
    setClockIn(req.clock_in ? req.clock_in.slice(0, 5) : "");
    setClockOut(req.clock_out ? req.clock_out.slice(0, 5) : "");
    setBreakMinutes(String(req.break_minutes ?? 0));
    setReasonIn(req.reason_in ?? req.reason ?? "");
    setReasonOut(req.reason_out ?? "");
    setStatus(req.status);
    setModal({ type: "edit", req });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) { toast.error("Crew is required"); return; }
    if (!workDate) { toast.error("Date is required"); return; }
    start(async () => {
      const input = {
        employee_id: employeeId, work_date: workDate,
        clock_in: clockIn, clock_out: clockOut, break_minutes: Number(breakMinutes) || 0,
        reason_in: reasonIn, reason_out: reasonOut, status,
      };
      const res = modal?.type === "edit" ? await updateOvertimeRequest(modal.req.id, input) : await createOvertimeRequest(input);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(isEdit ? "Overtime updated" : "Overtime added");
      setModal(null);
      router.refresh();
    });
  }

  function review(id: string, next: "approved" | "rejected" | "pending") {
    start(async () => {
      const res = await setOvertimeRequestStatus(id, next);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(next === "approved" ? "Approved" : next === "rejected" ? "Rejected" : "Reset to pending");
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    start(async () => {
      const res = await deleteOvertimeRequest(deleteId);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Overtime request deleted");
      setDeleteId(null);
      router.refresh();
    });
  }

  return (
    <>
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={openAdd}><Plus className="size-4" /> Add overtime</Button>
        </div>
      )}

      <div className="border table-outer rounded-lg overflow-x-auto mt-4">
        <Table className="w-auto min-w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Crew</TableHead>
              <TableHead className="w-[130px]">Date</TableHead>
              <TableHead className="w-[100px]">Clock in</TableHead>
              <TableHead className="w-[100px]">Clock out</TableHead>
              <TableHead className="w-[90px]">Break</TableHead>
              <TableHead className="w-[110px]">Duration</TableHead>
              <TableHead className="w-[240px]">Reason</TableHead>
              <TableHead className="w-[150px]">Status</TableHead>
              {isAdmin && <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 9 : 8} className="py-8 text-center text-sm text-muted-foreground">No overtime records yet.</TableCell>
              </TableRow>
            )}
            {requests.map((r) => {
              const meta = STATUS_META[r.status];
              const reasonIn = r.reason_in ?? r.reason;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium truncate">{r.employees?.name ?? dash}</TableCell>
                  <TableCell className="text-sm">{formatDate(r.work_date)}</TableCell>
                  <TableCell className="text-sm tabular-nums">{formatTime(r.clock_in) || dash}</TableCell>
                  <TableCell className="text-sm tabular-nums">{formatTime(r.clock_out) || dash}</TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">{r.clock_in ? `${r.break_minutes}m` : dash}</TableCell>
                  <TableCell className="text-sm tabular-nums">{r.hours ? formatMinutes(Math.round(r.hours * 60)) : dash}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-normal">
                    {reasonIn || r.reason_out ? (
                      <div className="space-y-0.5">
                        {reasonIn && <div><span className="text-foreground/70">In:</span> {reasonIn}</div>}
                        {r.reason_out && <div><span className="text-foreground/70">Out:</span> {r.reason_out}</div>}
                      </div>
                    ) : dash}
                  </TableCell>
                  <TableCell>
                    {r.status === "pending" && isAdmin ? (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => review(r.id, "approved")}>Approve</Button>
                        <Button size="sm" variant="ghost" disabled={pending} className="text-destructive hover:text-destructive" onClick={() => review(r.id, "rejected")}>Reject</Button>
                      </div>
                    ) : (
                      <Badge variant="secondary" className={meta.className}>{meta.label}</Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className={STICKY_ACTION_CELL}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /><span className="sr-only">Open menu</span></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {r.status !== "approved" && <DropdownMenuItem onSelect={() => review(r.id, "approved")}>Approve</DropdownMenuItem>}
                          {r.status !== "rejected" && <DropdownMenuItem onSelect={() => review(r.id, "rejected")}>Reject</DropdownMenuItem>}
                          {r.status !== "pending" && <DropdownMenuItem onSelect={() => review(r.id, "pending")}>Reset to pending</DropdownMenuItem>}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => openEdit(r)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteId(r.id)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add / edit */}
      <Dialog open={isForm} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit overtime" : "Add overtime"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ot-crew">Crew</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger id="ot-crew" className="w-full"><SelectValue placeholder="Select crew" /></SelectTrigger>
                <SelectContent>
                  {crew.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ot-date">Date</Label>
                <Input id="ot-date" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ot-status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger id="ot-status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ot-in">Clock in</Label>
                <Input id="ot-in" type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ot-out">Clock out</Label>
                <Input id="ot-out" type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ot-break">Break (min)</Label>
                <Input id="ot-break" type="number" min="0" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ot-reason-in">Reason (clock in)</Label>
              <Textarea id="ot-reason-in" rows={2} value={reasonIn} onChange={(e) => setReasonIn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ot-reason-out">Reason (clock out)</Label>
              <Textarea id="ot-reason-out" rows={2} value={reasonOut} onChange={(e) => setReasonOut(e.target.value)} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={pending}>{pending ? "Saving..." : isEdit ? "Save changes" : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete overtime request?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button disabled={pending} onClick={handleDelete}>{pending ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
