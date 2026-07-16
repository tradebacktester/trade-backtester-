import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, avg, max, min, count, sum, sql, inArray, and, gte } from "drizzle-orm";
import { db, backtestsTable, strategiesTable, tradesTable, equityCurveTable, subscriptionsTable, subscriptionPlansTable } from "@workspace/db";
import { verifyJwt } from "../lib/jwt";
import {
  CreateBacktestBody,
  ListBacktestsQueryParams,
  GetBacktestParams,
  DeleteBacktestParams,
  GetBacktestTradesParams,
  GetEquityCurveParams,
} from "@workspace/api-zod";
import { runBacktest, runWalkForward, runMultiAssetBacktest, generatePriceData, type OHLCVBar } from "../lib/backtest-engine";
import { fetchYahooHistory, isYahooSupported } from "../lib/yahoo-finance";
import { randomUUID } from "crypto";

// ── Real Binance historical data ─────────────────────────────────────────────

const CRYPTO_SYMBOL_MAP: Record<string, string> = {
  "BTC/USD": "BTCUSDT", "ETH/USD": "ETHUSDT", "BNB/USD": "BNBUSDT",
  "SOL/USD": "SOLUSDT", "XRP/USD": "XRPUSDT", "ADA/USD": "ADAUSDT",
  "DOGE/USD": "DOGEUSDT", "AVAX/USD": "AVAXUSDT", "LINK/USD": "LINKUSDT",
  "LTC/USD": "LTCUSDT", "DOT/USD": "DOTUSDT", "NEAR/USD": "NEARUSDT",
  "OP/USD": "OPUSDT", "ARB/USD": "ARBUSDT", "INJ/USD": "INJUSDT",
  "AAVE/USD": "AAVEUSDT", "UNI/USD": "UNIUSDT", "ATOM/USD": "ATOMUSDT",
};

function toBinanceSymbol(symbol: string): string | null {
  const upper = symbol.toUpperCase();
  if (CRYPTO_SYMBOL_MAP[upper]) return CRYPTO_SYMBOL_MAP[upper];
  if (/^[A-Z0-9]+USDT$/.test(upper)) return upper;
  return null;
}

/**
 * Fetch Binance daily OHLCV data using parallel page requests.
 * Pre-computes all page intervals up-front and fetches them concurrently
 * with Promise.all instead of a serial while-loop.
 */
