"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_PASSWORD = "crew-2026";

function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function emailTaken(admin: SupabaseClient, email: string): Promise<boolean> {
  const { data } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  return !!data;
}

/**
 * Provision login accounts for every active crew without one:
 * email = <firstname>-crew@machimoto.local, password = crew-2026, role = crew,
 * forced password change on first login. Resigned/deleted crew are skipped.
 */
export async function generateCrewLogins(): Promise<
  { ok: true; created: number; skipped: number } | { ok: false; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.EMPLOYEES_ACCESS)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const admin = serviceClient();

  const { data: crew } = await supabase
    .from("employees")
    .select("id,name,user_id,termination_date")
    .is("deleted_at", null)
    .order("name");

  let created = 0;
  let skipped = 0;
  const used = new Set<string>();

  for (const c of (crew ?? []) as { id: string; name: string; user_id: string | null; termination_date: string | null }[]) {
    if (c.user_id || c.termination_date) { skipped++; continue; } // already has login, or resigned

    const first = (c.name ?? "").trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "") || "crew";
    let email = `${first}-crew@machimoto.local`;
    let n = 1;
    while (used.has(email) || (await emailTaken(admin, email))) {
      email = `${first}${n}-crew@machimoto.local`;
      n++;
    }
    used.add(email);

    const { data: authUser, error } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: c.name, role: "crew" },
    });
    if (error || !authUser.user) { skipped++; continue; }

    const uid = authUser.user.id;
    await admin.from("profiles").upsert(
      { id: uid, email, full_name: c.name, role: "crew", must_change_password: true },
      { onConflict: "id" },
    );
    await supabase.from("employees").update({ user_id: uid, updated_by: profile.id }).eq("id", c.id);
    created++;
  }

  revalidatePath("/hr", "layout");
  return { ok: true, created, skipped };
}
