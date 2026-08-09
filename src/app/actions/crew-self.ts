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
  return isIpAllowed(ip, settings?.allowed_ips) ? null : "You can only clock in/out while on the store wifi.";
}

export type MyContext = {
  employee: { id: string; name: string; photo_url: string | null } | null;
  today: AttendanceWithRelations | null;
  shifts: { id: string; name: string; start_time: string | null; end_time: string | null }[];
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
    .select("id,name,photo_url")
    .eq("user_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle();

  const { data: settings } = await supabase.from("attendance_settings").select("allowed_ips").limit(1).maybeSingle();
  const detectedIp = clientIp(await headers());
  const restricted = !!settings?.allowed_ips?.trim();
  const onStoreNetwork = isIpAllowed(detectedIp, settings?.allowed_ips);

  if (!emp) return { employee: null, today: null, shifts: [], onStoreNetwork, detectedIp, restricted };

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
    supabase.from("shifts").select("id,name,start_time,end_time").not("start_time", "is", null).order("start_time"),
  ]);

  return {
    employee: emp as { id: string; name: string; photo_url: string | null },
    today: (todayRec ?? null) as AttendanceWithRelations | null,
    shifts: (shifts ?? []) as { id: string; name: string; start_time: string | null; end_time: string | null }[],
    onStoreNetwork,
    detectedIp,
    restricted,
  };
}

export async function clockIn(shiftId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  const empId = await myEmployeeId(profile.id);
  if (!empId) return { ok: false, error: "No crew profile linked to this account." };
  if (!shiftId) return { ok: false, error: "Please choose your shift." };
  const net = await networkError();
  if (net) return { ok: false, error: net };

  const supabase = await createClient();
  const today = jakartaDate();
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
    .select("id,break_start,break_minutes,clock_out")
    .eq("employee_id", empId)
    .eq("work_date", jakartaDate())
    .not("clock_in", "is", null)
    .is("clock_out", null)
    .maybeSingle();
  return data;
}

export async function clockOut(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  const empId = await myEmployeeId(profile.id);
  if (!empId) return { ok: false, error: "No crew profile linked to this account." };
  const net = await networkError();
  if (net) return { ok: false, error: net };

  const open = await openRecord(empId);
  if (!open) return { ok: false, error: "You haven't clocked in." };

  const now = jakartaTime();
  let breakMin = open.break_minutes ?? 0;
  if (open.break_start) breakMin += Math.max(0, toMin(now) - toMin(open.break_start)); // auto-end break

  const { error } = await serviceClient()
    .from("attendance")
    .update({ clock_out: now, break_minutes: breakMin, break_start: null, updated_by: profile.id, updated_at: new Date().toISOString() })
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
  const { error } = await serviceClient()
    .from("attendance")
    .update({ break_minutes: breakMin, break_start: null, updated_by: profile.id, updated_at: new Date().toISOString() })
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
