"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  STICKY_ACTION_HEAD,
  STICKY_ACTION_CELL,
} from "@/components/ui/table";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { formatDate, updaterName } from "@/lib/format";
import type { Updater } from "@/lib/supabase/types";

export const COUNT_COLUMNS: ColumnDef[] = [
  { key: "status", label: "Status" },
  { key: "items", label: "# Items" },
  { key: "note", label: "Note" },
  { key: "created", label: "Created" },
  { key: "timing", label: "Timing" },
];

export type CountRecord = {
  id: string;
  count_date: string | null;
  status: "draft" | "counting" | "completed";
  note: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  creator: Updater | null;
  stock_count_items: { id: string }[];
};

function statusBadge(status: CountRecord["status"]) {
  if (status === "completed") return <Badge variant="success">Completed</Badge>;
  if (status === "counting") return <Badge>Counting</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

export function CountsTable({ list }: { list: CountRecord[] }) {
  const { isVisible } = useColumnVisibility("counts", COUNT_COLUMNS);

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-auto min-w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">Date</TableHead>
            {isVisible("status") && <TableHead className="w-[160px]">Status</TableHead>}
            {isVisible("items") && <TableHead className="w-[160px]"># Items</TableHead>}
            {isVisible("note") && <TableHead className="w-[240px]">Note</TableHead>}
            {isVisible("created") && <TableHead className="w-[160px]">Created</TableHead>}
            {isVisible("timing") && <TableHead className="w-[160px]">Timing</TableHead>}
            <TableHead className="w-0 p-0" />
            <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((count) => (
            <TableRow key={count.id}>
              <TableCell>
                {count.count_date ? (
                  formatDate(count.count_date)
                ) : (
                  <span className="text-muted-foreground">Not started</span>
                )}
              </TableCell>
              {isVisible("status") && <TableCell>{statusBadge(count.status)}</TableCell>}
              {isVisible("items") && <TableCell>{count.stock_count_items.length}</TableCell>}
              {isVisible("note") && (
                <TableCell className="truncate text-sm">
                  {count.note ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
              )}
              {isVisible("created") && (
                <TableCell className="text-sm">
                  <div>{updaterName(count.creator)}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(count.created_at)}</div>
                </TableCell>
              )}
              {isVisible("timing") && (
                <TableCell className="text-xs text-muted-foreground">
                  {count.completed_at ? (
                    <>Finished {formatDate(count.completed_at)}</>
                  ) : count.started_at ? (
                    <>Started {formatDate(count.started_at)}</>
                  ) : (
                    "Not started"
                  )}
                </TableCell>
              )}
              <TableCell />
              <TableCell className={STICKY_ACTION_CELL}>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/stock/counts/${count.id}`}>
                    {count.status === "completed" ? "View" : "Continue"}
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
