"use client";

import { useState } from "react";
import Link from "next/link";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DetailActionsMenu } from "@/components/ui/detail-actions-menu";
import { EmployeeDeleteDialog } from "@/components/employees/employee-delete-dialog";

export function EmployeeDetailActions({ id, name, canDelete }: { id: string; name: string; canDelete: boolean }) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DetailActionsMenu>
        <DropdownMenuItem asChild>
          <Link href={`/employees/${id}/edit`}>Edit</Link>
        </DropdownMenuItem>
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

      <EmployeeDeleteDialog id={id} name={name} open={deleteOpen} onOpenChange={setDeleteOpen} redirectAfter="/employees" />
    </>
  );
}
