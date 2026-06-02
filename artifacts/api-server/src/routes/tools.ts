import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ── Shared RNG utilities ─────────────────────────────────────────────

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function strSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function timeSeed(symbol: string, windowMs: number): number {
  return strSeed(symbol + Math.floor(Date.now() / windowMs).toString());
}

// ── Asset universe ───────────────────────────────────────────────────

const ASSETS = [
  { symbol: "BTCUSDT",  name: "Bitcoin",   ticker: "BTC",  sector: "Layer 1",  mcap: 1,  base: 67420 },
  { symbol: "ETHUSDT",  name: "Ethereum",  ticker: "ETH",  sector: "Layer 1",  mcap: 2,  base: 3521 },
  { symbol: "SOLUSDT",  name: "Solana",    ticker: "SOL",  sector: "Layer 1",  mcap: 5,  base: 182 },
  { symbol: "BNBUSDT",  name: "BNB",       ticker: "BNB",  sector: "Exchange", mcap: 4,  base: 608 },
  { symbol: "XRPUSDT",  name: "XRP",       ticker: "XRP",  sector: "Payments", mcap: 3,  base: 0.623 },
  { symbol: "ADAUSDT",  name: "Cardano",   ticker: "ADA",  sector: "Layer 1",  mcap: 9,  base: 0.457 },
  { symbol: "DOGEUSDT", name: "Dogecoin",  ticker: "DOGE", sector: "Meme",     mcap: 8,  base: 0.152 },
  { symbol: "AVAXUSDT", name: "Avalanche", ticker: "AVAX", sector: "Layer 1",  mcap: 10, base: 36 },
  { symbol: "LINKUSDT", name: "Chainlink", ticker: "LINK", sector: "Oracle",   mcap: 12, base: 18.9 },
  { symbol: "LTCUSDT",  name: "Litecoin",  ticker: "LTC",  sector: "Payments", mcap: 15, base: 84 },
  { symbol: "DOTUSDT",  name: "Polkadot",  ticker: "DOT",  sector: "Layer 0",  mcap: 16, base: 7.4 },
  { symbol: "NEARUSDT", name: "NEAR",      ticker: "NEAR", sector: "Layer 1",  mcap: 18, base: 5.8 },
  { symbol: "OPUSDT",   name: "Optimism",  ticker: "OP",   sector: "Layer 2",  mcap: 22, base: 2.4 },
  { symbol: "ARBUSDT",  name: "Arbitrum",  ticker: "ARB",  sector: "Layer 2",  mcap: 20, base: 1.1 },
  { symbol: "INJUSDT",  name: "Injective", ticker: "INJ",  sector: "DeFi",     mcap: 25, base: 28.4 },
  { symbol: "AAVEUSDT", name: "Aave",      ticker: "AAVE", sector: "DeFi",     mcap: 30, base: 110 },
  { symbol: "UNIUSDT",  name: "Uniswap",   ticker: "UNI",  sector: "DeFi",     mcap: 28, base: 8.5 },
  { symbol: "SHIBUSDT", name: "Shiba Inu", ticker: "SHIB", sector: "Meme",     mcap: 13, base: 0.0000245 },
  { symbol: "MATICUSDT",name: "Polygon",   ticker: "MATIC",sector: "Layer 2",  mcap: 24, base: 0.85 },
  { symbol: "FTMUSDT",  name: "Fantom",    ticker: "FTM",  sector: "Layer 1",  mcap: 35, base: 0.52 },
  { symbol: "ATOMUSDT", name: "Cosmos",    ticker: "ATOM", sector: "Layer 0",  mcap: 27, base: 9.8 },
  { symbol: "APTUSDT",  name: "Aptos",     ticker: "APT",  sector: "Layer 1",  mcap: 32, base: 9.1 },
  { symbol: "SUIUSDT",  name: "Sui",       ticker: "SUI",  sector: "Layer 1",  mcap: 33, base: 1.9 },
  { symbol: "PEPEUSDT", name: "Pepe",      ticker: "PEPE", sector: "Meme",     mcap: 19, base: 0.0000126 },
];

// ── Price simulation ─────────────────────────────────────────────────

