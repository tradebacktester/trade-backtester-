---
name: Chart architecture
description: Lightweight-charts v5 multi-chart setup used in the Trade Backtester chart page.
---

# Chart Architecture

## Files
- `artifacts/trade-backtest/src/pages/chart.tsx` — main page (all chart logic)
- `artifacts/trade-backtest/src/lib/chart-utils.ts` — types, calculations (SMA/EMA/BB/RSI/MACD), layout persistence

## Chart instances
Three chart divs, all using the same `makeChartOptions()` helper:
1. **Main chart** (`chartContainerRef`) — candlestick + volume + overlay indicators (SMA/EMA/BB)
2. **Sub-chart** (`subChartContainerRef`) — RSI and/or MACD; created/destroyed when `hasSubChart` changes
3. **Multi-TF chart** (`multiTfContainerRef`) — separate timeframe; created/destroyed when `showMultiTf` changes

## Sync strategy
- Sub-chart ↔ main: bidirectional `subscribeVisibleLogicalRangeChange` with `isSyncingRef` guard
- Sub-chart crosshair: `setCrosshairPosition` called inside main chart's `subscribeCrosshairMove`
- Multi-TF crosshair only (no range sync since different intervals)

## Indicator series management
`indicatorSeriesRef: Map<string, ISeriesApi | ISeriesApi[]>` — each indicator id maps to its series.
BB stores 3 series as an array. Effect diffs enabled/disabled state to add or remove series.

## Layout persistence
- Layouts saved in localStorage under `chart_layouts_v2`
- `DrawnObject` types include raw params (price, p1/p2 time+price, high/low) for serialization
- `pendingRestoreRef` queues drawing restoration until after klines reload

## OHLC floating popup
`ohlcDisplay` state stores `pxX` and `pxY` from `param.point` in `subscribeCrosshairMove`.
Popup positioned absolute within chart container, flipping left/right based on cursor half.

**Why:** Separate chart instances are more reliable than LW Charts panes for RSI/MACD sub-panels, and allow independent resize observers and scroll sync.
