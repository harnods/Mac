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
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { formatDate, formatId } from "@/lib/format";
import { PurchaseRequestDeleteDialog } from "./purchase-request-delete-dialog";
import type { PurchaseRequestStatus, Updater } from "@/lib/supabase/types";

const STATUS_LABEL: Record<PurchaseRequestStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

type Props = {
  id: string;
  status: PurchaseRequestStatus;
  itemCount: number;
  note: string | null;
  creator: Updater | null;
  createdAt: string;
  isAdmin: boolean;
  isOwn: boolean;
  showStatus?: boolean;
  showItems?: boolean;
  showNote?: boolean;
  showCreated?: boolean;
};

export function PurchaseRequestRow({
  id, status, itemCount, note, creator, createdAt, isAdmin, isOwn,
  showStatus = true, showItems = true, showNote = true, showCreated = true,
}: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canDelete = isAdmin || (isOwn && (status === "pending" || status === "draft"));

  return (
    <>
      <ClickableTableRow href={`/purchasing/requests/${id}`}>
        <TableCell className="font-medium tabular-nums">{formatId(id)}</TableCell>
        {showStatus && (
          <TableCell>
            <Badge variant={
              status === "approved" ? "success" :
              status === "rejected" ? "destructive" :
              status === "draft" ? "outline" :
              "secondary"
            }>
              {STATUS_LABEL[status]}
            </Badge>
          </TableCell>
        )}
        {showItems && <TableCell className="tabular-nums">{itemCount}</TableCell>}
        {showNote && <TableCell className="text-sm text-muted-foreground truncate">{note ?? "—"}</TableCell>}
        {showCreated && (
          <TableCell>
            <div className="text-sm">{formatDate(createdAt)}</div>
            <div className="text-xs text-muted-foreground">{creator?.full_name ?? creator?.email ?? "—"}</div>
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
                <Link href={`/purchasing/requests/${id}`}>View details</Link>
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

      <PurchaseRequestDeleteDialog id={id} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
