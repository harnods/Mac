import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { RecipeTableRowClient } from "@/components/recipes/recipe-table-row";
import { RecipesFilter } from "@/components/recipes/recipes-filter";
import type { Updater } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type RecipeRow = {
  id: string;
  name: string;
  updated_at: string;
  updater: Updater | null;
  recipe_items: { id: string }[];
  product: { name: string; type: string } | null;
};

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q = "", type } = await searchParams;
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const isAdmin = profile?.role === "admin";

  let query = supabase
    .from("recipes")
    .select("id, name, updated_at, updater:profiles!updated_by(full_name,email), recipe_items(id), product:items!product_id(name,type)")
    .order("created_at", { ascending: false });

  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);

  // Type filter: resolve product_ids of the matching item type first
  if (type === "wip" || type === "product") {
    const itemType = type === "wip" ? "prep_item" : "product";
    const { data: matched } = await supabase.from("items").select("id").eq("type", itemType);
    const ids = (matched ?? []).map((p) => p.id);
    if (ids.length > 0) query = query.in("product_id", ids);
    else query = query.in("product_id", ["00000000-0000-0000-0000-000000000000"]); // no match
  }

  const { data } = await query;
  const list = (data ?? []) as unknown as RecipeRow[];
  const isFiltered = !!q.trim() || !!type;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
        {isAdmin && (
          <Button asChild>
            <Link href="/recipes/new">
              <Plus className="size-4" /> Add recipe
            </Link>
          </Button>
        )}
      </div>

      <Suspense fallback={null}>
        <RecipesFilter />
      </Suspense>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {isFiltered ? "No recipes match your filter." : "No recipes yet."}
          {!isFiltered && isAdmin && (
            <> <Link href="/recipes/new" className="underline">Add the first recipe</Link>.</>
          )}
        </div>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-56">Name</TableHead>
                <TableHead className="w-24">Type</TableHead>
                <TableHead className="w-48">Output</TableHead>
                <TableHead className="w-28">Ingredients</TableHead>
                <TableHead className="w-44">Last updated</TableHead>
                <TableHead />
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((r) => (
                <RecipeTableRowClient
                  key={r.id}
                  id={r.id}
                  name={r.name}
                  product={r.product?.name ?? null}
                  productType={r.product?.type ?? null}
                  ingredientCount={r.recipe_items.length}
                  updatedAt={r.updated_at}
                  updater={r.updater}
                  isAdmin={isAdmin}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
