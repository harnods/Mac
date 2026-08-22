"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";

export type ScheduleCell = { employee_id: string; work_date: string; shift_id: string | null };
type ActionResult = { ok: true } | { ok: false; error: string };

/** All schedule rows in a date range (inclusive). */
export async function getScheduleRange(start: string, end: string): Promise<ScheduleCell[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("schedules")
    .select("employee_id, work_date, shift_id")
    .gte("work_date", start)
    .lte("work_date", end);
  return (data ?? []) as ScheduleCell[];
}

/** Set (or clear) the scheduled shift for one crew on one day. */
export async function setSchedule(
  employeeId: string,
  workDate: string,
  shiftId: string | null,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("schedules")
    .upsert(
      { employee_id: employeeId, work_date: workDate, shift_id: shiftId, source: "manual", updated_by: profile.id, updated_at: new Date().toISOString() },
      { onConflict: "employee_id,work_date" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr/schedule");
  return { ok: true };
}

export type RosterPattern = { id: string; name: string | null; effective_date: string };

/** List saved weekly patterns, newest effective date first. */
export async function getRosterPatterns(): Promise<RosterPattern[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roster_patterns")
    .select("id, name, effective_date")
    .order("effective_date", { ascending: false });
  return (data ?? []) as RosterPattern[];
}

export type RosterInput = {
  name?: string;
  effectiveDate: string;
  cells: { employeeId: string; weekday: number; shiftId: string | null }[];
};

/** Create a team-wide weekly pattern effective from a date and generate the
 *  schedule from it (repeats weekly until the next pattern). */
export async function createRosterPattern(
  input: RosterInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };
  if (!input.effectiveDate) return { ok: false, error: "Pick an effective date" };

  const supabase = await createClient();
  const { data: pattern, error: pErr } = await supabase
    .from("roster_patterns")
    .insert({ name: input.name?.trim() || null, effective_date: input.effectiveDate, created_by: profile.id })
    .select("id")
    .single();
  if (pErr || !pattern) return { ok: false, error: pErr?.message ?? "Failed to create pattern" };

  const rows = input.cells
    .filter((c) => c.shiftId && c.weekday >= 0 && c.weekday <= 6)
    .map((c) => ({ pattern_id: pattern.id, employee_id: c.employeeId, weekday: c.weekday, shift_id: c.shiftId }));
  if (rows.length > 0) {
    const { error: rErr } = await supabase.from("roster_shifts").insert(rows);
    if (rErr) return { ok: false, error: rErr.message };
  }

  const { error: applyErr } = await supabase.rpc("apply_roster_pattern", { p_pattern: pattern.id });
  if (applyErr) return { ok: false, error: applyErr.message };

  revalidatePath("/hr/schedule");
  return { ok: true, id: pattern.id };
}
