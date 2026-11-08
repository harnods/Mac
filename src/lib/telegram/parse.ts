import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { compatibleUnits } from "@/lib/units";
import type { UnitCode } from "@/lib/supabase/types";

/** Fast, cheap model via Vercel AI Gateway — enough for matching short lists. */
const MODEL = process.env.TELEGRAM_PARSE_MODEL?.trim() || "anthropic/claude-haiku-5.5";

export type ParsedItem = { item_id: string; name: string; qty: number; unit: string };
export type Unmatched = { raw: string; reason: string };
export type ParseResult = { items: ParsedItem[]; unmatched: Unmatched[] };

type Candidate = { id: string; name: string; unit: string; units: string[] };

async function loadCandidates(): Promise<Candidate[]> {
  const supabase = createServiceClient();
  const [{ data: items }, { data: convs }] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, unit, purchase_unit")
      .eq("type", "ingredient")
      .is("deleted_at", null)
      .order("name")
      .limit(5000),
    supabase.from("item_unit_conversions").select("item_id, from_unit").limit(10000),
  ]);
  const convByItem = new Map<string, string[]>();
  for (const c of (convs ?? []) as { item_id: string; from_unit: string }[]) {
    convByItem.set(c.item_id, [...(convByItem.get(c.item_id) ?? []), c.from_unit.toLowerCase()]);
  }
  return ((items ?? []) as { id: string; name: string; unit: string; purchase_unit: string | null }[]).map((i) => {
    const units = new Set<string>([
      i.unit.toLowerCase(),
      ...compatibleUnits(i.unit as UnitCode).map((u) => u.toLowerCase()),
      ...(convByItem.get(i.id) ?? []),
      ...(i.purchase_unit ? [i.purchase_unit.toLowerCase()] : []),
    ]);
    return { id: i.id, name: i.name, unit: i.unit, units: [...units] };
  });
}

const outputSchema = z.object({
  items: z.array(
    z.object({
      raw: z.string().describe("The fragment of the message this line came from, verbatim"),
      index: z.number().int().nullable().describe("Catalog number (#) of the matching ingredient, or null if none matches"),
      qty: z.number().nullable().describe("Quantity as a number, or null if not given"),
      unit: z.string().nullable().describe("Unit as written by the user, lowercased (e.g. kg, g, l, ml, pcs, pack), or null"),
    }),
  ),
});

/**
 * Turn a free-text purchase request ("almond 2kg, ayam 5 ekor") into catalog
 * ingredients. The model only proposes matches; every match is validated here
 * (catalog index, positive qty, unit allowed for that ingredient).
 */
export async function parsePurchaseText(text: string): Promise<ParseResult> {
  const candidates = await loadCandidates();
  const catalog = candidates.map((c, i) => `#${i} ${c.name} [${c.units.join(", ")}]`).join("\n");

  const { output } = await generateText({
    model: MODEL,
    output: Output.object({ schema: outputSchema }),
    temperature: 0,
    instructions: [
      "You extract purchase request lines for a café's ingredient purchasing.",
      "The user writes in Indonesian or English, often informally, one or many items, separated by commas, newlines or 'dan'.",
      "For each requested item return one entry. Match it to the single best ingredient in the catalog by meaning",
      "(synonyms, Indonesian/English names, typos, brand-less names). If nothing in the catalog is clearly the same thing, use index null.",
      "Never invent catalog numbers. Do not merge different items. Ignore greetings and chit-chat.",
      "Normalise units: kilo/kilogram→kg, gram/gr→g, liter/litre→l, mili/mililiter→ml, biji/buah/pcs/pc→pcs. Keep other units as written (e.g. ekor, pack, karton, box).",
      "Decimal commas mean decimals (1,5 = 1.5).",
    ].join(" "),
    prompt: `Catalog (number, name, allowed units):\n${catalog}\n\nMessage:\n${text}`,
  });

  const items: ParsedItem[] = [];
  const unmatched: Unmatched[] = [];

  for (const line of output?.items ?? []) {
    const raw = line.raw.trim() || "?";
    const cand = line.index != null ? candidates[line.index] : undefined;
    if (!cand) {
      unmatched.push({ raw, reason: "tidak ditemukan di daftar ingredient" });
      continue;
    }
    if (line.qty == null || !Number.isFinite(line.qty) || line.qty <= 0) {
      unmatched.push({ raw, reason: `jumlah ${cand.name} tidak jelas` });
      continue;
    }
    const unit = (line.unit ?? cand.unit).trim().toLowerCase();
    if (!cand.units.includes(unit)) {
      unmatched.push({ raw, reason: `satuan "${unit}" tidak dikenal untuk ${cand.name} (pakai: ${cand.units.join(", ")})` });
      continue;
    }
    const existing = items.find((i) => i.item_id === cand.id);
    if (existing) {
      if (existing.unit === unit) {
        existing.qty += line.qty;
      } else {
        unmatched.push({ raw, reason: `${cand.name} sudah ada dengan satuan ${existing.unit}` });
      }
      continue;
    }
    items.push({ item_id: cand.id, name: cand.name, qty: line.qty, unit });
  }

  return { items, unmatched };
}
