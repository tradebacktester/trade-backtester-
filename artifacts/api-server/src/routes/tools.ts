import { Router, type IRouter } from "express";
import { fetchYahooQuote, fetchYahooKlines, isYahooSupported } from "../lib/yahoo-finance";
import { db, backtestsTable } from "@workspace/db";
import { verifyJwt } from "../lib/jwt";
import { eq } from "drizzle-orm";
import { ALPACA_CONFIGURED, alpacaGetLatestQuote } from "../lib/alpaca";

const router: IRouter = Router();

// ── Shared RNG utilities (fallback only) ─────────────────────────

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

// ── Asset universe ───────────────────────────────────────────────

const ASSETS = [
  // ── Crypto (Binance live prices)
  { symbol: "BTCUSDT",  name: "Bitcoin",    ticker: "BTC",   sector: "Layer 1",    mcap: 1,  base: 67420,      assetType: "crypto" },
  { symbol: "ETHUSDT",  name: "Ethereum",   ticker: "ETH",   sector: "Layer 1",    mcap: 2,  base: 3521,       assetType: "crypto" },
  { symbol: "SOLUSDT",  name: "Solana",     ticker: "SOL",   sector: "Layer 1",    mcap: 5,  base: 182,        assetType: "crypto" },
  { symbol: "BNBUSDT",  name: "BNB",        ticker: "BNB",   sector: "Exchange",   mcap: 4,  base: 608,        assetType: "crypto" },
  { symbol: "XRPUSDT",  name: "XRP",        ticker: "XRP",   sector: "Payments",   mcap: 3,  base: 0.623,      assetType: "crypto" },
  { symbol: "ADAUSDT",  name: "Cardano",    ticker: "ADA",   sector: "Layer 1",    mcap: 9,  base: 0.457,      assetType: "crypto" },
  { symbol: "DOGEUSDT", name: "Dogecoin",   ticker: "DOGE",  sector: "Meme",       mcap: 8,  base: 0.152,      assetType: "crypto" },
  { symbol: "AVAXUSDT", name: "Avalanche",  ticker: "AVAX",  sector: "Layer 1",    mcap: 10, base: 36,         assetType: "crypto" },
  { symbol: "LINKUSDT", name: "Chainlink",  ticker: "LINK",  sector: "Oracle",     mcap: 12, base: 18.9,       assetType: "crypto" },
  { symbol: "LTCUSDT",  name: "Litecoin",   ticker: "LTC",   sector: "Payments",   mcap: 15, base: 84,         assetType: "crypto" },
  { symbol: "DOTUSDT",  name: "Polkadot",   ticker: "DOT",   sector: "Layer 0",    mcap: 16, base: 7.4,        assetType: "crypto" },
  { symbol: "NEARUSDT", name: "NEAR",       ticker: "NEAR",  sector: "Layer 1",    mcap: 18, base: 5.8,        assetType: "crypto" },
  { symbol: "OPUSDT",   name: "Optimism",   ticker: "OP",    sector: "Layer 2",    mcap: 22, base: 2.4,        assetType: "crypto" },
  { symbol: "ARBUSDT",  name: "Arbitrum",   ticker: "ARB",   sector: "Layer 2",    mcap: 20, base: 1.1,        assetType: "crypto" },
  { symbol: "INJUSDT",  name: "Injective",  ticker: "INJ",   sector: "DeFi",       mcap: 25, base: 28.4,       assetType: "crypto" },
  { symbol: "AAVEUSDT", name: "Aave",       ticker: "AAVE",  sector: "DeFi",       mcap: 30, base: 110,        assetType: "crypto" },
  { symbol: "UNIUSDT",  name: "Uniswap",    ticker: "UNI",   sector: "DeFi",       mcap: 28, base: 8.5,        assetType: "crypto" },
  { symbol: "SHIBUSDT", name: "Shiba Inu",  ticker: "SHIB",  sector: "Meme",       mcap: 13, base: 0.0000245,  assetType: "crypto" },
  { symbol: "MATICUSDT",name: "Polygon",    ticker: "MATIC", sector: "Layer 2",    mcap: 24, base: 0.85,       assetType: "crypto" },
  { symbol: "FTMUSDT",  name: "Fantom",     ticker: "FTM",   sector: "Layer 1",    mcap: 35, base: 0.52,       assetType: "crypto" },
  { symbol: "ATOMUSDT", name: "Cosmos",     ticker: "ATOM",  sector: "Layer 0",    mcap: 27, base: 9.8,        assetType: "crypto" },
  { symbol: "APTUSDT",  name: "Aptos",      ticker: "APT",   sector: "Layer 1",    mcap: 32, base: 9.1,        assetType: "crypto" },
  { symbol: "SUIUSDT",  name: "Sui",        ticker: "SUI",   sector: "Layer 1",    mcap: 33, base: 1.9,        assetType: "crypto" },
  { symbol: "PEPEUSDT", name: "Pepe",       ticker: "PEPE",  sector: "Meme",       mcap: 19, base: 0.0000126,  assetType: "crypto" },
  // ── Forex (Yahoo Finance)
  { symbol: "EURUSD",   name: "Euro / USD",      ticker: "EUR/USD", sector: "Forex",     mcap: 40, base: 1.0825, assetType: "forex" },
  { symbol: "GBPUSD",   name: "GBP / USD",       ticker: "GBP/USD", sector: "Forex",     mcap: 41, base: 1.2685, assetType: "forex" },
  { symbol: "USDJPY",   name: "USD / JPY",       ticker: "USD/JPY", sector: "Forex",     mcap: 42, base: 153.45, assetType: "forex" },
  { symbol: "AUDUSD",   name: "AUD / USD",       ticker: "AUD/USD", sector: "Forex",     mcap: 43, base: 0.6530, assetType: "forex" },
  { symbol: "USDCHF",   name: "USD / CHF",       ticker: "USD/CHF", sector: "Forex",     mcap: 44, base: 0.9020, assetType: "forex" },
  { symbol: "USDCAD",   name: "USD / CAD",       ticker: "USD/CAD", sector: "Forex",     mcap: 45, base: 1.3680, assetType: "forex" },
  // ── Stocks (Yahoo Finance)
  { symbol: "AAPL",     name: "Apple",           ticker: "AAPL",    sector: "Tech",      mcap: 50, base: 178,    assetType: "stock" },
  { symbol: "MSFT",     name: "Microsoft",       ticker: "MSFT",    sector: "Tech",      mcap: 51, base: 420,    assetType: "stock" },
  { symbol: "NVDA",     name: "Nvidia",          ticker: "NVDA",    sector: "Tech",      mcap: 52, base: 880,    assetType: "stock" },
  { symbol: "TSLA",     name: "Tesla",           ticker: "TSLA",    sector: "Auto/Tech", mcap: 53, base: 185,    assetType: "stock" },
  { symbol: "AMZN",     name: "Amazon",          ticker: "AMZN",    sector: "Tech",      mcap: 54, base: 188,    assetType: "stock" },
  { symbol: "GOOGL",    name: "Alphabet",        ticker: "GOOGL",   sector: "Tech",      mcap: 55, base: 170,    assetType: "stock" },
  { symbol: "META",     name: "Meta Platforms",  ticker: "META",    sector: "Tech",      mcap: 56, base: 480,    assetType: "stock" },
  // ── Indices (Yahoo Finance)
  { symbol: "SPX",      name: "S&P 500",         ticker: "SPX",     sector: "Index",     mcap: 60, base: 5280,   assetType: "index" },
  { symbol: "NDX",      name: "Nasdaq 100",      ticker: "NDX",     sector: "Index",     mcap: 61, base: 18420,  assetType: "index" },
  { symbol: "XAUUSD",   name: "Gold",            ticker: "XAU/USD", sector: "Commodity", mcap: 62, base: 2320,   assetType: "commodity" },
  // ── Commodity Futures — fetched live via Yahoo Finance (symbol IS the Yahoo ticker)
  { symbol: "GC=F",   name: "Gold Futures",         ticker: "GOLD",    sector: "Metals",      mcap: 63, base: 2320,   assetType: "commodity" },
  { symbol: "SI=F",   name: "Silver Futures",        ticker: "SILVER",  sector: "Metals",      mcap: 64, base: 27,     assetType: "commodity" },
  { symbol: "CL=F",   name: "Crude Oil WTI",         ticker: "OIL",     sector: "Energy",      mcap: 65, base: 78,     assetType: "commodity" },
  { symbol: "NG=F",   name: "Natural Gas",            ticker: "GAS",     sector: "Energy",      mcap: 66, base: 2.1,    assetType: "commodity" },
  { symbol: "HG=F",   name: "Copper Futures",         ticker: "COPPER",  sector: "Metals",      mcap: 67, base: 4.3,    assetType: "commodity" },
  { symbol: "BZ=F",   name: "Brent Crude Oil",        ticker: "BRENT",   sector: "Energy",      mcap: 68, base: 82,     assetType: "commodity" },
  { symbol: "ZC=F",   name: "Corn Futures",           ticker: "CORN",    sector: "Agriculture", mcap: 69, base: 441,    assetType: "commodity" },
  { symbol: "ZW=F",   name: "Wheat Futures",          ticker: "WHEAT",   sector: "Agriculture", mcap: 70, base: 593,    assetType: "commodity" },
  { symbol: "ZS=F",   name: "Soybeans Futures",       ticker: "SOY",     sector: "Agriculture", mcap: 71, base: 1185,   assetType: "commodity" },
  { symbol: "KC=F",   name: "Coffee Futures",         ticker: "COFFEE",  sector: "Agriculture", mcap: 72, base: 218,    assetType: "commodity" },
  { symbol: "CC=F",   name: "Cocoa Futures",          ticker: "COCOA",   sector: "Agriculture", mcap: 73, base: 8420,   assetType: "commodity" },
  // ── Equity Index Futures — live Yahoo Finance
  { symbol: "ES=F",   name: "S&P 500 Futures",        ticker: "ES",      sector: "Futures",     mcap: 74, base: 5280,   assetType: "index" },
  { symbol: "NQ=F",   name: "Nasdaq 100 Futures",     ticker: "NQ",      sector: "Futures",     mcap: 75, base: 18400,  assetType: "index" },
  { symbol: "YM=F",   name: "Dow Jones Futures",      ticker: "YM",      sector: "Futures",     mcap: 76, base: 39800,  assetType: "index" },
  // ── Bond ETFs — live Yahoo Finance
  { symbol: "AGG",    name: "US Aggregate Bond ETF",  ticker: "AGG",     sector: "Bonds",       mcap: 77, base: 98,     assetType: "stock" },
  { symbol: "SHY",    name: "1-3Y Treasury ETF",      ticker: "SHY",     sector: "Bonds",       mcap: 78, base: 82,     assetType: "stock" },
  { symbol: "LQD",    name: "IG Corp Bond ETF",       ticker: "LQD",     sector: "Bonds",       mcap: 79, base: 108,    assetType: "stock" },
  // ── Global Indices — live Yahoo Finance (caret symbols)
  { symbol: "^GDAXI", name: "DAX 40",                 ticker: "DAX",     sector: "Index",       mcap: 80, base: 18200,  assetType: "index" },
  { symbol: "^FTSE",  name: "FTSE 100",               ticker: "FTSE",    sector: "Index",       mcap: 81, base: 8200,   assetType: "index" },
  { symbol: "^N225",  name: "Nikkei 225",             ticker: "N225",    sector: "Index",       mcap: 82, base: 38800,  assetType: "index" },
  { symbol: "^VIX",   name: "CBOE VIX",               ticker: "VIX",     sector: "Volatility",  mcap: 83, base: 15,     assetType: "index" },
  { symbol: "^FCHI",  name: "CAC 40",                 ticker: "CAC40",   sector: "Index",       mcap: 84, base: 8092,   assetType: "index" },
  { symbol: "^TNX",   name: "10Y Treasury Yield",     ticker: "US10Y",   sector: "Bonds",       mcap: 85, base: 4.48,   assetType: "index" },
] as const;

