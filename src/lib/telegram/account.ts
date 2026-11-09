import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { permissionsForRole } from "@/lib/auth";

export const LINK_HELP =
  "Akun Telegram kamu belum terhubung ke Machitori.\nBuka Machitori → <b>Profile</b> → <b>Hubungkan Telegram</b>, lalu kirim perintah /start yang diberikan ke chat bot.";

export type LinkedAccount = {
  profileId: string;
  name: string;
  role: string;
  isOwner: boolean;
  permissions: string[];
};

/** Telegram user → linked Machitori profile with its role permissions. */
export async function linkedAccount(telegramUserId: number): Promise<LinkedAccount | { error: string }> {
  const supabase = createServiceClient();
  const { data: acct } = await supabase
    .from("telegram_accounts")
    .select("profile_id")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  if (!acct) return { error: LINK_HELP };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, is_owner")
    .eq("id", acct.profile_id)
    .maybeSingle();
  if (!profile) return { error: "Akun Machitori kamu tidak ditemukan." };
  return {
    profileId: profile.id as string,
    name: (profile.full_name as string | null) || String(profile.email ?? "").split("@")[0] || "Karyawan",
    role: profile.role as string,
    isOwner: !!profile.is_owner,
    permissions: await permissionsForRole(profile.role as string),
  };
}
