import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CountForm } from "@/components/stock/count-form";

export const dynamic = "force-dynamic";

export default async function NewStockCountPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/stock/counts");

  const supabase = await createClient();

  const { data: items } = await supabase
    .from("items")
    .select("id, name, unit, type, on_hand")
    .is("deleted_at", null)
    .in("type", ["ingredient", "supply"])
    .order("name");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2 mt-0.5">
          <Link href="/stock/counts">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New stock count</h1>
      </div>
      <CountForm items={items ?? []} />
    </div>
  );
}
