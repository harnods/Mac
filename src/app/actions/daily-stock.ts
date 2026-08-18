"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

/** The business day runs on Jakarta time, same as receipts and reports. */
const TZ_OFFSET = "+07:00";

function dayWindow(date: string) {
  const from = new Date(`${date}T00:00:00${TZ_OFFSET}`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export type DailyCountItemOption = {
  id: string;
  name: string;
  brand: string | null;
  unit: string;
  type: string;
  on_hand: number;
  category_id: string | null;
  categories: { id: string; name: string } | null;
};

export type DailyCountCategoryOption = { id: string; name: string };

/** Item types a daily reconciliation covers — consumables only. */
const DAILY_COUNT_TYPES = ["ingredient", "prep_item"];

export async function getDailyCountOptions(): Promise<
  | { ok: true; items: DailyCountItemOption[]; categories: DailyCountCategoryOption[] }
  | { ok: false; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.DAILY_STOCK_COUNTS_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const [{ data: items }, { data: categories }] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, brand, unit, type, on_hand, category_id, categories(id,name)")
      .is("deleted_at", null)
      .in("type", DAILY_COUNT_TYPES)
      .order("name"),
    supabase
      .from("categories")
      .select("id, name")
      .in("type", DAILY_COUNT_TYPES)
      .order("name"),
  ]);

  return {
    ok: true,
    items: (items ?? []) as unknown as DailyCountItemOption[],
    categories: (categories ?? []) as DailyCountCategoryOption[],
  };
}

/**
 * Theoretical usage per item for a business day: the `sales_consumption`
 * ledger rows behind that day's sales entries (nightly recap and POS bills
 * both write one). Recorded as a positive "sold" quantity in the item's unit.
 */
async function soldQtyByItem(
  supabase: SupabaseClient,
  date: string,
  itemIds: string[],
): Promise<Map<string, number>> {
  const sold = new Map<string, number>();
  if (itemIds.length === 0) return sold;

  const { data: entries } = await supabase
    .from("sales_entries")
    .select("id")
    .eq("entry_date", date);

  const entryIds = ((entries ?? []) as { id: string }[]).map((e) => e.id);
  if (entryIds.length === 0) return sold;

  const { data: rows } = await supabase
    .from("stock_ledger")
    .select("item_id, qty_delta")
    .eq("type", "sales_consumption")
    .in("ref_id", entryIds)
    .in("item_id", itemIds);

  for (const row of (rows ?? []) as { item_id: string; qty_delta: number }[]) {
    // Consumption is stored as a negative delta.
    sold.set(row.item_id, (sold.get(row.item_id) ?? 0) - Number(row.qty_delta));
  }
  return sold;
}

/**
 * On-hand at the start of the business day. Taken from the first ledger row of
 * that day (`on_hand_after - qty_delta`); items with no movement that day are
 * still at their current on-hand.
 */
async function openingQtyByItem(
  supabase: SupabaseClient,
  date: string,
  onHandNow: Map<string, number>,
): Promise<Map<string, number>> {
  const itemIds = [...onHandNow.keys()];
  const opening = new Map(onHandNow);
  if (itemIds.length === 0) return opening;

  const { from, to } = dayWindow(date);
  const { data: rows } = await supabase
    .from("stock_ledger")
    .select("item_id, qty_delta, on_hand_after, created_at")
    .in("item_id", itemIds)
    .gte("created_at", from)
    .lt("created_at", to)
    .order("created_at", { ascending: true });

  const seen = new Set<string>();
  for (const row of (rows ?? []) as { item_id: string; qty_delta: number; on_hand_after: number }[]) {
    if (seen.has(row.item_id)) continue;
    seen.add(row.item_id);
    opening.set(row.item_id, Number(row.on_hand_after) - Number(row.qty_delta));
  }
  return opening;
}

const dailyItemSchema = z.object({ item_id: z.string().uuid() });

const createDailyCountSchema = z.object({
  count_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  note: z.string().max(500).optional(),
  items: z.array(dailyItemSchema).min(1, "Select at least one item to count"),
});

/** Build the count-item rows for a set of items on a given date. */
async function buildCountItemRows(
  supabase: SupabaseClient,
  countId: string,
  date: string,
  itemIds: string[],
) {
  const { data: dbItems } = await supabase
    .from("items")
    .select("id, unit, on_hand")
    .is("deleted_at", null)
    .in("type", DAILY_COUNT_TYPES)
    .in("id", itemIds);

  const rows = (dbItems ?? []) as { id: string; unit: string; on_hand: number }[];
  if (rows.length !== itemIds.length) return null;

  const onHandNow = new Map(rows.map((it) => [it.id, Number(it.on_hand)]));
  const [opening, sold] = await Promise.all([
    openingQtyByItem(supabase, date, onHandNow),
    soldQtyByItem(supabase, date, itemIds),
  ]);

  const byId = new Map(rows.map((it) => [it.id, it]));
  return itemIds.map((id) => {
    const it = byId.get(id)!;
    return {
      count_id: countId,
      item_id: it.id,
      unit: it.unit,
      opening_qty: opening.get(it.id) ?? Number(it.on_hand),
      sold_qty: sold.get(it.id) ?? 0,
      received_qty: null,
      rnd_qty: null,
      waste_qty: null,
      counted_qty: null,
      variance_note: null,
    };
  });
}

