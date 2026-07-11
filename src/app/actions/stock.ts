"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { convert, convertToItemUnit } from "@/lib/units";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export type StockCountIngredientOption = {
  id: string;
  name: string;
  unit: string;
  type: string;
  on_hand: number;
  category_id: string | null;
  categories: { id: string; name: string } | null;
  last_counted_at: string | null;
};

export type StockCountCategoryOption = {
  id: string;
  name: string;
};

type CompletedCount = {
  count_date: string | null;
  completed_at: string | null;
  stock_count_items: { item_id: string }[];
};

type CountIngredient = Omit<StockCountIngredientOption, "last_counted_at">;

// ─── Manual Stock Adjustment ─────────────────────────────────────────────────

const adjustmentItemSchema = z.object({
  item_id: z.string().uuid(),
  qty: z.coerce.number().positive("Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
});

const createAdjustmentSchema = z.object({
  direction: z.enum(["in", "out"]),
  reason: z.string().min(1, "Reason is required").max(100),
  adjustment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  items: z.array(adjustmentItemSchema).min(1, "Add at least one item"),
});

export async function createStockAdjustment(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.STOCK_WRITE)) return { ok: false, error: "No permission" };

  const parsed = createAdjustmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { direction, reason, adjustment_date, items } = parsed.data;

  // Check for duplicate items
  const itemIds = items.map((i) => i.item_id);
  if (new Set(itemIds).size !== itemIds.length)
    return { ok: false, error: "Duplicate items are not allowed" };

  const supabase = await createClient();

  // Fetch all items at once
  const { data: dbItems } = await supabase
    .from("items")
    .select("id, unit, on_hand, reserved")
    .in("id", itemIds);

  if (!dbItems || dbItems.length !== itemIds.length)
    return { ok: false, error: "One or more items not found" };

  const ledgerType = direction === "in" ? "adjustment_in" : "adjustment_out";

  for (const it of items) {
    const dbItem = dbItems.find((d) => d.id === it.item_id)!;
    const delta = convert(it.qty, it.unit, dbItem.unit) ?? it.qty;
    const signedDelta = direction === "in" ? delta : -delta;
    const newOnHand = Number(dbItem.on_hand) + signedDelta;
    const currentReserved = Number(dbItem.reserved);

    // Insert adjustment record
    const { data: adj, error: adjError } = await supabase
      .from("stock_adjustments")
      .insert({
        item_id: it.item_id,
        direction,
        qty: it.qty,
        unit: it.unit,
        reason: reason.trim(),
        adjustment_date,
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (adjError || !adj) return { ok: false, error: adjError?.message ?? "Failed to save adjustment" };

    await supabase.from("items").update({ on_hand: newOnHand, updated_by: profile.id }).eq("id", it.item_id);

    await supabase.from("stock_ledger").insert({
      item_id: it.item_id,
      type: ledgerType,
      ref_id: adj.id,
      qty_delta: signedDelta,
      on_hand_after: newOnHand,
      reserved_after: currentReserved,
      note: reason.trim(),
      created_by: profile.id,
    });

    // Update local on_hand for subsequent iterations
    dbItem.on_hand = newOnHand;
  }

  revalidatePath("/stock/adjustments");
  revalidatePath("/inventory", "layout");
  return { ok: true };
}

// ─── Stock Count ─────────────────────────────────────────────────────────────

const countTaskItemSchema = z.object({
  item_id: z.string().uuid(),
});

const createCountSchema = z.object({
  note: z.string().max(500).optional(),
  items: z.array(countTaskItemSchema).min(1, "Count must include at least one item"),
});

export async function getStockCountOptions(): Promise<
  | { ok: true; items: StockCountIngredientOption[]; categories: StockCountCategoryOption[] }
  | { ok: false; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.STOCK_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const [{ data: items }, { data: categories }, { data: completedCounts }] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, unit, type, on_hand, category_id, categories(id,name)")
      .is("deleted_at", null)
      .eq("type", "ingredient")
      .order("name"),
    supabase
      .from("categories")
      .select("id, name")
      .eq("type", "ingredient")
      .order("name"),
    supabase
      .from("stock_counts")
      .select("count_date, completed_at, stock_count_items(item_id)")
      .eq("status", "completed")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("count_date", { ascending: false }),
  ]);

  const lastCountedByItem = new Map<string, string>();
  for (const count of ((completedCounts ?? []) as unknown as CompletedCount[])) {
    const timestamp = count.completed_at ?? count.count_date;
    if (!timestamp) continue;
    for (const row of count.stock_count_items ?? []) {
      if (!lastCountedByItem.has(row.item_id)) {
        lastCountedByItem.set(row.item_id, timestamp);
      }
    }
  }

  return {
    ok: true,
    items: ((items ?? []) as unknown as CountIngredient[]).map((item) => ({
      ...item,
      last_counted_at: lastCountedByItem.get(item.id) ?? null,
    })),
    categories: (categories ?? []) as StockCountCategoryOption[],
  };
}

