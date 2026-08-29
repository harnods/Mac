"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  mintTicket, ticketOk, PHOTO_BUCKET, PHOTO_EXTS, RESUME_BUCKET, type PhotoExt,
} from "@/lib/apply/upload-ticket";

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

/** Slots the browser uploads straight into, skipping the server entirely. */
export type UploadSlots =
  | { ok: true; ticket: string; resume: { path: string; token: string }; photo: { path: string; token: string } }
  | { ok: false; error: string };

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
    db.storage.from(RESUME_BUCKET).createSignedUploadUrl(resumePath),
    db.storage.from(PHOTO_BUCKET).createSignedUploadUrl(photoPath),
  ]);
  if (resume.error || !resume.data || photo.error || !photo.data) {
    return { ok: false, error: "Gagal menyiapkan unggahan. Coba lagi." };
  }

  return {
    ok: true,
    ticket: mintTicket(resumePath, photoPath),
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
    db.storage.from(RESUME_BUCKET).remove([resumePath]),
    db.storage.from(PHOTO_BUCKET).remove([photoPath]),
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
    db.storage.from(RESUME_BUCKET).exists(resumePath),
    db.storage.from(PHOTO_BUCKET).exists(photoPath),
  ]);
  if (!resumeUploaded.data) return { ok: false, error: "Resume belum selesai terunggah. Coba kirim lagi." };
  if (!photoUploaded.data) return { ok: false, error: "Foto belum selesai terunggah. Coba kirim lagi." };
  const photoUrl = db.storage.from(PHOTO_BUCKET).getPublicUrl(photoPath).data.publicUrl;

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
    await db.storage.from(RESUME_BUCKET).remove([resumePath]);
    await db.storage.from(PHOTO_BUCKET).remove([photoPath]);
    return { ok: false, error: "Gagal mengirim lamaran. Coba lagi." };
  }
  await db.from("candidate_events").insert({ candidate_id: inserted.id, type: "applied", to_stage: "applied" });
  return { ok: true };
}
