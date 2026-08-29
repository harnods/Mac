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
