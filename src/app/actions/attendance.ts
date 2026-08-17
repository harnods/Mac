"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Shift, AttendanceWithRelations, AttendanceSettings } from "@/lib/supabase/types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const attendanceSchema = z.object({
  employee_id: z.string().uuid("Crew is required"),
  shift_id: z.string().uuid().nullable().optional().or(z.literal("")),
  work_date: z.string().trim().min(1, "Date is required"),
  clock_in: z.string().trim().min(1, "Clock in time is required"),
  clock_out: z.string().trim().optional().or(z.literal("")),
  break_minutes: z.coerce.number().int().min(0).max(1440).default(0),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

function toNull<T>(val: T | "" | undefined | null): T | null {
  if (val === "" || val === undefined) return null;
  return val ?? null;
}

/** Classify the request device from its user-agent: mobile browser vs web. */
async function requestSource(): Promise<"web" | "mobile"> {
  const ua = (await headers()).get("user-agent") ?? "";
  return /Mobile|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|BlackBerry/i.test(ua) ? "mobile" : "web";
}

/**
 * A crew may only have one attendance record per date per shift. Returns a
 * user-facing error string if a clashing record already exists, else null.
 */
async function duplicateError(
  supabase: SupabaseClient,
  employeeId: string,
  workDate: string,
  shiftId: string | null,
  excludeId?: string,
): Promise<string | null> {
  let query = supabase
    .from("attendance")
    .select("id, employees(name), shifts(name)")
    .eq("employee_id", employeeId)
    .eq("work_date", workDate);
  query = shiftId === null ? query.is("shift_id", null) : query.eq("shift_id", shiftId);
  if (excludeId) query = query.neq("id", excludeId);

  const { data } = await query.maybeSingle();
  if (!data) return null;

  const dup = data as unknown as { employees: { name: string } | null; shifts: { name: string } | null };
  const crew = dup.employees?.name ?? "This crew";
  const shift = dup.shifts?.name ? `the ${dup.shifts.name} shift` : "no shift";
  return `${crew} already has an attendance record for ${shift} on ${formatDate(workDate)}. Edit that record instead.`;
}

export async function createAttendance(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = attendanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  const supabase = await createClient();

  const dup = await duplicateError(supabase, d.employee_id, d.work_date, toNull(d.shift_id));
  if (dup) return { ok: false, error: dup };

  const { data, error } = await supabase
    .from("attendance")
    .insert({
      employee_id: d.employee_id,
      shift_id: toNull(d.shift_id),
      work_date: d.work_date,
      clock_in: toNull(d.clock_in),
      clock_out: toNull(d.clock_out),
      break_minutes: d.break_minutes,
      note: toNull(d.note),
      source: await requestSource(),
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr/attendance");
  return { ok: true, id: data.id };
}

export async function updateAttendance(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = attendanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  const supabase = await createClient();

  const dup = await duplicateError(supabase, d.employee_id, d.work_date, toNull(d.shift_id), id);
  if (dup) return { ok: false, error: dup };

  const { error } = await supabase
    .from("attendance")
    .update({
      employee_id: d.employee_id,
      shift_id: toNull(d.shift_id),
      work_date: d.work_date,
      clock_in: toNull(d.clock_in),
      clock_out: toNull(d.clock_out),
      break_minutes: d.break_minutes,
      note: toNull(d.note),
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr/attendance");
  return { ok: true };
}

export async function deleteAttendance(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase.from("attendance").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr/attendance");
  return { ok: true };
}

/** Change only the shift of an existing attendance record (used from the table). */
export async function updateAttendanceShift(id: string, shiftId: string | null): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { data: rec } = await supabase.from("attendance").select("employee_id, work_date").eq("id", id).maybeSingle();
  if (!rec) return { ok: false, error: "Attendance record not found" };

  const dup = await duplicateError(supabase, rec.employee_id as string, rec.work_date as string, shiftId, id);
  if (dup) return { ok: false, error: dup };

  const { error } = await supabase
    .from("attendance")
    .update({ shift_id: shiftId, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr/attendance");
  revalidatePath("/hr", "layout");
  return { ok: true };
}

/** Set the shift for a crew on a given day — updates the day's record or creates
 *  one if none exists (e.g. assigning a Day off on a day with no clock-in). */
export async function assignAttendanceShift(employeeId: string, workDate: string, shiftId: string | null): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("attendance")
      .update({ shift_id: shiftId, updated_by: profile.id, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("attendance").insert({
      employee_id: employeeId,
      work_date: workDate,
      shift_id: shiftId,
      source: await requestSource(),
      created_by: profile.id,
      updated_by: profile.id,
    });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/hr/attendance");
  revalidatePath("/hr", "layout");
  return { ok: true };
}

/** Attendance rows for one crew within an inclusive date range (YYYY-MM-DD). */
export async function getEmployeeAttendance(
  employeeId: string,
  start: string,
  end: string,
): Promise<AttendanceWithRelations[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance")
    .select(
      "*, employees(id,name), shifts(id,name,start_time,end_time), creator:profiles!created_by(full_name,email), updater:profiles!updated_by(full_name,email)",
    )
    .eq("employee_id", employeeId)
    .gte("work_date", start)
    .lte("work_date", end)
    .order("work_date", { ascending: true })
    .order("clock_in", { ascending: true, nullsFirst: false });

  return (data ?? []) as unknown as AttendanceWithRelations[];
}

export type AttendanceFormData = {
  crew: { id: string; name: string }[];
  shifts: Shift[];
};

export async function getAttendanceFormData(): Promise<AttendanceFormData | null> {
  const profile = await getCurrentProfile();
  if (!can(profile, P.EMPLOYEES_WRITE)) return null;

  const supabase = await createClient();
  const [crewResult, shiftResult] = await Promise.all([
    supabase.from("employees").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("shifts").select("id,name,start_time,end_time,updated_by,updated_at").order("start_time"),
  ]);

  return {
    crew: (crewResult.data ?? []) as { id: string; name: string }[],
    shifts: (shiftResult.data ?? []) as Shift[],
  };
}

// ─── Attendance settings (grace periods) ────────────────────────────────────

const timeOrEmpty = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().or(z.literal(""));
const attendanceSettingsSchema = z.object({
  working_days_per_week: z.coerce.number().int().min(1).max(7),
  allowed_ips: z.string().trim().max(500).optional().or(z.literal("")),
  late_grace_minutes: z.coerce.number().int().min(0).max(240),
  late_tolerance_direction: z.enum(["before", "after"]),
  early_leave_grace_minutes: z.coerce.number().int().min(0).max(240),
  store_lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  store_lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  geofence_radius_m: z.coerce.number().int().min(10).max(5000).nullable().optional(),
  require_location: z.coerce.boolean().optional().default(false),
  clock_in_earliest: timeOrEmpty,
  clock_in_latest: timeOrEmpty,
});

export async function getAttendanceSettings(): Promise<AttendanceSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_settings")
    .select("id,late_grace_minutes,late_tolerance_direction,early_leave_grace_minutes,working_days_per_week,allowed_ips,store_lat,store_lng,geofence_radius_m,require_location,clock_in_earliest,clock_in_latest,updated_by,updated_at")
    .limit(1)
    .maybeSingle();
  return (data ?? null) as AttendanceSettings | null;
}

export async function updateAttendanceSettings(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = attendanceSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_settings")
    .update({
      working_days_per_week: parsed.data.working_days_per_week,
      allowed_ips: parsed.data.allowed_ips?.trim() ? parsed.data.allowed_ips.trim() : null,
      late_grace_minutes: parsed.data.late_grace_minutes,
      late_tolerance_direction: parsed.data.late_tolerance_direction,
      early_leave_grace_minutes: parsed.data.early_leave_grace_minutes,
      store_lat: parsed.data.store_lat ?? null,
      store_lng: parsed.data.store_lng ?? null,
      geofence_radius_m: parsed.data.geofence_radius_m ?? null,
      require_location: parsed.data.require_location,
      clock_in_earliest: parsed.data.clock_in_earliest?.trim() ? parsed.data.clock_in_earliest : null,
      clock_in_latest: parsed.data.clock_in_latest?.trim() ? parsed.data.clock_in_latest : null,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true };
}
