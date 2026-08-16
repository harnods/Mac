"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import type { CostableItem } from "@/lib/cogs";
import { calculateRecipeCostRecursive, type RecipeCostSource } from "@/lib/cogs-server";

const substituteSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1),
});

const recipeItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1),
  substitutes: z.array(substituteSchema).optional().default([]),
});

const recipeSchema = z.object({
  name: z.string().min(1),
  recipe_type: z.enum(["wip", "product"]).default("wip"),
  station: z.enum(["bar", "kitchen"]).nullable().optional(),
  product_id: z.string().uuid().nullable().optional(),
  yield_qty: z.coerce.number().positive().default(1),
  unit: z.string().min(1).nullable().optional(),
  weight_per_pcs: z.coerce.number().positive().nullable().optional(),
  weight_unit: z.string().min(1).nullable().optional(),
  items: z.array(recipeItemSchema).min(1),
});

type ActionResult = { ok: true } | { ok: false; error: string };

const OUTPUT_TAKEN_MESSAGE = "This item is already the output of another recipe — an item can only be produced by one recipe.";

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

/** A recipe's output item must be produced by exactly one recipe. Checks
 * for an existing recipe already pointing at this product_id (other than
 * `excludeRecipeId`, when updating) and returns a friendly error if found. */
async function checkOutputTaken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  excludeRecipeId?: string,
): Promise<{ ok: false; error: string } | null> {
  let query = supabase.from("recipes").select("id").eq("product_id", productId);
  if (excludeRecipeId) query = query.neq("id", excludeRecipeId);
  const { data } = await query.maybeSingle();
  return data ? { ok: false, error: OUTPUT_TAKEN_MESSAGE } : null;
}

type SubstituteEntry = { item_id: string; quantity: number; unit: string };

async function insertSubstitutes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recipeItemRows: { id: string; substitutes: SubstituteEntry[] }[]
) {
  const rows = recipeItemRows.flatMap(({ id, substitutes }) =>
    substitutes.map((s) => ({ recipe_item_id: id, item_id: s.item_id, quantity: s.quantity, unit: s.unit }))
  );
  if (rows.length === 0) return null;
  const { error } = await supabase.from("recipe_item_substitutes").insert(rows);
  return error;
}

export async function createRecipe(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.RECIPES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = recipeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { name, recipe_type, station, yield_qty, unit, weight_per_pcs, weight_unit, items } = parsed.data;
  let { product_id } = parsed.data;

  const supabase = await createClient();

  // Auto-create a product item when creating a product-type recipe with no output item selected
  if (recipe_type === "product" && !product_id) {
    const { data: newProduct, error: productError } = await supabase
      .from("items")
      .insert({ name, type: "product", unit: "pcs", updated_by: profile.id })
      .select("id")
      .single();
    if (productError || !newProduct) return { ok: false, error: productError?.message ?? "Failed to create product item" };
    product_id = newProduct.id;
  }

  if (product_id) {
    const conflictError = await checkOutputTaken(supabase, product_id);
    if (conflictError) return conflictError;
  }

  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({ name, recipe_type, station: station ?? null, product_id: product_id ?? null, yield_qty, unit: unit ?? null, weight_per_pcs: weight_per_pcs ?? null, weight_unit: weight_unit ?? null, updated_by: profile.id })
    .select("id")
    .single();

  if (error || !recipe) return { ok: false, error: isUniqueViolation(error) ? OUTPUT_TAKEN_MESSAGE : (error?.message ?? "Failed to create recipe") };

  const { data: insertedItems, error: itemsError } = await supabase
    .from("recipe_items")
    .insert(items.map(({ substitutes: _, ...it }) => ({ recipe_id: recipe.id, ...it })))
    .select("id");

  if (itemsError || !insertedItems) return { ok: false, error: itemsError?.message ?? "Failed to create recipe items" };

  const subError = await insertSubstitutes(
    supabase,
    insertedItems.map((row, i) => ({ id: row.id, substitutes: items[i].substitutes ?? [] }))
  );
  if (subError) return { ok: false, error: subError.message };

  revalidatePath("/recipes");
  return { ok: true };
}

