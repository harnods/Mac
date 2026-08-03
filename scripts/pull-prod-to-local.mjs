#!/usr/bin/env node
// Pull ALL data from PRODUCTION Supabase into the LOCAL Postgres.
// Reads prod via the service-role key (bypasses RLS); writes a single
// self-contained SQL file that TRUNCATEs every public table and reloads
// it from prod data using jsonb_populate_recordset.
//
// Data flows machine -> file -> local DB. It never leaves your machine.
//
// Usage:
//   node scripts/pull-prod-to-local.mjs                 # writes scripts/.prod-load.sql
//   then: docker exec -i supabase_db_machitori psql -U postgres -d postgres \
//           -v ON_ERROR_STOP=1 -f - < scripts/.prod-load.sql

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";
import { createClient } from "@supabase/supabase-js";

globalThis.WebSocket = ws;

// --- read prod credentials from .env.local.prod-backup ---
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

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Load order does not matter because FK triggers are disabled during load.
const TABLES = [
  "categories", "customers", "departments", "employees", "employment_statuses",
  "item_unit_conversions", "items", "job_levels", "job_positions",
  "loyalty_accounts", "loyalty_settings", "loyalty_transactions",
  "order_items", "order_shifts", "orders", "permissions",
  "prep_order_items", "prep_orders", "product_set_items", "profiles",
  "purchase_items", "purchase_purchase_requests", "purchase_request_items",
  "purchase_requests", "purchases", "recipe_item_substitutes", "recipe_items",
  "recipes", "role_permissions", "roles", "sales_entries", "sales_entry_items",
  "stock_adjustments", "stock_count_items", "stock_counts", "stock_ledger",
  "tables", "units",
];

// orders.order_number is a GENERATED column and must not be inserted.
// orders is empty in prod, but strip it defensively so a future non-empty
// orders table still loads.
const GENERATED = { orders: ["order_number"] };

function sqlLiteral(jsonStr) {
  // standard_conforming_strings is on by default -> backslashes are literal,
  // so JSON escapes survive; only single quotes need doubling.
  return "'" + jsonStr.replace(/'/g, "''") + "'";
}

async function fetchAll(table) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

const parts = [];
parts.push("BEGIN;");
parts.push("SET session_replication_role = replica;"); // disable FK + user triggers
parts.push(
  "TRUNCATE " +
    TABLES.map((t) => `public."${t}"`).join(", ") +
    " RESTART IDENTITY CASCADE;",
);

let total = 0;
for (const table of TABLES) {
  const rows = await fetchAll(table);
  const strip = GENERATED[table] || [];
  if (strip.length) {
    for (const r of rows) for (const c of strip) delete r[c];
  }
  console.error(`  ${table.padEnd(28)} ${rows.length}`);
  total += rows.length;
  if (rows.length === 0) continue;
  const json = sqlLiteral(JSON.stringify(rows));
  // Explicit-column form so stripped generated columns are excluded and
  // column order is irrelevant.
  const cols = Object.keys(rows[0]);
  const collist = cols.map((c) => `"${c}"`).join(", ");
  const sel = cols.map((c) => `x."${c}"`).join(", ");
  parts.push(
    `INSERT INTO public."${table}" (${collist})\n` +
      `SELECT ${sel} FROM jsonb_populate_recordset(NULL::public."${table}", ${json}::jsonb) x;`,
  );
}

parts.push("COMMIT;");

const out = resolve(process.cwd(), "scripts/.prod-load.sql");
writeFileSync(out, parts.join("\n\n") + "\n", "utf8");
console.error(`\nWrote ${out}  (${total} rows across ${TABLES.length} tables)`);