export async function createDailyStockCount(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.DAILY_STOCK_COUNTS_WRITE)) return { ok: false, error: "No permission" };

  const parsed = createDailyCountSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { count_date, note, items } = parsed.data;

  const itemIds = items.map((it) => it.item_id);
  if (new Set(itemIds).size !== itemIds.length) {
    return { ok: false, error: "Duplicate items are not allowed" };
  }

  const supabase = await createClient();

  const { data: count, error: countError } = await supabase
    .from("daily_stock_counts")
    .insert({
      count_date,
      note: note?.trim() || null,
      status: "draft",
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (countError || !count) {
    return { ok: false, error: countError?.message ?? "Failed to create daily stock count" };
  }

  const rows = await buildCountItemRows(supabase, count.id, count_date, itemIds);
  if (!rows) {
    await supabase.from("daily_stock_counts").delete().eq("id", count.id);
    return { ok: false, error: "One or more selected items are no longer available" };
  }

  const { error: itemsError } = await supabase.from("daily_stock_count_items").insert(rows);
  if (itemsError) {
    await supabase.from("daily_stock_counts").delete().eq("id", count.id);
    return { ok: false, error: itemsError.message };
  }

  revalidatePath("/stock/daily-counts");
  return { ok: true, id: count.id };
}

export type AddedDailyCountItem = {
  id: string;
  item_id: string;
  unit: string;
  opening_qty: number;
  received_qty: number | null;
  sold_qty: number;
  rnd_qty: number | null;
  waste_qty: number | null;
  counted_qty: number | null;
  variance_note: string | null;
  item: { name: string; brand: string | null; type: string; unit: string } | null;
};

const ITEM_SELECT = `
  id, item_id, unit, opening_qty, received_qty, sold_qty, rnd_qty, waste_qty, counted_qty, variance_note,
  item:items(name, brand, type, unit)
`;

const addDailyItemsSchema = z.object({
  id: z.string().uuid(),
  items: z.array(dailyItemSchema).min(1, "Select at least one item to add"),
});

/** Add more items to a daily count that is still open. */
export async function addDailyStockCountItems(
  raw: unknown,
): Promise<{ ok: true; items: AddedDailyCountItem[] } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.DAILY_STOCK_COUNTS_WRITE)) return { ok: false, error: "No permission" };

  const parsed = addDailyItemsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, items } = parsed.data;
  const itemIds = [...new Set(items.map((it) => it.item_id))];

  const supabase = await createClient();
  const { data: count } = await supabase
    .from("daily_stock_counts")
    .select("id, status, count_date")
    .eq("id", id)
    .maybeSingle();

  if (!count) return { ok: false, error: "Daily stock count not found" };
  if (count.status === "completed") return { ok: false, error: "Completed counts cannot be edited" };

  const { data: existing } = await supabase
    .from("daily_stock_count_items")
    .select("item_id")
    .eq("count_id", id)
    .in("item_id", itemIds);

  if (existing && existing.length > 0) {
    return { ok: false, error: "Some of the selected items are already in this count" };
  }

  const rows = await buildCountItemRows(supabase, id, count.count_date as string, itemIds);
  if (!rows) return { ok: false, error: "One or more selected items are no longer available" };

  const { data: inserted, error } = await supabase
    .from("daily_stock_count_items")
    .insert(rows)
    .select(ITEM_SELECT);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/stock/daily-counts/${id}`);
  return { ok: true, items: (inserted ?? []) as unknown as AddedDailyCountItem[] };
}

export async function startDailyStockCount(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.DAILY_STOCK_COUNTS_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { data: count } = await supabase
    .from("daily_stock_counts")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!count) return { ok: false, error: "Daily stock count not found" };
  if (count.status === "completed") return { ok: false, error: "Completed counts cannot be started again" };

  const { error } = await supabase
    .from("daily_stock_counts")
    .update({ status: "counting", started_at: new Date().toISOString(), started_by: profile.id })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/stock/daily-counts");
  revalidatePath(`/stock/daily-counts/${id}`);
  return { ok: true, id };
}

const updateDailyCountSchema = z.object({
  id: z.string().uuid(),
  note: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        received_qty: z.coerce.number().nullable().optional(),
        rnd_qty: z.coerce.number().nullable().optional(),
        waste_qty: z.coerce.number().nullable().optional(),
        counted_qty: z.coerce.number().nullable().optional(),
        variance_note: z.string().max(300).nullable().optional(),
      }),
    )
    .min(1, "Count must include at least one item"),
});

export async function saveDailyStockCountDraft(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.DAILY_STOCK_COUNTS_WRITE)) return { ok: false, error: "No permission" };

  const parsed = updateDailyCountSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, note, items } = parsed.data;

  const supabase = await createClient();
  const { data: count } = await supabase
    .from("daily_stock_counts")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!count) return { ok: false, error: "Daily stock count not found" };
  if (count.status === "completed") return { ok: false, error: "Completed counts cannot be edited" };

  const { error: countError } = await supabase
    .from("daily_stock_counts")
    .update({ note: note?.trim() || null })
    .eq("id", id);

  if (countError) return { ok: false, error: countError.message };

  for (const it of items) {
    const { error } = await supabase
      .from("daily_stock_count_items")
      .update({
        received_qty: it.received_qty ?? null,
        rnd_qty: it.rnd_qty ?? null,
        waste_qty: it.waste_qty ?? null,
        counted_qty: it.counted_qty ?? null,
        variance_note: it.variance_note?.trim() || null,
      })
      .eq("count_id", id)
      .eq("item_id", it.item_id);

    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/stock/daily-counts");
  revalidatePath(`/stock/daily-counts/${id}`);
  return { ok: true, id };
}

/** Re-pull today's sold quantities — sales recorded after the count was created. */
export async function refreshDailySoldQty(
  id: string,
): Promise<{ ok: true; sold: Record<string, number> } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.DAILY_STOCK_COUNTS_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { data: count } = await supabase
    .from("daily_stock_counts")
    .select("id, status, count_date")
    .eq("id", id)
    .maybeSingle();

  if (!count) return { ok: false, error: "Daily stock count not found" };
  if (count.status === "completed") return { ok: false, error: "Completed counts cannot be edited" };

  const { data: rows } = await supabase
    .from("daily_stock_count_items")
    .select("item_id")
    .eq("count_id", id);

  const itemIds = ((rows ?? []) as { item_id: string }[]).map((r) => r.item_id);
  const sold = await soldQtyByItem(supabase, count.count_date as string, itemIds);

  for (const itemId of itemIds) {
    const { error } = await supabase
      .from("daily_stock_count_items")
      .update({ sold_qty: sold.get(itemId) ?? 0 })
      .eq("count_id", id)
      .eq("item_id", itemId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/stock/daily-counts/${id}`);
  return { ok: true, sold: Object.fromEntries(itemIds.map((i) => [i, sold.get(i) ?? 0])) };
}

