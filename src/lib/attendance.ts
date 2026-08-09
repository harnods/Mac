import type { AttendanceWithRelations } from "@/lib/supabase/types";

export type AttendanceStatus = "present" | "late" | "early-leave";

/** "06:57:00" -> "06:57" (empty string if null) */
export function formatTime(t: string | null | undefined): string {
  if (!t) return "";
  return t.slice(0, 5);
}

/** Minutes since midnight for a "HH:MM[:SS]" time string. */
function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Returns the applicable status flags. "absent" when there's no clock-in;
 * otherwise any of "late" / "early-leave" that apply, or "present" if neither.
 */
export type AttendanceGrace = {
  lateGraceMinutes?: number;
  /** "after" = grace after start (default); "before" = must clock in this early. */
  lateToleranceDirection?: "before" | "after";
  earlyLeaveGraceMinutes?: number;
};

export function attendanceStatuses(a: AttendanceWithRelations, grace?: AttendanceGrace): AttendanceStatus[] {
  if (!a.clock_in) return []; // no clock-in means no attendance record exists

  const lateGrace = grace?.lateGraceMinutes ?? 0;
  const lateOffset = grace?.lateToleranceDirection === "before" ? -lateGrace : lateGrace;
  const earlyGrace = grace?.earlyLeaveGraceMinutes ?? 0;
  const start = a.shifts?.start_time;
  const end = a.shifts?.end_time;
  const overnight = start && end ? toMinutes(end) < toMinutes(start) : false;
  const flags: AttendanceStatus[] = [];
  if (start && toMinutes(a.clock_in) > toMinutes(start) + lateOffset) flags.push("late");
  if (a.clock_out && end && !overnight && toMinutes(a.clock_out) < toMinutes(end) - earlyGrace) flags.push("early-leave");
  if (flags.length === 0) flags.push("present");
  return flags;
}

/** Net worked minutes: (clock_out - clock_in) - break. Handles overnight. null if incomplete. */
export function workDurationMinutes(a: AttendanceWithRelations): number | null {
  if (!a.clock_in || !a.clock_out) return null;
  let diff = toMinutes(a.clock_out) - toMinutes(a.clock_in);
  if (diff < 0) diff += 24 * 60; // crossed midnight
  diff -= a.break_minutes ?? 0;
  return Math.max(0, diff);
}

/** 450 -> "7h 30m", 45 -> "45m", 120 -> "2h" */
export function formatMinutes(min: number | null | undefined): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
