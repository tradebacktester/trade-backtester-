#!/bin/bash
set -e
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Kill any stale processes on the ports we own
fuser -k 5000/tcp 2>/dev/null || true
fuser -k 8080/tcp 2>/dev/null || true

# Install dependencies if node_modules is missing or out of date
echo "[start.sh] Installing dependencies..."
pnpm install

# Auto-generate JWT_SECRET if not set (happens on fresh Replit imports)
if [ -z "${JWT_SECRET}" ]; then
  echo "[start.sh] WARNING: JWT_SECRET not set — auto-generating one for this session."
  echo "[start.sh] To make tokens persist across restarts, add JWT_SECRET as a secret in your Replit."
  JWT_SECRET="$(node -e "process.stdout.write(require('crypto').randomBytes(64).toString('hex'))")"
fi

# Ensure DB schema is up to date — use --force to avoid interactive prompts on fresh DBs
echo "[start.sh] Syncing database schema..."
pnpm --filter @workspace/db run push-force 2>&1 || echo "[start.sh] DB push warning (non-fatal)"

# Build the Vite frontend — skip if dist is newer than sources
FRONTEND_DIST_HTML="$WORKSPACE_ROOT/artifacts/trade-backtest/dist/public/index.html"
FRONTEND_SRC="$WORKSPACE_ROOT/artifacts/trade-backtest/src"
if [ ! -f "$FRONTEND_DIST_HTML" ] || [ "$FRONTEND_SRC" -nt "$FRONTEND_DIST_HTML" ]; then
  echo "[start.sh] Building frontend..."
  pnpm --filter @workspace/trade-backtest run build
else
  echo "[start.sh] Frontend dist is up to date, skipping build."
fi

# Build the API server — skip if dist is newer than sources
API_DIST="$WORKSPACE_ROOT/artifacts/api-server/dist/index.mjs"
API_SRC="$WORKSPACE_ROOT/artifacts/api-server/src"
if [ ! -f "$API_DIST" ] || [ "$API_SRC" -nt "$API_DIST" ]; then
  echo "[start.sh] Building API server..."
  pnpm --filter @workspace/api-server run build
else
  echo "[start.sh] API server dist is up to date, skipping build."
fi

# Start Express on port 5000 — serves both /api/* routes AND the built frontend
echo "[start.sh] Starting server on port 5000..."
exec env \
  FRONTEND_DIST="$WORKSPACE_ROOT/artifacts/trade-backtest/dist/public" \
  PORT=5000 \
  JWT_SECRET="${JWT_SECRET}" \
  DATABASE_URL="${DATABASE_URL}" \
  GROQ_API_KEY="${GROQ_API_KEY}" \
  ALPACA_KEY_ID="${ALPACA_KEY_ID}" \
  ALPACA_SECRET_KEY="${ALPACA_SECRET_KEY}" \
  SESSION_SECRET="${SESSION_SECRET}" \
  ADMIN_ID="${ADMIN_ID}" \
  ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
  REPLIT_DEV_DOMAIN="${REPLIT_DEV_DOMAIN}" \
  REPL_ID="${REPL_ID}" \
  node --enable-source-maps "$WORKSPACE_ROOT/artifacts/api-server/dist/index.mjs"
