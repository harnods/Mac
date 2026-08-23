"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import type { OvertimeRequestWithCrew } from "@/lib/supabase/types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const time = z.string().trim().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time").optional().or(z.literal(""));

const requestSchema = z.object({
  employee_id: z.string().uuid("Crew is required"),
  work_date: z.string().trim().min(1, "Date is required"),
  clock_in: time,
  clock_out: time,
  break_minutes: z.coerce.number().min(0).max(24 * 60).optional().default(0),
  reason_in: z.string().trim().max(500).optional().or(z.literal("")),
  reason_out: z.string().trim().max(500).optional().or(z.literal("")),
  status: z.enum(["pending", "approved", "rejected"]).optional().default("pending"),
});

const COLUMNS =
  "id,employee_id,work_date,hours,clock_in,clock_out,break_minutes,break_start,breaks,reason,reason_in,reason_out,source,status,requested_by,reviewed_by,reviewed_at,created_at,updated_at, employees(id,name)";

/** hours from HH:MM times minus break (handles overnight). 0 if incomplete. */
function computeHours(clockIn?: string, clockOut?: string, breakMin = 0): number {
  if (!clockIn || !clockOut) return 0;
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
  let diff = toMin(clockOut) - toMin(clockIn);
  if (diff < 0) diff += 24 * 60;
  diff -= breakMin;
  return Math.max(0, Math.round((diff / 60) * 100) / 100);
}

export async function getOvertimeRequests(): Promise<OvertimeRequestWithCrew[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("overtime_requests")
    .select(COLUMNS)
    .order("work_date", { ascending: false });
  return (data ?? []) as unknown as OvertimeRequestWithCrew[];
}

export async function createOvertimeRequest(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const reviewed = d.status !== "pending";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("overtime_requests")
    .insert({
      employee_id: d.employee_id,
      work_date: d.work_date,
      clock_in: d.clock_in || null,
      clock_out: d.clock_out || null,
      break_minutes: d.break_minutes,
      hours: computeHours(d.clock_in || undefined, d.clock_out || undefined, d.break_minutes),
      reason_in: d.reason_in || null,
      reason_out: d.reason_out || null,
      status: d.status,
      source: "manual",
      requested_by: profile.id,
      reviewed_by: reviewed ? profile.id : null,
      reviewed_at: reviewed ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true, id: data.id };
}

export async function updateOvertimeRequest(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const reviewed = d.status !== "pending";
  const supabase = await createClient();
  const { error } = await supabase
    .from("overtime_requests")
    .update({
      employee_id: d.employee_id,
      work_date: d.work_date,
      clock_in: d.clock_in || null,
      clock_out: d.clock_out || null,
      break_minutes: d.break_minutes,
      hours: computeHours(d.clock_in || undefined, d.clock_out || undefined, d.break_minutes),
      reason_in: d.reason_in || null,
      reason_out: d.reason_out || null,
      status: d.status,
      reviewed_by: reviewed ? profile.id : null,
      reviewed_at: reviewed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true };
}

export async function setOvertimeRequestStatus(id: string, status: "approved" | "rejected" | "pending"): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("overtime_requests")
    .update({
      status,
      reviewed_by: status === "pending" ? null : profile.id,
      reviewed_at: status === "pending" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true };
}

export async function deleteOvertimeRequest(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase.from("overtime_requests").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true };
}
