import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { Plus } from "lucide-react";
import { formatId, formatDate, updaterName } from "@/lib/format";
import { SalesFilter } from "@/components/sales/sales-filter";
import type { Updater } from "@/lib/supabase/types";
import { PaginationBar } from "@/components/ui/pagination-bar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SalesEntry = {
  id: string;
  entry_date: string;
  notes: string | null;
  created_at: string;
  creator: Updater | null;
  sales_entry_items: { id: string }[];
};

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: rawPageStr } = await searchParams;
  const rawPage = Number(rawPageStr ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.SALES_WRITE);
  const supabase = await createClient();

  let query = supabase
    .from("sales_entries")
    .select("id, entry_date, notes, created_at, creator:profiles!created_by(full_name,email), sales_entry_items(id)", { count: "exact" })
    .order("entry_date", { ascending: false })
    .range(from, to);

  if (q.trim()) {
    query = query.ilike("notes", `%${q.trim()}%`);
  }

  const { data, count } = await query;
  const list = (data ?? []) as unknown as SalesEntry[];
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const buildHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (p > 1) sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
        {isAdmin && (
          <Button asChild>
            <Link href="/sales/new">
              <Plus className="size-4" /> New entry
            </Link>
          </Button>
        )}
      </div>

      <Suspense fallback={null}>
        <SalesFilter />
      </Suspense>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {q ? "No entries match your search." : "No sales entries yet."}
          {!q && isAdmin && (
            <> <Link href="/sales/new" className="underline">Record the first one</Link>.</>
          )}
        </div>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">No</TableHead>
                <TableHead className="w-36">Date</TableHead>
                <TableHead className="w-24"># Products</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-44">Recorded by</TableHead>
                <TableHead />
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((entry) => (
                <ClickableTableRow key={entry.id} href={`/sales/${entry.id}`}>
                  <TableCell className="font-medium tabular-nums">
                    {formatId(entry.id)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(entry.entry_date)}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {entry.sales_entry_items.length}
                  </TableCell>
                  <TableCell className="text-sm truncate">
                    {entry.notes ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{updaterName(entry.creator)}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</div>
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </ClickableTableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationBar page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
