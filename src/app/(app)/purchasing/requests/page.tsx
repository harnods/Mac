import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PurchaseRequestsTable } from "@/components/purchasing/purchase-requests-table";
import { PurchaseRequestsFilter } from "@/components/purchasing/purchase-requests-filter";
import type { PurchaseRequestStatus, Updater } from "@/lib/supabase/types";
import { PaginationBar } from "@/components/ui/pagination-bar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type RequestRow = {
  id: string;
  status: PurchaseRequestStatus;
  note: string | null;
  created_by: string | null;
  created_at: string;
  creator: Updater | null;
  purchase_request_items: { id: string }[];
};

export default async function PurchaseRequestsPage({
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
  const supabase = await createClient();

  let query = supabase
    .from("purchase_requests")
    .select("id, status, note, created_by, created_at, creator:profiles!created_by(full_name,email), purchase_request_items(id)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (q.trim()) query = query.ilike("note", `%${q.trim()}%`);
  if (status && ["draft", "pending", "approved", "rejected"].includes(status))
    query = query.eq("status", status);

  const { data, count } = await query;
  const list = (data ?? []) as unknown as RequestRow[];
  const isAdmin = can(profile, P.PURCHASING_APPROVE);
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
        <h1 className="text-2xl font-semibold tracking-tight">Purchase Requests</h1>
        <Button asChild>
          <Link href="/purchasing/requests/new">
            <Plus className="size-4" /> New request
          </Link>
        </Button>
      </div>

      <Suspense fallback={null}>
        <PurchaseRequestsFilter />
      </Suspense>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          No purchase requests yet.{" "}
          <Link href="/purchasing/requests/new" className="underline">
            Create one
          </Link>
          .
        </div>
      ) : (
        <PurchaseRequestsTable list={list} isAdmin={isAdmin} currentProfileId={profile?.id} />
      )}
      <PaginationBar page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
