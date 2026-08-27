import type { FormulaBasis, PayrollComponentVersion, RateUnit } from "@/lib/supabase/types";

export const RATE_UNIT_LABEL: Record<RateUnit, string> = {
  day: "per day",
  week: "per week",
  month: "per month",
};

/** Human label for each attendance-derived formula basis (single source for drawer + detail). */
export const FORMULA_BASIS_LABEL: Record<FormulaBasis, string> = {
  late_days: "Late days",
  missing_clock_in_days: "Missing clock-in days",
  missing_clock_out_days: "Missing clock-out days",
  incomplete_days: "Incomplete days (missing in/out)",
  absent_days: "Absent days",
  present_days: "Present days",
  working_days: "Working days",
  overtime_hours: "Overtime hours",
};

/** A history row: a version with its effective range and whether it's active today. */
export type ComponentHistoryRow = {
  version: PayrollComponentVersion;
  start: string; // YYYY-MM-DD
  end: string | null; // day before the next version's effective date, or null if open-ended
  active: boolean;
};

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/**
 * Build history rows from versions. `today` is YYYY-MM-DD. A version is Active
 * when today falls in [effective_date, nextVersion.effective_date - 1]; the
 * latest version is open-ended.
 */
export function componentHistory(versions: PayrollComponentVersion[], today: string): ComponentHistoryRow[] {
  const sorted = [...versions].sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  return sorted.map((version, i) => {
    const start = version.effective_date;
    const next = sorted[i + 1];
    const end = next ? addDays(next.effective_date, -1) : null;
    const active = today >= start && (end === null || today <= end);
    return { version, start, end, active };
  });
}

/** The version in effect today (latest effective ≤ today), or the earliest if all are future. */
export function activeVersion(versions: PayrollComponentVersion[], today: string): PayrollComponentVersion | null {
  if (versions.length === 0) return null;
  const rows = componentHistory(versions, today);
  return rows.find((r) => r.active)?.version ?? rows[0].version;
}
