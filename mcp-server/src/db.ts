import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export type PaginationOpts = { limit?: number; offset?: number };

export function paginate(opts: PaginationOpts) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  return { from: offset, to: offset + limit - 1 };
}
