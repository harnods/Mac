"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const locationSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function createLocation(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const parsed = locationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .insert({ name: parsed.data.name, updated_by: profile.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.code === "23505" ? "Location already exists" : error.message };

  revalidatePath("/settings/locations");
  revalidatePath("/inventory", "layout");
  return { ok: true, id: data.id };
}

export async function updateLocation(id: string, raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const parsed = locationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .update({ name: parsed.data.name, updated_by: profile.id })
    .eq("id", id);
  if (error) return { ok: false, error: error.code === "23505" ? "Location already exists" : error.message };

  revalidatePath("/settings/locations");
  revalidatePath("/inventory", "layout");
  return { ok: true };
}

export async function deleteLocation(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.INVENTORY_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  const { count } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("location_id", id)
    .is("deleted_at", null);
  if ((count ?? 0) > 0)
    return { ok: false, error: `Cannot delete — location is assigned to ${count} item(s)` };

  const { error } = await supabase.from("locations").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/locations");
  revalidatePath("/inventory", "layout");
  return { ok: true };
}