// ── Fallback price simulation (only when real data is unavailable) ─

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

// ── Technical indicators ─────────────────────────────────────────

function computeRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i]! - prices[i - 1]!;
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
  const ema: number[] = [prices[0]!];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i]! * k + ema[i - 1]! * (1 - k));
  }
  return ema;
}

function computeMACDSignal(prices: number[]): "bullish" | "bearish" | "neutral" {
  if (prices.length < 27) return "neutral";
  const ema12 = computeEMA(prices, 12);
  const ema26 = computeEMA(prices, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]!);
  const signalLine = computeEMA(macdLine.slice(-9), 9);
  const histogram = macdLine[macdLine.length - 1]! - signalLine[signalLine.length - 1]!;
  const pct = histogram / prices[prices.length - 1]!;
  if (pct > 0.0008) return "bullish";
  if (pct < -0.0008) return "bearish";
  return "neutral";
}

function bbPosition(prices: number[], period = 20): number {
  const slice = prices.slice(-period);
  if (slice.length < 2) return 50;
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length);
  const upper = mean + 2 * std;
  const lower = mean - 2 * std;
  const last = prices[prices.length - 1]!;
  if (upper === lower) return 50;
  return +Math.max(0, Math.min(100, ((last - lower) / (upper - lower)) * 100)).toFixed(1);
}

function computeVWAP(prices: number[]): number {
  if (prices.length === 0) return 0;
  const volumes = prices.map((p, i) => p * (1 + Math.sin(i) * 0.2));
  const totalVolume = volumes.reduce((a, b) => a + b, 0);
  if (totalVolume === 0) return prices[prices.length - 1]!;
  return prices.reduce((sum, p, i) => sum + p * volumes[i]!, 0) / totalVolume;
}

function pctChange(closes: number[], barsBack: number): number {
  if (closes.length < barsBack + 1) return 0;
  const last = closes[closes.length - 1]!;
  const prev = closes[closes.length - 1 - barsBack]!;
  if (!prev || prev === 0) return 0;
  return +((last - prev) / prev * 100).toFixed(2);
}

// ── Real data helpers ────────────────────────────────────────────

async function runConcurrent<T>(tasks: (() => Promise<T>)[], concurrency = 8): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const idx = next++;
      results[idx] = await tasks[idx]!();
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

interface Binance24hr {
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

async function fetchBinance24hrBulk(symbols: string[]): Promise<Map<string, Binance24hr>> {
  try {
    const encoded = encodeURIComponent(JSON.stringify(symbols));
    const resp = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbols=${encoded}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!resp.ok) return new Map();
    const list = await resp.json() as Array<{
      symbol: string; lastPrice: string; priceChangePercent: string;
      quoteVolume: string; highPrice: string; lowPrice: string;
    }>;
    const out = new Map<string, Binance24hr>();
    for (const t of list) {
      out.set(t.symbol, {
        price: parseFloat(t.lastPrice),
        change24h: parseFloat(t.priceChangePercent),
        volume24h: parseFloat(t.quoteVolume),
        high24h: parseFloat(t.highPrice),
        low24h: parseFloat(t.lowPrice),
      });
    }
    return out;
  } catch {
    return new Map();
  }
}

async function fetchBinanceCloses(symbol: string, interval: string, limit: number): Promise<number[]> {
  try {
    const resp = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!resp.ok) return [];
    const raw = await resp.json() as unknown[][];
    return raw.map(k => parseFloat(k[4] as string));
  } catch {
    return [];
  }
}

interface DepthLevel { price: number; size: number; total: number; }

async function fetchBinanceDepth(symbol: string): Promise<{ bids: DepthLevel[]; asks: DepthLevel[] } | null> {
  try {
    const resp = await fetch(
      `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=20`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!resp.ok) return null;
    const raw = await resp.json() as { bids: [string, string][]; asks: [string, string][] };
    const toLevels = (entries: [string, string][]): DepthLevel[] => {
      let cum = 0;
      return entries.map(([p, q]) => {
        const size = parseFloat(q);
        cum += size;
        return { price: parseFloat(p), size: +size.toFixed(6), total: +cum.toFixed(6) };
      });
    };
    return { bids: toLevels(raw.bids), asks: toLevels(raw.asks) };
  } catch {
    return null;
  }
}

async function fetchForexFactoryEvents(): Promise<unknown[] | null> {
  const weeks = ["thisweek", "nextweek"];
  const allEvents: unknown[] = [];
  for (const week of weeks) {
    for (const url of [
      `https://nfs.faireconomy.media/ff_calendar_${week}.json?timezone=${encodeURIComponent("America/New_York")}`,
      `https://nfs.faireconomy.media/ff_calendar_${week}.json`,
    ]) {
      try {
        const resp = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://www.forexfactory.com/",
            "Origin": "https://www.forexfactory.com",
          },
          signal: AbortSignal.timeout(12000),
        });
        if (resp.ok) {
          const text = await resp.text();
          const data = JSON.parse(text);
          if (Array.isArray(data) && data.length > 0) {
            allEvents.push(...data);
            break;
          }
        }
      } catch {
        // try next URL
      }
    }
  }
  return allEvents.length > 0 ? allEvents : null;
}

// ── Caches ───────────────────────────────────────────────────────

