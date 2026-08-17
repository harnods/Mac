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
import { PurchaseRequestRow, type RequestRowItem } from "@/components/purchasing/purchase-request-row";
import type { PurchaseRequestStatus, Updater } from "@/lib/supabase/types";

type RequestRow = {
  id: string;
  status: PurchaseRequestStatus;
  note: string | null;
  created_by: string | null;
  created_at: string;
  creator: Updater | null;
  supplier: { name: string } | null;
  purchase_request_items: RequestRowItem[];
};

export const PURCHASE_REQUEST_COLUMNS: ColumnDef[] = [
  { key: "status", label: "Status" },
  { key: "requestor", label: "Requestor" },
  { key: "requestDate", label: "Request date" },
  { key: "items", label: "Items" },
  { key: "note", label: "Note" },
];

export function PurchaseRequestsTable({
  list,
  isAdmin,
  currentProfileId,
}: {
  list: RequestRow[];
  isAdmin: boolean;
  currentProfileId?: string;
}) {
  const { isVisible } = useColumnVisibility("purchase-requests", PURCHASE_REQUEST_COLUMNS);

  // Columns spanned by the expanded detail panel.
  const colSpan =
    2 + // ID + chevron spacer
    [isVisible("status"), isVisible("requestor"), isVisible("requestDate"), isVisible("items"), isVisible("note")].filter(Boolean).length +
    2; // spacer + actions

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-auto min-w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 p-0" />
            <TableHead className="w-[150px]">ID</TableHead>
            {isVisible("status") && <TableHead className="w-[130px]">Status</TableHead>}
            {isVisible("requestor") && <TableHead className="w-[180px]">Requestor</TableHead>}
            {isVisible("requestDate") && <TableHead className="w-[150px]">Request date</TableHead>}
            {isVisible("items") && <TableHead className="w-[100px]">Items</TableHead>}
            {isVisible("note") && <TableHead className="w-[220px]">Note</TableHead>}
            <TableHead className="w-0 p-0" />
            <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((r) => (
            <PurchaseRequestRow
              key={r.id}
              id={r.id}
              status={r.status}
              items={r.purchase_request_items}
              note={r.note}
              creator={r.creator}
              createdAt={r.created_at}
              isAdmin={isAdmin}
              isOwn={r.created_by === currentProfileId}
              colSpan={colSpan}
              showStatus={isVisible("status")}
              showRequestor={isVisible("requestor")}
              showRequestDate={isVisible("requestDate")}
              showItems={isVisible("items")}
              showNote={isVisible("note")}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
