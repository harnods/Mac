"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import type { HiringStage } from "@/lib/recruitment";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function service() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type OpeningRow = {
  id: string;
  code: string;
  title: string | null;
  status: "open" | "closed";
  min_experience_years: number;
  headcount: number;
  position: string | null;
  department: string | null;
  level: string | null;
  employment_type: string | null;
  candidate_count: number;
  hired_count: number;
  created_at: string;
};

export type OpeningDetail = {
  id: string;
  code: string;
  title: string | null;
  status: "open" | "closed";
  description: string | null;
  min_experience_years: number;
  headcount: number;
  require_physical: boolean;
  min_height_cm: number | null;
  min_weight_kg: number | null;
  job_position_id: string | null;
  department_id: string | null;
  job_level_id: string | null;
  employment_status_id: string | null;
  position: string | null;
  department: string | null;
  level: string | null;
  employment_type: string | null;
  created_at: string;
};

export type Candidate = {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  experience_years: number | null;
  expected_salary: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  cover_note: string | null;
  resume_path: string | null;
  stage: HiringStage;
  created_at: string;
};

export type RecruitmentFormData = {
  positions: { id: string; name: string; department_id: string | null }[];
  departments: { id: string; name: string }[];
  levels: { id: string; name: string }[];
  employmentTypes: { id: string; name: string }[];
};

type OpeningJoin = {
  id: string; code: string; title: string | null; status: "open" | "closed";
  min_experience_years: number; headcount: number; created_at: string;
  require_physical: boolean; min_height_cm: number | null; min_weight_kg: number | null;
  job_position_id: string | null; department_id: string | null;
  job_level_id: string | null; employment_status_id: string | null;
  description: string | null;
  job_positions: { name: string } | null;
  departments: { name: string } | null;
  job_levels: { name: string } | null;
  employment_statuses: { name: string } | null;
};

const OPENING_SELECT =
  "id,code,title,status,description,min_experience_years,headcount,require_physical,min_height_cm,min_weight_kg,created_at,job_position_id,department_id,job_level_id,employment_status_id,job_positions(name),departments(name),job_levels(name),employment_statuses(name)";

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getOpenings(): Promise<OpeningRow[]> {
  const supabase = await createClient();
  const [{ data }, { data: cands }] = await Promise.all([
    supabase.from("job_openings").select(OPENING_SELECT).order("created_at", { ascending: false }),
    supabase.from("candidates").select("opening_id,stage"),
  ]);
  const total = new Map<string, number>();
  const hired = new Map<string, number>();
  for (const c of (cands ?? []) as { opening_id: string; stage: string }[]) {
    total.set(c.opening_id, (total.get(c.opening_id) ?? 0) + 1);
    if (c.stage === "hired") hired.set(c.opening_id, (hired.get(c.opening_id) ?? 0) + 1);
  }
  return ((data ?? []) as unknown as OpeningJoin[]).map((o) => ({
    id: o.id, code: o.code, title: o.title, status: o.status,
    min_experience_years: Number(o.min_experience_years), headcount: o.headcount,
    position: o.job_positions?.name ?? null,
    department: o.departments?.name ?? null,
    level: o.job_levels?.name ?? null,
    employment_type: o.employment_statuses?.name ?? null,
    candidate_count: total.get(o.id) ?? 0,
    hired_count: hired.get(o.id) ?? 0,
    created_at: o.created_at,
  }));
}

export async function getOpeningDetail(id: string): Promise<{ opening: OpeningDetail; candidates: Candidate[] } | null> {
  const supabase = await createClient();
  const { data: o } = await supabase.from("job_openings").select(OPENING_SELECT).eq("id", id).maybeSingle();
  if (!o) return null;
  const row = o as unknown as OpeningJoin;
  const { data: cands } = await supabase
    .from("candidates")
    .select("id,name,whatsapp,email,experience_years,expected_salary,height_cm,weight_kg,cover_note,resume_path,stage,created_at")
    .eq("opening_id", id)
    .order("created_at", { ascending: false });
  return {
    opening: {
      id: row.id, code: row.code, title: row.title, status: row.status, description: row.description,
      min_experience_years: Number(row.min_experience_years), headcount: row.headcount,
      job_position_id: row.job_position_id, department_id: row.department_id,
      require_physical: !!row.require_physical,
      min_height_cm: row.min_height_cm == null ? null : Number(row.min_height_cm),
      min_weight_kg: row.min_weight_kg == null ? null : Number(row.min_weight_kg),
      job_level_id: row.job_level_id, employment_status_id: row.employment_status_id,
      position: row.job_positions?.name ?? null, department: row.departments?.name ?? null,
      level: row.job_levels?.name ?? null, employment_type: row.employment_statuses?.name ?? null,
      created_at: row.created_at,
    },
    candidates: ((cands ?? []) as unknown as Candidate[]).map((c) => ({
      ...c,
      experience_years: c.experience_years == null ? null : Number(c.experience_years),
      expected_salary: c.expected_salary == null ? null : Number(c.expected_salary),
      height_cm: c.height_cm == null ? null : Number(c.height_cm),
      weight_kg: c.weight_kg == null ? null : Number(c.weight_kg),
    })),
  };
}

