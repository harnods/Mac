"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import type { ProfileWithPermissions } from "@/lib/supabase/types";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const supplierSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required").max(120),
  pics: z
    .array(
      z.object({
        name: z.string().trim().min(1, "PIC name is required").max(80),
        whatsapp: z.string().trim().max(30).optional().default(""),
      }),
    )
    .default([]),
});

/** Managing suppliers is allowed for anyone who can request or make purchases. */
function canManageSuppliers(profile: ProfileWithPermissions | null): boolean {
  return can(profile, P.PURCHASING_PURCHASE) || can(profile, P.PURCHASING_REQUEST);
}

export async function createSupplier(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!canManageSuppliers(profile)) return { ok: false, error: "No permission" };

  const parsed = supplierSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { name, pics } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ name, updated_by: profile.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.code === "23505" ? "Supplier already exists" : error.message };

  const cleanPics = pics.filter((p) => p.name.trim());
  if (cleanPics.length > 0) {
    const { error: picError } = await supabase
      .from("supplier_pics")
      .insert(cleanPics.map((p) => ({ supplier_id: data.id, name: p.name, whatsapp: p.whatsapp || null })));
    if (picError) return { ok: false, error: picError.message };
  }

  revalidatePath("/purchasing/suppliers");
  return { ok: true, id: data.id };
}

export async function updateSupplier(id: string, raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!canManageSuppliers(profile)) return { ok: false, error: "No permission" };

  const parsed = supplierSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { name, pics } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ name, updated_by: profile.id })
    .eq("id", id);
  if (error) return { ok: false, error: error.code === "23505" ? "Supplier already exists" : error.message };

  // Replace the PIC list.
  await supabase.from("supplier_pics").delete().eq("supplier_id", id);
  const cleanPics = pics.filter((p) => p.name.trim());
  if (cleanPics.length > 0) {
    const { error: picError } = await supabase
      .from("supplier_pics")
      .insert(cleanPics.map((p) => ({ supplier_id: id, name: p.name, whatsapp: p.whatsapp || null })));
    if (picError) return { ok: false, error: picError.message };
  }

  revalidatePath("/purchasing/suppliers");
  return { ok: true, id };
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!canManageSuppliers(profile)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  const [{ count: prCount }, { count: poCount }] = await Promise.all([
    supabase.from("purchase_requests").select("id", { count: "exact", head: true }).eq("supplier_id", id),
    supabase.from("purchases").select("id", { count: "exact", head: true }).eq("supplier_id", id),
  ]);
  const used = (prCount ?? 0) + (poCount ?? 0);
  if (used > 0)
    return { ok: false, error: `Cannot delete — supplier is used in ${used} purchase request(s)/purchase(s)` };

  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/purchasing/suppliers");
  return { ok: true };
}
