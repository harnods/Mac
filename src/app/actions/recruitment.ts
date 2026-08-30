"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { createEmployee } from "@/app/actions/employees";
import type { HiringStage } from "@/lib/recruitment";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function service() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type Candidate = {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  experience_years: number | null;
  expected_salary: number | null;
  height_cm: number | null;
  cover_note: string | null;
  resume_path: string | null;
  photo_url: string | null;
  reject_reason: string | null;
  hired_employee_id: string | null;
  stage: HiringStage;
  created_at: string;
  birth_place?: string | null;
  birth_date?: string | null;
  domicile?: string | null;
  maps_link?: string | null;
  fresh_graduate?: boolean;
  work_experiences?: { period: string; place: string; position: string; jobdesk: string }[];
  employment_status?: string | null;
  notice_period?: string | null;
  earliest_join?: string | null;
  agree_terms?: boolean | null;
  agree_interview?: boolean | null;
  latest_comment?: string | null;
};

// The board card shows photo, name, expected salary, total experience and when
// they can join — nothing else, so height and the cover note stay off it.
const CANDIDATE_CARD_SELECT =
  "id,name,whatsapp,email,experience_years,expected_salary,fresh_graduate,work_experiences,earliest_join,resume_path,photo_url,reject_reason,hired_employee_id,stage,created_at";
const CANDIDATE_FULL_SELECT =
  CANDIDATE_CARD_SELECT + ",birth_place,birth_date,domicile,maps_link,height_cm,cover_note,employment_status,notice_period,agree_terms,agree_interview";

function num(v: unknown): number | null { return v == null ? null : Number(v); }
/** Best-effort convert a candidate birth date ("DD/MM/YYYY" or "YYYY-MM-DD") to ISO for the crew record. */
function toIsoDate(v: string | null): string {
  if (!v) return "";
  const t = v.trim();
  const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return "";
}
function normCandidate(c: Candidate): Candidate {
  return { ...c, experience_years: num(c.experience_years), expected_salary: num(c.expected_salary), height_cm: num(c.height_cm) };
}

// ─── Positions (the recruitment index) ────────────────────────────────────────

export type PositionRow = { id: string; name: string; candidate_count: number };

/** All job positions (except CEO), each always open for recruitment. */
export async function getPositions(): Promise<PositionRow[]> {
  const supabase = await createClient();
  const [{ data: positions }, { data: cands }] = await Promise.all([
    supabase.from("job_positions").select("id,name").not("name", "ilike", "CEO").order("name"),
    supabase.from("candidates").select("job_position_id"),
  ]);
  const count = new Map<string, number>();
  for (const c of (cands ?? []) as { job_position_id: string | null }[]) {
    if (c.job_position_id) count.set(c.job_position_id, (count.get(c.job_position_id) ?? 0) + 1);
  }
  return ((positions ?? []) as { id: string; name: string }[]).map((p) => ({ id: p.id, name: p.name, candidate_count: count.get(p.id) ?? 0 }));
}

export type PositionDetail = { id: string; name: string; department: string | null };

export async function getPositionDetail(positionId: string): Promise<{ position: PositionDetail; candidates: Candidate[] } | null> {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("job_positions")
    .select("id,name,departments(name)")
    .eq("id", positionId)
    .maybeSingle();
  if (!p) return null;
  const pos = p as unknown as { id: string; name: string; departments: { name: string } | null };
  const { data: cands } = await supabase
    .from("candidates")
    .select(CANDIDATE_CARD_SELECT)
    .eq("job_position_id", positionId)
    .order("created_at", { ascending: false });
  const rows = (cands ?? []) as unknown as Candidate[];

  const latestComments = new Map<string, string>();
  if (rows.length > 0) {
    const { data: comments } = await supabase
      .from("candidate_comments")
      .select("candidate_id,body,created_at")
      .in("candidate_id", rows.map((c) => c.id))
      .order("created_at", { ascending: false });
    // Ordered newest-first, so the first hit per candidate is the latest.
    for (const cm of (comments ?? []) as { candidate_id: string; body: string }[]) {
      if (!latestComments.has(cm.candidate_id)) latestComments.set(cm.candidate_id, cm.body);
    }
  }

  return {
    position: { id: pos.id, name: pos.name, department: pos.departments?.name ?? null },
    candidates: rows.map((c) => ({ ...normCandidate(c), latest_comment: latestComments.get(c.id) ?? null })),
  };
}

