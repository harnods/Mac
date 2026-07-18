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
            <TableHead className="w-[14%]">ID</TableHead>
            {isVisible("status") && <TableHead className="w-[14%]">Status</TableHead>}
            {isVisible("items") && <TableHead className="w-[10%]">Items</TableHead>}
            {isVisible("note") && <TableHead className="w-[40%]">Note</TableHead>}
            {isVisible("created") && <TableHead className="w-[16%]">Created</TableHead>}
            <TableHead className="w-[6%]" />
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
