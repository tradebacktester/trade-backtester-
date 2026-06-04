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

  // Seed: first average gain/loss from initial `period` price changes
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

const BARS_PER_DAY: Record<string, number> = {
  "1m": 1440, "5m": 288, "15m": 96, "30m": 48, "1h": 24, "2h": 12, "4h": 6, "1d": 1,
};

export function generatePriceData(symbol: string, startDate: string, endDate: string, timeframe = "1d"): OHLCVBar[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const bars: OHLCVBar[] = [];

  // Comprehensive symbol table: seed price, daily volatility, daily drift
  const SYMBOL_PARAMS: Record<string, { seed: number; vol: number; drift: number }> = {
    // Crypto
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
    // Tech
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
    // DeFi
    AAVEUSDT: { seed: 90,   vol: 0.090, drift: 0.0003 },
    // Auto / Media / Fintech
    TSLA:  { seed: 250,  vol: 0.040, drift: 0.0003 },
    NFLX:  { seed: 450,  vol: 0.028, drift: 0.0003 },
    PYPL:  { seed: 75,   vol: 0.030, drift: 0.0001 },
    SQ:    { seed: 70,   vol: 0.040, drift: 0.0002 },
    // Financials
    JPM:   { seed: 185,  vol: 0.018, drift: 0.0003 },
    BAC:   { seed: 38,   vol: 0.022, drift: 0.0002 },
    GS:    { seed: 380,  vol: 0.022, drift: 0.0003 },
    V:     { seed: 240,  vol: 0.014, drift: 0.0003 },
    MA:    { seed: 420,  vol: 0.015, drift: 0.0003 },
    // Consumer / Industrial / Energy
    DIS:   { seed: 95,   vol: 0.022, drift: 0.0002 },
    BA:    { seed: 210,  vol: 0.030, drift: 0.0002 },
    GE:    { seed: 110,  vol: 0.025, drift: 0.0002 },
    XOM:   { seed: 105,  vol: 0.020, drift: 0.0002 },
    WMT:   { seed: 160,  vol: 0.012, drift: 0.0002 },
    KO:    { seed: 60,   vol: 0.010, drift: 0.0002 },
    // Indices
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
    // Commodities / Metals
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
    // Forex
    EURUSD:  { seed: 1.08, vol: 0.006, drift: 0.0 },
    GBPUSD:  { seed: 1.26, vol: 0.007, drift: 0.0 },
    USDJPY:  { seed: 148,  vol: 0.005, drift: 0.0001 },
    AUDUSD:  { seed: 0.65, vol: 0.007, drift: 0.0 },
    USDCAD:  { seed: 1.36, vol: 0.005, drift: 0.0 },
    USDCHF:  { seed: 0.88, vol: 0.005, drift: -0.0001 },
    NZDUSD:  { seed: 0.61, vol: 0.007, drift: 0.0 },
    // Bonds / Vol
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
    let inTrade = false, entryIdx = -1;
    for (let i = 1; i < bars.length; i++) {
      const lo = lower[i], lop = lower[i-1], up = upper[i];
      if (lo == null || lop == null || up == null) continue;
      if (!inTrade && closes[i-1] <= (lop ?? 0) && closes[i] > (lo ?? 0) && i + 1 < bars.length) { inTrade = true; entryIdx = i + 1; }
      else if (inTrade && closes[i] >= (up ?? 0)) { signals.push({ entries: [entryIdx], exits: [i + 1 < bars.length ? i + 1 : i], direction: "long" }); inTrade = false; }
    }
    if (inTrade && entryIdx >= 0 && entryIdx < bars.length)
      signals.push({ entries: [entryIdx], exits: [bars.length - 1], direction: "long" });
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
  positionSizing?: PositionSizing
): BacktestResult {
  const bars = (priceData && priceData.length >= 50) ? priceData : generatePriceData(symbol, startDate, endDate, timeframe);
  const empty: BacktestResult = {
    trades: [], equityCurve: [{ date: startDate, value: initialCapital, drawdown: 0, benchmark: initialCapital }],
    finalCapital: initialCapital, totalReturn: 0, annualizedReturn: 0, maxDrawdown: 0,
    sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, winRate: 0, totalTrades: 0,
    profitFactor: 0, avgWin: 0, avgLoss: 0, avgRR: 0, consecutiveWins: 0, consecutiveLosses: 0,
    avgTradeDuration: 0, bestTrade: 0, worstTrade: 0, monthlyReturns: [], yearlyReturns: [],
    benchmarkReturn: 0, commissionPct, slippagePct, expectancy: 0, sqn: 0,
  };
  if (bars.length < 50) return empty;

  // Benchmark: buy & hold
  const benchmarkFirstPrice = bars[0].open;
  const benchmarkLastPrice = bars[bars.length - 1].close;
  const benchmarkReturn = ((benchmarkLastPrice - benchmarkFirstPrice) / benchmarkFirstPrice) * 100;
  const benchmarkQty = (initialCapital * 0.95) / benchmarkFirstPrice;
  const benchmarkValues = new Map<string, number>();
  for (const bar of bars) {
    benchmarkValues.set(bar.date, benchmarkFirstPrice > 0
      ? initialCapital * 0.05 + benchmarkQty * bar.close
      : initialCapital);
  }

  const signals = runStrategy(bars, strategyType, parameters);
  const trades: TradeResult[] = [];
  let capital = initialCapital;

  for (const sig of signals) {
    const entryBar = bars[sig.entries[0]];
    const exitBar = bars[sig.exits[0]];

    // Apply slippage: adverse fill for both longs and shorts (HIGH-010 fix)
    // Entries and exits both use the OPEN of the execution bar (next bar after signal)
    // to eliminate look-ahead bias — we can't react to a bar's close until it's already closed.
    const isShort = sig.direction === "short";
    const entryPrice = isShort
      ? entryBar.open * (1 - slippagePct / 100)  // short entry: sell at lower price
      : entryBar.open * (1 + slippagePct / 100);  // long entry: buy at higher price
    const exitPrice = isShort
      ? exitBar.open * (1 + slippagePct / 100)   // short exit: cover at higher price (open of next bar)
      : exitBar.open * (1 - slippagePct / 100);   // long exit: sell at lower price (open of next bar)

    let quantity: number;
    if (positionSizing?.mode === "fixed_amount") {
      const amt = Math.min(positionSizing.value ?? capital * 0.95, capital * 0.99);
      quantity = amt / Math.abs(entryPrice);
    } else if (positionSizing?.mode === "risk_pct") {
      quantity = (capital * ((positionSizing.value ?? 1) / 100)) / Math.abs(entryPrice);
    } else {
      quantity = (capital * 0.95) / Math.abs(entryPrice);
    }

    // Apply commission on both legs
    const commissionCost = quantity * (Math.abs(entryPrice) + Math.abs(exitPrice)) * (commissionPct / 100);

    // PnL direction depends on trade side (HIGH-010 fix)
    const rawPnl = isShort
      ? (entryPrice - exitPrice) * quantity
      : (exitPrice - entryPrice) * quantity;
    const pnl = rawPnl - commissionCost;
    const pnlPercent = isShort
      ? ((entryPrice - exitPrice) / entryPrice) * 100 - (commissionPct * 2)
      : ((exitPrice - entryPrice) / entryPrice) * 100 - (commissionPct * 2);
    const duration = daysBetween(entryBar.date, exitBar.date);

    capital += pnl;
    trades.push({
      symbol, side: sig.direction,
      entryDate: entryBar.date, exitDate: exitBar.date,
      entryPrice, exitPrice, quantity, pnl, pnlPercent, duration,
    });
  }

  // Build equity curve with mark-to-market tracking (BUG-005 fix)
  // At each bar: equity = initial + settled PnL from closed trades + unrealized MtM from open trades.
  // This prevents the "flat equity between exits" problem that artificially inflates Sharpe ratio.
  const equityCurve: EquityPoint[] = [];
  let peakValue = initialCapital;
  let maxDrawdown = 0;

  for (let bi = 0; bi < bars.length; bi++) {
    const bar = bars[bi];
    let equity = initialCapital;
    let worstEquity = initialCapital; // uses bar lows for intra-trade drawdown (BUG-006 fix)

    for (let ti = 0; ti < signals.length && ti < trades.length; ti++) {
      const sig = signals[ti];
      const trade = trades[ti];
      const entryBarIdx = sig.entries[0];
      const exitBarIdx = sig.exits[0];

      if (bi >= exitBarIdx) {
        // Trade settled — use final PnL (net of commission)
        equity += trade.pnl;
        worstEquity += trade.pnl;
      } else if (bi >= entryBarIdx) {
        // Trade open — mark to market at bar close, direction-aware
        // Short positions gain when price falls (entryPrice - bar.close), lose when price rises
        const unrealized = trade.side === "short"
          ? (trade.entryPrice - bar.close) * trade.quantity
          : (bar.close - trade.entryPrice) * trade.quantity;
        equity += unrealized;
        // Worst-case intra-bar: for longs use bar.low; for shorts use bar.high (worst fill)
        const unrealizedWorst = trade.side === "short"
          ? (trade.entryPrice - bar.high) * trade.quantity
          : (bar.low - trade.entryPrice) * trade.quantity;
        worstEquity += unrealizedWorst;
      }
    }

    if (equity > peakValue) peakValue = equity;
    const drawdown = peakValue > 0 ? ((peakValue - equity) / peakValue) * 100 : 0;

    // Track max drawdown using bar lows for open positions (BUG-006)
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
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const years = Math.max((endMs - startMs) / (365.25 * 24 * 3600 * 1000), 1 / 365);
  // Guard against negative/zero capital: NaN from Math.pow of negative base
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

  // Streaks
  let maxConsWins = 0, maxConsLosses = 0, curWins = 0, curLosses = 0;
  for (const t of trades) {
    if (t.pnl > 0) { curWins++; curLosses = 0; maxConsWins = Math.max(maxConsWins, curWins); }
    else { curLosses++; curWins = 0; maxConsLosses = Math.max(maxConsLosses, curLosses); }
  }

  const avgTradeDuration = trades.length > 0 ? trades.reduce((a, t) => a + t.duration, 0) / trades.length : 0;
  const pnlPcts = trades.map((t) => t.pnlPercent);
  const bestTrade = pnlPcts.length > 0 ? Math.max(...pnlPcts) : 0;
  const worstTrade = pnlPcts.length > 0 ? Math.min(...pnlPcts) : 0;

  // Monthly returns — denominator is equity at the START of that month (running capital),
  // not initialCapital. Using initialCapital would break compounding and make % meaningless.
  const monthlyMap = new Map<string, number>();
  for (const t of trades) {
    const m = monthKey(t.exitDate);
    monthlyMap.set(m, (monthlyMap.get(m) ?? 0) + t.pnl);
  }
  // Build a map of equity at the first bar of each month from the equity curve
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

  // Yearly returns calendar (all months in each year, even if zero)
  const yearlyMap = new Map<string, Map<string, number>>();
  for (const { month, pct } of monthlyReturns) {
    const y = year(month);
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

  // Sharpe ratio — proper formula using ALL calendar days (including flat/out-of-market days).
  // Excluding zero-return days inflates Sharpe by reducing N; including them is academically correct
  // because idle capital still has an opportunity cost (the risk-free rate).
  // Risk-free rate: 4 % annual → 0.04/252 per trading day.
  // Uses sample std dev (N-1) to avoid downward bias on finite series.
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
    // Sample variance (N-1)
    const variance = excessReturns.reduce((a, b) => a + (b - meanExcess) ** 2, 0) / (nDays - 1);
    const stddev = Math.sqrt(variance);
    sharpeRatio = stddev > 0 ? (meanExcess / stddev) * Math.sqrt(252) : 0;

    // Sortino: semi-deviation on downside excess returns only
    const negExcess = excessReturns.filter(r => r < 0);
    if (negExcess.length > 0) {
      // Denominator uses full N (standard Sortino convention)
      const downsideVariance = negExcess.reduce((a, r) => a + r * r, 0) / nDays;
      const downsideStd = Math.sqrt(downsideVariance);
      sortinoRatio = downsideStd > 0 ? (meanExcess / downsideStd) * Math.sqrt(252) : 0;
    }
  }

  // Calmar ratio: annualized return / max drawdown.
  // Returns null when maxDrawdown=0 and strategy is profitable (truly infinite — no drawdown).
  const calmarRatio: number | null = maxDrawdown > 0
    ? annualizedReturn / maxDrawdown
    : annualizedReturn > 0 ? null : 0;

  // Expectancy: average dollar profit per trade (Van Tharp definition)
  const expectancy = trades.length > 0
    ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length
    : 0;

  // SQN (System Quality Number): sqrt(N) × mean(R) / std(R)
  let sqn = 0;
  if (trades.length >= 2) {
    const pnls = trades.map(t => t.pnl);
    const meanPnl = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    const stdPnl = Math.sqrt(pnls.reduce((a, v) => a + (v - meanPnl) ** 2, 0) / (pnls.length - 1));
    sqn = stdPnl > 0 ? (Math.sqrt(pnls.length) * meanPnl) / stdPnl : 0;
  }

  return {
    trades, equityCurve, finalCapital, totalReturn, annualizedReturn, maxDrawdown,
    sharpeRatio, sortinoRatio, calmarRatio, winRate, totalTrades: trades.length,
    profitFactor, avgWin, avgLoss, avgRR, consecutiveWins: maxConsWins, consecutiveLosses: maxConsLosses,
    avgTradeDuration, bestTrade, worstTrade, monthlyReturns, yearlyReturns,
    benchmarkReturn, commissionPct, slippagePct, expectancy, sqn,
  };
}

function year(monthStr: string): string { return monthStr.slice(0, 4); }

// ─── Regime Classification (exported for superpowers route) ───────────────────
// SMA50 trend direction × 20-day rolling std > 1.5× full-period avg volatility

export interface RegimePeriod {
  startDate: string; endDate: string;
  regime: "trending_bull" | "trending_bear" | "highvol_bull" | "highvol_bear";
  avgReturn: number; volatility: number;
  tradeCount: number; winRate: number; totalPnl: number;
}

function computeRegimeSMA(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

export function classifyRegimes(
  bars: Array<{ date: string; close: number }>,
  trades: Array<{ entryDate: string; exitDate: string; pnl: number }>,
  windowDays = 30
): RegimePeriod[] {
  if (bars.length < 60) return [];

  const closes = bars.map((b) => b.close);
  const sma50 = computeRegimeSMA(closes, 50);

  // Full-period daily std — baseline for adaptive high-vol threshold
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

    // High-vol: 20-day rolling std > 1.5× full-period daily std
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