// ─── Candidate ────────────────────────────────────────────────────────────────

export async function getCandidate(candidateId: string): Promise<{ candidate: Candidate; positionId: string; positionName: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidates")
    .select(CANDIDATE_FULL_SELECT + ",job_position_id,job_positions(name)")
    .eq("id", candidateId)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as (Candidate & { job_position_id: string | null; job_positions: { name: string } | null });
  return {
    candidate: normCandidate(row),
    positionId: row.job_position_id ?? "",
    positionName: row.job_positions?.name ?? "Posisi",
  };
}

export type CandidateComment = { id: string; body: string; created_at: string; author: string | null };

export async function getCandidateComments(candidateId: string): Promise<CandidateComment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidate_comments")
    .select("id,body,created_at,author:profiles!author_id(full_name,email)")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as { id: string; body: string; created_at: string; author: { full_name: string | null; email: string } | null }[])
    .map((r) => ({ id: r.id, body: r.body, created_at: r.created_at, author: r.author?.full_name ?? r.author?.email ?? null }));
}

export async function addCandidateComment(candidateId: string, body: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };
  const text = body.trim();
  if (!text) return { ok: false, error: "Comment is empty" };
  const supabase = await createClient();
  const { error } = await supabase.from("candidate_comments").insert({ candidate_id: candidateId, author_id: profile.id, body: text });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Move a candidate to a different job position's pipeline, resetting to Applied. */
