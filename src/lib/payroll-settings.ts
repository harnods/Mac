import type { PayrollSettingsVersion } from "@/lib/supabase/types";

/** Day-of-month with ordinal suffix, e.g. 21 -> "21st". */
export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export type SettingsHistoryRow = {
  version: PayrollSettingsVersion;
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
 * latest version is open-ended. Mirrors the payroll-component versioning.
 */
export function settingsHistory(versions: PayrollSettingsVersion[], today: string): SettingsHistoryRow[] {
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
export function activeSettingsVersion(versions: PayrollSettingsVersion[], today: string): PayrollSettingsVersion | null {
  if (versions.length === 0) return null;
  const rows = settingsHistory(versions, today);
  return rows.find((r) => r.active)?.version ?? rows[0].version;
}