function generatePrices(symbol: string, base: number, count: number, windowMs = 3_600_000): number[] {
  const rng = mulberry32(timeSeed(symbol, windowMs));
  let price = base;
  const prices: number[] = [];
  for (let i = 0; i < count; i++) {
    const vol = base * 0.014;
    price = Math.max(base * 0.05, price + (rng() - 0.49) * vol);
    prices.push(price);
  }
  return prices;
}

// ── Technical indicators ─────────────────────────────────────────────

function computeRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return +(100 - 100 / (1 + rs)).toFixed(2);
}

function computeEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function computeMACDSignal(prices: number[]): "bullish" | "bearish" | "neutral" {
  if (prices.length < 27) return "neutral";
  const ema12 = computeEMA(prices, 12);
  const ema26 = computeEMA(prices, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = computeEMA(macdLine.slice(-9), 9);
  const histogram = macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1];
  const pct = histogram / prices[prices.length - 1];
  if (pct > 0.0008) return "bullish";
  if (pct < -0.0008) return "bearish";
  return "neutral";
}

function bbPosition(prices: number[], period = 20): number {
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
  const upper = mean + 2 * std;
  const lower = mean - 2 * std;
  const last = prices[prices.length - 1];
  if (upper === lower) return 50;
  return +Math.max(0, Math.min(100, ((last - lower) / (upper - lower)) * 100)).toFixed(1);
}

function computeVWAP(prices: number[]): number {
  const volumes = prices.map((p, i) => p * (1 + Math.sin(i) * 0.2));
  const totalVolume = volumes.reduce((a, b) => a + b, 0);
  const vwap = prices.reduce((sum, p, i) => sum + p * volumes[i], 0) / totalVolume;
  return vwap;
}

// ── 1. SCREENER ──────────────────────────────────────────────────────

router.get("/tools/screener", (_req, res) => {
  const now = Date.now();
  const data = ASSETS.map(asset => {
    const prices100 = generatePrices(asset.symbol, asset.base, 100, 3_600_000);
    const prices200 = generatePrices(asset.symbol + "_ext", asset.base, 200, 7_200_000);

    const rsi = computeRSI(prices100);
    const macd = computeMACDSignal(prices100);
    const bb = bbPosition(prices100);

    const ema20 = computeEMA(prices100, 20);
    const ema50 = computeEMA(prices200, 50);
    const trend: "bullish" | "bearish" =
      ema20[ema20.length - 1] > ema50[ema50.length - 1] ? "bullish" : "bearish";

    const price = prices100[prices100.length - 1];
    const price24hAgo = prices100[Math.max(0, prices100.length - 25)];
    const change24h = +((price - price24hAgo) / price24hAgo * 100).toFixed(2);

    const price7dAgo = prices200[Math.max(0, prices200.length - 49)];
    const change7d = +((price - price7dAgo) / price7dAgo * 100).toFixed(2);

    const rngVol = mulberry32(timeSeed(asset.symbol + "v", 1_800_000));
    const volume24h = +(asset.base * (300_000 + rngVol() * 2_000_000)).toFixed(0);

    const vwap = computeVWAP(prices100.slice(-24));

    const rsiSignal: "overbought" | "oversold" | "neutral" =
      rsi >= 70 ? "overbought" : rsi <= 30 ? "oversold" : "neutral";

    return {
      symbol: asset.symbol,
      name: asset.name,
      ticker: asset.ticker,
      sector: asset.sector,
      mcapRank: asset.mcap,
      price: +price.toFixed(asset.base < 0.001 ? 8 : asset.base < 1 ? 4 : 2),
      change24h,
      change7d,
      volume24h,
      rsi,
      rsiSignal,
      macd,
      trend,
      bbPosition: bb,
      vwap: +vwap.toFixed(asset.base < 0.001 ? 8 : asset.base < 1 ? 4 : 2),
      updatedAt: now,
    };
  });

  res.json(data);
});

// ── 2. HEATMAP ───────────────────────────────────────────────────────

