"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteDailyStockCount } from "@/app/actions/daily-stock";
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

export const DAILY_COUNT_COLUMNS: ColumnDef[] = [
  { key: "status", label: "Status" },
  { key: "items", label: "# Items" },
  { key: "note", label: "Note" },
  { key: "created", label: "Created" },
  { key: "timing", label: "Timing" },
];

export type DailyCountRecord = {
  id: string;
  count_date: string;
  status: "draft" | "counting" | "completed";
  note: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  creator: Updater | null;
  daily_stock_count_items: { id: string }[];
};

function statusBadge(status: DailyCountRecord["status"]) {
  if (status === "completed") return <Badge variant="success">Completed</Badge>;
  if (status === "counting") return <Badge>Counting</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

function RowActions({ count }: { count: DailyCountRecord }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const canDelete = count.status !== "completed";

  async function onDelete() {
    setPending(true);
    const res = await deleteDailyStockCount(count.id);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Daily stock count deleted");
    setConfirmOpen(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/stock/daily-counts/${count.id}?view=1`}>View details</Link>
          </DropdownMenuItem>
          {count.status !== "completed" && (
            <DropdownMenuItem asChild>
              <Link href={`/stock/daily-counts/${count.id}`}>Continue</Link>
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setConfirmOpen(true);
              }}
            >
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this daily stock count?</DialogTitle>
            <DialogDescription>
              This count is still {count.status === "draft" ? "a draft" : "in progress"} and
              hasn&rsquo;t adjusted stock, so it&rsquo;s safe to delete. This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={onDelete} disabled={pending}>
              {pending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DailyCountsTable({ list }: { list: DailyCountRecord[] }) {
  const { isVisible } = useColumnVisibility("daily-counts", DAILY_COUNT_COLUMNS);

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-auto min-w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">Count date</TableHead>
            {isVisible("status") && <TableHead className="w-[160px]">Status</TableHead>}
            {isVisible("items") && <TableHead className="w-[160px]"># Items</TableHead>}
            {isVisible("note") && <TableHead className="w-[240px]">Note</TableHead>}
            {isVisible("created") && <TableHead className="w-[160px]">Created</TableHead>}
            {isVisible("timing") && <TableHead className="w-[160px]">Timing</TableHead>}
            <TableHead className="p-0" />
            <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((count) => (
            <TableRow key={count.id}>
              <TableCell>{formatDate(count.count_date)}</TableCell>
              {isVisible("status") && <TableCell>{statusBadge(count.status)}</TableCell>}
              {isVisible("items") && <TableCell>{count.daily_stock_count_items.length}</TableCell>}
              {isVisible("note") && (
                <TableCell className="truncate text-sm">
                  {count.note ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
              )}
              {isVisible("created") && (
                <TableCell className="text-sm">
                  <div>{updaterName(count.creator)}</div>
                  <div className="text-muted-foreground">{formatDate(count.created_at)}</div>
                </TableCell>
              )}
              {isVisible("timing") && (
                <TableCell className="text-sm">
                  {count.completed_at ? (
                    <>Finished {formatDate(count.completed_at)}</>
                  ) : count.started_at ? (
                    <>Started {formatDate(count.started_at)}</>
                  ) : (
                    "Not started"
                  )}
                </TableCell>
              )}
              <TableCell className="p-0" />
              <TableCell className={`w-12 ${STICKY_ACTION_CELL}`}>
                <RowActions count={count} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
