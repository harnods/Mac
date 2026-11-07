import { createClient } from "@supabase/supabase-js";

const buckets = new Map<string, { count: number; resetAt: number }>();

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function persistBucket(key: string, count: number, resetAt: number) {
  const db = getAdminClient();
  if (!db) return;
  try {
    await db.from("rate_limits").upsert(
      { key, count, reset_at: new Date(resetAt).toISOString() },
      { onConflict: "key" },
    );
  } catch {}
}

async function recoverBucket(
  key: string,
): Promise<{ count: number; resetAt: number } | null> {
  const db = getAdminClient();
  if (!db) return null;
  try {
    const { data } = await db
      .from("rate_limits")
      .select("count, reset_at")
      .eq("key", key)
      .gt("reset_at", new Date().toISOString())
      .maybeSingle();
    if (!data) return null;
    return { count: data.count, resetAt: new Date(data.reset_at).getTime() };
  } catch {
    return null;
  }
}

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { limited: boolean; remaining: number } {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    persistBucket(key, 1, now + windowMs).catch(() => {});
    return { limited: false, remaining: maxRequests - 1 };
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);
  const limited = entry.count > maxRequests;

  if (limited) {
    persistBucket(key, entry.count, entry.resetAt).catch(() => {});
  }

  return { limited, remaining };
}

export async function rateLimitPersistent(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<{ limited: boolean; remaining: number }> {
  const now = Date.now();
  let entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    const recovered = await recoverBucket(key);
    if (recovered && now <= recovered.resetAt) {
      entry = recovered;
      buckets.set(key, entry);
    } else {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      persistBucket(key, 1, now + windowMs).catch(() => {});
      return { limited: false, remaining: maxRequests - 1 };
    }
  }

  entry.count++;
  buckets.set(key, entry);
  const remaining = Math.max(0, maxRequests - entry.count);
  const limited = entry.count > maxRequests;

  persistBucket(key, entry.count, entry.resetAt).catch(() => {});

  return { limited, remaining };
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (!xff) return "unknown";
  return xff.split(",")[0].trim();
}
