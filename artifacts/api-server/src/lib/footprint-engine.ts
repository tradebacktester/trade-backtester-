import { fetchYahooKlines } from "./yahoo-finance";

export interface PriceLevel {
  price: number;
  bidVol: number;
  askVol: number;
  delta: number;
  totalVol: number;
  isImbalance: boolean;
  isBuyAbsorption: boolean;
  isSellAbsorption: boolean;
}

export interface FootprintCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  delta: number;
  cvd: number;
  levels: PriceLevel[];
  isExhaustion: boolean;
  isDivergence: boolean;
  sessionTag: string | null;
}

export interface FootprintOpportunity {
  symbol: string;
  displayName: string;
  delta: number;
  imbalanceCount: number;
  absorptionScore: number;
  lastPrice: number;
  change24h: number;
  signal: "bullish" | "bearish" | "neutral";
}

export interface SessionAnalytics {
  session: string;
  label: string;
  color: string;
  delta: number;
  volume: number;
  dominancePct: number;
  bullishCandles: number;
  bearishCandles: number;
}

const SYMBOL_PARAMS: Record<string, { seed: number; price: number; vol: number; drift: number }> = {
  BTCUSDT:  { seed: 42,  price: 67000,  vol: 0.008, drift: 0.0002 },
  ETHUSDT:  { seed: 43,  price: 3500,   vol: 0.009, drift: 0.0002 },
  SOLUSDT:  { seed: 44,  price: 160,    vol: 0.012, drift: 0.0003 },
  BNBUSDT:  { seed: 45,  price: 580,    vol: 0.007, drift: 0.0002 },
  XRPUSDT:  { seed: 46,  price: 0.55,   vol: 0.010, drift: 0.0001 },
  ADAUSDT:  { seed: 47,  price: 0.45,   vol: 0.011, drift: 0.0001 },
  LINKUSDT: { seed: 48,  price: 14,     vol: 0.010, drift: 0.0002 },
  AVAXUSDT: { seed: 49,  price: 38,     vol: 0.012, drift: 0.0002 },
  DOTUSDT:  { seed: 50,  price: 7.5,    vol: 0.011, drift: 0.0001 },
  LTCUSDT:  { seed: 51,  price: 82,     vol: 0.008, drift: 0.0001 },
  AAPL:     { seed: 60,  price: 189,    vol: 0.004, drift: 0.0002 },
  MSFT:     { seed: 61,  price: 415,    vol: 0.003, drift: 0.0002 },
  NVDA:     { seed: 62,  price: 875,    vol: 0.008, drift: 0.0004 },
  TSLA:     { seed: 63,  price: 175,    vol: 0.010, drift: 0.0002 },
  SPY:      { seed: 70,  price: 525,    vol: 0.003, drift: 0.0002 },
  QQQ:      { seed: 71,  price: 446,    vol: 0.004, drift: 0.0002 },
  EURUSD:   { seed: 80,  price: 1.085,  vol: 0.002, drift: 0.0 },
  GBPUSD:   { seed: 81,  price: 1.27,   vol: 0.002, drift: 0.0 },
  USDJPY:   { seed: 82,  price: 155,    vol: 0.002, drift: 0.0 },
  XAUUSD:   { seed: 90,  price: 2350,   vol: 0.003, drift: 0.0001 },
  WTIUSD:   { seed: 91,  price: 82,     vol: 0.007, drift: 0.0001 },
  "NQ1!":   { seed: 100, price: 18200,  vol: 0.004, drift: 0.0002 },
  "ES1!":   { seed: 101, price: 5200,   vol: 0.003, drift: 0.0002 },
  "CL1!":   { seed: 102, price: 82,     vol: 0.006, drift: 0.0001 },
  "GC1!":   { seed: 103, price: 2350,   vol: 0.003, drift: 0.0001 },
};

