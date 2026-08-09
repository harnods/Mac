"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, STICKY_ACTION_CELL } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { formatDate, updaterName } from "@/lib/format";
import { EmployeeDeleteDialog } from "@/components/employees/employee-delete-dialog";
import type { EmployeeWithRelations } from "@/lib/supabase/types";

export function EmployeeTableRow({
  employee,
  canWrite,
  showActiveStatus = true,
  showDepartment = true,
  showJobPosition = true,
  showJobLevel = true,
  showStatus = true,
  showJoinDate = true,
  showLastDay = false,
  showLastUpdated = true,
}: {
  employee: EmployeeWithRelations;
  canWrite: boolean;
  showActiveStatus?: boolean;
  showDepartment?: boolean;
  showJobPosition?: boolean;
  showJobLevel?: boolean;
  showStatus?: boolean;
  showJoinDate?: boolean;
  showLastDay?: boolean;
  showLastUpdated?: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <ClickableTableRow href={`/hr/crew/${employee.id}`}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-9 shrink-0">
              {employee.photo_url && <AvatarImage src={employee.photo_url} alt={employee.name} className="object-cover" />}
              <AvatarFallback className="bg-[#cddbf1] text-[#0a0a0a] text-xs font-medium">
                {employee.name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <Link
              href={`/hr/crew/${employee.id}`}
              onClick={(e) => e.stopPropagation()}
              className="truncate hover:underline"
            >
              {employee.name}
            </Link>
          </div>
        </TableCell>
        {showActiveStatus && (
          <TableCell>
            {employee.termination_date ? (
              <Badge variant="secondary">Resigned</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
          </TableCell>
        )}
        {showDepartment && (
          <TableCell className="text-sm">
            {employee.departments?.name ?? <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showJobPosition && (
          <TableCell className="text-sm">
            {employee.job_positions?.name ?? <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showJobLevel && (
          <TableCell className="text-sm">
            {employee.job_levels?.name ?? <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showStatus && (
          <TableCell className="text-sm">
            {employee.employment_statuses?.name ?? <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showJoinDate && (
          <TableCell className="text-sm">
            {employee.join_date ? formatDate(employee.join_date) : <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showLastDay && (
          <TableCell className="text-sm">
            {employee.last_day ? formatDate(employee.last_day) : <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showLastUpdated && (
          <TableCell>
            <div className="text-sm">{formatDate(employee.updated_at)}</div>
            <div className="text-xs text-muted-foreground">{updaterName(employee.updater)}</div>
          </TableCell>
        )}
        <TableCell className="p-0" />
        <TableCell className={`w-12 ${STICKY_ACTION_CELL}`}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/hr/crew/${employee.id}`}>View details</Link>
              </DropdownMenuItem>
              {canWrite && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={`/hr/crew/${employee.id}/edit`}>Edit</Link>
                  </DropdownMenuItem>
                  {!employee.mac_user?.is_owner && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => setDeleteOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </ClickableTableRow>

      {canWrite && !employee.mac_user?.is_owner && (
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
