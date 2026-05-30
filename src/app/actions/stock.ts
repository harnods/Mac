"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { convert } from "@/lib/units";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

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

const countItemSchema = z.object({
  item_id: z.string().uuid(),
  qty_system: z.coerce.number(),
  qty_counted: z.coerce.number().nullable().optional(),
  unit: z.string().min(1),
  note: z.string().max(300).optional().nullable(),
});

const createCountSchema = z.object({
  count_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  note: z.string().max(500).optional(),
  items: z.array(countItemSchema).min(1, "Count must include at least one item"),
  complete: z.boolean().optional(),
});

export async function createStockCount(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.STOCK_WRITE)) return { ok: false, error: "No permission" };

  const parsed = createCountSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { count_date, note, items, complete } = parsed.data;

  if (complete) {
    // All items must have qty_counted when completing
    const missing = items.some((it) => it.qty_counted == null);
    if (missing) return { ok: false, error: "All items must have a counted quantity to complete the count" };
  }

  const supabase = await createClient();

  const status = complete ? "completed" : "draft";

  const { data: count, error: countError } = await supabase
    .from("stock_counts")
    .insert({
      count_date,
      note: note?.trim() || null,
      status,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (countError || !count) return { ok: false, error: countError?.message ?? "Failed to create stock count" };

  const { error: itemsError } = await supabase.from("stock_count_items").insert(
    items.map((it) => ({
      count_id: count.id,
      item_id: it.item_id,
      qty_system: it.qty_system,
      qty_counted: it.qty_counted ?? null,
      unit: it.unit,
      note: it.note?.trim() || null,
    }))
  );

  if (itemsError) return { ok: false, error: itemsError.message };

  // If completing, apply discrepancies to on_hand + stock_ledger
  if (complete) {
    for (const it of items) {
      if (it.qty_counted == null) continue;

      const discrepancy = it.qty_counted - it.qty_system;
      if (discrepancy === 0) continue;

      // Fetch item to get current on_hand and reserved
      const { data: dbItem } = await supabase
        .from("items")
        .select("id, unit, on_hand, reserved")
        .eq("id", it.item_id)
        .maybeSingle();

      if (!dbItem) continue;

      const newOnHand = Number(dbItem.on_hand) + discrepancy;
      const currentReserved = Number(dbItem.reserved);

      await supabase
        .from("items")
        .update({ on_hand: newOnHand, updated_by: profile.id })
        .eq("id", it.item_id);

      await supabase.from("stock_ledger").insert({
        item_id: it.item_id,
        type: discrepancy > 0 ? "adjustment_in" : "adjustment_out",
        ref_id: count.id,
        qty_delta: discrepancy,
        on_hand_after: newOnHand,
        reserved_after: currentReserved,
        note: it.note?.trim() || null,
        created_by: profile.id,
      });
    }
  }

  revalidatePath("/stock/counts");
  revalidatePath("/inventory", "layout");
  return { ok: true, id: count.id };
}

export async function completeStockCount(id: string): Promise<ActionResult> {
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
  if (count.status !== "draft") return { ok: false, error: "Only draft counts can be completed" };

  const { data: countItems } = await supabase
    .from("stock_count_items")
    .select("item_id, qty_system, qty_counted, unit, note")
    .eq("count_id", id);

  if (!countItems || countItems.length === 0) return { ok: false, error: "No items found for this count" };

  const missing = countItems.some((it) => it.qty_counted == null);
  if (missing) return { ok: false, error: "All items must have a counted quantity before completing" };

  // Apply discrepancies
  for (const it of countItems) {
    if (it.qty_counted == null) continue;
    const discrepancy = Number(it.qty_counted) - Number(it.qty_system);
    if (discrepancy === 0) continue;

    const { data: dbItem } = await supabase
      .from("items")
      .select("id, unit, on_hand, reserved")
      .eq("id", it.item_id)
      .maybeSingle();

    if (!dbItem) continue;

    const newOnHand = Number(dbItem.on_hand) + discrepancy;
    const currentReserved = Number(dbItem.reserved);

    await supabase
      .from("items")
      .update({ on_hand: newOnHand, updated_by: profile.id })
      .eq("id", it.item_id);

    await supabase.from("stock_ledger").insert({
      item_id: it.item_id,
      type: discrepancy > 0 ? "adjustment_in" : "adjustment_out",
      ref_id: id,
      qty_delta: discrepancy,
      on_hand_after: newOnHand,
      reserved_after: currentReserved,
      note: it.note?.trim() || null,
      created_by: profile.id,
    });
  }

  const { error } = await supabase
    .from("stock_counts")
    .update({ status: "completed" })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/stock/counts");
  revalidatePath(`/stock/counts/${id}`);
  revalidatePath("/inventory", "layout");
  return { ok: true, id };
}
