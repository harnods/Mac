import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { formatDate, updaterName } from "@/lib/format";
import { CountsFilter } from "@/components/stock/counts-filter";
import type { Updater } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type CountRecord = {
  id: string;
  count_date: string;
  status: "draft" | "completed";
  note: string | null;
  created_at: string;
  creator: Updater | null;
  stock_count_items: { id: string }[];
};

export default async function StockCountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status } = await searchParams;
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const supabase = await createClient();

  let query = supabase
    .from("stock_counts")
    .select("id, count_date, status, note, created_at, creator:profiles!created_by(full_name, email), stock_count_items(id)")
    .order("created_at", { ascending: false });

  if (status === "draft" || status === "completed") {
    query = query.eq("status", status);
  }
  if (q.trim()) {
    query = query.ilike("note", `%${q.trim()}%`);
  }

  const { data } = await query;
  const list = (data ?? []) as unknown as CountRecord[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Stock counts</h1>
        {isAdmin && (
          <Button asChild>
            <Link href="/stock/counts/new">
              <Plus className="size-4" /> New count
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
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Date</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-20"># Items</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-44">Recorded by</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((count) => (
                <TableRow key={count.id}>
                  <TableCell>{formatDate(count.count_date)}</TableCell>
                  <TableCell>
                    <Badge variant={count.status === "completed" ? "success" : "outline"}>
                      {count.status === "completed" ? "Completed" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell>{count.stock_count_items.length}</TableCell>
                  <TableCell className="truncate text-sm">
                    {count.note ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{updaterName(count.creator)}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(count.created_at)}</div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/stock/counts/${count.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