async function fetchBinanceHistorical(symbol: string, startDate: string, endDate: string): Promise<OHLCVBar[] | null> {
  const binanceSymbol = toBinanceSymbol(symbol);
  if (!binanceSymbol) return null;

  const startMs = new Date(startDate).getTime();
  const endMs   = new Date(endDate).getTime();
  const PAGE_SIZE = 1000;
  const DAY_MS    = 86_400_000;

  // Pre-compute all page start times (non-overlapping 1000-day windows)
  const pageStarts: number[] = [];
  for (let from = startMs; from < endMs && pageStarts.length < 10; from += PAGE_SIZE * DAY_MS) {
    pageStarts.push(from);
  }
  if (pageStarts.length === 0) return null;

  try {
    const pages = await Promise.all(
      pageStarts.map(async (from) => {
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1d&startTime=${from}&endTime=${endMs}&limit=${PAGE_SIZE}`;
        const resp = await fetch(url);
        if (!resp.ok) return [] as OHLCVBar[];
        const raw = await resp.json() as unknown[][];
        return raw.map((k): OHLCVBar => ({
          date:   new Date(k[0] as number).toISOString().split("T")[0]!,
          open:   parseFloat(k[1] as string),
          high:   parseFloat(k[2] as string),
          low:    parseFloat(k[3] as string),
          close:  parseFloat(k[4] as string),
          volume: parseFloat(k[5] as string),
        }));
      })
    );

    // Merge pages, deduplicate by date, sort chronologically
    const seen = new Set<string>();
    const allBars = pages.flat().filter(b => !seen.has(b.date) && seen.add(b.date));
    allBars.sort((a, b) => a.date.localeCompare(b.date));
    return allBars.length >= 50 ? allBars : null;
  } catch {
    return null;
  }
}

// ── SSE Job store ─────────────────────────────────────────────────────────────

interface SseJob {
  status: "running" | "done" | "error";
  userId: number;
  result?: unknown;
  error?: string;
  createdAt: number;
}

const jobStore = new Map<string, SseJob>();

// Prune completed/errored jobs older than 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobStore.entries()) {
    if (job.status !== "running" && now - job.createdAt > 10 * 60 * 1000) {
      jobStore.delete(id);
    }
  }
}, 5 * 60 * 1000).unref();

// ── Helpers ───────────────────────────────────────────────────────────────────

const router: IRouter = Router();

function extractUserId(req: Request): number | null {
  try {
    const auth = req.headers["authorization"];
    if (!auth || !process.env.JWT_SECRET) return null;
    const token = auth.replace("Bearer ", "").trim();
    const payload = verifyJwt(token, process.env.JWT_SECRET);
    return typeof payload?.id === "number" ? payload.id : null;
  } catch {
    return null;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals["userId"] = userId;
  next();
}

function formatBacktest(row: typeof backtestsTable.$inferSelect, strategyName?: string | null) {
  return {
    id: row.id,
    strategyId: row.strategyId,
    strategyName: strategyName ?? null,
    symbol: row.symbol,
    startDate: row.startDate,
    endDate: row.endDate,
    initialCapital: Number(row.initialCapital),
    commission: row.commission != null ? Number(row.commission) : null,
    slippage: row.slippage != null ? Number(row.slippage) : null,
    finalCapital: row.finalCapital != null ? Number(row.finalCapital) : null,
    totalReturn: row.totalReturn != null ? Number(row.totalReturn) : null,
    annualizedReturn: row.annualizedReturn != null ? Number(row.annualizedReturn) : null,
    maxDrawdown: row.maxDrawdown != null ? Number(row.maxDrawdown) : null,
    sharpeRatio: row.sharpeRatio != null ? Number(row.sharpeRatio) : null,
    sortinoRatio: row.sortinoRatio != null ? Number(row.sortinoRatio) : null,
    calmarRatio: row.calmarRatio != null ? Number(row.calmarRatio) : null,
    benchmarkReturn: row.benchmarkReturn != null ? Number(row.benchmarkReturn) : null,
    winRate: row.winRate != null ? Number(row.winRate) : null,
    totalTrades: row.totalTrades,
    profitFactor: row.profitFactor != null ? Number(row.profitFactor) : null,
    consecutiveWins: row.consecutiveWins,
    consecutiveLosses: row.consecutiveLosses,
    dataSource: row.dataSource ?? null,
    notes: row.notes ?? null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Bulk-insert rows in chunks of 500 to stay within Postgres limits. */
async function bulkInsert<T extends Record<string, unknown>>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
  chunkSize = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await db.insert(table).values(rows.slice(i, i + chunkSize) as T[]);
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/backtests/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const [summary] = await db
    .select({
      totalBacktests: count(backtestsTable.id),
      avgReturn: avg(backtestsTable.totalReturn),
      bestReturn: max(backtestsTable.totalReturn),
      worstReturn: min(backtestsTable.totalReturn),
      totalTrades: sum(backtestsTable.totalTrades),
    })
    .from(backtestsTable)
    .where(and(eq(backtestsTable.status, "complete"), eq(backtestsTable.userId, userId)));

  const [stratCount] = await db
    .select({ totalStrategies: count(strategiesTable.id) })
    .from(strategiesTable)
    .where(eq(strategiesTable.userId, userId));

  // Single JOIN query to get top strategy name — eliminates the N+1 separate lookup
  const [topStratRow] = await db
    .select({ name: strategiesTable.name, avgReturn: avg(backtestsTable.totalReturn) })
    .from(backtestsTable)
    .leftJoin(strategiesTable, eq(backtestsTable.strategyId, strategiesTable.id))
    .where(and(eq(backtestsTable.status, "complete"), eq(backtestsTable.userId, userId)))
    .groupBy(strategiesTable.id, strategiesTable.name)
    .orderBy(sql`avg(${backtestsTable.totalReturn}) DESC`)
    .limit(1);
  const topStrategy: string | null = topStratRow?.name ?? null;

  res.json({
    totalBacktests: summary?.totalBacktests ?? 0,
    totalStrategies: stratCount?.totalStrategies ?? 0,
    avgReturn: Number(summary?.avgReturn ?? 0),
    bestReturn: Number(summary?.bestReturn ?? 0),
    worstReturn: Number(summary?.worstReturn ?? 0),
    totalTrades: Number(summary?.totalTrades ?? 0),
    topStrategy,
  });
});

router.get("/backtests", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const query = ListBacktestsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const limit  = typeof req.query["limit"]  === "string" ? parseInt(req.query["limit"],  10) || 100 : 100;
  const offset = typeof req.query["offset"] === "string" ? parseInt(req.query["offset"], 10) || 0   : 0;

  let rows: typeof backtestsTable.$inferSelect[];
  if (query.data.strategyId != null) {
    rows = await db.select().from(backtestsTable)
      .where(and(eq(backtestsTable.strategyId, query.data.strategyId), eq(backtestsTable.userId, userId)))
      .orderBy(sql`${backtestsTable.createdAt} DESC`)
      .limit(limit)
      .offset(offset);
  } else {
    rows = await db.select().from(backtestsTable)
      .where(eq(backtestsTable.userId, userId))
      .orderBy(sql`${backtestsTable.createdAt} DESC`)
      .limit(limit)
      .offset(offset);
  }

  const strategyIds = [...new Set(rows.map((r) => r.strategyId))];
  const strategies = strategyIds.length > 0
    ? await db.select().from(strategiesTable).where(inArray(strategiesTable.id, strategyIds))
    : [];
  const stratMap = new Map(strategies.map((s) => [s.id, s.name]));

  res.json(rows.map((r) => formatBacktest(r, stratMap.get(r.strategyId))));
});

router.post("/backtests", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBacktestBody.safeParse(req.body);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i: { path: (string | number)[]; message: string }) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`).join("; ");
    res.status(400).json({ error: messages });
    return;
  }

  if (parsed.data.initialCapital > 10_000_000) {
    res.status(400).json({ error: "initialCapital cannot exceed $10,000,000" });
    return;
  }

  if (!/^[A-Za-z0-9/_.\-]{1,20}$/.test(parsed.data.symbol)) {
    res.status(400).json({ error: "symbol must be 1–20 characters: letters, digits, /, _, ., - only" });
    return;
  }

  if (new Date(parsed.data.startDate) >= new Date(parsed.data.endDate)) {
    res.status(400).json({ error: "startDate must be before endDate" });
    return;
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (new Date(parsed.data.startDate) > today) {
    res.status(400).json({ error: "startDate cannot be in the future" });
    return;
  }
  if (new Date(parsed.data.endDate) > today) {
    res.status(400).json({ error: "endDate cannot be in the future" });
    return;
  }

  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, parsed.data.strategyId));
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }

  // BUG-001: Intraday timeframes are not supported — engine uses daily/weekly bars only
  const INTRADAY_TIMEFRAMES = ["1m", "5m", "15m", "1h"];
  if (INTRADAY_TIMEFRAMES.includes(strategy.timeframe ?? "")) {
    res.status(400).json({
      error: `Strategy timeframe "${strategy.timeframe}" is not supported for backtesting. The backtest engine requires daily (1d) or higher timeframes. Edit your strategy to use 4h, 1d, or 1w.`,
      intradayTimeframe: true,
    });
    return;
  }

  const commissionPct = parsed.data.commission ?? 0;
  const slippagePct   = parsed.data.slippage   ?? 0;
  const userId        = res.locals["userId"] as number;

  // CRIT-004: Enforce plan limits server-side
  {
    const [activeSub] = await db
      .select({ planId: subscriptionsTable.planId })
      .from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active")))
      .orderBy(sql`${subscriptionsTable.createdAt} DESC`)
      .limit(1);

    let maxBacktests = 5;
    if (activeSub) {
      const [plan] = await db
        .select({ features: subscriptionPlansTable.features })
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, activeSub.planId))
        .limit(1);
      const lim = (plan?.features as { maxBacktestsPerMonth?: number } | null)?.maxBacktestsPerMonth;
      if (lim === -1) maxBacktests = -1;
      else if (typeof lim === "number") maxBacktests = lim;
    } else {
      const [freePlan] = await db
        .select({ features: subscriptionPlansTable.features })
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.isDefault, true))
        .limit(1);
      const lim = (freePlan?.features as { maxBacktestsPerMonth?: number } | null)?.maxBacktestsPerMonth;
      if (typeof lim === "number" && lim !== -1) maxBacktests = lim;
    }

    if (maxBacktests !== -1) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [{ monthCount }] = await db
        .select({ monthCount: count(backtestsTable.id) })
        .from(backtestsTable)
        .where(and(eq(backtestsTable.userId, userId), gte(backtestsTable.createdAt, monthStart)));
      if (monthCount >= maxBacktests) {
        res.status(403).json({
          error: `Monthly limit reached: ${monthCount}/${maxBacktests} backtests used this month. Upgrade your plan to run more.`,
          limitReached: true,
        });
        return;
      }
    }
  }

  // Enforce maxHistoricalYears — Free plan limited to 1 year of data
  {
    let maxHistoricalYears = 1;
    const [activeSub] = await db
      .select({ planId: subscriptionsTable.planId })
      .from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "active")))
      .orderBy(sql`${subscriptionsTable.createdAt} DESC`)
      .limit(1);

    if (activeSub) {
      const [plan] = await db
        .select({ features: subscriptionPlansTable.features })
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, activeSub.planId))
        .limit(1);
      const yrs = (plan?.features as Record<string, unknown> | null)?.["maxHistoricalYears"];
      if (yrs === -1 || yrs === "-1") maxHistoricalYears = -1;
      else if (typeof yrs === "number") maxHistoricalYears = yrs;
    }

    if (maxHistoricalYears !== -1) {
      const rangeMs = new Date(parsed.data.endDate).getTime() - new Date(parsed.data.startDate).getTime();
      const rangeYears = rangeMs / (365.25 * 24 * 3600 * 1000);
      if (rangeYears > maxHistoricalYears + 0.1) {
        const label = maxHistoricalYears === 1 ? "1 year" : `${maxHistoricalYears} years`;
        res.status(403).json({
          error: `Your plan allows up to ${label} of historical data. Upgrade to Pro for 5 years, or Elite for unlimited history.`,
          upgradeRequired: true,
        });
        return;
      }
    }
  }

  const notesRaw = typeof req.body.notes === "string" ? req.body.notes.slice(0, 2000) : null;

  const [backtest] = await db.insert(backtestsTable).values({
    userId,
    strategyId: parsed.data.strategyId,
    symbol: parsed.data.symbol,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    initialCapital: String(parsed.data.initialCapital),
    commission: String(commissionPct),
    slippage: String(slippagePct),
    notes: notesRaw,
    status: "running",
  }).returning();

  try {
    let realBars: OHLCVBar[] | null = await fetchBinanceHistorical(
      parsed.data.symbol, parsed.data.startDate, parsed.data.endDate
    );

    if (!realBars) {
      if (isYahooSupported(parsed.data.symbol)) {
        try {
          const yahooData = await fetchYahooHistory(
            parsed.data.symbol, parsed.data.startDate, parsed.data.endDate
          );
          if (yahooData.length >= 20) {
            realBars = yahooData;
          } else {
            await db.update(backtestsTable).set({ status: "failed" }).where(eq(backtestsTable.id, backtest.id));
            res.status(422).json({ error: `Real market data for ${parsed.data.symbol} returned too few bars (${yahooData.length}) for the requested date range. Minimum 20 bars required — try extending the date range.` });
            return;
          }
        } catch (yfErr) {
          await db.update(backtestsTable).set({ status: "failed" }).where(eq(backtestsTable.id, backtest.id));
          const yfMsg = yfErr instanceof Error ? yfErr.message : "unknown error";
          res.status(422).json({ error: `Real market data unavailable for ${parsed.data.symbol}: ${yfMsg}` });
          return;
        }
      } else {
        await db.update(backtestsTable).set({ status: "failed" }).where(eq(backtestsTable.id, backtest.id));
        res.status(422).json({ error: `No real market data source for "${parsed.data.symbol}". Supported: crypto (e.g. BTCUSDT), US stocks (e.g. AAPL), forex (e.g. EURUSD), indices (e.g. SPX500), commodities (e.g. XAUUSD).` });
        return;
      }
    }

    const psRaw = req.body.positionSizing as { mode?: string; value?: number } | undefined;
    const positionSizing = (psRaw?.mode === "fixed_amount" || psRaw?.mode === "risk_pct")
      ? { mode: psRaw.mode as "fixed_amount" | "risk_pct", value: typeof psRaw.value === "number" ? psRaw.value : undefined }
      : undefined;

    const stopLossPct   = typeof req.body.stopLoss   === "number" && req.body.stopLoss   > 0 ? Math.min(Number(req.body.stopLoss),   50)  : 0;
    const takeProfitPct = typeof req.body.takeProfit === "number" && req.body.takeProfit > 0 ? Math.min(Number(req.body.takeProfit), 200) : 0;

    const result = runBacktest(
      parsed.data.symbol,
      strategy.type,
      strategy.parameters as Record<string, unknown>,
      parsed.data.startDate,
      parsed.data.endDate,
      parsed.data.initialCapital,
      commissionPct,
      slippagePct,
      realBars,
      strategy.timeframe ?? "1d",
      positionSizing,
      stopLossPct,
      takeProfitPct,
    );

    // ── Bulk insert trades ────────────────────────────────────────────────────
    if (result.trades.length > 0) {
      await bulkInsert(tradesTable, result.trades.map((t) => ({
        backtestId: backtest.id,
        symbol:     t.symbol,
        side:       t.side,
        entryDate:  t.entryDate,
        exitDate:   t.exitDate,
        entryPrice: String(t.entryPrice),
        exitPrice:  String(t.exitPrice),
        quantity:   String(t.quantity),
        pnl:        String(t.pnl),
        pnlPercent: String(t.pnlPercent),
      })));
    }

    // Ensure equity curve always covers start→end
    let rawCurve = result.equityCurve;
    if (rawCurve.length === 0 || rawCurve[rawCurve.length - 1].date < parsed.data.endDate) {
      const lastVal = rawCurve.length > 0 ? rawCurve[rawCurve.length - 1].value : result.finalCapital;
      rawCurve = [...rawCurve, { date: parsed.data.endDate, value: lastVal, drawdown: 0 }];
    }
    if (rawCurve.length === 1) {
      rawCurve = [{ date: parsed.data.startDate, value: parsed.data.initialCapital, drawdown: 0 }, ...rawCurve];
    }

    // Sample strategy equity curve to ≤500 points (always including last bar)
    const sampleCurve = (curve: typeof rawCurve) => {
      if (curve.length <= 500) return curve;
      const step = Math.ceil(curve.length / 500);
      const sampled = curve.filter((_, i) => i % step === 0);
      const last = curve[curve.length - 1]!;
      if (sampled[sampled.length - 1]!.date !== last.date) sampled.push(last);
      return sampled;
    };

    const equitySample = sampleCurve(rawCurve);

    // ── Bulk insert strategy equity curve ────────────────────────────────────
    if (equitySample.length > 0) {
      await bulkInsert(equityCurveTable, equitySample.map((e) => ({
        backtestId:  backtest.id,
        date:        e.date,
        value:       String(e.value),
        drawdown:    String(e.drawdown),
        isBenchmark: false,
      })));
    }

    // ── Bulk insert benchmark curve (pre-computed, stored alongside strategy) ─
    // Extract benchmark values from the equityCurve result and store them
    // so GET /equity never needs to re-fetch from Binance/Yahoo.
    const benchmarkRaw = rawCurve
      .filter(e => e.benchmark != null)
      .map(e => ({ date: e.date, value: e.benchmark! }));

    if (benchmarkRaw.length > 0) {
      const benchmarkSample = sampleCurve(
        benchmarkRaw.map(b => ({ date: b.date, value: b.value, drawdown: 0 }))
      );
      await bulkInsert(equityCurveTable, benchmarkSample.map((e) => ({
        backtestId:  backtest.id,
        date:        e.date,
        value:       String(e.value),
        drawdown:    "0",
        isBenchmark: true,
      })));
    }

    const completionStatus = result.totalTrades === 0 ? "no_trades" : "complete";

    // ── Store yearlyReturns as JSONB + finalize backtest row ──────────────────
    const [updated] = await db.update(backtestsTable).set({
      status:            completionStatus,
      finalCapital:      String(result.finalCapital),
      totalReturn:       String(result.totalReturn),
      annualizedReturn:  String(result.annualizedReturn),
      maxDrawdown:       String(result.maxDrawdown),
      sharpeRatio:       String(result.sharpeRatio),
      sortinoRatio:      String(result.sortinoRatio),
      calmarRatio:       result.calmarRatio != null ? String(result.calmarRatio) : null,
      benchmarkReturn:   String(result.benchmarkReturn),
      winRate:           String(result.winRate),
      totalTrades:       result.totalTrades,
      profitFactor:      String(result.profitFactor),
      consecutiveWins:   result.consecutiveWins,
      consecutiveLosses: result.consecutiveLosses,
      dataSource:        "real",
      yearlyReturns:     result.yearlyReturns,
    }).where(eq(backtestsTable.id, backtest.id)).returning();

    res.status(201).json({
      ...formatBacktest(updated, strategy.name),
      yearlyReturns: result.yearlyReturns,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Backtest execution failed";
    const isParamError = raw.startsWith("Invalid parameters:");
    // Only surface parameter validation errors to the client; all other errors get a generic message
    const clientMsg = isParamError ? raw : "Backtest execution failed. Please try again.";
    await db.update(backtestsTable).set({ status: "failed" }).where(eq(backtestsTable.id, backtest.id));
    res.status(isParamError ? 400 : 500).json({ error: clientMsg });
  }
});

