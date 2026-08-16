import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { SalesForm } from "@/components/sales/sales-form";

export const dynamic = "force-dynamic";

export default async function NewSalesEntryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can(profile, P.SALES_WRITE)) redirect("/sales");

  const supabase = await createClient();

  const { data } = await supabase
    .from("items")
    .select("id, name, unit, sell_price")
    .eq("type", "product")
    .is("deleted_at", null)
    .order("name");

  const products = (data ?? []) as { id: string; name: string; unit: string; sell_price: number | null }[];

  const { data: pmData } = await supabase.from("payment_methods").select("name").order("name");
  const paymentMethods = (pmData ?? []).map((m: { name: string }) => m.name);

  return (
    <div className="flex flex-col flex-1 gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/sales">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New sales entry</h1>
      </div>
      <SalesForm products={products} paymentMethods={paymentMethods} />
    </div>
  );
}
