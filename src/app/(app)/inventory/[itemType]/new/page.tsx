import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, canViewCost, itemWritePermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ItemForm } from "@/components/inventory/item-form";
import { ProductForm } from "@/components/inventory/product-form";
import { getProductFormData } from "@/app/actions/inventory";
import { ITEM_TYPE_CONFIG, type ItemTypeSlug } from "@/lib/item-types";
import type { Category } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function NewItemPage({
  params,
}: {
  params: Promise<{ itemType: string }>;
}) {
  const { itemType } = await params;
  const config = ITEM_TYPE_CONFIG[itemType as ItemTypeSlug];
  if (!config) notFound();

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can(profile, itemWritePermission(config.dbType))) redirect(`/inventory/${itemType}`);

  const isProduct = config.dbType === "product";
  const productFormData = isProduct ? await getProductFormData() : null;
  if (isProduct && !productFormData) redirect(`/inventory/${itemType}`);

  const supabase = await createClient();
  const [{ data: categories }, { data: units }] = isProduct
    ? [{ data: [] }, { data: [] }]
    : await Promise.all([
        config.hasCategories
          ? supabase.from("categories").select("id,name").eq("type", config.dbType).order("name")
          : Promise.resolve({ data: [] }),
        supabase.from("units").select("code").order("is_system", { ascending: false }).order("code"),
      ]);

  return (
    <div className="flex flex-col flex-1 gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href={`/inventory/${itemType}`}><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Add {config.singular.toLowerCase()}</h1>
      </div>

      {isProduct && productFormData ? (
        <ProductForm
          categories={productFormData.categories}
          units={productFormData.units}
          products={productFormData.products}
        />
      ) : (
        <ItemForm
          categories={(categories ?? []) as Category[]}
          units={(units ?? []).map((u: { code: string }) => u.code)}
          itemTypeSlug={itemType as ItemTypeSlug}
          hasCategories={config.hasCategories}
          canViewCost={canViewCost(profile)}
        />
      )}
    </div>
  );
}
