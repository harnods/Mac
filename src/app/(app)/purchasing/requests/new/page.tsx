import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PurchaseRequestForm } from "@/components/purchasing/purchase-request-form";

export const dynamic = "force-dynamic";

export default async function NewPurchaseRequestPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [{ data }, { data: suppliers }] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, unit, on_hand, reserved, type, purchase_unit, item_unit_conversions(from_unit, factor, to_unit)")
      .in("type", ["ingredient", "supply"])
      .is("deleted_at", null)
      .order("type")
      .order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  return (
    <div className="flex flex-col flex-1 gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/purchasing/requests"><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New purchase request</h1>
      </div>
      <PurchaseRequestForm items={data ?? []} suppliers={suppliers ?? []} />
    </div>
  );
}
