import { convert, formatNum } from "@/lib/units";
import type { UnitCode } from "@/lib/supabase/types";
import { esc } from "./api";

/*
 * Shared text helpers for the Telegram bot: typo-tolerant name matching
 * (no AI) and quantity formatting.
 */

export function normalize(s: string): string {
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

/** Smallest edit distance between the query and the name, any word, or any run of words. */
function fuzzyScore(query: string, name: string): number {
  const words = name.split(" ");
  let best = editDistance(query, name);
  for (const w of words) best = Math.min(best, editDistance(query, w));
  const qn = query.split(" ").length;
  if (qn > 1) {
    for (let i = 0; i + qn <= words.length; i++) {
      best = Math.min(best, editDistance(query, words.slice(i, i + qn).join(" ")));
    }
  }
  return best;
}

/**
 * Find the best matches for `rawQuery` among `items`, matching against every
 * string `names(item)` returns (e.g. a recipe's own name and its product name).
 * 1) all query words contained → exact, prefix, then shortest first;
 * 2) otherwise typo-tolerant (~1 edit per 4 chars, max 3).
 */
export function findByName<T>(items: T[], names: (it: T) => string[], rawQuery: string, max = 5): T[] {
  const q = normalize(rawQuery);
  if (!q) return [];
  const words = q.split(" ");
  const indexed = items.map((it) => ({ it, norms: names(it).filter(Boolean).map(normalize) }));

  const contains = indexed.filter((x) => x.norms.some((n) => words.every((w) => n.includes(w))));
  if (contains.length > 0) {
    const rank = (x: { norms: string[] }) =>
      Math.min(...x.norms.map((n) => (n === q ? 0 : n.startsWith(q) ? 1 : 2)));
    const len = (x: { norms: string[] }) => Math.min(...x.norms.map((n) => n.length));
    return contains
      .sort((a, b) => rank(a) - rank(b) || len(a) - len(b) || a.norms[0].localeCompare(b.norms[0]))
      .slice(0, max)
      .map((x) => x.it);
  }

  const limit = Math.min(3, Math.max(1, Math.floor(q.length / 4)));
  return indexed
    .map((x) => ({ it: x.it, d: Math.min(...x.norms.map((n) => fuzzyScore(q, n))), n: x.norms[0] }))
    .filter((x) => x.d <= limit)
    .sort((a, b) => a.d - b.d || a.n.localeCompare(b.n))
    .slice(0, max)
    .map((x) => x.it);
}

/** 4836 g → "4,84 kg"; 750 ml stays "750 ml"; other units unchanged. HTML-escaped. */
export function qty(value: number, unit: string): string {
  const bigger: Record<string, UnitCode> = { g: "kg", ml: "l" };
  const to = bigger[unit.toLowerCase()];
  if (to && Math.abs(value) >= 1000) {
    const v = convert(value, unit.toLowerCase() as UnitCode, to);
    if (v != null) return `${formatNum(Math.round(v * 100) / 100)} ${to}`;
  }
  return `${formatNum(value)} ${esc(unit)}`;
}

/** Drop filler words but keep list separators: "sisa ayam, salmon ya?" → "ayam, salmon". */
export function stripWords(t: string, filler: Set<string>): string {
  return t
    .split(/([,\n;])/)
    .map((part) =>
      /[,\n;]/.test(part)
        ? part
        : part
            .split(/\s+/)
            .filter((w) => w && !filler.has(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")))
            .join(" "),
    )
    .join("")
    .replace(/[?!.]+/g, " ")
    .trim();
}
