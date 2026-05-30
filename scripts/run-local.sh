#!/usr/bin/env bash
# Bring up the full local stack for testing:
#   1. local Supabase (Docker) — start if not already running
#   2. seed admin/staff users — only if the DB has none (keeps passwords stable)
#   3. Next.js dev server on :4321 — restart fresh so it uses local .env.local
#
# Usage: bash scripts/run-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
PORT=4321

echo "▶ Local Supabase…"
if supabase status >/dev/null 2>&1; then
  echo "  already running"
else
  supabase start >/dev/null
  echo "  started"
fi

# Always use legacy JWT keys (not sb_publishable_ format) — required by @supabase/ssr
ANON_JWT=$(supabase --workdir . status --output json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ANON_KEY',''))" 2>/dev/null || true)
SVC_JWT=$(supabase --workdir . status --output json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('SERVICE_ROLE_KEY',''))" 2>/dev/null || true)
if [ -n "$ANON_JWT" ] && [ -n "$SVC_JWT" ]; then
  sed -i '' "s|^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_JWT}|" .env.local
  sed -i '' "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=${SVC_JWT}|" .env.local
  echo "  JWT keys updated in .env.local"
fi

echo "▶ Users…"
COUNT=$(psql "$DB" -tA -c "select count(*) from profiles;" 2>/dev/null || echo 0)
if [ "$COUNT" = "0" ]; then
  echo "  seeding (none found)…"
  node scripts/seed-users.mjs | grep -E "email:|password:" || true
else
  echo "  $COUNT user(s) already seeded — passwords unchanged"
fi

echo "▶ Dev server on :$PORT…"
EXISTING=$(lsof -ti:$PORT 2>/dev/null || true)
[ -n "$EXISTING" ] && { kill $EXISTING 2>/dev/null || true; sleep 1; }
(npm run dev > /tmp/macdev.log 2>&1 &)

for _ in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/login" 2>/dev/null || true)
  [ "$code" = "200" ] && break
  sleep 1
done

if [ "$code" = "200" ]; then
  echo ""
  echo "✅ Running → http://localhost:$PORT"
  echo "   Studio   → http://127.0.0.1:54323"
else
  echo "✗ dev server did not come up (HTTP $code). Last log lines:"
  tail -20 /tmp/macdev.log
  exit 1
fi
