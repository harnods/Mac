"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { botUsername, telegramConfigured, telegramEnv, tg } from "@/lib/telegram/api";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const LINK_TTL_MINUTES = 15;

/** Managing the bot's groups is for people who make purchases (and admins). */
type AuthCheck =
  | { error: string }
  | { profile: NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>> };

async function requireTelegramAdmin(): Promise<AuthCheck> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not authenticated" };
  if (!can(profile, P.PURCHASING_PURCHASE)) return { error: "No permission" };
  return { profile };
}

function revalidate() {
  revalidatePath("/purchasing/telegram");
  revalidatePath("/purchasing/suppliers", "layout");
}

// ─── Account linking (any signed-in user) ────────────────────────────────────

export async function createTelegramLink(): Promise<Result<{ url: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!telegramConfigured()) return { ok: false, error: "Telegram bot belum dikonfigurasi" };

  const code = randomBytes(18).toString("base64url"); // 24 chars, fits Telegram's 64-char start param
  const supabase = await createClient();
  const { error } = await supabase.from("telegram_link_codes").insert({
    code,
    profile_id: profile.id,
    expires_at: new Date(Date.now() + LINK_TTL_MINUTES * 60_000).toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  try {
    const username = await botUsername();
    return { ok: true, url: `https://t.me/${username}?start=${code}` };
  } catch {
    return { ok: false, error: "Tidak bisa menghubungi Telegram" };
  }
}

export async function unlinkMyTelegram(): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.from("telegram_accounts").delete().eq("profile_id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me/profile");
  revalidate();
  return { ok: true };
}

// ─── Group assignment ────────────────────────────────────────────────────────

const chatIdSchema = z.number().int().nullable();

export async function setPurchaseRequestGroup(chatId: number | null): Promise<Result> {
  const auth = await requireTelegramAdmin();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!chatIdSchema.safeParse(chatId).success) return { ok: false, error: "Invalid group" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("telegram_settings")
    .update({ pr_chat_id: chatId, updated_by: auth.profile.id, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function setSupplierGroup(supplierId: string, chatId: number | null): Promise<Result> {
  const auth = await requireTelegramAdmin();
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!z.string().uuid().safeParse(supplierId).success || !chatIdSchema.safeParse(chatId).success) {
    return { ok: false, error: "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ telegram_chat_id: chatId, updated_by: auth.profile.id })
    .eq("id", supplierId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

export type WebhookStatus = {
  configured: boolean;
  username: string | null;
  webhookUrl: string | null;
  expectedUrl: string | null;
  pending: number;
  lastError: string | null;
};

function expectedWebhookUrl(): string | null {
  const base = telegramEnv().appBaseUrl;
  return base ? `${base}/api/telegram/webhook` : null;
}

export async function getWebhookStatus(): Promise<WebhookStatus | null> {
  const auth = await requireTelegramAdmin();
  if ("error" in auth) return null;
  const expectedUrl = expectedWebhookUrl();
  if (!telegramConfigured()) {
    return { configured: false, username: null, webhookUrl: null, expectedUrl, pending: 0, lastError: null };
  }
  try {
    const [username, info] = await Promise.all([
      botUsername(),
      tg<{ url: string; pending_update_count: number; last_error_message?: string }>("getWebhookInfo", {}),
    ]);
    return {
      configured: true,
      username,
      webhookUrl: info.url || null,
      expectedUrl,
      pending: info.pending_update_count,
      lastError: info.last_error_message ?? null,
    };
  } catch (e) {
    return {
      configured: true,
      username: null,
      webhookUrl: null,
      expectedUrl,
      pending: 0,
      lastError: e instanceof Error ? e.message : "Telegram error",
    };
  }
}

export async function registerWebhook(): Promise<Result> {
  const auth = await requireTelegramAdmin();
  if ("error" in auth) return { ok: false, error: auth.error };
  const url = expectedWebhookUrl();
  if (!url || !url.startsWith("https://")) return { ok: false, error: "APP_BASE_URL harus https:// (webhook butuh URL publik)" };
  const { secret } = telegramEnv();
  if (!secret) return { ok: false, error: "TELEGRAM_WEBHOOK_SECRET belum di-set" };
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    return { ok: false, error: "TELEGRAM_WEBHOOK_SECRET hanya boleh berisi huruf, angka, _ dan - (maks 256 karakter)" };
  }

  try {
    await tg("setWebhook", {
      url,
      secret_token: secret,
      allowed_updates: ["message", "callback_query", "my_chat_member"],
      drop_pending_updates: false,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Telegram error" };
  }
  revalidate();
  return { ok: true };
}
