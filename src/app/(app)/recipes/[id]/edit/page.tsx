import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P, allowedRecipeStations, canAccessRecipeStation } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { RecipeForm } from "@/components/recipes/recipe-form";
import type { Item, Recipe, RecipeItemWithItem } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can(profile, P.RECIPES_WRITE)) redirect(`/recipes/${id}`);

  const supabase = await createClient();

  const [{ data: recipe, error }, { data: items }, { data: products }, { data: unitsData }, { data: takenProductIds }] = await Promise.all([
    supabase
      .from("recipes")
      .select("*, recipe_items(id, item_id, quantity, unit, item:items(id,name,unit), substitutes:recipe_item_substitutes(item_id, quantity, unit))")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("items").select("id, name, unit, type").in("type", ["ingredient", "prep_item"]).is("deleted_at", null).order("name"),
    supabase.from("items").select("id, name, unit, type").in("type", ["product", "prep_item"]).is("deleted_at", null).order("name"),
    supabase.from("units").select("code").order("is_system", { ascending: false }).order("code"),
    supabase.from("recipes").select("product_id").not("product_id", "is", null).neq("id", id),
  ]);

  if (error || !recipe) notFound();
  if (!canAccessRecipeStation(profile, (recipe as Recipe).station)) notFound();
  const allowedStations = allowedRecipeStations(profile);

  // Each item can only be the output of one recipe — hide items already
  // claimed by another recipe (this recipe's own output stays selectable).
  const takenIds = new Set((takenProductIds ?? []).map((r: { product_id: string }) => r.product_id));
  const availableProducts = (products ?? []).filter((p: { id: string }) => !takenIds.has(p.id));

  return (
    <div className="flex flex-col flex-1 gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href={`/recipes/${id}`}><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit recipe</h1>
      </div>
      <RecipeForm
        items={(items ?? []) as Pick<Item, "id" | "name" | "unit" | "type">[]}
        products={availableProducts as Pick<Item, "id" | "name" | "unit" | "type">[]}
        recipe={recipe as Recipe}
        recipeItems={recipe.recipe_items as RecipeItemWithItem[]}
        units={(unitsData ?? []).map((u: { code: string }) => u.code)}
        stationOptions={allowedStations ?? ["bar", "kitchen"]}
      />
    </div>
  );
}
