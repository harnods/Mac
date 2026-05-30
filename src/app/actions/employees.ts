"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { randomBytes } from "crypto";
import type { Department, JobPosition, EmploymentStatus, JobLevel, Employee } from "@/lib/supabase/types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };
export type AccessResult =
  | { ok: true; email: string; password: string }
  | { ok: false; error: string };

function genPassword() {
  return randomBytes(12).toString("base64url");
}

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const employeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Invalid email").max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  birthdate: z.string().trim().optional().or(z.literal("")),
  nik: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  gender: z.enum(["male", "female"]).nullable().optional(),
  marital_status: z.enum(["single", "married", "divorced", "widowed"]).nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  job_position_id: z.string().uuid().nullable().optional(),
  job_level_id: z.string().uuid().nullable().optional(),
  employment_status_id: z.string().uuid().nullable().optional(),
});

const masterNameSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});

const jobLevelSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  sort_order: z.coerce.number().int().default(0),
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function toNull<T>(val: T | "" | undefined | null): T | null {
  if (val === "" || val === undefined) return null;
  return val ?? null;
}

// ─── Employee actions ─────────────────────────────────────────────────────────

export async function createEmployee(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .insert({
      name: d.name,
      email: toNull(d.email),
      phone: toNull(d.phone),
      birthdate: toNull(d.birthdate),
      nik: toNull(d.nik),
      address: toNull(d.address),
      gender: toNull(d.gender),
      marital_status: toNull(d.marital_status),
      department_id: toNull(d.department_id),
      job_position_id: toNull(d.job_position_id),
      job_level_id: toNull(d.job_level_id),
      employment_status_id: toNull(d.employment_status_id),
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  return { ok: true, id: data.id };
}

export async function updateEmployee(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({
      name: d.name,
      email: toNull(d.email),
      phone: toNull(d.phone),
      birthdate: toNull(d.birthdate),
      nik: toNull(d.nik),
      address: toNull(d.address),
      gender: toNull(d.gender),
      marital_status: toNull(d.marital_status),
      department_id: toNull(d.department_id),
      job_position_id: toNull(d.job_position_id),
      job_level_id: toNull(d.job_level_id),
      employment_status_id: toNull(d.employment_status_id),
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  return { ok: true };
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({ deleted_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  return { ok: true };
}

// ─── Employee form data ───────────────────────────────────────────────────────

export type EmployeeFormData = {
  departments: Department[];
  jobPositions: JobPosition[];
  employmentStatuses: EmploymentStatus[];
  jobLevels: JobLevel[];
  employee: Employee | null;
};

export async function getEmployeeFormData(employeeId?: string): Promise<EmployeeFormData | null> {
  const profile = await getCurrentProfile();
  if (!can(profile, P.EMPLOYEES_WRITE)) return null;

  const supabase = await createClient();

  const [deptResult, posResult, statusResult, levelResult] = await Promise.all([
    supabase.from("departments").select("id,name,updated_by,updated_at").order("name"),
    supabase.from("job_positions").select("id,name,updated_by,updated_at").order("name"),
    supabase.from("employment_statuses").select("id,name,updated_by,updated_at").order("name"),
    supabase.from("job_levels").select("id,name,sort_order,updated_by,updated_at").order("sort_order").order("name"),
  ]);

  const departments = (deptResult.data ?? []) as Department[];
  const jobPositions = (posResult.data ?? []) as JobPosition[];
  const employmentStatuses = (statusResult.data ?? []) as EmploymentStatus[];
  const jobLevels = (levelResult.data ?? []) as JobLevel[];

  if (!employeeId) {
    return { departments, jobPositions, employmentStatuses, jobLevels, employee: null };
  }

  const { data: employeeData } = await supabase
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  return {
    departments,
    jobPositions,
    employmentStatuses,
    jobLevels,
    employee: (employeeData ?? null) as Employee | null,
  };
}

// ─── Departments ──────────────────────────────────────────────────────────────

export async function createDepartment(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = masterNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .insert({ name: parsed.data.name, updated_by: profile.id })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  revalidateTag("departments", "max");
  return { ok: true, id: data.id };
}

export async function updateDepartment(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = masterNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .update({ name: parsed.data.name, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  revalidateTag("departments", "max");
  return { ok: true };
}

export async function deleteDepartment(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("department_id", id)
    .is("deleted_at", null);

  if ((count ?? 0) > 0) {
    return { ok: false, error: "Cannot delete — department is used by employees." };
  }

  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  revalidateTag("departments", "max");
  return { ok: true };
}

// ─── Job positions ────────────────────────────────────────────────────────────

export async function createJobPosition(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = masterNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_positions")
    .insert({ name: parsed.data.name, updated_by: profile.id })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  revalidateTag("job_positions", "max");
  return { ok: true, id: data.id };
}

export async function updateJobPosition(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = masterNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_positions")
    .update({ name: parsed.data.name, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  revalidateTag("job_positions", "max");
  return { ok: true };
}

export async function deleteJobPosition(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("job_position_id", id)
    .is("deleted_at", null);

  if ((count ?? 0) > 0) {
    return { ok: false, error: "Cannot delete — position is used by employees." };
  }

  const { error } = await supabase.from("job_positions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  revalidateTag("job_positions", "max");
  return { ok: true };
}

// ─── Employment statuses ──────────────────────────────────────────────────────

export async function createEmploymentStatus(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = masterNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employment_statuses")
    .insert({ name: parsed.data.name, updated_by: profile.id })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  revalidateTag("employment_statuses", "max");
  return { ok: true, id: data.id };
}

export async function updateEmploymentStatus(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = masterNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("employment_statuses")
    .update({ name: parsed.data.name, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  revalidateTag("employment_statuses", "max");
  return { ok: true };
}

export async function deleteEmploymentStatus(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("employment_status_id", id)
    .is("deleted_at", null);

  if ((count ?? 0) > 0) {
    return { ok: false, error: "Cannot delete — status is used by employees." };
  }

  const { error } = await supabase.from("employment_statuses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  revalidateTag("employment_statuses", "max");
  return { ok: true };
}

// ─── Job levels ───────────────────────────────────────────────────────────────

export async function createJobLevel(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = jobLevelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_levels")
    .insert({ name: parsed.data.name, sort_order: parsed.data.sort_order, updated_by: profile.id })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  revalidateTag("job_levels", "max");
  return { ok: true, id: data.id };
}

export async function updateJobLevel(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = jobLevelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_levels")
    .update({ name: parsed.data.name, sort_order: parsed.data.sort_order, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  revalidateTag("job_levels", "max");
  return { ok: true };
}

export async function deleteJobLevel(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("job_level_id", id)
    .is("deleted_at", null);

  if ((count ?? 0) > 0) {
    return { ok: false, error: "Cannot delete — job level is used by employees." };
  }

  const { error } = await supabase.from("job_levels").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/employees", "layout");
  revalidateTag("job_levels", "max");
  return { ok: true };
}

// ─── System access ────────────────────────────────────────────────────────────

export async function grantEmployeeAccess(
  employeeId: string,
  input: { email: string; role: "admin" | "staff" },
): Promise<AccessResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_ACCESS)) return { ok: false, error: "No permission" };

  const { email, role } = input;
  if (!email?.trim()) return { ok: false, error: "Email is required to grant access" };

  const supabase = await createClient();
  const admin = serviceClient();
  const password = genPassword();

  // Check the employee exists and has no user yet
  const { data: emp } = await supabase
    .from("employees")
    .select("id, user_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (!emp) return { ok: false, error: "Employee not found" };
  if (emp.user_id) return { ok: false, error: "Employee already has system access" };

  // Create the auth user
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: "", role },
  });
  if (authErr || !authUser.user) return { ok: false, error: authErr?.message ?? "Failed to create user" };

  const userId = authUser.user.id;

  // Upsert profile (trigger may have already created it)
  await supabase
    .from("profiles")
    .upsert({ id: userId, email: email.trim(), role }, { onConflict: "id" });

  // Link to employee
  const { error: linkErr } = await supabase
    .from("employees")
    .update({ user_id: userId, updated_by: profile.id })
    .eq("id", employeeId);

  if (linkErr) {
    // Roll back auth user creation
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: linkErr.message };
  }

  revalidatePath("/employees", "layout");
  return { ok: true, email: email.trim(), password };
}

export async function revokeEmployeeAccess(employeeId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_ACCESS)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const admin = serviceClient();

  const { data: emp } = await supabase
    .from("employees")
    .select("id, user_id")
    .eq("id", employeeId)
    .maybeSingle();

  if (!emp) return { ok: false, error: "Employee not found" };
  if (!emp.user_id) return { ok: false, error: "Employee has no system access" };

  // Unlink first, then delete auth user
  await supabase
    .from("employees")
    .update({ user_id: null, updated_by: profile.id })
    .eq("id", employeeId);

  await admin.auth.admin.deleteUser(emp.user_id);

  revalidatePath("/employees", "layout");
  return { ok: true };
}
