"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DetailActionsMenu } from "@/components/ui/detail-actions-menu";
import { EmployeeDeleteDialog } from "@/components/employees/employee-delete-dialog";
import { EmployeeResignDialog } from "@/components/employees/employee-resign-dialog";
import { setEmployeeActive } from "@/app/actions/employees";

export function EmployeeDetailActions({
  id,
  name,
  canDelete,
  active = true,
  terminationDate,
  lastDay,
}: {
  id: string;
  name: string;
  canDelete: boolean;
  active?: boolean;
  terminationDate?: string | null;
  lastDay?: string | null;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);
  const [pending, start] = useTransition();

  function toggleActive() {
    start(async () => {
      const res = await setEmployeeActive(id, !active);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(active ? `${name} marked inactive` : `${name} marked active`);
      router.refresh();
    });
  }

  return (
    <>
      <DetailActionsMenu>
        <DropdownMenuItem asChild>
          <Link href={`/hr/crew/${id}/edit`}>Edit</Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onSelect={(e) => { e.preventDefault(); toggleActive(); }}>
          {active ? "Mark as inactive" : "Mark as active"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setResignOpen(true)}>Resign</DropdownMenuItem>
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DetailActionsMenu>

      <EmployeeResignDialog
        id={id}
        name={name}
        terminationDate={terminationDate}
        lastDay={lastDay}
        open={resignOpen}
        onOpenChange={setResignOpen}
      />
      <EmployeeDeleteDialog id={id} name={name} open={deleteOpen} onOpenChange={setDeleteOpen} redirectAfter="/hr/crew" />
    </>
  );
}
