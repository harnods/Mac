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

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function updaterName(updater: Updater | null | undefined): string {
  if (!updater) return "—";
  return updater.full_name || updater.email.split("@")[0];
}
