import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ItemForm } from "@/components/inventory/item-form";
import { ITEM_TYPE_CONFIG } from "@/lib/item-types";

export const dynamic = "force-dynamic";

export default async function NewPrepItemPage() {
  const config = ITEM_TYPE_CONFIG["prep-items"];

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can(profile, P.INVENTORY_WRITE)) redirect("/inventory/prep-items");

  const supabase = await createClient();
  const { data: units } = await supabase
    .from("units")
    .select("code")
    .order("is_system", { ascending: false })
    .order("code");

  return (
    <div className="flex flex-col flex-1 gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/inventory/prep-items"><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Add {config.singular.toLowerCase()}</h1>
      </div>

      <ItemForm
        categories={[]}
        units={(units ?? []).map((u: { code: string }) => u.code)}
        itemTypeSlug="prep-items"
        hasCategories={config.hasCategories}
      />
    </div>
  );
}
