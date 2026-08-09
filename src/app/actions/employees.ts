"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { randomBytes } from "crypto";
import type { Department, JobPosition, EmploymentStatus, JobLevel, Employee, Allowance, PayrollComponentVersion } from "@/lib/supabase/types";

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
  join_date: z.string().trim().optional().or(z.literal("")),
  nik: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  gender: z.enum(["male", "female"]).nullable().optional(),
  marital_status: z.enum(["single", "married", "divorced", "widowed"]).nullable().optional(),
  photo_url: z.string().trim().max(1000).nullable().optional().or(z.literal("")),
  department_id: z.string().uuid().nullable().optional(),
  job_position_id: z.string().uuid().nullable().optional(),
  job_level_id: z.string().uuid().nullable().optional(),
  employment_status_id: z.string().uuid().nullable().optional(),
  bank_name: z.string().trim().max(120).optional().or(z.literal("")),
  bank_account_no: z.string().trim().max(60).optional().or(z.literal("")),
  account_holder_name: z.string().trim().max(120).optional().or(z.literal("")),
  basic_salary: z.coerce.number().min(0).nullable().optional(),
  salary_unit: z.enum(["day", "month"]).nullable().optional(),
  daily_allowance: z.coerce.number().min(0).nullable().optional(),
  allowances: z
    .array(z.object({ allowance_id: z.string().uuid(), amount: z.coerce.number().min(0) }))
    .optional()
    .default([]),
});

const masterNameSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});

const jobLevelSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  sort_order: z.coerce.number().int().default(0),
});

const jobPositionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  department_id: z.string().uuid().nullable().optional(),
});

// Seeded employment types that can't be edited or deleted (plus "Uncategorized").
const PROTECTED_EMPLOYMENT_TYPES = ["Uncategorized", "Permanent", "Contract", "Part-time"];

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
      join_date: toNull(d.join_date),
      nik: toNull(d.nik),
      address: toNull(d.address),
      gender: toNull(d.gender),
      marital_status: toNull(d.marital_status),
      photo_url: toNull(d.photo_url),
      department_id: toNull(d.department_id),
      job_position_id: toNull(d.job_position_id),
      job_level_id: toNull(d.job_level_id),
      employment_status_id: toNull(d.employment_status_id),
      bank_name: toNull(d.bank_name),
      bank_account_no: toNull(d.bank_account_no),
      account_holder_name: toNull(d.account_holder_name),
      basic_salary: d.basic_salary ?? null,
      salary_unit: d.salary_unit ?? null,
      daily_allowance: d.daily_allowance ?? null,
      allowances: d.allowances ?? [],
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
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
      join_date: toNull(d.join_date),
      nik: toNull(d.nik),
      address: toNull(d.address),
      gender: toNull(d.gender),
      marital_status: toNull(d.marital_status),
      photo_url: toNull(d.photo_url),
      department_id: toNull(d.department_id),
      job_position_id: toNull(d.job_position_id),
      job_level_id: toNull(d.job_level_id),
      employment_status_id: toNull(d.employment_status_id),
      bank_name: toNull(d.bank_name),
      bank_account_no: toNull(d.bank_account_no),
      account_holder_name: toNull(d.account_holder_name),
      basic_salary: d.basic_salary ?? null,
      salary_unit: d.salary_unit ?? null,
      daily_allowance: d.daily_allowance ?? null,
      allowances: d.allowances ?? [],
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true };
}

const resignSchema = z.object({
  termination_date: z.string().trim().min(1, "Termination date is required"),
  last_day: z.string().trim().min(1, "Last day is required"),
});

export async function resignEmployee(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = resignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({
      termination_date: parsed.data.termination_date,
      last_day: parsed.data.last_day,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true };
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  // Block deletion of account owners
  const { data: emp } = await supabase
    .from("employees")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (emp?.user_id) {
    const { data: linkedProfile } = await supabase
      .from("profiles")
      .select("is_owner")
      .eq("id", emp.user_id)
      .maybeSingle();
    if (linkedProfile?.is_owner) return { ok: false, error: "Cannot delete the account owner." };
  }

  const { error } = await supabase
    .from("employees")
    .update({ deleted_at: new Date().toISOString(), updated_by: profile.id })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true };
}

// ─── Employee form data ───────────────────────────────────────────────────────