// ── SSE job stream — must be registered before /:id to avoid route conflicts ──
router.get("/backtests/jobs/:jobId/stream", requireAuth, (req, res): void => {
  const jobId = Array.isArray(req.params["jobId"]) ? req.params["jobId"][0]! : req.params["jobId"]!;
  const userId = res.locals["userId"] as number;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const job = jobStore.get(jobId);
  if (!job) {
    send("error", { error: "Job not found or expired" });
    res.end();
    return;
  }
  if (job.userId !== userId) {
    send("error", { error: "Forbidden" });
    res.end();
    return;
  }

  // If already complete, respond immediately
  if (job.status === "done") {
    send("result", job.result);
    res.end();
    return;
  }
  if (job.status === "error") {
    send("error", { error: job.error });
    res.end();
    return;
  }

  // Poll until done (max 5 minutes)
  const started = Date.now();
  const POLL_MS = 300;
  const MAX_MS  = 5 * 60 * 1000;

  const timer = setInterval(() => {
    const j = jobStore.get(jobId);
    if (!j) {
      clearInterval(timer);
      send("error", { error: "Job expired" });
      res.end();
      return;
    }
    if (j.status === "done") {
      clearInterval(timer);
      send("result", j.result);
      res.end();
      return;
    }
    if (j.status === "error") {
      clearInterval(timer);
      send("error", { error: j.error });
      res.end();
      return;
    }
    if (Date.now() - started > MAX_MS) {
      clearInterval(timer);
      send("error", { error: "Job timed out" });
      res.end();
      return;
    }
    send("progress", { status: "running" });
  }, POLL_MS);

  req.on("close", () => clearInterval(timer));
});

