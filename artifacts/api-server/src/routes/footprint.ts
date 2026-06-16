import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { verifyJwt } from "../lib/jwt";
import { db, subscriptionsTable, subscriptionPlansTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  generateFootprintCandles,
  buildFootprintFromBinanceKlines,
  buildFootprintFromYahooKlines,
  generateSessionAnalytics,
  generateScannerOpportunities,
  type FootprintCandle,
} from "../lib/footprint-engine";
import {
  getLiveCandle,
  ensureFootprintSubscribed,
} from "../lib/binance-footprint-ws";

const router: IRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? "";

/** Symbols that have Binance aggTrade WebSocket support */
const BINANCE_CRYPTO_SYMBOLS = new Set([
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "ADAUSDT", "LINKUSDT", "AVAXUSDT", "DOTUSDT", "LTCUSDT",
]);

function extractUserId(req: Request): number | null {
  try {
    const auth = req.headers["authorization"];
    if (!auth || !JWT_SECRET) return null;
    const token = auth.replace("Bearer ", "").trim();
    const payload = verifyJwt(token, JWT_SECRET);
    return typeof payload?.id === "number" ? payload.id : null;
  } catch { return null; }
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
  res.locals["userId"] = userId;
  next();
}

async function getPlanSlug(userId: number): Promise<string> {
  try {
    const [activeSub] = await db
      .select({ planId: subscriptionsTable.planId })
      .from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active")))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);
    if (!activeSub) return "free";
    const [plan] = await db
      .select({ slug: subscriptionPlansTable.slug })
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, activeSub.planId))
      .limit(1);
    return plan?.slug ?? "free";
  } catch { return "free"; }
}

router.get("/footprint/candles", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const symbol = (typeof req.query["symbol"] === "string" ? req.query["symbol"] : "BTCUSDT").toUpperCase();
  const timeframe = typeof req.query["timeframe"] === "string" ? req.query["timeframe"] : "1h";
  const limit = Math.min(parseInt(typeof req.query["limit"] === "string" ? req.query["limit"] : "50", 10) || 50, 200);
  const session = typeof req.query["session"] === "string" ? req.query["session"] : "all";
  const offset = parseInt(typeof req.query["offset"] === "string" ? req.query["offset"] : "0", 10) || 0;

  const planSlug = await getPlanSlug(userId);

  // ── Plan gating ───────────────────────────────────────────────────
  // Footprint is a Pro+ feature. Free users get a clear upgrade response.
  if (planSlug === "free") {
    res.status(403).json({
      error: "Footprint Charts require a Pro or Elite plan.",
      requiresPlan: "pro",
      limitReached: true,
    });
    return;
  }

  const validTimeframes = ["1m", "5m", "15m", "1h", "4h", "1d"];
  const tf = validTimeframes.includes(timeframe) ? timeframe : "1h";

  // ── Auto-warm Binance aggregator for crypto symbols ───────────────
  if (BINANCE_CRYPTO_SYMBOLS.has(symbol)) {
    ensureFootprintSubscribed(symbol, tf);
  }

  // ── Time-advancing offset so non-crypto simulated data evolves ────
  // Divide current Unix seconds by the timeframe duration to get a
  // monotonically-increasing bucket index. This means every new bar
  // "opens" on schedule and historical bars shift left on each new period.
  const TF_SECONDS: Record<string, number> = {
    "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400,
  };
  const tfSec = TF_SECONDS[tf] ?? 3600;
  const timeBucket = Math.floor(Date.now() / 1000 / tfSec);
  // Client-supplied offset is additive (for pagination), base is always time-based
  const candleOffset = timeBucket + offset;

  // ── Historical candles: prefer real Binance klines, fall back to generated ──
  let candles: FootprintCandle[];
  if (BINANCE_CRYPTO_SYMBOLS.has(symbol)) {
    const realCandles = await buildFootprintFromBinanceKlines(symbol, tf, limit, session);
    candles = realCandles ?? generateFootprintCandles(symbol, tf, limit, session, candleOffset);
  } else {
    const yahooCandles = await buildFootprintFromYahooKlines(symbol, tf, limit, session);
    candles = yahooCandles ?? generateFootprintCandles(symbol, tf, limit, session, candleOffset);
  }

  // ── Merge live Binance state into the last candle ─────────────────
  if (BINANCE_CRYPTO_SYMBOLS.has(symbol)) {
    const live = getLiveCandle(symbol, tf);
    if (live && live.open !== 0 && candles.length > 0) {
      const liveCandle = {
        date: new Date(live.openTime).toISOString(),
        open: live.open,
        high: live.high,
        low: live.low,
        close: live.close,
        volume: live.volume,
        delta: live.delta,
        cvd: 0,
        levels: Array.from(live.levelMap.entries())
          .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
          .map(([priceStr, { bidVol, askVol }]) => {
            const price = parseFloat(priceStr);
            const delta = askVol - bidVol;
            const totalVol = bidVol + askVol;
            const ratio = askVol / Math.max(bidVol, 0.001);
            const ratioInv = bidVol / Math.max(askVol, 0.001);
            return {
              price, bidVol, askVol, delta, totalVol,
              isImbalance: ratio >= 3 || ratioInv >= 3,
              isBuyAbsorption: live.delta < 0 && askVol > bidVol * 2.5 && totalVol > live.volume * 0.05,
              isSellAbsorption: live.delta > 0 && bidVol > askVol * 2.5 && totalVol > live.volume * 0.05,
            };
          }),
        isExhaustion: Math.abs(live.delta) > live.volume * 0.4,
        isDivergence: false,
        sessionTag: null as string | null,
      };
      candles[candles.length - 1] = liveCandle;
    }
  }

  // ── Recalculate running CVD ───────────────────────────────────────
  let runningCvd = 0;
  const enriched = candles.map(c => {
    runningCvd += c.delta;
    return { ...c, cvd: runningCvd };
  });

  void userId;
  res.json({
    candles: enriched,
    symbol,
    timeframe: tf,
    planSlug,
    hasLiveData: BINANCE_CRYPTO_SYMBOLS.has(symbol),
  });
});

router.get("/footprint/scanner", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const planSlug = await getPlanSlug(userId);

  if (planSlug !== "elite") {
    res.status(403).json({ error: "Market Scanner requires an Elite plan.", limitReached: true });
    return;
  }

  void userId;
  const opportunities = generateScannerOpportunities();
  res.json({ opportunities, updatedAt: new Date().toISOString() });
});

router.get("/footprint/session-analytics", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const planSlug = await getPlanSlug(userId);

  // Session analytics available to Pro+ only
  if (planSlug === "free") {
    res.status(403).json({ error: "Session Analytics requires a Pro or Elite plan.", requiresPlan: "pro", limitReached: true });
    return;
  }

  void userId;
  const symbol = typeof req.query["symbol"] === "string" ? req.query["symbol"] : "BTCUSDT";
  const sessions = generateSessionAnalytics(symbol);
  const totalVol = sessions.reduce((a, s) => a + s.volume, 0);
  const dominant = sessions.reduce((a, b) => b.volume > a.volume ? b : a, sessions[0]!);
  res.json({ sessions, totalVol, dominantSession: dominant.session, symbol });
});

export default router;
