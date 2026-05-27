"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function renameUnit(oldCode: string, raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { ok: false, error: "Admin only" };

  const parsed = z.object({ code: z.string().trim().min(1).max(20) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const newCode = parsed.data.code;
  if (newCode === oldCode) return { ok: true };

  const supabase = await createClient();

  const [
    { count: itemCount },
    { count: recipeCount },
    { count: prItemCount },
    { count: purchaseUnitCount },
    { count: purchaseReqUnitCount },
  ] = await Promise.all([
    supabase.from("items").select("id", { count: "exact", head: true }).eq("unit", oldCode),
    supabase.from("recipe_items").select("id", { count: "exact", head: true }).eq("unit", oldCode),
    supabase.from("purchase_request_items").select("id", { count: "exact", head: true }).eq("unit", oldCode),
    supabase.from("purchase_items").select("id", { count: "exact", head: true }).eq("unit", oldCode),
    supabase.from("purchase_items").select("id", { count: "exact", head: true }).eq("requested_unit", oldCode),
  ]);

  const totalUsage =
    (itemCount ?? 0) + (recipeCount ?? 0) + (prItemCount ?? 0) +
    (purchaseUnitCount ?? 0) + (purchaseReqUnitCount ?? 0);

  if (totalUsage > 0)
    return { ok: false, error: "Cannot rename — unit is already used in transactions or recipes" };

  const { error } = await supabase
    .from("units")
    .update({ code: newCode })
    .eq("code", oldCode)
    .eq("is_system", false);
  if (error) return { ok: false, error: error.code === "23505" ? "Unit already exists" : error.message };

  revalidatePath("/inventory/units");
  return { ok: true };
}

export async function createUnit(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { ok: false, error: "Admin only" };

  const parsed = z.object({ code: z.string().trim().min(1).max(20) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("units").insert({ code: parsed.data.code, is_system: false });
  if (error) return { ok: false, error: error.code === "23505" ? "Unit already exists" : error.message };

  revalidatePath("/inventory/units");
  return { ok: true };
}

export async function deleteUnit(code: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { ok: false, error: "Admin only" };

  const supabase = await createClient();

  const [
    { count: itemCount },
    { count: recipeCount },
    { count: prItemCount },
    { count: purchaseUnitCount },
    { count: purchaseReqUnitCount },
  ] = await Promise.all([
    supabase.from("items").select("id", { count: "exact", head: true }).eq("unit", code),
    supabase.from("recipe_items").select("id", { count: "exact", head: true }).eq("unit", code),
    supabase.from("purchase_request_items").select("id", { count: "exact", head: true }).eq("unit", code),
    supabase.from("purchase_items").select("id", { count: "exact", head: true }).eq("unit", code),
    supabase.from("purchase_items").select("id", { count: "exact", head: true }).eq("requested_unit", code),
  ]);

  const usages: string[] = [];
  if (itemCount && itemCount > 0) usages.push(`${itemCount} item(s)`);
  if (recipeCount && recipeCount > 0) usages.push(`${recipeCount} recipe row(s)`);
  if ((prItemCount ?? 0) + (purchaseUnitCount ?? 0) + (purchaseReqUnitCount ?? 0) > 0)
    usages.push("purchase transaction(s)");

  if (usages.length > 0)
    return { ok: false, error: `Cannot delete — unit is used in ${usages.join(", ")}` };

  const { error } = await supabase.from("units").delete().eq("code", code).eq("is_system", false);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/inventory/units");
  return { ok: true };
}
