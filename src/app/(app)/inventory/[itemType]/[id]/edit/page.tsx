import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ItemForm } from "@/components/inventory/item-form";
import { ProductForm } from "@/components/inventory/product-form";
import { getProductFormData } from "@/app/actions/inventory";
import { ITEM_TYPE_CONFIG, type ItemTypeSlug } from "@/lib/item-types";
import type { Category, Item } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ itemType: string; id: string }>;
}) {
  const { itemType, id } = await params;
  const config = ITEM_TYPE_CONFIG[itemType as ItemTypeSlug];
  if (!config) notFound();

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can(profile, P.INVENTORY_WRITE)) redirect(`/inventory/${itemType}/${id}`);

  const isProduct = config.dbType === "product";

  if (isProduct) {
    const productFormData = await getProductFormData(id);
    if (!productFormData || !productFormData.item) notFound();

    return (
      <div className="flex flex-col flex-1 gap-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2">
            <Link href={`/inventory/${itemType}/${id}`}><ArrowLeft className="size-4" /></Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Edit {config.singular.toLowerCase()}</h1>
        </div>

        <ProductForm
          categories={productFormData.categories}
          units={productFormData.units}
          products={productFormData.products}
          item={productFormData.item}
          setProducts={productFormData.setProducts}
          unitLocked={productFormData.unitLocked}
        />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: item }, { data: categories }, { data: units }, ...txResults] = await Promise.all([
    supabase.from("items").select("*").eq("id", id).eq("type", config.dbType).maybeSingle(),
    config.hasCategories
      ? supabase.from("categories").select("id,name").eq("type", config.dbType).order("name")
      : Promise.resolve({ data: [] }),
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
          <Link href={`/inventory/${itemType}/${id}`}><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit {config.singular.toLowerCase()}</h1>
      </div>

      <ItemForm
        item={item as Item}
        categories={(categories ?? []) as Category[]}
        units={(units ?? []).map((u: { code: string }) => u.code)}
        itemTypeSlug={itemType as ItemTypeSlug}
        hasCategories={config.hasCategories}
        unitLocked={unitLocked}
      />
    </div>
  );
}
