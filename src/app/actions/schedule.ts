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
  const now = new Date().toISOString();
  const { data: pattern, error: pErr } = await supabase
    .from("roster_patterns")
    .insert({ name: input.name?.trim() || null, effective_date: input.effectiveDate, created_by: profile.id, updated_by: profile.id, updated_at: now })
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

  await supabase.from("roster_pattern_logs").insert({ pattern_id: pattern.id, actor_id: profile.id, action: "created", changes: [] });

  const { error: applyErr } = await supabase.rpc("rebuild_all_rosters");
  if (applyErr) return { ok: false, error: applyErr.message };

  revalidatePath("/hr/schedule", "layout");
  return { ok: true, id: pattern.id };
}

export type RosterDetail = {
  id: string;
  name: string | null;
  effective_date: string;
  cells: { employeeId: string; weekday: number; shiftId: string | null }[];
};

export async function getRosterPattern(id: string): Promise<RosterDetail | null> {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("roster_patterns")
    .select("id, name, effective_date")
    .eq("id", id)
    .maybeSingle();
  if (!p) return null;
  const { data: rs } = await supabase
    .from("roster_shifts")
    .select("employee_id, weekday, shift_id")
    .eq("pattern_id", id);
  return {
    id: p.id,
    name: p.name,
    effective_date: p.effective_date,
    cells: (rs ?? []).map((r) => ({ employeeId: r.employee_id, weekday: r.weekday, shiftId: r.shift_id })),
  };
}

export async function updateRosterPattern(
  id: string,
  input: RosterInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };
  if (!input.effectiveDate) return { ok: false, error: "Pick an effective date" };

  const supabase = await createClient();

  // Snapshot the old state so we can log what changed (from → to).
  const [{ data: oldPattern }, { data: oldShifts }, { data: empData }, { data: shiftData }] = await Promise.all([
    supabase.from("roster_patterns").select("name, effective_date").eq("id", id).maybeSingle(),
    supabase.from("roster_shifts").select("employee_id, weekday, shift_id").eq("pattern_id", id),
    supabase.from("employees").select("id, name"),
    supabase.from("shifts").select("id, name"),
  ]);
  const empName = new Map((((empData ?? []) as { id: string; name: string }[]).map((e) => [e.id, e.name])));
  const shiftName = new Map((((shiftData ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name])));
  const nameOf = (sid: string | null) => (sid ? shiftName.get(sid) ?? "Shift" : "None");
  const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const changes: { label: string; from: string; to: string }[] = [];
  const oldName = oldPattern?.name ?? null;
  const newName = input.name?.trim() || null;
  if (oldName !== newName) changes.push({ label: "Name", from: oldName ?? "—", to: newName ?? "—" });
  if (oldPattern && oldPattern.effective_date !== input.effectiveDate) {
    changes.push({ label: "Effective date", from: oldPattern.effective_date, to: input.effectiveDate });
  }
  // Per crew/weekday shift changes.
  const oldMap = new Map<string, string | null>();
  for (const r of (oldShifts ?? []) as { employee_id: string; weekday: number; shift_id: string | null }[]) {
    oldMap.set(`${r.employee_id}|${r.weekday}`, r.shift_id);
  }
  const newMap = new Map<string, string | null>();
  for (const c of input.cells) {
    if (c.weekday >= 0 && c.weekday <= 6) newMap.set(`${c.employeeId}|${c.weekday}`, c.shiftId);
  }
  for (const key of new Set([...oldMap.keys(), ...newMap.keys()])) {
    const [emp, wd] = key.split("|");
    const before = oldMap.get(key) ?? null;
    const after = newMap.get(key) ?? null;
    if (before !== after) {
      changes.push({ label: `${empName.get(emp) ?? "Crew"} · ${WD[Number(wd)] ?? wd}`, from: nameOf(before), to: nameOf(after) });
    }
  }

  const now = new Date().toISOString();
  const { error: uErr } = await supabase
    .from("roster_patterns")
    .update({ name: newName, effective_date: input.effectiveDate, updated_by: profile.id, updated_at: now })
    .eq("id", id);
  if (uErr) return { ok: false, error: uErr.message };

  await supabase.from("roster_shifts").delete().eq("pattern_id", id);
  const rows = input.cells
    .filter((c) => c.shiftId && c.weekday >= 0 && c.weekday <= 6)
    .map((c) => ({ pattern_id: id, employee_id: c.employeeId, weekday: c.weekday, shift_id: c.shiftId }));
  if (rows.length > 0) {
    const { error: rErr } = await supabase.from("roster_shifts").insert(rows);
    if (rErr) return { ok: false, error: rErr.message };
  }

  if (changes.length > 0) {
    await supabase.from("roster_pattern_logs").insert({ pattern_id: id, actor_id: profile.id, action: "updated", changes });
  }

  const { error: applyErr } = await supabase.rpc("rebuild_all_rosters");
  if (applyErr) return { ok: false, error: applyErr.message };
  revalidatePath("/hr/schedule", "layout");
  return { ok: true };
}

export async function deleteRosterPattern(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase.from("roster_patterns").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await supabase.rpc("rebuild_all_rosters");
  revalidatePath("/hr/schedule", "layout");
  return { ok: true };
}
