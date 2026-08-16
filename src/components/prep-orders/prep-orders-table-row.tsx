"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, STICKY_ACTION_CELL } from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { Qty } from "@/components/ui/qty";
import { formatId, formatDate, updaterName } from "@/lib/format";
import type { PrepOrderListItem } from "@/components/prep-orders/prep-orders-table";

const STATUS_BADGE: Record<string, { label: string; variant: "secondary" | "success" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

export function PrepOrderTableRow({
  order,
  showProduct = true,
  showStatus = true,
  showQty = true,
  showDate = true,
  showCreatedBy = true,
}: {
  order: PrepOrderListItem;
  showProduct?: boolean;
  showStatus?: boolean;
  showQty?: boolean;
  showDate?: boolean;
  showCreatedBy?: boolean;
}) {
  const cfg = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending;

  return (
    <ClickableTableRow href={`/prep-orders/${order.id}`}>
      <TableCell className="font-medium tabular-nums">
        <Link
          href={`/prep-orders/${order.id}`}
          onClick={(e) => e.stopPropagation()}
          className="hover:underline"
        >
          {formatId(order.id)}
        </Link>
      </TableCell>
      {showProduct && (
        <TableCell className="text-sm truncate">
          {order.product?.name ?? <span className="text-muted-foreground">—</span>}
        </TableCell>
      )}
      {showStatus && (
        <TableCell>
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
        </TableCell>
      )}
      {showQty && (
        <TableCell className="tabular-nums text-sm">
          {order.qty_to_prep != null ? (
            <Qty value={order.qty_to_prep} unit={order.unit ?? "pcs"} />
          ) : (
            <span className="text-muted-foreground">— <Qty value={order.target_qty} unit={order.unit ?? "pcs"} /> target</span>
          )}
        </TableCell>
      )}
      {showDate && <TableCell className="text-sm">{formatDate(order.planned_date)}</TableCell>}
      {showCreatedBy && <TableCell className="text-sm">{updaterName(order.creator)}</TableCell>}
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
              <Link href={`/prep-orders/${order.id}`}>View details</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </ClickableTableRow>
  );
}
