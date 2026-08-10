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
import { TableCell, STICKY_ACTION_CELL } from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { formatId, formatDate, updaterName } from "@/lib/format";
import { SalesEntryDeleteDialog } from "./sales-entry-delete-dialog";
import type { Updater } from "@/lib/supabase/types";

type Props = {
  id: string;
  entryDate: string;
  itemCount: number;
  notes: string | null;
  creator: Updater | null;
  createdAt: string;
  canDelete: boolean;
  showDate?: boolean;
  showProducts?: boolean;
  showNotes?: boolean;
  showRecordedBy?: boolean;
};

export function SalesEntryRow({
  id,
  entryDate,
  itemCount,
  notes,
  creator,
  createdAt,
  canDelete,
  showDate = true,
  showProducts = true,
  showNotes = true,
  showRecordedBy = true,
}: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <ClickableTableRow href={`/sales/${id}`}>
        <TableCell className="font-medium tabular-nums">
          <Link href={`/sales/${id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
            {formatId(id)}
          </Link>
        </TableCell>
        {showDate && <TableCell className="text-sm">{formatDate(entryDate)}</TableCell>}
        {showProducts && <TableCell className="tabular-nums text-sm">{itemCount}</TableCell>}
        {showNotes && (
          <TableCell className="text-sm truncate">
            {notes ?? <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showRecordedBy && (
          <TableCell className="text-sm">
            <div>{updaterName(creator)}</div>
            <div className="text-xs text-muted-foreground">{formatDate(createdAt)}</div>
          </TableCell>
        )}
        <TableCell />
        <TableCell className={STICKY_ACTION_CELL}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/sales/${id}`}>View details</Link>
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setDeleteOpen(true)}>Delete</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </ClickableTableRow>

      <SalesEntryDeleteDialog id={id} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
