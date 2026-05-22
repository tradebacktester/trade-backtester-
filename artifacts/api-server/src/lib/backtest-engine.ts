export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeResult {
  symbol: string;
  side: "long" | "short";
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
}

export interface EquityPoint {
  date: string;
  value: number;
  drawdown: number;
}

export interface BacktestResult {
  trades: TradeResult[];
  equityCurve: EquityPoint[];
  finalCapital: number;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
}

function sma(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function ema(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result[i] = null;
      continue;
    }
    if (i === period - 1) {
      prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result[i] = prev;
      continue;
    }
    prev = prices[i] * k + prev! * (1 - k);
    result[i] = prev;
  }
  return result;
}

function rsi(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period + 1) return result;
  for (let i = period; i < prices.length; i++) {
    let gains = 0;
    let losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = prices[j] - prices[j - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) { result[i] = 100; continue; }
    const rs = avgGain / avgLoss;
    result[i] = 100 - 100 / (1 + rs);
  }
  return result;
}

function generatePriceData(symbol: string, startDate: string, endDate: string): OHLCVBar[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const bars: OHLCVBar[] = [];

  const seeds: Record<string, number> = {
    AAPL: 150, MSFT: 300, TSLA: 250, NVDA: 400, AMZN: 180,
    GOOGL: 140, SPY: 420, QQQ: 350, "BTC/USD": 45000, "ETH/USD": 3000,
  };
  const volatilities: Record<string, number> = {
    AAPL: 0.018, MSFT: 0.016, TSLA: 0.04, NVDA: 0.035, AMZN: 0.022,
    GOOGL: 0.018, SPY: 0.012, QQQ: 0.015, "BTC/USD": 0.055, "ETH/USD": 0.065,
  };

  const basePrice = seeds[symbol] ?? 100;
  const vol = volatilities[symbol] ?? 0.02;

  // Seeded pseudo-random for reproducibility
  let seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  function rand(): number {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  }
  function randn(): number {
    const u = Math.max(rand(), 1e-10);
    const v = Math.max(rand(), 1e-10);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  let price = basePrice;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      const change = price * vol * randn() + price * 0.0003;
      const open = price;
      price = Math.max(open + change, open * 0.01);
      const high = Math.max(open, price) * (1 + rand() * vol * 0.5);
      const low = Math.min(open, price) * (1 - rand() * vol * 0.5);
      bars.push({
        date: cur.toISOString().split("T")[0],
        open,
        high,
        low,
        close: price,
        volume: Math.floor(rand() * 5000000 + 1000000),
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return bars;
}

function runStrategy(
  bars: OHLCVBar[],
  strategyType: string,
  parameters: Record<string, unknown>
): { entries: number[]; exits: number[]; direction: "long" | "short" }[] {
  const closes = bars.map((b) => b.close);
  const signals: { entries: number[]; exits: number[]; direction: "long" | "short" }[] = [];

  if (strategyType === "sma_crossover" || strategyType === "ema_crossover") {
    const fastPeriod = Number(parameters.fastPeriod ?? 10);
    const slowPeriod = Number(parameters.slowPeriod ?? 30);
    const fast = strategyType === "sma_crossover" ? sma(closes, fastPeriod) : ema(closes, fastPeriod);
    const slow = strategyType === "sma_crossover" ? sma(closes, slowPeriod) : ema(closes, slowPeriod);

    let inTrade = false;
    let entryIdx = -1;
    for (let i = 1; i < bars.length; i++) {
      const f = fast[i], fp = fast[i - 1];
      const s = slow[i], sp = slow[i - 1];
      if (f == null || fp == null || s == null || sp == null) continue;

      if (!inTrade && fp <= sp && f > s) {
        inTrade = true;
        entryIdx = i;
      } else if (inTrade && fp >= sp && f < s) {
        signals.push({ entries: [entryIdx], exits: [i], direction: "long" });
        inTrade = false;
        entryIdx = -1;
      }
    }
    if (inTrade && entryIdx >= 0 && entryIdx < bars.length - 1) {
      signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
    }
  } else if (strategyType === "rsi") {
    const period = Number(parameters.period ?? 14);
    const oversold = Number(parameters.oversold ?? 30);
    const overbought = Number(parameters.overbought ?? 70);
    const rsiValues = rsi(closes, period);

    let inTrade = false;
    let entryIdx = -1;
    for (let i = 1; i < bars.length; i++) {
      const r = rsiValues[i], rp = rsiValues[i - 1];
      if (r == null || rp == null) continue;
      if (!inTrade && rp <= oversold && r > oversold) {
        inTrade = true;
        entryIdx = i;
      } else if (inTrade && rp < overbought && r >= overbought) {
        signals.push({ entries: [entryIdx], exits: [i], direction: "long" });
        inTrade = false;
      }
    }
    if (inTrade && entryIdx >= 0 && entryIdx < bars.length - 1) {
      signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
    }
  } else if (strategyType === "macd") {
    const fastPeriod = Number(parameters.fastPeriod ?? 12);
    const slowPeriod = Number(parameters.slowPeriod ?? 26);
    const signalPeriod = Number(parameters.signalPeriod ?? 9);
    const fastEma = ema(closes, fastPeriod);
    const slowEma = ema(closes, slowPeriod);
    const macdLine = closes.map((_, i) => {
      const f = fastEma[i], s = slowEma[i];
      return f != null && s != null ? f - s : null;
    });
    const validMacd = macdLine.filter((v): v is number => v != null);
    const signalLine: (number | null)[] = new Array(closes.length).fill(null);
    const sigEma = ema(validMacd, signalPeriod);
    let validIdx = 0;
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] != null) {
        signalLine[i] = sigEma[validIdx++] ?? null;
      }
    }

    let inTrade = false;
    let entryIdx = -1;
    for (let i = 1; i < bars.length; i++) {
      const m = macdLine[i], mp = macdLine[i - 1];
      const s = signalLine[i], sp = signalLine[i - 1];
      if (m == null || mp == null || s == null || sp == null) continue;
      if (!inTrade && mp <= sp && m > s) {
        inTrade = true;
        entryIdx = i;
      } else if (inTrade && mp >= sp && m < s) {
        signals.push({ entries: [entryIdx], exits: [i], direction: "long" });
        inTrade = false;
      }
    }
    if (inTrade && entryIdx >= 0 && entryIdx < bars.length - 1) {
      signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
    }
  } else if (strategyType === "bollinger_bands") {
    const period = Number(parameters.period ?? 20);
    const stdDev = Number(parameters.stdDev ?? 2);
    const mid = sma(closes, period);
    const upper = closes.map((_, i) => {
      if (i < period - 1) return null;
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
      return (mid[i] ?? 0) + stdDev * Math.sqrt(variance);
    });
    const lower = closes.map((_, i) => {
      if (i < period - 1) return null;
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
      return (mid[i] ?? 0) - stdDev * Math.sqrt(variance);
    });

    let inTrade = false;
    let entryIdx = -1;
    for (let i = 1; i < bars.length; i++) {
      const lo = lower[i], lop = lower[i - 1];
      const up = upper[i];
      if (lo == null || lop == null || up == null) continue;
      if (!inTrade && closes[i - 1] <= (lop ?? 0) && closes[i] > (lo ?? 0)) {
        inTrade = true;
        entryIdx = i;
      } else if (inTrade && closes[i] >= (up ?? 0)) {
        signals.push({ entries: [entryIdx], exits: [i], direction: "long" });
        inTrade = false;
      }
    }
    if (inTrade && entryIdx >= 0 && entryIdx < bars.length - 1) {
      signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
    }
  }

  return signals;
}

