import { Router, type IRouter } from "express";

const router: IRouter = Router();

const VALID_INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d", "1w"]);

// TTL cache for klines responses — keyed by "symbol:interval:limit"
const klinesCache = new Map<string, { bars: unknown[]; expiresAt: number }>();
const KLINES_TTL: Record<string, number> = {
  "1m": 30_000,
  "5m": 60_000,
  "15m": 90_000,
  "1h": 120_000,
  "4h": 300_000,
  "1d": 600_000,
  "1w": 1_800_000,
};

const INTERVAL_SEC: Record<string, number> = {
  "1m": 60, "5m": 300, "15m": 900, "1h": 3600,
  "4h": 14400, "1d": 86400, "1w": 604800,
};

const SYMBOL_BASE: Record<string, number> = {
  BTCUSDT: 67420, ETHUSDT: 3521, SOLUSDT: 182, BNBUSDT: 608,
  XRPUSDT: 0.623, ADAUSDT: 0.457, DOGEUSDT: 0.152, AVAXUSDT: 36,
  LINKUSDT: 18.9, LTCUSDT: 84, DOTUSDT: 7.4, NEARUSDT: 5.8,
  OPUSDT: 2.4, ARBUSDT: 1.1, INJUSDT: 28.4, AAVEUSDT: 110,
};

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

function generateSimBars(symbol: string, interval: string, limit: number) {
  const base = SYMBOL_BASE[symbol.toUpperCase()] ?? 100;
  const rng = mulberry32(strSeed(symbol + interval));
  const sec = INTERVAL_SEC[interval] ?? 86400;
  const now = Math.floor(Date.now() / 1000);
  const start = now - sec * limit;

  let price = base;
  const bars = [];
  for (let i = 0; i < limit; i++) {
    const vol = base * 0.012;
    price = Math.max(base * 0.1, price + (rng() - 0.495) * vol);
    const range = Math.abs(rng() * vol * 1.5);
    const open = price;
    const close = price + (rng() - 0.5) * range;
    const high = Math.max(open, close) + rng() * range * 0.5;
    const low = Math.min(open, close) - rng() * range * 0.5;
    const volume = base * (50 + rng() * 200);
    bars.push({
      time: start + i * sec,
      open: +open.toFixed(6),
      high: +high.toFixed(6),
      low: +low.toFixed(6),
      close: +close.toFixed(6),
      volume: +volume.toFixed(2),
    });
    price = close;
  }
  return bars;
}

const SYMBOL_MAP: Record<string, string> = {
  "BTC/USD": "BTCUSDT", "ETH/USD": "ETHUSDT", "BNB/USD": "BNBUSDT",
  "SOL/USD": "SOLUSDT", "XRP/USD": "XRPUSDT", "ADA/USD": "ADAUSDT",
  "DOGE/USD": "DOGEUSDT", "AVAX/USD": "AVAXUSDT", "DOT/USD": "DOTUSDT",
  "MATIC/USD": "MATICUSDT",
};

router.get("/klines", async (req, res): Promise<void> => {
  const { symbol, interval, limit } = req.query as Record<string, string>;

  if (!symbol || !interval) {
    res.status(400).json({ error: "symbol and interval are required" });
    return;
  }

  if (!VALID_INTERVALS.has(interval)) {
    res.status(400).json({ error: `interval must be one of: ${[...VALID_INTERVALS].join(", ")}` });
    return;
  }

  const binanceSymbol = SYMBOL_MAP[symbol.toUpperCase()] ?? symbol.replace("/", "").toUpperCase();
  const klinesLimit = Math.min(Math.max(parseInt(limit ?? "200", 10) || 200, 1), 1000);

  const cacheKey = `${binanceSymbol}:${interval}:${klinesLimit}`;
  const cached = klinesCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    res.json(cached.bars);
    return;
  }

  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${klinesLimit}`;

  try {
    const response = await fetch(url);
    if (response.ok) {
      const raw = await response.json() as unknown[][];
      const bars = raw.map((k) => ({
        time: Math.floor((k[0] as number) / 1000),
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
      }));
      const ttl = KLINES_TTL[interval] ?? 60_000;
      klinesCache.set(cacheKey, { bars, expiresAt: Date.now() + ttl });
      res.json(bars);
      return;
    }
    req.log.warn({ status: response.status }, "Binance klines request failed");
  } catch (err) {
    req.log.warn({ err }, "Binance unreachable");
  }

  // CRIT-009: Never silently serve fake data as real market data.
  // Return a proper 503 so the chart can show an honest error state.
  res.status(503).json({ error: "Market data unavailable. Binance API is unreachable — please try again shortly." });
});

export default router;
