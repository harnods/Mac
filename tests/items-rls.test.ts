import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local (same pattern as the other DB tests)
try {
  const lines = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n");
  for (const line of lines) {
    const [key, ...rest] = line.split("=");
    if (key?.trim() && rest.length) process.env[key.trim()] = rest.join("=").trim();
  }
} catch {
  /* env vars must be set externally (CI) */
}

// Regression test for: crew/chef with granular write permissions could edit
// items but got an RLS error when ADDING a new one, because items INSERT was
// admin-only. A role holding the per-type write permission must be able to
// insert; a role without it must be blocked.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rt = { realtime: { transport: ws as any } };

let admin: SupabaseClient;
const stamp = Date.now();
const WRITER_ROLE = `rls-itemwriter-${stamp}`;
const NOPERM_ROLE = `rls-noperm-item-${stamp}`;
const created = { userIds: [] as string[], roleNames: [] as string[], itemIds: [] as string[] };

async function makeUser(role: string): Promise<SupabaseClient> {
  const email = `rls-item-${role}-${Math.floor(Math.random() * 1e9)}@machimoto.test`;
  const password = "test-Password-123";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  created.userIds.push(data.user.id);
  const { error: upErr } = await admin.from("profiles").update({ role }).eq("id", data.user.id);
  if (upErr) throw new Error(`set role failed: ${upErr.message}`);
  const client = createClient(url, anonKey, rt);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`sign-in failed: ${signInErr.message}`);
  return client;
}

async function roleId(name: string): Promise<string> {
  const { data } = await admin.from("roles").select("id").eq("name", name).single();
  return data!.id as string;
}

beforeAll(async () => {
  if (!url || !serviceKey || !anonKey) throw new Error("Missing SUPABASE env vars in .env.local");
  admin = createClient(url, serviceKey, rt);

  // Ensure the permission keys exist in the catalog (idempotent), then a role
  // that holds them — fully self-contained regardless of seed state.
  await admin.from("permissions").upsert(
    [
      { key: "products:write", module: "products", action: "write", description: "test" },
      { key: "ingredients:write", module: "ingredients", action: "write", description: "test" },
    ],
    { onConflict: "key", ignoreDuplicates: true },
  );
  await admin.from("roles").insert({ name: WRITER_ROLE, is_system: false });
  created.roleNames.push(WRITER_ROLE);
  await admin.from("roles").insert({ name: NOPERM_ROLE, is_system: false });
  created.roleNames.push(NOPERM_ROLE);

  const wid = await roleId(WRITER_ROLE);
  await admin.from("role_permissions").insert([
    { role_id: wid, permission_key: "products:write" },
    { role_id: wid, permission_key: "ingredients:write" },
  ]);
});

afterAll(async () => {
  for (const id of created.itemIds) await admin.from("items").delete().eq("id", id);
  for (const id of created.userIds) await admin.auth.admin.deleteUser(id);
  for (const name of created.roleNames) await admin.from("roles").delete().eq("name", name);
});

describe("items RLS honors granular write permissions", () => {
  it("a role with products:write / ingredients:write can INSERT items", async () => {
    const writer = await makeUser(WRITER_ROLE);

    const { data: product, error: prodErr } = await writer
      .from("items")
      .insert({ name: `RLS product ${stamp}`, unit: "pcs", type: "product" })
      .select("id")
      .single();
    expect(prodErr, `product insert should succeed: ${prodErr?.message}`).toBeNull();
    if (product?.id) created.itemIds.push(product.id);

    const { data: ing, error: ingErr } = await writer
      .from("items")
      .insert({ name: `RLS ingredient ${stamp}`, unit: "pcs", type: "ingredient" })
      .select("id")
      .single();
    expect(ingErr, `ingredient insert should succeed: ${ingErr?.message}`).toBeNull();
    if (ing?.id) created.itemIds.push(ing.id);
  });

  it("a role without item write permission is blocked from INSERT", async () => {
    const noperm = await makeUser(NOPERM_ROLE);
    const { data, error } = await noperm
      .from("items")
      .insert({ name: `RLS blocked ${stamp}`, unit: "pcs", type: "product" })
      .select("id")
      .maybeSingle();
    expect(error, "insert must be rejected by RLS").not.toBeNull();
    expect(data).toBeFalsy();
    if (data?.id) created.itemIds.push(data.id);
  });
});
