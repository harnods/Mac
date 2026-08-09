// Payroll cutoff period helpers. A period is identified by its END month:
// e.g. with cutoff 21→20, the "August 2026" period runs 21 Jul – 20 Aug 2026.

export type Period = { start: string; end: string }; // YYYY-MM-DD (inclusive)

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Build a YYYY-MM-DD string from a Date (local parts). */
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The payroll period whose end falls in (endYear, endMonth) — endMonth 0-based.
 * If the cutoff crosses a month boundary (startDay > endDay), the start is in
 * the previous month; otherwise start and end sit in the same month.
 */
/** Clamp a day-of-month to the given month's length (e.g. 31 → 28 in Feb). */
function clampDay(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

export function payrollPeriod(endYear: number, endMonth: number, startDay: number, endDay: number): Period {
  const end = clampDay(endYear, endMonth, endDay);
  const startMonthOffset = startDay > endDay ? -1 : 0;
  const start = clampDay(endYear, endMonth + startMonthOffset, startDay);
  return { start: toISODate(start), end: toISODate(end) };
}

/** The end-month anchor {year, month} of the period that contains `today`. */
export function currentPeriodAnchor(today: Date, startDay: number, endDay: number): { year: number; month: number } {
  const crosses = startDay > endDay;
  // When the cutoff crosses months and today is past the end day, the period
  // ends next month; otherwise it ends this month.
  const bumpMonth = crosses && today.getDate() > endDay ? 1 : 0;
  const anchor = new Date(today.getFullYear(), today.getMonth() + bumpMonth, 1);
  return { year: anchor.getFullYear(), month: anchor.getMonth() };
}
