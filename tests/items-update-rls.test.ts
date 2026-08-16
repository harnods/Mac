import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const lines = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n");
  for (const line of lines) {
    const [key, ...rest] = line.split("=");
    if (key?.trim() && rest.length) process.env[key.trim()] = rest.join("=").trim();
  }
} catch {
  /* env set externally in CI */
}

// Regression test for tightening the items UPDATE policy (was USING(true) — any
// authenticated user could edit any item). After the fix:
//   - an item writer can update an item,
//   - a stock-only role can still update on_hand (stock flow preserved),
//   - a role with none of the relevant permissions can NOT update.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rt = { realtime: { transport: ws as any } };

let admin: SupabaseClient;
const stamp = Date.now();
const WRITER = `rls-upd-writer-${stamp}`;
const STOCK = `rls-upd-stock-${stamp}`;
const NOPERM = `rls-upd-noperm-${stamp}`;
const created = { userIds: [] as string[], roleNames: [] as string[], itemIds: [] as string[] };
let itemId: string;

async function makeUser(role: string): Promise<SupabaseClient> {
  const email = `rls-upd-${role}-${Math.floor(Math.random() * 1e9)}@machimoto.test`;
  const password = "test-Password-123";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  created.userIds.push(data.user.id);
  await admin.from("profiles").update({ role }).eq("id", data.user.id);
  const client = createClient(url, anonKey, rt);
  const { error: e } = await client.auth.signInWithPassword({ email, password });
  if (e) throw new Error(`sign-in failed: ${e.message}`);
  return client;
}

async function roleId(name: string): Promise<string> {
  const { data } = await admin.from("roles").select("id").eq("name", name).single();
  return data!.id as string;
}

beforeAll(async () => {
  if (!url || !serviceKey || !anonKey) throw new Error("Missing SUPABASE env vars in .env.local");
  admin = createClient(url, serviceKey, rt);

  await admin.from("permissions").upsert(
    [
      { key: "ingredients:write", module: "ingredients", action: "write", description: "test" },
      { key: "stock_adjustments:write", module: "stock_adjustments", action: "write", description: "test" },
    ],
    { onConflict: "key", ignoreDuplicates: true },
  );

  for (const r of [WRITER, STOCK, NOPERM]) {
    await admin.from("roles").insert({ name: r, is_system: false });
    created.roleNames.push(r);
  }
  await admin.from("role_permissions").insert({ role_id: await roleId(WRITER), permission_key: "ingredients:write" });
  await admin.from("role_permissions").insert({ role_id: await roleId(STOCK), permission_key: "stock_adjustments:write" });

  const { data: item, error } = await admin
    .from("items")
    .insert({ name: `RLS upd item ${stamp}`, unit: "pcs", type: "ingredient", on_hand: 5 })
    .select("id")
    .single();
  if (error || !item) throw new Error(`seed item failed: ${error?.message}`);
  itemId = item.id;
  created.itemIds.push(item.id);
});

afterAll(async () => {
  for (const id of created.itemIds) await admin.from("items").delete().eq("id", id);
  for (const id of created.userIds) await admin.auth.admin.deleteUser(id);
  for (const name of created.roleNames) await admin.from("roles").delete().eq("name", name);
});

describe("items UPDATE is permission-scoped", () => {
  it("an item writer (ingredients:write) can update the item", async () => {
    const w = await makeUser(WRITER);
    const { data, error } = await w.from("items").update({ name: `edited-${stamp}` }).eq("id", itemId).select("id");
    expect(error, error?.message).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("a stock-only role (stock_adjustments:write) can update on_hand", async () => {
    const s = await makeUser(STOCK);
    const { data, error } = await s.from("items").update({ on_hand: 9 }).eq("id", itemId).select("id");
    expect(error, error?.message).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("a role with no relevant permission can NOT update the item", async () => {
    const n = await makeUser(NOPERM);
    const { data, error } = await n.from("items").update({ name: `hacked-${stamp}` }).eq("id", itemId).select("id");
    // RLS USING excludes the row → 0 rows affected, no error.
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
    // Confirm the value did not change.
    const { data: after } = await admin.from("items").select("name").eq("id", itemId).single();
    expect(after?.name).not.toBe(`hacked-${stamp}`);
  });
});