router.get("/backtests/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const rawId  = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id     = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db.select().from(backtestsTable).where(and(eq(backtestsTable.id, id), eq(backtestsTable.userId, userId)));
  if (!row) { res.status(404).json({ error: "Backtest not found" }); return; }

  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, row.strategyId));
  const [trades, equity] = await Promise.all([
    db.select().from(tradesTable).where(eq(tradesTable.backtestId, id)).orderBy(tradesTable.entryDate),
    db.select().from(equityCurveTable).where(and(eq(equityCurveTable.backtestId, id), eq(equityCurveTable.isBenchmark, false))).orderBy(equityCurveTable.date),
  ]);

  // Read yearlyReturns from stored JSONB; fall back to on-the-fly computation for older backtests
  const yearlyReturns = row.yearlyReturns != null
    ? row.yearlyReturns
    : computeYearlyReturnsFromTrades(
        trades.map((t) => ({ exitDate: t.exitDate, pnl: Number(t.pnl) })),
        Number(row.initialCapital)
      );

  res.json({
    ...formatBacktest(row, strategy?.name),
    yearlyReturns,
    trades: trades.map((t) => ({
      id:          t.id,
      backtestId:  t.backtestId,
      symbol:      t.symbol,
      side:        t.side,
      entryDate:   t.entryDate,
      exitDate:    t.exitDate,
      entryPrice:  Number(t.entryPrice),
      exitPrice:   Number(t.exitPrice),
      quantity:    Number(t.quantity),
      pnl:         Number(t.pnl),
      pnlPercent:  Number(t.pnlPercent),
    })),
    equityCurve: equity.map((e) => ({
      date:     e.date,
      value:    Number(e.value),
      drawdown: Number(e.drawdown),
    })),
  });
});

