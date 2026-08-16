import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ItemForm } from "@/components/inventory/item-form";
import { ITEM_TYPE_CONFIG } from "@/lib/item-types";
import type { Item } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function EditPrepItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const config = ITEM_TYPE_CONFIG["prep-items"];

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can(profile, P.PREP_ITEMS_WRITE)) redirect(`/inventory/prep-items/${id}`);

  const supabase = await createClient();
  const [{ data: item }, { data: units }, ...txResults] = await Promise.all([
    supabase.from("items").select("*").eq("id", id).eq("type", config.dbType).maybeSingle(),
    supabase.from("units").select("code").order("is_system", { ascending: false }).order("code"),
    supabase.from("purchase_items").select("id", { count: "exact", head: true }).eq("item_id", id),
    supabase.from("purchase_request_items").select("id", { count: "exact", head: true }).eq("item_id", id),
    supabase.from("recipe_items").select("id", { count: "exact", head: true }).eq("item_id", id),
  ]);

  if (!item) notFound();

  const unitLocked = txResults.some((r) => (r.count ?? 0) > 0);

  return (
    <div className="flex flex-col flex-1 gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href={`/inventory/prep-items/${id}`}><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit {config.singular.toLowerCase()}</h1>
      </div>

      <ItemForm
        item={item as Item}
        categories={[]}
        units={(units ?? []).map((u: { code: string }) => u.code)}
        itemTypeSlug="prep-items"
        hasCategories={config.hasCategories}
        unitLocked={unitLocked}
      />
    </div>
  );
}
