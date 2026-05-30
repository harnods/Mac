"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell } from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { formatDate, updaterName } from "@/lib/format";
import { EmployeeDeleteDialog } from "@/components/employees/employee-delete-dialog";
import type { EmployeeWithRelations } from "@/lib/supabase/types";

export function EmployeeTableRow({
  employee,
  canWrite,
}: {
  employee: EmployeeWithRelations;
  canWrite: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <ClickableTableRow href={`/employees/${employee.id}`}>
        <TableCell className="font-medium">
          <span className="truncate block">{employee.name}</span>
        </TableCell>
        <TableCell className="text-sm">
          {employee.departments?.name ?? <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-sm">
          {employee.job_positions?.name ?? <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-sm">
          {employee.job_levels?.name ?? <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-sm">
          {employee.employment_statuses?.name ?? <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell>
          <div className="text-sm">{formatDate(employee.updated_at)}</div>
          <div className="text-xs text-muted-foreground">{updaterName(employee.updater)}</div>
        </TableCell>
        <TableCell className="w-12">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/employees/${employee.id}`}>View details</Link>
              </DropdownMenuItem>
              {canWrite && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={`/employees/${employee.id}/edit`}>Edit</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => setDeleteOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </ClickableTableRow>

      {canWrite && (
        <EmployeeDeleteDialog
          id={employee.id}
          name={employee.name}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </>
  );
}
