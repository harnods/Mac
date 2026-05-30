import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { formatDate, formatDateTime, updaterName, formatId } from "@/lib/format";
import { formatNum } from "@/lib/units";
import { Qty } from "@/components/ui/qty";
import { ReviewButtons } from "@/components/purchasing/review-buttons";
import { DeleteRequestButtonClient } from "@/components/purchasing/delete-request-button";
import { SubmitDraftButton } from "@/components/purchasing/submit-draft-button";
import { DeletedItemBadge } from "@/components/ui/deleted-item-badge";
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2 mt-0.5">
            <Link href="/purchasing/requests"><ArrowLeft className="size-4" /></Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Request <span className="text-muted-foreground font-normal">{formatId(id)}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {canSubmitDraft && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/purchasing/requests/${id}/edit`}>Edit</Link>
            </Button>
          )}
          {canSubmitDraft && <SubmitDraftButton id={id} />}
          {isAdmin && req.status === "pending" && <ReviewButtons id={id} />}
          {canDelete && <DeleteRequestButtonClient id={id} />}
        </div>
      </div>

      <div className="max-w-2xl space-y-4">
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm text-foreground">
          <span className="text-muted-foreground">Requested date</span>
          <span>{formatDateTime(req.created_at)}</span>

          <span className="text-muted-foreground">Requested by</span>
          <span>{updaterName(req.creator) ?? "—"}</span>

          <span className="text-muted-foreground">Status</span>
          <span>
            <Badge variant={
              req.status === "approved" ? "success" :
              req.status === "rejected" ? "destructive" :
              req.status === "draft" ? "outline" :
              "secondary"
            }>
              {STATUS_LABEL[req.status]}
            </Badge>
          </span>

          {req.reviewer && (
            <>
              <span className="text-muted-foreground">
                {req.status === "rejected" ? "Rejected by" : "Approved by"}
              </span>
              <span>{updaterName(req.reviewer)}</span>

              {req.reviewed_at && (
                <>
                  <span className="text-muted-foreground">
                    {req.status === "rejected" ? "Rejected on" : "Approved on"}
                  </span>
                  <span>{formatDateTime(req.reviewed_at)}</span>
                </>
              )}
            </>
          )}
        </div>

        {req.note && (
          <div className="space-y-1">
            <h2 className="text-sm font-medium">Notes</h2>
            <p className="text-sm whitespace-pre-wrap">{req.note}</p>
          </div>
        )}

        {req.purchases.length > 0 && (
          <div className="border rounded-lg px-4 py-3 space-y-2">
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Linked purchase</div>
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
        )}
      </div>

      <div className="max-w-2xl space-y-1">
        <h2 className="text-sm font-medium">Items</h2>
        {req.purchase_request_items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No items.</p>
        ) : (
          <div>
            <div className="grid grid-cols-[2rem_12rem_auto] gap-x-6 py-2 border-b text-xs text-muted-foreground">
              <span />
              <span>Item</span>
              <span>Requested qty</span>
            </div>
            {req.purchase_request_items.map((ri, idx) => (
              <div key={ri.id} className="grid grid-cols-[2rem_12rem_auto] gap-x-6 items-center py-2 border-b last:border-0">
                <span className="text-sm text-muted-foreground text-right">{idx + 1}.</span>
                <span className="font-medium text-sm flex items-center">
                  {ri.item?.name ?? "—"}
                  {ri.item?.deleted_at && <DeletedItemBadge />}
                </span>
                <span className="tabular-nums text-sm">
                  {ri.qty != null && ri.unit
                    ? <Qty value={ri.qty} unit={ri.unit} />
                    : ri.qty != null
                    ? formatNum(ri.qty)
                    : <span className="italic text-muted-foreground">qty not set</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
