"use server";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export type ApplyResult = { ok: true } | { ok: false; error: string };

function service() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type OpenPosition = { id: string; title: string };

/** Every job position (except CEO) — all are open for application. */
export async function getOpenPositions(): Promise<OpenPosition[]> {
  const db = service();
  const { data } = await db
    .from("job_positions")
    .select("id,name")
    .not("name", "ilike", "CEO")
    .order("name");
  return ((data ?? []) as { id: string; name: string }[]).map((p) => ({ id: p.id, title: p.name }));
}

const phoneOk = (p: string) => /^[0-9+][0-9\s-]{6,}$/.test(p.trim());
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const EMPLOYMENT_STATUSES = ["working", "not_working"];

export type WorkExperience = { period: string; place: string; position: string; jobdesk: string };

type Application = {
  positionId: string;
  name: string;
  whatsapp: string;
  birthPlace: string;
  birthDate: string;
  domicile: string;
  mapsLink: string;
  heightCm: number;
  freshGraduate: boolean;
  experiences: WorkExperience[];
  expectedSalary: number | null;
  employmentStatus: string;
  noticePeriod: string;
  earliestJoin: string;
  contribution: string;
  agreeTerms: boolean;
  agreeInterview: boolean;
};

/** Read and validate the form fields. Runs before a single byte is uploaded, so
 *  a submission that can't be accepted never leaves files in the buckets, and
 *  again on submit so the insert can't be reached with fields that skipped the
 *  first pass. */
function parseApplication(form: FormData): { ok: true; data: Application } | { ok: false; error: string } {
  const str = (key: string) => String(form.get(key) ?? "").trim();
  const positionId = str("position_id");
  const name = str("name");
  const whatsapp = str("whatsapp");
  const heightRaw = str("height_cm");
  const heightCm = Number(heightRaw);
  const employmentStatus = str("employment_status"); // working | not_working
  const salaryRaw = str("expected_salary").replace(/[^0-9]/g, "");
  const freshGraduate = str("fresh_graduate") === "1";
  const agreeTerms = str("agree_terms") === "1";

  if (!positionId || !isUuid(positionId)) return { ok: false, error: "Pilih posisi yang dilamar." };
  if (!name) return { ok: false, error: "Nama wajib diisi." };
  if (!whatsapp || !phoneOk(whatsapp)) return { ok: false, error: "Nomor WhatsApp tidak valid." };
  if (!heightRaw || !(heightCm > 0)) return { ok: false, error: "Tinggi badan wajib diisi." };
  if (!agreeTerms) return { ok: false, error: "Kamu harus menyetujui sistem & ketentuan kerja." };
  if (employmentStatus && !EMPLOYMENT_STATUSES.includes(employmentStatus)) {
    return { ok: false, error: "Status pekerjaan tidak valid." };
  }

  let raw: WorkExperience[] = [];
  try { raw = JSON.parse(String(form.get("work_experiences") ?? "[]")); } catch { raw = []; }
  const experiences = (freshGraduate || !Array.isArray(raw) ? [] : raw)
    .filter((e) => e && (e.period || e.place || e.position || e.jobdesk))
    .map((e) => ({ period: String(e.period ?? "").trim(), place: String(e.place ?? "").trim(), position: String(e.position ?? "").trim(), jobdesk: String(e.jobdesk ?? "").trim() }));

  return {
    ok: true,
    data: {
      positionId, name, whatsapp, heightCm, freshGraduate, experiences, agreeTerms, employmentStatus,
      birthPlace: str("birth_place"),
      birthDate: str("birth_date"),
      domicile: str("domicile"),
      mapsLink: str("maps_link"),
      expectedSalary: salaryRaw === "" ? null : Number(salaryRaw),
      noticePeriod: str("notice_period"),
      earliestJoin: str("earliest_join"),
      contribution: str("contribution"),
      agreeInterview: str("agree_interview") === "1",
    },
  };
}

/** The position has to exist before we hand out upload slots or insert. */
async function positionExists(db: ReturnType<typeof service>, positionId: string) {
  const { data } = await db.from("job_positions").select("id").eq("id", positionId).maybeSingle();
  return Boolean(data);
}

const PHOTO_EXTS = ["jpg", "png", "webp"] as const; // what the photo bucket accepts
export type PhotoExt = (typeof PHOTO_EXTS)[number];

/** Slots the browser uploads straight into, skipping the server entirely. */
export type UploadSlots =
  | { ok: true; ticket: string; resume: { path: string; token: string }; photo: { path: string; token: string } }
  | { ok: false; error: string };

const TICKET_TTL_MS = 60 * 60 * 1000; // inside the 2h validity of the signed upload URLs

function sign(resumePath: string, photoPath: string, exp: number) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(`${resumePath}|${photoPath}|${exp}`)
    .digest("base64url");
}

/** The ticket proves both paths were minted by us, so a submission can't point
 *  at an arbitrary object in the buckets. */