router.get("/tools/heatmap", (_req, res) => {
  const cells = ASSETS.map(asset => {
    const prices = generatePrices(asset.symbol, asset.base, 200, 3_600_000);
    const last = prices[prices.length - 1];

    const change1h  = +((last - prices[Math.max(0, prices.length - 2)]) / prices[Math.max(0, prices.length - 2)] * 100).toFixed(2);
    const change4h  = +((last - prices[Math.max(0, prices.length - 5)]) / prices[Math.max(0, prices.length - 5)] * 100).toFixed(2);
    const change24h = +((last - prices[Math.max(0, prices.length - 25)]) / prices[Math.max(0, prices.length - 25)] * 100).toFixed(2);
    const change7d  = +((last - prices[Math.max(0, prices.length - 50)]) / prices[Math.max(0, prices.length - 50)] * 100).toFixed(2);
    const change30d = +((last - prices[Math.max(0, prices.length - 150)]) / prices[Math.max(0, prices.length - 150)] * 100).toFixed(2);

    const rngMcap = mulberry32(strSeed(asset.symbol + "mcap"));
    const marketCapB = +(asset.base * (10_000_000 + rngMcap() * 500_000_000) / 1_000_000_000).toFixed(1);

    return {
      symbol: asset.symbol,
      ticker: asset.ticker,
      name: asset.name,
      sector: asset.sector,
      price: +last.toFixed(asset.base < 0.001 ? 8 : asset.base < 1 ? 4 : 2),
      change1h,
      change4h,
      change24h,
      change7d,
      change30d,
      marketCapB,
      mcapRank: asset.mcap,
    };
  });

  res.json(cells);
});

// ── 3. ORDER BOOK / DEPTH CHART ───────────────────────────────────────

router.get("/tools/depth/:symbol", (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const asset = ASSETS.find(a => a.symbol === symbol) ?? ASSETS[0];
  const prices = generatePrices(asset.symbol, asset.base, 50, 300_000);
  const midPrice = prices[prices.length - 1];

  const rng = mulberry32(timeSeed(symbol + "depth", 60_000));
  const levels = 25;

  const bids: { price: number; size: number; total: number }[] = [];
  const asks: { price: number; size: number; total: number }[] = [];

  let bidCum = 0;
  let askCum = 0;

  for (let i = 0; i < levels; i++) {
    const spread = asset.base < 1 ? midPrice * 0.0004 : midPrice * 0.0001;
    const bidPrice = midPrice - spread - i * midPrice * 0.0008 * (1 + rng() * 0.5);
    const askPrice = midPrice + spread + i * midPrice * 0.0008 * (1 + rng() * 0.5);

    const bidSize = +(0.1 + rng() * (i === 0 ? 2 : 5 + rng() * 10)).toFixed(4);
    const askSize = +(0.1 + rng() * (i === 0 ? 2 : 5 + rng() * 10)).toFixed(4);

    bidCum += bidSize;
    askCum += askSize;

    bids.push({ price: +bidPrice.toFixed(asset.base < 0.001 ? 8 : asset.base < 1 ? 5 : 2), size: bidSize, total: +bidCum.toFixed(4) });
    asks.push({ price: +askPrice.toFixed(asset.base < 0.001 ? 8 : asset.base < 1 ? 5 : 2), size: askSize, total: +askCum.toFixed(4) });
  }

  res.json({
    symbol: asset.symbol,
    ticker: asset.ticker,
    midPrice: +midPrice.toFixed(asset.base < 0.001 ? 8 : asset.base < 1 ? 4 : 2),
    bids: bids.sort((a, b) => b.price - a.price),
    asks: asks.sort((a, b) => a.price - b.price),
  });
});

// ── 4. CORRELATION MATRIX ─────────────────────────────────────────────

