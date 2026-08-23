// Employee turnover computations, grounded in join / leave dates.

export type TurnoverEmployee = {
  id: string;
  name: string;
  department: string | null;
  join_date: string | null; // YYYY-MM-DD
  leave_date: string | null; // last_day ?? termination_date
  active?: boolean; // current inactive flag (false = marked inactive)
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** Active on date `iso` = joined on/before it and not yet left as of it. */
function activeOn(e: TurnoverEmployee, iso: string) {
  if (!e.join_date || e.join_date > iso) return false;
  return e.leave_date === null || e.leave_date >= iso;
}
function inRange(date: string | null, start: string, end: string) {
  return date !== null && date >= start && date <= end;
}
function headcount(emps: TurnoverEmployee[], iso: string) {
  return emps.filter((e) => activeOn(e, iso)).length;
}
function rate(left: number, avg: number) {
  return avg > 0 ? (left / avg) * 100 : 0;
}

export type MonthRow = {
  label: string;
  start: number;
  joined: number;
  left: number;
  end: number;
  turnover: number; // percent
};

export type TurnoverSummary = {
  activeNow: number;
  joined: number;
  left: number;
  turnover: number; // annual percent
  months: MonthRow[];
};

/**
 * Build the turnover summary + monthly breakdown for a calendar year.
 * `today` (YYYY-MM-DD) caps the current year at the current month.
 */
export function turnoverForYear(emps: TurnoverEmployee[], year: number, today: string): TurnoverSummary {
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7)) - 1;
  const lastMonth = year < todayYear ? 11 : year > todayYear ? -1 : todayMonth;

  const months: MonthRow[] = [];
  for (let m = 0; m <= lastMonth; m++) {
    const first = ymd(year, m, 1);
    const lastDayNum = new Date(year, m + 1, 0).getDate();
    const last = ymd(year, m, lastDayNum);
    const start = headcount(emps, first);
    const end = headcount(emps, last);
    const joined = emps.filter((e) => inRange(e.join_date, first, last)).length;
    const left = emps.filter((e) => inRange(e.leave_date, first, last)).length;
    months.push({ label: MONTHS[m], start, joined, left, end, turnover: rate(left, (start + end) / 2) });
  }

  const yearStart = ymd(year, 0, 1);
  const yearEndIso = year === todayYear ? today : ymd(year, 11, 31);
  const joined = emps.filter((e) => inRange(e.join_date, yearStart, ymd(year, 11, 31))).length;
  const left = emps.filter((e) => inRange(e.leave_date, yearStart, ymd(year, 11, 31))).length;
  const avg = (headcount(emps, yearStart) + headcount(emps, yearEndIso)) / 2;

  return {
    // "Active crew" today matches the crew roster: employed today AND not
    // marked inactive.
    activeNow: emps.filter((e) => activeOn(e, today) && e.active !== false).length,
    joined,
    left,
    turnover: rate(left, avg),
    months,
  };
}

/** Leavers within the year, newest first. */
export function leaversInYear(emps: TurnoverEmployee[], year: number): TurnoverEmployee[] {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  return emps
    .filter((e) => inRange(e.leave_date, start, end))
    .sort((a, b) => (b.leave_date ?? "").localeCompare(a.leave_date ?? ""));
}

export function formatPercent(n: number) {
  return `${n.toFixed(1)}%`;
}
