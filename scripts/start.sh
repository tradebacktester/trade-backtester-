#!/bin/bash
set -e
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Kill any stale processes on the ports we own
fuser -k 5000/tcp 2>/dev/null || true
fuser -k 8080/tcp 2>/dev/null || true

# Ensure DB schema is up to date
echo "[start.sh] Syncing database schema..."
pnpm --filter @workspace/db run push 2>&1 || echo "[start.sh] DB push warning (non-fatal)"

# Build the Vite frontend for production
echo "[start.sh] Building frontend..."
pnpm --filter @workspace/trade-backtest run build

# Build the API server (also bundles the static-file serving code)
echo "[start.sh] Building API server..."
pnpm --filter @workspace/api-server run build

# Start Express on port 5000 — serves both /api/* routes AND the built frontend
echo "[start.sh] Starting server on port 5000..."
FRONTEND_DIST="$WORKSPACE_ROOT/artifacts/trade-backtest/dist/public" \
  PORT=5000 \
  exec node --enable-source-maps "$WORKSPACE_ROOT/artifacts/api-server/dist/index.mjs"
