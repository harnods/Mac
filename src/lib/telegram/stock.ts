import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { esc } from "./api";
import { findByName, qty, stripWords } from "./text";

/*
 * "stok almond, ayam" → current stock for the best-matching ingredients.
 * Pure string matching (no AI), typo-tolerant ("almon" → "Almond").
 */

type StockItem = { id: string; name: string; unit: string; on_hand: number; reserved: number };

const MAX_QUERIES = 10;

export type StockQuery = {
  query: string;
  /** Started with "stok"/"/stok" — always answer. Natural-language mentions only answer on a match. */
  explicit: boolean;
};

// Filler words dropped from natural questions ("sisa berapa stock ayam ya?").
const FILLER = new Set([
  "sisa", "berapa", "brp", "masih", "ada", "cek", "check", "tolong", "dong", "ya", "yah", "kak", "min",
  "kah", "nya", "untuk", "buat", "di", "gudang", "sekarang", "skrg", "lagi", "apa", "how", "much", "many",
  "is", "the", "of", "left", "stok", "stock", "stoknya", "stocknya", "info", "lihat", "liat",
]);

/** Detects a stock question and extracts the item part, else null. */
export function stockQuery(text: string): StockQuery | null {
  const t = text.replace(/@\w+/g, " ").trim();
  // Messages with numbers are purchase requests ("stok almond habis, minta 2kg").
  if (/\d/.test(t)) return null;
  const explicit = t.match(/^\/?(?:cek\s+)?(?:stok|stock)(?:nya)?(?:\s+|$)([\s\S]*)$/i);
  if (explicit) return { query: stripWords(explicit[1], FILLER), explicit: true };
  // Natural language: "sisa berapa stock ayam paha?" — stok/stock anywhere.
  if (!/\b(?:stok|stock)(?:nya)?\b/i.test(t)) return null;
  return { query: stripWords(t, FILLER), explicit: false };
}

function line(it: StockItem): string {
  const onHand = Number(it.on_hand);
  const reserved = Number(it.reserved);
  const available = onHand - reserved;
  const detail = reserved !== 0 ? ` <i>(on hand ${qty(onHand, it.unit)}, reserved ${qty(reserved, it.unit)})</i>` : "";
  return `- ${esc(it.name)}: <b>${qty(available, it.unit)}</b>${detail}`;
}

export const STOCK_HELP = "<b>stok</b> <i>almond, ayam</i> — cek stok tersedia";

/**
 * Build the reply for a stock query (already permission-checked by the caller).
 * `found` is the number of matched ingredients, so callers can stay quiet on
 * natural-language mentions that matched nothing.
 */
export async function stockReply(query: string): Promise<{ text: string; found: number }> {
  const queries = query
    .split(/[,\n;]|\s+dan\s+/i)
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, MAX_QUERIES);
  if (queries.length === 0) return { text: STOCK_HELP, found: 0 };

  const { data } = await createServiceClient()
    .from("items")
    .select("id, name, unit, on_hand, reserved")
    .eq("type", "ingredient")
    .is("deleted_at", null)
    .order("name")
    .limit(5000);
  const items = (data ?? []) as StockItem[];

  const blocks: string[] = [];
  let total = 0;
  for (const q of queries) {
    const found = findByName(items, (it) => [it.name], q);
    total += found.length;
    blocks.push(
      found.length > 0
        ? found.map(line).join("\n")
        : `- "${esc(q)}": <i>tidak ditemukan di daftar ingredient</i>`,
    );
  }
  return { text: ["📦 <b>Stok tersedia</b>", "", blocks.join("\n")].join("\n"), found: total };
}
