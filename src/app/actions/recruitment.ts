"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { createEmployee } from "@/app/actions/employees";
import { HIRING_STAGES, type HiringStage } from "@/lib/recruitment";

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

// The board card shows photo, name, expected salary, total experience, height and
// when they can join — nothing else, so the cover note stays off it.
const CANDIDATE_CARD_SELECT =
  "id,name,whatsapp,email,experience_years,expected_salary,fresh_graduate,work_experiences,earliest_join,height_cm,resume_path,photo_url,reject_reason,hired_employee_id,stage,created_at";
const CANDIDATE_FULL_SELECT =
  CANDIDATE_CARD_SELECT + ",birth_place,birth_date,domicile,maps_link,cover_note,employment_status,notice_period,agree_terms,agree_interview";

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

export type PositionRow = {
  id: string;
  name: string;
  /** When false, candidates cannot pick this position on the public apply form. */
  accepting_applications: boolean;
  candidate_count: number;
  stage_counts: Record<HiringStage, number>;
};

const emptyStageCounts = (): Record<HiringStage, number> =>
  Object.fromEntries(HIRING_STAGES.map((s) => [s, 0])) as Record<HiringStage, number>;

/** All job positions (except CEO), with their open/closed apply toggle + counts. */
export async function getPositions(): Promise<PositionRow[]> {
  const supabase = await createClient();
  const [{ data: positions }, { data: cands }] = await Promise.all([
    supabase.from("job_positions").select("id,name,accepting_applications").not("name", "ilike", "CEO").order("name"),
    supabase.from("candidates").select("job_position_id,stage"),
  ]);
  const count = new Map<string, number>();
  const stages = new Map<string, Record<HiringStage, number>>();
  for (const c of (cands ?? []) as { job_position_id: string | null; stage: HiringStage | null }[]) {
    if (!c.job_position_id) continue;
    count.set(c.job_position_id, (count.get(c.job_position_id) ?? 0) + 1);
    const bucket = stages.get(c.job_position_id) ?? emptyStageCounts();
    if (c.stage && bucket[c.stage] !== undefined) bucket[c.stage] += 1;
    stages.set(c.job_position_id, bucket);
  }
  return ((positions ?? []) as { id: string; name: string; accepting_applications: boolean }[]).map((p) => ({
    id: p.id,
    name: p.name,
    accepting_applications: p.accepting_applications,
    candidate_count: count.get(p.id) ?? 0,
    stage_counts: stages.get(p.id) ?? emptyStageCounts(),
  }));
}

