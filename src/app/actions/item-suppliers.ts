"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { canManageItemSuppliers } from "@/lib/permissions";

type ActionResult = { ok: true; added?: number } | { ok: false; error: string };

const uuid = z.string().uuid();

const addSchema = z.object({
  itemIds: z.array(uuid).min(1, "No ingredients selected").max(1000),
  supplierIds: z.array(uuid).min(1, "Select a supplier").max(100),
  /** Only honored when exactly one item and one supplier are given. */
  makePrimary: z.boolean().optional().default(false),
});

function revalidate() {
  revalidatePath("/inventory", "layout");
  revalidatePath("/purchasing/suppliers", "layout");
}

/**
 * Link suppliers to ingredients. Existing links are kept as-is ("add only");
 * the DB makes the first supplier of an ingredient its primary automatically.
 */
export async function addItemSuppliers(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!canManageItemSuppliers(profile)) return { ok: false, error: "No permission" };

  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { itemIds, supplierIds, makePrimary } = parsed.data;

  const supabase = await createClient();

  // Only active ingredients can have suppliers.
  const { data: items, error: itemErr } = await supabase
    .from("items")
    .select("id")
    .in("id", itemIds)
    .eq("type", "ingredient")
    .is("deleted_at", null);
  if (itemErr) return { ok: false, error: itemErr.message };
  if ((items ?? []).length !== new Set(itemIds).size) return { ok: false, error: "Only ingredients can have suppliers" };

  const { data: existing, error: exErr } = await supabase
    .from("item_suppliers")
    .select("item_id, supplier_id")
    .in("item_id", itemIds)
    .in("supplier_id", supplierIds);
  if (exErr) return { ok: false, error: exErr.message };
  const linked = new Set((existing ?? []).map((r) => `${r.item_id}:${r.supplier_id}`));

  const single = itemIds.length === 1 && supplierIds.length === 1;
  const rows = itemIds.flatMap((item_id) =>
    supplierIds
      .filter((supplier_id) => !linked.has(`${item_id}:${supplier_id}`))
      .map((supplier_id) => ({
        item_id,
        supplier_id,
        is_primary: single && makePrimary,
        updated_by: profile.id,
      })),
  );

  if (rows.length > 0) {
    const { error } = await supabase.from("item_suppliers").insert(rows);
    if (error) return { ok: false, error: error.message };
  } else if (single && makePrimary) {
    // Already linked — just promote it.
    const { error } = await supabase.rpc("set_item_supplier_primary", {
      p_item_id: itemIds[0],
      p_supplier_id: supplierIds[0],
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidate();
  return { ok: true, added: rows.length };
}

export async function setPrimaryItemSupplier(itemId: string, supplierId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!canManageItemSuppliers(profile)) return { ok: false, error: "No permission" };
  if (!uuid.safeParse(itemId).success || !uuid.safeParse(supplierId).success) return { ok: false, error: "Invalid id" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_item_supplier_primary", {
    p_item_id: itemId,
    p_supplier_id: supplierId,
  });
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

/** Unlink a supplier from an ingredient. The DB promotes a new primary if needed. */
export async function removeItemSupplier(itemId: string, supplierId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!canManageItemSuppliers(profile)) return { ok: false, error: "No permission" };
  if (!uuid.safeParse(itemId).success || !uuid.safeParse(supplierId).success) return { ok: false, error: "Invalid id" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("item_suppliers")
    .delete()
    .eq("item_id", itemId)
    .eq("supplier_id", supplierId);
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}
