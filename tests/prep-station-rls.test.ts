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

// Regression: a role scoped to one recipe station (recipes:kitchen only) may
// create prep orders for kitchen recipes but is blocked (RLS) from creating one
// for a bar recipe.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rt = { realtime: { transport: ws as any } };

let admin: SupabaseClient;
const stamp = Date.now();
const ROLE = `rls-kitchen-only-${stamp}`;
const created = { userIds: [] as string[], roleNames: [] as string[], recipeIds: [] as string[], orderIds: [] as string[] };
let barRecipe: string;
let kitchenRecipe: string;

beforeAll(async () => {
  if (!url || !serviceKey || !anonKey) throw new Error("Missing SUPABASE env vars in .env.local");
  admin = createClient(url, serviceKey, rt);

  await admin.from("permissions").upsert(
    [
      { key: "prep_orders:write", module: "prep_orders", action: "write", description: "test" },
      { key: "recipes:kitchen", module: "recipes", action: "kitchen", description: "test" },
      { key: "recipes:bar", module: "recipes", action: "bar", description: "test" },
    ],
    { onConflict: "key", ignoreDuplicates: true },
  );
  await admin.from("roles").insert({ name: ROLE, is_system: false });
  created.roleNames.push(ROLE);
  const { data: role } = await admin.from("roles").select("id").eq("name", ROLE).single();
  await admin.from("role_permissions").insert([
    { role_id: role!.id, permission_key: "prep_orders:write" },
    { role_id: role!.id, permission_key: "recipes:kitchen" }, // kitchen only, NOT bar
  ]);

  const { data: recs } = await admin
    .from("recipes")
    .insert([
      { name: `RLS bar recipe ${stamp}`, station: "bar" },
      { name: `RLS kitchen recipe ${stamp}`, station: "kitchen" },
    ])
    .select("id, station");
  barRecipe = recs!.find((r) => r.station === "bar")!.id;
  kitchenRecipe = recs!.find((r) => r.station === "kitchen")!.id;
  created.recipeIds.push(barRecipe, kitchenRecipe);
});

afterAll(async () => {
  for (const id of created.orderIds) await admin.from("prep_orders").delete().eq("id", id);
  for (const id of created.recipeIds) await admin.from("recipes").delete().eq("id", id);
  for (const id of created.userIds) await admin.auth.admin.deleteUser(id);
  for (const name of created.roleNames) await admin.from("roles").delete().eq("name", name);
});

async function kitchenOnlyClient(): Promise<SupabaseClient> {
  const email = `rls-prep-${Math.floor(Math.random() * 1e9)}@machimoto.test`;
  const password = "test-Password-123";
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  created.userIds.push(data.user!.id);
  await admin.from("profiles").update({ role: ROLE }).eq("id", data.user!.id);
  const c = createClient(url, anonKey, rt);
  await c.auth.signInWithPassword({ email, password });
  return c;
}

describe("prep orders are station-scoped", () => {
  it("kitchen-only role CAN create a prep order for a kitchen recipe", async () => {
    const c = await kitchenOnlyClient();
    const { data, error } = await c
      .from("prep_orders")
      .insert({ recipe_id: kitchenRecipe, unit: "pcs" })
      .select("id")
      .single();
    expect(error, error?.message).toBeNull();
    if (data?.id) created.orderIds.push(data.id);
  });

  it("kitchen-only role is BLOCKED from a bar recipe prep order", async () => {
    const c = await kitchenOnlyClient();
    const { data, error } = await c
      .from("prep_orders")
      .insert({ recipe_id: barRecipe, unit: "pcs" })
      .select("id")
      .maybeSingle();
    expect(error, "bar prep order must be rejected by RLS").not.toBeNull();
    expect(data).toBeFalsy();
    if (data?.id) created.orderIds.push(data.id);
  });
});
