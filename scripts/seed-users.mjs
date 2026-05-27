#!/usr/bin/env node
// Seed initial admin and staff users in Supabase Auth.
// Usage: node scripts/seed-users.mjs
//
// Requires .env.local with:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";

// @ts-ignore — provide WebSocket for Node 20 (realtime-js needs it even though we don't use it).
globalThis.WebSocket = ws;

const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function genPassword() {
  // 16 chars, URL-safe alphanumerics.
  return randomBytes(12).toString("base64url");
}

async function upsertUser({ email, role, fullName }) {
  // Look up existing user.
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === email);

  const password = genPassword();
  let userId;

  if (existing) {
    userId = existing.id;
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    if (error) throw error;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    if (error) throw error;
    userId = data.user.id;
  }

  // Force role + full_name in profiles (the trigger only sets default 'staff' if metadata is missing).
  const { error: upErr } = await supabase
    .from("profiles")
    .upsert({ id: userId, email, full_name: fullName, role }, { onConflict: "id" });
  if (upErr) throw upErr;

  return { email, password, role };
}

const users = [
  { email: "admin@machimoto.local", role: "admin", fullName: "Machimoto Admin" },
  { email: "staff@machimoto.local", role: "staff", fullName: "Machimoto Staff" },
];

const results = [];
for (const u of users) {
  try {
    const r = await upsertUser(u);
    results.push(r);
    console.log(`✓ ${r.role.padEnd(5)}  ${r.email}  password: ${r.password}`);
  } catch (e) {
    console.error(`✗ ${u.email}:`, e.message || e);
    process.exit(1);
  }
}

console.log("\n--- COPY THESE CREDENTIALS ---");
for (const r of results) {
  console.log(`${r.role.toUpperCase()}\n  email:    ${r.email}\n  password: ${r.password}\n`);
}
