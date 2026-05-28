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

export function convert(value: number, from: UnitCode, to: UnitCode): number | null {
  if (from === to) return value;
  const g = findGroup(from);
  if (!g || !(to in g.members)) return null;
  const inBase = value * g.members[from];
  return inBase / g.members[to];
}

export function formatNum(value: number): string {
  // Indonesian formatting: "." for thousands, "," for decimals.
  // Rounded to 2 decimal places (trailing zeros dropped).
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export function formatQty(value: number, unit: UnitCode): string {
  return `${formatNum(value)} ${unit}`;
}
