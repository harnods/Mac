"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";
import { clientIp, isIpAllowed } from "@/lib/ip";
import type { AttendanceWithRelations } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function jakartaDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}
function jakartaTime() {
  return new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false });
}
function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Is `now` inside a shift window [start, end)? Handles overnight (end < start). */
function withinShiftWindow(now: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const n = toMin(now), s = toMin(start), e = toMin(end);
  return e > s ? n >= s && n < e : n >= s || n < e;
}

async function myEmployeeId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("employees").select("id").eq("user_id", userId).is("deleted_at", null).maybeSingle();
  return data?.id ?? null;
}

/** Returns an error string if the request isn't on the allowed store network. */
async function networkError(): Promise<string | null> {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("attendance_settings").select("allowed_ips").limit(1).maybeSingle();
  const ip = clientIp(await headers());
  return isIpAllowed(ip, settings?.allowed_ips) ? null : "Clock in/out hanya bisa saat terhubung ke wifi toko.";
}

export type PunchGeo = { lat: number; lng: number } | null | undefined;

/** Great-circle distance between two lat/lng points, in metres. */
function distanceMetres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Validates a clock punch against the store network (IP allowlist), geofence
 * (GPS within radius of the store), and — for clock-in — the allowed time
 * window. Returns the IP and coordinates to record on the attendance row.
 */
async function punchGuard(
  geo: PunchGeo,
  opts: { checkTimeWindow: boolean },
): Promise<{ error?: string; ip: string | null; lat: number | null; lng: number | null }> {
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("attendance_settings")
    .select("allowed_ips, store_lat, store_lng, geofence_radius_m, require_location, clock_in_earliest, clock_in_latest")
    .limit(1)
    .maybeSingle();
  const ip = clientIp(await headers());
  const lat = geo?.lat ?? null;
  const lng = geo?.lng ?? null;

  if (!isIpAllowed(ip, s?.allowed_ips)) {
    return { error: "Clock in/out hanya bisa saat terhubung ke wifi toko.", ip, lat, lng };
  }

  const hasGeofence = s?.store_lat != null && s?.store_lng != null && s?.geofence_radius_m != null;
  if (hasGeofence) {
    if (lat == null || lng == null) {
      if (s?.require_location) return { error: "Aktifkan izin lokasi (GPS) untuk clock in/out.", ip, lat, lng };
    } else {
      const dist = distanceMetres(lat, lng, Number(s!.store_lat), Number(s!.store_lng));
      if (dist > Number(s!.geofence_radius_m)) {
        return { error: `Kamu ~${Math.round(dist)} m dari toko — clock in/out hanya bisa di toko (radius ${s!.geofence_radius_m} m).`, ip, lat, lng };
      }
    }
  } else if (s?.require_location && (lat == null || lng == null)) {
    return { error: "Aktifkan izin lokasi (GPS) untuk clock in/out.", ip, lat, lng };
  }

  if (opts.checkTimeWindow && (s?.clock_in_earliest || s?.clock_in_latest)) {
    const now = jakartaTime(); // "HH:MM:SS"
    if (s?.clock_in_earliest && now < s.clock_in_earliest) {
      return { error: `Clock in paling awal jam ${String(s.clock_in_earliest).slice(0, 5)}.`, ip, lat, lng };
    }
    if (s?.clock_in_latest && now > s.clock_in_latest) {
      return { error: `Clock in paling akhir jam ${String(s.clock_in_latest).slice(0, 5)}.`, ip, lat, lng };
    }
  }

  return { ip, lat, lng };
}

export type OpenOvertime = { id: string; clock_in: string | null; break_start: string | null; break_minutes: number };

export type MyContext = {
  employee: { id: string; name: string; photo_url: string | null } | null;
  today: AttendanceWithRelations | null;
  shifts: { id: string; name: string; start_time: string | null; end_time: string | null }[];
  scheduledShift: { id: string; name: string; start_time: string | null; end_time: string | null } | null;
  overtimeEligible: boolean;
  openOvertime: OpenOvertime | null;
  /** True when now is inside today's scheduled shift window — overtime can't start yet. */
  overtimeWindowBlocked: boolean;
  onStoreNetwork: boolean;
  detectedIp: string | null;
  restricted: boolean;
};

