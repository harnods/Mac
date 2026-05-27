import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
try {
  const lines = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n");
  for (const line of lines) {
    const [key, ...rest] = line.split("=");
    if (key?.trim() && rest.length) process.env[key.trim()] = rest.join("=").trim();
  }
} catch {
  // env vars must be set externally (CI)
}

const REQUIRED_TABLES = [
  "profiles",
  "categories",
  "items",
  "recipes",
  "recipe_items",
];

const REQUIRED_COLUMNS: Record<string, string[]> = {
  items: ["on_hand", "reserved", "unit", "type"],
  categories: ["is_default", "updated_at", "updated_by", "type"],
  recipes: ["name", "updated_by"],
  recipe_items: ["recipe_id", "item_id", "quantity", "unit"],
};

let supabase: SupabaseClient;

beforeAll(() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase = createClient(url, key, { realtime: { transport: ws as any } });
});

describe("Database schema — tables", () => {
  for (const table of REQUIRED_TABLES) {
    it(`table '${table}' exists`, async () => {
      const { error } = await supabase.from(table).select("*").limit(0);
      expect(
        error?.code,
        `Table '${table}' not found — run the migration for this table in Supabase SQL Editor.\n  Error: ${error?.message}`,
      ).not.toBe("PGRST200");
      expect(error).toBeNull();
    });
  }
});

describe("Database schema — columns", () => {
  for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
    it(`table '${table}' has columns: ${cols.join(", ")}`, async () => {
      const { data, error } = await supabase.from(table).select(cols.join(", ")).limit(0);
      expect(
        error,
        `Table '${table}' is missing one or more columns [${cols.join(", ")}] — run the relevant migration.\n  Error: ${error?.message}`,
      ).toBeNull();
      expect(data).toBeDefined();
    });
  }
});