router.get("/tools/correlation", (req, res) => {
  const tf = (req.query.timeframe as string) ?? "30d";
  const steps = tf === "7d" ? 48 : tf === "90d" ? 180 : 90;

  const subset = ASSETS.slice(0, 12);

  const windowMs = tf === "7d" ? 1_800_000 : tf === "90d" ? 7_200_000 : 3_600_000;
  const series = subset.map(a => {
    const raw = generatePrices(a.symbol + tf, a.base, steps + 1, windowMs);
    return raw.slice(1).map((v, i) => (v - raw[i]) / raw[i]);
  });

  const matrix: number[][] = subset.map((_, i) =>
    subset.map((__, j) => {
      if (i === j) return 1;
      const xi = series[i];
      const xj = series[j];
      const n = xi.length;
      const meanI = xi.reduce((s, v) => s + v, 0) / n;
      const meanJ = xj.reduce((s, v) => s + v, 0) / n;
      const num = xi.reduce((s, v, k) => s + (v - meanI) * (xj[k] - meanJ), 0);
      const stdI = Math.sqrt(xi.reduce((s, v) => s + (v - meanI) ** 2, 0));
      const stdJ = Math.sqrt(xj.reduce((s, v) => s + (v - meanJ) ** 2, 0));
      if (stdI === 0 || stdJ === 0) return 0;
      return +Math.max(-1, Math.min(1, num / (stdI * stdJ))).toFixed(3);
    })
  );

  res.json({
    assets: subset.map(a => ({ symbol: a.symbol, ticker: a.ticker, name: a.name })),
    matrix,
    timeframe: tf,
  });
});

// ── 5. ECONOMIC CALENDAR ─────────────────────────────────────────────

const BASE_EVENTS = [
  { country: "US",  flag: "🇺🇸", event: "Non-Farm Payrolls",             impact: "high",   category: "Employment",   currency: "USD" },
  { country: "US",  flag: "🇺🇸", event: "CPI m/m",                       impact: "high",   category: "Inflation",    currency: "USD" },
  { country: "US",  flag: "🇺🇸", event: "FOMC Statement",                impact: "high",   category: "Monetary",     currency: "USD" },
  { country: "US",  flag: "🇺🇸", event: "GDP q/q",                       impact: "high",   category: "Growth",       currency: "USD" },
  { country: "US",  flag: "🇺🇸", event: "Initial Jobless Claims",        impact: "medium", category: "Employment",   currency: "USD" },
  { country: "US",  flag: "🇺🇸", event: "ISM Manufacturing PMI",         impact: "medium", category: "Business",     currency: "USD" },
  { country: "US",  flag: "🇺🇸", event: "Retail Sales m/m",              impact: "medium", category: "Consumer",     currency: "USD" },
  { country: "US",  flag: "🇺🇸", event: "PPI m/m",                       impact: "medium", category: "Inflation",    currency: "USD" },
  { country: "EU",  flag: "🇪🇺", event: "ECB Interest Rate Decision",    impact: "high",   category: "Monetary",     currency: "EUR" },
  { country: "EU",  flag: "🇪🇺", event: "CPI Flash Estimate y/y",        impact: "high",   category: "Inflation",    currency: "EUR" },
  { country: "EU",  flag: "🇪🇺", event: "PMI Manufacturing",             impact: "medium", category: "Business",     currency: "EUR" },
  { country: "UK",  flag: "🇬🇧", event: "BoE Interest Rate Decision",    impact: "high",   category: "Monetary",     currency: "GBP" },
  { country: "UK",  flag: "🇬🇧", event: "CPI y/y",                       impact: "high",   category: "Inflation",    currency: "GBP" },
  { country: "JP",  flag: "🇯🇵", event: "BoJ Policy Rate",               impact: "high",   category: "Monetary",     currency: "JPY" },
  { country: "JP",  flag: "🇯🇵", event: "GDP q/q",                       impact: "medium", category: "Growth",       currency: "JPY" },
  { country: "CN",  flag: "🇨🇳", event: "CPI y/y",                       impact: "medium", category: "Inflation",    currency: "CNY" },
  { country: "CN",  flag: "🇨🇳", event: "Trade Balance",                 impact: "medium", category: "Trade",        currency: "CNY" },
  { country: "US",  flag: "🇺🇸", event: "Fed Chair Speech",              impact: "high",   category: "Monetary",     currency: "USD" },
  { country: "US",  flag: "🇺🇸", event: "Consumer Confidence",          impact: "low",    category: "Consumer",     currency: "USD" },
  { country: "DE",  flag: "🇩🇪", event: "IFO Business Climate",         impact: "low",    category: "Business",     currency: "EUR" },
  { country: "CA",  flag: "🇨🇦", event: "BoC Rate Decision",             impact: "high",   category: "Monetary",     currency: "CAD" },
  { country: "AU",  flag: "🇦🇺", event: "RBA Rate Decision",             impact: "high",   category: "Monetary",     currency: "AUD" },
  { country: "US",  flag: "🇺🇸", event: "Core PCE Price Index m/m",      impact: "high",   category: "Inflation",    currency: "USD" },
  { country: "US",  flag: "🇺🇸", event: "Unemployment Rate",             impact: "high",   category: "Employment",   currency: "USD" },
];

