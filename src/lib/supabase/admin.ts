import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client with NO cookie/session state. Safe to call inside
// unstable_cache (which forbids cookies()). Server-only: never import from a
// Client Component — it carries the service-role key.
let adminClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createAdminClient() {
  if (adminClient) return adminClient;
  adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  return adminClient;
}
