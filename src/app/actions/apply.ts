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

/** Mint signed upload URLs for the résumé + photo. The candidate's browser PUTs
 *  the files to Supabase directly: a multi-MB résumé through a Server Action hits
 *  the platform's 4.5MB request-body cap (and the function timeout on a slow
 *  mobile connection), which is what left applicants on a broken page. */
export async function createUploadSlots(positionId: string, photoExt: PhotoExt): Promise<UploadSlots> {
  if (!isUuid(positionId)) return { ok: false, error: "Pilih posisi yang dilamar." };
  if (!PHOTO_EXTS.includes(photoExt)) return { ok: false, error: "Format foto tidak didukung." };

  const db = service();
  const { data: position } = await db.from("job_positions").select("id").eq("id", positionId).maybeSingle();
  if (!position) return { ok: false, error: "Posisi tidak ditemukan." };

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

export type WorkExperience = { period: string; place: string; position: string; jobdesk: string };

/** Public candidate submission: validate the fields, confirm the résumé + photo
 *  the browser uploaded into the slots we minted, then insert the candidate.
 *  Carries no file payload, so it stays well under the request-body cap.
 *  Bypasses RLS by design. */
export async function submitApplication(form: FormData): Promise<ApplyResult> {
  const positionId = String(form.get("position_id") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const whatsapp = String(form.get("whatsapp") ?? "").trim();
  const birthPlace = String(form.get("birth_place") ?? "").trim();
  const birthDate = String(form.get("birth_date") ?? "").trim();
  const domicile = String(form.get("domicile") ?? "").trim();
  const mapsLink = String(form.get("maps_link") ?? "").trim();
  const heightRaw = String(form.get("height_cm") ?? "").trim();
  const freshGraduate = String(form.get("fresh_graduate") ?? "") === "1";
  const salaryRaw = String(form.get("expected_salary") ?? "").trim();
  const employmentStatus = String(form.get("employment_status") ?? "").trim(); // working | not_working
  const noticePeriod = String(form.get("notice_period") ?? "").trim();
  const earliestJoin = String(form.get("earliest_join") ?? "").trim();
  const contribution = String(form.get("contribution") ?? "").trim();
  const agreeTerms = String(form.get("agree_terms") ?? "") === "1";
  const agreeInterview = String(form.get("agree_interview") ?? "") === "1";
  let experiences: WorkExperience[] = [];
  try { experiences = JSON.parse(String(form.get("work_experiences") ?? "[]")); } catch { experiences = []; }
  const resumePath = String(form.get("resume_path") ?? "").trim();
  const photoPath = String(form.get("photo_path") ?? "").trim();
  const ticket = String(form.get("upload_ticket") ?? "").trim();

  if (!positionId || !isUuid(positionId)) return { ok: false, error: "Pilih posisi yang dilamar." };
  if (!name) return { ok: false, error: "Nama wajib diisi." };
  if (!whatsapp || !phoneOk(whatsapp)) return { ok: false, error: "Nomor WhatsApp tidak valid." };
  if (!heightRaw || !(Number(heightRaw) > 0)) return { ok: false, error: "Tinggi badan wajib diisi." };
  if (!agreeTerms) return { ok: false, error: "Kamu harus menyetujui sistem & ketentuan kerja." };
  // Size/MIME are enforced by the buckets themselves on the signed upload; here
  // we only check the paths are ours and belong to the position applied for.
  const stale = { ok: false, error: "Sesi unggah kedaluwarsa. Muat ulang halaman lalu kirim lagi." } as const;
  if (!resumePath || !photoPath || !ticketOk(resumePath, photoPath, ticket)) return stale;
  if (!resumePath.startsWith(`${positionId}/`) || !photoPath.startsWith(`${positionId}/`)) return stale;

  const db = service();
  const { data: position } = await db.from("job_positions").select("id").eq("id", positionId).maybeSingle();
  if (!position) return { ok: false, error: "Posisi tidak ditemukan." };

  const cleanExp = (freshGraduate ? [] : experiences)
    .filter((e) => e && (e.period || e.place || e.position || e.jobdesk))
    .map((e) => ({ period: String(e.period ?? "").trim(), place: String(e.place ?? "").trim(), position: String(e.position ?? "").trim(), jobdesk: String(e.jobdesk ?? "").trim() }));

  const [resumeUploaded, photoUploaded] = await Promise.all([
    db.storage.from("resumes").exists(resumePath),
    db.storage.from("candidate-photos").exists(photoPath),
  ]);
  if (!resumeUploaded.data) return { ok: false, error: "Resume belum selesai terunggah. Coba kirim lagi." };
  if (!photoUploaded.data) return { ok: false, error: "Foto belum selesai terunggah. Coba kirim lagi." };
  const photoUrl = db.storage.from("candidate-photos").getPublicUrl(photoPath).data.publicUrl;

  const { data: inserted, error: insErr } = await db.from("candidates").insert({
    job_position_id: positionId,
    name,
    whatsapp,
    birth_place: birthPlace || null,
    birth_date: birthDate || null,
    domicile: domicile || null,
    maps_link: mapsLink || null,
    height_cm: Number(heightRaw),
    fresh_graduate: freshGraduate,
    work_experiences: cleanExp,
    experience_years: cleanExp.length || null,
    expected_salary: salaryRaw === "" ? null : Number(salaryRaw.replace(/[^0-9]/g, "")),
    employment_status: employmentStatus || null,
    notice_period: noticePeriod || null,
    earliest_join: earliestJoin || null,
    cover_note: contribution || null,
    agree_terms: agreeTerms,
    agree_interview: agreeInterview,
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
