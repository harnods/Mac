"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getRealProfile, VIEW_AS_COOKIE } from "@/lib/auth";
import { isSuperRole } from "@/lib/permissions";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Set (or clear, with null) the role a Super admin is previewing the app as.
 * Only the real Super admin may do this; the preview never grants extra access.
 */
export async function setViewAsRole(role: string | null): Promise<Result> {
  const real = await getRealProfile();
  if (!real || !isSuperRole(real.role)) return { ok: false, error: "Not allowed" };

  const jar = await cookies();
  if (!role || isSuperRole(role)) {
    jar.delete(VIEW_AS_COOKIE);
  } else {
    jar.set(VIEW_AS_COOKIE, role, { httpOnly: true, sameSite: "lax", path: "/" });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
