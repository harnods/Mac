"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import type { OvertimeCompensation, OvertimeCompensationVersion } from "@/lib/supabase/types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const COMP_COLUMNS = "id,name,job_level_id,updated_by,updated_at,created_at";
const VERSION_COLUMNS =
  "id,compensation_id,effective_date,amount_per_hour,cap_hours,max_hours_per_day,created_by,created_at";

const overtimeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  job_level_id: z.string().uuid("Job level is required"),
  amount_per_hour: z.coerce.number().min(0),
  cap_hours: z.coerce.boolean(),
  max_hours_per_day: z.coerce.number().min(0).max(24),
  effective_date: z.string().trim().min(1, "Effective date is required"),
});

export async function getOvertimeCompensations(): Promise<{
  compensations: OvertimeCompensation[];
  versions: OvertimeCompensationVersion[];
}> {
  const supabase = await createClient();
  const [{ data: comps }, { data: vers }] = await Promise.all([
    supabase.from("overtime_compensations").select(COMP_COLUMNS).order("name"),
    supabase.from("overtime_compensation_versions").select(VERSION_COLUMNS).order("effective_date", { ascending: true }),
  ]);
  return {
    compensations: (comps ?? []) as OvertimeCompensation[],
    versions: (vers ?? []) as OvertimeCompensationVersion[],
  };
}

export async function getOvertimeCompensation(id: string) {
  const supabase = await createClient();
  const [{ data: compensation }, { data: versions }] = await Promise.all([
    supabase.from("overtime_compensations").select(COMP_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("overtime_compensation_versions").select(VERSION_COLUMNS).eq("compensation_id", id).order("effective_date", { ascending: true }),
  ]);
  return {
    compensation: compensation as OvertimeCompensation | null,
    versions: (versions ?? []) as OvertimeCompensationVersion[],
  };
}

export async function createOvertimeCompensation(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = overtimeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("overtime_compensations")
    .insert({ name: d.name, job_level_id: d.job_level_id, updated_by: profile.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const { error: verr } = await supabase.from("overtime_compensation_versions").insert({
    compensation_id: data.id,
    effective_date: d.effective_date,
    amount_per_hour: d.amount_per_hour,
    cap_hours: d.cap_hours,
    max_hours_per_day: d.max_hours_per_day,
    created_by: profile.id,
  });
  if (verr) return { ok: false, error: verr.message };

  revalidatePath("/hr", "layout");
  return { ok: true, id: data.id };
}

/**
 * Update the master (name, job level) and upsert the version for the effective
 * date — same date updates in place, a new date forks a new history entry.
 */
export async function updateOvertimeCompensation(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = overtimeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("overtime_compensations")
    .update({ name: d.name, job_level_id: d.job_level_id, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  const { error: verr } = await supabase.from("overtime_compensation_versions").upsert(
    {
      compensation_id: id,
      effective_date: d.effective_date,
      amount_per_hour: d.amount_per_hour,
      cap_hours: d.cap_hours,
      max_hours_per_day: d.max_hours_per_day,
      created_by: profile.id,
    },
    { onConflict: "compensation_id,effective_date" },
  );
  if (verr) return { ok: false, error: verr.message };

  revalidatePath("/hr", "layout");
  return { ok: true };
}

export async function deleteOvertimeCompensation(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase.from("overtime_compensations").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true };
}
