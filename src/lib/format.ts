import type { Updater } from "./supabase/types";

/** Formats a UUID into a short, readable reference: e.g. "2660-724A" */
export function formatId(id: string): string {
  const raw = id.slice(0, 8).toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function formatRp(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** English weekday + day/month with a comma, e.g. "Mon, 4 May". Accepts a date-only string. */
export function formatWeekdayDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAY_SHORT[dt.getDay()]}, ${d} ${MONTH_SHORT[m - 1]}`;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Whole years elapsed since the given date (e.g. age from birthdate). */
export function yearsSince(iso: string): number {
  const d = new Date(iso);
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
  return Math.max(0, years);
}

/**
 * Human duration between a start date and an end date (default: now),
 * e.g. "3 years 2 months" or "5 months". Used for length of service —
 * pass the last working day for resigned crew so it doesn't keep counting.
 */
export function durationSince(iso: string, endIso?: string | null): string {
  const d = new Date(iso);
  const now = endIso ? new Date(endIso) : new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months--;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
  parts.push(`${remMonths} month${remMonths !== 1 ? "s" : ""}`);
  return parts.join(" ");
}

export function updaterName(updater: Updater | null | undefined): string {
  if (!updater) return "—";
  return updater.full_name || updater.email.split("@")[0];
}
