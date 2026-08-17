"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { convertToItemUnit } from "@/lib/units";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const requestItemSchema = z.object({
  item_id: z.string().uuid(),
  qty: z.coerce.number().positive().optional().nullable(),
  unit: z.string().min(1).optional().nullable(),
});

const createRequestSchema = z.object({
  note: z.string().max(500).optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  items: z.array(requestItemSchema).min(1, "Add at least one item"),
  draft: z.boolean().optional(),
});

type RequestItemInput = { item_id: string; qty?: number | null; unit?: string | null };

/**
 * Build purchase_request_items insert rows, snapshotting each item's available
 * stock (on_hand - reserved, in its base unit) at request time so it never
 * drifts as stock later changes.
 */
async function withAvailableSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
  items: RequestItemInput[],
) {
  const itemIds = [...new Set(items.map((i) => i.item_id))];
  const { data: stockRows } = await supabase
    .from("items")
    .select("id, unit, on_hand, reserved")
    .in("id", itemIds);
  const stock = new Map(
    ((stockRows ?? []) as { id: string; unit: string; on_hand: number; reserved: number }[]).map((s) => [s.id, s]),
  );
  return items.map((it) => {
    const s = stock.get(it.item_id);
    return {
      request_id: requestId,
      item_id: it.item_id,
      qty: it.qty ?? null,
      unit: it.unit ?? null,
      available_snapshot: s ? Number(s.on_hand) - Number(s.reserved) : null,
      available_unit: s ? s.unit : null,
    };
  });
}

export async function createPurchaseRequest(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.PURCHASING_REQUEST)) return { ok: false, error: "No permission" };

  const parsed = createRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { note, supplier_id, items, draft } = parsed.data;

  const itemIds = items.map((i) => i.item_id);
  if (new Set(itemIds).size !== itemIds.length)
    return { ok: false, error: "Duplicate items are not allowed in a single request" };

  if (!draft && items.some((i) => !i.qty || !i.unit))
    return { ok: false, error: "All items must have a quantity and unit before submitting" };

  const supabase = await createClient();

  const { data: req, error } = await supabase
    .from("purchase_requests")
    .insert({
      note: note || null,
      supplier_id: supplier_id ?? null,
      status: draft ? "draft" : "pending",
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !req) return { ok: false, error: error?.message ?? "Failed to create request" };

  const rows = await withAvailableSnapshot(supabase, req.id, items);
  const { error: itemsError } = await supabase.from("purchase_request_items").insert(rows);

  if (itemsError) return { ok: false, error: itemsError.message };

  revalidatePath("/purchasing/requests");
  return { ok: true, id: req.id };
}

export async function updatePurchaseRequest(id: string, raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.PURCHASING_REQUEST)) return { ok: false, error: "No permission" };

  const parsed = createRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { note, supplier_id, items, draft } = parsed.data;

  const itemIds = items.map((i) => i.item_id);
  if (new Set(itemIds).size !== itemIds.length)
    return { ok: false, error: "Duplicate items are not allowed in a single request" };

  if (!draft && items.some((i) => !i.qty || !i.unit))
    return { ok: false, error: "All items must have a quantity and unit before submitting" };

  const supabase = await createClient();

  const { data: req } = await supabase
    .from("purchase_requests")
    .select("created_by, status")
    .eq("id", id)
    .maybeSingle();

  if (!req) return { ok: false, error: "Request not found" };
  if (req.status !== "draft") return { ok: false, error: "Only draft requests can be edited" };
  if (req.created_by !== profile.id && !can(profile, P.PURCHASING_APPROVE))
    return { ok: false, error: "Not authorized" };

  // Replace all items
  const { error: delError } = await supabase
    .from("purchase_request_items")
    .delete()
    .eq("request_id", id);
  if (delError) return { ok: false, error: delError.message };

  const rows = await withAvailableSnapshot(supabase, id, items);
  const { error: insertError } = await supabase.from("purchase_request_items").insert(rows);
  if (insertError) return { ok: false, error: insertError.message };

  const { error } = await supabase
    .from("purchase_requests")
    .update({
      note: note || null,
      supplier_id: supplier_id ?? null,
      status: draft ? "draft" : "pending",
      updated_by: profile.id,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/purchasing/requests");
  revalidatePath(`/purchasing/requests/${id}`);
  return { ok: true, id };
}

export async function submitDraftRequest(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.PURCHASING_REQUEST)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  // Only creator or admin can submit
  const { data: req } = await supabase
    .from("purchase_requests")
    .select("created_by, status")
    .eq("id", id)
    .maybeSingle();

  if (!req) return { ok: false, error: "Request not found" };
  if (req.status !== "draft") return { ok: false, error: "Request is not a draft" };
  if (req.created_by !== profile.id && !can(profile, P.PURCHASING_APPROVE))
    return { ok: false, error: "Not authorized" };

  const { error } = await supabase
    .from("purchase_requests")
    .update({ status: "pending", updated_by: profile.id })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/purchasing/requests");
  revalidatePath(`/purchasing/requests/${id}`);
  return { ok: true };
}