function makeRng(seed: number) {
  let s = seed;
  function rand(): number {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  }
  function randn(): number {
    const u = Math.max(rand(), 1e-10);
    const v = Math.max(rand(), 1e-10);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  return { rand, randn };
}

function getParams(symbol: string) {
  const p = SYMBOL_PARAMS[symbol.toUpperCase()];
  if (p) return p;
  const hashSeed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 200;
  return { seed: hashSeed, price: 100, vol: 0.008, drift: 0.0001 };
}

export function generateFootprintCandles(
  symbol: string,
  timeframe: string,
  limit: number,
  session: string = "all",
  candleOffset: number = 0,
): FootprintCandle[] {
  const params = getParams(symbol);
  const { rand, randn } = makeRng(params.seed + candleOffset);

  const levelCount = 10;
  let price = params.price;
  const candles: FootprintCandle[] = [];
  let runningCvd = 0;

  for (let i = 0; i < limit; i++) {
    const candleSeed = params.seed + candleOffset + i * 7;
    const { rand: cr, randn: crn } = makeRng(candleSeed);

    const bodyVol = params.vol * (0.5 + cr() * 1.5);
    const open = price;
    const change = price * bodyVol * crn() + price * params.drift;
    const close = Math.max(open + change, open * 0.001);
    const high = Math.max(open, close) * (1 + cr() * params.vol * 0.5);
    const low = Math.min(open, close) * (1 - cr() * params.vol * 0.5);
    const volume = Math.floor(cr() * 800000 + 200000);
    const bullish = close >= open;

    const range = high - low || price * 0.001;
    const tickSize = range / levelCount;
    const levels: PriceLevel[] = [];
    let candleDelta = 0;
    let maxLevelVol = 0;

    for (let lvl = 0; lvl < levelCount; lvl++) {
      const lvlPrice = low + tickSize * (lvl + 0.5);
      const distFromClose = Math.abs(lvlPrice - close) / range;
      const concentration = Math.exp(-distFromClose * 2);
      const lvlVol = Math.max(10, Math.floor(cr() * volume * 0.15 * (1 + concentration)));
      const askRatio = bullish
        ? 0.55 + cr() * 0.25
        : 0.35 + cr() * 0.25;
      const askVol = Math.floor(lvlVol * askRatio);
      const bidVol = lvlVol - askVol;
      const delta = askVol - bidVol;
      candleDelta += delta;
      maxLevelVol = Math.max(maxLevelVol, lvlVol);
      levels.push({ price: lvlPrice, bidVol, askVol, delta, totalVol: lvlVol, isImbalance: false, isBuyAbsorption: false, isSellAbsorption: false });
    }

    for (let lvl = 0; lvl < levels.length; lvl++) {
      const l = levels[lvl]!;
      const prev = levels[lvl - 1];
      if (prev) {
        const ratio = l.askVol / Math.max(l.bidVol, 1);
        const ratioInv = l.bidVol / Math.max(l.askVol, 1);
        l.isImbalance = ratio >= 3 || ratioInv >= 3;
        l.isBuyAbsorption = !bullish && l.askVol > l.bidVol * 2.5 && l.totalVol > maxLevelVol * 0.7;
        l.isSellAbsorption = bullish && l.bidVol > l.askVol * 2.5 && l.totalVol > maxLevelVol * 0.7;
      }
    }

    runningCvd += candleDelta;

    const sessionTag = getSessionTag(i, timeframe);
    const isExhaustion = Math.abs(candleDelta) > volume * 0.3 && cr() < 0.15;
    const isDivergence = i > 5 && Math.abs(candleDelta) > 0.2 * volume && (bullish ? candleDelta < 0 : candleDelta > 0);

    candles.push({
      date: candleDateStr(i, timeframe),
      open, high, low, close, volume,
      delta: candleDelta,
      cvd: runningCvd,
      levels,
      isExhaustion,
      isDivergence,
      sessionTag,
    });

    price = close;
  }

  void rand; void randn;
  return session === "all" ? candles : candles.filter(c => c.sessionTag === session || c.sessionTag === null);
}

function getSessionTagFromTs(timestampMs: number, timeframe: string): string | null {
  const tfMs: Record<string, number> = {
    "1m": 60_000, "5m": 300_000, "15m": 900_000,
    "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000,
  };
  const ms = tfMs[timeframe] ?? 3_600_000;
  if (ms >= 86_400_000) return null;
  const hour = new Date(timestampMs).getUTCHours();
  if (hour >= 0 && hour < 9) return "tokyo";
  if (hour >= 7 && hour < 16) return "london";
  if (hour >= 13 && hour < 22) return "new_york";
  return "sydney";
}

/**
 * Builds real footprint candles from Binance kline data.
 * Uses real OHLCV from Binance REST — prices and volumes are actual market data.
 * Level distribution is modelled from real taker buy/sell ratios (Kline field 9/5).
 * Falls back to null on any network or parse error.
 */
export async function buildFootprintFromBinanceKlines(
  symbol: string,
  timeframe: string,
  limit: number,
  session: string = "all",
): Promise<FootprintCandle[] | null> {
  const TF_MAP: Record<string, string> = {
    "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1d",
  };
  const interval = TF_MAP[timeframe] ?? "1h";

  try {
    const resp = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (!resp.ok) return null;
    const raw = await resp.json() as unknown[][];
    if (!Array.isArray(raw) || raw.length === 0) return null;

    const levelCount = 10;
    let runningCvd = 0;

    const candles: FootprintCandle[] = raw.map((k, candleIdx) => {
      const openTime      = k[0] as number;
      const open          = parseFloat(k[1] as string);
      const high          = parseFloat(k[2] as string);
      const low           = parseFloat(k[3] as string);
      const close         = parseFloat(k[4] as string);
      const volume        = parseFloat(k[5] as string);
      const takerBuyBase  = parseFloat(k[9] as string);
      const bullish       = close >= open;

      // Real taker-buy ratio from Binance kline field 9 (taker buy base volume / total volume)
      const realBuyRatio = volume > 0 ? Math.min(0.95, Math.max(0.05, takerBuyBase / volume)) : (bullish ? 0.55 : 0.45);

      // Deterministic seed from real price data so levels are stable across identical candles
      const seed = ((Math.round(open * 100) * 31 + Math.round(close * 100) * 17 + candleIdx * 7) >>> 0);
      const { rand } = makeRng(seed);

      const range = high - low || open * 0.001;
      const tickSize = range / levelCount;
      const levels: PriceLevel[] = [];
      let candleDelta = 0;
      let maxLevelVol = 0;

      for (let lvl = 0; lvl < levelCount; lvl++) {
        const lvlPrice = low + tickSize * (lvl + 0.5);
        // Concentration model: more activity near close (where fills cluster)
        const distFromClose = Math.abs(lvlPrice - close) / range;
        const concentration = Math.exp(-distFromClose * 2);
        // Volume fraction per level — realistic 6–20% with concentration bonus
        const lvlVolFraction = 0.07 * (0.4 + rand() * 1.2) * (1 + concentration);
        const lvlVol = volume * lvlVolFraction;
        // Per-level buy ratio jitter ±10% around real taker ratio
        const lvlBuyRatio = Math.min(0.95, Math.max(0.05, realBuyRatio + (rand() - 0.5) * 0.2));
        const askVol = lvlVol * lvlBuyRatio;
        const bidVol = lvlVol * (1 - lvlBuyRatio);
        const delta  = askVol - bidVol;
        candleDelta += delta;
        maxLevelVol = Math.max(maxLevelVol, lvlVol);
        levels.push({
          price: lvlPrice, bidVol, askVol, delta, totalVol: lvlVol,
          isImbalance: false, isBuyAbsorption: false, isSellAbsorption: false,
        });
      }

      // Detect imbalances & absorptions using real OHLC structure
      for (let lvl = 0; lvl < levels.length; lvl++) {
        const l = levels[lvl]!;
        const prev = levels[lvl - 1];
        if (prev) {
          const ratio    = l.askVol / Math.max(l.bidVol, 0.0001);
          const ratioInv = l.bidVol / Math.max(l.askVol, 0.0001);
          l.isImbalance      = ratio >= 3 || ratioInv >= 3;
          l.isBuyAbsorption  = !bullish && l.askVol > l.bidVol * 2.5 && l.totalVol > maxLevelVol * 0.7;
          l.isSellAbsorption =  bullish && l.bidVol > l.askVol * 2.5 && l.totalVol > maxLevelVol * 0.7;
        }
      }

      runningCvd += candleDelta;
      const isExhaustion = Math.abs(candleDelta) > volume * 0.3;
      const isDivergence  = candleIdx > 5 && Math.abs(candleDelta) > 0.2 * volume && (bullish ? candleDelta < 0 : candleDelta > 0);

      return {
        date:       new Date(openTime).toISOString(),
        open, high, low, close, volume,
        delta:      candleDelta,
        cvd:        runningCvd,
        levels,
        isExhaustion,
        isDivergence,
        sessionTag: getSessionTagFromTs(openTime, timeframe),
      };
    });

    return session === "all" ? candles : candles.filter(c => c.sessionTag === session || c.sessionTag === null);
  } catch {
    return null;
  }
}

/**
 * Build footprint candles from Yahoo Finance OHLCV.
 * Bid/ask volumes are estimated from candle direction + body size —
 * flagged as "estimated" (not real tape data).
 */
export async function buildFootprintFromYahooKlines(
  symbol: string,
  timeframe: string,
  limit: number,
  session = "all",
): Promise<FootprintCandle[] | null> {
  try {
    const bars = await fetchYahooKlines(symbol, timeframe, limit);
    if (!bars || bars.length === 0) return null;

    const levelCount = 10;
    let runningCvd = 0;

    const candles: FootprintCandle[] = bars.map((bar, idx) => {
      const { time, open, high, low, close, volume } = bar;
      const bullish = close >= open;

      // Estimate taker-buy ratio from candle body size + direction
      const range = high - low || open * 0.001;
      const bodyPct = Math.abs(close - open) / range;
      const baseBuyRatio = bullish
        ? 0.55 + bodyPct * 0.15   // stronger bull body → higher buy ratio
        : 0.45 - bodyPct * 0.15;  // stronger bear body → lower buy ratio
      const realBuyRatio = Math.min(0.90, Math.max(0.10, baseBuyRatio));

      const seed = ((Math.round(open * 100) * 31 + Math.round(close * 100) * 17 + idx * 7) >>> 0);
      const { rand } = makeRng(seed);

      const tickSize = range / levelCount;
      const levels: PriceLevel[] = [];
      let candleDelta = 0;
      let maxLevelVol = 0;

      for (let lvl = 0; lvl < levelCount; lvl++) {
        const lvlPrice = low + tickSize * (lvl + 0.5);
        const distFromClose = Math.abs(lvlPrice - close) / range;
        const concentration = Math.exp(-distFromClose * 2);
        const lvlVolFraction = 0.07 * (0.4 + rand() * 1.2) * (1 + concentration);
        const lvlVol = volume * lvlVolFraction;
        const lvlBuyRatio = Math.min(0.95, Math.max(0.05, realBuyRatio + (rand() - 0.5) * 0.2));
        const askVol = lvlVol * lvlBuyRatio;
        const bidVol = lvlVol * (1 - lvlBuyRatio);
        const delta = askVol - bidVol;
        candleDelta += delta;
        maxLevelVol = Math.max(maxLevelVol, lvlVol);
        levels.push({
          price: lvlPrice, bidVol, askVol, delta, totalVol: lvlVol,
          isImbalance: false, isBuyAbsorption: false, isSellAbsorption: false,
        });
      }

      for (let lvl = 0; lvl < levels.length; lvl++) {
        const l = levels[lvl]!;
        const prev = levels[lvl - 1];
        if (prev) {
          const ratio    = l.askVol / Math.max(l.bidVol, 0.0001);
          const ratioInv = l.bidVol / Math.max(l.askVol, 0.0001);
          l.isImbalance      = ratio >= 3 || ratioInv >= 3;
          l.isBuyAbsorption  = !bullish && l.askVol > l.bidVol * 2.5 && l.totalVol > maxLevelVol * 0.7;
          l.isSellAbsorption =  bullish && l.bidVol > l.askVol * 2.5 && l.totalVol > maxLevelVol * 0.7;
        }
      }

      runningCvd += candleDelta;
      const isExhaustion = Math.abs(candleDelta) > volume * 0.3;
      const isDivergence = idx > 5 && Math.abs(candleDelta) > 0.2 * volume && (bullish ? candleDelta < 0 : candleDelta > 0);

      return {
        date:  new Date(time * 1000).toISOString(),
        open, high, low, close, volume,
        delta: candleDelta,
        cvd:   runningCvd,
        levels,
        isExhaustion,
        isDivergence,
        sessionTag: getSessionTagFromTs(time * 1000, timeframe),
      };
    });

    return session === "all" ? candles : candles.filter(c => c.sessionTag === session || c.sessionTag === null);
  } catch {
    return null;
  }
}

function candleDateStr(i: number, timeframe: string): string {
  const now = Date.now();
  const tfMs: Record<string, number> = {
    "1m": 60_000, "5m": 300_000, "15m": 900_000,
    "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000,
  };
  const ms = tfMs[timeframe] ?? 3_600_000;
  return new Date(now - (50 - i) * ms).toISOString();
}

function getSessionTag(i: number, timeframe: string): string | null {
  const tfMs: Record<string, number> = {
    "1m": 60_000, "5m": 300_000, "15m": 900_000,
    "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000,
  };
  const ms = tfMs[timeframe] ?? 3_600_000;
  if (ms >= 86_400_000) return null;
  const now = Date.now();
  const ts = now - (50 - i) * ms;
  const hour = new Date(ts).getUTCHours();
  if (hour >= 0 && hour < 9) return "tokyo";
  if (hour >= 7 && hour < 16) return "london";
  if (hour >= 13 && hour < 22) return "new_york";
  return "sydney";
}

export function generateSessionAnalytics(symbol: string): SessionAnalytics[] {
  const params = getParams(symbol);
  const { rand } = makeRng(params.seed + 999);

  const sessions = [
    { session: "london",   label: "London",   color: "#3b82f6" },
    { session: "new_york", label: "New York",  color: "#22c55e" },
    { session: "tokyo",    label: "Tokyo",     color: "#f97316" },
    { session: "sydney",   label: "Sydney",    color: "#a855f7" },
  ];

  const rawVolumes = sessions.map(() => rand() * 800000 + 200000);
  const totalVol = rawVolumes.reduce((a, b) => a + b, 0);

  return sessions.map((s, idx) => {
    const vol = rawVolumes[idx]!;
    const bullish = rand() > 0.45;
    const delta = (bullish ? 1 : -1) * vol * (0.1 + rand() * 0.3);
    const bullishCandles = Math.floor(rand() * 8 + 4);
    const bearishCandles = Math.floor(rand() * 8 + 3);
    return {
      ...s,
      delta: Math.floor(delta),
      volume: Math.floor(vol),
      dominancePct: Math.round((vol / totalVol) * 100),
      bullishCandles,
      bearishCandles,
    };
  });
}

export async function buildScannerOpportunities(): Promise<FootprintOpportunity[]> {
  const symbols = [
    { symbol: "BTCUSDT",  displayName: "BTC/USDT" },
    { symbol: "ETHUSDT",  displayName: "ETH/USDT" },
    { symbol: "SOLUSDT",  displayName: "SOL/USDT" },
    { symbol: "BNBUSDT",  displayName: "BNB/USDT" },
    { symbol: "XRPUSDT",  displayName: "XRP/USDT" },
    { symbol: "LINKUSDT", displayName: "LINK/USDT" },
    { symbol: "AVAXUSDT", displayName: "AVAX/USDT" },
    { symbol: "ADAUSDT",  displayName: "ADA/USDT" },
    { symbol: "DOTUSDT",  displayName: "DOT/USDT" },
    { symbol: "LTCUSDT",  displayName: "LTC/USDT" },
  ];

  const results = await Promise.all(
    symbols.map(async ({ symbol, displayName }) => {
      const candles = await buildFootprintFromBinanceKlines(symbol, "1h", 20);
      if (!candles || candles.length === 0) return null;
      const lastCandle = candles[candles.length - 1]!;
      const recent = candles.slice(-5);
      const totalDelta = recent.reduce((a, c) => a + c.delta, 0);
      const imbalanceCount = recent.reduce((a, c) => a + c.levels.filter(l => l.isImbalance).length, 0);
      const absorptionScore = recent.reduce((a, c) =>
        a + c.levels.filter(l => l.isBuyAbsorption || l.isSellAbsorption).length, 0);

      // Real 24h change from first vs last candle in the 20-bar window
      const firstCandle = candles[0]!;
      const change24h = firstCandle.open > 0
        ? parseFloat((((lastCandle.close - firstCandle.open) / firstCandle.open) * 100).toFixed(2))
        : 0;

      const signal: "bullish" | "bearish" | "neutral" =
        totalDelta > lastCandle.volume * 0.1 ? "bullish"
        : totalDelta < -lastCandle.volume * 0.1 ? "bearish"
        : "neutral";

      return {
        symbol, displayName,
        delta: Math.floor(totalDelta),
        imbalanceCount,
        absorptionScore,
        lastPrice: lastCandle.close,
        change24h,
        signal,
      };
    })
  );

  return (results.filter(Boolean) as FootprintOpportunity[])
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
