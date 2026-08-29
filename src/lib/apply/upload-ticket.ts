import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/** Per-attachment cap, mirrored by the buckets' own file_size_limit. */
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export const PHOTO_EXTS = ["jpg", "png", "webp"] as const; // what the photo bucket accepts
export type PhotoExt = (typeof PHOTO_EXTS)[number];

export const PHOTO_MIME: Record<PhotoExt, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const RESUME_BUCKET = "resumes";
export const PHOTO_BUCKET = "candidate-photos";

const TICKET_TTL_MS = 60 * 60 * 1000; // inside the 2h validity of the signed upload URLs

function sign(resumePath: string, photoPath: string, exp: number) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(`${resumePath}|${photoPath}|${exp}`)
    .digest("base64url");
}

export function mintTicket(resumePath: string, photoPath: string) {
  const exp = Date.now() + TICKET_TTL_MS;
  return `${exp}.${sign(resumePath, photoPath, exp)}`;
}

/** The ticket proves both paths were minted by us, so neither the submit action
 *  nor the upload fallback can be pointed at an arbitrary object. */
export function ticketOk(resumePath: string, photoPath: string, ticket: string) {
  const [expRaw, sig] = ticket.split(".");
  const exp = Number(expRaw);
  if (!sig || !Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = Buffer.from(sign(resumePath, photoPath, exp));
  const got = Buffer.from(sig);
  return expected.length === got.length && timingSafeEqual(expected, got);
}
