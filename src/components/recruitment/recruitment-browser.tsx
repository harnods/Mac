"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Check, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { PositionsList } from "@/components/recruitment/positions-list";
import { searchCandidates, type CandidateHit, type PositionRow } from "@/app/actions/recruitment";
import { HIRING_STAGE_LABEL } from "@/lib/recruitment";

export function RecruitmentBrowser({ positions, hireBase }: { positions: PositionRow[]; hireBase: string }) {
  const [copied, setCopied] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CandidateHit[] | null>(null);
  const [, startSearch] = useTransition();
  const seq = useRef(0);

  const query = q.trim();
  const searching = query.length >= 2;

  useEffect(() => {
    if (query.length < 2) {
      setHits(null);
      return;
    }
    const id = ++seq.current;
    const timer = setTimeout(() => {
      startSearch(async () => {
        const res = await searchCandidates(query);
        if (id === seq.current) setHits(res); // ignore results from a stale keystroke
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Recruitment</h1>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
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

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search..."
          className="pl-9 pr-9"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
            title="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {searching ? <Results hits={hits} query={query} /> : <PositionsList positions={positions} />}
    </div>
  );
}

function Results({ hits, query }: { hits: CandidateHit[] | null; query: string }) {
  if (hits === null) return <p className="text-sm text-muted-foreground">Searching…</p>;
  if (hits.length === 0) return <p className="text-sm text-muted-foreground">No candidates match “{query}”.</p>;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{hits.length} candidate{hits.length === 1 ? "" : "s"} found</p>
      <div className="border table-outer rounded-lg overflow-x-auto">
        <Table className="w-auto min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Candidate</TableHead>
              <TableHead className="w-[180px]">Position</TableHead>
              <TableHead className="w-[120px]">Stage</TableHead>
              <TableHead className="w-[140px]">Experience</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hits.map((h) => (
              <ClickableTableRow key={h.id} href={`/hr/recruitment/${h.job_position_id}/c/${h.id}`}>
                <TableCell>
                  <Link
                    href={`/hr/recruitment/${h.job_position_id}/c/${h.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium hover:underline"
                  >
                    {h.name}
                  </Link>
                  {h.snippet && <p className="mt-0.5 max-w-[460px] truncate text-xs text-muted-foreground">{h.snippet}</p>}
                </TableCell>
                <TableCell className="text-sm">{h.position_name || "—"}</TableCell>
                <TableCell><Badge variant="secondary">{HIRING_STAGE_LABEL[h.stage]}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {h.fresh_graduate ? "Fresh graduate" : h.experience_years != null ? `${h.experience_years} yr${h.experience_years === 1 ? "" : "s"}` : "—"}
                </TableCell>
              </ClickableTableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