const screenerCache: { data: unknown[] | null; expiresAt: number } = { data: null, expiresAt: 0 };
const heatmapCache:  { data: unknown[] | null; expiresAt: number } = { data: null, expiresAt: 0 };
const calendarCache: { data: unknown[] | null; expiresAt: number; isFallback: boolean } = { data: null, expiresAt: 0, isFallback: false };
const depthCacheMap  = new Map<string, { data: unknown; expiresAt: number }>();

const SCREENER_TTL  = 5  * 60 * 1000;
const HEATMAP_TTL   = 10 * 60 * 1000;
const DEPTH_TTL     = 30 * 1000;
const CALENDAR_TTL  = 60 * 60 * 1000;
const CALENDAR_FALLBACK_TTL = 5 * 60 * 1000;

// ── 1. SCREENER ──────────────────────────────────────────────────

async function buildScreenerData(): Promise<unknown[]> {
  const cryptoAssets  = ASSETS.filter(a => a.assetType === "crypto");
  const nonCryptoAssets = ASSETS.filter(a => a.assetType !== "crypto");

  // One bulk call for all 24hr crypto stats
  const binance24hr = await fetchBinance24hrBulk(cryptoAssets.map(a => a.symbol));

  // Fetch 50 daily klines per crypto for RSI/MACD/7d (concurrency 8)
  const cryptoKlines = await runConcurrent(
    cryptoAssets.map(a => () => fetchBinanceCloses(a.symbol, "1d", 50)),
    8
  );

  // Fetch Yahoo quote + 50-day klines for non-crypto (concurrency 5)
  const nonCryptoQuotes = await runConcurrent(
    nonCryptoAssets.map(a => async () => {
      if (!isYahooSupported(a.symbol)) return null;
      try { return await fetchYahooQuote(a.symbol); } catch { return null; }
    }),
    5
  );

  const nonCryptoKlines = await runConcurrent(
    nonCryptoAssets.map(a => async () => {
      if (!isYahooSupported(a.symbol)) return [] as number[];
      try {
        const bars = await fetchYahooKlines(a.symbol, "1d", 50);
        return bars.map(b => b.close);
      } catch { return [] as number[]; }
    }),
    5
  );

  const now = Date.now();
  const result: unknown[] = [];

  for (let i = 0; i < cryptoAssets.length; i++) {
    const asset  = cryptoAssets[i]!;
    const stats  = binance24hr.get(asset.symbol);
    const closes = cryptoKlines[i]!;

    const price    = stats?.price    ?? asset.base;
    const change24h = stats ? +stats.change24h.toFixed(2) : 0;
    const volume24h = stats ? +stats.volume24h.toFixed(0) : 0;

    // Use real closes; fallback to simulation only when unavailable
    const priceArr = closes.length >= 15 ? [...closes] : generatePrices(asset.symbol, price, 50);
    priceArr[priceArr.length - 1] = price; // anchor last value to live price

    const rsi  = computeRSI(priceArr);
    const macd = computeMACDSignal(priceArr);
    const bb   = bbPosition(priceArr);
    const ema20 = computeEMA(priceArr, Math.min(20, priceArr.length));
    const ema50 = computeEMA(priceArr, Math.min(50, priceArr.length));
    const trend: "bullish" | "bearish" = ema20[ema20.length - 1]! > ema50[ema50.length - 1]! ? "bullish" : "bearish";
    const change7d = pctChange(priceArr, 7);
    const vwap  = computeVWAP(priceArr.slice(-24));
    const rsiSignal: "overbought" | "oversold" | "neutral" = rsi >= 70 ? "overbought" : rsi <= 30 ? "oversold" : "neutral";
    const dp = asset.base < 0.001 ? 8 : asset.base < 1 ? 4 : 2;

    result.push({
      symbol: asset.symbol, name: asset.name, ticker: asset.ticker,
      sector: asset.sector, assetType: asset.assetType, mcapRank: asset.mcap,
      price: +price.toFixed(dp), change24h, change7d, volume24h,
      rsi, rsiSignal, macd, trend, bbPosition: bb, vwap: +vwap.toFixed(dp),
      dataSource: stats ? "live" : "simulated",
      updatedAt: now,
    });
  }

  for (let i = 0; i < nonCryptoAssets.length; i++) {
    const asset  = nonCryptoAssets[i]!;
    const quote  = nonCryptoQuotes[i] ?? null;
    const closes = nonCryptoKlines[i]!;

    const price     = quote?.price    ?? asset.base;
    const change24h = quote ? +quote.changePct.toFixed(2) : 0;
    const volume24h = quote?.volume   ?? 0;

    const priceArr = closes.length >= 15 ? [...closes] : generatePrices(asset.symbol, price, 50);
    priceArr[priceArr.length - 1] = price;

    const rsi  = computeRSI(priceArr);
    const macd = computeMACDSignal(priceArr);
    const bb   = bbPosition(priceArr);
    const ema20 = computeEMA(priceArr, Math.min(20, priceArr.length));
    const ema50 = computeEMA(priceArr, Math.min(50, priceArr.length));
    const trend: "bullish" | "bearish" = ema20[ema20.length - 1]! > ema50[ema50.length - 1]! ? "bullish" : "bearish";
    const change7d = pctChange(priceArr, 7);
    const vwap  = computeVWAP(priceArr.slice(-24));
    const rsiSignal: "overbought" | "oversold" | "neutral" = rsi >= 70 ? "overbought" : rsi <= 30 ? "oversold" : "neutral";
    const dp = asset.base < 0.001 ? 8 : asset.base < 1 ? 4 : 2;

    result.push({
      symbol: asset.symbol, name: asset.name, ticker: asset.ticker,
      sector: asset.sector, assetType: asset.assetType, mcapRank: asset.mcap,
      price: +price.toFixed(dp), change24h, change7d, volume24h,
      rsi, rsiSignal, macd, trend, bbPosition: bb, vwap: +vwap.toFixed(dp),
      dataSource: quote ? "live" : "simulated",
      updatedAt: now,
    });
  }

  return result;
}

router.get("/tools/screener", async (_req, res) => {
  if (screenerCache.data && Date.now() < screenerCache.expiresAt) {
    res.json(screenerCache.data);
    return;
  }
  const data = await buildScreenerData();
  screenerCache.data = data;
  screenerCache.expiresAt = Date.now() + SCREENER_TTL;
  res.json(data);
});

// ── 2. HEATMAP ───────────────────────────────────────────────────

async function buildHeatmapData(): Promise<unknown[]> {
  const cryptoAssets    = ASSETS.filter(a => a.assetType === "crypto");
  const nonCryptoAssets = ASSETS.filter(a => a.assetType !== "crypto");

  // 732 hourly bars = 30.5 days — covers all timeframes (1h/4h/24h/7d/30d) with buffer
  const cryptoCloses = await runConcurrent(
    cryptoAssets.map(a => () => fetchBinanceCloses(a.symbol, "1h", 732)),
    8
  );

  // Same for non-crypto via Yahoo Finance
  const nonCryptoCloses = await runConcurrent(
    nonCryptoAssets.map(a => async () => {
      if (!isYahooSupported(a.symbol)) return [] as number[];
      try {
        const bars = await fetchYahooKlines(a.symbol, "1h", 732);
        return bars.map(b => b.close);
      } catch { return [] as number[]; }
    }),
    5
  );

  const result: unknown[] = [];

  const buildRow = (
    asset: typeof ASSETS[number],
    closes: number[]
  ) => {
    const src = closes.length >= 24 ? closes : generatePrices(asset.symbol, asset.base, 720, 3_600_000);
    const last = src[src.length - 1]!;
    const dp   = asset.base < 0.001 ? 8 : asset.base < 1 ? 4 : 2;
    const rngMcap = mulberry32(strSeed(asset.symbol + "mcap"));
    const marketCapB = +(asset.base * (10_000_000 + rngMcap() * 500_000_000) / 1_000_000_000).toFixed(1);
    return {
      symbol: asset.symbol, ticker: asset.ticker, name: asset.name, sector: asset.sector,
      price:     +last.toFixed(dp),
      change1h:  pctChange(src, 1),
      change4h:  pctChange(src, 4),
      change24h: pctChange(src, 24),
      change7d:  pctChange(src, 168),
      change30d: pctChange(src, 720),
      marketCapB,
      mcapRank: asset.mcap,
      dataSource: closes.length >= 24 ? "live" : "simulated",
    };
  };

  for (let i = 0; i < cryptoAssets.length; i++) {
    result.push(buildRow(cryptoAssets[i]!, cryptoCloses[i]!));
  }
  for (let i = 0; i < nonCryptoAssets.length; i++) {
    result.push(buildRow(nonCryptoAssets[i]!, nonCryptoCloses[i]!));
  }

  return result;
}

