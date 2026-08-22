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
      { employee_id: employeeId, work_date: workDate, shift_id: shiftId, updated_by: profile.id, updated_at: new Date().toISOString() },
      { onConflict: "employee_id,work_date" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr/schedule");
  return { ok: true };
}
