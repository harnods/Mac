"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";

export type ApplyResult = { ok: true } | { ok: false; error: string };

function service() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type PublicOpening = {
  code: string;
  title: string; // resolved: custom title or position name
  position: string | null;
  department: string | null;
  level: string | null;
  employment_type: string | null;
  min_experience_years: number;
  description: string | null;
  status: "open" | "closed";
};

/** Resolve a job opening for the public apply page by its short code. */
export async function getOpeningByCode(code: string): Promise<PublicOpening | null> {
  const db = service();
  const { data } = await db
    .from("job_openings")
    .select("code,title,status,description,min_experience_years,job_positions(name),departments(name),job_levels(name),employment_statuses(name)")
    .eq("code", code.toLowerCase())
    .maybeSingle();
  if (!data) return null;
  const o = data as unknown as {
    code: string; title: string | null; status: "open" | "closed"; description: string | null; min_experience_years: number;
    job_positions: { name: string } | null; departments: { name: string } | null;
    job_levels: { name: string } | null; employment_statuses: { name: string } | null;
  };
  const position = o.job_positions?.name ?? null;
  return {
    code: o.code,
    title: o.title?.trim() || position || "Lowongan",
    position,
    department: o.departments?.name ?? null,
    level: o.job_levels?.name ?? null,
    employment_type: o.employment_statuses?.name ?? null,
    min_experience_years: Number(o.min_experience_years),
    description: o.description,
    status: o.status,
  };
}

const phoneOk = (p: string) => /^[0-9+][0-9\s-]{6,}$/.test(p.trim());

/** Public candidate submission: validate, store the résumé (private bucket via
 *  service role), then insert the candidate. Bypasses RLS by design. */
export async function submitApplication(form: FormData): Promise<ApplyResult> {
  const code = String(form.get("code") ?? "").toLowerCase();
  const name = String(form.get("name") ?? "").trim();
  const whatsapp = String(form.get("whatsapp") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const expRaw = String(form.get("experience_years") ?? "").trim();
  const salaryRaw = String(form.get("expected_salary") ?? "").trim();
  const coverNote = String(form.get("cover_note") ?? "").trim();
  const resume = form.get("resume");

  if (!name) return { ok: false, error: "Nama wajib diisi." };
  if (!whatsapp || !phoneOk(whatsapp)) return { ok: false, error: "Nomor WhatsApp tidak valid." };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Email tidak valid." };
  if (!(resume instanceof File) || resume.size === 0) return { ok: false, error: "Lampirkan resume (PDF)." };
  if (resume.type !== "application/pdf") return { ok: false, error: "Resume harus berformat PDF." };
  if (resume.size > 5 * 1024 * 1024) return { ok: false, error: "Ukuran resume maksimal 5MB." };

  const db = service();
  const { data: opening } = await db.from("job_openings").select("id,status").eq("code", code).maybeSingle();
  if (!opening) return { ok: false, error: "Lowongan tidak ditemukan." };
  if ((opening.status as string) !== "open") return { ok: false, error: "Lowongan ini sudah ditutup." };

  const openingId = opening.id as string;
  const path = `${openingId}/${crypto.randomUUID()}.pdf`;
  const { error: upErr } = await db.storage
    .from("resumes")
    .upload(path, resume, { contentType: "application/pdf", upsert: false });
  if (upErr) return { ok: false, error: "Gagal mengunggah resume. Coba lagi." };

  const { error: insErr } = await db.from("candidates").insert({
    opening_id: openingId,
    name,
    whatsapp,
    email,
    experience_years: expRaw === "" ? null : Number(expRaw),
    expected_salary: salaryRaw === "" ? null : Number(salaryRaw.replace(/[^0-9]/g, "")),
    cover_note: coverNote || null,
    resume_path: path,
  });
  if (insErr) {
    await db.storage.from("resumes").remove([path]); // roll back the orphan file
    return { ok: false, error: "Gagal mengirim lamaran. Coba lagi." };
  }
  return { ok: true };
}
