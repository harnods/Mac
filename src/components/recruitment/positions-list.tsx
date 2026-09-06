"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import type { PositionRow } from "@/app/actions/recruitment";

export function PositionsList({ positions, hireBase }: { positions: PositionRow[]; hireBase: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Recruitment</h1>
      </div>

      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <span>Apply link (all positions):</span>
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <span className="tabular-nums">{hireBase.replace(/^https?:\/\//, "")}</span>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(hireBase).then(() => { setCopied(true); toast.success("Link copied"); setTimeout(() => setCopied(false), 1500); })}
            className="rounded p-0.5 hover:bg-muted"
            title="Copy link"
          >
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
          </button>
        </span>
      </div>

      <div className="border table-outer rounded-lg overflow-x-auto mt-4">
        <Table className="w-auto min-w-full table-fixed">
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No job positions.</TableCell>
              </TableRow>
            )}
            {positions.map((p) => (
              <ClickableTableRow key={p.id} href={`/hr/recruitment/${p.id}`}>
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
    </>
  );
}
