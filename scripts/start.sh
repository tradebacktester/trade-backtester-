#!/bin/bash
set -e
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Kill any stale processes on the ports we own
fuser -k 5000/tcp 2>/dev/null || true
fuser -k 8080/tcp 2>/dev/null || true

# Install dependencies if node_modules is missing or out of date
echo "[start.sh] Installing dependencies..."
pnpm install

# Ensure DB schema is up to date
echo "[start.sh] Syncing database schema..."
pnpm --filter @workspace/db run push 2>&1 || echo "[start.sh] DB push warning (non-fatal)"

# Build the Vite frontend — skip if dist is newer than sources
FRONTEND_DIST="$WORKSPACE_ROOT/artifacts/trade-backtest/dist/public/index.html"
FRONTEND_SRC="$WORKSPACE_ROOT/artifacts/trade-backtest/src"
if [ ! -f "$FRONTEND_DIST" ] || [ "$FRONTEND_SRC" -nt "$FRONTEND_DIST" ]; then
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
FRONTEND_DIST="$WORKSPACE_ROOT/artifacts/trade-backtest/dist/public" \
  PORT=5000 \
  exec node --enable-source-maps "$WORKSPACE_ROOT/artifacts/api-server/dist/index.mjs"