export async function getRecruitmentFormData(): Promise<RecruitmentFormData> {
  const supabase = await createClient();
  const [{ data: positions }, { data: departments }, { data: levels }, { data: types }] = await Promise.all([
    supabase.from("job_positions").select("id,name,department_id").order("name"),
    supabase.from("departments").select("id,name").order("name"),
    supabase.from("job_levels").select("id,name").order("sort_order").order("name"),
    supabase.from("employment_statuses").select("id,name").order("name"),
  ]);
  return {
    positions: (positions ?? []) as RecruitmentFormData["positions"],
    departments: (departments ?? []) as RecruitmentFormData["departments"],
    levels: (levels ?? []) as RecruitmentFormData["levels"],
    employmentTypes: (types ?? []) as RecruitmentFormData["employmentTypes"],
  };
}

// ─── Write ────────────────────────────────────────────────────────────────────

export type OpeningInput = {
  title?: string | null;
  job_position_id: string | null;
  department_id: string | null;
  job_level_id: string | null;
  employment_status_id: string | null;
  min_experience_years: number;
  headcount: number;
  require_physical: boolean;
  min_height_cm: number | null;
  min_weight_kg: number | null;
  description?: string | null;
};

function cleanOpening(input: OpeningInput) {
  const physical = !!input.require_physical;
  return {
    title: input.title?.trim() || null,
    job_position_id: input.job_position_id,
    department_id: input.department_id,
    job_level_id: input.job_level_id,
    employment_status_id: input.employment_status_id,
    min_experience_years: Math.max(0, Number(input.min_experience_years) || 0),
    headcount: Math.max(1, Math.floor(Number(input.headcount) || 1)),
    require_physical: physical,
    min_height_cm: physical && input.min_height_cm ? Number(input.min_height_cm) : null,
    min_weight_kg: physical && input.min_weight_kg ? Number(input.min_weight_kg) : null,
    description: input.description?.trim() || null,
  };
}

export async function createOpening(input: OpeningInput): Promise<ActionResult<{ id: string; code: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };
  if (!input.job_position_id) return { ok: false, error: "Select a position." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_openings")
    .insert({ code: "", ...cleanOpening(input), created_by: profile.id })
    .select("id, code")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the opening." };
  revalidatePath("/hr/recruitment");
  return { ok: true, data: { id: data.id as string, code: data.code as string } };
}

export async function updateOpening(id: string, input: OpeningInput): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };
  if (!input.job_position_id) return { ok: false, error: "Select a position." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_openings")
    .update({ ...cleanOpening(input), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr/recruitment");
  revalidatePath(`/hr/recruitment/${id}`);
  return { ok: true };
}

export async function setOpeningStatus(id: string, status: "open" | "closed"): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };
  const supabase = await createClient();
  const { error } = await supabase.from("job_openings").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr/recruitment");
  revalidatePath(`/hr/recruitment/${id}`);
  return { ok: true };
}

export async function deleteOpening(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };
  const supabase = await createClient();
  const { error } = await supabase.from("job_openings").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr/recruitment");
  return { ok: true };
}

export async function setCandidateStage(candidateId: string, stage: HiringStage): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };
  const supabase = await createClient();
  const { error } = await supabase.from("candidates").update({ stage, updated_at: new Date().toISOString() }).eq("id", candidateId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Short-lived signed URL to view a candidate's résumé from the private bucket. */
export async function getResumeSignedUrl(candidateId: string): Promise<ActionResult<{ url: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_READ)) return { ok: false, error: "No permission" };
  const db = service();
  const { data: c } = await db.from("candidates").select("resume_path").eq("id", candidateId).maybeSingle();
  const path = (c?.resume_path as string | null) ?? null;
  if (!path) return { ok: false, error: "This candidate hasn't attached a résumé." };
  const { data, error } = await db.storage.from("resumes").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return { ok: false, error: error?.message ?? "Could not open the résumé." };
  return { ok: true, data: { url: data.signedUrl } };
}