/** Toggle whether candidates can apply to a position on the public apply form. */
export async function setPositionAcceptingApplications(positionId: string, accepting: boolean): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_WRITE)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_positions")
    .update({ accepting_applications: accepting })
    .eq("id", positionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Candidate search (recruitment index) ─────────────────────────────────────

export type CandidateHit = {
  id: string;
  job_position_id: string;
  name: string;
  position_name: string;
  stage: HiringStage;
  experience_years: number | null;
  fresh_graduate: boolean;
  domicile: string | null;
  photo_url: string | null;
  /** A trimmed excerpt of the field that matched, so the searcher sees why. */
  snippet: string | null;
  /** How many query terms this candidate hit — used for the ranking. */
  matched: number;
};

// Common Indonesian/English connectors that would match everyone and only add
// noise to the ranking. "bisa" is intentionally NOT here — it carries meaning.
const SEARCH_STOPWORDS = new Set(["yang", "dan", "di", "ke", "dari", "untuk", "dengan", "atau", "the", "a", "an", "of", "in", "for"]);

/** Lowercase, strip accents and punctuation, collapse whitespace — so
 *  "Pengalaman 2 Tahun!" and "pengalaman 2 tahun" fold to the same tokens. */
function foldText(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** First folded field containing a term → a short excerpt around the hit. */
function snippetFor(fields: (string | null | undefined)[], terms: string[]): string | null {
  for (const raw of fields) {
    const folded = foldText(raw);
    if (!folded) continue;
    for (const t of terms) {
      const at = folded.indexOf(t);
      if (at < 0) continue;
      const start = Math.max(0, at - 40);
      const end = Math.min(folded.length, at + 80);
      return (start > 0 ? "…" : "") + folded.slice(start, end).trim() + (end < folded.length ? "…" : "");
    }
  }
  return null;
}

/** Free-text candidate search across the whole recruitment pool: name, position,
 *  cover note, my comments/notes, work history, domicile and a humanised
 *  experience phrase. The query is split into terms and results are ranked by how
 *  many terms hit and how strong the field was — keyword/fuzzy, no AI. */
export async function searchCandidates(query: string): Promise<CandidateHit[]> {
  const terms = foldText(query)
    .split(" ")
    .filter((t) => t.length > 0 && !SEARCH_STOPWORDS.has(t));
  if (terms.length === 0) return [];

  const supabase = await createClient();
  const [{ data: positions }, { data: cands }] = await Promise.all([
    supabase.from("job_positions").select("id,name"),
    supabase
      .from("candidates")
      .select(
        "id,job_position_id,name,stage,experience_years,fresh_graduate,work_experiences,cover_note,domicile,birth_place,employment_status,notice_period,photo_url,created_at",
      )
      .order("created_at", { ascending: false }),
  ]);

  const posName = new Map<string, string>();
  for (const p of (positions ?? []) as { id: string; name: string }[]) posName.set(p.id, p.name);

  const rows = (cands ?? []) as unknown as (Candidate & { job_position_id: string })[];

  // Pull every comment once and concatenate per candidate — the notes are a
  // first-class search field ("barista bisa produk" often lives in a note).
  const notes = new Map<string, string>();
  if (rows.length > 0) {
    const { data: cm } = await supabase
      .from("candidate_comments")
      .select("candidate_id,body")
      .in("candidate_id", rows.map((c) => c.id));
    for (const c of (cm ?? []) as { candidate_id: string; body: string }[]) {
      notes.set(c.candidate_id, notes.has(c.candidate_id) ? `${notes.get(c.candidate_id)} • ${c.body}` : c.body);
    }
  }

  const scored: (CandidateHit & { score: number })[] = [];
  for (const c of rows) {
    const position = posName.get(c.job_position_id) ?? "";
    const note = notes.get(c.id) ?? "";
    const workText = (c.work_experiences ?? [])
      .map((w) => [w.place, w.position, w.jobdesk, w.period].filter(Boolean).join(" "))
      .join(" ");
    const expYears = num(c.experience_years);
    // Synthetic phrase so "2 tahun" / "2 years" / "fresh graduate" become matchable.
    const expPhrase = [
      expYears != null ? `${expYears} tahun pengalaman ${expYears} years experience` : "",
      c.fresh_graduate ? "fresh graduate fresh grad tanpa pengalaman no experience" : "",
    ].join(" ");

    // Weighted fields — a term hitting a stronger field scores higher.
    const fields: { text: string; w: number }[] = [
      { text: foldText(c.name), w: 4 },
      { text: foldText(position), w: 4 },
      { text: expPhrase, w: 3 },
      { text: foldText(note), w: 2 },
      { text: foldText(c.cover_note), w: 2 },
      { text: foldText(workText), w: 2 },
      { text: foldText([c.domicile, c.birth_place, c.employment_status, c.notice_period, c.stage].join(" ")), w: 1 },
    ];

    let score = 0;
    let matched = 0;
    for (const term of terms) {
      let best = 0;
      const wordStart = new RegExp(`\\b${escapeRe(term)}`);
      for (const f of fields) {
        if (!f.text) continue;
        if (wordStart.test(f.text)) best = Math.max(best, f.w * 2); // word-start match
        else if (f.text.includes(term)) best = Math.max(best, f.w); // loose substring
      }
      if (best > 0) {
        score += best;
        matched += 1;
      }
    }
    if (matched === 0) continue;
    if (matched === terms.length) score += 8; // hits every term → float to the top

    scored.push({
      id: c.id,
      job_position_id: c.job_position_id,
      name: c.name,
      position_name: position,
      stage: c.stage,
      experience_years: expYears,
      fresh_graduate: Boolean(c.fresh_graduate),
      domicile: c.domicile ?? null,
      photo_url: c.photo_url ?? null,
      snippet: snippetFor([note, c.cover_note, workText], terms),
      matched,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score || b.matched - a.matched || a.name.localeCompare(b.name));
  return scored.slice(0, 40).map(({ score: _score, ...hit }) => hit);
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
  const { data: prev } = await supabase.from("candidates").select("stage,resume_path").eq("id", candidateId).maybeSingle();
  const fromStage = (prev?.stage as string | undefined) ?? null;

  const patch: Record<string, unknown> = { stage, updated_at: new Date().toISOString() };
  if (stage === "rejected") {
    patch.reject_reason = reason?.trim() || null;
    // Rejected candidates: permanently delete the uploaded CV/PDF from storage so it
    // doesn't fill up the server, then clear the reference.
    const resumePath = (prev?.resume_path as string | null) ?? null;
    if (resumePath) {
      await service().storage.from("resumes").remove([resumePath]);
      patch.resume_path = null;
    }
  }
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
