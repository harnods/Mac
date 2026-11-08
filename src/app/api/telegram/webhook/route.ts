import { timingSafeEqual } from "node:crypto";
import { handleUpdate, type TgUpdate } from "@/lib/telegram/bot";
import { telegramEnv } from "@/lib/telegram/api";

export const dynamic = "force-dynamic";

function validSecret(header: string | null): boolean {
  const { secret } = telegramEnv();
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Telegram webhook. Registered with setWebhook(secret_token=TELEGRAM_WEBHOOK_SECRET);
 * Telegram echoes the secret in X-Telegram-Bot-Api-Secret-Token on every call.
 */
export async function POST(request: Request) {
  if (!validSecret(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (typeof update?.update_id !== "number") return new Response("Bad request", { status: 400 });

  try {
    await handleUpdate(update);
  } catch (e) {
    // Always 200 after logging: the update is already marked as received, and a
    // non-2xx would make Telegram retry (and block) the whole update queue.
    console.error("[telegram] update failed", update.update_id, e);
  }
  return Response.json({ ok: true });
}