export async function createStockCount(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.STOCK_WRITE)) return { ok: false, error: "No permission" };

  const parsed = createCountSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { note, items } = parsed.data;

  const itemIds = items.map((it) => it.item_id);
  if (new Set(itemIds).size !== itemIds.length) {
    return { ok: false, error: "Duplicate items are not allowed" };
  }

  const supabase = await createClient();

  const { data: dbItems } = await supabase
    .from("items")
    .select("id, unit, on_hand")
    .is("deleted_at", null)
    .in("id", itemIds);

  if (!dbItems || dbItems.length !== itemIds.length) {
    return { ok: false, error: "One or more items are no longer available" };
  }
  const dbItemsById = new Map(dbItems.map((item) => [item.id, item]));
  const orderedDbItems = itemIds.map((id) => dbItemsById.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const { data: count, error: countError } = await supabase
    .from("stock_counts")
    .insert({
      note: note?.trim() || null,
      status: "draft",
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (countError || !count) return { ok: false, error: countError?.message ?? "Failed to create stock count" };

  const { error: itemsError } = await supabase.from("stock_count_items").insert(
    orderedDbItems.map((it) => ({
      count_id: count.id,
      item_id: it.id,
      qty_system: Number(it.on_hand),
      qty_counted: null,
      unit: it.unit,
      note: null,
    }))
  );

  if (itemsError) return { ok: false, error: itemsError.message };

  revalidatePath("/stock/counts");
  return { ok: true, id: count.id };
}

const updateCountSchema = z.object({
  id: z.string().uuid(),
  note: z.string().max(500).optional(),
  items: z.array(
    z.object({
      item_id: z.string().uuid(),
      qty_counted: z.coerce.number().nullable().optional(),
      unit: z.string().min(1),
      unopened_qty: z.coerce.number().nullable().optional(),
      unopened_unit: z.string().min(1).nullable().optional(),
      in_use_qty: z.coerce.number().nullable().optional(),
      in_use_unit: z.string().min(1).nullable().optional(),
      note: z.string().max(300).optional().nullable(),
    })
  ).min(1, "Count must include at least one item"),
});

export async function startStockCount(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.STOCK_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  const { data: count } = await supabase
    .from("stock_counts")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!count) return { ok: false, error: "Stock count not found" };
  if (count.status === "completed") return { ok: false, error: "Completed counts cannot be started again" };

  const { error } = await supabase
    .from("stock_counts")
    .update({
      count_date: new Date().toISOString().slice(0, 10),
      status: "counting",
      started_at: new Date().toISOString(),
      started_by: profile.id,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/stock/counts");
  revalidatePath(`/stock/counts/${id}`);
  return { ok: true, id };
}

export async function saveStockCountDraft(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.STOCK_WRITE)) return { ok: false, error: "No permission" };

  const parsed = updateCountSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, note, items } = parsed.data;

  const supabase = await createClient();
  const { data: count } = await supabase
    .from("stock_counts")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!count) return { ok: false, error: "Stock count not found" };
  if (count.status === "completed") return { ok: false, error: "Completed counts cannot be edited" };

  const { error: countError } = await supabase
    .from("stock_counts")
    .update({ note: note?.trim() || null })
    .eq("id", id);

  if (countError) return { ok: false, error: countError.message };

  for (const it of items) {
    const { error } = await supabase
      .from("stock_count_items")
      .update({
        qty_counted: it.qty_counted ?? null,
        unit: it.unit,
        unopened_qty: it.unopened_qty ?? null,
        unopened_unit: it.unopened_unit ?? null,
        in_use_qty: it.in_use_qty ?? null,
        in_use_unit: it.in_use_unit ?? null,
        note: it.note?.trim() || null,
      })
      .eq("count_id", id)
      .eq("item_id", it.item_id);

    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/stock/counts");
  revalidatePath(`/stock/counts/${id}`);
  return { ok: true, id };
}

export async function finishStockCount(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.STOCK_WRITE)) return { ok: false, error: "No permission" };

  const parsed = updateCountSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, note, items } = parsed.data;

  const hasMissingInput = items.some((it) => it.qty_counted == null);
  if (hasMissingInput) return { ok: false, error: "All items must have a counted quantity before finishing" };

  const supabase = await createClient();

  const { data: count } = await supabase
    .from("stock_counts")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!count) return { ok: false, error: "Stock count not found" };
  if (count.status === "completed") return { ok: false, error: "Stock count is already completed" };

  const saveResult = await saveStockCountDraft({ id, note, items });
  if (!saveResult.ok) return saveResult;

  const { data: countItems } = await supabase
    .from("stock_count_items")
    .select("item_id, qty_system, qty_counted, unit, note")
    .eq("count_id", id);

  if (!countItems || countItems.length === 0) return { ok: false, error: "No items found for this count" };

  const hasMissingSavedQty = countItems.some((it) => it.qty_counted == null);
  if (hasMissingSavedQty) return { ok: false, error: "All items must have a counted quantity before completing" };

  // Apply discrepancies
  for (const it of countItems) {
    if (it.qty_counted == null) continue;

    const { data: dbItem } = await supabase
      .from("items")
      .select("id, unit, on_hand, reserved, purchase_unit, purchase_unit_qty")
      .eq("id", it.item_id)
      .maybeSingle();

    if (!dbItem) continue;

    const convertedQty = convertToItemUnit(Number(it.qty_counted), it.unit, dbItem);
    const newOnHand = convertedQty;
    const discrepancy = newOnHand - Number(dbItem.on_hand);
    const currentReserved = Number(dbItem.reserved);

    await supabase
      .from("items")
      .update({ on_hand: newOnHand, updated_by: profile.id })
      .eq("id", it.item_id);

    await supabase.from("stock_ledger").insert({
      item_id: it.item_id,
      type: "count_adjustment",
      ref_id: id,
      qty_delta: discrepancy,
      on_hand_after: newOnHand,
      reserved_after: currentReserved,
      note: it.note?.trim() || note?.trim() || null,
      created_by: profile.id,
    });
  }

  const { error } = await supabase
    .from("stock_counts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: profile.id,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/stock/counts");
  revalidatePath(`/stock/counts/${id}`);
  revalidatePath("/inventory", "layout");
  return { ok: true, id };
}

export async function completeStockCount(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: countItems } = await supabase
    .from("stock_count_items")
    .select("item_id, qty_counted, unit, unopened_qty, unopened_unit, in_use_qty, in_use_unit, note")
    .eq("count_id", id);

  return finishStockCount({ id, items: countItems ?? [] });
}
