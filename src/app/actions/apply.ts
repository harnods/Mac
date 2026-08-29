"use server";

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

export type WorkExperience = { period: string; place: string; position: string; jobdesk: string };

/** Public candidate submission: validate, store résumé + photo (service role),
 *  then insert the candidate. Bypasses RLS by design. */
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
  const resume = form.get("resume");
  const photo = form.get("photo");

  if (!positionId) return { ok: false, error: "Pilih posisi yang dilamar." };
  if (!name) return { ok: false, error: "Nama wajib diisi." };
  if (!whatsapp || !phoneOk(whatsapp)) return { ok: false, error: "Nomor WhatsApp tidak valid." };
  if (!heightRaw || !(Number(heightRaw) > 0)) return { ok: false, error: "Tinggi badan wajib diisi." };
  if (!agreeTerms) return { ok: false, error: "Kamu harus menyetujui sistem & ketentuan kerja." };
  if (!(resume instanceof File) || resume.size === 0) return { ok: false, error: "Lampirkan resume (PDF)." };
  if (resume.type !== "application/pdf") return { ok: false, error: "Resume harus berformat PDF." };
  if (resume.size > 5 * 1024 * 1024) return { ok: false, error: "Ukuran resume maksimal 5MB." };
  if (!(photo instanceof File) || photo.size === 0) return { ok: false, error: "Lampirkan foto." };
  if (!photo.type.startsWith("image/")) return { ok: false, error: "Foto harus berupa gambar." };
  if (photo.size > 5 * 1024 * 1024) return { ok: false, error: "Ukuran foto maksimal 5MB." };

  const db = service();
  const { data: position } = await db.from("job_positions").select("id").eq("id", positionId).maybeSingle();
  if (!position) return { ok: false, error: "Posisi tidak ditemukan." };

  const cleanExp = (freshGraduate ? [] : experiences)
    .filter((e) => e && (e.period || e.place || e.position || e.jobdesk))
    .map((e) => ({ period: String(e.period ?? "").trim(), place: String(e.place ?? "").trim(), position: String(e.position ?? "").trim(), jobdesk: String(e.jobdesk ?? "").trim() }));

  const base = `${positionId}/${crypto.randomUUID()}`;
  const path = `${base}.pdf`;
  const { error: upErr } = await db.storage.from("resumes").upload(path, resume, { contentType: "application/pdf", upsert: false });
  if (upErr) return { ok: false, error: "Gagal mengunggah resume. Coba lagi." };

  const photoExt = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
  const photoPath = `${base}.${photoExt}`;
  const { error: photoErr } = await db.storage.from("candidate-photos").upload(photoPath, photo, { contentType: photo.type, upsert: false });
  if (photoErr) {
    await db.storage.from("resumes").remove([path]);
    return { ok: false, error: "Gagal mengunggah foto. Coba lagi." };
  }
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
    resume_path: path,
    photo_url: photoUrl,
  }).select("id").single();
  if (insErr || !inserted) {
    await db.storage.from("resumes").remove([path]);
    await db.storage.from("candidate-photos").remove([photoPath]);
    return { ok: false, error: "Gagal mengirim lamaran. Coba lagi." };
  }
  await db.from("candidate_events").insert({ candidate_id: inserted.id, type: "applied", to_stage: "applied" });
  return { ok: true };
}
