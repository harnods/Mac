"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { formatTime, formatMinutes } from "@/lib/attendance";

export type CrewOvertimeRow = {
  id: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  hours: number;
  reason_in: string | null;
  reason_out: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const dash = <span className="text-muted-foreground">—</span>;

export function CrewOvertimePanel({ overtime }: { overtime: CrewOvertimeRow[] }) {
  if (overtime.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">No overtime records yet.</div>;
  }

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-auto min-w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Date</TableHead>
            <TableHead className="w-[100px]">Clock in</TableHead>
            <TableHead className="w-[100px]">Clock out</TableHead>
            <TableHead className="w-[90px]">Break</TableHead>
            <TableHead className="w-[110px]">Duration</TableHead>
            <TableHead className="w-[260px]">Reason</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {overtime.map((r) => {
            const meta = STATUS_META[r.status];
            const reasonIn = r.reason_in ?? r.reason;
            return (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{formatDate(r.work_date)}</TableCell>
                <TableCell className="text-sm tabular-nums">{formatTime(r.clock_in) || dash}</TableCell>
                <TableCell className="text-sm tabular-nums">{formatTime(r.clock_out) || dash}</TableCell>
                <TableCell className="text-sm tabular-nums text-muted-foreground">{r.clock_in ? `${r.break_minutes}m` : dash}</TableCell>
                <TableCell className="text-sm tabular-nums">{r.hours ? formatMinutes(Math.round(r.hours * 60)) : dash}</TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-normal">
                  {reasonIn || r.reason_out ? (
                    <div className="space-y-0.5">
                      {reasonIn && <div><span className="text-foreground/70">In:</span> {reasonIn}</div>}
                      {r.reason_out && <div><span className="text-foreground/70">Out:</span> {r.reason_out}</div>}
                    </div>
                  ) : dash}
                </TableCell>
                <TableCell><Badge variant="secondary" className={meta.className}>{meta.label}</Badge></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