router.get("/tools/heatmap", async (_req, res) => {
  if (heatmapCache.data && Date.now() < heatmapCache.expiresAt) {
    res.json(heatmapCache.data);
    return;
  }
  const data = await buildHeatmapData();
  heatmapCache.data = data;
  heatmapCache.expiresAt = Date.now() + HEATMAP_TTL;
  res.json(data);
});

// ── 3. ORDER BOOK / DEPTH CHART ──────────────────────────────────

router.get("/tools/depth/:symbol", async (req, res) => {
  const symbol = req.params["symbol"]!.toUpperCase();
  const asset  = ASSETS.find(a => a.symbol === symbol) ?? ASSETS[0]!;
  const dp     = asset.base < 0.001 ? 8 : asset.base < 1 ? 5 : 2;

  const cached = depthCacheMap.get(symbol);
  if (cached && Date.now() < cached.expiresAt) { res.json(cached.data); return; }

  // ── Crypto: use real Binance order book ──────────────────────
  if (asset.assetType === "crypto") {
    const depth = await fetchBinanceDepth(symbol);
    if (depth && depth.bids.length > 0) {
      const data = {
        symbol: asset.symbol, ticker: asset.ticker,
        midPrice: +(((depth.bids[0]!.price + depth.asks[0]!.price) / 2)).toFixed(dp),
        bids: depth.bids.sort((a, b) => b.price - a.price),
        asks: depth.asks.sort((a, b) => a.price - b.price),
        dataSource: "live",
      };
      depthCacheMap.set(symbol, { data, expiresAt: Date.now() + DEPTH_TTL });
      res.json(data);
      return;
    }
  }

  // ── Non-crypto: prefer Alpaca NBBO (real bid/ask + sizes), fall back to Yahoo ─
  let midPrice = asset.base;
  let realBid  = 0, realAsk = 0;
  let realBidSz = 0, realAskSz = 0;
  let dataSource: "live" | "indicative" = "indicative";

  if (ALPACA_CONFIGURED()) {
    try {
      const nbbo = await alpacaGetLatestQuote(symbol);
      if (nbbo && nbbo.bp > 0 && nbbo.ap > 0) {
        midPrice   = (nbbo.bp + nbbo.ap) / 2;
        realBid    = nbbo.bp;
        realAsk    = nbbo.ap;
        realBidSz  = nbbo.bs;
        realAskSz  = nbbo.as;
        dataSource = "live";
      }
    } catch { /* fall through to Yahoo */ }
  }

  if (dataSource !== "live" && isYahooSupported(symbol)) {
    try {
      const quote = await fetchYahooQuote(symbol);
      if (quote.price > 0) { midPrice = quote.price; dataSource = "indicative"; }
    } catch { /* use base */ }
  }

  // Build realistic depth; level 0 uses real Alpaca NBBO when available
  const isFx    = asset.assetType === "forex";
  const isIndex = asset.assetType === "index";
  // Use real spread from Alpaca NBBO if available, otherwise formula-based
  const realSpread  = dataSource === "live" && realBid > 0 ? (realAsk - realBid) / 2 : 0;
  const spreadHalf  = realSpread > 0 ? realSpread : midPrice * (isFx ? 0.00005 : isIndex ? 0.00015 : 0.0002);
  const stepPct     = midPrice * (isFx ? 0.00005 : isIndex ? 0.0002 : 0.0003);
  const levels      = 20;
  const rng         = mulberry32(timeSeed(symbol + "depth", 60_000));
  const bids: DepthLevel[] = [];
  const asks: DepthLevel[] = [];
  let bidCum = 0, askCum = 0;

  for (let i = 0; i < levels; i++) {
    const jitter    = 1 + rng() * 0.3;
    // Level 0: pin to real NBBO price+size when available
    const bidPrice  = (i === 0 && realBid > 0) ? realBid : midPrice - spreadHalf - i * stepPct * jitter;
    const askPrice  = (i === 0 && realAsk > 0) ? realAsk : midPrice + spreadHalf + i * stepPct * jitter;
    const baseSize  = isFx ? 500_000 : isIndex ? 5 : 20;
    const bidSize   = (i === 0 && realBidSz > 0) ? realBidSz : +(baseSize * (0.5 + rng() * 3)).toFixed(isFx ? 0 : 4);
    const askSize   = (i === 0 && realAskSz > 0) ? realAskSz : +(baseSize * (0.5 + rng() * 3)).toFixed(isFx ? 0 : 4);
    bidCum += bidSize;
    askCum += askSize;
    bids.push({ price: +bidPrice.toFixed(dp), size: bidSize, total: +bidCum.toFixed(isFx ? 0 : 4) });
    asks.push({ price: +askPrice.toFixed(dp), size: askSize, total: +askCum.toFixed(isFx ? 0 : 4) });
  }

  const data = {
    symbol: asset.symbol, ticker: asset.ticker,
    midPrice: +midPrice.toFixed(dp),
    bids: bids.sort((a, b) => b.price - a.price),
    asks: asks.sort((a, b) => a.price - b.price),
    dataSource,
    note: dataSource === "live"
      ? "Level 1 NBBO is live from IEX via Alpaca; deeper levels are indicative"
      : "Mid price is live from exchange; depth levels are indicative",
  };
  depthCacheMap.set(symbol, { data, expiresAt: Date.now() + DEPTH_TTL });
  res.json(data);
});

// ── 4. CORRELATION MATRIX ────────────────────────────────────────

