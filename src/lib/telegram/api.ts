import "server-only";

/** Minimal Telegram Bot API client (only what the purchasing bot uses). */

const API = "https://api.telegram.org";

export type InlineKeyboard = { text: string; callback_data: string }[][];

type TgResponse<T> = { ok: true; result: T } | { ok: false; description?: string; error_code?: number };

export class TelegramError extends Error {}

export function telegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramError("TELEGRAM_BOT_TOKEN is not set");
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as TgResponse<T> | null;
  if (!json || !json.ok) {
    throw new TelegramError(`Telegram ${method} failed: ${json && !json.ok ? json.description : res.status}`);
  }
  return json.result;
}

export function sendMessage(chatId: number, text: string, keyboard?: InlineKeyboard) {
  return tg<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export function editMessage(chatId: number, messageId: number, text: string, keyboard?: InlineKeyboard) {
  return tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: keyboard ?? [] },
  });
}

export function answerCallback(callbackQueryId: string, text?: string) {
  return tg("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
}

export function sendTyping(chatId: number) {
  return tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => undefined);
}

let cachedUsername: string | null = null;
/** Bot username (for t.me deep links). Uses TELEGRAM_BOT_USERNAME when set. */
export async function botUsername(): Promise<string> {
  if (process.env.TELEGRAM_BOT_USERNAME) return process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, "");
  if (cachedUsername) return cachedUsername;
  const me = await tg<{ username: string }>("getMe", {});
  cachedUsername = me.username;
  return cachedUsername;
}

/** Escape text for Telegram's HTML parse mode. */
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