export async function finishDailyStockCount(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.DAILY_STOCK_COUNTS_WRITE)) return { ok: false, error: "No permission" };

  const parsed = updateDailyCountSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, note, items } = parsed.data;

  if (items.some((it) => it.counted_qty == null)) {
    return { ok: false, error: "All items must have a counted quantity before finishing" };
  }

  const supabase = await createClient();
  const { data: count } = await supabase
    .from("daily_stock_counts")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!count) return { ok: false, error: "Daily stock count not found" };
  if (count.status === "completed") return { ok: false, error: "Daily stock count is already completed" };

  const saveResult = await saveDailyStockCountDraft({ id, note, items });
  if (!saveResult.ok) return saveResult;

  const { data: countItems } = await supabase
    .from("daily_stock_count_items")
    .select("item_id, counted_qty, variance_note")
    .eq("count_id", id);

  const saved = (countItems ?? []) as {
    item_id: string;
    counted_qty: number | null;
    variance_note: string | null;
  }[];

  if (saved.length === 0) return { ok: false, error: "No items found for this count" };
  if (saved.some((it) => it.counted_qty == null)) {
    return { ok: false, error: "All items must have a counted quantity before completing" };
  }

  // The counted quantity becomes the new on hand, same as a cycle count.
  for (const it of saved) {
    const { data: dbItem } = await supabase
      .from("items")
      .select("id, on_hand, reserved")
      .eq("id", it.item_id)
      .maybeSingle();

    if (!dbItem) continue;

    const newOnHand = Number(it.counted_qty);
    const discrepancy = newOnHand - Number(dbItem.on_hand);

    await supabase
      .from("items")
      .update({ on_hand: newOnHand, updated_by: profile.id })
      .eq("id", it.item_id);

    await supabase.from("stock_ledger").insert({
      item_id: it.item_id,
      type: "daily_count_adjustment",
      ref_id: id,
      qty_delta: discrepancy,
      on_hand_after: newOnHand,
      reserved_after: Number(dbItem.reserved),
      note: it.variance_note?.trim() || note?.trim() || null,
      created_by: profile.id,
    });
  }

  const { error } = await supabase
    .from("daily_stock_counts")
    .update({ status: "completed", completed_at: new Date().toISOString(), completed_by: profile.id })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/stock/daily-counts");
  revalidatePath(`/stock/daily-counts/${id}`);
  revalidatePath("/inventory", "layout");
  return { ok: true, id };
}

/** Only counts that haven't adjusted stock yet can be deleted. */
export async function deleteDailyStockCount(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.DAILY_STOCK_COUNTS_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { data: count } = await supabase
    .from("daily_stock_counts")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!count) return { ok: false, error: "Daily stock count not found" };
  if (count.status === "completed") {
    return { ok: false, error: "Completed counts can't be deleted (they've already adjusted stock)." };
  }

  const { error } = await supabase.from("daily_stock_counts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/stock/daily-counts");
  return { ok: true };
}
