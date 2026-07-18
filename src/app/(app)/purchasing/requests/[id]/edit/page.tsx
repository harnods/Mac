import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PurchaseRequestForm } from "@/components/purchasing/purchase-request-form";

export const dynamic = "force-dynamic";

export default async function EditPurchaseRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const [{ data: req }, { data: itemsData }] = await Promise.all([
    supabase
      .from("purchase_requests")
      .select("id, status, note, created_by, purchase_request_items(item_id, qty, unit)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("items")
      .select("id, name, unit, on_hand, reserved, type")
      .in("type", ["ingredient", "supply"])
      .is("deleted_at", null)
      .order("type")
      .order("name"),
  ]);

  if (!req) notFound();
  if (req.status !== "draft") redirect(`/purchasing/requests/${id}`);
  if (req.created_by !== profile.id && !can(profile, P.PURCHASING_APPROVE))
    redirect(`/purchasing/requests/${id}`);

  const initialRows = (req.purchase_request_items ?? []).map((ri: { item_id: string; qty: number; unit: string }) => ({
    item_id: ri.item_id,
    qty: String(ri.qty),
    unit: ri.unit,
  }));

  return (
    <div className="flex flex-col flex-1 gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2 mt-0.5">
          <Link href={`/purchasing/requests/${id}`}><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit draft request</h1>
      </div>
      <div className="flex flex-col flex-1 max-w-2xl">
        <PurchaseRequestForm
          items={itemsData ?? []}
          requestId={id}
          initialNote={req.note ?? ""}
          initialRows={initialRows}
        />
      </div>
    </div>
  );
}
