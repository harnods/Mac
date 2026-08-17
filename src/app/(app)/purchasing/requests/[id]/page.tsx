import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { formatDate, formatDateTime, updaterName, formatId } from "@/lib/format";
import { ReviewButtons } from "@/components/purchasing/review-buttons";
import { PurchaseRequestDetailActions } from "@/components/purchasing/purchase-request-detail-actions";
import { SubmitDraftButton } from "@/components/purchasing/submit-draft-button";
import { PurchaseRequestItemsList } from "@/components/purchasing/purchase-request-items-list";
import { DetailSection, DetailRow } from "@/components/ui/detail-list";
import type { PurchaseRequestStatus, Updater } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<PurchaseRequestStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

type RequestDetail = {
  id: string;
  status: PurchaseRequestStatus;
  note: string | null;
  created_by: string | null;
  created_at: string;
  reviewed_at: string | null;
  creator: Updater | null;
  reviewer: Updater | null;
  supplier: { id: string; name: string } | null;
  purchase_request_items: {
    id: string;
    qty: number;
    unit: string;
    item: { id: string; name: string; unit: string; on_hand: number; reserved: number; deleted_at: string | null } | null;
  }[];
  purchases: { id: string; transaction_date: string; created_at: string }[];
};

export default async function PurchaseRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("purchase_requests")
    .select(`
      id, status, note, created_by, created_at, reviewed_at,
      creator:profiles!created_by(full_name,email),
      reviewer:profiles!reviewed_by(full_name,email),
      supplier:suppliers(id,name),
      purchase_request_items(id, qty, unit, item:items(id,name,unit,on_hand,reserved,deleted_at)),
      purchases(id, transaction_date, created_at)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const req = data as unknown as RequestDetail;

  const isAdmin = can(profile, P.PURCHASING_APPROVE);
  const isOwn = req.created_by === profile?.id;
  const canDelete = isAdmin || (isOwn && (req.status === "pending" || req.status === "draft"));
  const canSubmitDraft = req.status === "draft" && (isOwn || isAdmin);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2">
            <Link href="/purchasing/requests"><ArrowLeft className="size-4" /></Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Request <span className="text-muted-foreground font-normal">{formatId(id)}</span>
          </h1>
          <Badge variant={
            req.status === "approved" ? "success" :
            req.status === "rejected" ? "destructive" :
            req.status === "draft" ? "outline" :
            "secondary"
          }>
            {STATUS_LABEL[req.status]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {canSubmitDraft && <SubmitDraftButton id={id} />}
          {isAdmin && req.status === "pending" && <ReviewButtons id={id} />}
          <PurchaseRequestDetailActions id={id} canEdit={canSubmitDraft} canDelete={canDelete} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 lg:col-span-6">
          <DetailSection title="Details">
            <DetailRow label="Requested date" value={formatDateTime(req.created_at)} />
            <DetailRow label="Requested by" value={updaterName(req.creator)} />
            {req.supplier && <DetailRow label="Supplier" value={req.supplier.name} />}
            {req.reviewer && (
              <>
                <DetailRow
                  label={req.status === "rejected" ? "Rejected by" : "Approved by"}
                  value={updaterName(req.reviewer)}
                />
                {req.reviewed_at && (
                  <DetailRow
                    label={req.status === "rejected" ? "Rejected on" : "Approved on"}
                    value={formatDateTime(req.reviewed_at)}
                  />
                )}
              </>
            )}
          </DetailSection>
        </div>
      </div>

      {req.note && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{req.note}</p>
        </section>
      )}

      {req.purchases.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Linked purchase</h2>
          <div className="border rounded-lg px-4 py-3 space-y-2">
            {req.purchases.map((p) => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <Link href={`/purchasing/purchases/${p.id}`} className="font-medium underline hover:text-muted-foreground">
                  {formatId(p.id)}
                </Link>
                <span className="text-muted-foreground">
                  Transaction: {formatDate(p.transaction_date)} · Recorded: {formatDate(p.created_at)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Items</h2>
        {req.purchase_request_items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No items.</p>
        ) : (
          <PurchaseRequestItemsList items={req.purchase_request_items} />
        )}
      </section>
    </div>
  );
}
