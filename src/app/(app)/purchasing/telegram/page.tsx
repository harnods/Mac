import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { AccessDenied } from "@/components/access-denied";
import { TelegramSettings, type LinkedAccountRow, type SupplierGroupRow } from "@/components/telegram/telegram-settings";
import { getWebhookStatus } from "@/app/actions/telegram";

export const dynamic = "force-dynamic";

export default async function TelegramSettingsPage() {
  const profile = await getCurrentProfile();
  if (!can(profile, P.PURCHASING_PURCHASE)) return <AccessDenied label="Telegram" />;

  const supabase = await createClient();
  const [status, { data: chats }, { data: settings }, { data: suppliers }, { data: accounts }] = await Promise.all([
    getWebhookStatus(),
    supabase.from("telegram_chats").select("chat_id, title, is_member").eq("is_member", true).order("title"),
    supabase.from("telegram_settings").select("pr_chat_id").eq("id", 1).maybeSingle(),
    supabase.from("suppliers").select("id, name, telegram_chat_id").order("name"),
    supabase
      .from("telegram_accounts")
      .select("profile_id, telegram_username, telegram_name, linked_at, profile:profiles!profile_id(full_name, email)")
      .order("linked_at", { ascending: false }),
  ]);

  const accountRows: LinkedAccountRow[] = ((accounts ?? []) as unknown as {
    profile_id: string;
    telegram_username: string | null;
    telegram_name: string | null;
    linked_at: string;
    profile: { full_name: string | null; email: string } | null;
  }[]).map((a) => ({
    profileId: a.profile_id,
    name: a.profile?.full_name || a.profile?.email || "—",
    telegram: a.telegram_username ? `@${a.telegram_username}` : (a.telegram_name ?? "—"),
    linkedAt: a.linked_at,
  }));
  const mine = accountRows.find((a) => a.profileId === profile!.id);

  return (
    <TelegramSettings
      status={status ?? { configured: false, username: null, webhookUrl: null, expectedUrl: null, pending: 0, lastError: null }}
      groups={((chats ?? []) as { chat_id: number; title: string | null }[]).map((c) => ({
        chatId: Number(c.chat_id),
        title: c.title ?? `Grup ${c.chat_id}`,
      }))}
      prChatId={settings?.pr_chat_id != null ? Number(settings.pr_chat_id) : null}
      suppliers={((suppliers ?? []) as { id: string; name: string; telegram_chat_id: number | null }[]).map((s): SupplierGroupRow => ({
        id: s.id,
        name: s.name,
        chatId: s.telegram_chat_id != null ? Number(s.telegram_chat_id) : null,
      }))}
      accounts={accountRows}
      myTelegram={mine ? mine.telegram : null}
    />
  );
}
