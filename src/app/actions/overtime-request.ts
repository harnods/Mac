"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import type { OvertimeRequestWithCrew } from "@/lib/supabase/types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const requestSchema = z.object({
  employee_id: z.string().uuid("Crew is required"),
  work_date: z.string().trim().min(1, "Date is required"),
  hours: z.coerce.number().positive("Hours must be greater than 0").max(24),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

const COLUMNS =
  "id,employee_id,work_date,hours,reason,status,requested_by,reviewed_by,reviewed_at,created_at,updated_at, employees(id,name)";

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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("overtime_requests")
    .insert({
      employee_id: d.employee_id,
      work_date: d.work_date,
      hours: d.hours,
      reason: d.reason || null,
      status: "pending",
      requested_by: profile.id,
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

  const supabase = await createClient();
  const { error } = await supabase
    .from("overtime_requests")
    .update({ employee_id: d.employee_id, work_date: d.work_date, hours: d.hours, reason: d.reason || null, updated_at: new Date().toISOString() })
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
