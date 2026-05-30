import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { PurchasesFilter } from "@/components/purchasing/purchases-filter";
import { PurchaseRow } from "@/components/purchasing/purchase-row";
import type { Updater } from "@/lib/supabase/types";
import { PaginationBar } from "@/components/ui/pagination-bar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type PurchaseRecord = {
  id: string;
  note: string | null;
  transaction_date: string;
  created_at: string;
  updated_by: string | null;
  updater: Updater | null;
  purchase_purchase_requests: { purchase_request_id: string }[];
  purchase_items: { id: string }[];
};

export default async function PurchasesPage({
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
  const isAdmin = can(profile, P.PURCHASING_PURCHASE);
  const supabase = await createClient();

  let query = supabase
    .from("purchases")
    .select("id, note, transaction_date, created_at, updated_by, updater:profiles!updated_by(full_name,email), purchase_purchase_requests(purchase_request_id), purchase_items(id)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q.trim()) query = query.ilike("note", `%${q.trim()}%`);

  const { data, count } = await query;
  const list = (data ?? []) as unknown as PurchaseRecord[];
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
        <h1 className="text-2xl font-semibold tracking-tight">Purchases</h1>
        {isAdmin && (
          <Button asChild>
            <Link href="/purchasing/purchases/new">
              <Plus className="size-4" /> Add purchase
            </Link>
          </Button>
        )}
      </div>

      <Suspense fallback={null}>
        <PurchasesFilter />
      </Suspense>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          No purchases yet.
          {isAdmin && (
            <>{" "}<Link href="/purchasing/purchases/new" className="underline">Add one</Link>.</>
          )}
        </div>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">ID</TableHead>
                <TableHead className="w-32">From request</TableHead>
                <TableHead className="w-16">Items</TableHead>
                <TableHead className="w-36">Transaction date</TableHead>
                <TableHead className="w-44">Recorded</TableHead>
                <TableHead className="w-56">Note</TableHead>
                <TableHead />
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => (
                <PurchaseRow key={p.id} {...p} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationBar page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
