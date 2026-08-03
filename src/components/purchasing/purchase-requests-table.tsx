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
import { PurchaseRequestRow } from "@/components/purchasing/purchase-request-row";
import type { PurchaseRequestStatus, Updater } from "@/lib/supabase/types";

type RequestRow = {
  id: string;
  status: PurchaseRequestStatus;
  note: string | null;
  created_by: string | null;
  created_at: string;
  creator: Updater | null;
  purchase_request_items: { id: string }[];
};

export const PURCHASE_REQUEST_COLUMNS: ColumnDef[] = [
  { key: "status", label: "Status" },
  { key: "items", label: "Items" },
  { key: "note", label: "Note" },
  { key: "created", label: "Created", defaultHidden: true },
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

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[150px]">ID</TableHead>
            {isVisible("status") && <TableHead className="min-w-[150px]">Status</TableHead>}
            {isVisible("items") && <TableHead className="min-w-[150px]">Items</TableHead>}
            {isVisible("note") && <TableHead className="min-w-[200px]">Note</TableHead>}
            {isVisible("created") && <TableHead className="min-w-[150px]">Created</TableHead>}
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
              itemCount={r.purchase_request_items.length}
              note={r.note}
              creator={r.creator}
              createdAt={r.created_at}
              isAdmin={isAdmin}
              isOwn={r.created_by === currentProfileId}
              showStatus={isVisible("status")}
              showItems={isVisible("items")}
              showNote={isVisible("note")}
              showCreated={isVisible("created")}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
