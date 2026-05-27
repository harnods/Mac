import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { formatNum } from "@/lib/units";
import { Qty } from "@/components/ui/qty";
import { RecipeDeleteButton } from "@/components/recipes/recipe-delete-button";
import { DeletedItemBadge } from "@/components/ui/deleted-item-badge";
import type { RecipeWithItems } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recipes")
    .select(
      "*, recipe_items(id, item_id, quantity, unit, item:items(id,name,unit,deleted_at)), updater:profiles!updated_by(full_name,email), product:items!product_id(id,name,unit,type)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const recipe = data as RecipeWithItems & { unit?: string | null; weight_per_pcs?: number | null; weight_unit?: string | null; product: { id: string; name: string; unit: string; type: string } | null };
  const isWip = recipe.product?.type === "prep_item";
  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2 mt-0.5">
            <Link href="/recipes"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{recipe.name}</h1>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/recipes/${id}/edit`}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
            <RecipeDeleteButton id={id} name={recipe.name} />
          </div>
        )}
      </div>

      <div className="max-w-2xl space-y-4">
        {recipe.product && (
          <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <span className="text-muted-foreground">Output</span>
            <span className="font-medium">{recipe.product.name}</span>
            <>
              <span className="text-muted-foreground">Yield</span>
              <span className="tabular-nums">
                <Qty value={recipe.yield_qty} unit={isWip ? (recipe.unit ?? recipe.product.unit) : recipe.product.unit} /> per prep
              </span>
            </>
            {recipe.weight_per_pcs != null && (
              <>
                <span className="text-muted-foreground">Weight per pcs</span>
                <span className="tabular-nums">
                  <Qty value={recipe.weight_per_pcs} unit={recipe.weight_unit ?? "g"} />
                </span>
              </>
            )}
          </div>
        )}
        <h2 className="text-sm font-medium">Ingredients</h2>
        {recipe.recipe_items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ingredients.</p>
        ) : (
          <div>
            <div className="grid grid-cols-[2rem_12rem_auto] gap-x-6 py-2 border-b text-xs text-muted-foreground">
              <span />
              <span className="pl-3">Ingredient</span>
              <span>Qty</span>
            </div>
            {recipe.recipe_items.map((ri, idx) => (
              <div key={ri.id} className="grid grid-cols-[2rem_12rem_auto] gap-x-6 items-center py-2 border-b last:border-0">
                <span className="text-sm text-muted-foreground text-right">{idx + 1}.</span>
                <span className="font-medium text-sm pl-3 flex items-center">
                  {ri.item?.name ?? "—"}
                  {ri.item?.deleted_at && <DeletedItemBadge />}
                </span>
                <span className="tabular-nums text-sm">
                  <Qty value={ri.quantity} unit={ri.unit} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
