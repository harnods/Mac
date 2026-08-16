import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P, canAccessRecipeStation } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PrepOrderForm } from "@/components/prep-orders/prep-order-form";

export const dynamic = "force-dynamic";

type RecipeItem = {
  id: string;
  item_id: string;
  quantity: number;
  unit: string;
  item: {
    id: string;
    name: string;
    unit: string;
    on_hand: number;
    reserved: number;
    deleted_at: string | null;
  } | null;
};

export type RecipeForPrep = {
  id: string;
  name: string;
  product_id: string;
  station: string | null;
  yield_qty: number;
  unit: string | null;
  product: { id: string; name: string; unit: string; type: string } | null;
  recipe_items: RecipeItem[];
};

export default async function NewPrepOrderPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can(profile, P.PREP_ORDERS_WRITE)) redirect("/prep-orders");

  const supabase = await createClient();

  const { data } = await supabase
    .from("recipes")
    .select(
      `id, name, product_id, station, yield_qty, unit,
       product:items!product_id(id,name,unit,type),
       recipe_items(id, item_id, quantity, unit, item:items(id,name,unit,on_hand,reserved,deleted_at))`
    )
    .not("product_id", "is", null)
    .order("name");

  // Filter: output must be a prep_item, must have at least one non-deleted recipe
  // item, AND must be in a station this role may access.
  const recipes = ((data ?? []) as unknown as RecipeForPrep[]).filter(
    (r) =>
      r.product?.type === "prep_item" &&
      r.recipe_items.some((ri) => ri.item !== null && ri.item.deleted_at === null) &&
      canAccessRecipeStation(profile, r.station)
  );

  return (
    <div className="flex flex-col flex-1 gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/prep-orders">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          New prep order
        </h1>
      </div>
      <PrepOrderForm recipes={recipes} />
    </div>
  );
}
