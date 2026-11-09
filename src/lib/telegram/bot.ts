import "server-only";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { P } from "@/lib/permissions";
import { formatNum } from "@/lib/units";
import { formatId } from "@/lib/format";
import { answerCallback, botUsername, editMessage, esc, sendMessage, sendPhoto, sendTyping, telegramEnv, type InlineKeyboard } from "./api";
import { answerQuestion } from "./assistant";
import { parsePurchaseText, type ParsedItem, type Unmatched } from "./parse";
import { STOCK_HELP, stockQuery, stockReply, type StockQuery } from "./stock";
import { linkedAccount } from "./account";
import {
  HELP,
  attendanceReply,
  blockedText,
  detectCommand,
  myRequestsReply,
  recipeReply,
  scheduleReply,
  type Command,
} from "./commands";

/*
 * Flow
 * ────
 * Employees post their shopping list in the Purchase Requests GROUP
 * (telegram_settings.pr_chat_id). The bot replies to that message with the
 * parsed items + [✅ Kirim] [❌ Batal]; only the requester can press them.
 * On Kirim the confirmation message becomes the final per-supplier summary
 * and each supplier's group gets its own list.
 *
 * DMs are only used to link an account (/start <code> from the web app).
 * Supplier groups are output-only — messages there are ignored.
 */

// ─── Telegram update shapes (only the fields we use) ─────────────────────────

type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
type TgChat = { id: number; type: "private" | "group" | "supergroup" | "channel"; title?: string };
type TgMessage = {
  message_id: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
  caption?: string;
  migrate_to_chat_id?: number;
  reply_to_message?: { message_id: number; from?: TgUser; text?: string; caption?: string };
};
type TgCallbackQuery = { id: string; from: TgUser; data?: string; message?: TgMessage };
type TgChatMemberUpdated = { chat: TgChat; new_chat_member: { status: string } };
export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
  my_chat_member?: TgChatMemberUpdated;
};

const MAX_TEXT = 2000;
const MAX_PARSES_PER_HOUR = 30;

const GROUP_HELP = HELP;

function db() {
  return createServiceClient();
}

function appUrl(path: string): string | null {
  const base = telegramEnv().appBaseUrl;
  return base ? `${base}${path}` : null;
}

/** Same short reference as the web app's ID column (e.g. "74E3-36A7"). */
function shortRef(id: string): string {
  return formatId(id);
}

function qtyText(qty: number, unit: string): string {
  return `${formatNum(qty)} ${esc(unit)}`;
}

function displayName(u: TgUser): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || (u.username ? `@${u.username}` : "Karyawan");
}

