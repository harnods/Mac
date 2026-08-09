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
  STICKY_ACTION_HEAD,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { SalesFilter } from "@/components/sales/sales-filter";
import { SalesEntryRow } from "@/components/sales/sales-entry-row";
import type { Updater } from "@/lib/supabase/types";
import { PaginationBar, parsePageSize, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination-bar";

export const dynamic = "force-dynamic";


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
  searchParams: Promise<{ q?: string; page?: string; size?: string }>;
}) {
  const { q = "", page: rawPageStr, size: rawSizeStr } = await searchParams;
  const rawPage = Number(rawPageStr ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const PAGE_SIZE = parsePageSize(rawSizeStr);
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

  const buildHref = (p: number, size: number = PAGE_SIZE) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (size !== DEFAULT_PAGE_SIZE) sp.set("size", String(size));
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
          <Table className="w-auto min-w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">No</TableHead>
                <TableHead className="w-[160px]">Date</TableHead>
                <TableHead className="w-[160px]"># Products</TableHead>
                <TableHead className="w-[240px]">Notes</TableHead>
                <TableHead className="w-[160px]">Recorded by</TableHead>
                <TableHead className="w-0 p-0" />
                <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((entry) => (
                <SalesEntryRow
                  key={entry.id}
                  id={entry.id}
                  entryDate={entry.entry_date}
                  itemCount={entry.sales_entry_items.length}
                  notes={entry.notes}
                  creator={entry.creator}
                  createdAt={entry.created_at}
                  canDelete={isAdmin}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationBar page={page} totalPages={totalPages} pageSize={PAGE_SIZE} buildHref={buildHref} buildSizeHref={(s) => buildHref(1, s)} />
    </div>
  );
}
