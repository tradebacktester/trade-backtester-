#!/bin/bash
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Kill any stale processes on ports we own
fuser -k 5000/tcp 2>/dev/null || true
fuser -k 8080/tcp 2>/dev/null || true

# API server always on 8080 (explicit PORT override)
PORT=8080 pnpm --filter @workspace/api-server run dev &

# Frontend always on 5000 (external :80 in .replit port mapping)
export PORT=5000
cd "$WORKSPACE_ROOT/artifacts/trade-backtest" && exec pnpm exec vite --config vite.config.ts
