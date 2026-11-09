import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { P, allowedRecipeStations } from "@/lib/permissions";
import { formatId } from "@/lib/format";
import { esc } from "./api";
import type { LinkedAccount } from "./account";
import { STOCK_HELP } from "./stock";
import { findByName, qty, stripWords } from "./text";

/*
 * Extra bot commands (group or DM). Personal data (attendance, schedule, own
 * requests) is always answered by DM, never in the group.
 *
 * Deliberately NOT available over Telegram: salary/payroll/payslips,
 * benefits/allowances, and other crew's data — those get a fixed refusal.
 */

export type Command =
  | { kind: "help" }
  | { kind: "recipe"; query: string }
  | { kind: "attendance" }
  | { kind: "schedule" }
  | { kind: "my_requests" }
  | { kind: "blocked"; topic: "payroll" | "crew" };

export const HELP = [
  "🤖 <b>Yang bisa saya bantu</b>",
  "",
  "<b>Purchase request</b> — tulis di grup ini, contoh <i>almond 2 kg, ayam 5 kg</i>",
  STOCK_HELP,
  "<b>resep</b> <i>latte</i> — bahan &amp; takaran resep",
  "<b>absensi</b> — absensi kamu 7 hari terakhir (via DM)",
  "<b>jadwal</b> — jadwal shift kamu 7 hari ke depan (via DM)",
  "<b>request saya</b> — status purchase request kamu (via DM)",
  "<b>/batal</b> — batalkan request kamu yang belum dikirim",
  "",
  "<i>Info gaji/payroll, benefit, dan data crew tidak tersedia di Telegram.</i>",
].join("\n");

// Words that only mean "mine / when" — anything else after absensi/jadwal names another person.
const SELF_WORDS = new Set([
  "saya", "aku", "ku", "gue", "gw", "sy", "kamu", "punyaku", "punya", "dong", "ya", "kak", "min", "minggu",
  "ini", "depan", "hari", "besok", "kemarin", "lalu", "terakhir", "bulan", "week", "this", "next", "my", "today",
]);

const BLOCKED_PAYROLL =
  /^\/?(?:cek\s+|lihat\s+|info\s+)?(?:gaji|gajian|salary|payroll|slip(?:\s+gaji)?|payslip|benefit|benefits|tunjangan|bonus|thr|insentif)\b/i;
const BLOCKED_CREW = /^\/?(?:cek\s+|lihat\s+|info\s+)?(?:data\s+)?(?:crew|karyawan|pegawai|employee|staff)\b/i;

