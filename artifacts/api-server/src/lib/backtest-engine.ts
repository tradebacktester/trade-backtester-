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
  duration: number;
}

export interface EquityPoint {
  date: string;
  value: number;
  drawdown: number;
  benchmark?: number;
}

export interface MonthlyReturn {
  month: string;
  pnl: number;
  pct: number;
}

export interface YearlyReturn {
  year: string;
  pct: number;
  months: { month: string; pct: number; label: string }[];
}

export interface PositionSizing {
  mode: "fixed_fraction" | "fixed_amount" | "risk_pct";
  value?: number;
}

export interface BacktestResult {
  trades: TradeResult[];
  equityCurve: EquityPoint[];
  finalCapital: number;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number | null;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgRR: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  avgTradeDuration: number;
  bestTrade: number;
  worstTrade: number;
  monthlyReturns: MonthlyReturn[];
  yearlyReturns: YearlyReturn[];
  benchmarkReturn: number;
  commissionPct: number;
  slippagePct: number;
  expectancy: number;
  sqn: number;
  timeInMarket: number;
}

export interface WalkForwardResult {
  inSample: BacktestResult;
  outOfSample: BacktestResult;
  trainRatio: number;
  splitDate: string;
  combined: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    consistencyScore: number;
  };
}

// ── O(N) indicator implementations ────────────────────────────────────────────

/**
 * O(N) SMA using incremental running sum (replaces per-bar slice().reduce()).
 */
function sma(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period) return result;
  let windowSum = 0;
  for (let i = 0; i < period; i++) windowSum += prices[i];
  result[period - 1] = windowSum / period;
  for (let i = period; i < prices.length; i++) {
    windowSum += prices[i] - prices[i - period];
    result[i] = windowSum / period;
  }
  return result;
}

function ema(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { result[i] = null; continue; }
    if (i === period - 1) {
      prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result[i] = prev; continue;
    }
    prev = prices[i] * k + prev! * (1 - k);
    result[i] = prev;
  }
  return result;
}

function rsi(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period + 1) return result;

  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += -diff;
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Wilder's Smoothing (RMA) — matches TradingView, MetaTrader, Bloomberg
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

