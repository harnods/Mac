#!/usr/bin/env node
// Local development bridge for the Telegram purchasing bot.
//
// Telegram can't reach http://localhost, so instead of a webhook this script
// long-polls getUpdates and forwards each update to the local webhook route
// (http://localhost:3006/api/telegram/webhook) with the secret header.
//
// Use a SEPARATE bot (its own token from @BotFather) for local — getUpdates
// can't run while a webhook is set, so polling with the production bot's token
// would require removing production's webhook. This script refuses to do that.
//
// Usage: node scripts/telegram-poll.mjs
// Requires in .env.local: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const token = env.TELEGRAM_BOT_TOKEN;
const secret = env.TELEGRAM_WEBHOOK_SECRET;
const target = process.env.WEBHOOK_TARGET || "http://localhost:3006/api/telegram/webhook";
if (!token || !secret) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET in .env.local");
  process.exit(1);
}

async function tg(method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  return json.result;
}

const me = await tg("getMe");
const hook = await tg("getWebhookInfo");
if (hook.url) {
  console.error(`@${me.username} has a webhook set (${hook.url}).`);
  console.error("Refusing to poll — that is probably the production bot. Use a separate bot token for local.");
  process.exit(1);
}

console.log(`Polling @${me.username} → ${target}  (Ctrl+C to stop)`);
let offset = 0;
for (;;) {
  let updates = [];
  try {
    updates = await tg("getUpdates", {
      offset,
      timeout: 30,
      allowed_updates: ["message", "callback_query", "my_chat_member"],
    });
  } catch (e) {
    console.error("getUpdates failed:", e.message);
    await new Promise((r) => setTimeout(r, 3000));
    continue;
  }
  for (const u of updates) {
    offset = u.update_id + 1;
    const kind = Object.keys(u).find((k) => k !== "update_id");
    try {
      const res = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret },
        body: JSON.stringify(u),
      });
      console.log(`${new Date().toLocaleTimeString()}  #${u.update_id} ${kind} → ${res.status}`);
    } catch (e) {
      console.error(`#${u.update_id} ${kind} → failed: ${e.message} (is the dev server running?)`);
    }
  }
}
