import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { AccessDenied } from "@/components/access-denied";
import { SuppliersManager } from "@/components/purchasing/suppliers-manager";
import type { SupplierWithPics } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const profile = await getCurrentProfile();
  if (!can(profile, P.PURCHASING_READ)) return <AccessDenied label="Suppliers" />;
  const canEdit = can(profile, P.PURCHASING_PURCHASE) || can(profile, P.PURCHASING_REQUEST);

  const supabase = await createClient();
  const { data } = await supabase
    .from("suppliers")
    .select("id, name, updated_by, created_at, updated_at, supplier_pics(id, supplier_id, name, whatsapp, created_at)")
    .order("name");

  const suppliers = (data ?? []) as unknown as SupplierWithPics[];
  // Keep each supplier's PICs in a stable insertion order.
  for (const s of suppliers) {
    s.supplier_pics.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  return <SuppliersManager suppliers={suppliers} canEdit={canEdit} />;
}