export function runBacktest(
  symbol: string,
  strategyType: string,
  parameters: Record<string, unknown>,
  startDate: string,
  endDate: string,
  initialCapital: number
): BacktestResult {
  const bars = generatePriceData(symbol, startDate, endDate);
  if (bars.length < 50) {
    return {
      trades: [],
      equityCurve: [{ date: startDate, value: initialCapital, drawdown: 0 }],
      finalCapital: initialCapital,
      totalReturn: 0,
      annualizedReturn: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      winRate: 0,
      totalTrades: 0,
      profitFactor: 0,
    };
  }

  const signals = runStrategy(bars, strategyType, parameters);
  const trades: TradeResult[] = [];
  let capital = initialCapital;

  for (const sig of signals) {
    const entryBar = bars[sig.entries[0]];
    const exitBar = bars[sig.exits[0]];
    const entryPrice = entryBar.open;
    const exitPrice = exitBar.close;
    const quantity = (capital * 0.95) / entryPrice;
    const pnl = (exitPrice - entryPrice) * quantity;
    const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
    capital += pnl;
    trades.push({
      symbol,
      side: sig.direction,
      entryDate: entryBar.date,
      exitDate: exitBar.date,
      entryPrice,
      exitPrice,
      quantity,
      pnl,
      pnlPercent,
    });
  }

  // Build equity curve using daily portfolio value
  const tradeMap = new Map<string, number>();
  let runningCapital = initialCapital;
  for (const t of trades) {
    tradeMap.set(t.exitDate, (tradeMap.get(t.exitDate) ?? 0) + t.pnl);
  }

  const equityCurve: EquityPoint[] = [];
  let peakValue = initialCapital;
  for (const bar of bars) {
    const pnlOnDay = tradeMap.get(bar.date) ?? 0;
    runningCapital += pnlOnDay;
    if (runningCapital > peakValue) peakValue = runningCapital;
    const drawdown = peakValue > 0 ? ((peakValue - runningCapital) / peakValue) * 100 : 0;
    equityCurve.push({ date: bar.date, value: runningCapital, drawdown });
  }

  const finalCapital = capital;
  const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100;

  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const years = Math.max((endMs - startMs) / (365.25 * 24 * 3600 * 1000), 1 / 365);
  const annualizedReturn = (Math.pow(finalCapital / initialCapital, 1 / years) - 1) * 100;

  const maxDrawdown = Math.max(...equityCurve.map((e) => e.drawdown), 0);

  const winners = trades.filter((t) => t.pnl > 0);
  const losers = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;
  const grossProfit = winners.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((a, t) => a + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  // Sharpe ratio approximation (daily returns)
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].value;
    if (prev > 0) dailyReturns.push((equityCurve[i].value - prev) / prev);
  }
  let sharpeRatio = 0;
  if (dailyReturns.length > 1) {
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / dailyReturns.length;
    const stddev = Math.sqrt(variance);
    sharpeRatio = stddev > 0 ? (mean / stddev) * Math.sqrt(252) : 0;
  }

  return {
    trades,
    equityCurve,
    finalCapital,
    totalReturn,
    annualizedReturn,
    maxDrawdown,
    sharpeRatio,
    winRate,
    totalTrades: trades.length,
    profitFactor,
  };
}