router.delete("/backtests/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const params = DeleteBacktestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(backtestsTable).where(and(eq(backtestsTable.id, params.data.id), eq(backtestsTable.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Backtest not found" }); return; }
  res.sendStatus(204);
});

router.get("/backtests/:id/trades", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const params = GetBacktestTradesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [bt] = await db.select().from(backtestsTable).where(and(eq(backtestsTable.id, params.data.id), eq(backtestsTable.userId, userId)));
  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }

  const limit  = Math.min(Math.max(parseInt(String(req.query["limit"]  ?? "2000"), 10) || 2000, 1), 2000);
  const offset = Math.max(parseInt(String(req.query["offset"] ?? "0"),   10) || 0, 0);

  const trades = await db.select().from(tradesTable)
    .where(eq(tradesTable.backtestId, params.data.id))
    .orderBy(tradesTable.entryDate)
    .limit(limit)
    .offset(offset);

  res.json(trades.map((t) => ({
    id:         t.id,
    backtestId: t.backtestId,
    symbol:     t.symbol,
    side:       t.side,
    entryDate:  t.entryDate,
    exitDate:   t.exitDate,
    entryPrice: Number(t.entryPrice),
    exitPrice:  Number(t.exitPrice),
    quantity:   Number(t.quantity),
    pnl:        Number(t.pnl),
    pnlPercent: Number(t.pnlPercent),
  })));
});

