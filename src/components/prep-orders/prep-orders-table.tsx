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
import { PrepOrderTableRow } from "@/components/prep-orders/prep-orders-table-row";
import type { Updater } from "@/lib/supabase/types";

export type PrepOrderListItem = {
  id: string;
  status: string;
  target_qty: number;
  qty_to_prep: number | null;
  unit: string | null;
  planned_date: string;
  product: { id: string; name: string } | null;
  creator: Updater | null;
};

export const PREP_ORDER_COLUMNS: ColumnDef[] = [
  { key: "product", label: "Product" },
  { key: "status", label: "Status" },
  { key: "qty", label: "Qty" },
  { key: "date", label: "Date" },
  { key: "createdBy", label: "Created by" },
];

export function PrepOrdersTable({ list }: { list: PrepOrderListItem[] }) {
  const { isVisible } = useColumnVisibility("prep-orders", PREP_ORDER_COLUMNS);

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-auto min-w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">No</TableHead>
            {isVisible("product") && <TableHead className="w-[240px]">Product</TableHead>}
            {isVisible("status") && <TableHead className="w-[160px]">Status</TableHead>}
            {isVisible("qty") && <TableHead className="w-[160px]">Qty</TableHead>}
            {isVisible("date") && <TableHead className="w-[160px]">Date</TableHead>}
            {isVisible("createdBy") && <TableHead className="w-[160px]">Created by</TableHead>}
            <TableHead className="p-0" />
            <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((order) => (
            <PrepOrderTableRow
              key={order.id}
              order={order}
              showProduct={isVisible("product")}
              showStatus={isVisible("status")}
              showQty={isVisible("qty")}
              showDate={isVisible("date")}
              showCreatedBy={isVisible("createdBy")}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
