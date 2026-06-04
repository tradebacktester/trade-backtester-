#!/bin/bash
# Kill any processes still holding ports 5000 or 8080 from a previous run
fuser -k 5000/tcp 2>/dev/null || true
fuser -k 8080/tcp 2>/dev/null || true

pnpm --filter @workspace/api-server run dev &
pnpm --filter @workspace/trade-backtest run dev
