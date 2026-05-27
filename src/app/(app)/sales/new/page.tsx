import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { SalesForm } from "@/components/sales/sales-form";

export const dynamic = "force-dynamic";

export default async function NewSalesEntryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/sales");

  const supabase = await createClient();

  const { data } = await supabase
    .from("items")
    .select("id, name, unit")
    .eq("type", "product")
    .is("deleted_at", null)
    .order("name");

  const products = (data ?? []) as { id: string; name: string; unit: string }[];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2 mt-0.5">
          <Link href="/sales">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New sales entry</h1>
      </div>
      <SalesForm products={products} />
    </div>
  );
}