async function prChatId(): Promise<number | null> {
  const { data } = await db().from("telegram_settings").select("pr_chat_id").eq("id", 1).maybeSingle();
  return data?.pr_chat_id != null ? Number(data.pr_chat_id) : null;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function handleUpdate(update: TgUpdate): Promise<void> {
  // Telegram retries until it gets a 2xx — process each update once.
  const { data: fresh } = await db()
    .from("telegram_updates")
    .upsert({ update_id: update.update_id }, { onConflict: "update_id", ignoreDuplicates: true })
    .select("update_id");
  if (!fresh || fresh.length === 0) return;

  if (update.my_chat_member) return handleMembership(update.my_chat_member);
  if (update.callback_query) return handleCallback(update.callback_query);
  const msg = update.message;
  if (!msg) return;
  if (msg.migrate_to_chat_id) return migrateChat(msg.chat.id, msg.migrate_to_chat_id, msg.chat);
  if (msg.chat.type === "private") return handlePrivate(msg);

  // Group message: keep the title fresh; only the Purchase Requests group takes requests.
  await rememberChat(msg.chat, true);
  if (msg.chat.id === (await prChatId())) return handlePrGroupMessage(msg);
}

// ─── Groups ──────────────────────────────────────────────────────────────────

async function rememberChat(chat: TgChat, isMember: boolean) {
  if (chat.type === "private") return;
  const { error } = await db()
    .from("telegram_chats")
    .upsert(
      { chat_id: chat.id, title: chat.title ?? null, type: chat.type, is_member: isMember, updated_at: new Date().toISOString() },
      { onConflict: "chat_id" },
    );
  if (error) console.error("[telegram] rememberChat failed", error);
}

async function handleMembership(u: TgChatMemberUpdated) {
  if (u.chat.type === "private") return;
  const isMember = ["member", "administrator", "creator"].includes(u.new_chat_member.status);
  await rememberChat(u.chat, isMember);
  if (isMember) {
    await sendMessage(
      u.chat.id,
      "👋 Grup ini sudah tercatat di Machitori.\nAtur di <b>Purchasing → Telegram</b>: jadikan grup Purchase Requests atau grup untuk supplier tertentu.",
    ).catch(() => undefined);
  }
}

/** A group upgraded to a supergroup gets a new chat id — carry the settings over. */
async function migrateChat(oldId: number, newId: number, chat: TgChat) {
  const supabase = db();
  await supabase
    .from("telegram_chats")
    .upsert({ chat_id: newId, title: chat.title ?? null, type: "supergroup", is_member: true, updated_at: new Date().toISOString() }, { onConflict: "chat_id" });
  await supabase.from("suppliers").update({ telegram_chat_id: newId }).eq("telegram_chat_id", oldId);
  await supabase.from("telegram_settings").update({ pr_chat_id: newId }).eq("pr_chat_id", oldId);
  await supabase.from("telegram_chats").update({ is_member: false }).eq("chat_id", oldId);
}

// ─── Requester ───────────────────────────────────────────────────────────────

type Requester = { profileId: string; name: string };

async function requesterFor(user: TgUser): Promise<Requester | { error: string }> {
  const acct = await linkedAccount(user.id);
  if ("error" in acct) return acct;
  if (!acct.permissions.includes(P.PURCHASING_REQUEST)) {
    return { error: "Akun kamu belum punya izin membuat purchase request. Hubungi admin." };
  }
  return { profileId: acct.profileId, name: acct.name };
}

/** Stock lookups: any linked account that can see ingredients or purchasing. */
async function canCheckStock(user: TgUser): Promise<true | { error: string }> {
  const acct = await linkedAccount(user.id);
  if ("error" in acct) return acct;
  const ok = [P.INGREDIENTS_READ, P.PURCHASING_READ, P.PURCHASING_REQUEST].some((k) => acct.permissions.includes(k));
  return ok ? true : { error: "Akun kamu belum punya izin melihat stok. Hubungi admin." };
}

/**
 * Help, recipes, own attendance/schedule/requests, and refusals for payroll or
 * crew data. Personal data always goes to the user's DM, never the group.
 */
async function handleCommand(cmd: Command, chatId: number, user: TgUser, inGroup: boolean, replyTo?: number) {
  if (cmd.kind === "help") {
    await sendMessage(chatId, HELP, undefined, replyTo);
    return;
  }
  if (cmd.kind === "blocked") {
    await sendMessage(chatId, blockedText(cmd.topic), undefined, replyTo);
    return;
  }

  const acct = await linkedAccount(user.id);
  if ("error" in acct) {
    await sendMessage(chatId, acct.error, undefined, replyTo);
    return;
  }

  if (cmd.kind === "recipe") {
    const recipe = await recipeReply(acct, cmd.query);
    if (recipe.photoUrl) {
      // Telegram captions are capped at 1024 visible characters.
      const fitsCaption = recipe.text.replace(/<[^>]+>/g, "").length <= 1000;
      try {
        await sendPhoto(chatId, recipe.photoUrl, fitsCaption ? recipe.text : undefined, replyTo);
        if (!fitsCaption) await sendMessage(chatId, recipe.text, undefined, replyTo);
        return;
      } catch (e) {
        console.error("[telegram] recipe photo failed", e); // fall back to text only
      }
    }
    await sendMessage(chatId, recipe.text, undefined, replyTo);
    return;
  }

  const text =
    cmd.kind === "attendance"
      ? await attendanceReply(acct)
      : cmd.kind === "schedule"
        ? await scheduleReply(acct)
        : await myRequestsReply(acct);

  if (!inGroup) {
    await sendMessage(chatId, text);
    return;
  }
  // Personal data: DM the user (their private chat id is their user id).
  try {
    await sendMessage(user.id, text);
    await sendMessage(chatId, "📩 Cek DM ya", undefined, replyTo);
  } catch {
    await sendMessage(chatId, "Saya belum bisa kirim DM ke kamu. Buka chat dengan bot ini dan tekan Start dulu, lalu coba lagi.", undefined, replyTo);
  }
}

async function handleStock(chatId: number, user: TgUser, sq: StockQuery, replyTo?: number) {
  const allowed = await canCheckStock(user);
  if (allowed !== true) {
    if (sq.explicit) await sendMessage(chatId, allowed.error, undefined, replyTo);
    return;
  }
  if (!sq.query) {
    if (sq.explicit) await sendMessage(chatId, STOCK_HELP, undefined, replyTo);
    return;
  }
  const reply = await stockReply(sq.query);
  // A passing mention of "stock" in chat that matches nothing: stay quiet.
  if (!sq.explicit && reply.found === 0) return;
  await sendMessage(chatId, reply.text, undefined, replyTo);
}

/** Ask Claude (recipes/stock Q&A). `context` = text of the message being replied to. */
async function askAssistant(chatId: number, user: TgUser, question: string, context?: string, replyTo?: number) {
  const acct = await linkedAccount(user.id);
  if ("error" in acct) {
    await sendMessage(chatId, acct.error, undefined, replyTo);
    return;
  }
  await sendTyping(chatId);
  let answer: string;
  try {
    answer = await answerQuestion(acct, user.id, question, context);
  } catch (e) {
    console.error("[telegram] assistant failed", e);
    answer = "Maaf, gagal menjawab. Coba lagi sebentar lagi.";
  }
  // Plain-text answer → escape for HTML mode; Telegram caps messages at 4096 chars.
  await sendMessage(chatId, esc(answer.length > 3900 ? `${answer.slice(0, 3900)}…` : answer), undefined, replyTo);
}

/** Is this group message addressed to the bot (reply to one of its messages, or @mention)? */
async function addressedToBot(msg: TgMessage): Promise<boolean> {
  let username: string;
  try {
    username = (await botUsername()).toLowerCase();
  } catch {
    return false;
  }
  const replied = msg.reply_to_message?.from;
  if (replied?.is_bot && replied.username?.toLowerCase() === username) return true;
  return (msg.text ?? "").toLowerCase().includes(`@${username}`);
}

function parseCommand(text: string): { cmd: string; args: string[] } | null {
  if (!text.startsWith("/")) return null;
  const [command, ...args] = text.split(/\s+/);
  return { cmd: command.toLowerCase().replace(/@\w+$/, ""), args };
}

// ─── Private chat: account linking only ──────────────────────────────────────

async function handlePrivate(msg: TgMessage) {
  const chatId = msg.chat.id;
  const user = msg.from;
  if (!user || user.is_bot) return;
  const text = (msg.text ?? "").trim();
  const command = parseCommand(text);

  if (command?.cmd === "/start" && command.args[0]) return linkAccount(chatId, user, command.args[0]);
  const sq = stockQuery(text);
  if (sq !== null) return handleStock(chatId, user, sq);
  const cmd = detectCommand(text);
  if (cmd) return handleCommand(cmd, chatId, user, false);

  if (!text || text.startsWith("/")) {
    const r = await linkedAccount(user.id);
    await sendMessage(
      chatId,
      "error" in r
        ? r.error
        : `Halo ${esc(r.name)}! 👋\nPurchase request dibuat di grup <b>Purchase Requests</b> (bukan di sini).\n\n${GROUP_HELP}`,
    );
    return;
  }
  // Anything else in DM is a question for the assistant.
  const context = msg.reply_to_message?.text ?? msg.reply_to_message?.caption;
  return askAssistant(chatId, user, text, context);
}

async function linkAccount(chatId: number, user: TgUser, code: string) {
  const supabase = db();
  const { data: row } = await supabase
    .from("telegram_link_codes")
    .select("code, profile_id, expires_at, used_at")
    .eq("code", code)
    .maybeSingle();
  if (!row || row.used_at || new Date(row.expires_at as string).getTime() < Date.now()) {
    await sendMessage(chatId, "Link tidak valid atau sudah kedaluwarsa. Buat link baru dari halaman Profile di Machitori.");
    return;
  }

  // One Telegram account per profile and vice versa — replace any previous link.
  await supabase.from("telegram_accounts").delete().or(`profile_id.eq.${row.profile_id},telegram_user_id.eq.${user.id}`);
  const { error } = await supabase.from("telegram_accounts").insert({
    telegram_user_id: user.id,
    profile_id: row.profile_id,
    telegram_username: user.username ?? null,
    telegram_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || null,
  });
  if (error) {
    console.error("[telegram] link failed", error);
    await sendMessage(chatId, "Gagal menghubungkan akun. Coba lagi.");
    return;
  }
  await supabase.from("telegram_link_codes").update({ used_at: new Date().toISOString() }).eq("code", code);
  revalidatePath("/me/profile");
  revalidatePath("/purchasing/telegram");

  const r = await requesterFor(user);
  await sendMessage(
    chatId,
    "error" in r
      ? `✅ Akun terhubung!\n\n${r.error}`
      : `✅ Akun terhubung!\n\nSekarang kamu bisa membuat purchase request di grup <b>Purchase Requests</b>.\n\n${GROUP_HELP}`,
  );
}

// ─── Purchase Requests group ─────────────────────────────────────────────────

async function handlePrGroupMessage(msg: TgMessage) {
  const chatId = msg.chat.id;
  const user = msg.from;
  if (!user || user.is_bot) return;
  const text = (msg.text ?? "").replace(/@\w+bot\b/gi, "").trim();
  if (!text) return;

  const sq = stockQuery(text);
  if (sq !== null) return handleStock(chatId, user, sq, msg.message_id);
  const cmd = detectCommand(text);
  if (cmd) return handleCommand(cmd, chatId, user, true, msg.message_id);

  // Replying to / mentioning the bot with a question → assistant. A message with
  // numbers that isn't phrased as a question is still treated as a request.
  const isQuestion = /\?|\b(?:berapa|brp|apa|apakah|bisa|gimana|bagaimana|kenapa|mengapa|kapan|cukup|how|what|why)\b/i.test(text);
  if ((isQuestion || !/\d/.test(text)) && (await addressedToBot(msg))) {
    const context = msg.reply_to_message?.text ?? msg.reply_to_message?.caption;
    return askAssistant(chatId, user, text, context, msg.message_id);
  }

  const command = parseCommand(text);
  if (command) {
    if (command.cmd === "/start") {
      await sendMessage(chatId, GROUP_HELP, undefined, msg.message_id);
    } else if (command.cmd === "/batal" || command.cmd === "/cancel") {
      const { data } = await db()
        .from("telegram_pr_drafts")
        .update({ status: "cancelled" })
        .eq("telegram_user_id", user.id)
        .eq("status", "pending")
        .select("id");
      await sendMessage(
        chatId,
        data?.length ? "Request kamu yang belum dikirim sudah dibatalkan." : "Tidak ada request kamu yang menunggu konfirmasi.",
        undefined,
        msg.message_id,
      );
    }
    return;
  }

  // Plain chat without any number is very unlikely to be a shopping list —
  // stay quiet so the group isn't flooded with bot replies.
  const looksLikeRequest = /\d/.test(text);

  const r = await requesterFor(user);
  if ("error" in r) {
    if (looksLikeRequest) await sendMessage(chatId, r.error, undefined, msg.message_id);
    return;
  }
  if (!looksLikeRequest) return;
  if (text.length > MAX_TEXT) {
    await sendMessage(chatId, `Pesan terlalu panjang (maks ${MAX_TEXT} karakter). Bagi jadi beberapa request.`, undefined, msg.message_id);
    return;
  }

  const supabase = db();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("telegram_pr_drafts")
    .select("id", { count: "exact", head: true })
    .eq("telegram_user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_PARSES_PER_HOUR) {
    await sendMessage(chatId, "Terlalu banyak request dalam 1 jam terakhir. Coba lagi nanti.", undefined, msg.message_id);
    return;
  }

  await sendTyping(chatId);
  let parsed: Awaited<ReturnType<typeof parsePurchaseText>>;
  try {
    parsed = await parsePurchaseText(text);
  } catch (e) {
    console.error("[telegram] parse failed", e);
    await sendMessage(chatId, "Maaf, gagal membaca pesan kamu. Coba lagi sebentar lagi.", undefined, msg.message_id);
    return;
  }

  if (parsed.items.length === 0) {
    // It had numbers, so it was probably meant as a request — explain why nothing matched.
    if (parsed.unmatched.length > 0) {
      await sendMessage(
        chatId,
        ["Tidak ada barang yang bisa dicocokkan.", unmatchedBlock(parsed.unmatched)].join("\n"),
        undefined,
        msg.message_id,
      );
    }
    return;
  }

  // One open draft per user — older unconfirmed drafts are superseded.
  await supabase.from("telegram_pr_drafts").update({ status: "cancelled" }).eq("telegram_user_id", user.id).eq("status", "pending");

  const { data: draft, error } = await supabase
    .from("telegram_pr_drafts")
    .insert({
      telegram_user_id: user.id,
      profile_id: r.profileId,
      source_text: text,
      items: parsed.items,
      unmatched: parsed.unmatched,
    })
    .select("id")
    .single();
  if (error || !draft) {
    console.error("[telegram] draft insert failed", error);
    await sendMessage(chatId, "Maaf, terjadi kesalahan. Coba lagi.", undefined, msg.message_id);
    return;
  }

  const keyboard: InlineKeyboard = [[
    { text: "✅ Kirim", callback_data: `pr:ok:${draft.id}` },
    { text: "❌ Batal", callback_data: `pr:no:${draft.id}` },
  ]];
  await sendMessage(
    chatId,
    `${draftText(displayName(user), parsed.items, parsed.unmatched)}\n\nKirim request ini?`,
    keyboard,
    msg.message_id,
  );
}

function itemsBlock(items: { name: string; qty: number; unit: string }[]): string {
  return items.map((it) => `- ${esc(it.name)} - ${qtyText(it.qty, it.unit)}`).join("\n");
}

function unmatchedBlock(unmatched: Unmatched[]): string {
  if (unmatched.length === 0) return "";
  return ["", "⚠️ <b>Tidak dimasukkan:</b>", ...unmatched.map((u) => `• "${esc(u.raw)}" — ${esc(u.reason)}`)].join("\n");
}

/** Group-facing layout (no supplier names): header, requester, item list. */
function requestText(ref: string | null, requester: string, items: { name: string; qty: number; unit: string }[]): string {
  return [`<b>Purchase Request${ref ? ` #${esc(ref)}` : ""}</b>`, `Dari: ${esc(requester)}`, "", itemsBlock(items)].join("\n");
}

function draftText(requester: string, items: ParsedItem[], unmatched: Unmatched[]): string {
  return [requestText(null, requester, items), unmatchedBlock(unmatched)].filter(Boolean).join("\n");
}

// ─── Confirm / cancel buttons ────────────────────────────────────────────────

async function handleCallback(cq: TgCallbackQuery) {
  const [ns, action, draftId] = (cq.data ?? "").split(":");
  if (ns !== "pr" || !draftId || !cq.message) {
    await answerCallback(cq.id);
    return;
  }
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const supabase = db();

  const { data: draft } = await supabase
    .from("telegram_pr_drafts")
    .select("id, telegram_user_id, status, items, unmatched")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) {
    await answerCallback(cq.id, "Request tidak ditemukan.");
    return;
  }
  // In the group anyone can see the buttons — only the requester may use them.
  if (Number(draft.telegram_user_id) !== cq.from.id) {
    await answerCallback(cq.id, "Hanya pengirim request yang bisa menekan tombol ini.");
    return;
  }
  // Only the requester can press, so cq.from is the requester's Telegram account.
  const ownerName = displayName(cq.from);
  const items = draft.items as ParsedItem[];
  const unmatched = draft.unmatched as Unmatched[];

  if (action === "no") {
    await supabase.from("telegram_pr_drafts").update({ status: "cancelled" }).eq("id", draftId).eq("status", "pending");
    await answerCallback(cq.id, "Dibatalkan");
    await editMessage(chatId, messageId, `${draftText(ownerName, items, unmatched)}\n\n❌ <i>Dibatalkan.</i>`).catch(() => undefined);
    return;
  }
  if (action !== "ok") {
    await answerCallback(cq.id);
    return;
  }

  // Claim the draft atomically so a double tap can't create two requests.
  const { data: claimed } = await supabase
    .from("telegram_pr_drafts")
    .update({ status: "submitted" })
    .eq("id", draftId)
    .eq("status", "pending")
    .select("id");
  if (!claimed || claimed.length === 0) {
    await answerCallback(cq.id, draft.status === "submitted" ? "Sudah dikirim." : "Request ini sudah dibatalkan.");
    return;
  }

  const r = await requesterFor(cq.from);
  if ("error" in r) {
    await supabase.from("telegram_pr_drafts").update({ status: "cancelled" }).eq("id", draftId);
    await answerCallback(cq.id);
    await editMessage(chatId, messageId, `${draftText(ownerName, items, unmatched)}\n\n${r.error}`).catch(() => undefined);
    return;
  }

  await answerCallback(cq.id, "Mengirim…");
  try {
    const requestId = await createRequest(r, items, ownerName);
    await supabase.from("telegram_pr_drafts").update({ request_id: requestId }).eq("id", draftId);
    const result = await distributeRequest(requestId, ownerName, chatId);
    revalidatePath("/purchasing/requests");
    // The confirmation message becomes the final summary (no duplicate post).
    const footer = unmatchedBlock(unmatched);
    await editMessage(chatId, messageId, `${result.overview}${footer ? `\n${footer}` : ""}\n\nTerkirim`);
  } catch (e) {
    console.error("[telegram] submit failed", e);
    // Let the user retry with the same buttons.
    await supabase.from("telegram_pr_drafts").update({ status: "pending" }).eq("id", draftId).is("request_id", null);
    await sendMessage(chatId, "Maaf, gagal mengirim request. Tekan ✅ Kirim lagi untuk mencoba ulang.", undefined, messageId);
  }
}

// ─── Create + distribute ─────────────────────────────────────────────────────

/** `telegramName` goes into the note so the web shows who sent it, even on a shared account. */
async function createRequest(r: Requester, items: ParsedItem[], telegramName: string): Promise<string> {
  const supabase = db();
  const ids = items.map((i) => i.item_id);

  const [{ data: stock }, { data: primaries }] = await Promise.all([
    supabase.from("items").select("id, unit, on_hand, reserved").in("id", ids),
    supabase.from("item_suppliers").select("item_id, supplier_id").in("item_id", ids).eq("is_primary", true),
  ]);
  const stockById = new Map(((stock ?? []) as { id: string; unit: string; on_hand: number; reserved: number }[]).map((s) => [s.id, s]));
  const primaryById = new Map(((primaries ?? []) as { item_id: string; supplier_id: string }[]).map((p) => [p.item_id, p.supplier_id]));

  const { data: req, error } = await supabase
    .from("purchase_requests")
    .insert({
      status: "pending",
      source: "telegram",
      note: `Dari Telegram · ${telegramName}`,
      created_by: r.profileId,
      updated_by: r.profileId,
    })
    .select("id")
    .single();
  if (error || !req) throw error ?? new Error("Failed to create request");

  const rows = items.map((it) => {
    const s = stockById.get(it.item_id);
    return {
      request_id: req.id,
      item_id: it.item_id,
      qty: it.qty,
      unit: it.unit,
      supplier_id: primaryById.get(it.item_id) ?? null,
      available_snapshot: s ? Number(s.on_hand) - Number(s.reserved) : null,
      available_unit: s ? s.unit : null,
    };
  });
  const { error: itemsError } = await supabase.from("purchase_request_items").insert(rows);
  if (itemsError) {
    await supabase.from("purchase_requests").delete().eq("id", req.id);
    throw itemsError;
  }
  return req.id as string;
}

type DistItem = { name: string; qty: number; unit: string };

/**
 * Send one message per supplier group and build the per-supplier overview.
 * The overview is posted to the Purchase Requests group unless the request
 * came from that group (`originChatId`) — then the caller edits its own
 * confirmation message into the overview instead.
 */
export async function distributeRequest(
  requestId: string,
  requesterName: string,
  originChatId?: number,
): Promise<{ overview: string }> {
  const supabase = db();
  const [{ data: req }, prChat] = await Promise.all([
    supabase
      .from("purchase_requests")
      .select(
        "id, created_at, purchase_request_items(qty, unit, created_at, item:items!item_id(name), supplier:suppliers!supplier_id(id, name, telegram_chat_id))",
      )
      .eq("id", requestId)
      .single(),
    prChatId(),
  ]);
  if (!req) throw new Error("Request not found");

  const requester = requesterName;
  const lines = (req.purchase_request_items ?? []) as unknown as {
    qty: number;
    unit: string;
    item: { name: string } | null;
    supplier: { id: string; name: string; telegram_chat_id: number | null } | null;
  }[];

  const bySupplier = new Map<string, { name: string; chatId: number | null; items: DistItem[] }>();
  const allItems: DistItem[] = [];
  for (const l of lines) {
    const it = { name: l.item?.name ?? "?", qty: Number(l.qty), unit: l.unit };
    allItems.push(it);
    if (!l.supplier) continue;
    const g = bySupplier.get(l.supplier.id) ?? { name: l.supplier.name, chatId: l.supplier.telegram_chat_id, items: [] };
    g.items.push(it);
    bySupplier.set(l.supplier.id, g);
  }

  const ref = `PR #${shortRef(requestId)}`;
  const link = appUrl(`/purchasing/requests/${requestId}`);
  const list = (items: DistItem[]) => items.map((i) => `• ${esc(i.name)} — ${qtyText(i.qty, i.unit)}`).join("\n");

  // One message per supplier group.
  for (const g of bySupplier.values()) {
    if (!g.chatId) continue;
    const text = [
      `🛒 <b>Belanja untuk ${esc(g.name)}</b>`,
      `Dari: ${esc(requester)} · ${ref}`,
      "",
      list(g.items),
      ...(link ? ["", `<a href="${esc(link)}">Lihat di Machitori</a>`] : []),
    ].join("\n");
    try {
      await sendMessage(Number(g.chatId), text);
    } catch (e) {
      console.error("[telegram] supplier group send failed", g.name, e);
    }
  }

  // Purchase Requests group: requester + items only (no supplier names).
  const overview = requestText(shortRef(requestId), requester, allItems);

  if (prChat && prChat !== originChatId) {
    await sendMessage(prChat, overview).catch((e) => console.error("[telegram] PR group send failed", e));
  }
  return { overview };
}
