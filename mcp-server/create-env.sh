#!/bin/bash
# Reads SUPABASE creds from the main app's .env.local and writes mcp-server/.env
set -euo pipefail

PARENT_ENV="../.env.local"
if [ ! -f "$PARENT_ENV" ]; then
  echo "Error: $PARENT_ENV not found"
  exit 1
fi

SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$PARENT_ENV" | cut -d= -f2-)
SERVICE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$PARENT_ENV" | cut -d= -f2-)
API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

cat > .env <<EOF
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
MCP_PORT=3100
MCP_API_KEY=$API_KEY
EOF

echo "Created .env with API key: $API_KEY"
echo "Save this key — you'll need it to connect from Envoy."
