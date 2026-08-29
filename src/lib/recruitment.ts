// Plain (non-"use server") recruitment constants + helpers, safe to import from
// client components and server actions alike.

export const HIRING_STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;
export type HiringStage = (typeof HIRING_STAGES)[number];

export const HIRING_STAGE_LABEL: Record<HiringStage, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

/** Public base URL for a job's apply link (hire.machimoto.cafe/<code>). */
export function hireBaseUrl() {
  return process.env.HIRE_BASE_URL || "https://hire.machimoto.cafe";
}

// ─── Work experience ──────────────────────────────────────────────────────────

// Applicants type the period freehand, so this has to cope with what they
// actually write: "2022 - 2025", "2019/2023", "Januari 2026 - Agustus 2026",
// "20-Maret-2020 s/d 20-Agustus-2026", "2023/sekarang", "2 tahun 5 bulan".
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5,
  jul: 6, agu: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11,
};
const ONGOING = /sekarang|saat ini|sampai kini|present|current|now/;
const YEAR_TOKEN = /(?:([a-z]{3,12})[\s\-/.]*)?((?:19|20)\d{2})/g;

/** Rough length of one free-text period, in months. null when nothing parses. */
export function periodMonths(raw: string, now = new Date()): number | null {
  const s = raw.toLowerCase().trim();
  if (!s) return null;

  // Stated up front — "2 tahun 5 bulan", "kurang lebih 10 tahun".
  const statedYears = s.match(/(\d+)\s*(?:tahun|thn|years?|yrs?)\b/);
  const statedMonths = s.match(/(\d+)\s*(?:bulan|bln|months?|mos?)\b/);
  if (statedYears || statedMonths) {
    const total = Number(statedYears?.[1] ?? 0) * 12 + Number(statedMonths?.[1] ?? 0);
    return total > 0 ? total : null;
  }

  const dates: { index: number; hasMonth: boolean }[] = [];
  for (const m of s.matchAll(YEAR_TOKEN)) {
    const key = m[1]?.slice(0, 3) ?? "";
    const month = key in MONTHS ? MONTHS[key] : null;
    dates.push({ index: Number(m[2]) * 12 + (month ?? 0), hasMonth: month != null });
  }
  if (dates.length === 0) return null;

  const start = dates[0];
  const nowIndex = now.getFullYear() * 12 + now.getMonth();
  let end: number;
  if (dates.length > 1) end = dates[dates.length - 1].index;
  else if (ONGOING.test(s)) end = nowIndex;
  else if (start.hasMonth) end = start.index + 1; // a lone month says no more
  else end = start.index + 12; // a bare year: count that year

  return Math.max(1, Math.min(end, nowIndex) - start.index);
}

export type PeriodEntry = { period?: string | null };

/** Total experience across every period the candidate listed. `parsed` says how
 *  many of them we could actually read, so callers can stay honest about it. */
export function totalExperience(entries: PeriodEntry[] | null | undefined, now = new Date()) {
  const list = entries ?? [];
  let months = 0;
  let parsed = 0;
  for (const e of list) {
    const m = periodMonths(String(e?.period ?? ""), now);
    if (m != null) { months += m; parsed += 1; }
  }
  return { months, parsed, entries: list.length };
}

/** "3 yr 2 mo", "9 mo". */
export function formatExperience(months: number) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y && m) return `${y} yr ${m} mo`;
  if (y) return `${y} yr`;
  return `${m} mo`;
}

// ─── Earliest join (candidate-facing form is Indonesian; the admin board reads English) ───

const JOIN_LABEL_EN: Record<string, string> = {
  "Minggu ini": "This week",
  "2 minggu ke depan": "Next 2 weeks",
  "1 bulan ke depan": "Next month",
  "2 bulan ke depan": "Next 2 months",
};

/** The apply form's join-timing options are Indonesian (that's who fills it
 *  in); translate for display on the English-language admin board. Anything
 *  outside the known options — an older record, say — passes through as-is. */
export function earliestJoinLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return JOIN_LABEL_EN[raw] ?? raw;
}
