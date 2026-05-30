import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
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
import { PaginationBar } from "@/components/ui/pagination-bar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

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
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const { q = "", type, page: rawPageStr } = await searchParams;
  const rawPage = Number(rawPageStr ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
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
    .select(`id, name, updated_at, updater:profiles!updated_by(full_name,email), recipe_items(id), ${productJoin}`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
  if (filterByType) query = query.eq("items.type", itemType);

  const { data, count } = await query;
  const list = (data ?? []) as unknown as RecipeRow[];
  const isFiltered = !!q.trim() || !!type;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  const buildHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (type) sp.set("type", type);
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
      <PaginationBar page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