/** Recognise a command at the start of a message (with or without "/"), else null. */
export function detectCommand(text: string): Command | null {
  const t = text.replace(/@\w+/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;

  if (/^\/?(?:help|bantuan|menu|perintah|command|commands)[?!.]*$/i.test(t)) return { kind: "help" };
  if (BLOCKED_PAYROLL.test(t)) return { kind: "blocked", topic: "payroll" };
  if (BLOCKED_CREW.test(t)) return { kind: "blocked", topic: "crew" };

  const recipe = t.match(/^\/?(?:cek\s+|lihat\s+)?(?:resep|recipe)(?:nya)?(?:\s+|$)([\s\S]*)$/i);
  if (recipe) return { kind: "recipe", query: stripWords(recipe[1], new Set(["dong", "ya", "kak", "min", "apa", "untuk", "buat"])) };

  const self = (rest: string) => stripWords(rest, SELF_WORDS) === "";
  const att = t.match(/^\/?(?:cek\s+|lihat\s+)?(?:absensi|absen|attendance|kehadiran)(?:\s+([\s\S]*))?$/i);
  if (att) return self(att[1] ?? "") ? { kind: "attendance" } : { kind: "blocked", topic: "crew" };
  const sch = t.match(/^\/?(?:cek\s+|lihat\s+)?(?:jadwal|schedule|shift)(?:\s+([\s\S]*))?$/i);
  if (sch) return self(sch[1] ?? "") ? { kind: "schedule" } : { kind: "blocked", topic: "crew" };

  if (/^\/?(?:cek\s+|lihat\s+|status\s+)?(?:request|requests|pr|purchase\s+request)\s+(?:saya|aku|ku|gue|gw|sy)[?!.]*$/i.test(t))
    return { kind: "my_requests" };
  if (/^\/(?:requests?|status)$/i.test(t)) return { kind: "my_requests" };

  return null;
}

export function blockedText(topic: "payroll" | "crew"): string {
  return topic === "payroll"
    ? "🔒 Info gaji, payroll, slip gaji, dan benefit tidak tersedia di Telegram. Silakan cek di aplikasi Machitori (Profile → Payslip)."
    : "🔒 Data crew lain tidak tersedia di Telegram. Kamu hanya bisa cek <b>absensi</b> dan <b>jadwal</b> milik sendiri.";
}

// ─── Recipe ──────────────────────────────────────────────────────────────────

type RecipeRow = {
  id: string;
  name: string;
  yield_qty: number;
  unit: string | null;
  station: string | null;
  product: { name: string; image_url: string | null } | null;
  recipe_items: { quantity: number; unit: string; item: { name: string } | null }[];
};

/** Recipe text, plus the linked product's photo URL when it has one. */
export async function recipeReply(account: LinkedAccount, query: string): Promise<{ text: string; photoUrl?: string }> {
  if (!account.permissions.includes(P.RECIPES_READ)) return { text: "Akun kamu belum punya izin melihat resep. Hubungi admin." };
  if (!query) return { text: "Contoh: <i>resep latte</i>" };

  const { data } = await createServiceClient()
    .from("recipes")
    .select("id, name, yield_qty, unit, station, product:items!product_id(name, image_url), recipe_items(quantity, unit, item:items!item_id(name))")
    .order("name")
    .limit(2000);
  // Same bar/kitchen scoping as the web app.
  const stations = allowedRecipeStations({ is_owner: account.isOwner, permissions: account.permissions });
  const recipes = ((data ?? []) as unknown as RecipeRow[]).filter(
    (r) => stations === null || r.station == null || stations.includes(r.station as "bar" | "kitchen"),
  );

  const found = findByName(recipes, (r) => [r.name, r.product?.name ?? ""], query, 4);
  if (found.length === 0) return { text: `Resep "${esc(query)}" tidak ditemukan.` };

  const [r, ...others] = found;
  const lines = r.recipe_items
    .map((ri) => `- ${esc(ri.item?.name ?? "?")} - ${qty(Number(ri.quantity), ri.unit)}`)
    .join("\n");
  const text = [
    `🍳 <b>Resep: ${esc(r.name)}</b>${r.station ? ` <i>(${esc(r.station)})</i>` : ""}`,
    `Hasil: ${qty(Number(r.yield_qty), r.unit ?? "porsi")}`,
    "",
    lines || "<i>Belum ada bahan.</i>",
    ...(others.length ? ["", `Mungkin maksudnya: ${others.map((o) => esc(o.name)).join(", ")}`] : []),
  ].join("\n");
  return { text, photoUrl: r.product?.image_url ?? undefined };
}

// ─── Personal data (always sent by DM) ───────────────────────────────────────

const TZ = "Asia/Jakarta";

function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); // YYYY-MM-DD
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function hhmm(t: string | null): string {
  return t ? t.slice(0, 5) : "—";
}