export type EmployeeFormData = {
  departments: Department[];
  jobPositions: JobPosition[];
  employmentStatuses: EmploymentStatus[];
  jobLevels: JobLevel[];
  allowances: Allowance[];
  employee: Employee | null;
};

export async function getEmployeeFormData(employeeId?: string): Promise<EmployeeFormData | null> {
  const profile = await getCurrentProfile();
  if (!can(profile, P.EMPLOYEES_WRITE)) return null;

  const supabase = await createClient();

  const [deptResult, posResult, statusResult, levelResult, allowanceResult] = await Promise.all([
    supabase.from("departments").select("id,name,updated_by,updated_at").order("name"),
    supabase.from("job_positions").select("id,name,department_id,updated_by,updated_at").order("name"),
    supabase.from("employment_statuses").select("id,name,updated_by,updated_at").order("name"),
    supabase.from("job_levels").select("id,name,sort_order,updated_by,updated_at").order("sort_order").order("name"),
    supabase.from("allowances").select("id,name,type,is_default,updated_by,updated_at").order("is_default", { ascending: false }).order("name"),
  ]);

  const departments = (deptResult.data ?? []) as Department[];
  const jobPositions = (posResult.data ?? []) as JobPosition[];
  const employmentStatuses = (statusResult.data ?? []) as EmploymentStatus[];
  const jobLevels = (levelResult.data ?? []) as JobLevel[];
  const allowances = (allowanceResult.data ?? []) as Allowance[];

  if (!employeeId) {
    return { departments, jobPositions, employmentStatuses, jobLevels, allowances, employee: null };
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
    allowances,
    employee: (employeeData ?? null) as Employee | null,
  };
}

// ─── Allowances (master) ────────────────────────────────────────────────────

const payrollComponentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.enum(["earning", "deduction"]),
  effective_date: z.string().trim().min(1, "Effective date is required"),
});