export async function getMyContext(): Promise<MyContext | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();

  const { data: emp } = await supabase
    .from("employees")
    .select("id,name,photo_url,job_level_id")
    .eq("user_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle();

  const { data: settings } = await supabase.from("attendance_settings").select("allowed_ips").limit(1).maybeSingle();
  const detectedIp = clientIp(await headers());
  const restricted = !!settings?.allowed_ips?.trim();
  const onStoreNetwork = isIpAllowed(detectedIp, settings?.allowed_ips);

  if (!emp) return { employee: null, today: null, shifts: [], scheduledShift: null, overtimeEligible: false, openOvertime: null, overtimeWindowBlocked: false, onStoreNetwork, detectedIp, restricted };

  // Resolve any pending overtime→shift transition (OT started before the shift
  // start auto-closes at shift start and clocks the shift in) before reading.
  await applyOvertimeTransition(emp.id, profile.id);

  const today = jakartaDate();
  const [{ data: todayRec }, { data: shifts }] = await Promise.all([
    supabase
      .from("attendance")
      .select("*, shifts(id,name,start_time,end_time)")
      .eq("employee_id", emp.id)
      .eq("work_date", today)
      .not("clock_in", "is", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("shifts").select("id,name,start_time,end_time").eq("active", true).not("start_time", "is", null).order("start_time"),
  ]);

  // Today's assigned shift from the schedule (crew clock in against this).
  const { data: sched } = await supabase
    .from("schedules")
    .select("shifts(id,name,start_time,end_time)")
    .eq("employee_id", emp.id)
    .eq("work_date", today)
    .maybeSingle();
  const sShift = (sched?.shifts ?? null) as unknown as
    | { id: string; name: string; start_time: string | null; end_time: string | null }
    | null;

  // Overtime eligibility: the crew's job level must have a compensation rate set.
  const empJobLevel = (emp as { job_level_id: string | null }).job_level_id;
  let overtimeEligible = false;
  if (empJobLevel) {
    const { count } = await supabase
      .from("overtime_compensations")
      .select("id", { count: "exact", head: true })
      .eq("job_level_id", empJobLevel);
    overtimeEligible = (count ?? 0) > 0;
  }

  // An open overtime session (clocked in, not yet out) for today.
  const { data: openOt } = await supabase
    .from("overtime_requests")
    .select("id,clock_in,break_start,break_minutes")
    .eq("employee_id", emp.id)
    .eq("work_date", today)
    .not("clock_in", "is", null)
    .is("clock_out", null)
    .maybeSingle();

  return {
    employee: emp as { id: string; name: string; photo_url: string | null },
    today: (todayRec ?? null) as AttendanceWithRelations | null,
    shifts: (shifts ?? []) as { id: string; name: string; start_time: string | null; end_time: string | null }[],
    scheduledShift: sShift,
    overtimeEligible,
    openOvertime: (openOt ?? null) as OpenOvertime | null,
    overtimeWindowBlocked: withinShiftWindow(jakartaTime(), sShift?.start_time ?? null, sShift?.end_time ?? null),
    onStoreNetwork,
    detectedIp,
    restricted,
  };
}

export async function clockIn(geo?: PunchGeo): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  const empId = await myEmployeeId(profile.id);
  if (!empId) return { ok: false, error: "No crew profile linked to this account." };

  const supabase = await createClient();
  const today = jakartaDate();

  // Resolve any pending overtime→shift transition, then block a manual shift
  // clock-in while an overtime session is still open.
  await applyOvertimeTransition(empId, profile.id);
  if (await openOvertimeRecord(empId)) return { ok: false, error: "Kamu masih clock in overtime — clock out dulu." };

  // The shift is fixed by the schedule — crew clock in against their assigned
  // working shift, they can't choose it.
  const { data: sched } = await supabase
    .from("schedules")
    .select("shift_id, shifts(start_time)")
    .eq("employee_id", empId)
    .eq("work_date", today)
    .maybeSingle();
  const shiftId = sched?.shift_id as string | undefined;
  const shiftRel = sched?.shifts as unknown as { start_time: string | null } | null;
  if (!shiftId || !shiftRel?.start_time) {
    return { ok: false, error: "Kamu tidak dijadwalkan kerja hari ini." };
  }

  const guard = await punchGuard(geo, { checkTimeWindow: true });
  if (guard.error) return { ok: false, error: guard.error };

  const { data: open } = await supabase
    .from("attendance")
    .select("id")
    .eq("employee_id", empId)
    .eq("work_date", today)
    .not("clock_in", "is", null)
    .is("clock_out", null)
    .maybeSingle();
  if (open) return { ok: false, error: "You're already clocked in." };

  const { error } = await serviceClient().from("attendance").insert({
    employee_id: empId,
    work_date: today,
    shift_id: shiftId,
    clock_in: jakartaTime(),
    clock_in_ip: guard.ip,
    clock_in_lat: guard.lat,
    clock_in_lng: guard.lng,
    source: "mobile",
    created_by: profile.id,
    updated_by: profile.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me");
  return { ok: true };
}

async function openRecord(empId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance")
    .select("id,break_start,break_minutes,clock_out,breaks")
    .eq("employee_id", empId)
    .eq("work_date", jakartaDate())
    .not("clock_in", "is", null)
    .is("clock_out", null)
    .maybeSingle();
  return data;
}

export async function clockOut(geo?: PunchGeo): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  const empId = await myEmployeeId(profile.id);
  if (!empId) return { ok: false, error: "No crew profile linked to this account." };
  const guard = await punchGuard(geo, { checkTimeWindow: false });
  if (guard.error) return { ok: false, error: guard.error };

  const open = await openRecord(empId);
  if (!open) return { ok: false, error: "You haven't clocked in." };

  const now = jakartaTime();
  let breakMin = open.break_minutes ?? 0;
  const breaks = (Array.isArray(open.breaks) ? open.breaks : []) as { start: string; end: string }[];
  if (open.break_start) {
    breakMin += Math.max(0, toMin(now) - toMin(open.break_start)); // auto-end an open break
    breaks.push({ start: open.break_start, end: now });
  }

  const { error } = await serviceClient()
    .from("attendance")
    .update({ clock_out: now, clock_out_ip: guard.ip, clock_out_lat: guard.lat, clock_out_lng: guard.lng, break_minutes: breakMin, break_start: null, breaks, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", open.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me");
  return { ok: true };
}

export async function breakStart(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  const empId = await myEmployeeId(profile.id);
  if (!empId) return { ok: false, error: "No crew profile linked to this account." };
  const net = await networkError();
  if (net) return { ok: false, error: net };

  const open = await openRecord(empId);
  if (!open) return { ok: false, error: "You haven't clocked in." };
  if (open.break_start) return { ok: false, error: "You're already on break." };

  const { error } = await serviceClient()
    .from("attendance")
    .update({ break_start: jakartaTime(), updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", open.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me");
  return { ok: true };
}

export async function breakEnd(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  const empId = await myEmployeeId(profile.id);
  if (!empId) return { ok: false, error: "No crew profile linked to this account." };
  const net = await networkError();
  if (net) return { ok: false, error: net };

  const open = await openRecord(empId);
  if (!open || !open.break_start) return { ok: false, error: "No break in progress." };

  const now = jakartaTime();
  const breakMin = (open.break_minutes ?? 0) + Math.max(0, toMin(now) - toMin(open.break_start));
  const breaks = (Array.isArray(open.breaks) ? open.breaks : []) as { start: string; end: string }[];
  breaks.push({ start: open.break_start, end: now });
  const { error } = await serviceClient()
    .from("attendance")
    .update({ break_minutes: breakMin, break_start: null, breaks, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", open.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me");
  return { ok: true };
}

// ─── Overtime (clock-based) ──────────────────────────────────────────────────

function otHours(clockIn: string, clockOut: string, breakMin: number): number {
  let diff = toMin(clockOut) - toMin(clockIn);
  if (diff < 0) diff += 24 * 60;
  diff -= breakMin;
  return Math.max(0, Math.round((diff / 60) * 100) / 100);
}

async function openOvertimeRecord(empId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("overtime_requests")
    .select("id,clock_in,break_start,break_minutes,breaks,reason_out")
    .eq("employee_id", empId)
    .eq("work_date", jakartaDate())
    .not("clock_in", "is", null)
    .is("clock_out", null)
    .maybeSingle();
  return data;
}

/**
 * Overtime worked before the shift ends when the shift starts: close the open
 * OT at the shift start and clock the shift in from that moment. Lazy — runs on
 * page load / next action (there's no background job). Idempotent.
 */
async function applyOvertimeTransition(empId: string, profileId: string) {
  const supabase = await createClient();
  const today = jakartaDate();
  const { data: sched } = await supabase
    .from("schedules")
    .select("shift_id, shifts(start_time)")
    .eq("employee_id", empId)
    .eq("work_date", today)
    .maybeSingle();
  const shiftId = sched?.shift_id as string | undefined;
  const start = (sched?.shifts as unknown as { start_time: string | null } | null)?.start_time ?? null;
  if (!shiftId || !start) return;

  const open = await openOvertimeRecord(empId);
  if (!open?.clock_in) return;
  const now = jakartaTime();
  // Only OT that began before the shift start and has now reached it.
  if (!(toMin(open.clock_in) < toMin(start) && toMin(now) >= toMin(start))) return;

  const svc = serviceClient();
  let breakMin = open.break_minutes ?? 0;
  const breaks = (Array.isArray(open.breaks) ? open.breaks : []) as { start: string; end: string }[];
  if (open.break_start) {
    breakMin += Math.max(0, toMin(start) - toMin(open.break_start));
    breaks.push({ start: open.break_start, end: start });
  }
  await svc.from("overtime_requests").update({
    clock_out: start,
    break_minutes: breakMin,
    break_start: null,
    breaks,
    reason_out: open.reason_out || "Auto: shift dimulai",
    hours: otHours(open.clock_in, start, breakMin),
    updated_at: new Date().toISOString(),
  }).eq("id", open.id);

  // Clock the shift in from the shift start, unless already clocked in today.
  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("employee_id", empId)
    .eq("work_date", today)
    .not("clock_in", "is", null)
    .maybeSingle();
  if (!existing) {
    await svc.from("attendance").insert({
      employee_id: empId,
      work_date: today,
      shift_id: shiftId,
      clock_in: start,
      source: "mobile",
      note: "Auto clock-in dari overtime",
      created_by: profileId,
      updated_by: profileId,
    });
  }
}

export type OvertimeClockInResult = { ok: true } | { ok: false; error: string; needsShiftClockOut?: boolean };

export async function clockInOvertime(reason: string, geo?: PunchGeo, opts?: { autoCloseShift?: boolean }): Promise<OvertimeClockInResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!reason.trim()) return { ok: false, error: "Isi alasan overtime dulu." };
  const empId = await myEmployeeId(profile.id);
  if (!empId) return { ok: false, error: "No crew profile linked to this account." };

  const supabase = await createClient();

  // Must be eligible: their job level needs an overtime rate.
  const { data: emp } = await supabase.from("employees").select("job_level_id").eq("id", empId).maybeSingle();
  if (!emp?.job_level_id) return { ok: false, error: "Kamu tidak eligible untuk overtime." };
  const { count } = await supabase
    .from("overtime_compensations")
    .select("id", { count: "exact", head: true })
    .eq("job_level_id", emp.job_level_id);
  if (!count) return { ok: false, error: "Kamu tidak eligible untuk overtime." };

  // Resolve any pending overtime→shift transition first.
  await applyOvertimeTransition(empId, profile.id);

  // Can't start overtime while inside the scheduled shift window.
  const today = jakartaDate();
  const { data: sched } = await supabase
    .from("schedules")
    .select("shifts(start_time,end_time)")
    .eq("employee_id", empId)
    .eq("work_date", today)
    .maybeSingle();
  const sShift = (sched?.shifts as unknown as { start_time: string | null; end_time: string | null } | null) ?? null;
  const now = jakartaTime();
  if (withinShiftWindow(now, sShift?.start_time ?? null, sShift?.end_time ?? null)) {
    return { ok: false, error: "Masih dalam jam shift — belum bisa clock in overtime." };
  }

  const guard = await punchGuard(geo, { checkTimeWindow: false });
  if (guard.error) return { ok: false, error: guard.error };

  // Still clocked in to a shift? Offer to auto clock it out first.
  const openShift = await openRecord(empId);
  if (openShift) {
    if (!opts?.autoCloseShift) {
      return { ok: false, error: "Kamu masih clock in shift.", needsShiftClockOut: true };
    }
    let breakMin = openShift.break_minutes ?? 0;
    const breaks = (Array.isArray(openShift.breaks) ? openShift.breaks : []) as { start: string; end: string }[];
    if (openShift.break_start) {
      breakMin += Math.max(0, toMin(now) - toMin(openShift.break_start));
      breaks.push({ start: openShift.break_start, end: now });
    }
    const { error: coErr } = await serviceClient()
      .from("attendance")
      .update({ clock_out: now, break_minutes: breakMin, break_start: null, breaks, updated_by: profile.id, updated_at: new Date().toISOString() })
      .eq("id", openShift.id);
    if (coErr) return { ok: false, error: coErr.message };
  }

  if (await openOvertimeRecord(empId)) return { ok: false, error: "Kamu sudah clock in overtime." };

  const { error } = await serviceClient().from("overtime_requests").insert({
    employee_id: empId,
    work_date: today,
    clock_in: now,
    reason_in: reason.trim(),
    status: "pending",
    source: "mobile",
    requested_by: profile.id,
    break_minutes: 0,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me");
  return { ok: true };
}

export async function clockOutOvertime(reason: string, geo?: PunchGeo): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!reason.trim()) return { ok: false, error: "Isi alasan overtime dulu." };
  const empId = await myEmployeeId(profile.id);
  if (!empId) return { ok: false, error: "No crew profile linked to this account." };
  const guard = await punchGuard(geo, { checkTimeWindow: false });
  if (guard.error) return { ok: false, error: guard.error };

  const open = await openOvertimeRecord(empId);
  if (!open) return { ok: false, error: "Kamu belum clock in overtime." };

  const now = jakartaTime();
  let breakMin = open.break_minutes ?? 0;
  const breaks = (Array.isArray(open.breaks) ? open.breaks : []) as { start: string; end: string }[];
  if (open.break_start) {
    breakMin += Math.max(0, toMin(now) - toMin(open.break_start));
    breaks.push({ start: open.break_start, end: now });
  }

  const { error } = await serviceClient()
    .from("overtime_requests")
    .update({
      clock_out: now,
      break_minutes: breakMin,
      break_start: null,
      breaks,
      reason_out: reason.trim(),
      hours: otHours(open.clock_in as string, now, breakMin),
      updated_at: new Date().toISOString(),
    })
    .eq("id", open.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me");
  return { ok: true };
}

export async function overtimeBreakStart(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  const empId = await myEmployeeId(profile.id);
  if (!empId) return { ok: false, error: "No crew profile linked to this account." };
  const net = await networkError();
  if (net) return { ok: false, error: net };

  const open = await openOvertimeRecord(empId);
  if (!open) return { ok: false, error: "Kamu belum clock in overtime." };
  if (open.break_start) return { ok: false, error: "Kamu sudah break." };

  const { error } = await serviceClient()
    .from("overtime_requests")
    .update({ break_start: jakartaTime(), updated_at: new Date().toISOString() })
    .eq("id", open.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me");
  return { ok: true };
}

export async function overtimeBreakEnd(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  const empId = await myEmployeeId(profile.id);
  if (!empId) return { ok: false, error: "No crew profile linked to this account." };
  const net = await networkError();
  if (net) return { ok: false, error: net };

  const open = await openOvertimeRecord(empId);
  if (!open || !open.break_start) return { ok: false, error: "Tidak ada break berjalan." };

  const now = jakartaTime();
  const breakMin = (open.break_minutes ?? 0) + Math.max(0, toMin(now) - toMin(open.break_start));
  const breaks = (Array.isArray(open.breaks) ? open.breaks : []) as { start: string; end: string }[];
  breaks.push({ start: open.break_start, end: now });
  const { error } = await serviceClient()
    .from("overtime_requests")
    .update({ break_minutes: breakMin, break_start: null, breaks, updated_at: new Date().toISOString() })
    .eq("id", open.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me");
  return { ok: true };
}

/** The current crew's attendance in a date range (newest first). */
export async function getMyAttendance(start: string, end: string): Promise<AttendanceWithRelations[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const empId = await myEmployeeId(profile.id);
  if (!empId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance")
    .select("*, shifts(id,name,start_time,end_time)")
    .eq("employee_id", empId)
    .gte("work_date", start)
    .lte("work_date", end)
    .order("work_date", { ascending: false });
  return (data ?? []) as unknown as AttendanceWithRelations[];
}

export type MyScheduleDay = {
  work_date: string;
  shift: { name: string; start_time: string | null; end_time: string | null } | null;
};

/** The current crew's own schedule in a date range. */
export async function getMySchedule(start: string, end: string): Promise<MyScheduleDay[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const empId = await myEmployeeId(profile.id);
  if (!empId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("schedules")
    .select("work_date, shifts(name,start_time,end_time)")
    .eq("employee_id", empId)
    .gte("work_date", start)
    .lte("work_date", end)
    .order("work_date");
  return (data ?? []).map((r) => ({
    work_date: r.work_date as string,
    shift: (r.shifts ?? null) as unknown as MyScheduleDay["shift"],
  }));
}

export type CrewDayShift = {
  employee_id: string;
  name: string;
  shift: { name: string; start_time: string | null; end_time: string | null } | null;
};

/** Every active crew member and their scheduled shift on a single date. */
export async function getAllSchedule(date: string): Promise<CrewDayShift[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const db = serviceClient();

  // Exclude the account owner/CEO from the roster, matching the admin grid.
  const { data: owner } = await db.from("profiles").select("id").eq("is_owner", true).maybeSingle();

  let crewQuery = db
    .from("employees")
    .select("id, name, join_date, termination_date, last_day")
    .is("deleted_at", null)
    .order("name");
  if (owner?.id) crewQuery = crewQuery.or(`user_id.is.null,user_id.neq.${owner.id}`);

  const [{ data: emps }, { data: scheds }] = await Promise.all([
    crewQuery,
    db.from("schedules").select("employee_id, shifts(name,start_time,end_time)").eq("work_date", date),
  ]);

  const byEmp = new Map<string, CrewDayShift["shift"]>();
  for (const s of (scheds ?? []) as unknown as { employee_id: string; shifts: CrewDayShift["shift"] }[]) {
    byEmp.set(s.employee_id, (s.shifts ?? null) as CrewDayShift["shift"]);
  }

  return ((emps ?? []) as { id: string; name: string; join_date: string | null; termination_date: string | null; last_day: string | null }[])
    // Only crew whose employment window covers the viewed date.
    .filter((e) => {
      if (e.join_date && e.join_date > date) return false;
      const end = e.last_day ?? e.termination_date;
      if (end && end < date) return false;
      return true;
    })
    .map((e) => ({ employee_id: e.id, name: e.name, shift: byEmp.get(e.id) ?? null }));
}

export async function changeMyPassword(newPassword: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!newPassword || newPassword.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };

  await serviceClient().from("profiles").update({ must_change_password: false }).eq("id", profile.id);
  return { ok: true };
}

/** Name + photo for the app header. */
export async function getMyIdentity(): Promise<{ name: string; photo_url: string | null } | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("name,photo_url")
    .eq("user_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle();
  return data ?? null;
}

export type MyProfile = {
  name: string;
  email: string | null;
  phone: string | null;
  birthdate: string | null;
  nik: string | null;
  gender: string | null;
  address: string | null;
  photo_url: string | null;
  join_date: string | null;
  termination_date: string | null;
  last_day: string | null;
  department: string | null;
  job_position: string | null;
  job_level: string | null;
  employment_status: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  account_holder_name: string | null;
};

/** The current crew's own profile: employee info, employment info, bank info (no compensation). */
export async function getMyProfile(): Promise<MyProfile | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select(
      "name,email,phone,birthdate,nik,gender,address,photo_url,join_date,termination_date,last_day,bank_name,bank_account_no,account_holder_name, department:departments(name), job_position:job_positions(name), job_level:job_levels(name), employment_status:employment_statuses(name)",
    )
    .eq("user_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const d = data as unknown as {
    name: string; email: string | null; phone: string | null; birthdate: string | null;
    nik: string | null; gender: string | null; address: string | null; photo_url: string | null;
    join_date: string | null; termination_date: string | null; last_day: string | null;
    bank_name: string | null; bank_account_no: string | null; account_holder_name: string | null;
    department: { name: string } | null; job_position: { name: string } | null;
    job_level: { name: string } | null; employment_status: { name: string } | null;
  };
  return {
    name: d.name, email: d.email, phone: d.phone, birthdate: d.birthdate, nik: d.nik,
    gender: d.gender, address: d.address, photo_url: d.photo_url, join_date: d.join_date,
    termination_date: d.termination_date, last_day: d.last_day,
    department: d.department?.name ?? null, job_position: d.job_position?.name ?? null,
    job_level: d.job_level?.name ?? null, employment_status: d.employment_status?.name ?? null,
    bank_name: d.bank_name, bank_account_no: d.bank_account_no, account_holder_name: d.account_holder_name,
  };
}

export type MyOvertime = {
  id: string; work_date: string; hours: number;
  clock_in: string | null; clock_out: string | null; break_minutes: number;
  reason_in: string | null; reason_out: string | null; reason: string | null;
  status: "pending" | "approved" | "rejected";
};

/** The current crew's overtime requests (newest first). */
export async function getMyOvertime(): Promise<MyOvertime[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const empId = await myEmployeeId(profile.id);
  if (!empId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("overtime_requests")
    .select("id,work_date,hours,clock_in,clock_out,break_minutes,reason_in,reason_out,reason,status")
    .eq("employee_id", empId)
    .order("work_date", { ascending: false });
  return (data ?? []) as MyOvertime[];
}
