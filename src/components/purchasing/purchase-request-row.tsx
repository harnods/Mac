"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow, STICKY_ACTION_CELL } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate, formatId } from "@/lib/format";
import { formatNum } from "@/lib/units";
import { PurchaseRequestDeleteDialog } from "./purchase-request-delete-dialog";
import type { PurchaseRequestStatus, Updater } from "@/lib/supabase/types";

const STATUS_LABEL: Record<PurchaseRequestStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export type RequestRowItem = {
  id: string;
  qty: number;
  unit: string;
  available_snapshot: number | null;
  available_unit: string | null;
  item: { name: string; unit: string } | null;
};

type Props = {
  id: string;
  status: PurchaseRequestStatus;
  items: RequestRowItem[];
  note: string | null;
  creator: Updater | null;
  createdAt: string;
  isAdmin: boolean;
  isOwn: boolean;
  colSpan: number;
  showStatus?: boolean;
  showRequestor?: boolean;
  showRequestDate?: boolean;
  showItems?: boolean;
  showNote?: boolean;
};

export function PurchaseRequestRow({
  id, status, items, note, creator, createdAt, isAdmin, isOwn, colSpan,
  showStatus = true, showRequestor = true, showRequestDate = true, showItems = true, showNote = true,
}: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const canDelete = isAdmin || (isOwn && (status === "pending" || status === "draft"));
  const requestorLabel = creator?.full_name ?? creator?.email ?? "—";

  return (
    <>
      <TableRow
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer hover:bg-muted/50"
        aria-expanded={open}
      >
        <TableCell className="p-0 text-center">
          <ChevronRight className={cn("mx-auto size-4 text-muted-foreground transition-transform", open && "rotate-90")} />
        </TableCell>
        <TableCell className="font-medium tabular-nums">
          <Link href={`/purchasing/requests/${id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
            {formatId(id)}
          </Link>
        </TableCell>
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
        {showRequestor && <TableCell className="text-sm truncate">{requestorLabel}</TableCell>}
        {showRequestDate && <TableCell className="text-sm tabular-nums">{formatDate(createdAt)}</TableCell>}
        {showItems && <TableCell className="tabular-nums">{items.length}</TableCell>}
        {showNote && <TableCell className="text-sm text-muted-foreground truncate">{note ?? "—"}</TableCell>}
        <TableCell />
        <TableCell className={STICKY_ACTION_CELL} onClick={(e) => e.stopPropagation()}>
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
      </TableRow>

      {open && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell />
          <TableCell colSpan={colSpan - 1} className="py-3">
            <div className="max-w-xl pr-4">
              {items.length === 0 ? (
                <div className="text-sm text-muted-foreground">No items.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-1 pr-3 text-left font-medium">Item</th>
                      <th className="py-1 px-3 text-right font-medium">Requested</th>
                      <th className="py-1 pl-3 text-right font-medium">Available at request</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-b border-dashed last:border-0">
                        <td className="py-1.5 pr-3">{it.item?.name ?? "—"}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums">
                          {it.qty ? `${formatNum(Number(it.qty))} ${it.unit}` : "—"}
                        </td>
                        <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">
                          {it.available_snapshot != null
                            ? `${formatNum(Number(it.available_snapshot))} ${it.available_unit ?? ""}`.trim()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}

      <PurchaseRequestDeleteDialog id={id} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
