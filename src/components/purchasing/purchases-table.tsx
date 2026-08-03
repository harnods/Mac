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
import { PurchaseRow } from "@/components/purchasing/purchase-row";
import type { Updater } from "@/lib/supabase/types";

type PurchaseRecord = {
  id: string;
  note: string | null;
  transaction_date: string;
  created_at: string;
  updated_by: string | null;
  updater: Updater | null;
  purchase_purchase_requests: { purchase_request_id: string }[];
  purchase_items: { id: string }[];
};

export const PURCHASE_COLUMNS: ColumnDef[] = [
  { key: "fromRequest", label: "From request" },
  { key: "items", label: "Items" },
  { key: "transactionDate", label: "Transaction date" },
  { key: "recorded", label: "Recorded", defaultHidden: true },
  { key: "note", label: "Note" },
];

export function PurchasesTable({ list }: { list: PurchaseRecord[] }) {
  const { isVisible } = useColumnVisibility("purchases", PURCHASE_COLUMNS);

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[150px]">ID</TableHead>
            {isVisible("fromRequest") && <TableHead className="min-w-[150px]">From request</TableHead>}
            {isVisible("items") && <TableHead className="min-w-[150px]">Items</TableHead>}
            {isVisible("transactionDate") && <TableHead className="min-w-[150px]">Transaction date</TableHead>}
            {isVisible("recorded") && <TableHead className="min-w-[150px]">Recorded</TableHead>}
            {isVisible("note") && <TableHead className="min-w-[200px]">Note</TableHead>}
            <TableHead className="w-0 p-0" />
            <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((p) => (
            <PurchaseRow
              key={p.id}
              {...p}
              showFromRequest={isVisible("fromRequest")}
              showItems={isVisible("items")}
              showTransactionDate={isVisible("transactionDate")}
              showRecorded={isVisible("recorded")}
              showNote={isVisible("note")}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
