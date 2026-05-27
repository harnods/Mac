"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell } from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { formatDate, updaterName, formatId } from "@/lib/format";
import type { Updater } from "@/lib/supabase/types";

type Props = {
  id: string;
  note: string | null;
  transaction_date: string;
  created_at: string;
  updater: Updater | null;
  purchase_purchase_requests: { purchase_request_id: string }[];
  purchase_items: { id: string }[];
};

export function PurchaseRow({
  id,
  note,
  transaction_date,
  created_at,
  updater,
  purchase_purchase_requests,
  purchase_items,
}: Props) {
  return (
    <ClickableTableRow href={`/purchasing/purchases/${id}`}>
      <TableCell className="font-medium tabular-nums">{formatId(id)}</TableCell>
      <TableCell className="text-sm">
        {purchase_purchase_requests.length > 0 ? (
          <div className="flex flex-wrap gap-x-2">
            {purchase_purchase_requests.map(({ purchase_request_id }) => (
              <Link
                key={purchase_request_id}
                href={`/purchasing/requests/${purchase_request_id}`}
                className="underline text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                {formatId(purchase_request_id)}
              </Link>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="tabular-nums">{purchase_items.length}</TableCell>
      <TableCell className="text-sm">{formatDate(transaction_date)}</TableCell>
      <TableCell>
        <div className="text-sm">{formatDate(created_at)}</div>
        <div className="text-xs text-muted-foreground">{updaterName(updater)}</div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground truncate">{note ?? "—"}</TableCell>
      <TableCell />
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/purchasing/purchases/${id}`}>View details</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </ClickableTableRow>
  );
}
