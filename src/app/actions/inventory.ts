"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { ITEM_TYPE_CONFIG, type ItemTypeSlug } from "@/lib/item-types";
import { convert } from "@/lib/units";
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
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

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
    .insert({ ...parsed.data, updated_by: profile.id })
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
  const patch: Record<string, unknown> = { ...parsed.data, updated_by: profile.id };

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
  const { name, category_id, product_kind, unit, status, set_products = [] } = parsed.data;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("items")
    .insert({ name, category_id, unit, type: "product", product_kind, status, updated_by: profile.id })
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
  const { name, category_id, product_kind, unit, status, set_products = [] } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase
    .from("items")
    .update({ name, category_id, unit, product_kind, status, updated_by: profile.id })
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

// ─── Bulk import ─────────────────────────────────────────────────────────────

export type ImportRow = {
  name: string;
  category_name?: string;
  unit: string;
};

export type ImportItemsResult =
  | { ok: true; inserted: number; skipped: string[]; created: { categories: string[]; units: string[] } }
  | { ok: false; error: string };

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

  const { data: existing } = await supabase
    .from("items")
    .select("name")
    .eq("type", config.dbType)
    .is("deleted_at", null);
  const existingNames = new Set((existing ?? []).map((i: { name: string }) => i.name.toLowerCase()));

  for (const row of rows) {
    const name = String(row.name ?? "").trim();
    const unit = String(row.unit ?? "").trim();

    if (!name) { skipped.push("(empty name)"); continue; }
    if (!unit) { skipped.push(`${name}: unit is empty`); continue; }
    if (!validUnits.has(unit)) { skipped.push(`${name}: unit "${unit}" could not be created`); continue; }
    if (existingNames.has(name.toLowerCase())) { skipped.push(`${name}: already exists`); continue; }

    let category_id: string | null = defaultCatId;
    if (config.hasCategories && row.category_name?.trim()) {
      category_id = catMap.get(row.category_name.trim().toLowerCase()) ?? defaultCatId;
    }

    const entry: Record<string, unknown> = {
      name,
      type: config.dbType,
      unit,
      updated_by: profile.id,
    };
    if (config.hasCategories) entry.category_id = category_id;

    toInsert.push(entry);
    existingNames.add(name.toLowerCase());
  }

  if (toInsert.length === 0) {
    return { ok: true, inserted: 0, skipped, created: { categories: createdCategories, units: createdUnits } };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("items")
    .insert(toInsert)
    .select("id");

  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath("/inventory", "layout");
  return { ok: true, inserted: (inserted ?? []).length, skipped, created: { categories: createdCategories, units: createdUnits } };
}