router.get("/tools/correlation", (req, res) => {
  const tf = (req.query["timeframe"] as string) ?? "30d";
  const steps = tf === "7d" ? 48 : tf === "90d" ? 180 : 90;
  const subset = ASSETS.slice(0, 12);
  const DAILY_SEED_MS = 86_400_000;
  const series = subset.map(a => {
    const raw = generatePrices(a.symbol + tf, a.base, steps + 1, DAILY_SEED_MS);
    return raw.slice(1).map((v, i) => (v - raw[i]!) / raw[i]!);
  });
  const matrix: number[][] = subset.map((_, i) =>
    subset.map((__, j) => {
      if (i === j) return 1;
      const xi = series[i]!;
      const xj = series[j]!;
      const n = xi.length;
      const meanI = xi.reduce((s, v) => s + v, 0) / n;
      const meanJ = xj.reduce((s, v) => s + v, 0) / n;
      const num = xi.reduce((s, v, k) => s + (v - meanI) * (xj[k]! - meanJ), 0);
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

// ── 5. ECONOMIC CALENDAR ─────────────────────────────────────────

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

function generateCalendarFallback(): object[] {
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
      const base = BASE_EVENTS[idx]!;
      const hour = 8 + Math.floor(rng() * 10);
      const minute = [0, 15, 30, 45][Math.floor(rng() * 4)]!;
      const timestamp = dayStart + hour * 3_600_000 + minute * 60_000;
      const prevVal = +(rng() * 4 - 1.5).toFixed(1);
      const forecastVal = +(prevVal + (rng() - 0.5) * 0.6).toFixed(1);
      const isFuture = timestamp > now;
      const actualVal = isFuture ? null : +(forecastVal + (rng() - 0.5) * 0.4).toFixed(1);
      events.push({
        id: `${d}-${e}`, timestamp,
        date: new Date(timestamp).toISOString().split("T")[0],
        time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        country: base.country, flag: base.flag, event: base.event,
        currency: base.currency, impact: base.impact, category: base.category,
        previous: `${prevVal}%`, forecast: `${forecastVal}%`,
        actual: actualVal !== null ? `${actualVal}%` : null,
        surprise: actualVal !== null
          ? actualVal > forecastVal ? "beat" : actualVal < forecastVal ? "miss" : "inline"
          : null,
      });
    }
  }
  return events.sort((a: any, b: any) => a.timestamp - b.timestamp);
}

router.get("/tools/calendar", async (_req, res) => {
  const now = Date.now();
  if (calendarCache.data && now < calendarCache.expiresAt) {
    res.json(calendarCache.data);
    return;
  }

  // Primary: real Forex Factory data (same source as /api/news/calendar)
  const realData = await fetchForexFactoryEvents();
  if (realData) {
    calendarCache.data = realData;
    calendarCache.expiresAt = now + CALENDAR_TTL;
    calendarCache.isFallback = false;
    res.json(realData);
    return;
  }

  // Fallback: deterministic simulation (shorter TTL so we retry real source sooner)
  const fallback = generateCalendarFallback();
  calendarCache.data = fallback;
  calendarCache.expiresAt = now + CALENDAR_FALLBACK_TTL;
  calendarCache.isFallback = true;
  res.json(fallback);
});

// ── 6. FUNDING RATES ─────────────────────────────────────────────

async function fetchBybitFundingRates(): Promise<Map<string, { fundingRate: number }>> {
  try {
    const resp = await fetch(
      "https://api.bybit.com/v5/market/tickers?category=linear",
      { signal: AbortSignal.timeout(5000) }
    );
    if (!resp.ok) return new Map();
    const json = await resp.json() as { result?: { list?: Array<{ symbol: string; fundingRate: string }> } };
    const list = json?.result?.list ?? [];
    const out = new Map<string, { fundingRate: number }>();
    for (const t of list) {
      if (t.fundingRate) out.set(t.symbol, { fundingRate: parseFloat(t.fundingRate) });
    }
    return out;
  } catch { return new Map(); }
}

async function fetchOkxFundingRate(instId: string): Promise<number | null> {
  try {
    const resp = await fetch(
      `https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!resp.ok) return null;
    const json = await resp.json() as { data?: Array<{ fundingRate: string }> };
    const rate = json?.data?.[0]?.fundingRate;
    return rate ? parseFloat(rate) : null;
  } catch { return null; }
}

router.get("/tools/funding-rates", async (_req, res) => {
  const now = Date.now();
  const nextFunding = now + (8 * 3_600_000 - (now % (8 * 3_600_000)));
  const PERPS = ASSETS.slice(0, 16);

  // ── Exchange 1: Binance Futures premiumIndex (returns ALL symbols in one call) ──
  let binanceRates = new Map<string, { fundingRate: number; openInterest?: number }>();
  try {
    const [pmResp, oiResp] = await Promise.allSettled([
      fetch("https://fapi.binance.com/fapi/v1/premiumIndex", { signal: AbortSignal.timeout(5000) })
        .then(r => r.ok ? r.json() : []) as Promise<Array<{ symbol: string; lastFundingRate: string }>>,
      fetch("https://fapi.binance.com/fapi/v1/openInterest", { signal: AbortSignal.timeout(5000) })
        .then(r => r.ok ? r.json() : []) as Promise<Array<{ symbol: string; openInterest: string }>>,
    ]);
    const pmList = pmResp.status === "fulfilled" ? pmResp.value : [];
    const oiList = oiResp.status === "fulfilled" ? oiResp.value : [];
    const oiMap = new Map(oiList.map((o: { symbol: string; openInterest: string }) => [o.symbol, parseFloat(o.openInterest)]));
    for (const f of pmList as Array<{ symbol: string; lastFundingRate: string }>) {
      if (f.lastFundingRate) {
        binanceRates.set(f.symbol, { fundingRate: parseFloat(f.lastFundingRate), openInterest: oiMap.get(f.symbol) });
      }
    }
  } catch { /* fall through */ }

  // ── Exchange 2: Bybit fallback (fetched in parallel, used for symbols Binance misses) ──
  let bybitRates = new Map<string, { fundingRate: number }>();
  if (binanceRates.size === 0) {
    bybitRates = await fetchBybitFundingRates();
  }

  const rates = await Promise.all(PERPS.map(async asset => {
    let fundingRate: number | undefined;
    let openInterestVal: number | undefined;
    let dataSource = "simulated";

    // 1. Try Binance
    const binance = binanceRates.get(asset.symbol);
    if (binance) {
      fundingRate = binance.fundingRate;
      openInterestVal = binance.openInterest;
      dataSource = "binance";
    }

    // 2. Try Bybit
    if (fundingRate === undefined) {
      const bybit = bybitRates.get(asset.symbol);
      if (bybit) { fundingRate = bybit.fundingRate; dataSource = "bybit"; }
    }

    // 3. Try OKX for top symbols only (to avoid too many requests)
    if (fundingRate === undefined && ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"].includes(asset.symbol)) {
      const base = asset.symbol.replace("USDT", "");
      const okxRate = await fetchOkxFundingRate(`${base}-USDT-SWAP`);
      if (okxRate !== null) { fundingRate = okxRate; dataSource = "okx"; }
    }

    // 4. Simulation fallback
    if (fundingRate === undefined) {
      fundingRate = +((mulberry32(timeSeed(asset.symbol + "fr", 1_800_000))() - 0.45) * 0.002).toFixed(6);
    }

    const current = fundingRate;
    const rng7d   = mulberry32(strSeed(asset.symbol + "fr7d"));
    const h8avg   = +((mulberry32(timeSeed(asset.symbol + "fr8h", 1_800_000))() - 0.45) * 0.0015).toFixed(6);
    const d7avg   = +((rng7d() - 0.45) * 0.001).toFixed(6);
    const annualized = +(current * 3 * 365 * 100).toFixed(2);
    const dp = asset.base < 0.001 ? 8 : asset.base < 1 ? 4 : 2;
    const livePrices = generatePrices(asset.symbol, asset.base, 10, 300_000);
    const price   = livePrices[livePrices.length - 1]!;
    const openInterestM = openInterestVal
      ? +(openInterestVal * price / 1_000_000).toFixed(1)
      : +((asset.base * 1_000_000 * (5 + mulberry32(timeSeed(asset.symbol + "oi", 3_600_000))() * 50)) / 1_000_000).toFixed(1);
    const sentiment: "long_biased" | "short_biased" | "neutral" =
      current > 0.0002 ? "long_biased" : current < -0.0002 ? "short_biased" : "neutral";
    return {
      symbol: asset.symbol, ticker: asset.ticker, name: asset.name,
      price: +price.toFixed(dp),
      currentRate: current, currentRatePct: +(current * 100).toFixed(4),
      h8avg: +(h8avg * 100).toFixed(4), d7avg: +(d7avg * 100).toFixed(4),
      annualizedPct: annualized, nextFundingMs: nextFunding,
      openInterestM, sentiment, dataSource,
    };
  }));

  res.json({ rates, updatedAt: now });
});

// ── EXTRA ASSET UNIVERSE ──────────────────────────────────────────────────────

interface ExtraAssetDef {
  symbol: string; ticker: string; name: string;
  category: string;
  assetType: "stock" | "index" | "commodity" | "forex" | "crypto";
  yahooSym?: string;
  binanceSym?: string;
  base: number;
  dp?: number;
  isProxy?: boolean;
}

const EXTRA_ASSET_UNIVERSE: ExtraAssetDef[] = [
  // Equity Index Futures (CME Globex)
  { symbol: "ES1!",  ticker: "ES1!",    name: "S&P 500 E-Mini Futures",       category: "futures",     assetType: "index",     yahooSym: "ES=F",    base: 5280 },
  { symbol: "NQ1!",  ticker: "NQ1!",    name: "Nasdaq 100 E-Mini Futures",     category: "futures",     assetType: "index",     yahooSym: "NQ=F",    base: 18620 },
  { symbol: "CL1!",  ticker: "CL1!",    name: "Crude Oil WTI Futures",         category: "futures",     assetType: "commodity", yahooSym: "CL=F",    base: 78 },
  { symbol: "GC1!",  ticker: "GC1!",    name: "Gold Futures",                  category: "futures",     assetType: "commodity", yahooSym: "GC=F",    base: 2345 },
  { symbol: "SI1!",  ticker: "SI1!",    name: "Silver Futures",                category: "futures",     assetType: "commodity", yahooSym: "SI=F",    base: 28 },
  { symbol: "BTCPERP", ticker: "BTC-PERP", name: "Bitcoin Perpetual Futures",  category: "futures",     assetType: "crypto",    binanceSym: "BTCUSDT", base: 67500 },
  { symbol: "ETHPERP", ticker: "ETH-PERP", name: "Ethereum Perpetual Futures", category: "futures",     assetType: "crypto",    binanceSym: "ETHUSDT", base: 3530 },
  { symbol: "SOLPERP", ticker: "SOL-PERP", name: "Solana Perpetual Futures",   category: "futures",     assetType: "crypto",    binanceSym: "SOLUSDT", base: 183 },
  // ETFs
  { symbol: "SPY",   ticker: "SPY",     name: "SPDR S&P 500 ETF",              category: "etfs",        assetType: "stock",     yahooSym: "SPY",     base: 524 },
  { symbol: "QQQ",   ticker: "QQQ",     name: "Invesco NASDAQ-100 ETF",        category: "etfs",        assetType: "stock",     yahooSym: "QQQ",     base: 451 },
  { symbol: "IWM",   ticker: "IWM",     name: "iShares Russell 2000 ETF",      category: "etfs",        assetType: "stock",     yahooSym: "IWM",     base: 202 },
  { symbol: "DIA",   ticker: "DIA",     name: "SPDR Dow Jones Industrial ETF", category: "etfs",        assetType: "stock",     yahooSym: "DIA",     base: 401 },
  { symbol: "TLT",   ticker: "TLT",     name: "iShares 20+ Year Treasury ETF", category: "etfs",        assetType: "stock",     yahooSym: "TLT",     base: 93 },
  { symbol: "GLD",   ticker: "GLD",     name: "SPDR Gold Shares",              category: "etfs",        assetType: "stock",     yahooSym: "GLD",     base: 219 },
  { symbol: "SHY",   ticker: "SHY",     name: "iShares 1-3Y Treasury ETF",     category: "etfs",        assetType: "stock",     yahooSym: "SHY",     base: 82 },
  { symbol: "IEF",   ticker: "IEF",     name: "iShares 7-10Y Treasury ETF",    category: "etfs",        assetType: "stock",     yahooSym: "IEF",     base: 95 },
  { symbol: "BND",   ticker: "BND",     name: "Vanguard Total Bond Market ETF", category: "etfs",       assetType: "stock",     yahooSym: "BND",     base: 74 },
  { symbol: "XLF",   ticker: "XLF",     name: "Financial Select SPDR ETF",     category: "etfs",        assetType: "stock",     yahooSym: "XLF",     base: 42 },
  { symbol: "ARKK",  ticker: "ARKK",    name: "ARK Innovation ETF",            category: "etfs",        assetType: "stock",     yahooSym: "ARKK",    base: 55 },
  { symbol: "GDX",   ticker: "GDX",     name: "VanEck Gold Miners ETF",        category: "etfs",        assetType: "stock",     yahooSym: "GDX",     base: 31 },
  // Sector Indices (SPDR ETFs as proxies for sector indices)
  { symbol: "XLK",   ticker: "XLK",     name: "Technology Sector",             category: "sector-idx",  assetType: "stock",     yahooSym: "XLK",     base: 232 },
  { symbol: "XLV",   ticker: "XLV",     name: "Health Care Sector",            category: "sector-idx",  assetType: "stock",     yahooSym: "XLV",     base: 143 },
  { symbol: "XLE",   ticker: "XLE",     name: "Energy Sector",                 category: "sector-idx",  assetType: "stock",     yahooSym: "XLE",     base: 89 },
  { symbol: "XLI",   ticker: "XLI",     name: "Industrials Sector",            category: "sector-idx",  assetType: "stock",     yahooSym: "XLI",     base: 128 },
  { symbol: "XLC",   ticker: "XLC",     name: "Communication Services",        category: "sector-idx",  assetType: "stock",     yahooSym: "XLC",     base: 95 },
  { symbol: "XLRE",  ticker: "XLRE",    name: "Real Estate Sector",            category: "sector-idx",  assetType: "stock",     yahooSym: "XLRE",    base: 38 },
  { symbol: "XLP",   ticker: "XLP",     name: "Consumer Staples",              category: "sector-idx",  assetType: "stock",     yahooSym: "XLP",     base: 79 },
  { symbol: "XLB",   ticker: "XLB",     name: "Materials Sector",              category: "sector-idx",  assetType: "stock",     yahooSym: "XLB",     base: 92 },
  { symbol: "XLU",   ticker: "XLU",     name: "Utilities Sector",              category: "sector-idx",  assetType: "stock",     yahooSym: "XLU",     base: 71 },
  { symbol: "XLY",   ticker: "XLY",     name: "Consumer Discretionary",        category: "sector-idx",  assetType: "stock",     yahooSym: "XLY",     base: 210 },
  // Bonds / Treasury Yields
  { symbol: "US10Y",    ticker: "10Y",  name: "US 10-Year Treasury Yield",     category: "bonds",       assetType: "index",     yahooSym: "^TNX",    base: 4.48, dp: 3 },
  { symbol: "US02Y",    ticker: "2Y",   name: "US 2-Year Treasury Yield",      category: "bonds",       assetType: "index",     yahooSym: "^IRX",    base: 4.91, dp: 3 },
  { symbol: "US30Y",    ticker: "30Y",  name: "US 30-Year Treasury Yield",     category: "bonds",       assetType: "index",     yahooSym: "^TYX",    base: 4.63, dp: 3 },
  { symbol: "AGG",      ticker: "AGG",  name: "iShares Core US Aggregate Bond ETF", category: "bonds",  assetType: "stock",     yahooSym: "AGG",     base: 98 },
  { symbol: "LQD",      ticker: "LQD",  name: "iShares IG Corp Bond ETF",      category: "bonds",       assetType: "stock",     yahooSym: "LQD",     base: 108 },
  { symbol: "HYG",      ticker: "HYG",  name: "iShares High Yield Bond ETF",   category: "bonds",       assetType: "stock",     yahooSym: "HYG",     base: 79 },
  { symbol: "US05Y",    ticker: "5Y",   name: "US 5-Year Treasury Yield",      category: "treasury",    assetType: "index",     yahooSym: "^FVX",    base: 4.61, dp: 3 },
  // Volatility / FX Index
  { symbol: "VIX",      ticker: "VIX",  name: "CBOE Volatility Index",         category: "volatility",  assetType: "index",     yahooSym: "^VIX",    base: 15, dp: 2 },
  { symbol: "DXY",      ticker: "DXY",  name: "US Dollar Index",               category: "currency-idx", assetType: "index",    yahooSym: "DX-Y.NYB", base: 104, dp: 3 },
  // Global Markets
  { symbol: "DAX",       ticker: "DAX",    name: "DAX 40 (Germany)",           category: "global",      assetType: "index",     yahooSym: "^GDAXI",  base: 18840 },
  { symbol: "FTSE100",   ticker: "FTSE",   name: "FTSE 100 (UK)",              category: "global",      assetType: "index",     yahooSym: "^FTSE",   base: 8220 },
  { symbol: "NIKKEI225", ticker: "N225",   name: "Nikkei 225 (Japan)",         category: "global",      assetType: "index",     yahooSym: "^N225",   base: 38510 },
  { symbol: "HANGSENG",  ticker: "HSI",    name: "Hang Seng Index (HK)",       category: "global",      assetType: "index",     yahooSym: "^HSI",    base: 18480 },
  { symbol: "CAC40",     ticker: "CAC40",  name: "CAC 40 (France)",            category: "global",      assetType: "index",     yahooSym: "^FCHI",   base: 8092 },
  { symbol: "NIFTY50",   ticker: "NIFTY",  name: "NIFTY 50 (India)",           category: "global",      assetType: "index",     yahooSym: "^NSEI",   base: 23485 },
  { symbol: "ASX200",    ticker: "ASX200", name: "S&P/ASX 200 (Australia)",    category: "global",      assetType: "index",     yahooSym: "^AXJO",   base: 8082 },
  { symbol: "SENSEX",    ticker: "SENSEX", name: "BSE Sensex (India)",         category: "global",      assetType: "index",     yahooSym: "^BSESN",  base: 77400 },
  { symbol: "KOSPI",     ticker: "KOSPI",  name: "KOSPI (South Korea)",        category: "global",      assetType: "index",     yahooSym: "^KS11",   base: 2742 },
  // Agriculture (CME / CBOT futures)
  { symbol: "CORN",      ticker: "CORN",   name: "Corn Futures",               category: "agriculture", assetType: "commodity", yahooSym: "ZC=F",    base: 441 },
  { symbol: "WHEAT",     ticker: "WHEAT",  name: "Wheat Futures",              category: "agriculture", assetType: "commodity", yahooSym: "ZW=F",    base: 593 },
  { symbol: "SOYBEANS",  ticker: "SOY",    name: "Soybeans Futures",           category: "agriculture", assetType: "commodity", yahooSym: "ZS=F",    base: 1185 },
  { symbol: "COFFEE",    ticker: "COFFEE", name: "Coffee Arabica Futures",     category: "agriculture", assetType: "commodity", yahooSym: "KC=F",    base: 218 },
  { symbol: "SUGAR",     ticker: "SUGAR",  name: "Sugar #11 Futures",          category: "agriculture", assetType: "commodity", yahooSym: "SB=F",    base: 19, dp: 3 },
  { symbol: "COTTON",    ticker: "COTTON", name: "Cotton #2 Futures",          category: "agriculture", assetType: "commodity", yahooSym: "CT=F",    base: 78, dp: 3 },
  // Energy (NYMEX / ICE futures)
  { symbol: "CRUDEOIL",  ticker: "OIL",    name: "Crude Oil WTI Futures",      category: "energy",      assetType: "commodity", yahooSym: "CL=F",    base: 78 },
  { symbol: "NATGAS",    ticker: "GAS",    name: "Natural Gas Futures",        category: "energy",      assetType: "commodity", yahooSym: "NG=F",    base: 2.1, dp: 3 },
  { symbol: "BRENT",     ticker: "BRENT",  name: "Brent Crude Oil Futures",    category: "energy",      assetType: "commodity", yahooSym: "BZ=F",    base: 82 },
  // Livestock (CME)
  { symbol: "LIVECATTLE",    ticker: "CATTLE", name: "Live Cattle Futures",    category: "livestock",   assetType: "commodity", yahooSym: "LE=F",    base: 190, dp: 3 },
  { symbol: "LEANHOGS",      ticker: "HOGS",   name: "Lean Hogs Futures",      category: "livestock",   assetType: "commodity", yahooSym: "HE=F",    base: 92, dp: 3 },
  { symbol: "FEEDERCATTLE",  ticker: "FEEDER", name: "Feeder Cattle Futures",  category: "livestock",   assetType: "commodity", yahooSym: "GF=F",    base: 252, dp: 3 },
  // Soft Commodities (ICE/CME)
  { symbol: "COCOA",     ticker: "COCOA",  name: "Cocoa Futures",              category: "soft-comm",   assetType: "commodity", yahooSym: "CC=F",    base: 8420 },
  { symbol: "OJ",        ticker: "OJ",     name: "Orange Juice Futures",       category: "soft-comm",   assetType: "commodity", yahooSym: "OJ=F",    base: 460 },
  { symbol: "LUMBER",    ticker: "LBR",    name: "Lumber Futures",             category: "soft-comm",   assetType: "commodity", yahooSym: "LB=F",    base: 580 },
  // Carbon (via KRBN — KraneShares Global Carbon Strategy ETF)
  { symbol: "EUA",       ticker: "EUA",    name: "EU Carbon Credits (KRBN)",   category: "carbon",      assetType: "stock",     yahooSym: "KRBN",    base: 22, isProxy: true },
  { symbol: "CA_CARBON", ticker: "CA-C",   name: "CA Carbon Allowances (KRBN)", category: "carbon",     assetType: "stock",     yahooSym: "KRBN",    base: 22, isProxy: true },
  // Freight (via BDRY — Breakwave Dry Bulk Shipping ETF)
  { symbol: "BDI",       ticker: "BDI",    name: "Baltic Dry Index (BDRY ETF)", category: "freight",    assetType: "stock",     yahooSym: "BDRY",    base: 15, isProxy: true },
  { symbol: "CAPESIZE",  ticker: "CAPE",   name: "Capesize Freight Rate (BDRY)", category: "freight",   assetType: "stock",     yahooSym: "BDRY",    base: 15, isProxy: true },
];

const extraAssetsCache: { data: object[] | null; expiresAt: number } = { data: null, expiresAt: 0 };
const EXTRA_ASSETS_TTL = 5 * 60 * 1000;

async function buildExtraAssetsData(): Promise<object[]> {
  const yahooAssets   = EXTRA_ASSET_UNIVERSE.filter(a => a.yahooSym && !a.binanceSym);
  const binanceAssets = EXTRA_ASSET_UNIVERSE.filter(a => a.binanceSym && !a.yahooSym);

  const [yahooQuotes, yahooKlines] = await Promise.all([
    runConcurrent(
      yahooAssets.map(a => async (): Promise<import("../lib/yahoo-finance").YahooQuote | null> => {
        if (!isYahooSupported(a.yahooSym!)) return null;
        try { return await fetchYahooQuote(a.yahooSym!); } catch { return null; }
      }),
      5
    ),
    runConcurrent(
      yahooAssets.map(a => async (): Promise<number[]> => {
        if (!isYahooSupported(a.yahooSym!)) return [];
        try {
          const bars = await fetchYahooKlines(a.yahooSym!, "1d", 50);
          return bars.map(b => b.close);
        } catch { return []; }
      }),
      5
    ),
  ]);

  const binanceSyms   = binanceAssets.map(a => a.binanceSym!);
  const binanceData   = binanceSyms.length > 0 ? await fetchBinance24hrBulk(binanceSyms) : new Map<string, Binance24hr>();
  const now = Date.now();
  const result: object[] = [];

  const makeRow = (
    asset: ExtraAssetDef,
    price: number,
    change24h: number,
    volume24h: number,
    closes: number[],
    dataSource: string,
    mcapRank: number
  ) => {
    const dp = asset.dp ?? (asset.base < 0.001 ? 8 : asset.base < 1 ? 4 : asset.base < 10 ? 3 : 2);
    const priceArr = closes.length >= 15 ? [...closes] : generatePrices(asset.yahooSym ?? asset.symbol, price, 50);
    priceArr[priceArr.length - 1] = price;
    const rsi = computeRSI(priceArr);
    const macd = computeMACDSignal(priceArr);
    const bb = bbPosition(priceArr);
    const ema20 = computeEMA(priceArr, Math.min(20, priceArr.length));
    const ema50 = computeEMA(priceArr, Math.min(50, priceArr.length));
    const trend: "bullish" | "bearish" = ema20[ema20.length - 1]! > ema50[ema50.length - 1]! ? "bullish" : "bearish";
    const change7d = pctChange(priceArr, 7);
    const vwap = computeVWAP(priceArr.slice(-24));
    const rsiSignal: "overbought" | "oversold" | "neutral" = rsi >= 70 ? "overbought" : rsi <= 30 ? "oversold" : "neutral";
    return {
      symbol: asset.symbol, name: asset.name, ticker: asset.ticker,
      sector: asset.category, assetType: asset.assetType,
      category: asset.category,
      mcapRank, price: +price.toFixed(dp), change24h, change7d, volume24h,
      rsi, rsiSignal, macd, trend, bbPosition: bb, vwap: +vwap.toFixed(dp),
      dataSource, isProxy: asset.isProxy ?? false, updatedAt: now,
    };
  };

  for (let i = 0; i < yahooAssets.length; i++) {
    const asset   = yahooAssets[i]!;
    const quote   = (yahooQuotes as (import("../lib/yahoo-finance").YahooQuote | null)[])[i] ?? null;
    const closes  = (yahooKlines as number[][])[i] ?? [];
    const price   = quote?.price    ?? asset.base;
    const ch24h   = quote ? +quote.changePct.toFixed(2) : 0;
    const vol24h  = quote?.volume   ?? 0;
    result.push(makeRow(asset, price, ch24h, vol24h, closes, quote ? "live" : "simulated", 100 + i));
  }

  for (let i = 0; i < binanceAssets.length; i++) {
    const asset  = binanceAssets[i]!;
    const stats  = binanceData.get(asset.binanceSym!);
    const price  = stats?.price    ?? asset.base;
    const ch24h  = stats ? +stats.change24h.toFixed(2) : 0;
    const vol24h = stats ? +stats.volume24h.toFixed(0) : 0;
    result.push(makeRow(asset, price, ch24h, vol24h, [], stats ? "live" : "simulated", 100 + yahooAssets.length + i));
  }

  return result;
}

router.get("/tools/extra-assets", async (_req, res) => {
  if (extraAssetsCache.data && Date.now() < extraAssetsCache.expiresAt) {
    res.json(extraAssetsCache.data);
    return;
  }
  try {
    const data = await buildExtraAssetsData();
    extraAssetsCache.data = data;
    extraAssetsCache.expiresAt = Date.now() + EXTRA_ASSETS_TTL;
    res.json(data);
  } catch (err) {
    console.error("[extra-assets]", err);
    res.status(500).json({ error: "Failed to fetch extra assets" });
  }
});

// ── CRYPTO DOMINANCE (CoinGecko free — no API key) ────────────────────────────

const cryptoDomCache: { data: object[] | null; expiresAt: number } = { data: null, expiresAt: 0 };
const CRYPTO_DOM_TTL = 5 * 60 * 1000;

router.get("/tools/crypto-dominance", async (_req, res) => {
  if (cryptoDomCache.data && Date.now() < cryptoDomCache.expiresAt) {
    res.json(cryptoDomCache.data);
    return;
  }
  const now = Date.now();
  try {
    const resp = await fetch("https://api.coingecko.com/api/v3/global", {
      signal: AbortSignal.timeout(8000),
      headers: { "Accept": "application/json", "User-Agent": "TradeLab/1.0" },
    });
    if (!resp.ok) throw new Error(`CoinGecko ${resp.status}`);
    const json = (await resp.json()) as { data: { market_cap_percentage: Record<string, number> } };
    const dom = json.data.market_cap_percentage;

    const btcD    = +(dom["btc"]  ?? 55).toFixed(2);
    const ethD    = +(dom["eth"]  ?? 18).toFixed(2);
    const bnbD    = +(dom["bnb"]  ?? 3).toFixed(2);
    const solD    = +(dom["sol"]  ?? 4).toFixed(2);
    const stableD = +((dom["usdt"] ?? 0) + (dom["usdc"] ?? 0) + (dom["dai"] ?? 0)).toFixed(2);
    const defiD   = +(bnbD + solD + (dom["avax"] ?? 0) + (dom["uni"] ?? 0) + (dom["aave"] ?? 0)).toFixed(2);
    const altD    = Math.max(0, +(100 - btcD - ethD - stableD - bnbD - solD).toFixed(2));

    const make = (symbol: string, ticker: string, name: string, price: number, rank: number) => ({
      symbol, ticker, name, sector: "crypto-dom", assetType: "index" as const,
      category: "crypto-dom", mcapRank: rank,
      price, change24h: 0, change7d: 0, volume24h: 0,
      rsi: 50, rsiSignal: "neutral" as const, macd: "neutral" as const,
      trend: "neutral" as const, bbPosition: 50, vwap: price,
      dataSource: "live", updatedAt: now,
    });

    const rows = [
      make("BTC.D",        "BTC.D",    "Bitcoin Dominance",    btcD,    200),
      make("ETH.D",        "ETH.D",    "Ethereum Dominance",   ethD,    201),
      make("ALTCOIN.D",    "ALT.D",    "Altcoin Dominance",    altD,    202),
      make("STABLECOIN.D", "STABLE.D", "Stablecoin Dominance", stableD, 203),
      make("DEFI.D",       "DEFI.D",   "DeFi Index Dominance", defiD,   204),
    ];

    cryptoDomCache.data = rows;
    cryptoDomCache.expiresAt = now + CRYPTO_DOM_TTL;
    res.json(rows);
  } catch (err) {
    console.error("[crypto-dom]", err);
    if (cryptoDomCache.data) { res.json(cryptoDomCache.data); return; }
    res.json([]);
  }
});

// ── ECONOMIC INDICATORS (FRED public CSV — no API key needed) ─────────────────

const econCache: { data: object[] | null; expiresAt: number } = { data: null, expiresAt: 0 };
const ECON_TTL = 60 * 60 * 1000;

async function fetchFredLatest(seriesId: string): Promise<{ date: string; value: number } | null> {
  try {
    const resp = await fetch(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`,
      { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "TradeLab/1.0" } }
    );
    if (!resp.ok) return null;
    const text = await resp.text();
    const lines = text.trim().split("\n").slice(1);
    for (let i = lines.length - 1; i >= 0; i--) {
      const parts = (lines[i] ?? "").split(",");
      if (parts.length >= 2 && parts[1]!.trim() !== ".") {
        return { date: parts[0]!.trim(), value: parseFloat(parts[1]!.trim()) };
      }
    }
    return null;
  } catch { return null; }
}

router.get("/tools/economic-indicators", async (_req, res) => {
  if (econCache.data && Date.now() < econCache.expiresAt) {
    res.json(econCache.data);
    return;
  }
  const now = Date.now();
  const [fedfunds, cpi, gdp, unrate] = await Promise.allSettled([
    fetchFredLatest("FEDFUNDS"),
    fetchFredLatest("CPIAUCSL"),
    fetchFredLatest("GDP"),
    fetchFredLatest("UNRATE"),
  ]);

  const toRow = (
    symbol: string, ticker: string, name: string,
    result: PromiseSettledResult<{ date: string; value: number } | null>,
    base: number, dp: number, unit: string, rank: number
  ) => {
    const rec   = result.status === "fulfilled" ? result.value : null;
    const price = rec?.value ?? base;
    return {
      symbol, ticker, name, sector: "economic", assetType: "index" as const,
      category: "economic", mcapRank: rank,
      price: +price.toFixed(dp), change24h: 0, change7d: 0, volume24h: 0,
      rsi: 50, rsiSignal: "neutral" as const, macd: "neutral" as const,
      trend: "neutral" as const, bbPosition: 50, vwap: price,
      dataSource: rec ? "live" : "reference",
      lastDate: rec?.date ?? null, unit, updatedAt: now,
    };
  };

  const rows = [
    toRow("FEDFUNDS",     "FFR",    "Federal Funds Rate",    fedfunds, 5.25,  2, "% p.a.", 300),
    toRow("CPI_IDX",      "CPI",    "Consumer Price Index",  cpi,      310,   1, "index",  301),
    toRow("GDP_USD",      "GDP",    "US GDP (Quarterly)",    gdp,      28000, 0, "$B",     302),
    toRow("UNEMPLOYMENT", "UNEMP",  "US Unemployment Rate",  unrate,   4.1,   1, "%",      303),
  ];

  econCache.data = rows;
  econCache.expiresAt = now + ECON_TTL;
  res.json(rows);
});

// ── LIVE QUOTE (for paper trading non-crypto prices) ──────────────────────────

router.get("/tools/live-quote", async (req, res) => {
  const raw = ((req.query["symbol"] as string) ?? "").trim().toUpperCase();
  if (!raw) { res.status(400).json({ error: "symbol query param required" }); return; }

  // Try Binance first for crypto
  const cryptoAsset = ASSETS.find(a => a.symbol === raw && a.assetType === "crypto");
  if (cryptoAsset) {
    const map = await fetchBinance24hrBulk([raw]);
    const stats = map.get(raw);
    if (stats) {
      res.json({ symbol: raw, price: stats.price, change24h: stats.change24h, dataSource: "binance" });
      return;
    }
  }

  // Try Yahoo Finance for stocks/futures/indices/ETFs
  if (isYahooSupported(raw)) {
    try {
      const q = await fetchYahooQuote(raw);
      res.json({ symbol: raw, price: q.price, change24h: q.changePct, dataSource: "yahoo" });
      return;
    } catch { /* fall through */ }
  }

  // Try extra universe Yahoo symbol mapping
  const extra = EXTRA_ASSET_UNIVERSE.find(a => a.symbol === raw || a.yahooSym === raw);
  if (extra?.yahooSym && isYahooSupported(extra.yahooSym)) {
    try {
      const q = await fetchYahooQuote(extra.yahooSym);
      res.json({ symbol: raw, price: q.price, change24h: q.changePct, dataSource: "yahoo" });
      return;
    } catch { /* fall through */ }
  }

  res.status(404).json({ error: "No live price available for this symbol", symbol: raw });
});

// ── USER SYMBOL PERFORMANCE (auth-required — drives real edge line) ───────────

router.get("/tools/user-symbol-performance", async (req, res) => {
  const auth  = req.headers["authorization"];
  const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: "Authentication required" }); return; }

  let userId: number;
  try {
    const payload = verifyJwt(token, process.env.JWT_SECRET!);
    if (!payload || typeof payload.id !== "number") throw new Error("invalid");
    userId = payload.id;
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const rows = await db
    .select({
      symbol:      backtestsTable.symbol,
      winRate:     backtestsTable.winRate,
      totalReturn: backtestsTable.totalReturn,
      totalTrades: backtestsTable.totalTrades,
    })
    .from(backtestsTable)
    .where(eq(backtestsTable.userId, userId));

  if (rows.length === 0) {
    res.json({ hasData: false, symbols: [] });
    return;
  }

  const symbolMap = new Map<string, { winRates: number[]; returns: number[] }>();
  for (const bt of rows) {
    if (!symbolMap.has(bt.symbol)) symbolMap.set(bt.symbol, { winRates: [], returns: [] });
    const entry = symbolMap.get(bt.symbol)!;
    if (bt.winRate    != null) entry.winRates.push(Number(bt.winRate));
    if (bt.totalReturn != null) entry.returns.push(Number(bt.totalReturn));
  }

  const allWins    = rows.filter(b => b.winRate     != null).map(b => Number(b.winRate));
  const allRets    = rows.filter(b => b.totalReturn  != null).map(b => Number(b.totalReturn));
  const avgWinRate = allWins.length ? allWins.reduce((s, v) => s + v, 0) / allWins.length : 50;
  const avgReturn  = allRets.length ? allRets.reduce((s, v) => s + v, 0) / allRets.length : 0;

  const symbols = Array.from(symbolMap.entries()).map(([symbol, stats]) => {
    const wr  = stats.winRates.length ? stats.winRates.reduce((s, v) => s + v, 0) / stats.winRates.length : null;
    const ret = stats.returns.length  ? stats.returns.reduce((s, v) => s + v, 0)  / stats.returns.length  : null;
    return {
      symbol,
      avgWinRate:    wr  != null ? +wr.toFixed(1)                  : null,
      avgReturn:     ret != null ? +ret.toFixed(2)                  : null,
      winRateDelta:  wr  != null ? +(wr - avgWinRate).toFixed(1)    : 0,
      returnDelta:   ret != null ? +(ret - avgReturn).toFixed(2)    : 0,
      count: stats.winRates.length,
    };
  });

  res.json({ hasData: true, avgWinRate: +avgWinRate.toFixed(1), avgReturn: +avgReturn.toFixed(2), symbols });
});

export default router;
