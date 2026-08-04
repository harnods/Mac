"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { ITEM_TYPE_CONFIG, type ItemTypeSlug } from "@/lib/item-types";
import { convert, compatibleUnits } from "@/lib/units";
import { resolveComputedRecipeCost, type ComputedRecipeCost } from "@/lib/cogs-server";
import type { Item } from "@/lib/supabase/types";
import type { UnitCode } from "@/lib/supabase/types";

const UNIT = z.string().min(1);
const ITEM_TYPE = z.enum(["ingredient", "supply", "product", "prep_item"]);
const CAT_TYPE = z.enum(["ingredient", "supply", "product"]);

const itemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  category_id: z.string().uuid().nullable(),
  unit: UNIT,
  type: ITEM_TYPE.default("ingredient"),
  default_purchase_cost: z.coerce.number().nonnegative().nullable().optional(),
  default_purchase_cost_unit: z.string().nullable().optional(),
  purchase_unit: z.string().nullable().optional(),
  purchase_unit_qty: z.coerce.number().positive().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
}).refine(
  (d) =>
    d.default_purchase_cost == null ||
    !d.default_purchase_cost_unit ||
    compatibleUnits(d.unit as UnitCode).includes(d.default_purchase_cost_unit as UnitCode) ||
    (!!d.purchase_unit && d.default_purchase_cost_unit === d.purchase_unit),
  { message: "Default cost unit must be compatible with the item's unit", path: ["default_purchase_cost_unit"] },
).refine(
  (d) => !!d.purchase_unit === !!d.purchase_unit_qty,
  { message: "Purchase unit and its quantity must be set together", path: ["purchase_unit_qty"] },
);

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const unitConversionSchema = z.object({
  item_id: z.string().uuid(),
  from_unit: z.string().trim().min(1, "Unit is required").max(30),
  factor: z.coerce.number().positive("Quantity must be greater than 0"),
  to_unit: z.string().trim().min(1, "Base unit is required").max(30),
});

export async function createItemUnitConversion(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const parsed = unitConversionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { item_id, factor, to_unit } = parsed.data;
  const from_unit = parsed.data.from_unit.toLowerCase();

  if (from_unit === to_unit) {
    return { ok: false, error: "Conversion unit must be different from the base unit" };
  }

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select("id, type, unit")
    .eq("id", item_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!item) return { ok: false, error: "Item not found" };
  if (item.type !== "ingredient") return { ok: false, error: "Unit conversions are only available for ingredients" };
  if (convert(factor, to_unit as UnitCode, item.unit as UnitCode) == null && to_unit !== item.unit) {
    return { ok: false, error: "Base unit must be compatible with the ingredient unit" };
  }

  const { error: unitError } = await supabase
    .from("units")
    .upsert({ code: from_unit, is_system: false }, { onConflict: "code", ignoreDuplicates: true });

  if (unitError) return { ok: false, error: unitError.message };

  const { data, error } = await supabase
    .from("item_unit_conversions")
    .insert({
      item_id,
      from_unit,
      factor,
      to_unit,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: `Conversion for "${from_unit}" already exists` };
    return { ok: false, error: error.message };
  }

  revalidatePath(`/inventory/ingredients/${item_id}`);
  revalidatePath("/inventory", "layout");
  return { ok: true, id: data.id };
}

