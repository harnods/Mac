import { createBrowserClient } from "@supabase/ssr";

function getBrowserSupabaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (typeof window === "undefined") return configuredUrl;

  const url = new URL(configuredUrl);
  const isLocalSupabase = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  const isRemoteBrowser = window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost";

  if (isLocalSupabase && isRemoteBrowser) {
    url.hostname = window.location.hostname;
  }

  return url.toString();
}

export function createClient() {
  return createBrowserClient(
    getBrowserSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
