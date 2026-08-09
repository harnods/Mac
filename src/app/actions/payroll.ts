"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { activeSettingsVersion } from "@/lib/payroll-settings";
import type { PayrollSettings, PayrollSettingsVersion } from "@/lib/supabase/types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const day = z.coerce.number().int().min(1, "Day must be 1–31").max(31, "Day must be 1–31");

const versionSchema = z.object({
  effective_date: z.string().trim().min(1, "Effective date is required"),
  cutoff_start_day: day,
  cutoff_end_day: day,
  payday: day,
  daily_allowance_by_attendance: z.coerce.boolean(),
  deduct_absence_from_salary: z.coerce.boolean(),
});

const VERSION_COLUMNS =
  "id,effective_date,cutoff_start_day,cutoff_end_day,payday,daily_allowance_by_attendance,deduct_absence_from_salary,created_by,created_at";

function jakartaToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

/** All payroll-settings versions, newest effective date first. */
export async function getPayrollSettingsVersions(): Promise<PayrollSettingsVersion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payroll_settings_versions")
    .select(VERSION_COLUMNS)
    .order("effective_date", { ascending: false });
  return (data ?? []) as PayrollSettingsVersion[];
}

/** The payroll settings in effect today (active version), mapped to the flat shape consumers use. */
export async function getPayrollSettings(): Promise<PayrollSettings | null> {
  const versions = await getPayrollSettingsVersions();
  const active = activeSettingsVersion(versions, jakartaToday());
  if (!active) return null;
  return {
    id: active.id,
    cutoff_start_day: active.cutoff_start_day,
    cutoff_end_day: active.cutoff_end_day,
    payday: active.payday,
    daily_allowance_by_attendance: active.daily_allowance_by_attendance,
    deduct_absence_from_salary: active.deduct_absence_from_salary,
    updated_by: active.created_by,
    updated_at: active.created_at,
  };
}

/**
 * Save payroll settings. Editing with the SAME effective date updates that
 * version in place; a NEW effective date forks a new version in the history
 * (upsert on effective_date) — mirrors payroll components.
 *
 * TODO(payroll-run): once payroll runs exist, reject an effective_date that
 * falls inside a period that has already been run (no backdating a run period).
 */
export async function updatePayrollSettings(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = versionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll_settings_versions")
    .upsert({ ...parsed.data, created_by: profile.id }, { onConflict: "effective_date" });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true };
}