/**
 * GET /backtests/:id/equity
 * Returns strategy equity curve + pre-stored benchmark rows from DB.
 * No longer re-fetches from Binance/Yahoo on every read.
 */
router.get("/backtests/:id/equity", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const params = GetEquityCurveParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [bt] = await db.select().from(backtestsTable).where(and(eq(backtestsTable.id, params.data.id), eq(backtestsTable.userId, userId)));
  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }

  const [equity, benchmark] = await Promise.all([
    db.select().from(equityCurveTable)
      .where(and(eq(equityCurveTable.backtestId, params.data.id), eq(equityCurveTable.isBenchmark, false)))
      .orderBy(equityCurveTable.date),
    db.select().from(equityCurveTable)
      .where(and(eq(equityCurveTable.backtestId, params.data.id), eq(equityCurveTable.isBenchmark, true)))
      .orderBy(equityCurveTable.date),
  ]);

  // Build date→benchmark map for O(1) lookup
  const benchmarkMap = new Map(benchmark.map(b => [b.date, Number(b.value)]));

  res.json(equity.map((e) => ({
    date:      e.date,
    value:     Number(e.value),
    drawdown:  Number(e.drawdown),
    benchmark: benchmarkMap.get(e.date) ?? null,
  })));
});

// ── Per-user rate limiter for compute-heavy optimization ──────────────────────
const optimizeLimits = new Map<number, { count: number; resetAt: number }>();

/**
 * POST /backtests/optimize
 * Starts a grid-search optimization job asynchronously.
 * Returns 202 { jobId } immediately; stream progress/result via SSE.
 */
