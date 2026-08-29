import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  MAX_ATTACHMENT_BYTES, PHOTO_BUCKET, PHOTO_MIME, RESUME_BUCKET, ticketOk, type PhotoExt,
} from "@/lib/apply/upload-ticket";

export const runtime = "nodejs";

/**
 * Fallback for the apply form's attachments. The browser normally PUTs them
 * straight to Supabase Storage, but some mobile networks can't reach the
 * storage host at all (the signed URL is minted fine server-side, the PUT never
 * arrives). This route takes one file on our own origin — the page loaded from
 * here, so it is reachable by definition — and stores it with the service role.
 * One 2MB attachment per request stays well inside the platform's body cap.
 */
export async function POST(request: Request) {
  const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

  let form: FormData;
  try { form = await request.formData(); } catch { return bad("Berkas tidak terbaca."); }

  const kind = String(form.get("kind") ?? "");
  const resumePath = String(form.get("resume_path") ?? "").trim();
  const photoPath = String(form.get("photo_path") ?? "").trim();
  const ticket = String(form.get("upload_ticket") ?? "").trim();
  const file = form.get("file");

  if (kind !== "resume" && kind !== "photo") return bad("Jenis lampiran tidak dikenal.");
  if (!resumePath || !photoPath || !ticketOk(resumePath, photoPath, ticket)) {
    return bad("Sesi unggah kedaluwarsa. Muat ulang halaman lalu kirim lagi.");
  }
  if (!(file instanceof File) || file.size === 0) return bad("Lampiran kosong.");
  if (file.size > MAX_ATTACHMENT_BYTES) return bad("Ukuran lampiran maksimal 2MB.", 413);

  const isResume = kind === "resume";
  const path = isResume ? resumePath : photoPath;
  const bucket = isResume ? RESUME_BUCKET : PHOTO_BUCKET;
  const ext = path.slice(path.lastIndexOf(".") + 1) as PhotoExt;
  const contentType = isResume ? "application/pdf" : PHOTO_MIME[ext];
  if (!contentType) return bad("Format lampiran tidak didukung.");

  // upsert so a retry after a half-finished attempt overwrites rather than 409s.
  const { error } = await createServiceClient()
    .storage.from(bucket)
    .upload(path, file, { contentType, upsert: true });
  if (error) return bad("Gagal menyimpan lampiran. Coba lagi.", 502);

  return NextResponse.json({ ok: true });
}