async function employeeIdFor(profileId: string): Promise<string | null> {
  const { data } = await createServiceClient()
    .from("employees")
    .select("id")
    .eq("user_id", profileId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

type ShiftRef = { name: string; start_time: string | null; end_time: string | null } | null;

function shiftText(s: ShiftRef): string {
  if (!s) return "—";
  if (!s.start_time) return s.name === "Day off" ? "Libur" : esc(s.name);
  // Some shifts are already named after their hours ("10:00 - 20:00").
  if (s.name.includes(hhmm(s.start_time))) return esc(s.name);
  return `${esc(s.name)} ${hhmm(s.start_time)}–${hhmm(s.end_time)}`;
}

export async function attendanceReply(account: LinkedAccount): Promise<string> {
  const empId = await employeeIdFor(account.profileId);
  if (!empId) return "Akun kamu belum terhubung ke data karyawan. Hubungi admin.";
  const today = todayLocal();
  const from = addDays(today, -6);
  const supabase = createServiceClient();
  const [{ data: att }, { data: sch }] = await Promise.all([
    supabase
      .from("attendance")
      .select("work_date, clock_in, clock_out")
      .eq("employee_id", empId)
      .gte("work_date", from)
      .lte("work_date", today),
    supabase
      .from("schedules")
      .select("work_date, shift:shifts(name, start_time, end_time)")
      .eq("employee_id", empId)
      .gte("work_date", from)
      .lte("work_date", today),
  ]);
  const attBy = new Map(((att ?? []) as { work_date: string; clock_in: string | null; clock_out: string | null }[]).map((a) => [a.work_date, a]));
  const schBy = new Map(((sch ?? []) as unknown as { work_date: string; shift: ShiftRef }[]).map((s) => [s.work_date, s.shift]));

  const rows: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const a = attBy.get(d);
    const s = schBy.get(d) ?? null;
    if (!a && !s) continue;
    const clock = a ? `masuk ${hhmm(a.clock_in)}, keluar ${hhmm(a.clock_out)}` : s?.start_time ? "<i>tidak ada absen</i>" : "";
    rows.push(`<b>${dayLabel(d)}</b> · ${shiftText(s)}${clock ? `\n   ${clock}` : ""}`);
  }
  return [
    "🕘 <b>Absensi kamu</b> (7 hari terakhir)",
    "",
    rows.length ? rows.join("\n") : "<i>Belum ada jadwal atau absensi 7 hari terakhir.</i>",
  ].join("\n");
}

export async function scheduleReply(account: LinkedAccount): Promise<string> {
  const empId = await employeeIdFor(account.profileId);
  if (!empId) return "Akun kamu belum terhubung ke data karyawan. Hubungi admin.";
  const today = todayLocal();
  const to = addDays(today, 6);
  const { data } = await createServiceClient()
    .from("schedules")
    .select("work_date, shift:shifts(name, start_time, end_time)")
    .eq("employee_id", empId)
    .gte("work_date", today)
    .lte("work_date", to);
  const schBy = new Map(((data ?? []) as unknown as { work_date: string; shift: ShiftRef }[]).map((s) => [s.work_date, s.shift]));

  const rows: string[] = [];
  for (let i = 0; i <= 6; i++) {
    const d = addDays(today, i);
    const s = schBy.get(d);
    rows.push(`<b>${dayLabel(d)}</b> · ${s ? shiftText(s) : "<i>belum dijadwalkan</i>"}`);
  }
  return ["📅 <b>Jadwal kamu</b> (7 hari ke depan)", "", rows.join("\n")].join("\n");
}

const STATUS: Record<string, string> = {
  draft: "Draft",
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};

export async function myRequestsReply(account: LinkedAccount): Promise<string> {
  const { data } = await createServiceClient()
    .from("purchase_requests")
    .select("id, status, created_at, purchase_request_items(qty, unit, status, item:items!item_id(name))")
    .eq("created_by", account.profileId)
    .order("created_at", { ascending: false })
    .limit(5);
  const reqs = (data ?? []) as unknown as {
    id: string;
    status: string;
    created_at: string;
    purchase_request_items: { qty: number; unit: string; status: string; item: { name: string } | null }[];
  }[];
  if (reqs.length === 0) return "Kamu belum punya purchase request.";

  const blocks = reqs.map((r) => {
    const date = new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: TZ });
    const items = r.purchase_request_items
      .map((i) => `- ${esc(i.item?.name ?? "?")} - ${qty(Number(i.qty), i.unit)}${i.status && i.status !== "pending" ? ` <i>(${STATUS[i.status] ?? esc(i.status)})</i>` : ""}`)
      .join("\n");
    return `<b>#${formatId(r.id)}</b> · ${date} · ${STATUS[r.status] ?? esc(r.status)}\n${items}`;
  });
  return ["🧾 <b>Purchase request kamu</b> (5 terakhir)", "", blocks.join("\n\n")].join("\n");
}
