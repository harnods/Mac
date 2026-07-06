import type { UnitCode } from "./supabase/types";

export const UNITS: { code: UnitCode; label: string }[] = [
  { code: "pcs", label: "Pcs" },
  { code: "g",   label: "g" },
  { code: "kg",  label: "kg" },
  { code: "ml",  label: "ml" },
  { code: "l",   label: "l" },
];

// Conversion groups: units within the same group are interconvertible.
// Numbers are the factor to convert FROM that unit TO the group's base unit.
type Group = { base: string; members: Record<string, number> };

const GROUPS: Group[] = [
  { base: "g",  members: { g: 1, kg: 1000 } },
  { base: "ml", members: { ml: 1, l: 1000 } },
];

function findGroup(unit: string): Group | null {
  return GROUPS.find((g) => unit in g.members) ?? null;
}

export function compatibleUnits(unit: UnitCode): UnitCode[] {
  const g = findGroup(unit);
  if (!g) return [unit];
  return Object.keys(g.members);
}

/**
 * Returns the next smaller unit to convert *down* to (e.g. kg → g, l → ml),
 * or null if the unit is already the smallest in its group (g, ml) or has
 * no conversions. Used to decide whether to show a conversion tooltip —
 * the smaller unit is the practically useful breakdown to show (e.g.
 * "1.5 kg" → tooltip "1500 g"), not the other way around.
 */
export function downConversionTarget(unit: UnitCode): UnitCode | null {
  const g = findGroup(unit);
  if (!g) return null;
  const current = g.members[unit];
  if (current == null) return null;
  const smaller = Object.entries(g.members)
    .filter(([, factor]) => factor < current)
    .sort((a, b) => b[1] - a[1])[0];
  return smaller ? (smaller[0] as UnitCode) : null;
}

export function convert(value: number, from: UnitCode, to: UnitCode): number | null {
  if (from === to) return value;
  const g = findGroup(from);
  if (!g || !(to in g.members)) return null;
  const inBase = value * g.members[from];
  return inBase / g.members[to];
}

/**
 * Converts a quantity into an item's own unit, falling back to the item's
 * custom purchase-unit ratio (e.g. "1 bungkus = 5000 g") when the universal
 * g/kg or ml/l conversion doesn't apply. That ratio is specific to this
 * item's packaging, not a general unit-to-unit conversion.
 */
export function convertToItemUnit(
  value: number,
  from: UnitCode,
  item: { unit: UnitCode; purchase_unit?: UnitCode | null; purchase_unit_qty?: number | null },
): number {
  if (from === item.unit) return value;
  const viaGroup = convert(value, from, item.unit);
  if (viaGroup != null) return viaGroup;
  if (item.purchase_unit && from === item.purchase_unit && item.purchase_unit_qty) {
    return value * item.purchase_unit_qty;
  }
  return value;
}

/**
 * Parses a user-entered decimal string, accepting both "." and "," as the
 * decimal separator (e.g. "2.5" and "2,5" both → 2.5). Also tolerates
 * thousands separators when both separators are present ("1.000,5" → 1000.5,
 * "1,000.5" → 1000.5). Returns NaN for empty/invalid input.
 */
export function parseDecimal(input: string | number | null | undefined): number {
  if (input == null) return NaN;
  if (typeof input === "number") return input;
  let t = input.trim().replace(/\s/g, "");
  if (!t) return NaN;
  const lastDot = t.lastIndexOf(".");
  const lastComma = t.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present → the later one is the decimal separator
    const decSep = lastDot > lastComma ? "." : ",";
    const thouSep = decSep === "." ? "," : ".";
    t = t.split(thouSep).join("").replace(decSep, ".");
  } else {
    // Only one kind (or none) → treat comma as decimal point
    t = t.replace(",", ".");
  }
  return parseFloat(t);
}

export function formatNum(value: number): string {
  // Indonesian formatting: "." for thousands, "," for decimals.
  // Rounded to 2 decimal places (trailing zeros dropped).
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export function formatQty(value: number, unit: UnitCode): string {
  return `${formatNum(value)} ${unit}`;
}
