import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { CategoryManager } from "@/components/inventory/category-manager";
import { AddCategoryButton } from "@/components/inventory/add-category-button";
import { CategoriesFilter } from "@/components/inventory/categories-filter";
import { CATEGORY_TYPE_CONFIG, type CategoryTypeSlug } from "@/lib/item-types";
import type { CategoryWithUpdater } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function SettingsCategoryTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ catType: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { catType } = await params;
  const { q = "" } = await searchParams;

  const config = CATEGORY_TYPE_CONFIG[catType as CategoryTypeSlug];
  if (!config) notFound();

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  let query = supabase
    .from("categories")
    .select("*, updater:profiles!updated_by(full_name,email)")
    .eq("type", config.dbType)
    .order("name");

  if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);

  const { data } = await query;
  const isAdmin = can(profile, P.INVENTORY_WRITE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{config.label}</h1>
        </div>
        {isAdmin && <AddCategoryButton catType={config.dbType} />}
      </div>

      <Suspense fallback={null}>
        <CategoriesFilter />
      </Suspense>

      <CategoryManager
        categories={(data ?? []) as CategoryWithUpdater[]}
        isAdmin={isAdmin}
      />
    </div>
  );
}
