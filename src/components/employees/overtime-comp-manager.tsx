"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { OvertimeCompDrawer, type OvertimePrefill } from "@/components/employees/overtime-comp-drawer";
import { deleteOvertimeCompensation } from "@/app/actions/overtime";
import { activeOvertimeVersion, overtimeCapLabel } from "@/lib/overtime";
import { formatRp } from "@/lib/format";
import type { OvertimeCompensation, OvertimeCompensationVersion } from "@/lib/supabase/types";

export type OvertimeRow = {
  compensation: OvertimeCompensation;
  versions: OvertimeCompensationVersion[];
  jobLevelName: string | null;
};

export function OvertimeCompManager({
  items,
  jobLevels,
  isAdmin,
  today,
}: {
  items: OvertimeRow[];
  jobLevels: { id: string; name: string }[];
  isAdmin: boolean;
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<OvertimePrefill | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<OvertimeCompensation | null>(null);

  const shown = items.filter((r) => r.compensation.name.toLowerCase().includes(search.trim().toLowerCase()));

  function openEdit(row: OvertimeRow) {
    const v = activeOvertimeVersion(row.versions, today);
    setEditing({
      id: row.compensation.id,
      name: row.compensation.name,
      job_level_id: row.compensation.job_level_id,
      amount_per_hour: v?.amount_per_hour ?? 0,
      cap_hours: v?.cap_hours ?? true,
      max_hours_per_day: v?.max_hours_per_day ?? 4.5,
      effective_date: v?.effective_date ?? today,
    });
    setDrawerOpen(true);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    start(async () => {
      const res = await deleteOvertimeCompensation(deleteTarget.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Overtime compensation deleted");
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Input placeholder="Search overtime..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-56" />
      </div>

      <div className="border table-outer rounded-lg overflow-x-auto mt-4">
        <Table className="w-auto min-w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">Name</TableHead>
              <TableHead className="w-[160px]">Job level</TableHead>
              <TableHead className="w-[180px]">Amount</TableHead>
              <TableHead className="w-[150px]">Max overtime</TableHead>
              <TableHead className="p-0" />
              {isAdmin && <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-sm text-muted-foreground py-8">
                  No overtime compensation yet.
                </TableCell>
              </TableRow>
            )}
            {shown.map((row) => {
              const v = activeOvertimeVersion(row.versions, today);
              return (
                <ClickableTableRow key={row.compensation.id} href={`/hr/overtime-settings/${row.compensation.id}`}>
                  <TableCell className="font-medium">
                    <Link href={`/hr/overtime-settings/${row.compensation.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                      {row.compensation.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.jobLevelName ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {v ? <>{formatRp(v.amount_per_hour)} <span className="text-muted-foreground">/hour</span></> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {v ? overtimeCapLabel(v) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="p-0" />
                  {isAdmin && (
                    <TableCell className={STICKY_ACTION_CELL}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(row)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setDeleteTarget(row.compensation)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </ClickableTableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <OvertimeCompDrawer open={drawerOpen} onOpenChange={setDrawerOpen} jobLevels={jobLevels} prefill={editing} today={today} />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</DialogTitle>
            <DialogDescription>This removes the overtime compensation and its history. This action cannot be undone.</DialogDescription>
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