export async function createAllowance(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = payrollComponentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("allowances")
    .insert({ name: d.name, type: d.type, updated_by: profile.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const { error: verr } = await supabase.from("payroll_component_versions").insert({
    component_id: data.id,
    effective_date: d.effective_date,
    created_by: profile.id,
  });
  if (verr) return { ok: false, error: verr.message };

  revalidatePath("/hr", "layout");
  return { ok: true, id: data.id };
}

export async function updateAllowance(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = payrollComponentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("allowances")
    .update({ name: d.name, type: d.type, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Upsert the version for this effective date (new date → new history row).
  const { error: verr } = await supabase
    .from("payroll_component_versions")
    .upsert(
      { component_id: id, effective_date: d.effective_date, created_by: profile.id },
      { onConflict: "component_id,effective_date" },
    );
  if (verr) return { ok: false, error: verr.message };

  revalidatePath("/hr", "layout");
  return { ok: true };
}

export async function getPayrollComponent(id: string) {
  const supabase = await createClient();
  const [{ data: component }, { data: versions }] = await Promise.all([
    supabase.from("allowances").select("id,name,type,is_default,updated_by,updated_at").eq("id", id).maybeSingle(),
    supabase.from("payroll_component_versions").select("id,component_id,effective_date,amount,rate_unit,created_by,created_at").eq("component_id", id).order("effective_date", { ascending: true }),
  ]);
  return { component: component as Allowance | null, versions: (versions ?? []) as PayrollComponentVersion[] };
}

export async function deleteAllowance(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { data: target } = await supabase.from("allowances").select("is_default").eq("id", id).maybeSingle();
  if (target?.is_default) return { ok: false, error: "The default Daily allowance can't be deleted." };

  const { error } = await supabase.from("allowances").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  return { ok: true };
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
  revalidatePath("/hr", "layout");
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
  revalidatePath("/hr", "layout");
  revalidateTag("departments", "max");
  return { ok: true };
}

export async function deleteDepartment(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  const { data: target } = await supabase.from("departments").select("name").eq("id", id).maybeSingle();
  if (target?.name === "Uncategorized") return { ok: false, error: "The Uncategorized department can't be deleted." };

  // Move any crew in this department to Uncategorized so no assignment is lost.
  let { data: uncat } = await supabase.from("departments").select("id").eq("name", "Uncategorized").maybeSingle();
  if (!uncat) {
    const ins = await supabase.from("departments").insert({ name: "Uncategorized", updated_by: profile.id }).select("id").single();
    uncat = ins.data;
  }
  if (uncat) {
    await supabase.from("employees").update({ department_id: uncat.id }).eq("department_id", id);
    await supabase.from("job_positions").update({ department_id: uncat.id }).eq("department_id", id);
  }

  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  revalidateTag("departments", "max");
  return { ok: true };
}

// ─── Job positions ────────────────────────────────────────────────────────────

export async function createJobPosition(input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = jobPositionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!parsed.data.department_id) return { ok: false, error: "Department is required" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_positions")
    .insert({ name: parsed.data.name, department_id: parsed.data.department_id, updated_by: profile.id })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  revalidateTag("job_positions", "max");
  return { ok: true, id: data.id };
}

export async function updateJobPosition(id: string, input: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const parsed = jobPositionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!parsed.data.department_id) return { ok: false, error: "Department is required" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_positions")
    .update({ name: parsed.data.name, department_id: parsed.data.department_id, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  revalidateTag("job_positions", "max");
  return { ok: true };
}

export async function deleteJobPosition(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  const { data: target } = await supabase.from("job_positions").select("name").eq("id", id).maybeSingle();
  if (target?.name === "Uncategorized") return { ok: false, error: "The Uncategorized job position can't be deleted." };

  let { data: uncat } = await supabase.from("job_positions").select("id").eq("name", "Uncategorized").maybeSingle();
  if (!uncat) {
    const ins = await supabase.from("job_positions").insert({ name: "Uncategorized", updated_by: profile.id }).select("id").single();
    uncat = ins.data;
  }
  if (uncat) await supabase.from("employees").update({ job_position_id: uncat.id }).eq("job_position_id", id);

  const { error } = await supabase.from("job_positions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
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
  revalidatePath("/hr", "layout");
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

  const { data: target } = await supabase.from("employment_statuses").select("name").eq("id", id).maybeSingle();
  if (target && PROTECTED_EMPLOYMENT_TYPES.includes(target.name)) {
    return { ok: false, error: `“${target.name}” is a default employment type and can't be edited.` };
  }

  const { error } = await supabase
    .from("employment_statuses")
    .update({ name: parsed.data.name, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  revalidateTag("employment_statuses", "max");
  return { ok: true };
}

export async function deleteEmploymentStatus(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  const { data: target } = await supabase.from("employment_statuses").select("name").eq("id", id).maybeSingle();
  if (target && PROTECTED_EMPLOYMENT_TYPES.includes(target.name)) {
    return { ok: false, error: `“${target.name}” is a default employment type and can't be deleted.` };
  }

  let { data: uncat } = await supabase.from("employment_statuses").select("id").eq("name", "Uncategorized").maybeSingle();
  if (!uncat) {
    const ins = await supabase.from("employment_statuses").insert({ name: "Uncategorized", updated_by: profile.id }).select("id").single();
    uncat = ins.data;
  }
  if (uncat) await supabase.from("employees").update({ employment_status_id: uncat.id }).eq("employment_status_id", id);

  const { error } = await supabase.from("employment_statuses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
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
  revalidatePath("/hr", "layout");
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
  revalidatePath("/hr", "layout");
  revalidateTag("job_levels", "max");
  return { ok: true };
}

export async function deleteJobLevel(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  const { data: target } = await supabase.from("job_levels").select("name").eq("id", id).maybeSingle();
  if (target?.name === "Uncategorized") return { ok: false, error: "The Uncategorized job level can't be deleted." };

  let { data: uncat } = await supabase.from("job_levels").select("id").eq("name", "Uncategorized").maybeSingle();
  if (!uncat) {
    const ins = await supabase.from("job_levels").insert({ name: "Uncategorized", updated_by: profile.id }).select("id").single();
    uncat = ins.data;
  }
  if (uncat) await supabase.from("employees").update({ job_level_id: uncat.id }).eq("job_level_id", id);

  const { error } = await supabase.from("job_levels").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr", "layout");
  revalidateTag("job_levels", "max");
  return { ok: true };
}

// ─── System access ────────────────────────────────────────────────────────────

export async function grantEmployeeAccess(
  employeeId: string,
  input: { email: string; role: "admin" | "crew" },
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

  revalidatePath("/hr", "layout");
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

  revalidatePath("/hr", "layout");
  return { ok: true };
}
