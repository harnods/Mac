import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude API access for the Telegram bot, using the owner's own key
 * (ANTHROPIC_API_KEY). Default Claude Sonnet 5.5; override with
 * TELEGRAM_PARSE_MODEL (e.g. "claude-opus-5-5" or "claude-haiku-5-5").
 */
export const MODEL = process.env.TELEGRAM_PARSE_MODEL?.trim() || "claude-sonnet-5-5";

/** Models that accept server-side refusal fallbacks (`fallbacks: "default"`). */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

/** Spread into a beta Messages request: refusal fallbacks where the model supports them. */
export function fallbackParams() {
  return FALLBACK_MODELS.has(MODEL)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};
}

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (client) return client;
  // Trim: keys pasted into a dashboard often carry a trailing newline.
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  client = new Anthropic({ apiKey });
  return client;
}
