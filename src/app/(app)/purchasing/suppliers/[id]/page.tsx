import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, canManageItemSuppliers, P } from "@/lib/permissions";
import { AccessDenied } from "@/components/access-denied";
import { SupplierDetail, type SupplierIngredientRow } from "@/components/purchasing/supplier-detail";
import { updaterName } from "@/lib/format";
import type { SupplierWithPics, Updater } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!can(profile, P.PURCHASING_READ)) return <AccessDenied label="Suppliers" />;
  const canEditSupplier = can(profile, P.PURCHASING_PURCHASE) || can(profile, P.PURCHASING_REQUEST);
  const canEditIngredients = canManageItemSuppliers(profile);

  const supabase = await createClient();
  const [{ data: supplierData }, { data: linkData }, { data: ingredientData }] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name, updated_by, created_at, updated_at, supplier_pics(id, supplier_id, name, whatsapp, created_at)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("item_suppliers")
      .select("item_id, is_primary, updated_at, item:items!inner(id, name, deleted_at, categories(name)), updater:profiles!updated_by(full_name,email)")
      .eq("supplier_id", id)
      .is("item.deleted_at", null),
    // Picker options for "Add ingredients".
    canEditIngredients
      ? supabase
          .from("items")
          .select("id, name, categories(name)")
          .eq("type", "ingredient")
          .is("deleted_at", null)
          .order("name")
      : Promise.resolve({ data: [] }),
  ]);

  if (!supplierData) notFound();
  const supplier = supplierData as unknown as SupplierWithPics;
  supplier.supplier_pics.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const links = (linkData ?? []) as unknown as {
    item_id: string;
    is_primary: boolean;
    updated_at: string;
    item: { id: string; name: string; categories: { name: string } | null };
    updater: Updater | null;
  }[];

  // For ingredients where this supplier isn't primary, show who is.
  const nonPrimaryIds = links.filter((l) => !l.is_primary).map((l) => l.item_id);
  const primaryByItem = new Map<string, string>();
  if (nonPrimaryIds.length > 0) {
    const { data: primaries } = await supabase
      .from("item_suppliers")
      .select("item_id, supplier:suppliers(name)")
      .in("item_id", nonPrimaryIds)
      .eq("is_primary", true);
    for (const p of (primaries ?? []) as unknown as { item_id: string; supplier: { name: string } | null }[]) {
      if (p.supplier) primaryByItem.set(p.item_id, p.supplier.name);
    }
  }

  const rows: SupplierIngredientRow[] = links
    .map((l) => ({
      itemId: l.item_id,
      name: l.item.name,
      categoryName: l.item.categories?.name ?? null,
      isPrimary: l.is_primary,
      primarySupplierName: l.is_primary ? supplier.name : (primaryByItem.get(l.item_id) ?? null),
      updatedAt: l.updated_at,
      updaterLabel: l.updater ? updaterName(l.updater) : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const ingredientOptions = ((ingredientData ?? []) as unknown as { id: string; name: string; categories: { name: string } | null }[])
    .map((i) => ({ id: i.id, name: i.name, categoryName: i.categories?.name ?? null }));

  return (
    <SupplierDetail
      supplier={supplier}
      ingredients={rows}
      ingredientOptions={ingredientOptions}
      canEditSupplier={canEditSupplier}
      canEditIngredients={canEditIngredients}
    />
  );
}
