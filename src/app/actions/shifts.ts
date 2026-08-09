"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

// Default shifts that can't be edited or deleted.
const LOCKED_SHIFTS = ["Day off"];

const shiftSchema = z
  .object({
    name: z.string().trim().min(1, "Shift name is required").max(120),
    start_time: z.string().trim().min(1, "Start time is required"),
    end_time: z.string().trim().min(1, "End time is required"),
    break_minutes: z.coerce.number().int().min(0, "Break can't be negative").default(0),
  })
  .refine((d) => d.start_time !== d.end_time, {
    message: "End time must differ from start time",
    path: ["end_time"],
  });

export async function createShift(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = shiftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shifts")
    .insert({
      name: parsed.data.name,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      break_minutes: parsed.data.break_minutes,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true, id: data.id };
}

export async function updateShift(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = shiftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { data: target } = await supabase.from("shifts").select("name").eq("id", id).maybeSingle();
  if (target && LOCKED_SHIFTS.includes(target.name)) {
    return { ok: false, error: `“${target.name}” is a default shift and can't be edited.` };
  }

  const { error } = await supabase
    .from("shifts")
    .update({
      name: parsed.data.name,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      break_minutes: parsed.data.break_minutes,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true };
}

export async function deleteShift(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  const { data: target } = await supabase.from("shifts").select("name").eq("id", id).maybeSingle();
  if (target && LOCKED_SHIFTS.includes(target.name)) {
    return { ok: false, error: `“${target.name}” is a default shift and can't be deleted.` };
  }

  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true };
}
