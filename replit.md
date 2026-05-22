# Trade Backtester

A full-stack trade backtesting app that lets you define algorithmic trading strategies and test them against simulated historical price data, with detailed performance metrics and equity curve visualization.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4 + Shadcn UI + Recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (strategies, backtests, trades, equity_curve)
- `artifacts/api-server/src/routes/` — Express route handlers (strategies.ts, backtests.ts)
- `artifacts/api-server/src/lib/backtest-engine.ts` — pure-TS backtest engine with indicator math
- `artifacts/trade-backtest/src/pages/` — React pages (dashboard, strategies, backtests)

## Architecture decisions

- The backtest engine is a pure TypeScript module in the API server that generates deterministic simulated OHLCV price data (seeded by symbol name) and runs indicator-based strategies against it. No external market data API needed.
- Strategies store their parameters as JSONB so any indicator type's config can be persisted without schema changes.
- Equity curve data is downsampled to 500 points max per backtest to keep response sizes manageable.
- The app defaults to always-dark mode (dark class added to `<html>` in main.tsx).

## Product

- Create trading strategies with 5 indicator types: SMA Crossover, EMA Crossover, RSI, MACD, Bollinger Bands
- Run backtests over custom date ranges with configurable initial capital
- View full results: total return, annualized return, max drawdown, Sharpe ratio, win rate, profit factor
- Interactive equity curve and drawdown chart (Recharts)
- Trade-by-trade table with entry/exit prices and P&L
- Dashboard with aggregate stats across all backtests

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `@apply dark` in Tailwind v4 is invalid — `dark` is a variant, not a utility. Apply the `.dark` class via JS (`document.documentElement.classList.add("dark")`) instead.
- Numeric DB fields (numeric/decimal columns) come back as strings from pg/Drizzle — always wrap with `Number()` before sending JSON responses.
- The `sum()` Drizzle aggregate returns a string; cast with `Number()`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
