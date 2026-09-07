"use client";

import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { PositionAcceptingToggle } from "@/components/recruitment/position-accepting-toggle";
import type { PositionRow } from "@/app/actions/recruitment";

export function PositionsList({ positions }: { positions: PositionRow[] }) {
  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-auto min-w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[64px] text-center">Open</TableHead>
            <TableHead>Job position</TableHead>
            <TableHead className="w-[110px] text-right">Candidates</TableHead>
            <TableHead className="w-[100px] text-right">New</TableHead>
            <TableHead className="w-[100px] text-right">Screening</TableHead>
            <TableHead className="w-[100px] text-right">Interview</TableHead>
            <TableHead className="w-[100px] text-right">Offer</TableHead>
            <TableHead className="w-[100px] text-right">Hired</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No job positions.</TableCell>
            </TableRow>
          )}
          {positions.map((p) => (
            <ClickableTableRow key={p.id} href={`/hr/recruitment/${p.id}`}>
              <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                <PositionAcceptingToggle id={p.id} name={p.name} accepting={p.accepting_applications} />
              </TableCell>
              <TableCell className="font-medium">
                <Link href={`/hr/recruitment/${p.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{p.name}</Link>
              </TableCell>
              <TableCell className="text-sm text-right tabular-nums">{p.candidate_count}</TableCell>
              <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{p.stage_counts.applied || "—"}</TableCell>
              <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{p.stage_counts.screening || "—"}</TableCell>
              <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{p.stage_counts.interview || "—"}</TableCell>
              <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{p.stage_counts.offer || "—"}</TableCell>
              <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{p.stage_counts.hired || "—"}</TableCell>
            </ClickableTableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
