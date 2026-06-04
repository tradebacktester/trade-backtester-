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
import { runBacktest, generatePriceData, type OHLCVBar } from "../lib/backtest-engine";

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

async function fetchBinanceHistorical(symbol: string, startDate: string, endDate: string): Promise<OHLCVBar[] | null> {
  const binanceSymbol = toBinanceSymbol(symbol);
  if (!binanceSymbol) return null;

  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const allBars: OHLCVBar[] = [];
  let from = startMs;

  try {
    while (from < endMs && allBars.length < 5000) {
      const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1d&startTime=${from}&endTime=${endMs}&limit=1000`;
      const resp = await fetch(url);
      if (!resp.ok) break;
      const raw = await resp.json() as unknown[][];
      if (!raw.length) break;
      for (const k of raw) {
        allBars.push({
          date: new Date(k[0] as number).toISOString().split("T")[0],
          open: parseFloat(k[1] as string),
          high: parseFloat(k[2] as string),
          low: parseFloat(k[3] as string),
          close: parseFloat(k[4] as string),
          volume: parseFloat(k[5] as string),
        });
      }
      if (raw.length < 1000) break;
      from = (raw[raw.length - 1][0] as number) + 86_400_000;
    }
    return allBars.length >= 50 ? allBars : null;
  } catch {
    return null;
  }
}

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
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

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

  const stratPerf = await db
    .select({
      strategyId: backtestsTable.strategyId,
      avgReturn: avg(backtestsTable.totalReturn),
    })
    .from(backtestsTable)
    .where(and(eq(backtestsTable.status, "complete"), eq(backtestsTable.userId, userId)))
    .groupBy(backtestsTable.strategyId)
    .orderBy(sql`avg(${backtestsTable.totalReturn}) DESC`)
    .limit(1);

  let topStrategy: string | null = null;
  if (stratPerf.length > 0) {
    const [strat] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, stratPerf[0].strategyId));
    topStrategy = strat?.name ?? null;
  }

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

  const limit = query.data.limit ?? 100;
  const offset = query.data.offset ?? 0;

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
    const messages = parsed.error.issues.map((i) => `${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`).join("; ");
    res.status(400).json({ error: messages });
    return;
  }

  if (new Date(parsed.data.startDate) >= new Date(parsed.data.endDate)) {
    res.status(400).json({ error: "startDate must be before endDate" });
    return;
  }

  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, parsed.data.strategyId));
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }

  const commissionPct = parsed.data.commission ?? 0;
  const slippagePct = parsed.data.slippage ?? 0;

  const userId = res.locals["userId"] as number;

  // CRIT-004: Enforce plan limits server-side — client-side gating alone is trivially bypassable
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

  const [backtest] = await db.insert(backtestsTable).values({
    userId,
    strategyId: parsed.data.strategyId,
    symbol: parsed.data.symbol,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    initialCapital: String(parsed.data.initialCapital),
    commission: String(commissionPct),
    slippage: String(slippagePct),
    status: "running",
  }).returning();

  try {
    // Try to fetch real Binance historical data for crypto symbols
    const realBars = await fetchBinanceHistorical(
      parsed.data.symbol, parsed.data.startDate, parsed.data.endDate
    );

    // positionSizing is an optional extension sent by the frontend beyond the generated Zod schema
    const psRaw = req.body.positionSizing as { mode?: string; value?: number } | undefined;
    const positionSizing = (psRaw?.mode === "fixed_amount" || psRaw?.mode === "risk_pct")
      ? { mode: psRaw.mode as "fixed_amount" | "risk_pct", value: typeof psRaw.value === "number" ? psRaw.value : undefined }
      : undefined;

    const result = runBacktest(
      parsed.data.symbol,
      strategy.type,
      strategy.parameters as Record<string, unknown>,
      parsed.data.startDate,
      parsed.data.endDate,
      parsed.data.initialCapital,
      commissionPct,
      slippagePct,
      realBars ?? undefined,
      strategy.timeframe ?? "1d",
      positionSizing,
    );

    if (result.trades.length > 0) {
      await db.insert(tradesTable).values(
        result.trades.map((t) => ({
          backtestId: backtest.id,
          symbol: t.symbol,
          side: t.side,
          entryDate: t.entryDate,
          exitDate: t.exitDate,
          entryPrice: String(t.entryPrice),
          exitPrice: String(t.exitPrice),
          quantity: String(t.quantity),
          pnl: String(t.pnl),
          pnlPercent: String(t.pnlPercent),
        }))
      );
    }

    // Sample equity curve to ≤500 points, store benchmark value
    const equitySample = result.equityCurve.length > 500
      ? result.equityCurve.filter((_, i) => i % Math.ceil(result.equityCurve.length / 500) === 0)
      : result.equityCurve;
    if (equitySample.length > 0) {
      await db.insert(equityCurveTable).values(
        equitySample.map((e) => ({
          backtestId: backtest.id,
          date: e.date,
          value: String(e.value),
          drawdown: String(e.drawdown),
        }))
      );
    }

    const [updated] = await db.update(backtestsTable).set({
      status: "complete",
      finalCapital: String(result.finalCapital),
      totalReturn: String(result.totalReturn),
      annualizedReturn: String(result.annualizedReturn),
      maxDrawdown: String(result.maxDrawdown),
      sharpeRatio: String(result.sharpeRatio),
      sortinoRatio: String(result.sortinoRatio),
      calmarRatio: result.calmarRatio != null ? String(result.calmarRatio) : null,
      benchmarkReturn: String(result.benchmarkReturn),
      winRate: String(result.winRate),
      totalTrades: result.totalTrades,
      profitFactor: String(result.profitFactor),
      consecutiveWins: result.consecutiveWins,
      consecutiveLosses: result.consecutiveLosses,
      dataSource: (realBars && realBars.length >= 50) ? "real" : "simulated",
    }).where(eq(backtestsTable.id, backtest.id)).returning();

    // Return full detail including yearlyReturns (computed, not stored in DB)
    res.status(201).json({
      ...formatBacktest(updated, strategy.name),
      yearlyReturns: result.yearlyReturns,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Backtest execution failed";
    const isParamError = msg.startsWith("Invalid parameters:");
    await db.update(backtestsTable).set({ status: "failed" }).where(eq(backtestsTable.id, backtest.id));
    res.status(isParamError ? 400 : 500).json({ error: msg });
  }
});

router.get("/backtests/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db.select().from(backtestsTable).where(and(eq(backtestsTable.id, id), eq(backtestsTable.userId, userId)));
  if (!row) { res.status(404).json({ error: "Backtest not found" }); return; }

  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, row.strategyId));
  const trades = await db.select().from(tradesTable).where(eq(tradesTable.backtestId, id)).orderBy(tradesTable.entryDate);
  const equity = await db.select().from(equityCurveTable).where(eq(equityCurveTable.backtestId, id)).orderBy(equityCurveTable.date);

  // Recompute yearlyReturns from stored trades
  const initialCapital = Number(row.initialCapital);
  const yearlyReturns = computeYearlyReturnsFromTrades(
    trades.map((t) => ({ exitDate: t.exitDate, pnl: Number(t.pnl) })),
    initialCapital
  );

  res.json({
    ...formatBacktest(row, strategy?.name),
    yearlyReturns,
    trades: trades.map((t) => ({
      id: t.id,
      backtestId: t.backtestId,
      symbol: t.symbol,
      side: t.side,
      entryDate: t.entryDate,
      exitDate: t.exitDate,
      entryPrice: Number(t.entryPrice),
      exitPrice: Number(t.exitPrice),
      quantity: Number(t.quantity),
      pnl: Number(t.pnl),
      pnlPercent: Number(t.pnlPercent),
    })),
    equityCurve: equity.map((e) => ({
      date: e.date,
      value: Number(e.value),
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
  const trades = await db.select().from(tradesTable).where(eq(tradesTable.backtestId, params.data.id)).orderBy(tradesTable.entryDate);
  res.json(trades.map((t) => ({
    id: t.id,
    backtestId: t.backtestId,
    symbol: t.symbol,
    side: t.side,
    entryDate: t.entryDate,
    exitDate: t.exitDate,
    entryPrice: Number(t.entryPrice),
    exitPrice: Number(t.exitPrice),
    quantity: Number(t.quantity),
    pnl: Number(t.pnl),
    pnlPercent: Number(t.pnlPercent),
  })));
});

router.get("/backtests/:id/equity", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const params = GetEquityCurveParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [bt] = await db.select().from(backtestsTable).where(and(eq(backtestsTable.id, params.data.id), eq(backtestsTable.userId, userId)));
  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }
  const equity = await db.select().from(equityCurveTable).where(eq(equityCurveTable.backtestId, params.data.id)).orderBy(equityCurveTable.date);

  // Compute benchmark (buy & hold) values for each equity curve date.
  // Prefer real Binance data so the benchmark matches what the backtest used.
  let benchmarkMap = new Map<string, number>();
  try {
    const realBars = await fetchBinanceHistorical(bt.symbol, bt.startDate, bt.endDate);
    const bars = realBars ?? generatePriceData(bt.symbol, bt.startDate, bt.endDate);
    if (bars.length > 0) {
      const initialCapital = Number(bt.initialCapital);
      const firstPrice = bars[0].open;
      const benchmarkQty = (initialCapital * 0.95) / firstPrice;
      for (const bar of bars) {
        benchmarkMap.set(bar.date, initialCapital * 0.05 + benchmarkQty * bar.close);
      }
    }
  } catch { /* benchmark unavailable */ }

  res.json(equity.map((e) => ({
    date: e.date,
    value: Number(e.value),
    drawdown: Number(e.drawdown),
    benchmark: benchmarkMap.get(e.date) ?? null,
  })));
});

// Parameter optimization: grid search over two parameters (no DB writes)
router.post("/backtests/optimize", requireAuth, async (req, res): Promise<void> => {
  const { strategyId, symbol, startDate, endDate, initialCapital, param1Name, param1Values, param2Name, param2Values } = req.body;
  if (!strategyId || !symbol || !startDate || !endDate || !initialCapital || !param1Name || !param1Values?.length || !param2Name || !param2Values?.length) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, strategyId));
  if (!strategy) { res.status(404).json({ error: "Strategy not found" }); return; }

  const baseParams = strategy.parameters as Record<string, unknown>;
  const results: Array<{ p1: number; p2: number; totalReturn: number; sharpeRatio: number; maxDrawdown: number; winRate: number }> = [];

  const p1Vals: number[] = param1Values.slice(0, 8).map(Number).filter((v: number) => !isNaN(v));
  const p2Vals: number[] = param2Values.slice(0, 8).map(Number).filter((v: number) => !isNaN(v));

  for (const p1 of p1Vals) {
    for (const p2 of p2Vals) {
      try {
        const params = { ...baseParams, [param1Name]: p1, [param2Name]: p2 };
        const result = runBacktest(symbol, strategy.type, params, startDate, endDate, Number(initialCapital), 0, 0);
        results.push({
          p1, p2,
          totalReturn: result.totalReturn,
          sharpeRatio: result.sharpeRatio,
          maxDrawdown: result.maxDrawdown,
          winRate: result.winRate,
        });
      } catch { /* skip invalid combinations */ }
    }
  }

  res.json({ param1Name, param1Values: p1Vals, param2Name, param2Values: p2Vals, results });
});

function computeYearlyReturnsFromTrades(
  trades: { exitDate: string; pnl: number }[],
  initialCapital: number
) {
  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Sort by exit date to compute running equity correctly
  const sorted = [...trades].sort((a, b) => a.exitDate.localeCompare(b.exitDate));
  const monthlyMap = new Map<string, number>();
  for (const t of sorted) {
    const m = t.exitDate.slice(0, 7);
    monthlyMap.set(m, (monthlyMap.get(m) ?? 0) + t.pnl);
  }

  // Track running start-of-month equity so each month's % uses the correct base
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