export async function updateRecipe(id: string, raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.RECIPES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = recipeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { name, recipe_type, station, product_id, yield_qty, unit, weight_per_pcs, weight_unit, items } = parsed.data;

  const supabase = await createClient();

  if (product_id) {
    const conflictError = await checkOutputTaken(supabase, product_id, id);
    if (conflictError) return conflictError;
  }

  const { error } = await supabase
    .from("recipes")
    .update({ name, recipe_type, station: station ?? null, product_id: product_id ?? null, yield_qty, unit: unit ?? null, weight_per_pcs: weight_per_pcs ?? null, weight_unit: weight_unit ?? null, updated_by: profile.id })
    .eq("id", id);

  if (error) return { ok: false, error: isUniqueViolation(error) ? OUTPUT_TAKEN_MESSAGE : error.message };

  // Cascade delete handles recipe_item_substitutes automatically
  await supabase.from("recipe_items").delete().eq("recipe_id", id);

  const { data: insertedItems, error: itemsError } = await supabase
    .from("recipe_items")
    .insert(items.map(({ substitutes: _, ...it }) => ({ recipe_id: id, ...it })))
    .select("id");

  if (itemsError || !insertedItems) return { ok: false, error: itemsError?.message ?? "Failed to update recipe items" };

  const subError = await insertSubstitutes(
    supabase,
    insertedItems.map((row, i) => ({ id: row.id, substitutes: items[i].substitutes ?? [] }))
  );
  if (subError) return { ok: false, error: subError.message };

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

export async function bulkDeleteRecipes(ids: string[]): Promise<ActionResult> {
  if (!ids.length) return { ok: false, error: "No recipes selected" };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.RECIPES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase.from("recipes").delete().in("id", ids);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/recipes");
  return { ok: true };
}

export type RecipeDrawerIngredient = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  cost: number | null;
  source: RecipeCostSource | null;
};

export type RecipeDrawerData = {
  id: string;
  name: string;
  recipeType: "wip" | "product";
  yieldQty: number;
  yieldUnit: string | null;
  productName: string | null;
  ingredients: RecipeDrawerIngredient[];
  totalCost: number;
  hasIncompleteCost: boolean;
  costPerYieldUnit: number;
};

export async function getRecipeDrawerData(recipeId: string): Promise<RecipeDrawerData | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select(
      "id, name, recipe_type, yield_qty, unit, recipe_items(id, quantity, unit, item:items(id, name, unit, type, deleted_at, last_purchase_cost, avg_purchase_cost, default_purchase_cost, default_purchase_cost_unit, purchase_unit, purchase_unit_qty)), product:items!product_id(name, unit)"
    )
    .eq("id", recipeId)
    .maybeSingle();

  if (!data) return null;

  const product = data.product as unknown as { name: string; unit: string } | null;
  const recipeItems = data.recipe_items as unknown as {
    quantity: number;
    unit: string;
    item: (CostableItem & { id: string; name: string; type: string; deleted_at: string | null }) | null;
  }[];

  const cogs = await calculateRecipeCostRecursive(supabase, recipeItems, data.yield_qty);

  return {
    id: data.id,
    name: data.name,
    recipeType: (data as unknown as { recipe_type: string }).recipe_type === "product" ? "product" : "wip",
    yieldQty: data.yield_qty,
    yieldUnit: (data as unknown as { unit: string | null }).unit ?? product?.unit ?? null,
    productName: product?.name ?? null,
    ingredients: recipeItems.map((ri, idx) => ({
      id: ri.item?.id ?? `missing-${idx}`,
      name: ri.item?.name ?? "—",
      quantity: ri.quantity,
      unit: ri.unit,
      cost: cogs.lines[idx].cost,
      source: cogs.lines[idx].source,
    })),
    totalCost: cogs.totalCost,
    hasIncompleteCost: cogs.hasIncompleteCost,
    costPerYieldUnit: cogs.costPerYieldUnit,
  };
}
