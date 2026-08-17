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

export type RequestRowItem = { id: string; qty: number; unit: string; item: { name: string; unit: string } | null };

type Props = {
  id: string;
  status: PurchaseRequestStatus;
  items: RequestRowItem[];
  note: string | null;
  creator: Updater | null;
  createdAt: string;
  supplierName: string | null;
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
  id, status, items, note, creator, createdAt, supplierName, isAdmin, isOwn, colSpan,
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
            <div className="space-y-3 pr-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">Requestor</div>
                  <div>{requestorLabel}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Request date</div>
                  <div className="tabular-nums">{formatDate(createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Supplier</div>
                  <div>{supplierName ?? "—"}</div>
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Items ({items.length})</div>
                {items.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No items.</div>
                ) : (
                  <ul className="space-y-0.5 text-sm">
                    {items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2">
                        <span className="tabular-nums text-muted-foreground w-24 shrink-0">
                          {it.qty ? `${formatNum(Number(it.qty))} ${it.unit}` : "—"}
                        </span>
                        <span>{it.item?.name ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {note && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Note</div>
                  <p className="whitespace-pre-wrap text-sm">{note}</p>
                </div>
              )}

              <Link
                href={`/purchasing/requests/${id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-block text-sm text-primary hover:underline"
              >
                View full details →
              </Link>
            </div>
          </TableCell>
        </TableRow>
      )}

      <PurchaseRequestDeleteDialog id={id} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
