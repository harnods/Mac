import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
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
import { Plus } from "lucide-react";
import { formatDate, updaterName } from "@/lib/format";
import { CountsFilter } from "@/components/stock/counts-filter";
import type { Updater } from "@/lib/supabase/types";
import { PaginationBar } from "@/components/ui/pagination-bar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type CountRecord = {
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

export default async function StockCountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q = "", status, page: rawPageStr } = await searchParams;
  const rawPage = Number(rawPageStr ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.STOCK_WRITE);
  const supabase = await createClient();

  let query = supabase
    .from("stock_counts")
    .select("id, count_date, status, note, started_at, completed_at, created_at, creator:profiles!created_by(full_name, email), stock_count_items(id)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status === "draft" || status === "counting" || status === "completed") {
    query = query.eq("status", status);
  }
  if (q.trim()) {
    query = query.ilike("note", `%${q.trim()}%`);
  }

  const { data, count } = await query;
  const list = (data ?? []) as unknown as CountRecord[];
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const buildHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (status) sp.set("status", status);
    if (p > 1) sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Stock counts</h1>
        {isAdmin && (
          <Button asChild>
            <Link href="/stock/counts/new">
              <Plus className="size-4" /> New cycle count
            </Link>
          </Button>
        )}
      </div>

      <Suspense fallback={null}>
        <CountsFilter />
      </Suspense>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {q || status ? "No counts match your filter." : "No stock counts yet."}
          {!q && !status && isAdmin && (
            <> <Link href="/stock/counts/new" className="underline">Start one</Link>.</>
          )}
        </div>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Date</TableHead>
                <TableHead className="min-w-[160px]">Status</TableHead>
                <TableHead className="min-w-[160px]"># Items</TableHead>
                <TableHead className="min-w-[240px]">Note</TableHead>
                <TableHead className="min-w-[160px]">Created</TableHead>
                <TableHead className="min-w-[160px]">Timing</TableHead>
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
                  <TableCell>{statusBadge(count.status)}</TableCell>
                  <TableCell>{count.stock_count_items.length}</TableCell>
                  <TableCell className="truncate text-sm">
                    {count.note ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{updaterName(count.creator)}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(count.created_at)}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {count.completed_at ? (
                      <>Finished {formatDate(count.completed_at)}</>
                    ) : count.started_at ? (
                      <>Started {formatDate(count.started_at)}</>
                    ) : (
                      "Not started"
                    )}
                  </TableCell>
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
      )}
      <PaginationBar page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