export async function reviewPurchaseRequest(
  id: string,
  action: "approved" | "rejected"
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.PURCHASING_APPROVE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_requests")
    .update({ status: action, reviewed_by: profile.id, reviewed_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", id)
    .eq("status", "pending");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/purchasing/requests");
  revalidatePath(`/purchasing/requests/${id}`);
  return { ok: true };
}

const updateItemSchema = z.object({
  qty: z.coerce.number().positive().nullable().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

/**
 * Approver edits a single requested item inline (change qty, assign a supplier,
 * or approve/reject it). Approval is per item, not per whole request; the
 * request-level status is recomputed as an aggregate afterwards.
 */
export async function updatePurchaseRequestItem(itemId: string, raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.PURCHASING_APPROVE)) return { ok: false, error: "No permission" };

  const parsed = updateItemSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("purchase_request_items")
    .select("request_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Item not found" };

  const patch: Record<string, unknown> = {};
  if (parsed.data.qty !== undefined) patch.qty = parsed.data.qty;
  if (parsed.data.supplier_id !== undefined) patch.supplier_id = parsed.data.supplier_id;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (Object.keys(patch).length === 0) return { ok: true, id: itemId };

  const { error } = await supabase.from("purchase_request_items").update(patch).eq("id", itemId);
  if (error) return { ok: false, error: error.message };

  await recomputeRequestStatus(supabase, row.request_id as string, profile.id);

  revalidatePath("/purchasing/requests");
  return { ok: true, id: itemId };
}

/** Roll the per-item statuses up to the request: pending if any item is still
 *  pending, else approved if any approved, else rejected. */
async function recomputeRequestStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requestId: string,
  profileId: string,
) {
  const { data: items } = await supabase
    .from("purchase_request_items")
    .select("status")
    .eq("request_id", requestId);
  const statuses = ((items ?? []) as { status: string }[]).map((i) => i.status);
  if (statuses.length === 0) return;

  // Don't override a still-editable draft.
  const { data: reqRow } = await supabase
    .from("purchase_requests")
    .select("status")
    .eq("id", requestId)
    .maybeSingle();
  if (!reqRow || reqRow.status === "draft") return;

  const next = statuses.some((s) => s === "pending")
    ? "pending"
    : statuses.some((s) => s === "approved")
      ? "approved"
      : "rejected";

  const reviewed = next !== "pending";
  await supabase
    .from("purchase_requests")
    .update({
      status: next,
      reviewed_by: reviewed ? profileId : null,
      reviewed_at: reviewed ? new Date().toISOString() : null,
      updated_by: profileId,
    })
    .eq("id", requestId);
}

const purchaseItemSchema = z.object({
  item_id: z.string().uuid(),
  qty_requested: z.coerce.number().positive().nullable().optional(),
  requested_unit: z.string().optional().nullable(),
  qty_purchased: z.coerce.number().positive(),
  unit: z.string().min(1),
  cost_per_unit: z.coerce.number().min(0).nullable().optional(),
  cost_total: z.coerce.number().min(0).nullable().optional(),
  row_note: z.string().max(300).optional().nullable(),
});

const createPurchaseSchema = z.object({
  purchase_request_ids: z.array(z.string().uuid()).optional(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  items: z.array(purchaseItemSchema).min(1, "Add at least one item"),
});

export async function createPurchase(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.PURCHASING_PURCHASE)) return { ok: false, error: "No permission" };

  const parsed = createPurchaseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { purchase_request_ids, transaction_date, note, supplier_id, items } = parsed.data;

  const supabase = await createClient();

  const { data: purchase, error } = await supabase
    .from("purchases")
    .insert({
      transaction_date,
      note: note || null,
      supplier_id: supplier_id ?? null,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !purchase) return { ok: false, error: error?.message ?? "Failed to create purchase" };

  // Link to purchase requests (many-to-many)
  if (purchase_request_ids && purchase_request_ids.length > 0) {
    const { error: prLinkError } = await supabase.from("purchase_purchase_requests").insert(
      purchase_request_ids.map((prId) => ({ purchase_id: purchase.id, purchase_request_id: prId }))
    );
    if (prLinkError) return { ok: false, error: prLinkError.message };
  }

  const { error: itemsError } = await supabase.from("purchase_items").insert(
    items.map((it) => ({
      purchase_id: purchase.id,
      item_id: it.item_id,
      qty_requested: it.qty_requested ?? null,
      requested_unit: it.requested_unit ?? null,
      qty_purchased: it.qty_purchased,
      unit: it.unit,
      cost_per_unit: it.cost_per_unit ?? null,
      cost_total: it.cost_total ?? null,
      row_note: it.row_note || null,
    }))
  );

  if (itemsError) return { ok: false, error: itemsError.message };

  // Update on_hand and last_purchase_cost for each ingredient
  const itemIds = [...new Set(items.map((it) => it.item_id))];
  const { data: dbItems } = await supabase
    .from("items")
    .select("id, unit, on_hand, reserved, purchase_unit, purchase_unit_qty, item_unit_conversions(from_unit, factor, to_unit)")
    .in("id", itemIds);

  if (dbItems) {
    for (const it of items) {
      const dbItem = dbItems.find((d) => d.id === it.item_id);
      if (!dbItem) continue;
      const delta = convertToItemUnit(it.qty_purchased, it.unit, dbItem);
      const newOnHand = Number(dbItem.on_hand) + delta;
      const currentReserved = Number(dbItem.reserved);

      // Compute last_purchase_cost per item's default unit
      let lastCost: number | null = null;
      const costTotal = it.cost_total ?? (it.cost_per_unit != null ? it.cost_per_unit * it.qty_purchased : null);
      if (costTotal != null && costTotal > 0) {
        const qtyInItemUnit = convertToItemUnit(it.qty_purchased, it.unit, dbItem);
        if (qtyInItemUnit > 0) lastCost = costTotal / qtyInItemUnit;
      }

      // Recompute weighted average purchase cost from all purchase_items for this item
      const { data: allPurchaseItems } = await supabase
        .from("purchase_items")
        .select("qty_purchased, unit, cost_per_unit, cost_total")
        .eq("item_id", it.item_id);

      let avgCost: number | null = null;
      if (allPurchaseItems && allPurchaseItems.length > 0) {
        let totalCost = 0;
        let totalQty = 0;
        for (const pi of allPurchaseItems) {
          const piCostTotal = pi.cost_total ?? (pi.cost_per_unit != null ? pi.cost_per_unit * Number(pi.qty_purchased) : null);
          if (piCostTotal == null || piCostTotal <= 0) continue;
          const piQtyBase = convertToItemUnit(Number(pi.qty_purchased), pi.unit, dbItem);
          totalCost += piCostTotal;
          totalQty += piQtyBase;
        }
        if (totalQty > 0) avgCost = totalCost / totalQty;
      }

      const update: Record<string, unknown> = { on_hand: newOnHand, updated_by: profile.id };
      if (lastCost != null) update.last_purchase_cost = lastCost;
      if (avgCost != null) update.avg_purchase_cost = avgCost;

      await supabase.from("items").update(update).eq("id", it.item_id);

      // Log to stock ledger
      await supabase.from("stock_ledger").insert({
        item_id: it.item_id,
        type: "purchase",
        ref_id: purchase.id,
        qty_delta: delta,
        on_hand_after: newOnHand,
        reserved_after: currentReserved,
        note: it.row_note || null,
        created_by: profile.id,
      });

      dbItem.on_hand = newOnHand;
    }
  }

  revalidatePath("/purchasing/purchases");
  revalidatePath("/inventory", "layout");
  return { ok: true, id: purchase.id };
}

export async function deletePurchaseRequest(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.PURCHASING_REQUEST)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase.from("purchase_requests").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/purchasing/requests");
  return { ok: true };
}
