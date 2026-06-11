import { Router, type IRouter } from "express";
import { fetchYahooKlines, isYahooSupported } from "../lib/yahoo-finance";

const router: IRouter = Router();

const VALID_INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d", "1w"]);

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

const SYMBOL_MAP: Record<string, string> = {
  "BTC/USD": "BTCUSDT", "ETH/USD": "ETHUSDT", "BNB/USD": "BNBUSDT",
  "SOL/USD": "SOLUSDT", "XRP/USD": "XRPUSDT", "ADA/USD": "ADAUSDT",
  "DOGE/USD": "DOGEUSDT", "AVAX/USD": "AVAXUSDT", "DOT/USD": "DOTUSDT",
  "MATIC/USD": "MATICUSDT",
};

function isBinanceSymbol(s: string): boolean {
  return /^[A-Z0-9]+(USDT|BTC|ETH|BNB)$/i.test(s);
}

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

  const rawLimit = parseInt(limit ?? "200", 10);
  if (limit !== undefined && (isNaN(rawLimit) || rawLimit < 1)) {
    res.status(400).json({ error: "limit must be a positive integer (1–1000)" });
    return;
  }
  if (limit !== undefined && rawLimit > 1000) {
    res.status(400).json({ error: "limit cannot exceed 1000" });
    return;
  }
  const klinesLimit = isNaN(rawLimit) ? 200 : Math.min(Math.max(rawLimit, 1), 1000);

  const binanceSymbol = SYMBOL_MAP[symbol.toUpperCase()] ?? symbol.replace("/", "").toUpperCase();
  const cacheKey = `${binanceSymbol}:${interval}:${klinesLimit}`;
  const cached = klinesCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    res.json(cached.bars);
    return;
  }

  const ttl = KLINES_TTL[interval] ?? 60_000;

  // Try Binance first for crypto symbols
  if (isBinanceSymbol(binanceSymbol)) {
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
        klinesCache.set(cacheKey, { bars, expiresAt: Date.now() + ttl });
        res.json(bars);
        return;
      }
      req.log.warn({ status: response.status }, "Binance klines request failed");
    } catch (err) {
      req.log.warn({ err }, "Binance unreachable");
    }
  }

  // Try Yahoo Finance for non-crypto / when Binance fails
  const originalSymbol = symbol.toUpperCase();
  if (isYahooSupported(originalSymbol)) {
    try {
      const bars = await fetchYahooKlines(originalSymbol, interval, klinesLimit);
      if (bars.length > 0) {
        klinesCache.set(cacheKey, { bars, expiresAt: Date.now() + ttl });
        res.json(bars);
        return;
      }
      req.log.warn({ symbol: originalSymbol }, "Yahoo Finance returned empty klines");
    } catch (err) {
      req.log.warn({ err, symbol: originalSymbol }, "Yahoo Finance klines failed");
    }
  }

  res.status(503).json({ error: "Market data unavailable for this symbol. Please try again shortly." });
});

export default router;
