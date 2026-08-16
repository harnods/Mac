import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P, allowedRecipeStations } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { RecipeBulkTable } from "@/components/recipes/recipe-bulk-table";
import { RecipesFilter } from "@/components/recipes/recipes-filter";
import type { Updater } from "@/lib/supabase/types";
import { PaginationBar, parsePageSize, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination-bar";

export const dynamic = "force-dynamic";


type RecipeRow = {
  id: string;
  name: string;
  recipe_type: string | null;
  station: string | null;
  updated_at: string;
  updater: Updater | null;
  recipe_items: { id: string }[];
  product: { name: string; type: string } | null;
};

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; category?: string; page?: string; size?: string }>;
}) {
  const { q = "", type, category, page: rawPageStr, size: rawSizeStr } = await searchParams;
  const rawPage = Number(rawPageStr ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const PAGE_SIZE = parsePageSize(rawSizeStr);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const isAdmin = can(profile, P.RECIPES_WRITE);

  const filterByType = type === "wip" || type === "product";
  const itemType = type === "wip" ? "prep_item" : "product";
  // Use !inner when filtering by type so PostgREST can push the filter to the join
  const productJoin = filterByType
    ? "product:items!product_id!inner(name,type)"
    : "product:items!product_id(name,type)";

  let query = supabase
    .from("recipes")
    .select(`id, name, recipe_type, station, updated_at, updater:profiles!updated_by(full_name,email), recipe_items(id), ${productJoin}`, { count: "exact" })
    .order("name")
    .range(from, to);

  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  if (filterByType) query = query.eq("items.type", itemType);
  if (category === "bar" || category === "kitchen") query = query.eq("station", category);

  // Restrict to the stations this role may access (uncategorized always visible).
  const allowedStations = allowedRecipeStations(profile);
  if (allowedStations) {
    query = query.or(`station.is.null,station.in.(${allowedStations.join(",")})`);
  }

  const { data, count } = await query;
  const list = (data ?? []) as unknown as RecipeRow[];
  const isFiltered = !!q.trim() || !!type || !!category;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const buildHref = (p: number, size: number = PAGE_SIZE) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (type) sp.set("type", type);
    if (category) sp.set("category", category);
    if (size !== DEFAULT_PAGE_SIZE) sp.set("size", String(size));
    if (p > 1) sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

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
        <RecipesFilter categories={allowedStations ?? ["bar", "kitchen"]} />
      </Suspense>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {isFiltered ? "No recipes match your filter." : "No recipes yet."}
          {!isFiltered && isAdmin && (
            <> <Link href="/recipes/new" className="underline">Add the first recipe</Link>.</>
          )}
        </div>
      ) : (
        <RecipeBulkTable recipes={list} isAdmin={isAdmin} />
      )}
      <PaginationBar page={page} totalPages={totalPages} pageSize={PAGE_SIZE} buildHref={buildHref} buildSizeHref={(s) => buildHref(1, s)} />
    </div>
  );
}
