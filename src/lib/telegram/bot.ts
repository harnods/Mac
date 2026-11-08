import "server-only";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { permissionsForRole } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { formatNum } from "@/lib/units";
import { answerCallback, editMessage, esc, sendMessage, sendTyping, telegramEnv, type InlineKeyboard } from "./api";
import { parsePurchaseText, type ParsedItem, type Unmatched } from "./parse";

// ─── Telegram update shapes (only the fields we use) ─────────────────────────

type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string };
type TgChat = { id: number; type: "private" | "group" | "supergroup" | "channel"; title?: string };
type TgMessage = {
  message_id: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
  migrate_to_chat_id?: number;
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

const HELP = [
  "Kirim daftar belanja dalam satu pesan, contoh:",
  "<i>almond 2 kg, ayam 5 kg, susu UHT 3 karton</i>",
  "",
  "Saya akan mencocokkan ke daftar ingredient, lalu minta konfirmasi sebelum dikirim.",
  "Setelah dikirim, request masuk ke grup Purchase Requests dan dibagi ke grup supplier masing-masing.",
  "",
  "/batal — batalkan request yang belum dikirim",
].join("\n");

function db() {
  return createServiceClient();
}

function appUrl(path: string): string | null {
  const base = telegramEnv().appBaseUrl;
  return base ? `${base}${path}` : null;
}

function shortRef(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function qtyText(qty: number, unit: string): string {
  return `${formatNum(qty)} ${esc(unit)}`;
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
  // Group messages: just keep the group's title fresh.
  await rememberChat(msg.chat, true);
}

// ─── Groups ──────────────────────────────────────────────────────────────────

async function rememberChat(chat: TgChat, isMember: boolean) {
  if (chat.type === "private") return;
  await db()
    .from("telegram_chats")
    .upsert(
      { chat_id: chat.id, title: chat.title ?? null, type: chat.type, is_member: isMember, updated_at: new Date().toISOString() },
      { onConflict: "chat_id" },
    );
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

// ─── Private chat ────────────────────────────────────────────────────────────

type Requester = { profileId: string; name: string };

async function requesterFor(user: TgUser): Promise<Requester | { error: string }> {
  const supabase = db();
  const { data: acct } = await supabase
    .from("telegram_accounts")
    .select("profile_id")
    .eq("telegram_user_id", user.id)
    .maybeSingle();
  if (!acct) {
    return {
      error:
        "Akun Telegram kamu belum terhubung ke Machitori.\nBuka Machitori → <b>Profile</b> → <b>Hubungkan Telegram</b>, lalu ikuti link-nya.",
    };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", acct.profile_id)
    .maybeSingle();
  if (!profile) return { error: "Akun Machitori kamu tidak ditemukan." };
  const permissions = await permissionsForRole(profile.role as string);
  if (!permissions.includes(P.PURCHASING_REQUEST)) {
    return { error: "Akun kamu belum punya izin membuat purchase request. Hubungi admin." };
  }
  return {
    profileId: profile.id as string,
    name: (profile.full_name as string | null) || String(profile.email ?? "").split("@")[0] || "Karyawan",
  };
}

async function handlePrivate(msg: TgMessage) {
  const chatId = msg.chat.id;
  const user = msg.from;
  if (!user || user.is_bot) return;
  const text = (msg.text ?? "").trim();
  if (!text) {
    await sendMessage(chatId, "Kirim daftar belanja dalam bentuk teks ya.");
    return;
  }

  const [command, ...args] = text.split(/\s+/);
  const cmd = command.toLowerCase().replace(/@\w+$/, "");

  if (cmd === "/start") {
    if (args[0]) return linkAccount(chatId, user, args[0]);
    const r = await requesterFor(user);
    await sendMessage(chatId, "error" in r ? r.error : `Halo ${esc(r.name)}! 👋\n\n${HELP}`);
    return;
  }
  if (cmd === "/help" || cmd === "/bantuan") {
    await sendMessage(chatId, HELP);
    return;
  }
  if (cmd === "/batal" || cmd === "/cancel") {
    const { data } = await db()
      .from("telegram_pr_drafts")
      .update({ status: "cancelled" })
      .eq("telegram_user_id", user.id)
      .eq("status", "pending")
      .select("id");
    await sendMessage(chatId, data?.length ? "Request yang belum dikirim sudah dibatalkan." : "Tidak ada request yang menunggu konfirmasi.");
    return;
  }
  if (cmd.startsWith("/")) {
    await sendMessage(chatId, HELP);
    return;
  }

  const r = await requesterFor(user);
  if ("error" in r) {
    await sendMessage(chatId, r.error);
    return;
  }
  if (text.length > MAX_TEXT) {
    await sendMessage(chatId, `Pesan terlalu panjang (maks ${MAX_TEXT} karakter). Bagi jadi beberapa request.`);
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
    await sendMessage(chatId, "Terlalu banyak request dalam 1 jam terakhir. Coba lagi nanti.");
    return;
  }

  await sendTyping(chatId);
  let parsed: Awaited<ReturnType<typeof parsePurchaseText>>;
  try {
    parsed = await parsePurchaseText(text);
  } catch (e) {
    console.error("[telegram] parse failed", e);
    await sendMessage(chatId, "Maaf, gagal membaca pesan kamu. Coba lagi sebentar lagi.");
    return;
  }

  if (parsed.items.length === 0) {
    await sendMessage(
      chatId,
      ["Tidak ada barang yang bisa saya cocokkan.", unmatchedBlock(parsed.unmatched), "", HELP].filter(Boolean).join("\n"),
    );
    return;
  }

  // Only one open draft per user — older unconfirmed drafts are superseded.
  await supabase
    .from("telegram_pr_drafts")
    .update({ status: "cancelled" })
    .eq("telegram_user_id", user.id)
    .eq("status", "pending");

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
    await sendMessage(chatId, "Maaf, terjadi kesalahan. Coba lagi.");
    return;
  }

  const keyboard: InlineKeyboard = [[
    { text: "✅ Kirim", callback_data: `pr:ok:${draft.id}` },
    { text: "❌ Batal", callback_data: `pr:no:${draft.id}` },
  ]];
  await sendMessage(chatId, draftText(parsed.items, parsed.unmatched) + "\n\nKirim request ini?", keyboard);
}

function itemsBlock(items: ParsedItem[]): string {
  return items.map((it, i) => `${i + 1}. ${esc(it.name)} — ${qtyText(it.qty, it.unit)}`).join("\n");
}

function unmatchedBlock(unmatched: Unmatched[]): string {
  if (unmatched.length === 0) return "";
  return ["", "⚠️ <b>Tidak dimasukkan:</b>", ...unmatched.map((u) => `• "${esc(u.raw)}" — ${esc(u.reason)}`)].join("\n");
}

function draftText(items: ParsedItem[], unmatched: Unmatched[]): string {
  return ["🛒 <b>Purchase request</b>", itemsBlock(items), unmatchedBlock(unmatched)].filter(Boolean).join("\n");
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
  await sendMessage(chatId, `✅ Akun terhubung!\n\n${"error" in r ? r.error : HELP}`);
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
  if (!draft || Number(draft.telegram_user_id) !== cq.from.id) {
    await answerCallback(cq.id, "Request tidak ditemukan.");
    return;
  }
  const items = draft.items as ParsedItem[];
  const unmatched = draft.unmatched as Unmatched[];

  if (action === "no") {
    await supabase.from("telegram_pr_drafts").update({ status: "cancelled" }).eq("id", draftId).eq("status", "pending");
    await answerCallback(cq.id, "Dibatalkan");
    await editMessage(chatId, messageId, draftText(items, unmatched) + "\n\n❌ <i>Dibatalkan.</i>").catch(() => undefined);
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
    await editMessage(chatId, messageId, `${draftText(items, unmatched)}\n\n${r.error}`).catch(() => undefined);
    return;
  }

  await answerCallback(cq.id, "Mengirim…");
  try {
    const requestId = await createRequest(r, items);
    await supabase.from("telegram_pr_drafts").update({ request_id: requestId }).eq("id", draftId);
    const summary = await distributeRequest(requestId);
    revalidatePath("/purchasing/requests");
    await editMessage(chatId, messageId, `${draftText(items, unmatched)}\n\n✅ <b>Terkirim</b> — PR #${shortRef(requestId)}\n${summary}`);
  } catch (e) {
    console.error("[telegram] submit failed", e);
    // Let the user retry with the same buttons.
    await supabase.from("telegram_pr_drafts").update({ status: "pending" }).eq("id", draftId).is("request_id", null);
    await sendMessage(chatId, "Maaf, gagal mengirim request. Tekan ✅ Kirim lagi untuk mencoba ulang.");
  }
}

// ─── Create + distribute ─────────────────────────────────────────────────────

async function createRequest(r: Requester, items: ParsedItem[]): Promise<string> {
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
    .insert({ status: "pending", source: "telegram", note: "Dari Telegram", created_by: r.profileId, updated_by: r.profileId })
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
 * Post the request to the Purchase Requests group and one message per supplier
 * group. Returns a short status line for the requester.
 */
export async function distributeRequest(requestId: string): Promise<string> {
  const supabase = db();
  const [{ data: req }, { data: settings }] = await Promise.all([
    supabase
      .from("purchase_requests")
      .select(
        "id, created_at, creator:profiles!created_by(full_name, email), purchase_request_items(qty, unit, item:items!item_id(name), supplier:suppliers!supplier_id(id, name, telegram_chat_id))",
      )
      .eq("id", requestId)
      .single(),
    supabase.from("telegram_settings").select("pr_chat_id").eq("id", 1).maybeSingle(),
  ]);
  if (!req) throw new Error("Request not found");

  const creator = req.creator as unknown as { full_name: string | null; email: string } | null;
  const requester = creator?.full_name || creator?.email?.split("@")[0] || "Karyawan";
  const lines = (req.purchase_request_items ?? []) as unknown as {
    qty: number;
    unit: string;
    item: { name: string } | null;
    supplier: { id: string; name: string; telegram_chat_id: number | null } | null;
  }[];

  const bySupplier = new Map<string, { name: string; chatId: number | null; items: DistItem[] }>();
  const noSupplier: DistItem[] = [];
  for (const l of lines) {
    const it = { name: l.item?.name ?? "?", qty: Number(l.qty), unit: l.unit };
    if (!l.supplier) {
      noSupplier.push(it);
      continue;
    }
    const g = bySupplier.get(l.supplier.id) ?? { name: l.supplier.name, chatId: l.supplier.telegram_chat_id, items: [] };
    g.items.push(it);
    bySupplier.set(l.supplier.id, g);
  }

  const ref = `PR #${shortRef(requestId)}`;
  const link = appUrl(`/purchasing/requests/${requestId}`);
  const list = (items: DistItem[]) => items.map((i) => `• ${esc(i.name)} — ${qtyText(i.qty, i.unit)}`).join("\n");

  // One message per supplier group.
  const sent: string[] = [];
  const noGroup: string[] = [];
  const failed: string[] = [];
  for (const g of bySupplier.values()) {
    if (!g.chatId) {
      noGroup.push(g.name);
      continue;
    }
    const text = [
      `🛒 <b>Belanja untuk ${esc(g.name)}</b>`,
      `Dari: ${esc(requester)} · ${ref}`,
      "",
      list(g.items),
      ...(link ? ["", `<a href="${esc(link)}">Lihat di Machitori</a>`] : []),
    ].join("\n");
    try {
      await sendMessage(Number(g.chatId), text);
      sent.push(g.name);
    } catch (e) {
      console.error("[telegram] supplier group send failed", g.name, e);
      failed.push(g.name);
    }
  }

  // Overview in the Purchase Requests group.
  const prChatId = settings?.pr_chat_id ? Number(settings.pr_chat_id) : null;
  if (prChatId) {
    const blocks: string[] = [];
    for (const g of bySupplier.values()) {
      const tag = !g.chatId ? " ⚠️ <i>belum ada grup</i>" : failed.includes(g.name) ? " ⚠️ <i>gagal dikirim</i>" : " ✅";
      blocks.push(`<b>${esc(g.name)}</b>${tag}\n${list(g.items)}`);
    }
    if (noSupplier.length) blocks.push(`<b>Belum ada supplier</b> ⚠️\n${list(noSupplier)}`);
    const text = [
      `📝 <b>Purchase request baru</b> · ${ref}`,
      `Dari: ${esc(requester)}`,
      "",
      blocks.join("\n\n"),
      ...(link ? ["", `<a href="${esc(link)}">Lihat di Machitori</a>`] : []),
    ].join("\n");
    await sendMessage(prChatId, text).catch((e) => console.error("[telegram] PR group send failed", e));
  }

  const parts: string[] = [];
  if (sent.length) parts.push(`Diteruskan ke: ${sent.map(esc).join(", ")}`);
  if (noGroup.length) parts.push(`⚠️ Belum ada grup: ${noGroup.map(esc).join(", ")}`);
  if (failed.length) parts.push(`⚠️ Gagal dikirim ke: ${failed.map(esc).join(", ")}`);
  if (noSupplier.length) parts.push(`⚠️ ${noSupplier.length} barang belum punya supplier`);
  if (!prChatId) parts.push("⚠️ Grup Purchase Requests belum diatur");
  return parts.join("\n");
}
