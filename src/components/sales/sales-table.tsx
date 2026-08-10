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
import { SalesEntryRow } from "@/components/sales/sales-entry-row";
import type { Updater } from "@/lib/supabase/types";

export const SALES_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date" },
  { key: "products", label: "# Products" },
  { key: "notes", label: "Notes" },
  { key: "recordedBy", label: "Recorded by" },
];

type SalesEntry = {
  id: string;
  entry_date: string;
  notes: string | null;
  created_at: string;
  creator: Updater | null;
  sales_entry_items: { id: string }[];
};

export function SalesTable({ list, canDelete }: { list: SalesEntry[]; canDelete: boolean }) {
  const { isVisible } = useColumnVisibility("sales", SALES_COLUMNS);

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-auto min-w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">No</TableHead>
            {isVisible("date") && <TableHead className="w-[160px]">Date</TableHead>}
            {isVisible("products") && <TableHead className="w-[160px]"># Products</TableHead>}
            {isVisible("notes") && <TableHead className="w-[240px]">Notes</TableHead>}
            {isVisible("recordedBy") && <TableHead className="w-[160px]">Recorded by</TableHead>}
            <TableHead className="w-0 p-0" />
            <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((entry) => (
            <SalesEntryRow
              key={entry.id}
              id={entry.id}
              entryDate={entry.entry_date}
              itemCount={entry.sales_entry_items.length}
              notes={entry.notes}
              creator={entry.creator}
              createdAt={entry.created_at}
              canDelete={canDelete}
              showDate={isVisible("date")}
              showProducts={isVisible("products")}
              showNotes={isVisible("notes")}
              showRecordedBy={isVisible("recordedBy")}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
