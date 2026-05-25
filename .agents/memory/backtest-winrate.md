---
name: Backtest winRate format
description: The backtest engine returns winRate as a percentage (0-100), not a decimal (0-1). Display it directly without multiplying by 100.
---

# Backtest winRate format

## Rule
The `runBacktest()` engine computes: `winRate = (winners / total) * 100`, returning values like `43.3` for 43.3%.

The `backtests` DB table stores and returns this exact number. Display it as `${value.toFixed(1)}%`, NOT `${(value * 100).toFixed(1)}%`.

**Why:** The engine always used `* 100` internally. The old frontend code had a bug multiplying by 100 again, showing e.g. "1666.7%" instead of "16.7%". Fixed in the detail page and backtests index page.

**How to apply:** Whenever reading `backtest.winRate` or `bt.winRate`, treat it as already in percent (0–100). No multiplication needed.
