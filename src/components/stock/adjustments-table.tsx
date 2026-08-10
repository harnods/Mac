"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  STICKY_ACTION_HEAD,
} from "@/components/ui/table";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { AdjustmentTableRow, type AdjustmentRecord } from "@/components/stock/adjustments-table-row";

export const ADJUSTMENT_COLUMNS: ColumnDef[] = [
  { key: "number", label: "Number" },
  { key: "direction", label: "Direction" },
  { key: "qty", label: "Qty" },
  { key: "reason", label: "Reason" },
  { key: "recordedBy", label: "Recorded by" },
];

export function AdjustmentsTable({ list }: { list: AdjustmentRecord[] }) {
  const { isVisible } = useColumnVisibility("adjustments", ADJUSTMENT_COLUMNS);

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-auto min-w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">Date</TableHead>
            {isVisible("number") && <TableHead className="w-[160px]">Number</TableHead>}
            <TableHead className="w-[240px]">Item</TableHead>
            {isVisible("direction") && <TableHead className="w-[160px]">Direction</TableHead>}
            {isVisible("qty") && <TableHead className="w-[160px] text-right">Qty</TableHead>}
            {isVisible("reason") && <TableHead className="w-[160px]">Reason</TableHead>}
            {isVisible("recordedBy") && <TableHead className="w-[160px]">Recorded by</TableHead>}
            <TableHead className="w-0 p-0" />
            <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((adj) => (
            <AdjustmentTableRow
              key={adj.id}
              adjustment={adj}
              showNumber={isVisible("number")}
              showDirection={isVisible("direction")}
              showQty={isVisible("qty")}
              showReason={isVisible("reason")}
              showRecordedBy={isVisible("recordedBy")}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
