# Trade Backtester

A full-stack trade backtesting app that lets you define algorithmic trading strategies and test them against simulated historical price data, with detailed performance metrics and equity curve visualization.

## Run & Operate

- **Start application** workflow runs `bash scripts/start.sh` — installs deps, syncs DB schema, builds frontend + API, starts Express on **port 5000** serving both `/api/*` and the React SPA
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run push-force` — re-apply schema if tables are missing after restart

## Required secrets (Replit → Secrets)

| Secret | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string — **already set** |
| `JWT_SECRET` | Signs auth tokens — auto-generated per session if missing; set as a secret to keep logins valid across restarts |
| `GROQ_API_KEY` | Powers AI features (assistant, coach, strategy builder) — get from https://console.groq.com |
| `ADMIN_ID` / `ADMIN_PASSWORD` | Admin panel login (optional) |
| `SESSION_SECRET` | Express session signing — **already set** |

## First-time setup (after clone)

Run once after cloning to install the git pre-commit hook that blocks accidental secret commits:

```bash
bash scripts/setup-git-hooks.sh
```

This installs `scripts/check-replit-secrets.sh` as `.git/hooks/pre-commit`. After that, any `git commit` that contains a secret-looking value in the `.replit` `[userenv.shared]` block is automatically rejected with a clear error message. The hook is also re-installed automatically on every `git merge` (via `scripts/post-merge.sh`) so it stays in place without any repeated manual step.

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

## Design System

- **Fonts:** Sora (display/headings) + DM Sans (body) + JetBrains Mono (financial data)
- **Dark background:** `#060606` near-black with subtle warm-white + gold radial orbs
- **Brand accents:** Platinum white (`#E8E8F0`) primary, warm gold (`#C9A84C`) for AI/Ghost Mode
- **Keep green/red for trading data only** (BUY/SELL, P&L) — they're trading conventions
- **Nav/dock active:** White glass pill instead of purple
- **Chart page height:** `clamp(520px, calc(100dvh - 170px), 1000px)` — maximizes chart real estate

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