function ticketOk(resumePath: string, photoPath: string, ticket: string) {
  const [expRaw, sig] = ticket.split(".");
  const exp = Number(expRaw);
  if (!sig || !Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = Buffer.from(sign(resumePath, photoPath, exp));
  const got = Buffer.from(sig);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** Validate the application, then mint signed upload URLs for the résumé +
 *  photo. The candidate's browser PUTs the files to Supabase directly: a
 *  multi-MB résumé through a Server Action hits the platform's 4.5MB
 *  request-body cap (and the function timeout on a slow mobile connection),
 *  which is what left applicants on a broken page. */
export async function createUploadSlots(form: FormData, photoExt: PhotoExt): Promise<UploadSlots> {
  const parsed = parseApplication(form);
  if (!parsed.ok) return parsed;
  if (!PHOTO_EXTS.includes(photoExt)) return { ok: false, error: "Format foto tidak didukung." };
  const { positionId } = parsed.data;

  const db = service();
  if (!(await positionExists(db, positionId))) return { ok: false, error: "Posisi tidak ditemukan." };

  const base = `${positionId}/${crypto.randomUUID()}`;
  const resumePath = `${base}.pdf`;
  const photoPath = `${base}.${photoExt}`;
  const [resume, photo] = await Promise.all([
    db.storage.from("resumes").createSignedUploadUrl(resumePath),
    db.storage.from("candidate-photos").createSignedUploadUrl(photoPath),
  ]);
  if (resume.error || !resume.data || photo.error || !photo.data) {
    return { ok: false, error: "Gagal menyiapkan unggahan. Coba lagi." };
  }

  const exp = Date.now() + TICKET_TTL_MS;
  return {
    ok: true,
    ticket: `${exp}.${sign(resumePath, photoPath, exp)}`,
    resume: { path: resumePath, token: resume.data.token },
    photo: { path: photoPath, token: photo.data.token },
  };
}

/** Clean up an attempt that never became a candidate, so a failed submission
 *  doesn't leave orphans in the buckets. */
export async function discardUploadSlots(resumePath: string, photoPath: string, ticket: string): Promise<void> {
  if (!ticketOk(resumePath, photoPath, ticket)) return;
  const db = service();
  await Promise.all([
    db.storage.from("resumes").remove([resumePath]),
    db.storage.from("candidate-photos").remove([photoPath]),
  ]);
}

/** Public candidate submission: re-validate the fields, confirm the résumé +
 *  photo landed in the slots we minted, then insert the candidate. Carries no
 *  file payload, so it stays well under the request-body cap. Bypasses RLS by
 *  design. */
export async function submitApplication(form: FormData): Promise<ApplyResult> {
  const parsed = parseApplication(form);
  if (!parsed.ok) return parsed;
  const app = parsed.data;

  const resumePath = String(form.get("resume_path") ?? "").trim();
  const photoPath = String(form.get("photo_path") ?? "").trim();
  const ticket = String(form.get("upload_ticket") ?? "").trim();

  // Size/MIME are enforced by the buckets themselves on the signed upload; here
  // we only check the paths are ours and belong to the position applied for.
  const stale = { ok: false, error: "Sesi unggah kedaluwarsa. Muat ulang halaman lalu kirim lagi." } as const;
  if (!resumePath || !photoPath || !ticketOk(resumePath, photoPath, ticket)) return stale;
  if (!resumePath.startsWith(`${app.positionId}/`) || !photoPath.startsWith(`${app.positionId}/`)) return stale;

  const db = service();
  if (!(await positionExists(db, app.positionId))) return { ok: false, error: "Posisi tidak ditemukan." };

  const [resumeUploaded, photoUploaded] = await Promise.all([
    db.storage.from("resumes").exists(resumePath),
    db.storage.from("candidate-photos").exists(photoPath),
  ]);
  if (!resumeUploaded.data) return { ok: false, error: "Resume belum selesai terunggah. Coba kirim lagi." };
  if (!photoUploaded.data) return { ok: false, error: "Foto belum selesai terunggah. Coba kirim lagi." };
  const photoUrl = db.storage.from("candidate-photos").getPublicUrl(photoPath).data.publicUrl;

  const { data: inserted, error: insErr } = await db.from("candidates").insert({
    job_position_id: app.positionId,
    name: app.name,
    whatsapp: app.whatsapp,
    birth_place: app.birthPlace || null,
    birth_date: app.birthDate || null,
    domicile: app.domicile || null,
    maps_link: app.mapsLink || null,
    height_cm: app.heightCm,
    fresh_graduate: app.freshGraduate,
    work_experiences: app.experiences,
    experience_years: app.experiences.length || null,
    expected_salary: app.expectedSalary,
    employment_status: app.employmentStatus || null,
    notice_period: app.noticePeriod || null,
    earliest_join: app.earliestJoin || null,
    cover_note: app.contribution || null,
    agree_terms: app.agreeTerms,
    agree_interview: app.agreeInterview,
    resume_path: resumePath,
    photo_url: photoUrl,
  }).select("id").single();
  if (insErr || !inserted) {
    await db.storage.from("resumes").remove([resumePath]);
    await db.storage.from("candidate-photos").remove([photoPath]);
    return { ok: false, error: "Gagal mengirim lamaran. Coba lagi." };
  }
  await db.from("candidate_events").insert({ candidate_id: inserted.id, type: "applied", to_stage: "applied" });
  return { ok: true };
}
