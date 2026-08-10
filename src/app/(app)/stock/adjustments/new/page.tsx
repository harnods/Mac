import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AdjustmentForm } from "@/components/stock/adjustment-form";

export const dynamic = "force-dynamic";

export default async function NewStockAdjustmentPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can(profile, P.STOCK_WRITE)) redirect("/stock/adjustments");

  const supabase = await createClient();

  const { data: items } = await supabase
    .from("items")
    .select("id, name, unit, type, on_hand, purchase_unit, purchase_unit_qty, item_unit_conversions(from_unit, factor, to_unit)")
    .is("deleted_at", null)
    .in("type", ["ingredient", "supply"])
    .order("name");

  return (
    <div className="flex flex-col flex-1 gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/stock/adjustments">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Add stock adjustment</h1>
      </div>
      <AdjustmentForm items={items ?? []} />
    </div>
  );
}