export async function moveCandidatePosition(candidateId: string, positionId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { data: pos } = await supabase.from("job_positions").select("id").eq("id", positionId).maybeSingle();
  if (!pos) return { ok: false, error: "Position not found" };

  const { data: prev } = await supabase.from("candidates").select("job_position_id,stage").eq("id", candidateId).maybeSingle();
  if (prev?.job_position_id === positionId) return { ok: true };

  const { error } = await supabase
    .from("candidates")
    .update({ job_position_id: positionId, stage: "applied", reject_reason: null, updated_at: new Date().toISOString() })
    .eq("id", candidateId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("candidate_events").insert({
    candidate_id: candidateId, actor_id: profile.id, type: "stage_changed",
    from_stage: (prev?.stage as string | undefined) ?? null, to_stage: "applied",
  });
  return { ok: true };
}

export async function deleteCandidate(candidateId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };
  const db = service();
  const { data: c } = await db.from("candidates").select("resume_path,photo_url").eq("id", candidateId).maybeSingle();
  if (c?.resume_path) await db.storage.from("resumes").remove([c.resume_path as string]);
  if (c?.photo_url) {
    const marker = "/candidate-photos/";
    const i = (c.photo_url as string).indexOf(marker);
    if (i >= 0) await db.storage.from("candidate-photos").remove([(c.photo_url as string).slice(i + marker.length)]);
  }
  const { error } = await db.from("candidates").delete().eq("id", candidateId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getResumeSignedUrl(candidateId: string): Promise<ActionResult<{ url: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_READ)) return { ok: false, error: "No permission" };
  const db = service();
  const { data: c } = await db.from("candidates").select("resume_path").eq("id", candidateId).maybeSingle();
  const path = (c?.resume_path as string | null) ?? null;
  if (!path) return { ok: false, error: "Kandidat ini belum melampirkan resume." };
  const { data, error } = await db.storage.from("resumes").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return { ok: false, error: error?.message ?? "Gagal membuka resume." };
  return { ok: true, data: { url: data.signedUrl } };
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export type HireInput = {
  basicSalary?: number | null;
  allowances?: { allowance_id: string; amount: number; rate_unit?: "day" | "week" | "month"; per_attendance?: boolean }[];
};

export async function setCandidateStage(candidateId: string, stage: HiringStage, reason?: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };
  if (stage === "hired") return hireCandidate(candidateId);

  const supabase = await createClient();
  const { data: prev } = await supabase.from("candidates").select("stage").eq("id", candidateId).maybeSingle();
  const fromStage = (prev?.stage as string | undefined) ?? null;

  const patch: Record<string, unknown> = { stage, updated_at: new Date().toISOString() };
  if (stage === "rejected") patch.reject_reason = reason?.trim() || null;
  const { error } = await supabase.from("candidates").update(patch).eq("id", candidateId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("candidate_events").insert({ candidate_id: candidateId, actor_id: profile.id, type: "stage_changed", from_stage: fromStage, to_stage: stage });
  return { ok: true };
}

/** Mark a candidate Hired and create a crew record from the candidate + their
 *  job position + the recruiter-entered salary/components. Idempotent. */
export async function hireCandidate(candidateId: string, hire?: HireInput): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { data: cand } = await supabase
    .from("candidates")
    .select("id,name,whatsapp,email,photo_url,birth_date,domicile,hired_employee_id,job_position_id,stage")
    .eq("id", candidateId)
    .maybeSingle();
  if (!cand) return { ok: false, error: "Candidate not found" };

  if (cand.hired_employee_id) {
    await supabase.from("candidates").update({ stage: "hired", updated_at: new Date().toISOString() }).eq("id", candidateId);
    return { ok: true };
  }

  let departmentId: string | null = null;
  if (cand.job_position_id) {
    const { data: pos } = await supabase.from("job_positions").select("department_id").eq("id", cand.job_position_id).maybeSingle();
    departmentId = (pos?.department_id as string | null) ?? null;
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const res = await createEmployee({
    name: cand.name,
    phone: cand.whatsapp ?? "",
    email: cand.email ?? "",
    photo_url: cand.photo_url ?? null,
    birthdate: toIsoDate(cand.birth_date as string | null),
    address: (cand.domicile as string | null) ?? "",
    join_date: today,
    department_id: departmentId,
    job_position_id: cand.job_position_id ?? null,
    basic_salary: hire?.basicSalary ?? null,
    allowances: (hire?.allowances ?? []).map((a) => ({
      allowance_id: a.allowance_id,
      amount: a.amount ?? 0,
      rate_unit: a.rate_unit ?? "month",
      per_attendance: !!a.per_attendance,
    })),
  });
  if (!res.ok) return { ok: false, error: `Could not add to crew: ${res.error}` };

  const fromStage = (cand.stage as string | undefined) ?? null;
  const { error } = await supabase
    .from("candidates")
    .update({ stage: "hired", hired_employee_id: res.id ?? null, updated_at: new Date().toISOString() })
    .eq("id", candidateId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("candidate_events").insert({ candidate_id: candidateId, actor_id: profile.id, type: "hired", from_stage: fromStage, to_stage: "hired" });
  return { ok: true };
}

export type HireComponent = { id: string; name: string; type: "earning" | "deduction"; isFormula: boolean };

export async function getHireComponents(): Promise<HireComponent[]> {
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const [{ data: comps }, { data: vers }] = await Promise.all([
    supabase.from("allowances").select("id,name,type").order("name"),
    supabase.from("payroll_component_versions").select("component_id,formula_basis,effective_date").lte("effective_date", today),
  ]);
  const formula = new Set<string>();
  for (const v of (vers ?? []) as { component_id: string; formula_basis: string | null }[]) {
    if (v.formula_basis) formula.add(v.component_id);
  }
  return ((comps ?? []) as { id: string; name: string; type: "earning" | "deduction" }[])
    .map((c) => ({ id: c.id, name: c.name, type: c.type, isFormula: formula.has(c.id) }));
}

export type CandidateEvent = { id: string; type: "applied" | "stage_changed" | "hired"; from_stage: string | null; to_stage: string | null; actor: string | null; created_at: string };

export async function getCandidateEvents(candidateId: string): Promise<CandidateEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidate_events")
    .select("id,type,from_stage,to_stage,created_at,actor:profiles!actor_id(full_name,email)")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as { id: string; type: "applied" | "stage_changed" | "hired"; from_stage: string | null; to_stage: string | null; created_at: string; actor: { full_name: string | null; email: string } | null }[])
    .map((e) => ({ id: e.id, type: e.type, from_stage: e.from_stage, to_stage: e.to_stage, actor: e.actor?.full_name ?? e.actor?.email ?? null, created_at: e.created_at }));
}
