"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentProfile } from "@/lib/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function getLoyaltyTotal(igHandle: string): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("loyalty_accounts")
    .select("total_points")
    .eq("ig_handle", igHandle.replace(/^@/, "").toLowerCase())
    .maybeSingle();
  return (data?.total_points as number) ?? 0;
}

export async function getLoyaltySettings(): Promise<{ rpPerPoint: number }> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("loyalty_settings")
    .select("rp_per_point")
    .single();
  return { rpPerPoint: (data?.rp_per_point as number) ?? 1000 };
}

export async function updateLoyaltySettings(rpPerPoint: number): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { ok: false, error: "Admin only" };

  if (!Number.isInteger(rpPerPoint) || rpPerPoint < 100) {
    return { ok: false, error: "Minimal Rp 100 per point" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("loyalty_settings")
    .update({ rp_per_point: rpPerPoint, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/loyalty");
  return { ok: true };
}

const igSchema = z.string().trim()
  .transform((s) => s.replace(/^@/, "").toLowerCase())
  .pipe(z.string().min(1).max(30).regex(/^[a-z0-9._]+$/, "ID Instagram tidak valid"));

export async function claimOrderPoints(
  orderId: string,
  rawIgHandle: string,
): Promise<{ ok: true; billPoints: number; totalPoints: number } | { ok: false; error: string }> {
  const parsed = igSchema.safeParse(rawIgHandle);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const igHandle = parsed.data;

  const supabase = createServiceClient();

  // Fetch the triggering order
  const { data: order } = await supabase
    .from("orders")
    .select("id, points_earned, points_claimed_at, points_void, table_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Order tidak ditemukan" };
  if (order.points_void) return { ok: false, error: "Points sudah hangus" };
  if (order.points_claimed_at) return { ok: false, error: "Points sudah diklaim" };

  // Collect all unclaimed orders from the same bill (table) — including this one
  let orderIds: string[] = [orderId];
  if (order.table_id) {
    const { data: siblings } = await supabase
      .from("orders")
      .select("id, points_earned")
      .eq("table_id", order.table_id)
      .is("points_claimed_at", null)
      .eq("points_void", false)
      .gt("points_earned", 0);
    orderIds = (siblings ?? []).map((o) => o.id as string);
    if (!orderIds.includes(orderId)) orderIds.push(orderId);
  }

  // Sum all points to claim
  const { data: ordersToClaim } = await supabase
    .from("orders")
    .select("id, points_earned")
    .in("id", orderIds);

  const billPoints = (ordersToClaim ?? []).reduce(
    (sum, o) => sum + ((o.points_earned as number) ?? 0),
    0,
  );

  if (billPoints <= 0) return { ok: false, error: "Tidak ada points yang bisa diklaim" };

  // Upsert loyalty account
  const { data: existing } = await supabase
    .from("loyalty_accounts")
    .select("total_points")
    .eq("ig_handle", igHandle)
    .maybeSingle();

  const newTotal = ((existing?.total_points as number) ?? 0) + billPoints;

  const { error: acctError } = await supabase
    .from("loyalty_accounts")
    .upsert({ ig_handle: igHandle, total_points: newTotal, updated_at: new Date().toISOString() });

  if (acctError) return { ok: false, error: acctError.message };

  // Record one transaction per order
  await supabase.from("loyalty_transactions").insert(
    (ordersToClaim ?? []).map((o) => ({
      ig_handle: igHandle,
      order_id: o.id as string,
      points: (o.points_earned as number) ?? 0,
    })),
  );

  // Mark all orders as claimed
  const now = new Date().toISOString();
  await supabase
    .from("orders")
    .update({ points_claimed_at: now, loyalty_ig_handle: igHandle })
    .in("id", orderIds);

  return { ok: true, billPoints, totalPoints: newTotal };
}
