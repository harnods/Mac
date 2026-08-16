import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (same pattern as schema.test.ts)
try {
  const lines = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n");
  for (const line of lines) {
    const [key, ...rest] = line.split("=");
    if (key?.trim() && rest.length) process.env[key.trim()] = rest.join("=").trim();
  }
} catch {
  /* env vars must be set externally (CI) */
}

// Regression test for: crew/chef granted `recipes:write` could open the recipe
// editor but got an RLS error on save (recipes/recipe_items write policies were
// admin-only). Writes must be allowed for any role holding `recipes:write`, and
// still blocked for roles without it.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rt = { realtime: { transport: ws as any } };

let admin: SupabaseClient;
const stamp = Date.now();
const created: { userIds: string[]; recipeIds: string[]; roleNames: string[] } = { userIds: [], recipeIds: [], roleNames: [] };
let itemId: string;
let itemUnit: string;
const NOPERM_ROLE = `rls-noperm-${stamp}`;

async function makeUser(role: string): Promise<SupabaseClient> {
  const email = `rls-${role}-${stamp}-${Math.floor(Math.random() * 1e6)}@machimoto.test`;
  const password = "test-Password-123";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  created.userIds.push(data.user.id);
  // handle_new_user created a profile; set its role.
  const { error: upErr } = await admin.from("profiles").update({ role }).eq("id", data.user.id);
  if (upErr) throw new Error(`set role failed: ${upErr.message}`);

  const userClient = createClient(url, anonKey, rt);
  const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`sign-in failed: ${signInErr.message}`);
  return userClient;
}

beforeAll(async () => {
  if (!url || !serviceKey || !anonKey) {
    throw new Error("Missing SUPABASE env vars (URL / SERVICE_ROLE_KEY / ANON_KEY) in .env.local");
  }
  admin = createClient(url, serviceKey, rt);

  // Ensure the chef role actually holds recipes:write (data precondition).
  const { data: chefPerm } = await admin
    .from("role_permissions")
    .select("permission_key, roles!inner(name)")
    .eq("roles.name", "chef")
    .eq("permission_key", "recipes:write")
    .maybeSingle();
  if (!chefPerm) throw new Error("Precondition: 'chef' role must have recipes:write");

  // A throwaway role with zero permissions for the negative case — independent
  // of how crew/staff grants happen to be configured.
  const { error: roleErr } = await admin.from("roles").insert({ name: NOPERM_ROLE, is_system: false });
  if (roleErr) throw new Error(`create no-perm role failed: ${roleErr.message}`);
  created.roleNames.push(NOPERM_ROLE);

  const { data: item } = await admin
    .from("items")
    .select("id, unit")
    .eq("type", "ingredient")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (!item) throw new Error("Precondition: need at least one ingredient item");
  itemId = item.id;
  itemUnit = item.unit;
});

afterAll(async () => {
  for (const id of created.recipeIds) await admin.from("recipes").delete().eq("id", id);
  for (const id of created.userIds) await admin.auth.admin.deleteUser(id);
  for (const name of created.roleNames) await admin.from("roles").delete().eq("name", name);
});

describe("recipes RLS honors recipes:write", () => {
  it("a chef (recipes:write) can insert a recipe and its recipe_items", async () => {
    const chef = await makeUser("chef");
    const { data: userData } = await chef.auth.getUser();
    const uid = userData.user!.id;

    const { data: recipe, error: recipeErr } = await chef
      .from("recipes")
      .insert({ name: `RLS chef recipe ${stamp}`, recipe_type: "wip", yield_qty: 1, updated_by: uid })
      .select("id")
      .single();
    expect(recipeErr, `recipe insert should succeed: ${recipeErr?.message}`).toBeNull();
    expect(recipe?.id).toBeTruthy();
    if (recipe?.id) created.recipeIds.push(recipe.id);

    // This INSERT is exactly what failed before the fix.
    const { error: itemErr } = await chef
      .from("recipe_items")
      .insert({ recipe_id: recipe!.id, item_id: itemId, quantity: 1, unit: itemUnit });
    expect(itemErr, `recipe_items insert should succeed: ${itemErr?.message}`).toBeNull();
  });

  it("a role without recipes:write is blocked from inserting a recipe", async () => {
    const noperm = await makeUser(NOPERM_ROLE);
    const { data: userData } = await noperm.auth.getUser();
    const uid = userData.user!.id;

    const { data: recipe, error } = await noperm
      .from("recipes")
      .insert({ name: `RLS crew recipe ${stamp}`, recipe_type: "wip", yield_qty: 1, updated_by: uid })
      .select("id")
      .maybeSingle();
    // RLS WITH CHECK rejects the insert → error, no row.
    expect(error, "crew insert must be rejected by RLS").not.toBeNull();
    expect(recipe).toBeFalsy();
    if (recipe?.id) created.recipeIds.push(recipe.id);
  });
});
