import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { AccessDenied } from "@/components/access-denied";
import { SuppliersManager, type SupplierListRow } from "@/components/purchasing/suppliers-manager";
import type { SupplierWithPics } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const profile = await getCurrentProfile();
  if (!can(profile, P.PURCHASING_READ)) return <AccessDenied label="Suppliers" />;
  const canEdit = can(profile, P.PURCHASING_PURCHASE) || can(profile, P.PURCHASING_REQUEST);

  const supabase = await createClient();
  const [{ data }, { data: links }] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name, updated_by, created_at, updated_at, supplier_pics(id, supplier_id, name, whatsapp, created_at)")
      .order("name"),
    // Ingredient count per supplier — active (not soft-deleted) ingredients only.
    supabase
      .from("item_suppliers")
      .select("supplier_id, item:items!inner(id)")
      .is("item.deleted_at", null),
  ]);

  const counts = new Map<string, number>();
  for (const l of (links ?? []) as { supplier_id: string }[]) {
    counts.set(l.supplier_id, (counts.get(l.supplier_id) ?? 0) + 1);
  }

  const suppliers: SupplierListRow[] = ((data ?? []) as unknown as SupplierWithPics[]).map((s) => ({
    ...s,
    // Keep each supplier's PICs in a stable insertion order.
    supplier_pics: [...s.supplier_pics].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    ingredientCount: counts.get(s.id) ?? 0,
  }));

  return <SuppliersManager suppliers={suppliers} canEdit={canEdit} />;
}