router.post("/backtests/optimize", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const now = Date.now();
  const entry = optimizeLimits.get(userId);
  if (entry && entry.resetAt > now && entry.count >= 5) {
    res.status(429).json({ error: "Too many optimization requests. Please wait a minute." });
    return;
  }
  if (!entry || entry.resetAt <= now) {
    optimizeLimits.set(userId, { count: 1, resetAt: now + 60_000 });
  } else {
    entry.count++;
  }

  const { strategyId, symbol, startDate, endDate, initialCapital, param1Name, param1Values, param2Name, param2Values } = req.body;
  if (!strategyId || !symbol || !startDate || !endDate || !initialCapital || !param1Name || !param1Values?.length || !param2Name || !param2Values?.length) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const [strategy] = await db.select().from(strategiesTable).where(and(eq(strategiesTable.id, strategyId), eq(strategiesTable.userId, userId)));
  if (!strategy) { res.status(404).json({ error: "Strategy not found" }); return; }

  const jobId = randomUUID();
  jobStore.set(jobId, { status: "running", userId, createdAt: Date.now() });

  // Return 202 immediately; computation runs in background
  res.status(202).json({ jobId });

  // Detached async computation
  (async () => {
    try {
      let optimizeBars: OHLCVBar[] | undefined;
      const binanceOptBars = await fetchBinanceHistorical(symbol, startDate, endDate);
      if (binanceOptBars) {
        optimizeBars = binanceOptBars;
      } else if (isYahooSupported(symbol)) {
        const yfBars = await fetchYahooHistory(symbol, startDate, endDate);
        if (yfBars.length >= 20) {
          optimizeBars = yfBars;
        } else {
          jobStore.set(jobId, { ...jobStore.get(jobId)!, status: "error", error: `Real market data for ${symbol} returned too few bars (${yfBars.length}).` });
          return;
        }
      } else {
        jobStore.set(jobId, { ...jobStore.get(jobId)!, status: "error", error: `No real market data source for "${symbol}".` });
        return;
      }

      const baseParams = strategy.parameters as Record<string, unknown>;
      const results: Array<{ p1: number; p2: number; totalReturn: number; sharpeRatio: number; maxDrawdown: number; winRate: number }> = [];

      const p1Truncated = param1Values.length > 8;
      const p2Truncated = param2Values.length > 8;
      const p1Vals: number[] = (param1Values as unknown[]).slice(0, 8).map(Number).filter((v: number) => !isNaN(v));
      const p2Vals: number[] = (param2Values as unknown[]).slice(0, 8).map(Number).filter((v: number) => !isNaN(v));

      for (const p1 of p1Vals) {
        for (const p2 of p2Vals) {
          try {
            const params = { ...baseParams, [param1Name]: p1, [param2Name]: p2 };
            const result = runBacktest(symbol, strategy.type, params, startDate, endDate, Number(initialCapital), 0, 0, optimizeBars);
            results.push({ p1, p2, totalReturn: result.totalReturn, sharpeRatio: result.sharpeRatio, maxDrawdown: result.maxDrawdown, winRate: result.winRate });
          } catch { /* skip invalid parameter combinations */ }
        }
      }

      const truncationWarning = (p1Truncated || p2Truncated)
        ? `Parameter values were truncated to 8 per dimension (received: ${param1Name}=${param1Values.length}, ${param2Name}=${param2Values.length})`
        : undefined;

      jobStore.set(jobId, {
        ...jobStore.get(jobId)!,
        status: "done",
        result: { param1Name, param1Values: p1Vals, param2Name, param2Values: p2Vals, results, warning: truncationWarning },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Optimization failed";
      jobStore.set(jobId, { ...jobStore.get(jobId)!, status: "error", error: msg });
    }
  })();
});

/**
 * GET /backtests/:id/walk-forward
 * Starts a walk-forward analysis job asynchronously.
 * Returns 202 { jobId } immediately; stream progress/result via SSE.
 */
router.get("/backtests/:id/walk-forward", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const id     = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db.select().from(backtestsTable).where(and(eq(backtestsTable.id, id), eq(backtestsTable.userId, userId)));
  if (!row) { res.status(404).json({ error: "Backtest not found" }); return; }

  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, row.strategyId));
  if (!strategy) { res.status(404).json({ error: "Strategy not found" }); return; }

  const trainRatio = Math.min(0.9, Math.max(0.5, parseFloat(String(req.query["trainRatio"] ?? "0.7"))));

  const jobId = randomUUID();
  jobStore.set(jobId, { status: "running", userId, createdAt: Date.now() });

  // Return 202 immediately
  res.status(202).json({ jobId });

  // Detached async computation
  (async () => {
    try {
      let priceData: OHLCVBar[] | undefined;
      const binanceBars = await fetchBinanceHistorical(row.symbol, row.startDate, row.endDate);
      if (binanceBars) {
        priceData = binanceBars;
      } else if (isYahooSupported(row.symbol)) {
        const yfBars = await fetchYahooHistory(row.symbol, row.startDate, row.endDate);
        if (yfBars.length >= 20) {
          priceData = yfBars;
        } else {
          jobStore.set(jobId, { ...jobStore.get(jobId)!, status: "error", error: `Real market data for ${row.symbol} returned too few bars (${yfBars.length}).` });
          return;
        }
      } else {
        jobStore.set(jobId, { ...jobStore.get(jobId)!, status: "error", error: `No real market data source for "${row.symbol}".` });
        return;
      }

      const result = runWalkForward(
        row.symbol,
        strategy.type,
        strategy.parameters as Record<string, unknown>,
        row.startDate,
        row.endDate,
        Number(row.initialCapital),
        Number(row.commission ?? 0),
        Number(row.slippage ?? 0),
        priceData,
        strategy.timeframe ?? "1d",
        trainRatio,
      );

      const sampleEquity = (curve: typeof result.inSample.equityCurve) =>
        curve.filter((_, i, a) => i % Math.max(1, Math.ceil(a.length / 200)) === 0 || i === a.length - 1);

      jobStore.set(jobId, {
        ...jobStore.get(jobId)!,
        status: "done",
        result: {
          trainRatio:  result.trainRatio,
          splitDate:   result.splitDate,
          combined:    result.combined,
          inSample: {
            totalReturn:      result.inSample.totalReturn,
            annualizedReturn: result.inSample.annualizedReturn,
            sharpeRatio:      result.inSample.sharpeRatio,
            maxDrawdown:      result.inSample.maxDrawdown,
            winRate:          result.inSample.winRate,
            totalTrades:      result.inSample.totalTrades,
            profitFactor:     result.inSample.profitFactor,
            expectancy:       result.inSample.expectancy,
            sqn:              result.inSample.sqn,
            finalCapital:     result.inSample.finalCapital,
            equityCurve:      sampleEquity(result.inSample.equityCurve),
          },
          outOfSample: {
            totalReturn:      result.outOfSample.totalReturn,
            annualizedReturn: result.outOfSample.annualizedReturn,
            sharpeRatio:      result.outOfSample.sharpeRatio,
            maxDrawdown:      result.outOfSample.maxDrawdown,
            winRate:          result.outOfSample.winRate,
            totalTrades:      result.outOfSample.totalTrades,
            profitFactor:     result.outOfSample.profitFactor,
            expectancy:       result.outOfSample.expectancy,
            sqn:              result.outOfSample.sqn,
            finalCapital:     result.outOfSample.finalCapital,
            equityCurve:      sampleEquity(result.outOfSample.equityCurve),
          },
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Walk-forward analysis failed";
      jobStore.set(jobId, { ...jobStore.get(jobId)!, status: "error", error: msg });
    }
  })();
});

// ── POST /backtests/multi-asset ────────────────────────────────────────────────
router.post("/backtests/multi-asset", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const { strategyId, symbols, startDate, endDate, initialCapital, commission, slippage } = req.body;

  if (!strategyId || !Array.isArray(symbols) || symbols.length < 2 || symbols.length > 10) {
    res.status(400).json({ error: "Provide strategyId and 2–10 symbols." });
    return;
  }
  if (!startDate || !endDate || !initialCapital) {
    res.status(400).json({ error: "startDate, endDate, and initialCapital are required." });
    return;
  }

  const [strategy] = await db.select().from(strategiesTable).where(and(eq(strategiesTable.id, strategyId), eq(strategiesTable.userId, userId)));
  if (!strategy) { res.status(404).json({ error: "Strategy not found" }); return; }

  // Fetch price data for all symbols concurrently
  const priceDataMap: Record<string, OHLCVBar[]> = {};
  await Promise.all((symbols as string[]).map(async (sym: string) => {
    const binanceBars = await fetchBinanceHistorical(sym, startDate, endDate);
    if (binanceBars && binanceBars.length >= 50) {
      priceDataMap[sym] = binanceBars;
      return;
    }
    if (isYahooSupported(sym)) {
      try {
        const bars = await fetchYahooHistory(sym, startDate, endDate);
        if (bars.length >= 50) { priceDataMap[sym] = bars; return; }
      } catch { /* fall through */ }
    }
    priceDataMap[sym] = generatePriceData(sym, startDate, endDate).filter(b => b.date >= startDate && b.date <= endDate);
  }));

  const result = runMultiAssetBacktest(
    symbols as string[],
    strategy.type,
    strategy.parameters as Record<string, unknown>,
    startDate,
    endDate,
    Number(initialCapital),
    Number(commission ?? 0),
    Number(slippage ?? 0),
    priceDataMap,
  );

  res.json(result);
});

