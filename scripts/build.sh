#!/bin/bash
set -e
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[build.sh] Installing dependencies..."
pnpm install --frozen-lockfile

echo "[build.sh] Syncing database schema..."
pnpm --filter @workspace/db run push 2>&1 || echo "[build.sh] DB push warning (non-fatal)"

echo "[build.sh] Building frontend..."
pnpm --filter @workspace/trade-backtest run build

echo "[build.sh] Building API server..."
pnpm --filter @workspace/api-server run build

echo "[build.sh] Done."
