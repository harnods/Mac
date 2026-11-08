import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { convert, formatNum } from "@/lib/units";
import type { UnitCode } from "@/lib/supabase/types";
import { esc } from "./api";

/*
 * "stok almond, ayam" → current stock for the best-matching ingredients.
 * Pure string matching (no AI): substring/word match first, then a typo-
 * tolerant fallback (edit distance), so "almon" still finds "Almond".
 */

type StockItem = { id: string; name: string; unit: string; on_hand: number; reserved: number };

const MAX_PER_QUERY = 5;
const MAX_QUERIES = 10;

/** Returns the query part if `text` is a stock question, else null. */
export function stockQuery(text: string): string | null {
  const m = text.trim().match(/^\/?(?:cek\s+)?(?:stok|stock)(?:@\w+)?(?:\s+|$)([\s\S]*)$/i);
  return m ? m[1].trim() : null;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Smallest edit distance between the query and the name or any of its words. */
function fuzzyScore(query: string, name: string): number {
  const words = name.split(" ");
  let best = editDistance(query, name);
  for (const w of words) best = Math.min(best, editDistance(query, w));
  // Multi-word query vs. the same number of consecutive words in the name.
  const qn = query.split(" ").length;
  if (qn > 1) {
    for (let i = 0; i + qn <= words.length; i++) {
      best = Math.min(best, editDistance(query, words.slice(i, i + qn).join(" ")));
    }
  }
  return best;
}

function match(items: (StockItem & { norm: string })[], rawQuery: string): StockItem[] {
  const q = normalize(rawQuery);
  if (!q) return [];
  const words = q.split(" ");

  // 1) Every query word appears in the name — rank exact, then prefix, then shorter names.
  const contains = items.filter((it) => words.every((w) => it.norm.includes(w)));
  if (contains.length > 0) {
    return contains
      .sort((a, b) => {
        const rank = (it: { norm: string }) => (it.norm === q ? 0 : it.norm.startsWith(q) ? 1 : 2);
        return rank(a) - rank(b) || a.norm.length - b.norm.length || a.name.localeCompare(b.name);
      })
      .slice(0, MAX_PER_QUERY);
  }

  // 2) Typos: allow ~1 edit per 4 characters (min 1, max 3).
  const limit = Math.min(3, Math.max(1, Math.floor(q.length / 4)));
  return items
    .map((it) => ({ it, d: fuzzyScore(q, it.norm) }))
    .filter((x) => x.d <= limit)
    .sort((a, b) => a.d - b.d || a.it.name.localeCompare(b.it.name))
    .slice(0, MAX_PER_QUERY)
    .map((x) => x.it);
}

/** 4836 g → "4,84 kg"; 750 ml stays "750 ml"; other units unchanged. */
function qty(value: number, unit: string): string {
  const bigger: Record<string, UnitCode> = { g: "kg", ml: "l" };
  const to = bigger[unit.toLowerCase()];
  if (to && Math.abs(value) >= 1000) {
    const v = convert(value, unit.toLowerCase() as UnitCode, to);
    if (v != null) return `${formatNum(Math.round(v * 100) / 100)} ${to}`;
  }
  return `${formatNum(value)} ${esc(unit)}`;
}

function line(it: StockItem): string {
  const onHand = Number(it.on_hand);
  const reserved = Number(it.reserved);
  const available = onHand - reserved;
  const detail = reserved !== 0 ? ` <i>(on hand ${qty(onHand, it.unit)}, reserved ${qty(reserved, it.unit)})</i>` : "";
  return `- ${esc(it.name)}: <b>${qty(available, it.unit)}</b>${detail}`;
}

export const STOCK_HELP = "Cek stok: <i>stok almond</i> atau <i>stok almond, ayam, susu</i>";

/** Build the reply for a stock query (already permission-checked by the caller). */
export async function stockReply(query: string): Promise<string> {
  const queries = query
    .split(/[,\n;]|\s+dan\s+/i)
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, MAX_QUERIES);
  if (queries.length === 0) return STOCK_HELP;

  const { data } = await createServiceClient()
    .from("items")
    .select("id, name, unit, on_hand, reserved")
    .eq("type", "ingredient")
    .is("deleted_at", null)
    .order("name")
    .limit(5000);
  const items = ((data ?? []) as StockItem[]).map((it) => ({ ...it, norm: normalize(it.name) }));

  const blocks: string[] = [];
  for (const q of queries) {
    const found = match(items, q);
    blocks.push(
      found.length > 0
        ? found.map(line).join("\n")
        : `- "${esc(q)}": <i>tidak ditemukan di daftar ingredient</i>`,
    );
  }
  return ["📦 <b>Stok tersedia</b>", "", blocks.join("\n")].join("\n");
}