router.patch("/backtests/:id/notes", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const id     = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const notes = typeof req.body.notes === "string" ? req.body.notes.slice(0, 2000) : null;
  const [row] = await db.update(backtestsTable)
    .set({ notes })
    .where(and(eq(backtestsTable.id, id), eq(backtestsTable.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Backtest not found" }); return; }
  res.json({ id: row.id, notes: row.notes });
});

// ── Helpers (kept for backward-compatibility fallback) ────────────────────────

function computeYearlyReturnsFromTrades(
  trades: { exitDate: string; pnl: number }[],
  initialCapital: number
) {
  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const sorted = [...trades].sort((a, b) => a.exitDate.localeCompare(b.exitDate));
  const monthlyMap = new Map<string, number>();
  for (const t of sorted) {
    const m = t.exitDate.slice(0, 7);
    monthlyMap.set(m, (monthlyMap.get(m) ?? 0) + t.pnl);
  }
  const sortedMonths = Array.from(monthlyMap.keys()).sort();
  const monthStartCapital = new Map<string, number>();
  let running = initialCapital;
  for (const month of sortedMonths) {
    monthStartCapital.set(month, running);
    running += monthlyMap.get(month) ?? 0;
  }
  const yearlyMap = new Map<string, Map<string, number>>();
  for (const [month, pnl] of monthlyMap.entries()) {
    const yr = month.slice(0, 4);
    if (!yearlyMap.has(yr)) yearlyMap.set(yr, new Map());
    const base = monthStartCapital.get(month) ?? initialCapital;
    yearlyMap.get(yr)!.set(month, base > 0 ? (pnl / base) * 100 : 0);
  }
  return Array.from(yearlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yr, mMap]) => {
      const months = Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, "0");
        const key = `${yr}-${m}`;
        return { month: key, pct: mMap.get(key) ?? 0, label: MONTH_LABELS[i] };
      });
      return { year: yr, pct: months.reduce((s, m) => s + m.pct, 0), months };
    });
}

export default router;
