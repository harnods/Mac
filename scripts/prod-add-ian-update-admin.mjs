#!/usr/bin/env node
// One-off PRODUCTION change (uses .env.local.prod-backup service-role key):
//   1. Update admin@machimoto.local password -> admin-mac-2026
//   2. Create ian@machimoto.local (staff) + profile + employee, password ian-2026
//
// Surgical: touches ONLY these two accounts. Does not modify staff or anyone else.
//
// Usage: node scripts/prod-add-ian-update-admin.mjs

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";

globalThis.WebSocket = ws;

const envText = readFileSync(resolve(process.cwd(), ".env.local.prod-backup"), "utf8");
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
  console.error("Missing prod URL or service-role key in .env.local.prod-backup");
  process.exit(1);
}
if (url.includes("127.0.0.1") || url.includes("localhost")) {
  console.error("Refusing to run: prod-backup URL points at localhost, not production.");
  process.exit(1);
}
console.error(`Target: ${url}`);

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === email);
}

// ---- 1. admin password ----
const admin = await findUserByEmail("admin@machimoto.local");
if (!admin) throw new Error("admin@machimoto.local not found in production");
{
  const { error } = await supabase.auth.admin.updateUserById(admin.id, {
    password: "admin-mac-2026",
  });
  if (error) throw error;
  console.error(`✓ admin password updated (id ${admin.id})`);
}

// ---- 2. ian: create user + profile + employee ----
let ian = await findUserByEmail("ian@machimoto.local");
if (ian) {
  const { error } = await supabase.auth.admin.updateUserById(ian.id, {
    password: "ian-2026",
    email_confirm: true,
    user_metadata: { full_name: "Ian", role: "staff" },
  });
  if (error) throw error;
  console.error(`• ian already existed — password/metadata refreshed (id ${ian.id})`);
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email: "ian@machimoto.local",
    password: "ian-2026",
    email_confirm: true,
    user_metadata: { full_name: "Ian", role: "staff" },
  });
  if (error) throw error;
  ian = data.user;
  console.error(`✓ ian auth user created (id ${ian.id})`);
}

// profile (trigger may have inserted a default 'staff' row; force correct values)
{
  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: ian.id, email: "ian@machimoto.local", full_name: "Ian", role: "staff", is_owner: false },
      { onConflict: "id" },
    );
  if (error) throw error;
  console.error("✓ ian profile upserted (staff)");
}

// employee (only if not present)
{
  const { data: existing } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", ian.id)
    .maybeSingle();
  if (existing) {
    console.error("• ian employee already exists — skipped");
  } else {
    const { error } = await supabase
      .from("employees")
      .insert({ name: "Ian", email: "ian@machimoto.local", user_id: ian.id, updated_by: ian.id });
    if (error) throw error;
    console.error("✓ ian employee created");
  }
}

console.error("\nDone.");
