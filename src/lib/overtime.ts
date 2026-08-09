import type { OvertimeCompensationVersion } from "@/lib/supabase/types";

export type OvertimeHistoryRow = {
  version: OvertimeCompensationVersion;
  start: string;
  end: string | null;
  active: boolean;
};

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** History rows with effective ranges; active = today in [start, next-1]. */
export function overtimeHistory(versions: OvertimeCompensationVersion[], today: string): OvertimeHistoryRow[] {
  const sorted = [...versions].sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  return sorted.map((version, i) => {
    const start = version.effective_date;
    const next = sorted[i + 1];
    const end = next ? addDays(next.effective_date, -1) : null;
    const active = today >= start && (end === null || today <= end);
    return { version, start, end, active };
  });
}

/** The version in effect today (latest effective ≤ today), or earliest if all future. */
export function activeOvertimeVersion(versions: OvertimeCompensationVersion[], today: string): OvertimeCompensationVersion | null {
  if (versions.length === 0) return null;
  const rows = overtimeHistory(versions, today);
  return rows.find((r) => r.active)?.version ?? rows[0].version;
}

/** "4.5 hours/day cap" style label, or "No cap". */
export function overtimeCapLabel(v: OvertimeCompensationVersion): string {
  return v.cap_hours ? `Max ${v.max_hours_per_day} hrs/day` : "No cap";
}
