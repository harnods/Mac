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
import type { OvertimeRequestWithCrew } from "@/lib/supabase/types";

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

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
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");

  const isForm = modal?.type === "add" || modal?.type === "edit";
  const isEdit = modal?.type === "edit";

  function openAdd() {
    setEmployeeId(""); setWorkDate(""); setHours(""); setReason("");
    setModal({ type: "add" });
  }
  function openEdit(req: OvertimeRequestWithCrew) {
    setEmployeeId(req.employee_id);
    setWorkDate(req.work_date.slice(0, 10));
    setHours(String(req.hours));
    setReason(req.reason ?? "");
    setModal({ type: "edit", req });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) { toast.error("Crew is required"); return; }
    if (!workDate) { toast.error("Date is required"); return; }
    start(async () => {
      const input = { employee_id: employeeId, work_date: workDate, hours: Number(hours) || 0, reason };
      const res = modal?.type === "edit" ? await updateOvertimeRequest(modal.req.id, input) : await createOvertimeRequest(input);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(isEdit ? "Overtime updated" : "Overtime requested");
      setModal(null);
      router.refresh();
    });
  }

  function review(id: string, status: "approved" | "rejected" | "pending") {
    start(async () => {
      const res = await setOvertimeRequestStatus(id, status);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Reset to pending");
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
              <TableHead className="w-[200px]">Crew</TableHead>
              <TableHead className="w-[140px]">Date</TableHead>
              <TableHead className="w-[100px]">Hours</TableHead>
              <TableHead className="w-[220px]">Reason</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              {isAdmin && <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-sm text-muted-foreground">No overtime requests yet.</TableCell>
              </TableRow>
            )}
            {requests.map((r) => {
              const meta = STATUS_META[r.status];
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium truncate">{r.employees?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{formatDate(r.work_date)}</TableCell>
                  <TableCell className="text-sm tabular-nums">{r.hours}h</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate">{r.reason || "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className={meta.className}>{meta.label}</Badge></TableCell>
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
                <Label htmlFor="ot-hours">Hours</Label>
                <Input id="ot-hours" type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ot-reason">Reason</Label>
              <Textarea id="ot-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
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
