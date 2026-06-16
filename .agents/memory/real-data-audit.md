---
name: Real data audit
description: Which market features in TradeLab are live vs. fake, and what paid APIs would be required to make the remaining ones real.
---

## Already real (no changes needed)

| Feature | Source |
|---|---|
| Crypto screener prices / RSI / MACD | Binance 24hr ticker + klines |
| Stocks/forex/indices screener | Yahoo Finance (yahoo-finance2 v3) |
| Futures, ETFs, bonds, commodities, global indices | `GET /api/tools/extra-assets` → Yahoo Finance |
| Crypto dominance (BTC.D, ETH.D, alt.D …) | `GET /api/tools/crypto-dominance` → CoinGecko `/api/v3/global` |
| Economic indicators (Fed Rate, CPI, GDP, Unemployment) | `GET /api/tools/economic-indicators` → FRED public CSV (no key) |
| "WR +X% vs avg" edge label per symbol | `GET /api/tools/user-symbol-performance` → real user backtest DB |
| Live quote (paper trading / alerts) | `GET /api/tools/live-quote` → Binance or Yahoo Finance |
| Paper trading P&L (crypto) | Binance WebSocket in chart.tsx |
| Paper trading P&L (stocks/ETFs) | Real candle close from Yahoo |
| Market status badges | Real market-hours logic per exchange |
| Best session labels | Exchange/region timezone rules |
| Watchlist persistence | DB-backed (watchlist table) |
| Backtest optimizer | Real grid search with Binance/Yahoo data |
| Real-time alert delivery | SSE infrastructure |
| Order book depth (crypto) | Binance depth endpoint (real) |
| Order book depth (non-crypto) | Real Yahoo mid-price + indicative spread (labelled "indicative") |
| Forex Factory economic calendar | Forex Factory JSON feed (real, with fallback) |
| Funding rates | Binance + Bybit + OKX (real) |
| KRBN / BDRY carbon/freight proxies | Already in STOCK_SYMBOLS, fetched via Yahoo Finance |

## Changed in this session

| Feature | Before | After |
|---|---|---|
| Node.js version | nodejs-20 (caused yahoo-finance2 warning) | nodejs-22 |
| Future Sim "Market Ranges" scenario | Hardcoded `winPnl * 0.12` (always 12%) | Real 14-day ATR from Binance; falls back to 1.5% for non-crypto |
| `useSimPrice` hook | Random walk only | Accepts optional `symbol`; polls `/api/tools/live-quote` every 5 s |

## Still require paid APIs

| Feature | What's needed |
|---|---|
| Footprint chart (non-Binance symbols) | L2 order flow tick data — Polygon.io (~$29/mo) or TradingView |
| True Level 2 order book (stocks/ETFs) | Polygon.io / IEX Cloud |
| Live brokerage connection | Alpaca (free paper trading API available, needs key) |
| Multi-asset / portfolio backtesting UI | Architecture exists (`runMultiAssetBacktest` in backtest-engine.ts), just needs frontend |

**Why:** These data types are not available from any free public API at the tick/L2 level. Polygon.io is the standard low-cost solution for stocks.
