#!/bin/bash
set -e
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Kill any stale processes on ports we own
fuser -k 5000/tcp 2>/dev/null || true
fuser -k 8080/tcp 2>/dev/null || true

# Ensure DB schema is up to date
echo "[start.sh] Syncing database schema..."
pnpm --filter @workspace/db run push 2>&1 || echo "[start.sh] DB push warning (non-fatal)"

# Pre-build the API server synchronously so it is ready before Vite starts
echo "[start.sh] Building API server..."
pnpm --filter @workspace/api-server run build

# Start the API server in the background (no rebuild needed)
echo "[start.sh] Starting API server on port 8080..."
PORT=8080 node --enable-source-maps "$WORKSPACE_ROOT/artifacts/api-server/dist/index.mjs" &
API_PID=$!

# Wait for the API server to be accepting connections (up to 15 s)
echo "[start.sh] Waiting for API server..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:8080/api/healthz >/dev/null 2>&1; then
    echo "[start.sh] API server ready."
    break
  fi
  sleep 1
done

# Start the Vite dev server on port 5000 (foreground — keeps the workflow alive)
echo "[start.sh] Starting Vite dev server on port 5000..."
export PORT=5000
cd "$WORKSPACE_ROOT/artifacts/trade-backtest" && exec pnpm exec vite --config vite.config.ts