function generateCalendarEvents() {
  const rng = mulberry32(strSeed("calendar" + Math.floor(Date.now() / 86_400_000).toString()));
  const now = Date.now();
  const events: object[] = [];

  for (let d = -2; d <= 7; d++) {
    const dayStart = now - (now % 86_400_000) + d * 86_400_000;
    const dayEvents = Math.floor(2 + rng() * 4);
    const used = new Set<number>();

    for (let e = 0; e < dayEvents; e++) {
      let idx: number;
      do { idx = Math.floor(rng() * BASE_EVENTS.length); } while (used.has(idx));
      used.add(idx);

      const base = BASE_EVENTS[idx];
      const hour = 8 + Math.floor(rng() * 10);
      const minute = [0, 15, 30, 45][Math.floor(rng() * 4)];
      const timestamp = dayStart + hour * 3_600_000 + minute * 60_000;

      const prevVal = +(rng() * 4 - 1.5).toFixed(1);
      const forecastVal = +(prevVal + (rng() - 0.5) * 0.6).toFixed(1);
      const isFuture = timestamp > now;
      const actualVal = isFuture ? null : +(forecastVal + (rng() - 0.5) * 0.4).toFixed(1);

      events.push({
        id: `${d}-${e}`,
        timestamp,
        date: new Date(timestamp).toISOString().split("T")[0],
        time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        country: base.country,
        flag: base.flag,
        event: base.event,
        currency: base.currency,
        impact: base.impact,
        category: base.category,
        previous: `${prevVal}%`,
        forecast: `${forecastVal}%`,
        actual: actualVal !== null ? `${actualVal}%` : null,
        surprise: actualVal !== null
          ? actualVal > forecastVal ? "beat" : actualVal < forecastVal ? "miss" : "inline"
          : null,
      });
    }
  }

  return events.sort((a: any, b: any) => a.timestamp - b.timestamp);
}

router.get("/tools/calendar", (_req, res) => {
  res.json(generateCalendarEvents());
});

// ── 6. FUNDING RATES ─────────────────────────────────────────────────

router.get("/tools/funding-rates", (_req, res) => {
  const now = Date.now();
  const nextFunding = now + (8 * 3_600_000 - (now % (8 * 3_600_000)));

  const PERPS = ASSETS.slice(0, 16);

  const rates = PERPS.map(asset => {
    const rng = mulberry32(timeSeed(asset.symbol + "fr", 1_800_000));
    const rng7d = mulberry32(strSeed(asset.symbol + "fr7d"));

    const current = +((rng() - 0.45) * 0.002).toFixed(6);
    const h8avg = +((rng() - 0.45) * 0.0015).toFixed(6);
    const d7avg = +((rng7d() - 0.45) * 0.001).toFixed(6);
    const annualized = +(current * 3 * 365 * 100).toFixed(2);

    const prices = generatePrices(asset.symbol, asset.base, 10, 300_000);
    const price = prices[prices.length - 1];
    const rngOI = mulberry32(timeSeed(asset.symbol + "oi", 3_600_000));
    const openInterestM = +((asset.base * 1_000_000 * (5 + rngOI() * 50)) / 1_000_000).toFixed(1);

    const sentiment: "long_biased" | "short_biased" | "neutral" =
      current > 0.0002 ? "long_biased" : current < -0.0002 ? "short_biased" : "neutral";

    return {
      symbol: asset.symbol,
      ticker: asset.ticker,
      name: asset.name,
      price: +price.toFixed(asset.base < 0.001 ? 8 : asset.base < 1 ? 4 : 2),
      currentRate: current,
      currentRatePct: +(current * 100).toFixed(4),
      h8avg: +(h8avg * 100).toFixed(4),
      d7avg: +(d7avg * 100).toFixed(4),
      annualizedPct: annualized,
      nextFundingMs: nextFunding,
      openInterestM,
      sentiment,
    };
  });

  res.json({ rates, updatedAt: now });
});

export default router;
