import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { fetchYahooKlines, isYahooSupported } from "../lib/yahoo-finance";
import { db } from "@workspace/db";
import { drawingsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyJwt } from "../lib/jwt";

function extractUserId(req: Request): number | null {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = verifyJwt(auth.slice(7));
  return payload ? (payload as { id: number }).id : null;
}
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const uid = extractUserId(req);
  if (!uid) { res.status(401).json({ error: "Authentication required" }); return; }
  res.locals["userId"] = uid;
  next();
}

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

// ── Chart drawings persistence ─────────────────────────────────────────────
router.get("/drawings", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const { symbol, interval } = req.query as Record<string, string>;
  if (!symbol || !interval) { res.status(400).json({ error: "symbol and interval required" }); return; }
  const row = await db.select().from(drawingsTable)
    .where(and(eq(drawingsTable.userId, userId), eq(drawingsTable.symbol, symbol), eq(drawingsTable.interval, interval)))
    .limit(1);
  res.json({ data: row[0]?.data ?? [] });
});

router.post("/drawings", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const { symbol, interval, data } = req.body as { symbol: string; interval: string; data: unknown[] };
  if (!symbol || !interval || !Array.isArray(data)) { res.status(400).json({ error: "symbol, interval, data[] required" }); return; }
  await db.insert(drawingsTable).values({ userId, symbol, interval, data })
    .onConflictDoUpdate({ target: [drawingsTable.userId, drawingsTable.symbol, drawingsTable.interval], set: { data, updatedAt: new Date() } });
  res.json({ ok: true });
});

export default router;
