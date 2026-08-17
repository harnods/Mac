import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PurchaseForm } from "@/components/purchasing/purchase-form";
import { convert } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can(profile, P.PURCHASING_PURCHASE)) redirect("/purchasing/purchases");

  const supabase = await createClient();

  const [{ data: ingredients }, { data: requests }, { data: suppliers }] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, unit, on_hand, reserved, purchase_unit, item_unit_conversions(from_unit, factor, to_unit)")
      .eq("type", "ingredient")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("purchase_requests")
      .select(`
        id, note, created_at, reviewed_at,
        purchase_request_items(item_id, qty, unit, item:items(name, deleted_at)),
        purchase_purchase_requests(purchases(purchase_items(item_id, qty_purchased, unit)))
      `)
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  type RawPR = {
    id: string;
    note: string | null;
    created_at: string;
    reviewed_at: string | null;
    purchase_request_items: { item_id: string; qty: number; unit: string; item: { name: string; deleted_at: string | null } | null }[];
    purchase_purchase_requests: {
      purchases: {
        purchase_items: { item_id: string; qty_purchased: number; unit: string }[];
      } | null;
    }[];
  };

  const approvedRequests = ((requests ?? []) as unknown as RawPR[]).map((r: RawPR) => {
    // Build a map of item_id → requested unit so we can normalize purchased qty
    const requestedUnitMap: Record<string, string> = {};
    for (const it of r.purchase_request_items) {
      requestedUnitMap[it.item_id] = it.unit;
    }

    const purchasedMap: Record<string, { qty: number; unit: string }> = {};
    for (const ppr of r.purchase_purchase_requests ?? []) {
      for (const pi of ppr.purchases?.purchase_items ?? []) {
        // Convert purchased qty to the same unit as requested qty before accumulating
        const targetUnit = requestedUnitMap[pi.item_id] ?? pi.unit;
        if (!purchasedMap[pi.item_id]) purchasedMap[pi.item_id] = { qty: 0, unit: targetUnit };
        const converted = convert(pi.qty_purchased, pi.unit, targetUnit) ?? pi.qty_purchased;
        purchasedMap[pi.item_id].qty += converted;
      }
    }
    const purchaseCount = r.purchase_purchase_requests?.length ?? 0;
    return {
      id: r.id,
      note: r.note,
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
      purchaseCount,
      items: r.purchase_request_items.map((it) => ({
        item_id: it.item_id,
        item_name: it.item?.name ?? null,
        item_deleted: !it.item || !!it.item.deleted_at,
        qty: it.qty,
        unit: it.unit,
        purchased_qty: purchasedMap[it.item_id]?.qty ?? 0,
        purchased_unit: purchasedMap[it.item_id]?.unit ?? it.unit,
      })),
    };
  });

  return (
    <div className="flex flex-col flex-1 gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/purchasing/purchases"><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Add purchase</h1>
      </div>
      <PurchaseForm
        ingredients={ingredients ?? []}
        approvedRequests={approvedRequests}
        suppliers={suppliers ?? []}
      />
    </div>
  );
}