export async function deleteItemUnitConversion(id: string, itemId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("item_unit_conversions")
    .delete()
    .eq("id", id)
    .eq("item_id", itemId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/inventory/ingredients/${itemId}`);
  revalidatePath("/inventory", "layout");
  return { ok: true };
}

export async function createItem(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .insert({
      ...parsed.data,
      default_purchase_cost: parsed.data.default_purchase_cost ?? null,
      default_purchase_cost_unit: parsed.data.default_purchase_cost != null
        ? (parsed.data.default_purchase_cost_unit ?? parsed.data.unit)
        : null,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory", "layout");
  return { ok: true, id: data.id };
}

export async function updateItem(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();

  // If unit is changing, fetch current values and convert qty + costs
  const patch: Record<string, unknown> = {
    ...parsed.data,
    default_purchase_cost: parsed.data.default_purchase_cost ?? null,
    // Default cost carries its own unit (may differ from the item's unit, e.g.
    // cost entered "per kg" for a gram-based item) — it's independent of the
    // item's own unit and doesn't need converting when that unit changes.
    default_purchase_cost_unit: parsed.data.default_purchase_cost != null
      ? (parsed.data.default_purchase_cost_unit ?? parsed.data.unit)
      : null,
    updated_by: profile.id,
  };

  const { data: current } = await supabase
    .from("items")
    .select("unit, on_hand, reserved, last_purchase_cost, avg_purchase_cost")
    .eq("id", id)
    .maybeSingle();

  if (current && current.unit !== parsed.data.unit) {
    const from = current.unit as UnitCode;
    const to = parsed.data.unit as UnitCode;

    // Quantities: convert forward (e.g. 1000 g → 1 kg)
    const newOnHand = convert(current.on_hand, from, to);
    if (newOnHand != null) patch.on_hand = newOnHand;

    const newReserved = convert(current.reserved, from, to);
    if (newReserved != null) patch.reserved = newReserved;

    // Costs are per-unit, so convert inverse (e.g. Rp 10/g → Rp 10000/kg)
    if (current.last_purchase_cost != null) {
      const newCost = convert(current.last_purchase_cost, to, from);
      if (newCost != null) patch.last_purchase_cost = newCost;
    }
    if (current.avg_purchase_cost != null) {
      const newAvg = convert(current.avg_purchase_cost, to, from);
      if (newAvg != null) patch.avg_purchase_cost = newAvg;
    }
  }

  const { error } = await supabase.from("items").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory", "layout");
  return { ok: true };
}

export async function deleteItem(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  // Soft-delete: preserve references in purchases, recipes, purchase requests
  const { error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory", "layout");
  return { ok: true };
}

export type ItemFormData = {
  categories: { id: string; name: string }[];
  units: string[];
  item: Item | null;
  unitLocked: boolean;
};

export async function getItemFormData(itemTypeSlug: string, itemId?: string): Promise<ItemFormData | null> {
  const profile = await getCurrentProfile();
  if (!can(profile, P.INVENTORY_WRITE)) return null;

  const config = ITEM_TYPE_CONFIG[itemTypeSlug as ItemTypeSlug];
  if (!config) return null;

  const supabase = await createClient();

  const [categoryResult, unitResult] = await Promise.all([
    config.hasCategories
      ? supabase.from("categories").select("id,name").eq("type", config.dbType).order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.from("units").select("code").order("is_system", { ascending: false }).order("code"),
  ]);

  const categories = (categoryResult.data ?? []) as { id: string; name: string }[];
  const units = (unitResult.data ?? []).map((u: { code: string }) => u.code);

  if (!itemId) return { categories, units, item: null, unitLocked: false };

  const [itemResult, r1, r2, r3] = await Promise.all([
    supabase.from("items").select("*").eq("id", itemId).is("deleted_at", null).maybeSingle(),
    supabase.from("purchase_items").select("id", { count: "exact", head: true }).eq("item_id", itemId),
    supabase.from("purchase_request_items").select("id", { count: "exact", head: true }).eq("item_id", itemId),
    supabase.from("recipe_items").select("id", { count: "exact", head: true }).eq("item_id", itemId),
  ]);

  const item = (itemResult.data ?? null) as Item | null;
  const unitLocked = [r1, r2, r3].some((r) => (r.count ?? 0) > 0);

  return { categories, units, item, unitLocked };
}

const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: CAT_TYPE.default("ingredient"),
});

export async function createCategory(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: parsed.data.name, type: parsed.data.type, updated_by: profile.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory", "layout");
  return { ok: true, id: data.id };
}

export async function updateCategory(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ name: parsed.data.name, updated_by: profile.id })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory", "layout");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  const { data: cat } = await supabase
    .from("categories")
    .select("is_default")
    .eq("id", id)
    .maybeSingle();

  if (cat?.is_default) return { ok: false, error: "Cannot delete the default category." };

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory", "layout");
  return { ok: true };
}

// ─── Product-specific (ala carte / set) ──────────────────────────────────────

const productSchema = z.object({
  name: z.string().trim().max(120).default(""),
  category_id: z.string().uuid().nullable().optional(),
  product_kind: z.enum(["ala_carte", "set"]).default("ala_carte"),
  unit: z.string().default("pcs"),
  status: z.enum(["active", "draft"]).default("active"),
  is_sellable: z.boolean().default(false),
  sell_price: z.coerce.number().nonnegative().nullable().optional(),
  is_addon: z.boolean().default(false),
  image_url: z.string().url().nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  set_products: z.array(z.object({ id: z.string().uuid(), qty: z.coerce.number().positive() })).optional(),
}).refine(
  (d) => d.status === "draft" || d.name.length > 0,
  { message: "Name is required", path: ["name"] }
);

export type SetProductEntry = { id: string; qty: number };

export type ProductFormData = {
  categories: { id: string; name: string }[];
  units: string[];
  products: { id: string; name: string; itemType?: string }[];
  item: Item | null;
  setProducts: SetProductEntry[];
  unitLocked: boolean;
};

export async function getProductFormData(itemId?: string): Promise<ProductFormData | null> {
  const profile = await getCurrentProfile();
  if (!can(profile, P.INVENTORY_WRITE)) return null;

  const supabase = await createClient();

  const [categoryResult, unitResult, productResult, sellablePrepResult] = await Promise.all([
    supabase.from("categories").select("id,name").eq("type", "product").order("name"),
    supabase.from("units").select("code").order("is_system", { ascending: false }).order("code"),
    supabase.from("items").select("id,name").eq("type", "product").is("deleted_at", null).order("name"),
    supabase.from("items").select("id,name").eq("type", "prep_item").eq("is_sellable", true).is("deleted_at", null).order("name"),
  ]);

  const categories = (categoryResult.data ?? []) as { id: string; name: string }[];
  const units = (unitResult.data ?? []).map((u: { code: string }) => u.code);
  const products = [
    ...(productResult.data ?? []).map((p: { id: string; name: string }) => ({ ...p, itemType: "product" as const })),
    ...(sellablePrepResult.data ?? []).map((p: { id: string; name: string }) => ({ ...p, itemType: "prep_item" as const })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  if (!itemId) return { categories, units, products, item: null, setProducts: [], unitLocked: false };

  const [itemResult, setItemsResult, r1] = await Promise.all([
    supabase.from("items").select("*").eq("id", itemId).maybeSingle(),
    supabase.from("product_set_items").select("product_id, qty").eq("set_id", itemId),
    supabase.from("purchase_items").select("id", { count: "exact", head: true }).eq("item_id", itemId),
  ]);

  const item = (itemResult.data ?? null) as Item | null;
  const setProducts: SetProductEntry[] = (setItemsResult.data ?? []).map(
    (r: { product_id: string; qty: number }) => ({ id: r.product_id, qty: r.qty })
  );
  const unitLocked = (r1.count ?? 0) > 0;

  // Exclude self from available products (can't be inside its own set)
  const filteredProducts = products.filter((p) => p.id !== itemId);

  return { categories, units, products: filteredProducts, item, setProducts, unitLocked };
}

export async function createProductItem(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { name, category_id, product_kind, unit, status, is_sellable, sell_price, is_addon, image_url, description, set_products = [] } = parsed.data;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("items")
    .insert({ name, category_id, unit, type: "product", product_kind, status, is_sellable, sell_price: sell_price ?? null, is_addon, image_url: image_url ?? null, description: description || null, updated_by: profile.id })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Failed to create product" };

  if (product_kind === "set" && set_products.length > 0) {
    const { error: setError } = await supabase
      .from("product_set_items")
      .insert(set_products.map((p) => ({ set_id: data.id, product_id: p.id, qty: p.qty })));
    if (setError) return { ok: false, error: setError.message };
  }

  revalidatePath("/inventory", "layout");
  return { ok: true, id: data.id };
}

export async function updateProductItem(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { name, category_id, product_kind, unit, status, is_sellable, sell_price, is_addon, image_url, description, set_products = [] } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase
    .from("items")
    .update({ name, category_id, unit, product_kind, status, is_sellable, sell_price: sell_price ?? null, is_addon, image_url: image_url ?? null, description: description || null, updated_by: profile.id })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  // Replace set items
  await supabase.from("product_set_items").delete().eq("set_id", id);
  if (product_kind === "set" && set_products.length > 0) {
    const { error: setError } = await supabase
      .from("product_set_items")
      .insert(set_products.map((p) => ({ set_id: id, product_id: p.id, qty: p.qty })));
    if (setError) return { ok: false, error: setError.message };
  }

  revalidatePath("/inventory", "layout");
  return { ok: true };
}

export async function setProductStatus(id: string, status: "active" | "draft"): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .update({ status, updated_by: profile.id })
    .eq("id", id)
    .eq("type", "product");

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory", "layout");
  return { ok: true };
}

export async function setItemSellable(id: string, is_sellable: boolean): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .update({ is_sellable, updated_by: profile.id })
    .eq("id", id)
    .eq("type", "prep_item");

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory", "layout");
  return { ok: true };
}

// ─── Product drawer ───────────────────────────────────────────────────────────

export type ProductDrawerData = {
  id: string;
  name: string;
  unit: string;
  status: string | null;
  category: string | null;
  recipe: {
    id: string;
    name: string;
    items: { id: string; name: string; quantity: number; unit: string }[];
  } | null;
};

export async function getProductDrawerData(productId: string): Promise<ProductDrawerData | null> {
  const supabase = await createClient();

  const [{ data: item }, { data: recipe }] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, unit, status, categories(name)")
      .eq("id", productId)
      .eq("type", "product")
      .maybeSingle(),
    supabase
      .from("recipes")
      .select("id, name, recipe_items(id, quantity, unit, item:items!item_id(id, name))")
      .eq("product_id", productId)
      .eq("recipe_type", "product")
      .maybeSingle(),
  ]);

  if (!item) return null;

  return {
    id: item.id,
    name: item.name,
    unit: item.unit,
    status: (item as unknown as { status?: string }).status ?? null,
    category: (item as unknown as { categories?: { name: string } | null }).categories?.name ?? null,
    recipe: recipe
      ? {
          id: recipe.id,
          name: recipe.name,
          items: (recipe.recipe_items as unknown as { id: string; quantity: number; unit: string; item: { id: string; name: string } | null }[])
            .filter((ri) => ri.item)
            .map((ri) => ({ id: ri.id, name: ri.item!.name, quantity: ri.quantity, unit: ri.unit })),
        }
      : null,
  };
}

export type IngredientDrawerData = {
  id: string;
  name: string;
  type: string;
  unit: string;
  category: string | null;
  on_hand: number;
  reserved: number;
  available: number;
  stockMode: "full" | "available" | "none";
  itemPageUrl: string;
  last_purchase_cost: number | null;
  avg_purchase_cost: number | null;
  default_purchase_cost: number | null;
  default_purchase_cost_unit: string | null;
  purchase_unit: string | null;
  purchase_unit_qty: number | null;
  computedCost: ComputedRecipeCost | null;
  usedInRecipes: { id: string; name: string; quantity: number; unit: string }[];
  producedByRecipe: { id: string; name: string } | null;
};

export async function getIngredientDrawerData(itemId: string): Promise<IngredientDrawerData | null> {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select("id, name, type, unit, on_hand, reserved, categories(name), last_purchase_cost, avg_purchase_cost, default_purchase_cost, default_purchase_cost_unit, purchase_unit, purchase_unit_qty")
    .eq("id", itemId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!item) return null;

  const typeToSlug: Record<string, string> = {
    ingredient: "ingredients",
    supply: "supplies",
    product: "products",
    prep_item: "prep-items",
  };
  const typeToLabel: Record<string, string> = {
    ingredient: "Ingredient",
    supply: "Supply",
    product: "Product",
    prep_item: "Prep item",
  };
  const stockMode: Record<string, "full" | "available" | "none"> = {
    ingredient: "full",
    supply: "available",
    prep_item: "available",
    product: "none",
  };

  const slug = typeToSlug[item.type] ?? "ingredients";
  const onHand = Number(item.on_hand);
  const reserved = Number(item.reserved);

  const hasDirectCost = item.avg_purchase_cost != null || item.last_purchase_cost != null || item.default_purchase_cost != null;
  const computedCost = item.type === "prep_item" && !hasDirectCost
    ? await resolveComputedRecipeCost(supabase, item.id, item.unit)
    : null;

  const { data: usages } = await supabase
    .from("recipe_items")
    .select("quantity, unit, recipe:recipes(id, name)")
    .eq("item_id", item.id);
  const usedInRecipes = ((usages ?? []) as unknown as { quantity: number; unit: string; recipe: { id: string; name: string } | null }[])
    .filter((u) => u.recipe)
    .map((u) => ({ id: u.recipe!.id, name: u.recipe!.name, quantity: u.quantity, unit: u.unit }));

  let producedByRecipe: { id: string; name: string } | null = null;
  if (item.type === "prep_item") {
    const { data: producingRecipe } = await supabase
      .from("recipes")
      .select("id, name")
      .eq("product_id", item.id)
      .maybeSingle();
    producedByRecipe = producingRecipe ?? null;
  }

  return {
    id: item.id,
    name: item.name,
    type: typeToLabel[item.type] ?? item.type,
    unit: item.unit,
    category: (item as unknown as { categories?: { name: string } | null }).categories?.name ?? null,
    on_hand: onHand,
    reserved,
    available: onHand - reserved,
    stockMode: stockMode[item.type] ?? "none",
    itemPageUrl: `/inventory/${slug}/${item.id}`,
    last_purchase_cost: item.last_purchase_cost,
    avg_purchase_cost: item.avg_purchase_cost,
    default_purchase_cost: item.default_purchase_cost,
    default_purchase_cost_unit: item.default_purchase_cost_unit,
    purchase_unit: item.purchase_unit,
    purchase_unit_qty: item.purchase_unit_qty,
    computedCost,
    usedInRecipes,
    producedByRecipe,
  };
}

// ─── Bulk select actions ──────────────────────────────────────────────────────

export async function bulkDeleteItems(ids: string[]): Promise<ActionResult> {
  if (!ids.length) return { ok: false, error: "No items selected" };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString(), updated_by: profile.id })
    .in("id", ids);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory", "layout");
  return { ok: true };
}

export type BulkItemPatch = {
  category_id?: string | null;
  status?: "active" | "draft";
};

export async function bulkUpdateItems(ids: string[], patch: BulkItemPatch): Promise<ActionResult> {
  if (!ids.length) return { ok: false, error: "No items selected" };
  if (!Object.keys(patch).length) return { ok: false, error: "No fields to update" };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .update({ ...patch, updated_by: profile.id })
    .in("id", ids);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory", "layout");
  return { ok: true };
}

// ─── Bulk import ─────────────────────────────────────────────────────────────

export type ConflictResolution = "skip" | "overwrite" | "add_new";

export type ImportRow = {
  name: string;
  category_name?: string;
  unit: string;
  resolution?: ConflictResolution; // only set for rows that conflict
};

export type ImportItemsResult =
  | { ok: true; inserted: number; updated: number; skipped: string[]; created: { categories: string[]; units: string[] } }
  | { ok: false; error: string };

export async function getExistingItemNames(itemTypeSlug: string): Promise<string[]> {
  const profile = await getCurrentProfile();
  if (!can(profile, P.INVENTORY_WRITE)) return [];

  const config = ITEM_TYPE_CONFIG[itemTypeSlug as ItemTypeSlug];
  if (!config) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("name")
    .eq("type", config.dbType)
    .is("deleted_at", null);

  return (data ?? []).map((i: { name: string }) => i.name);
}

export async function importItems(
  itemTypeSlug: string,
  rows: ImportRow[]
): Promise<ImportItemsResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const config = ITEM_TYPE_CONFIG[itemTypeSlug as ItemTypeSlug];
  if (!config) return { ok: false, error: "Invalid item type" };

  if (rows.length === 0) return { ok: false, error: "No rows to import" };
  if (rows.length > 500) return { ok: false, error: "Maximum 500 rows per import" };

  const supabase = await createClient();

  // ── Categories ────────────────────────────────────────────────────────────
  let defaultCatId: string | null = null;
  const catMap = new Map<string, string>(); // lowercase name → id
  const createdCategories: string[] = [];

  if (config.hasCategories) {
    const { data: cats } = await supabase
      .from("categories")
      .select("id,name,is_default")
      .eq("type", config.dbType);

    for (const c of cats ?? []) {
      catMap.set(c.name.toLowerCase(), c.id);
      if (c.is_default) defaultCatId = c.id;
    }

    // Auto-create missing categories
    const neededCats = new Set(
      rows
        .map((r) => r.category_name?.trim())
        .filter((n): n is string => !!n && !catMap.has(n.toLowerCase()))
    );
    for (const catName of neededCats) {
      const { data, error } = await supabase
        .from("categories")
        .insert({ name: catName, type: config.dbType, updated_by: profile.id })
        .select("id")
        .single();
      if (!error && data) {
        catMap.set(catName.toLowerCase(), data.id);
        createdCategories.push(catName);
      }
    }
  }

  // ── Units ────────────────────────────────────────────────────────────────
  const { data: unitData } = await supabase.from("units").select("code");
  const validUnits = new Set((unitData ?? []).map((u: { code: string }) => u.code));
  const createdUnits: string[] = [];

  const neededUnits = new Set(
    rows.map((r) => r.unit?.trim()).filter((u): u is string => !!u && !validUnits.has(u))
  );
  for (const code of neededUnits) {
    const { error } = await supabase.from("units").insert({ code, is_system: false });
    if (!error) {
      validUnits.add(code);
      createdUnits.push(code);
    }
  }

  // ── Items ─────────────────────────────────────────────────────────────────
  const skipped: string[] = [];
  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; patch: Record<string, unknown> }[] = [];

  const { data: existing } = await supabase
    .from("items")
    .select("id,name")
    .eq("type", config.dbType)
    .is("deleted_at", null);

  // name (lowercase) → id
  const existingMap = new Map((existing ?? []).map((i: { id: string; name: string }) => [i.name.toLowerCase(), i.id]));
  // track all names including ones we're about to insert (avoid intra-batch dupes)
  const seenNames = new Set(existingMap.keys());

  // helper: find a free name with numeric suffix "(1)", "(2)", ...
  const findFreeName = (base: string): string => {
    let n = 1;
    let candidate = `${base} (${n})`;
    while (seenNames.has(candidate.toLowerCase())) {
      n++;
      candidate = `${base} (${n})`;
    }
    return candidate;
  };

  for (const row of rows) {
    const name = String(row.name ?? "").trim();
    const unit = String(row.unit ?? "").trim();

    if (!name) { skipped.push("(empty name)"); continue; }
    if (!unit) { skipped.push(`${name}: unit is empty`); continue; }
    if (!validUnits.has(unit)) { skipped.push(`${name}: unit "${unit}" could not be created`); continue; }

    let category_id: string | null = defaultCatId;
    if (config.hasCategories && row.category_name?.trim()) {
      category_id = catMap.get(row.category_name.trim().toLowerCase()) ?? defaultCatId;
    }

    const patch: Record<string, unknown> = { unit, updated_by: profile.id };
    if (config.hasCategories) patch.category_id = category_id;

    const isConflict = existingMap.has(name.toLowerCase());

    if (isConflict) {
      const resolution = row.resolution ?? "skip";

      if (resolution === "skip") {
        skipped.push(`${name}: skipped`);
        continue;
      }

      if (resolution === "overwrite") {
        const existingId = existingMap.get(name.toLowerCase())!;
        toUpdate.push({ id: existingId, patch: { ...patch, name } });
        continue;
      }

      if (resolution === "add_new") {
        const newName = findFreeName(name);
        toInsert.push({ name: newName, type: config.dbType, ...patch });
        seenNames.add(newName.toLowerCase());
        continue;
      }
    }

    // No conflict — insert normally
    toInsert.push({ name, type: config.dbType, ...patch });
    seenNames.add(name.toLowerCase());
  }

  // Batch insert new items
  let insertedCount = 0;
  if (toInsert.length > 0) {
    const { data: ins, error: insertError } = await supabase
      .from("items")
      .insert(toInsert)
      .select("id");
    if (insertError) return { ok: false, error: insertError.message };
    insertedCount = (ins ?? []).length;
  }

  // Update overwritten items one-by-one (different patches per row)
  let updatedCount = 0;
  for (const { id, patch } of toUpdate) {
    const { error } = await supabase.from("items").update(patch).eq("id", id);
    if (!error) updatedCount++;
  }

  revalidatePath("/inventory", "layout");
  return { ok: true, inserted: insertedCount, updated: updatedCount, skipped, created: { categories: createdCategories, units: createdUnits } };
}