function atr(bars: OHLCVBar[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(bars.length).fill(null);
  if (bars.length < 2) return result;
  const tr: number[] = [bars[0].high - bars[0].low];
  for (let i = 1; i < bars.length; i++) {
    const hl = bars[i].high - bars[i].low;
    const hc = Math.abs(bars[i].high - bars[i - 1].close);
    const lc = Math.abs(bars[i].low  - bars[i - 1].close);
    tr.push(Math.max(hl, hc, lc));
  }
  let avg = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = avg;
  for (let i = period; i < bars.length; i++) { avg = (avg * (period - 1) + tr[i]) / period; result[i] = avg; }
  return result;
}

/**
 * O(N) Donchian High using monotone deque (sliding window maximum).
 * Replaces per-bar Math.max(...slice()) which is O(N×period).
 */
function donchianHigh(highs: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(highs.length).fill(null);
  const deque: number[] = []; // indices, front = index of current max
  for (let i = 0; i < highs.length; i++) {
    // Evict out-of-window indices from the front
    while (deque.length > 0 && deque[0]! < i - period + 1) deque.shift();
    // Evict indices whose highs are <= current (they can never be max in future windows)
    while (deque.length > 0 && highs[deque[deque.length - 1]!]! <= highs[i]) deque.pop();
    deque.push(i);
    if (i >= period - 1) result[i] = highs[deque[0]!]!;
  }
  return result;
}

/**
 * O(N) Donchian Low using monotone deque (sliding window minimum).
 */
function donchianLow(lows: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(lows.length).fill(null);
  const deque: number[] = []; // indices, front = index of current min
  for (let i = 0; i < lows.length; i++) {
    while (deque.length > 0 && deque[0]! < i - period + 1) deque.shift();
    while (deque.length > 0 && lows[deque[deque.length - 1]!]! >= lows[i]) deque.pop();
    deque.push(i);
    if (i >= period - 1) result[i] = lows[deque[0]!]!;
  }
  return result;
}

/**
 * O(N) Bollinger Bands using incremental running sum + sum-of-squares.
 * Computational variance formula: Var = (ΣX² - (ΣX)²/n) / (n-1)
 * Returns { upper, mid, lower } arrays.
 */
function bollingerBands(
  prices: number[],
  period: number,
  stdDevMult: number,
): { upper: (number | null)[]; mid: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = new Array(prices.length).fill(null);
  const mid: (number | null)[]   = new Array(prices.length).fill(null);
  const lower: (number | null)[] = new Array(prices.length).fill(null);

  if (prices.length < period) return { upper, mid, lower };

  let sum = 0, sumSq = 0;
  for (let i = 0; i < period; i++) {
    sum   += prices[i];
    sumSq += prices[i] * prices[i];
  }
  const computeBand = (i: number) => {
    const mean = sum / period;
    // sample variance (N-1)
    const variance = Math.max(0, (sumSq - sum * sum / period) / (period - 1));
    const sd = Math.sqrt(variance) * stdDevMult;
    mid[i]   = mean;
    upper[i] = mean + sd;
    lower[i] = mean - sd;
  };
  computeBand(period - 1);

  for (let i = period; i < prices.length; i++) {
    sum   += prices[i]     - prices[i - period];
    sumSq += prices[i] * prices[i] - prices[i - period] * prices[i - period];
    computeBand(i);
  }
  return { upper, mid, lower };
}

function vwapCalc(bars: OHLCVBar[]): number[] {
  let cumPV = 0, cumVol = 0;
  return bars.map(b => { const tp = (b.high + b.low + b.close) / 3; cumPV += tp * b.volume; cumVol += b.volume; return cumVol > 0 ? cumPV / cumVol : tp; });
}

const BARS_PER_DAY: Record<string, number> = {
  "1m": 1440, "5m": 288, "15m": 96, "30m": 48, "1h": 24, "2h": 12, "4h": 6, "1d": 1,
};

/**
 * @internal DEV/TESTING UTILITY ONLY
 * Geometric Brownian Motion price simulator. Must NOT be called from production
 * backtest routes — all supported symbols have a real data source (Binance / Yahoo Finance).
 * Only valid for sim chart symbols (category: "Futures") and as a last-resort fallback
 * in the optimizer when real data is unavailable for an unrecognized symbol.
 */
export function generatePriceData(symbol: string, startDate: string, endDate: string, timeframe = "1d"): OHLCVBar[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const bars: OHLCVBar[] = [];

  const SYMBOL_PARAMS: Record<string, { seed: number; vol: number; drift: number }> = {
    BTCUSDT:   { seed: 45000, vol: 0.055,  drift: 0.0004 },
    ETHUSDT:   { seed: 3000,  vol: 0.065,  drift: 0.0004 },
    SOLUSDT:   { seed: 120,   vol: 0.080,  drift: 0.0005 },
    BNBUSDT:   { seed: 400,   vol: 0.060,  drift: 0.0003 },
    XRPUSDT:   { seed: 0.7,   vol: 0.070,  drift: 0.0002 },
    ADAUSDT:   { seed: 0.5,   vol: 0.070,  drift: 0.0002 },
    DOGEUSDT:  { seed: 0.12,  vol: 0.090,  drift: 0.0001 },
    AVAXUSDT:  { seed: 35,    vol: 0.080,  drift: 0.0003 },
    DOTUSDT:   { seed: 8,     vol: 0.080,  drift: 0.0002 },
    LINKUSDT:  { seed: 15,    vol: 0.070,  drift: 0.0003 },
    MATICUSDT: { seed: 0.9,   vol: 0.090,  drift: 0.0003 },
    UNIUSDT:   { seed: 6,     vol: 0.085,  drift: 0.0002 },
    ATOMUSDT:  { seed: 12,    vol: 0.080,  drift: 0.0002 },
    "BTC/USD": { seed: 45000, vol: 0.055,  drift: 0.0004 },
    "ETH/USD": { seed: 3000,  vol: 0.065,  drift: 0.0004 },
    AAPL:  { seed: 185,  vol: 0.018, drift: 0.0003 },
    MSFT:  { seed: 375,  vol: 0.016, drift: 0.0003 },
    NVDA:  { seed: 500,  vol: 0.035, drift: 0.0006 },
    GOOGL: { seed: 155,  vol: 0.018, drift: 0.0003 },
    AMZN:  { seed: 180,  vol: 0.022, drift: 0.0003 },
    META:  { seed: 350,  vol: 0.025, drift: 0.0004 },
    AMD:   { seed: 165,  vol: 0.038, drift: 0.0004 },
    INTC:  { seed: 40,   vol: 0.022, drift: 0.0001 },
    ORCL:  { seed: 110,  vol: 0.020, drift: 0.0002 },
    CRM:   { seed: 230,  vol: 0.025, drift: 0.0003 },
    AAVEUSDT: { seed: 90,   vol: 0.090, drift: 0.0003 },
    TSLA:  { seed: 250,  vol: 0.040, drift: 0.0003 },
    NFLX:  { seed: 450,  vol: 0.028, drift: 0.0003 },
    PYPL:  { seed: 75,   vol: 0.030, drift: 0.0001 },
    SQ:    { seed: 70,   vol: 0.040, drift: 0.0002 },
    JPM:   { seed: 185,  vol: 0.018, drift: 0.0003 },
    BAC:   { seed: 38,   vol: 0.022, drift: 0.0002 },
    GS:    { seed: 380,  vol: 0.022, drift: 0.0003 },
    V:     { seed: 240,  vol: 0.014, drift: 0.0003 },
    MA:    { seed: 420,  vol: 0.015, drift: 0.0003 },
    DIS:   { seed: 95,   vol: 0.022, drift: 0.0002 },
    BA:    { seed: 210,  vol: 0.030, drift: 0.0002 },
    GE:    { seed: 110,  vol: 0.025, drift: 0.0002 },
    XOM:   { seed: 105,  vol: 0.020, drift: 0.0002 },
    WMT:   { seed: 160,  vol: 0.012, drift: 0.0002 },
    KO:    { seed: 60,   vol: 0.010, drift: 0.0002 },
    SPY:     { seed: 450,   vol: 0.012, drift: 0.0003 },
    QQQ:     { seed: 380,   vol: 0.015, drift: 0.0003 },
    IWM:     { seed: 195,   vol: 0.016, drift: 0.0002 },
    DIA:     { seed: 350,   vol: 0.011, drift: 0.0003 },
    DAX:     { seed: 16500, vol: 0.014, drift: 0.0003 },
    FTSE:    { seed: 7600,  vol: 0.012, drift: 0.0002 },
    NIKKEI:  { seed: 33000, vol: 0.013, drift: 0.0002 },
    HANGSENG:{ seed: 17000, vol: 0.016, drift: 0.0001 },
    ASX200:  { seed: 7500,  vol: 0.012, drift: 0.0002 },
    CAC40:   { seed: 7500,  vol: 0.013, drift: 0.0002 },
    GLD:     { seed: 185,  vol: 0.010, drift: 0.0001 },
    SLV:     { seed: 22,   vol: 0.018, drift: 0.0001 },
    XAUUSD:  { seed: 2000, vol: 0.010, drift: 0.0001 },
    XAGUSD:  { seed: 24,   vol: 0.018, drift: 0.0001 },
    COPPER:  { seed: 3.8,  vol: 0.018, drift: 0.0001 },
    WTIUSD:  { seed: 78,   vol: 0.025, drift: 0.0001 },
    BRENTUSD:{ seed: 82,   vol: 0.024, drift: 0.0001 },
    NATGASUSD:{ seed: 2.5, vol: 0.040, drift: -0.0001 },
    WHEAT:    { seed: 550,  vol: 0.022, drift: 0.0001 },
    CORN:     { seed: 450,  vol: 0.020, drift: 0.0001 },
    EURUSD:  { seed: 1.08, vol: 0.006, drift: 0.0 },
    GBPUSD:  { seed: 1.26, vol: 0.007, drift: 0.0 },
    USDJPY:  { seed: 148,  vol: 0.005, drift: 0.0001 },
    AUDUSD:  { seed: 0.65, vol: 0.007, drift: 0.0 },
    USDCAD:  { seed: 1.36, vol: 0.005, drift: 0.0 },
    USDCHF:  { seed: 0.88, vol: 0.005, drift: -0.0001 },
    NZDUSD:  { seed: 0.61, vol: 0.007, drift: 0.0 },
    TLT:  { seed: 95,  vol: 0.009, drift: 0.0001 },
    VIX:  { seed: 18,  vol: 0.050, drift: -0.0002 },
  };

  const params = SYMBOL_PARAMS[symbol];
  const basePrice = params?.seed ?? 100;
  const vol = params?.vol ?? 0.020;
  const drift = params?.drift ?? 0.0003;

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

  const barsPerDay = BARS_PER_DAY[timeframe] ?? 1;
  const perBarVol = barsPerDay > 1 ? vol / Math.sqrt(barsPerDay) : vol;
  const perBarDrift = barsPerDay > 1 ? drift / barsPerDay : drift;

  let price = basePrice;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      const dateStr = cur.toISOString().split("T")[0];
      if (barsPerDay === 1) {
        const change = price * perBarVol * randn() + price * perBarDrift;
        const open = price;
        price = Math.max(open + change, open * 0.01);
        const high = Math.max(open, price) * (1 + rand() * perBarVol * 0.5);
        const low = Math.min(open, price) * (1 - rand() * perBarVol * 0.5);
        bars.push({
          date: dateStr,
          open, high, low, close: price,
          volume: Math.floor(rand() * 5000000 + 1000000),
        });
      } else {
        const minutesPerBar = Math.round(24 * 60 / barsPerDay);
        for (let b = 0; b < barsPerDay; b++) {
          const totalMinutes = b * minutesPerBar;
          const hour = Math.floor(totalMinutes / 60);
          const minute = totalMinutes % 60;
          const timestamp = `${dateStr} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
          const change = price * perBarVol * randn() + price * perBarDrift;
          const open = price;
          price = Math.max(open + change, open * 0.01);
          const high = Math.max(open, price) * (1 + rand() * perBarVol * 0.3);
          const low = Math.min(open, price) * (1 - rand() * perBarVol * 0.3);
          bars.push({
            date: timestamp,
            open, high, low, close: price,
            volume: Math.floor(rand() * 500000 + 100000),
          });
        }
      }
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
    if (fastPeriod >= slowPeriod) {
      throw new Error(`Invalid parameters: fastPeriod (${fastPeriod}) must be less than slowPeriod (${slowPeriod})`);
    }
    const fast = strategyType === "sma_crossover" ? sma(closes, fastPeriod) : ema(closes, fastPeriod);
    const slow = strategyType === "sma_crossover" ? sma(closes, slowPeriod) : ema(closes, slowPeriod);
    let inTrade = false, entryIdx = -1;
    for (let i = 1; i < bars.length; i++) {
      const f = fast[i], fp = fast[i-1], s = slow[i], sp = slow[i-1];
      if (f == null || fp == null || s == null || sp == null) continue;
      if (!inTrade && fp <= sp && f > s && i + 1 < bars.length) { inTrade = true; entryIdx = i + 1; }
      else if (inTrade && fp >= sp && f < s) { signals.push({ entries: [entryIdx], exits: [i + 1 < bars.length ? i + 1 : i], direction: "long" }); inTrade = false; entryIdx = -1; }
    }
    if (inTrade && entryIdx >= 0 && entryIdx < bars.length)
      signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
  } else if (strategyType === "rsi") {
    const period = Number(parameters.period ?? 14);
    const oversold = Number(parameters.oversold ?? 30);
    const overbought = Number(parameters.overbought ?? 70);
    if (oversold >= overbought) {
      throw new Error(`Invalid RSI parameters: oversold (${oversold}) must be less than overbought (${overbought})`);
    }
    const rsiValues = rsi(closes, period);
    let inTrade = false, entryIdx = -1;
    for (let i = 1; i < bars.length; i++) {
      const r = rsiValues[i], rp = rsiValues[i-1];
      if (r == null || rp == null) continue;
      if (!inTrade && rp <= oversold && r > oversold && i + 1 < bars.length) { inTrade = true; entryIdx = i + 1; }
      else if (inTrade && rp < overbought && r >= overbought) { signals.push({ entries: [entryIdx], exits: [i + 1 < bars.length ? i + 1 : i], direction: "long" }); inTrade = false; }
    }
    if (inTrade && entryIdx >= 0 && entryIdx < bars.length)
      signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
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
      if (macdLine[i] != null) signalLine[i] = sigEma[validIdx++] ?? null;
    }
    let inTrade = false, entryIdx = -1;
    for (let i = 1; i < bars.length; i++) {
      const m = macdLine[i], mp = macdLine[i-1], s = signalLine[i], sp = signalLine[i-1];
      if (m == null || mp == null || s == null || sp == null) continue;
      if (!inTrade && mp <= sp && m > s && i + 1 < bars.length) { inTrade = true; entryIdx = i + 1; }
      else if (inTrade && mp >= sp && m < s) { signals.push({ entries: [entryIdx], exits: [i + 1 < bars.length ? i + 1 : i], direction: "long" }); inTrade = false; }
    }
    if (inTrade && entryIdx >= 0 && entryIdx < bars.length)
      signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
  } else if (strategyType === "bollinger_bands") {
    const period = Number(parameters.period ?? 20);
    const stdDev = Number(parameters.stdDev ?? 2);
    if (stdDev < 0.1) {
      throw new Error(`Invalid Bollinger Bands parameters: stdDev (${stdDev}) must be at least 0.1`);
    }
    const { upper, lower } = bollingerBands(closes, period, stdDev);
    let inTrade = false, entryIdx = -1;
    for (let i = 1; i < bars.length; i++) {
      const lo = lower[i], lop = lower[i-1], up = upper[i];
      if (lo == null || lop == null || up == null) continue;
      if (!inTrade && closes[i-1] <= (lop ?? 0) && closes[i] > (lo ?? 0) && i + 1 < bars.length) { inTrade = true; entryIdx = i + 1; }
      else if (inTrade && closes[i] >= (up ?? 0)) { signals.push({ entries: [entryIdx], exits: [i + 1 < bars.length ? i + 1 : i], direction: "long" }); inTrade = false; }
    }
    if (inTrade && entryIdx >= 0 && entryIdx < bars.length)
      signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
  } else if (strategyType === "super_trend") {
    const period = Number(parameters.period ?? 10);
    const multiplier = Number(parameters.multiplier ?? 3);
    const atrVals = atr(bars, period);
    const highs = bars.map(b => b.high);
    const lows  = bars.map(b => b.low);
    let prevST = 0, isBull = false, inTrade = false, entryIdx = -1;
    for (let i = period; i < bars.length; i++) {
      const a = atrVals[i];
      if (a == null) continue;
      const basic = (highs[i] + lows[i]) / 2;
      const upper = basic + multiplier * a;
      const lower = basic - multiplier * a;
      const wasBull: boolean = isBull;
      if (closes[i] > upper) { isBull = true; prevST = lower; }
      else if (closes[i] < lower) { isBull = false; prevST = upper; }
      else { isBull = wasBull; prevST = isBull ? Math.max(lower, prevST) : Math.min(upper, prevST); }
      if (!wasBull && isBull && !inTrade && i + 1 < bars.length) { inTrade = true; entryIdx = i + 1; }
      if (wasBull && !isBull && inTrade) { signals.push({ entries: [entryIdx], exits: [i + 1 < bars.length ? i + 1 : i], direction: "long" }); inTrade = false; entryIdx = -1; }
    }
    if (inTrade && entryIdx >= 0) signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
  } else if (strategyType === "breakout" || strategyType === "donchian_breakout" || strategyType === "turtle_trading") {
    const entryP = Number(parameters.entryPeriod ?? parameters.period ?? 20);
    const exitP  = Number(parameters.exitPeriod  ?? Math.max(5, Math.round(entryP / 2)));
    const highs = bars.map(b => b.high);
    const lows  = bars.map(b => b.low);
    const dhigh = donchianHigh(highs, entryP);
    const dlow  = donchianLow(lows, exitP);
    let inTrade = false, entryIdx = -1;
    for (let i = entryP; i < bars.length; i++) {
      const dh = dhigh[i - 1];
      const dl = dlow[i];
      if (dh == null || dl == null) continue;
      if (!inTrade && closes[i] > dh && i + 1 < bars.length) { inTrade = true; entryIdx = i + 1; }
      else if (inTrade && closes[i] < dl) { signals.push({ entries: [entryIdx], exits: [i + 1 < bars.length ? i + 1 : i], direction: "long" }); inTrade = false; entryIdx = -1; }
    }
    if (inTrade && entryIdx >= 0) signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
  } else if (strategyType === "vwap") {
    const rsiPeriod = Number(parameters.rsiPeriod ?? 14);
    const oversold  = Number(parameters.oversold  ?? 40);
    const vwapLine  = vwapCalc(bars);
    const rsiVals   = rsi(closes, rsiPeriod);
    let inTrade = false, entryIdx = -1;
    for (let i = 1; i < bars.length; i++) {
      const rv = rsiVals[i];
      if (rv == null) continue;
      if (!inTrade && closes[i - 1] <= vwapLine[i - 1] && closes[i] > vwapLine[i] && rv < oversold + 20 && i + 1 < bars.length) { inTrade = true; entryIdx = i + 1; }
      else if (inTrade && closes[i] < vwapLine[i] * 0.99) { signals.push({ entries: [entryIdx], exits: [i + 1 < bars.length ? i + 1 : i], direction: "long" }); inTrade = false; entryIdx = -1; }
    }
    if (inTrade && entryIdx >= 0) signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
  } else if (strategyType === "macd_rsi") {
    const fastP   = Number(parameters.fastPeriod   ?? 12);
    const slowP   = Number(parameters.slowPeriod   ?? 26);
    const signalP = Number(parameters.signalPeriod ?? 9);
    const rsiP    = Number(parameters.rsiPeriod    ?? 14);
    const rsiOB   = Number(parameters.rsiOverbought ?? 70);
    const fastEmaV = ema(closes, fastP);
    const slowEmaV = ema(closes, slowP);
    const macdLine = closes.map((_, i) => { const f = fastEmaV[i], s = slowEmaV[i]; return f != null && s != null ? f - s : null; });
    const validMacd = macdLine.filter((v): v is number => v != null);
    const signalLine: (number | null)[] = new Array(closes.length).fill(null);
    const sigEma2 = ema(validMacd, signalP);
    let vi = 0; for (let i = 0; i < macdLine.length; i++) { if (macdLine[i] != null) signalLine[i] = sigEma2[vi++] ?? null; }
    const rsiVals = rsi(closes, rsiP);
    let inTrade = false, entryIdx = -1;
    for (let i = 1; i < bars.length; i++) {
      const m = macdLine[i], mp = macdLine[i - 1], s = signalLine[i], sp = signalLine[i - 1], rv = rsiVals[i];
      if (m == null || mp == null || s == null || sp == null || rv == null) continue;
      if (!inTrade && mp <= sp && m > s && rv < rsiOB && i + 1 < bars.length) { inTrade = true; entryIdx = i + 1; }
      else if (inTrade && mp >= sp && m < s) { signals.push({ entries: [entryIdx], exits: [i + 1 < bars.length ? i + 1 : i], direction: "long" }); inTrade = false; entryIdx = -1; }
    }
    if (inTrade && entryIdx >= 0) signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
  } else if (strategyType === "bollinger_reversal") {
    const period = Number(parameters.period ?? 20);
    const stdDev = Number(parameters.stdDev ?? 2);
    const { mid: midBB, lower: lowerBB } = bollingerBands(closes, period, stdDev);
    let inTrade = false, entryIdx = -1;
    for (let i = 1; i < bars.length; i++) {
      const lo = lowerBB[i], m = midBB[i];
      if (lo == null || m == null) continue;
      if (!inTrade && closes[i] <= lo && i + 1 < bars.length) { inTrade = true; entryIdx = i + 1; }
      else if (inTrade && closes[i] >= m) { signals.push({ entries: [entryIdx], exits: [i + 1 < bars.length ? i + 1 : i], direction: "long" }); inTrade = false; entryIdx = -1; }
    }
    if (inTrade && entryIdx >= 0) signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
  } else if (strategyType === "orb") {
    const rangePeriod = Number(parameters.rangePeriod ?? 5);
    const holdDays    = Number(parameters.holdDays    ?? 10);
    const highs = bars.map(b => b.high);
    const lows  = bars.map(b => b.low);
    const dhigh = donchianHigh(highs, rangePeriod);
    const dlow  = donchianLow(lows, rangePeriod);
    let inTrade = false, entryIdx = -1, holdCount = 0;
    for (let i = rangePeriod; i < bars.length; i++) {
      const rHigh = dhigh[i - 1];
      const rLow  = dlow[i - 1];
      if (rHigh == null || rLow == null) continue;
      if (!inTrade && closes[i] > rHigh && i + 1 < bars.length) { inTrade = true; entryIdx = i + 1; holdCount = 0; }
      if (inTrade) {
        holdCount++;
        if (holdCount >= holdDays || closes[i] < rLow) { signals.push({ entries: [entryIdx], exits: [i + 1 < bars.length ? i + 1 : i], direction: "long" }); inTrade = false; entryIdx = -1; }
      }
    }
    if (inTrade && entryIdx >= 0) signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
  } else if (strategyType === "trend_following") {
    const fastEmaP  = Number(parameters.fastEma   ?? 50);
    const slowEmaP  = Number(parameters.slowEma   ?? 200);
    const rsiPeriod = Number(parameters.rsiPeriod ?? 14);
    const fastE = ema(closes, fastEmaP);
    const slowE = ema(closes, slowEmaP);
    const rsiVals = rsi(closes, rsiPeriod);
    let inTrade = false, entryIdx = -1;
    for (let i = 1; i < bars.length; i++) {
      const fe = fastE[i], fep = fastE[i - 1], se = slowE[i], sep = slowE[i - 1], rv = rsiVals[i];
      if (fe == null || fep == null || se == null || sep == null || rv == null) continue;
      if (!inTrade && fep <= sep && fe > se && rv > 50 && i + 1 < bars.length) { inTrade = true; entryIdx = i + 1; }
      else if (inTrade && fep >= sep && fe < se) { signals.push({ entries: [entryIdx], exits: [i + 1 < bars.length ? i + 1 : i], direction: "long" }); inTrade = false; entryIdx = -1; }
    }
    if (inTrade && entryIdx >= 0) signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
  } else if (strategyType === "golden_cross") {
    const fastP = Number(parameters.fastPeriod ?? 50);
    const slowP = Number(parameters.slowPeriod ?? 200);
    const fast2 = sma(closes, fastP);
    const slow2 = sma(closes, slowP);
    let inTrade = false, entryIdx = -1;
    for (let i = 1; i < bars.length; i++) {
      const f = fast2[i], fp = fast2[i - 1], s = slow2[i], sp = slow2[i - 1];
      if (f == null || fp == null || s == null || sp == null) continue;
      if (!inTrade && fp <= sp && f > s && i + 1 < bars.length) { inTrade = true; entryIdx = i + 1; }
      else if (inTrade && fp >= sp && f < s) { signals.push({ entries: [entryIdx], exits: [i + 1 < bars.length ? i + 1 : i], direction: "long" }); inTrade = false; entryIdx = -1; }
    }
    if (inTrade && entryIdx >= 0) signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
  }

  return signals;
}

function daysBetween(d1: string, d2: string): number {
  return Math.abs((new Date(d2).getTime() - new Date(d1).getTime()) / (1000 * 60 * 60 * 24));
}

function monthKey(dateStr: string): string { return dateStr.slice(0, 7); }
function yearKey(dateStr: string): string { return dateStr.slice(0, 4); }

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function runBacktest(
  symbol: string,
  strategyType: string,
  parameters: Record<string, unknown>,
  startDate: string,
  endDate: string,
  initialCapital: number,
  commissionPct = 0,
  slippagePct = 0,
  priceData?: OHLCVBar[],
  timeframe = "1d",
  positionSizing?: PositionSizing,
  stopLossPct = 0,
  takeProfitPct = 0
): BacktestResult {
  if (!priceData || priceData.length < 20) {
    throw new Error(
      `Insufficient price data for ${symbol}: ${priceData?.length ?? 0} bars available (minimum 20 required). ` +
      `Ensure real market data is fetched before calling runBacktest.`
    );
  }
  const bars = priceData;
  const empty: BacktestResult = {
    trades: [], equityCurve: [{ date: startDate, value: initialCapital, drawdown: 0, benchmark: initialCapital }],
    finalCapital: initialCapital, totalReturn: 0, annualizedReturn: 0, maxDrawdown: 0,
    sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, winRate: 0, totalTrades: 0,
    profitFactor: 0, avgWin: 0, avgLoss: 0, avgRR: 0, consecutiveWins: 0, consecutiveLosses: 0,
    avgTradeDuration: 0, bestTrade: 0, worstTrade: 0, monthlyReturns: [], yearlyReturns: [],
    benchmarkReturn: 0, commissionPct, slippagePct, expectancy: 0, sqn: 0, timeInMarket: 0,
  };
  if (bars.length < 50) return empty;

  // Benchmark: buy & hold
  const benchmarkFirstPrice = bars[0].open;
  const benchmarkLastPrice = bars[bars.length - 1].close;
  const benchmarkReturn = ((benchmarkLastPrice - benchmarkFirstPrice) / benchmarkFirstPrice) * 100;
  const benchmarkQty = (initialCapital * 0.95) / benchmarkFirstPrice;

  // Build benchmark value map once — O(N)
  const benchmarkValues = new Map<string, number>(
    bars.map(bar => [
      bar.date,
      benchmarkFirstPrice > 0
        ? initialCapital * 0.05 + benchmarkQty * bar.close
        : initialCapital,
    ])
  );

  const signals = runStrategy(bars, strategyType, parameters);
  const trades: TradeResult[] = [];
  const tradeExitBarIdxes: number[] = [];
  let capital = initialCapital;

  for (const sig of signals) {
    const entryBarIdx = sig.entries[0];
    const entryBar = bars[entryBarIdx];
    const isShort = sig.direction === "short";

    // Apply slippage: adverse fill on entry
    const entryPrice = isShort
      ? entryBar.open * (1 - slippagePct / 100)
      : entryBar.open * (1 + slippagePct / 100);

    // ── Intrabar Stop-Loss / Take-Profit ──────────────────────────────────
    const stopPrice = stopLossPct > 0
      ? (isShort ? entryPrice * (1 + stopLossPct / 100) : entryPrice * (1 - stopLossPct / 100))
      : null;
    const targetPrice = takeProfitPct > 0
      ? (isShort ? entryPrice * (1 - takeProfitPct / 100) : entryPrice * (1 + takeProfitPct / 100))
      : null;

    let actualExitBarIdx = sig.exits[0];
    let overrideExitPrice: number | null = null; // set only when SL/TP triggered

    if (stopPrice !== null || targetPrice !== null) {
      for (let bi = entryBarIdx + 1; bi <= sig.exits[0]; bi++) {
        const b = bars[bi];
        // Check SL first (conservative — worst case intrabar sequence)
        if (stopPrice !== null) {
          const slHit = isShort ? b.high >= stopPrice : b.low <= stopPrice;
          if (slHit) { actualExitBarIdx = bi; overrideExitPrice = stopPrice; break; }
        }
        if (targetPrice !== null) {
          const tpHit = isShort ? b.low <= targetPrice : b.high >= targetPrice;
          if (tpHit) { actualExitBarIdx = bi; overrideExitPrice = targetPrice; break; }
        }
      }
    }

    const actualExitBar = bars[actualExitBarIdx];
    // SL/TP exits fill at the exact level; signal exits fill at next-bar-open with slippage
    const exitPrice = overrideExitPrice !== null
      ? overrideExitPrice
      : (isShort
          ? actualExitBar.open * (1 + slippagePct / 100)
          : actualExitBar.open * (1 - slippagePct / 100));

    let quantity: number;
    if (positionSizing?.mode === "fixed_amount") {
      const amt = Math.min(positionSizing.value ?? capital * 0.95, capital * 0.99);
      quantity = amt / Math.abs(entryPrice);
    } else if (positionSizing?.mode === "risk_pct") {
      quantity = (capital * ((positionSizing.value ?? 1) / 100)) / Math.abs(entryPrice);
    } else {
      quantity = (capital * 0.95) / Math.abs(entryPrice);
    }

    const commissionCost = quantity * (Math.abs(entryPrice) + Math.abs(exitPrice)) * (commissionPct / 100);
    const rawPnl = isShort
      ? (entryPrice - exitPrice) * quantity
      : (exitPrice - entryPrice) * quantity;
    const pnl = rawPnl - commissionCost;
    const pnlPercent = isShort
      ? ((entryPrice - exitPrice) / entryPrice) * 100 - (commissionPct * 2)
      : ((exitPrice - entryPrice) / entryPrice) * 100 - (commissionPct * 2);
    const duration = daysBetween(entryBar.date, actualExitBar.date);

    capital += pnl;
    tradeExitBarIdxes.push(actualExitBarIdx);
    trades.push({
      symbol, side: sig.direction,
      entryDate: entryBar.date, exitDate: actualExitBar.date,
      entryPrice, exitPrice, quantity, pnl, pnlPercent, duration,
    });
  }

  // ── O(N+M) equity curve ────────────────────────────────────────────────────
  // Use a sorted trade pointer instead of O(N×M) double loop.
  // For each bar: equity = initialCapital + settledPnl + sum(unrealized MtM on open trades)
  // Trades are ordered by entry bar index (same order as signals).
  const equityCurve: EquityPoint[] = [];
  let peakValue = initialCapital;
  let maxDrawdown = 0;

  let settledPnl = 0;
  let openStart = 0; // index of first trade that might still be open or ahead
  const openTrades: Array<{ trade: TradeResult; entryBarIdx: number; exitBarIdx: number }> = [];

  // Pre-sort trades by entry bar index (they are already in signal order, which is entry order)
  const signalMeta = signals.map((sig, i) => ({
    trade: trades[i],
    entryBarIdx: sig.entries[0],
    exitBarIdx: tradeExitBarIdxes[i] ?? sig.exits[0],
  }));

  let sigPtr = 0; // next signal to consider opening

  for (let bi = 0; bi < bars.length; bi++) {
    const bar = bars[bi];

    // Open trades whose entry bar has been reached
    while (sigPtr < signalMeta.length && signalMeta[sigPtr].entryBarIdx <= bi) {
      openTrades.push(signalMeta[sigPtr]);
      sigPtr++;
    }

    // Settle trades that have exited at or before this bar, accumulate settled PnL
    // We iterate from the front since trades exit in order (non-overlapping for single-position strategies)
    let j = 0;
    while (j < openTrades.length) {
      if (openTrades[j].exitBarIdx <= bi) {
        settledPnl += openTrades[j].trade.pnl;
        openTrades.splice(j, 1);
      } else {
        j++;
      }
    }

    // Compute equity as settled + unrealized mark-to-market
    let equity = initialCapital + settledPnl;
    let worstEquity = initialCapital + settledPnl;
    for (const { trade, entryBarIdx, exitBarIdx } of openTrades) {
      if (bi >= entryBarIdx && bi < exitBarIdx) {
        const unrealized = trade.side === "short"
          ? (trade.entryPrice - bar.close) * trade.quantity
          : (bar.close - trade.entryPrice) * trade.quantity;
        equity += unrealized;
        const unrealizedWorst = trade.side === "short"
          ? (trade.entryPrice - bar.high) * trade.quantity
          : (bar.low - trade.entryPrice) * trade.quantity;
        worstEquity += unrealizedWorst;
      }
    }

    if (equity > peakValue) peakValue = equity;
    const drawdown = peakValue > 0 ? ((peakValue - equity) / peakValue) * 100 : 0;
    const worstDrawdown = peakValue > 0 ? ((peakValue - worstEquity) / peakValue) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, worstDrawdown, 0);

    equityCurve.push({
      date: bar.date,
      value: Math.max(equity, 0),
      drawdown,
      benchmark: benchmarkValues.get(bar.date) ?? initialCapital,
    });
  }

  const finalCapital = capital;
  const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100;
  const barsPerDay = BARS_PER_DAY[timeframe] ?? 1;
  const actualTradingDays = bars.length / barsPerDay;
  const years = Math.max(actualTradingDays / 252, 1 / 252);
  const ratio = initialCapital > 0 ? finalCapital / initialCapital : 0;
  let annualizedReturn: number;
  if (ratio <= 0) {
    annualizedReturn = -100;
  } else {
    const raw = (Math.pow(ratio, 1 / years) - 1) * 100;
    annualizedReturn = isFinite(raw) ? raw : -100;
  }

  const winners = trades.filter((t) => t.pnl > 0);
  const losers = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;
  const grossProfit = winners.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((a, t) => a + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  const avgWin = winners.length > 0 ? winners.reduce((a, t) => a + t.pnlPercent, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((a, t) => a + t.pnlPercent, 0) / losers.length) : 0;
  const avgRR = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 999 : 0;

  let maxConsWins = 0, maxConsLosses = 0, curWins = 0, curLosses = 0;
  for (const t of trades) {
    if (t.pnl > 0) { curWins++; curLosses = 0; maxConsWins = Math.max(maxConsWins, curWins); }
    else { curLosses++; curWins = 0; maxConsLosses = Math.max(maxConsLosses, curLosses); }
  }

  const avgTradeDuration = trades.length > 0 ? trades.reduce((a, t) => a + t.duration, 0) / trades.length : 0;
  const pnlPcts = trades.map((t) => t.pnlPercent);
  const bestTrade = pnlPcts.length > 0 ? Math.max(...pnlPcts) : 0;
  const worstTrade = pnlPcts.length > 0 ? Math.min(...pnlPcts) : 0;

  // Monthly returns
  const monthlyMap = new Map<string, number>();
  for (const t of trades) {
    const m = monthKey(t.exitDate);
    monthlyMap.set(m, (monthlyMap.get(m) ?? 0) + t.pnl);
  }
  const monthStartEquity = new Map<string, number>();
  for (const point of equityCurve) {
    const m = monthKey(point.date);
    if (!monthStartEquity.has(m)) monthStartEquity.set(m, point.value);
  }
  const monthlyReturns: MonthlyReturn[] = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, pnl]) => {
      const base = monthStartEquity.get(month) ?? initialCapital;
      return { month, pnl, pct: base > 0 ? (pnl / base) * 100 : 0 };
    });

  const yearlyMap = new Map<string, Map<string, number>>();
  for (const { month, pct } of monthlyReturns) {
    const y = yearKey(month);
    if (!yearlyMap.has(y)) yearlyMap.set(y, new Map());
    yearlyMap.get(y)!.set(month, pct);
  }
  const yearlyReturns: YearlyReturn[] = Array.from(yearlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yr, mMap]) => {
      const months = Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, "0");
        const key = `${yr}-${m}`;
        return { month: key, pct: mMap.get(key) ?? 0, label: MONTH_LABELS[i] };
      });
      const total = months.reduce((s, m) => s + m.pct, 0);
      return { year: yr, pct: total, months };
    });

  // Sharpe ratio
  const RF_DAILY = 0.04 / 252;
  const allDailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].value;
    if (prev > 0) allDailyReturns.push((equityCurve[i].value - prev) / prev);
  }
  let sharpeRatio = 0, sortinoRatio = 0;
  const nDays = allDailyReturns.length;
  if (nDays > 1) {
    const excessReturns = allDailyReturns.map(r => r - RF_DAILY);
    const meanExcess = excessReturns.reduce((a, b) => a + b, 0) / nDays;
    const variance = excessReturns.reduce((a, b) => a + (b - meanExcess) ** 2, 0) / (nDays - 1);
    const stddev = Math.sqrt(variance);
    sharpeRatio = stddev > 0 ? (meanExcess / stddev) * Math.sqrt(252) : 0;

    const negExcess = excessReturns.filter(r => r < 0);
    if (negExcess.length > 0) {
      const downsideVariance = negExcess.reduce((a, r) => a + r * r, 0) / nDays;
      const downsideStd = Math.sqrt(downsideVariance);
      sortinoRatio = downsideStd > 0 ? (meanExcess / downsideStd) * Math.sqrt(252) : 0;
    }
  }

  const calmarRatio: number | null = maxDrawdown > 0
    ? annualizedReturn / maxDrawdown
    : annualizedReturn > 0 ? null : 0;

  const expectancy = trades.length > 0
    ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length
    : 0;

  let sqn = 0;
  if (trades.length >= 2) {
    const pnls = trades.map(t => t.pnl);
    const meanPnl = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    const stdPnl = Math.sqrt(pnls.reduce((a, v) => a + (v - meanPnl) ** 2, 0) / (pnls.length - 1));
    sqn = stdPnl > 0 ? (Math.sqrt(pnls.length) * meanPnl) / stdPnl : 0;
  }

  // Time in market
  const barsInMarket = new Set<number>();
  for (let si = 0; si < signals.length; si++) {
    const entryIdx = signals[si].entries[0];
    const exitIdx  = signals[si].exits[0];
    for (let bi = entryIdx; bi <= exitIdx && bi < bars.length; bi++) barsInMarket.add(bi);
  }
  const timeInMarket = bars.length > 0 ? (barsInMarket.size / bars.length) * 100 : 0;

  return {
    trades, equityCurve, finalCapital, totalReturn, annualizedReturn, maxDrawdown,
    sharpeRatio, sortinoRatio, calmarRatio, winRate, totalTrades: trades.length,
    profitFactor, avgWin, avgLoss, avgRR, consecutiveWins: maxConsWins, consecutiveLosses: maxConsLosses,
    avgTradeDuration, bestTrade, worstTrade, monthlyReturns, yearlyReturns,
    benchmarkReturn, commissionPct, slippagePct, expectancy, sqn, timeInMarket,
  };
}

// ── Multi-asset / Portfolio backtest ─────────────────────────────────────────

export interface MultiAssetSymbolResult {
  symbol: string;
  dataSource: "yahoo" | "binance_rest" | "generated";
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  finalCapital: number;
  trades: TradeResult[];
  equityCurve: EquityPoint[];
}

export interface PortfolioBacktestResult {
  symbols: string[];
  results: MultiAssetSymbolResult[];
  portfolio: {
    totalReturn: number;
    annualizedReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    totalTrades: number;
    finalCapital: number;
    initialCapital: number;
    bestSymbol: string;
    worstSymbol: string;
    equityCurve: EquityPoint[];
    allocationPct: number;
  };
}

export function runMultiAssetBacktest(
  symbols: string[],
  strategyType: string,
  parameters: Record<string, unknown>,
  startDate: string,
  endDate: string,
  initialCapital: number,
  commissionPct = 0,
  slippagePct = 0,
  priceDataMap: Record<string, OHLCVBar[]> = {},
): PortfolioBacktestResult {
  const perSymbolCapital = initialCapital / symbols.length;
  const results: MultiAssetSymbolResult[] = [];

  for (const symbol of symbols) {
    const bars = priceDataMap[symbol] ?? [];
    if (bars.length < 50) {
      results.push({
        symbol,
        dataSource: "generated",
        totalReturn: 0, annualizedReturn: 0, maxDrawdown: 0, sharpeRatio: 0,
        winRate: 0, totalTrades: 0, profitFactor: 0,
        finalCapital: perSymbolCapital, trades: [],
        equityCurve: [{ date: startDate, value: perSymbolCapital, drawdown: 0 }],
      });
      continue;
    }

    let result: BacktestResult;
    try {
      result = runBacktest(symbol, strategyType, parameters, startDate, endDate, perSymbolCapital, commissionPct, slippagePct, bars);
    } catch {
      results.push({
        symbol,
        dataSource: priceDataMap[symbol] ? "yahoo" : "generated",
        totalReturn: 0, annualizedReturn: 0, maxDrawdown: 0, sharpeRatio: 0,
        winRate: 0, totalTrades: 0, profitFactor: 0,
        finalCapital: perSymbolCapital, trades: [],
        equityCurve: [{ date: startDate, value: perSymbolCapital, drawdown: 0 }],
      });
      continue;
    }

    results.push({
      symbol,
      dataSource: priceDataMap[symbol] ? "yahoo" : "generated",
      totalReturn: result.totalReturn,
      annualizedReturn: result.annualizedReturn,
      maxDrawdown: result.maxDrawdown,
      sharpeRatio: result.sharpeRatio,
      winRate: result.winRate,
      totalTrades: result.totalTrades,
      profitFactor: result.profitFactor,
      finalCapital: result.finalCapital,
      trades: result.trades,
      equityCurve: result.equityCurve,
    });
  }

  // Build combined portfolio equity curve (equal-weight, daily sum)
  const allDates = new Set<string>();
  for (const r of results) r.equityCurve.forEach(p => allDates.add(p.date));
  const sortedDates = Array.from(allDates).sort();

  const symbolValueMaps = results.map(r => {
    const m = new Map<string, number>();
    let last = r.finalCapital / (r.equityCurve.length > 0 ? 1 : 1);
    for (const pt of r.equityCurve) { m.set(pt.date, pt.value); last = pt.value; }
    return { map: m, last };
  });

  const portfolioCurve: EquityPoint[] = sortedDates.map(date => {
    const total = symbolValueMaps.reduce((sum, { map, last }) => {
      return sum + (map.get(date) ?? last);
    }, 0);
    return { date, value: total, drawdown: 0 };
  });

  let peak = portfolioCurve[0]?.value ?? initialCapital;
  for (const pt of portfolioCurve) {
    if (pt.value > peak) peak = pt.value;
    pt.drawdown = peak > 0 ? ((peak - pt.value) / peak) * 100 : 0;
  }

  const portfolioFinalCapital = portfolioCurve[portfolioCurve.length - 1]?.value ?? initialCapital;
  const portfolioReturn = ((portfolioFinalCapital - initialCapital) / initialCapital) * 100;
  const days = daysBetween(startDate, endDate);
  const years = days / 365;
  const portfolioAnnReturn = years > 0
    ? (Math.pow(portfolioFinalCapital / initialCapital, 1 / years) - 1) * 100
    : portfolioReturn;
  const portfolioMaxDD = Math.max(...portfolioCurve.map(p => p.drawdown), 0);

  const portfolioReturns = portfolioCurve.slice(1).map((p, i) => {
    const prev = portfolioCurve[i]!.value;
    return prev > 0 ? (p.value - prev) / prev : 0;
  });
  const portfolioMeanReturn = portfolioReturns.reduce((a, b) => a + b, 0) / Math.max(portfolioReturns.length, 1);
  const portfolioStd = Math.sqrt(portfolioReturns.reduce((a, b) => a + (b - portfolioMeanReturn) ** 2, 0) / Math.max(portfolioReturns.length - 1, 1));
  const portfolioSharpe = portfolioStd > 0 ? ((portfolioMeanReturn - 0.04 / 252) / portfolioStd) * Math.sqrt(252) : 0;

  const allTrades = results.flatMap(r => r.trades);
  const winners = allTrades.filter(t => t.pnl > 0);
  const losers = allTrades.filter(t => t.pnl <= 0);
  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0));

  const sortedResults = [...results].filter(r => r.totalTrades > 0).sort((a, b) => b.totalReturn - a.totalReturn);
  const bestSymbol  = sortedResults[0]?.symbol ?? symbols[0];
  const worstSymbol = sortedResults[sortedResults.length - 1]?.symbol ?? symbols[symbols.length - 1];

  return {
    symbols,
    results,
    portfolio: {
      totalReturn: portfolioReturn,
      annualizedReturn: portfolioAnnReturn,
      maxDrawdown: portfolioMaxDD,
      sharpeRatio: portfolioSharpe,
      winRate: allTrades.length > 0 ? (winners.length / allTrades.length) * 100 : 0,
      totalTrades: allTrades.length,
      finalCapital: portfolioFinalCapital,
      initialCapital,
      bestSymbol,
      worstSymbol,
      equityCurve: portfolioCurve,
      allocationPct: 100 / symbols.length,
    },
  };
}

// ─── Regime Classification (exported for superpowers route) ───────────────────
// SMA50 trend direction × 20-day rolling std > 1.5× full-period avg volatility

export interface RegimePeriod {
  startDate: string; endDate: string;
  regime: "trending_bull" | "trending_bear" | "highvol_bull" | "highvol_bear";
  avgReturn: number; volatility: number;
  tradeCount: number; winRate: number; totalPnl: number;
}

export function classifyRegimes(
  bars: Array<{ date: string; close: number }>,
  trades: Array<{ entryDate: string; exitDate: string; pnl: number }>,
  windowDays = 30
): RegimePeriod[] {
  if (bars.length < 60) return [];

  const closes = bars.map((b) => b.close);
  // Use O(N) sma for the SMA50 computation
  const sma50 = sma(closes, 50);

  const allReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    allReturns.push((closes[i]! - closes[i - 1]!) / closes[i - 1]!);
  }
  const fpMean = allReturns.reduce((a, b) => a + b, 0) / allReturns.length;
  const fpVariance = allReturns.reduce((a, r) => a + (r - fpMean) ** 2, 0) / allReturns.length;
  const fullPeriodStd = Math.sqrt(fpVariance);

  const periods: RegimePeriod[] = [];
  let i = 50;

  while (i + windowDays <= bars.length) {
    const windowBars = bars.slice(i, i + windowDays);
    const startDate = windowBars[0]!.date;
    const endDate = windowBars[windowBars.length - 1]!.date;

    const rollingReturns: number[] = [];
    for (let j = 1; j < windowBars.length; j++) {
      rollingReturns.push((windowBars[j]!.close - windowBars[j - 1]!.close) / windowBars[j - 1]!.close);
    }
    const avgReturn = rollingReturns.reduce((a, b) => a + b, 0) / rollingReturns.length;
    const rMean = avgReturn;
    const rVariance = rollingReturns.reduce((a, r) => a + (r - rMean) ** 2, 0) / rollingReturns.length;
    const rollingStd = Math.sqrt(rVariance);
    const volatility = rollingStd * Math.sqrt(252) * 100;
    const isHighVol = rollingStd > 1.5 * fullPeriodStd;

    const midBar = windowBars[Math.floor(windowBars.length / 2)]!;
    const midIdx = bars.findIndex((b) => b.date === midBar.date);
    const currentSma = midIdx >= 0 ? sma50[midIdx] : null;
    const priceAboveSma = currentSma != null ? midBar.close > currentSma : true;

    let regime: RegimePeriod["regime"];
    if (isHighVol) {
      regime = priceAboveSma ? "highvol_bull" : "highvol_bear";
    } else {
      regime = priceAboveSma ? "trending_bull" : "trending_bear";
    }

    const periodTrades = trades.filter((t) => t.entryDate >= startDate && t.exitDate <= endDate);
    const winners = periodTrades.filter((t) => t.pnl > 0);
    const winRate = periodTrades.length > 0 ? (winners.length / periodTrades.length) * 100 : 0;
    const totalPnl = periodTrades.reduce((a, t) => a + t.pnl, 0);

    periods.push({
      startDate, endDate, regime,
      avgReturn: avgReturn * 252 * 100,
      volatility,
      tradeCount: periodTrades.length,
      winRate, totalPnl,
    });

    i += windowDays;
  }

  return periods;
}

export function runWalkForward(
  symbol: string,
  strategyType: string,
  parameters: Record<string, unknown>,
  startDate: string,
  endDate: string,
  initialCapital: number,
  commissionPct = 0,
  slippagePct = 0,
  priceData?: OHLCVBar[],
  timeframe = "1d",
  trainRatio = 0.7,
): WalkForwardResult {
  if (!priceData || priceData.length < 50) {
    throw new Error("Walk-forward analysis requires at least 50 bars of data.");
  }

  const splitIdx = Math.floor(priceData.length * trainRatio);
  const splitDate = priceData[splitIdx]?.date ?? endDate;

  const inSampleBars = priceData.slice(0, splitIdx);
  const outSampleBars = priceData.slice(splitIdx);

  const inSample = runBacktest(symbol, strategyType, parameters, startDate, splitDate, initialCapital, commissionPct, slippagePct, inSampleBars, timeframe);
  // OOS starts from IS final capital — sequential walk-forward semantics
  const outSample = runBacktest(symbol, strategyType, parameters, splitDate, endDate, inSample.finalCapital, commissionPct, slippagePct, outSampleBars, timeframe);

  const consistencyScore = inSample.sharpeRatio > 0 && outSample.sharpeRatio > 0
    ? Math.min(outSample.sharpeRatio / inSample.sharpeRatio, 1) * 100
    : 0;

  // Combined metrics derived from compounded capital and trade-count-weighted averages
  const combinedTotalReturn = ((outSample.finalCapital - initialCapital) / initialCapital) * 100;
  const totalTrades = inSample.totalTrades + outSample.totalTrades;
  const combinedWinRate = totalTrades > 0
    ? (inSample.winRate * inSample.totalTrades + outSample.winRate * outSample.totalTrades) / totalTrades
    : 0;
  const combinedSharpe = totalTrades > 0
    ? (inSample.sharpeRatio * inSample.totalTrades + outSample.sharpeRatio * outSample.totalTrades) / totalTrades
    : 0;

  return {
    inSample,
    outOfSample: outSample,
    trainRatio,
    splitDate,
    combined: {
      totalReturn: combinedTotalReturn,
      sharpeRatio: combinedSharpe,
      maxDrawdown: Math.max(inSample.maxDrawdown, outSample.maxDrawdown),
      winRate: combinedWinRate,
      totalTrades,
      consistencyScore,
    },
  };
}
