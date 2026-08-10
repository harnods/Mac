"use client";

import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow, STICKY_ACTION_CELL } from "@/components/ui/table";
import { Qty } from "@/components/ui/qty";
import { formatDate, formatId, updaterName } from "@/lib/format";
import type { Updater } from "@/lib/supabase/types";

export type AdjustmentRecord = {
  id: string;
  direction: "in" | "out";
  qty: number;
  unit: string;
  reason: string | null;
  adjustment_date: string;
  created_at: string;
  item: { name: string } | null;
  creator: Updater | null;
};

export function AdjustmentTableRow({
  adjustment: adj,
  showNumber = true,
  showDirection = true,
  showQty = true,
  showReason = true,
  showRecordedBy = true,
}: {
  adjustment: AdjustmentRecord;
  showNumber?: boolean;
  showDirection?: boolean;
  showQty?: boolean;
  showReason?: boolean;
  showRecordedBy?: boolean;
}) {
  return (
    <TableRow>
      <TableCell>{formatDate(adj.adjustment_date)}</TableCell>
      {showNumber && (
        <TableCell className="font-medium tabular-nums">#{formatId(adj.id)}</TableCell>
      )}
      <TableCell className="font-medium truncate">{adj.item?.name ?? "—"}</TableCell>
      {showDirection && (
        <TableCell>
          <Badge variant={adj.direction === "in" ? "success" : "destructive"}>
            {adj.direction === "in" ? "In" : "Out"}
          </Badge>
        </TableCell>
      )}
      {showQty && (
        <TableCell className="text-right tabular-nums">
          <Qty value={adj.qty} unit={adj.unit} />
        </TableCell>
      )}
      {showReason && (
        <TableCell className="truncate text-sm">
          {adj.reason ?? <span className="text-muted-foreground">—</span>}
        </TableCell>
      )}
      {showRecordedBy && (
        <TableCell className="text-sm">
          <div>{updaterName(adj.creator)}</div>
          <div className="text-xs text-muted-foreground">{formatDate(adj.created_at)}</div>
        </TableCell>
      )}
      <TableCell className="p-0" />
      <TableCell className={`w-12 ${STICKY_ACTION_CELL}`} />
    </TableRow>
  );
}
