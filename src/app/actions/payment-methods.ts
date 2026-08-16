"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const schema = z.object({ name: z.string().trim().min(1).max(60) });

export async function createPaymentMethod(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SALES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .insert({ name: parsed.data.name, updated_by: profile.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.code === "23505" ? "Payment method already exists" : error.message };

  revalidatePath("/settings/payment-methods");
  revalidatePath("/sales", "layout");
  return { ok: true, id: data.id };
}

export async function updatePaymentMethod(id: string, raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SALES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_methods")
    .update({ name: parsed.data.name, updated_by: profile.id })
    .eq("id", id);
  if (error) return { ok: false, error: error.code === "23505" ? "Payment method already exists" : error.message };

  revalidatePath("/settings/payment-methods");
  revalidatePath("/sales", "layout");
  return { ok: true };
}

export async function deletePaymentMethod(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SALES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase.from("payment_methods").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/payment-methods");
  revalidatePath("/sales", "layout");
  return { ok: true };
}
