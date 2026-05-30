"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";

const recipeItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1),
});

const recipeSchema = z.object({
  name: z.string().min(1),
  product_id: z.string().uuid().nullable().optional(),
  yield_qty: z.coerce.number().positive().default(1),
  unit: z.string().min(1).nullable().optional(),
  weight_per_pcs: z.coerce.number().positive().nullable().optional(),
  weight_unit: z.string().min(1).nullable().optional(),
  items: z.array(recipeItemSchema).min(1),
});

type ActionResult = { ok: true } | { ok: false; error: string };

export async function createRecipe(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.RECIPES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = recipeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { name, product_id, yield_qty, unit, weight_per_pcs, weight_unit, items } = parsed.data;

  const supabase = await createClient();

  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({ name, product_id: product_id ?? null, yield_qty, unit: unit ?? null, weight_per_pcs: weight_per_pcs ?? null, weight_unit: weight_unit ?? null, updated_by: profile.id })
    .select("id")
    .single();

  if (error || !recipe) return { ok: false, error: error?.message ?? "Failed to create recipe" };

  const { error: itemsError } = await supabase.from("recipe_items").insert(
    items.map((it) => ({ recipe_id: recipe.id, ...it }))
  );

  if (itemsError) return { ok: false, error: itemsError.message };

  revalidatePath("/recipes");
  return { ok: true };
}

export async function updateRecipe(id: string, raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.RECIPES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = recipeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { name, product_id, yield_qty, unit, weight_per_pcs, weight_unit, items } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase
    .from("recipes")
    .update({ name, product_id: product_id ?? null, yield_qty, unit: unit ?? null, weight_per_pcs: weight_per_pcs ?? null, weight_unit: weight_unit ?? null, updated_by: profile.id })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  await supabase.from("recipe_items").delete().eq("recipe_id", id);

  const { error: itemsError } = await supabase.from("recipe_items").insert(
    items.map((it) => ({ recipe_id: id, ...it }))
  );

  if (itemsError) return { ok: false, error: itemsError.message };

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  return { ok: true };
}

export async function deleteRecipe(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.RECIPES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/recipes");
  return { ok: true };
}
