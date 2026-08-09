"use client";

import { useState } from "react";
import Link from "next/link";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DetailActionsMenu } from "@/components/ui/detail-actions-menu";
import { EmployeeDeleteDialog } from "@/components/employees/employee-delete-dialog";
import { EmployeeResignDialog } from "@/components/employees/employee-resign-dialog";

export function EmployeeDetailActions({
  id,
  name,
  canDelete,
  terminationDate,
  lastDay,
}: {
  id: string;
  name: string;
  canDelete: boolean;
  terminationDate?: string | null;
  lastDay?: string | null;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);

  return (
    <>
      <DetailActionsMenu>
        <DropdownMenuItem asChild>
          <Link href={`/hr/crew/${id}/edit`}>Edit</Link>
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
