import { Router, type IRouter } from "express";
import {
  db, liveTradesTable, backtestsTable, strategiesTable,
  tradesTable, equityCurveTable,
} from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { runBacktest, generatePriceData, classifyRegimes, type RegimePeriod } from "../lib/backtest-engine";
import { verifyJwt } from "../lib/jwt";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET ?? "";

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers["authorization"];
  if (!auth) { res.status(401).json({ error: "Authentication required" }); return; }
  const token = auth.replace("Bearer ", "").trim();
  const payload = verifyJwt(token, JWT_SECRET);
  if (!payload) { res.status(401).json({ error: "Authentication required" }); return; }
  res.locals["userId"] = payload.id;
  next();
}

const router: IRouter = Router();

// ─── 55-Symbol universe (seeds + vol + drift used by stress-test) ─────────────

const SYMBOL_META: Record<string, { seed: number; vol: number; sector: string; name: string; drift: number }> = {
  BTCUSDT:   { seed: 45000, vol: 0.055, sector: "Crypto",    name: "Bitcoin",       drift: 0.0004 },
  ETHUSDT:   { seed: 3000,  vol: 0.065, sector: "Crypto",    name: "Ethereum",      drift: 0.0004 },
  SOLUSDT:   { seed: 120,   vol: 0.080, sector: "Crypto",    name: "Solana",        drift: 0.0005 },
  BNBUSDT:   { seed: 400,   vol: 0.060, sector: "Crypto",    name: "BNB",           drift: 0.0003 },
  XRPUSDT:   { seed: 0.7,   vol: 0.070, sector: "Crypto",    name: "Ripple",        drift: 0.0002 },
  ADAUSDT:   { seed: 0.5,   vol: 0.070, sector: "Crypto",    name: "Cardano",       drift: 0.0002 },
  DOGEUSDT:  { seed: 0.12,  vol: 0.090, sector: "Crypto",    name: "Dogecoin",      drift: 0.0001 },
  AVAXUSDT:  { seed: 35,    vol: 0.080, sector: "Crypto",    name: "Avalanche",     drift: 0.0003 },
  DOTUSDT:   { seed: 8,     vol: 0.080, sector: "Crypto",    name: "Polkadot",      drift: 0.0002 },
  LINKUSDT:  { seed: 15,    vol: 0.070, sector: "Crypto",    name: "Chainlink",     drift: 0.0003 },
  MATICUSDT: { seed: 0.9,   vol: 0.090, sector: "Crypto",    name: "Polygon",       drift: 0.0003 },
  UNIUSDT:   { seed: 6,     vol: 0.085, sector: "Crypto",    name: "Uniswap",       drift: 0.0002 },
  ATOMUSDT:  { seed: 12,    vol: 0.080, sector: "Crypto",    name: "Cosmos",        drift: 0.0002 },
  AAPL:      { seed: 185,   vol: 0.018, sector: "Tech",      name: "Apple",         drift: 0.0003 },
  MSFT:      { seed: 375,   vol: 0.016, sector: "Tech",      name: "Microsoft",     drift: 0.0003 },
  NVDA:      { seed: 500,   vol: 0.035, sector: "Tech",      name: "Nvidia",        drift: 0.0006 },
  GOOGL:     { seed: 155,   vol: 0.018, sector: "Tech",      name: "Alphabet",      drift: 0.0003 },
  AMZN:      { seed: 180,   vol: 0.022, sector: "Tech",      name: "Amazon",        drift: 0.0003 },
  META:      { seed: 350,   vol: 0.025, sector: "Tech",      name: "Meta",          drift: 0.0004 },
  TSLA:      { seed: 250,   vol: 0.040, sector: "Auto",      name: "Tesla",         drift: 0.0003 },
  NFLX:      { seed: 450,   vol: 0.028, sector: "Media",     name: "Netflix",       drift: 0.0003 },
  AMD:       { seed: 165,   vol: 0.038, sector: "Tech",      name: "AMD",           drift: 0.0004 },
  INTC:      { seed: 40,    vol: 0.022, sector: "Tech",      name: "Intel",         drift: 0.0001 },
  ORCL:      { seed: 110,   vol: 0.020, sector: "Tech",      name: "Oracle",        drift: 0.0002 },
  CRM:       { seed: 230,   vol: 0.025, sector: "Tech",      name: "Salesforce",    drift: 0.0003 },
  PYPL:      { seed: 75,    vol: 0.030, sector: "Fintech",   name: "PayPal",        drift: 0.0001 },
  SQ:        { seed: 70,    vol: 0.040, sector: "Fintech",   name: "Block",         drift: 0.0002 },
  SPY:       { seed: 450,   vol: 0.012, sector: "Index",     name: "S&P 500 ETF",   drift: 0.0003 },
  QQQ:       { seed: 380,   vol: 0.015, sector: "Index",     name: "NASDAQ ETF",    drift: 0.0003 },
  IWM:       { seed: 195,   vol: 0.016, sector: "Index",     name: "Russell 2000",  drift: 0.0002 },
  DIA:       { seed: 350,   vol: 0.011, sector: "Index",     name: "Dow Jones",     drift: 0.0003 },
  GLD:       { seed: 185,   vol: 0.010, sector: "Commodity", name: "Gold ETF",      drift: 0.0001 },
  SLV:       { seed: 22,    vol: 0.018, sector: "Commodity", name: "Silver ETF",    drift: 0.0001 },
  TLT:       { seed: 95,    vol: 0.009, sector: "Bond",      name: "20yr Bond",     drift: 0.0001 },
  VIX:       { seed: 18,    vol: 0.050, sector: "Vol",       name: "VIX",           drift: -0.0002 },
  EURUSD:    { seed: 1.08,  vol: 0.006, sector: "Forex",     name: "EUR/USD",       drift: 0.0 },
  GBPUSD:    { seed: 1.26,  vol: 0.007, sector: "Forex",     name: "GBP/USD",       drift: 0.0 },
  USDJPY:    { seed: 148,   vol: 0.005, sector: "Forex",     name: "USD/JPY",       drift: 0.0001 },
  AUDUSD:    { seed: 0.65,  vol: 0.007, sector: "Forex",     name: "AUD/USD",       drift: 0.0 },
  USDCAD:    { seed: 1.36,  vol: 0.005, sector: "Forex",     name: "USD/CAD",       drift: 0.0 },
  USDCHF:    { seed: 0.88,  vol: 0.005, sector: "Forex",     name: "USD/CHF",       drift: -0.0001 },
  NZDUSD:    { seed: 0.61,  vol: 0.007, sector: "Forex",     name: "NZD/USD",       drift: 0.0 },
  XAUUSD:    { seed: 2000,  vol: 0.010, sector: "Commodity", name: "Gold Spot",     drift: 0.0001 },
  XAGUSD:    { seed: 24,    vol: 0.018, sector: "Commodity", name: "Silver Spot",   drift: 0.0001 },
  WTIUSD:    { seed: 78,    vol: 0.025, sector: "Energy",    name: "WTI Crude",     drift: 0.0001 },
  BRENTUSD:  { seed: 82,    vol: 0.024, sector: "Energy",    name: "Brent Crude",   drift: 0.0001 },
  NATGASUSD: { seed: 2.5,   vol: 0.040, sector: "Energy",    name: "Natural Gas",   drift: -0.0001 },
  COPPER:    { seed: 3.8,   vol: 0.018, sector: "Metal",     name: "Copper",        drift: 0.0001 },
  DAX:       { seed: 16500, vol: 0.014, sector: "Index",     name: "DAX",           drift: 0.0003 },
  FTSE:      { seed: 7600,  vol: 0.012, sector: "Index",     name: "FTSE 100",      drift: 0.0002 },
  NIKKEI:    { seed: 33000, vol: 0.013, sector: "Index",     name: "Nikkei 225",    drift: 0.0002 },
  HANGSENG:  { seed: 17000, vol: 0.016, sector: "Index",     name: "Hang Seng",     drift: 0.0001 },
  ASX200:    { seed: 7500,  vol: 0.012, sector: "Index",     name: "ASX 200",       drift: 0.0002 },
  CAC40:     { seed: 7500,  vol: 0.013, sector: "Index",     name: "CAC 40",        drift: 0.0002 },
};

export const ALL_SYMBOLS = Object.keys(SYMBOL_META);

// classifyRegimes + RegimePeriod imported from backtest-engine.ts

// ─── Pearson correlation of equity return series ──────────────────────────────

function pearsonCorrelation(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len < 2) return 0;
  const as = a.slice(0, len);
  const bs = b.slice(0, len);
  const meanA = as.reduce((s, v) => s + v, 0) / len;
  const meanB = bs.reduce((s, v) => s + v, 0) / len;
  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < len; i++) {
    const da = as[i]! - meanA;
    const db = bs[i]! - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return 0;
  return Math.max(-1, Math.min(1, cov / Math.sqrt(varA * varB)));
}

// Returns normalized daily return series from equity curve values
function equityReturns(values: number[]): number[] {
  if (values.length < 2) return [];
  return values.slice(1).map((v, i) => {
    const prev = values[i]!;
    return prev === 0 ? 0 : (v - prev) / prev;
  });
}

// ─── Strategy DNA display vector (6 dims, 0-100, for visual fingerprint) ──────

function computeDnaVector(params: {
  type: string; totalReturn: number; sharpeRatio: number; maxDrawdown: number;
  winRate: number; profitFactor: number; annualizedReturn: number; sortinoRatio: number;
}): Record<string, number> {
  const { type, totalReturn, sharpeRatio, maxDrawdown, winRate, profitFactor, annualizedReturn, sortinoRatio } = params;
  return {
    momentum: Math.min(100, Math.max(0, Math.round(
      (type === "sma_crossover" || type === "ema_crossover" || type === "macd" ? 60 : 20)
      + (totalReturn > 0 ? Math.min(30, totalReturn / 2) : 0)
    ))),
    meanReversion: Math.min(100, Math.max(0, Math.round(
      (type === "rsi" || type === "bollinger_bands" ? 65 : 20)
      + (winRate > 50 ? (winRate - 50) : 0)
    ))),
    riskControl: Math.min(100, Math.max(0, Math.round(
      60 - maxDrawdown * 1.5
      + (profitFactor > 1 ? Math.min(30, (profitFactor - 1) * 15) : 0)
    ))),
    consistency: Math.min(100, Math.max(0, Math.round(
      winRate * 0.8
      + (sharpeRatio > 0 ? Math.min(20, sharpeRatio * 8) : 0)
    ))),
    adaptability: Math.min(100, Math.max(0, Math.round(
      50
      + (sortinoRatio > 0 ? Math.min(25, sortinoRatio * 8) : 0)
      + (type === "bollinger_bands" ? 15 : type === "macd" ? 10 : 0)
    ))),
    profitability: Math.min(100, Math.max(0, Math.round(
      50
      + Math.min(30, Math.max(-30, annualizedReturn / 2))
      + (profitFactor > 1 ? Math.min(20, (profitFactor - 1) * 10) : -20)
    ))),
  };
}

// ─── GET /strategies/dna — Pearson equity-curve similarity matrix ─────────────

router.get("/strategies/dna", requireAuth, async (_req, res): Promise<void> => {
  // strategies has no userId column — fetch all, access-controlled by auth
  const strategies = await db.select().from(strategiesTable).orderBy(strategiesTable.createdAt);

  if (strategies.length === 0) {
    res.json({ strategies: [], matrix: [], duplicates: [], correlations: [] });
    return;
  }

  // Latest completed backtest per strategy
  const backtests = await db
    .select()
    .from(backtestsTable)
    .where(eq(backtestsTable.status, "complete"))
    .orderBy(desc(backtestsTable.createdAt));

  const latestByStrategy = new Map<number, typeof backtests[0]>();
  for (const bt of backtests) {
    if (!latestByStrategy.has(bt.strategyId)) {
      latestByStrategy.set(bt.strategyId, bt);
    }
  }

  // Restrict to strategies that have at least one completed backtest
  const strategiesWithBacktest = strategies.filter((s) => latestByStrategy.has(s.id));

  if (strategiesWithBacktest.length === 0) {
    res.json({ strategies: [], matrix: [], duplicates: [], correlations: [] });
    return;
  }

  // Fetch equity curves for all backtests that have one
  const btIds = Array.from(latestByStrategy.values()).map((bt) => bt.id);
  const allEquityCurveRows = btIds.length > 0
    ? await db.select().from(equityCurveTable).where(inArray(equityCurveTable.backtestId, btIds))
    : [];

  const equityCurveByBt = new Map<number, number[]>();
  for (const row of allEquityCurveRows) {
    const existing = equityCurveByBt.get(row.backtestId) ?? [];
    existing.push(Number(row.value));
    equityCurveByBt.set(row.backtestId, existing);
  }

  type StratEntry = {
    id: number; name: string; type: string;
    dna: Record<string, number>; hasBacktest: true;
    grade: string; overallScore: number;
  };

  const entries: StratEntry[] = strategiesWithBacktest.map((s) => {
    const bt = latestByStrategy.get(s.id)!;
    const dna = computeDnaVector({
      type: s.type,
      totalReturn: Number(bt.totalReturn ?? 0),
      sharpeRatio: Number(bt.sharpeRatio ?? 0),
      maxDrawdown: Number(bt.maxDrawdown ?? 0),
      winRate: Number(bt.winRate ?? 0),
      profitFactor: Number(bt.profitFactor ?? 0),
      annualizedReturn: Number(bt.annualizedReturn ?? 0),
      sortinoRatio: Number(bt.sortinoRatio ?? 0),
    });
    const overallScore = Math.round(Object.values(dna).reduce((a, b) => a + b, 0) / 6);
    const grade =
      overallScore >= 80 ? "S" :
      overallScore >= 65 ? "A" :
      overallScore >= 50 ? "B" :
      overallScore >= 35 ? "C" : "D";
    return { id: s.id, name: s.name, type: s.type, dna, hasBacktest: true, grade, overallScore };
  });

  // Build return-series for each strategy (Pearson input)
  const returnSeries: (number[] | null)[] = entries.map((e) => {
    const bt = latestByStrategy.get(e.id);
    if (!bt) return null;
    const values = equityCurveByBt.get(bt.id);
    if (!values || values.length < 2) return null;
    return equityReturns(values);
  });

  // matrix (legacy) + flat correlations array (primary)
  const matrix: { i: number; j: number; similarity: number }[] = [];
  const duplicates: { a: string; b: string; similarity: number }[] = [];
  const correlations: {
    strategyIdA: number; strategyIdB: number;
    correlation: number; isDuplicate: boolean;
  }[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const rA = returnSeries[i];
      const rB = returnSeries[j];
      let corr = 0;
      if (rA && rB && rA.length >= 2 && rB.length >= 2) {
        corr = pearsonCorrelation(rA, rB); // raw Pearson: –1 to 1, not clamped
      }
      const isDuplicate = corr > 0.85;
      // Legacy matrix uses percentage similarity (display only)
      const simPct = Math.round(Math.max(0, corr) * 100);
      matrix.push({ i, j, similarity: simPct });
      if (isDuplicate) {
        duplicates.push({ a: entries[i]!.name, b: entries[j]!.name, similarity: simPct });
      }
      // Primary correlations array — raw Pearson value, strategy IDs
      correlations.push({
        strategyIdA: entries[i]!.id,
        strategyIdB: entries[j]!.id,
        correlation: Number(corr.toFixed(4)),
        isDuplicate,
      });
    }
  }

  res.json({ strategies: entries, matrix, duplicates, correlations });
});

// ─── GET /backtests/:id/regime-analysis — uses stored tradesTable ──────────────

router.get("/backtests/:id/regime-analysis", requireAuth, async (req, res): Promise<void> => {
  const backtestId = parseInt(req.params["id"] as string, 10);
  if (isNaN(backtestId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [bt] = await db.select().from(backtestsTable).where(eq(backtestsTable.id, backtestId));
  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }
  if (bt.status !== "complete") { res.json({ regimes: [], summary: {} }); return; }

  const bars = generatePriceData(bt.symbol, bt.startDate, bt.endDate);

  // Use stored trades — not a re-run
  const storedTrades = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.backtestId, backtestId));

  const trades = storedTrades.map((t) => ({
    entryDate: t.entryDate,
    exitDate: t.exitDate,
    pnl: Number(t.pnl),
  }));

  const regimes = classifyRegimes(
    bars.map((b) => ({ date: b.date, close: b.close })),
    trades
  );

  // Stored equity curve for per-regime sub-series
  const equityRows = await db
    .select()
    .from(equityCurveTable)
    .where(eq(equityCurveTable.backtestId, backtestId));

  // Build date→value map for fast lookup
  const equityByDate = new Map(equityRows.map((r) => [r.date, Number(r.value)]));

  const regimeKeys = ["trending_bull", "trending_bear", "highvol_bull", "highvol_bear"] as const;
  const grouped = Object.fromEntries(
    regimeKeys.map((k) => [k, regimes.filter((r) => r.regime === k)])
  );

  // Per-regime equity sub-series: equity curve points within each regime's periods
  const regimeEquity: Record<string, { date: string; value: number }[]> = {};
  for (const k of regimeKeys) {
    const periods = grouped[k]!;
    const pts: { date: string; value: number }[] = [];
    for (const period of periods) {
      for (const [date, value] of equityByDate) {
        if (date >= period.startDate && date <= period.endDate) {
          pts.push({ date, value });
        }
      }
    }
    pts.sort((a, b) => a.date.localeCompare(b.date));
    regimeEquity[k] = pts;
  }

  const summarize = (list: RegimePeriod[]) =>
    list.length === 0 ? null : {
      count: list.length,
      totalTrades: list.reduce((a, r) => a + r.tradeCount, 0),
      avgWinRate: list.reduce((a, r) => a + r.winRate, 0) / list.length,
      avgReturn: list.reduce((a, r) => a + r.avgReturn, 0) / list.length,
      totalPnl: list.reduce((a, r) => a + r.totalPnl, 0),
    };

  res.json({
    regimes,
    regimeEquity,
    summary: Object.fromEntries(regimeKeys.map((k) => [k, summarize(grouped[k]!)])),
  });
});

// ─── GET /backtests/:id/divergence ────────────────────────────────────────────

router.get("/backtests/:id/divergence", requireAuth, async (req, res): Promise<void> => {
  const backtestId = parseInt(req.params["id"] as string, 10);
  if (isNaN(backtestId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [bt] = await db.select().from(backtestsTable).where(eq(backtestsTable.id, backtestId));
  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }
  if (bt.status !== "complete") { res.json({ expected: [], actual: [], liveTotal: 0, expectedTotal: 0, divergenceScore: null, initialCapital: Number(bt.initialCapital) }); return; }

  // Use stored equity curve
  const equityRows = await db
    .select()
    .from(equityCurveTable)
    .where(eq(equityCurveTable.backtestId, backtestId));

  const initialCapital = Number(bt.initialCapital);
  const expectedCurve = equityRows.map((p) => ({
    date: p.date,
    value: Number((Number(p.value) - initialCapital).toFixed(2)),
  }));

  const liveTrades = await db
    .select()
    .from(liveTradesTable)
    .where(eq(liveTradesTable.backtestId, backtestId))
    .orderBy(liveTradesTable.tradeDate);

  let cumulative = 0;
  const actualCurve = liveTrades.map((t) => {
    cumulative += Number(t.pnlAmount ?? 0);
    return { date: t.tradeDate, value: Number(cumulative.toFixed(2)) };
  });

  const liveTotal = cumulative;
  const expectedTotal = expectedCurve.at(-1)?.value ?? 0;
  const divergenceScore =
    expectedTotal === 0 ? null :
    Math.round(Math.abs(liveTotal - expectedTotal) / Math.abs(expectedTotal) * 100);

  res.json({ expected: expectedCurve, actual: actualCurve, liveTotal, expectedTotal, divergenceScore, initialCapital });
});

// ─── GET /backtests/:id/live-trades ──────────────────────────────────────────

router.get("/backtests/:id/live-trades", requireAuth, async (req, res): Promise<void> => {
  const backtestId = parseInt(req.params["id"] as string, 10);
  if (isNaN(backtestId)) { res.status(400).json({ error: "Invalid backtestId" }); return; }

  const [bt] = await db.select().from(backtestsTable).where(eq(backtestsTable.id, backtestId));
  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }

  const rows = await db.select().from(liveTradesTable).where(eq(liveTradesTable.backtestId, backtestId));
  res.json(rows.map((r) => ({
    ...r,
    entryPrice: Number(r.entryPrice),
    exitPrice: r.exitPrice != null ? Number(r.exitPrice) : null,
    pnlAmount: r.pnlAmount != null ? Number(r.pnlAmount) : null,
    createdAt: r.createdAt.toISOString(),
  })));
});

// ─── POST /backtests/:id/live-trades ─────────────────────────────────────────
// Minimal required fields: tradeDate, pnlAmount, optional note
// symbol/side/entryPrice are derived from backtest or given sensible defaults

router.post("/backtests/:id/live-trades", requireAuth, async (req, res): Promise<void> => {
  const backtestId = parseInt(req.params["id"] as string, 10);
  if (isNaN(backtestId)) { res.status(400).json({ error: "Invalid backtestId" }); return; }

  const { tradeDate, pnlAmount, note, side, entryPrice } = req.body as {
    tradeDate?: string; pnlAmount?: number | string; note?: string;
    side?: string; entryPrice?: number | string;
  };

  if (!tradeDate) {
    res.status(400).json({ error: "tradeDate required" });
    return;
  }

  const [bt] = await db.select().from(backtestsTable).where(eq(backtestsTable.id, backtestId));
  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }

  const [row] = await db.insert(liveTradesTable).values({
    backtestId,
    tradeDate,
    symbol: bt.symbol,
    side: side ?? "n/a",
    entryPrice: entryPrice != null ? String(entryPrice) : "0",
    pnlAmount: pnlAmount != null ? String(pnlAmount) : null,
    note: note ?? null,
  }).returning();

  res.status(201).json({
    ...row,
    entryPrice: Number(row!.entryPrice),
    pnlAmount: row!.pnlAmount != null ? Number(row!.pnlAmount) : null,
    createdAt: row!.createdAt.toISOString(),
  });
});

// ─── DELETE /backtests/:id/live-trades/:tradeId ───────────────────────────────
// Resource-level check: verify the trade belongs to this backtestId before deleting.

router.delete("/backtests/:id/live-trades/:tradeId", requireAuth, async (req, res): Promise<void> => {
  const backtestId = parseInt(req.params["id"] as string, 10);
  const tradeId = parseInt(req.params["tradeId"] as string, 10);
  if (isNaN(tradeId) || isNaN(backtestId)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Verify the trade exists and belongs to this backtestId (resource-level authz)
  const [existing] = await db
    .select()
    .from(liveTradesTable)
    .where(eq(liveTradesTable.id, tradeId));

  if (!existing) { res.status(404).json({ error: "Trade not found" }); return; }
  if (existing.backtestId !== backtestId) {
    res.status(403).json({ error: "Trade does not belong to this backtest" });
    return;
  }

  await db.delete(liveTradesTable).where(eq(liveTradesTable.id, tradeId));
  res.status(204).end();
});

// ─── Backward-compat aliases (old paths still work) ──────────────────────────

router.get("/superpowers/live-trades/:backtestId", requireAuth, async (req, res): Promise<void> => {
  const backtestId = parseInt(req.params["backtestId"] as string, 10);
  if (isNaN(backtestId)) { res.status(400).json({ error: "Invalid backtestId" }); return; }
  const rows = await db.select().from(liveTradesTable).where(eq(liveTradesTable.backtestId, backtestId));
  res.json(rows.map((r) => ({
    ...r,
    entryPrice: Number(r.entryPrice),
    exitPrice: r.exitPrice != null ? Number(r.exitPrice) : null,
    pnlAmount: r.pnlAmount != null ? Number(r.pnlAmount) : null,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/superpowers/live-trades", requireAuth, async (req, res): Promise<void> => {
  const { backtestId, tradeDate, symbol, side, entryPrice, exitPrice, pnlAmount, note } = req.body;
  if (!backtestId || !tradeDate) {
    res.status(400).json({ error: "backtestId and tradeDate required" });
    return;
  }
  const [bt] = await db.select().from(backtestsTable).where(eq(backtestsTable.id, Number(backtestId)));
  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }

  const [row] = await db.insert(liveTradesTable).values({
    backtestId: Number(backtestId), tradeDate,
    symbol: symbol ?? bt.symbol,
    side: side ?? "n/a",
    entryPrice: entryPrice != null ? String(entryPrice) : "0",
    exitPrice: exitPrice != null ? String(exitPrice) : null,
    pnlAmount: pnlAmount != null ? String(pnlAmount) : null,
    note: note ?? null,
  }).returning();

  res.status(201).json({
    ...row,
    entryPrice: Number(row!.entryPrice),
    exitPrice: row!.exitPrice != null ? Number(row!.exitPrice) : null,
    pnlAmount: row!.pnlAmount != null ? Number(row!.pnlAmount) : null,
    createdAt: row!.createdAt.toISOString(),
  });
});

router.delete("/superpowers/live-trades/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(liveTradesTable).where(eq(liveTradesTable.id, id));
  res.status(204).end();
});

// ─── POST /superpowers/stress-test & /stress-test ────────────────────────────
// edgeVerdict: sharpe > 0.5 AND winRate > 50 AND profitFactor > 1.2

async function stressTestHandler(req: import("express").Request, res: import("express").Response): Promise<void> {
  const { strategyId, startDate, endDate, initialCapital, symbols } = req.body as {
    strategyId: number; startDate: string; endDate: string;
    initialCapital: number; symbols?: string[];
  };

  if (!strategyId || !startDate || !endDate || !initialCapital) {
    res.status(400).json({ error: "strategyId, startDate, endDate, initialCapital required" });
    return;
  }

  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, strategyId));
  if (!strategy) { res.status(404).json({ error: "Strategy not found" }); return; }

  const targetSymbols = symbols && symbols.length > 0 ? symbols : ALL_SYMBOLS;
  const cap = Number(initialCapital);

  const results = targetSymbols.map((symbol) => {
    try {
      const result = runBacktest(
        symbol, strategy.type,
        strategy.parameters as Record<string, unknown>,
        startDate, endDate, cap
      );
      const meta = SYMBOL_META[symbol];
      const { sharpeRatio, winRate, profitFactor } = result;
      const edgeVerdict: "edge" | "noise" =
        sharpeRatio > 0.5 && winRate > 50 && profitFactor > 1.2 ? "edge" : "noise";
      return {
        symbol, name: meta?.name ?? symbol, sector: meta?.sector ?? "Unknown",
        totalReturn: result.totalReturn, sharpeRatio,
        maxDrawdown: result.maxDrawdown, winRate,
        totalTrades: result.totalTrades, profitFactor,
        finalCapital: result.finalCapital, annualizedReturn: result.annualizedReturn,
        edgeVerdict,
      };
    } catch { return null; }
  }).filter(Boolean) as NonNullable<{ symbol: string; name: string; sector: string; totalReturn: number; sharpeRatio: number; maxDrawdown: number; winRate: number; totalTrades: number; profitFactor: number; finalCapital: number; annualizedReturn: number; edgeVerdict: "edge" | "noise" }>[];

  const sorted = [...results].sort((a, b) => b.sharpeRatio - a.sharpeRatio);

  const bySector = new Map<string, typeof sorted>();
  for (const r of sorted) {
    if (!bySector.has(r.sector)) bySector.set(r.sector, []);
    bySector.get(r.sector)!.push(r);
  }

  const sectorSummary = Array.from(bySector.entries()).map(([sector, rows]) => ({
    sector, count: rows.length,
    avgReturn: rows.reduce((a, r) => a + r.totalReturn, 0) / rows.length,
    avgSharpe: rows.reduce((a, r) => a + r.sharpeRatio, 0) / rows.length,
    avgDrawdown: rows.reduce((a, r) => a + r.maxDrawdown, 0) / rows.length,
    edgeCount: rows.filter((r) => r.edgeVerdict === "edge").length,
    best: [...rows].sort((a, b) => b.sharpeRatio - a.sharpeRatio)[0]?.symbol ?? "",
  }));

  const edgeCount = results.filter((r) => r.edgeVerdict === "edge").length;

  res.json({
    strategyName: strategy.name, strategyType: strategy.type,
    startDate, endDate, initialCapital: cap,
    totalSymbols: results.length, results: sorted, sectorSummary,
    stats: {
      avgReturn: results.reduce((a, r) => a + r.totalReturn, 0) / results.length,
      avgSharpe: results.reduce((a, r) => a + r.sharpeRatio, 0) / results.length,
      profitable: results.filter((r) => r.totalReturn > 0).length,
      edgeCount,
      topSymbol: sorted[0]?.symbol ?? "",
      worstSymbol: sorted[sorted.length - 1]?.symbol ?? "",
    },
  });
}

// Register on both paths — canonical spec path + legacy path
router.post("/stress-test", requireAuth, stressTestHandler);
router.post("/superpowers/stress-test", requireAuth, stressTestHandler);

// ─────────────────────────────────────────────────────────────────────────────
// ECONOMIC EVENT IMPACT OVERLAY
// GET /backtests/:id/event-impact
// Overlaps the backtest's trade history with a catalog of historical economic
// events and returns per-event impact stats (win rate in vs. out of window).
// ─────────────────────────────────────────────────────────────────────────────

const ECONOMIC_EVENTS = [
  // ── Fed FOMC meetings ─────────────────────────────────────────────────────
  { id: "fomc-2020-03-15", name: "Emergency Fed Cut (COVID)", type: "fed", date: "2020-03-15", windowDays: 5, description: "Emergency 100bps cut to near-zero as COVID shock hits markets" },
  { id: "fomc-2021-06-16", name: "Fed Tapering Signals Begin", type: "fed", date: "2021-06-16", windowDays: 4, description: "Fed signals it's thinking about thinking about tapering" },
  { id: "fomc-2021-11-03", name: "Fed Taper Announced", type: "fed", date: "2021-11-03", windowDays: 4, description: "Official start of bond-purchase tapering" },
  { id: "fomc-2022-03-16", name: "Fed Hike +25bps (First)", type: "fed", date: "2022-03-16", windowDays: 4, description: "First rate hike since 2018, beginning of aggressive tightening cycle" },
  { id: "fomc-2022-05-04", name: "Fed Hike +50bps", type: "fed", date: "2022-05-04", windowDays: 4, description: "Largest single hike in 22 years signals inflation war declared" },
  { id: "fomc-2022-06-15", name: "Fed Hike +75bps (First)", type: "fed", date: "2022-06-15", windowDays: 4, description: "75bps — first of four consecutive 75bps moves, shocking markets" },
  { id: "fomc-2022-07-27", name: "Fed Hike +75bps", type: "fed", date: "2022-07-27", windowDays: 4, description: "Second consecutive 75bps hike" },
  { id: "fomc-2022-09-21", name: "Fed Hike +75bps", type: "fed", date: "2022-09-21", windowDays: 4, description: "Third consecutive 75bps, peak hawkishness" },
  { id: "fomc-2022-11-02", name: "Fed Hike +75bps", type: "fed", date: "2022-11-02", windowDays: 4, description: "Fourth consecutive 75bps hike" },
  { id: "fomc-2022-12-14", name: "Fed Hike +50bps (Step Down)", type: "fed", date: "2022-12-14", windowDays: 4, description: "Step down signals peak rate approaching" },
  { id: "fomc-2023-02-01", name: "Fed Hike +25bps", type: "fed", date: "2023-02-01", windowDays: 4, description: "Smaller hike as inflation data improves" },
  { id: "fomc-2023-05-03", name: "Fed Hike +25bps (Likely Last)", type: "fed", date: "2023-05-03", windowDays: 4, description: "Possibly final hike of the cycle" },
  { id: "fomc-2023-07-26", name: "Fed Hike +25bps (Peak Rate)", type: "fed", date: "2023-07-26", windowDays: 4, description: "Rates peak at 5.25–5.50%, highest since 2001" },
  { id: "fomc-2024-09-18", name: "Fed First Cut -50bps", type: "fed", date: "2024-09-18", windowDays: 4, description: "Pivots to easing cycle with a jumbo 50bps cut" },
  // ── CPI prints ────────────────────────────────────────────────────────────
  { id: "cpi-2021-10-13", name: "CPI 5.4% — Inflation Not Transitory", type: "cpi", date: "2021-10-13", windowDays: 3, description: "CPI hits 30-year high, Fed 'transitory' narrative collapses" },
  { id: "cpi-2022-06-10", name: "CPI 8.6% — 41-Year High", type: "cpi", date: "2022-06-10", windowDays: 3, description: "Shock CPI triggers recession fears and crypto crash" },
  { id: "cpi-2022-07-13", name: "CPI 9.1% — Peak Inflation", type: "cpi", date: "2022-07-13", windowDays: 3, description: "Highest US inflation since 1981, markets brace for more hikes" },
  { id: "cpi-2022-10-13", name: "CPI 8.2% — 'Core' Surprise", type: "cpi", date: "2022-10-13", windowDays: 3, description: "Hot core CPI triggers massive intraday reversal across assets" },
  { id: "cpi-2023-02-14", name: "CPI 6.4% — Stickier Than Expected", type: "cpi", date: "2023-02-14", windowDays: 3, description: "Higher-than-expected read dashes rate cut hopes" },
  { id: "cpi-2023-06-13", name: "CPI 4.0% — Cooling Confirmed", type: "cpi", date: "2023-06-13", windowDays: 3, description: "Significant drop sparks risk-on rally" },
  { id: "cpi-2024-03-12", name: "CPI 3.2% — Disinflation Stalls", type: "cpi", date: "2024-03-12", windowDays: 3, description: "Above-consensus CPI delays expected rate cuts" },
  // ── Major macro events ────────────────────────────────────────────────────
  { id: "macro-2020-02-20", name: "COVID-19 Market Crash Begins", type: "macro", date: "2020-02-20", windowDays: 20, description: "S&P falls 34% in 33 days — fastest bear market in history" },
  { id: "macro-2020-03-23", name: "COVID Crash Bottom / Fed Bazooka", type: "macro", date: "2020-03-23", windowDays: 10, description: "Fed announces unlimited QE, markets find floor" },
  { id: "macro-2021-01-28", name: "GameStop / Meme Stock Frenzy", type: "macro", date: "2021-01-28", windowDays: 7, description: "Retail squeeze triggers extreme volatility across risk assets" },
  { id: "macro-2021-05-19", name: "Crypto Flash Crash -50%", type: "macro", date: "2021-05-19", windowDays: 5, description: "BTC drops 50% in a week on China mining ban and Musk tweets" },
  { id: "macro-2022-05-12", name: "LUNA/UST Collapse", type: "macro", date: "2022-05-12", windowDays: 7, description: "$60B Terra ecosystem implodes, crypto contagion spreads" },
  { id: "macro-2022-11-11", name: "FTX Bankruptcy", type: "macro", date: "2022-11-11", windowDays: 10, description: "FTX collapses, second-largest crypto exchange gone overnight" },
  { id: "macro-2023-03-10", name: "SVB / Banking Crisis", type: "macro", date: "2023-03-10", windowDays: 10, description: "Silicon Valley Bank failure triggers bank run fears, safe-haven flows" },
  { id: "macro-2023-10-07", name: "Israel-Hamas Conflict Outbreak", type: "macro", date: "2023-10-07", windowDays: 5, description: "Geopolitical shock lifts oil and gold, pressures risk assets" },
  { id: "macro-2024-08-05", name: "Global Market Selloff (Yen Carry)", type: "macro", date: "2024-08-05", windowDays: 5, description: "BOJ rate hike unwinds yen carry trade, VIX spikes to 65" },
  // ── US Elections ──────────────────────────────────────────────────────────
  { id: "election-2020-11-03", name: "US Presidential Election 2020", type: "election", date: "2020-11-03", windowDays: 7, description: "Biden wins, markets rally on expectation of stimulus" },
  { id: "election-2024-11-05", name: "US Presidential Election 2024", type: "election", date: "2024-11-05", windowDays: 5, description: "Trump wins, crypto surges, risk-on rotation" },
] as const;

router.get("/backtests/:id/event-impact", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [backtest] = await db
    .select({ id: backtestsTable.id, startDate: backtestsTable.startDate, endDate: backtestsTable.endDate, status: backtestsTable.status })
    .from(backtestsTable)
    .where(eq(backtestsTable.id, id));

  if (!backtest) { res.status(404).json({ error: "Backtest not found" }); return; }

  const trades = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.backtestId, id));

  if (!trades.length) {
    res.json({ events: [], summary: { totalEvents: 0, tradesInEvents: 0, winRateInEvents: null, winRateOutEvents: null } });
    return;
  }

  const btStart = new Date(backtest.startDate).getTime();
  const btEnd = new Date(backtest.endDate).getTime();

  function overlap(tradeEntry: string, tradeExit: string, eventDate: string, windowDays: number): boolean {
    const eDate = new Date(eventDate).getTime();
    const winStart = eDate - windowDays * 86400000;
    const winEnd = eDate + windowDays * 86400000;
    const tEntry = new Date(tradeEntry).getTime();
    const tExit = new Date(tradeExit).getTime();
    return tEntry <= winEnd && tExit >= winStart;
  }

  const relevantEvents = ECONOMIC_EVENTS.filter(ev => {
    const eDate = new Date(ev.date).getTime();
    return eDate >= btStart - ev.windowDays * 86400000 && eDate <= btEnd + ev.windowDays * 86400000;
  });

  const results = relevantEvents.map(ev => {
    const inWindow = trades.filter(t => overlap(t.entryDate, t.exitDate, ev.date, ev.windowDays));
    const wins = inWindow.filter(t => Number(t.pnl) > 0);
    const avgPnl = inWindow.length ? inWindow.reduce((s, t) => s + Number(t.pnlPercent), 0) / inWindow.length : null;
    return {
      id: ev.id,
      name: ev.name,
      type: ev.type,
      date: ev.date,
      windowDays: ev.windowDays,
      description: ev.description,
      tradesInWindow: inWindow.length,
      winsInWindow: wins.length,
      winRateInWindow: inWindow.length ? (wins.length / inWindow.length) * 100 : null,
      avgPnlInWindow: avgPnl,
      trades: inWindow.map(t => ({
        entryDate: t.entryDate,
        exitDate: t.exitDate,
        side: t.side,
        pnlPercent: Number(t.pnlPercent),
        pnl: Number(t.pnl),
      })),
    };
  });

  const activeEvents = results.filter(r => r.tradesInWindow > 0);
  const allEventTrades = trades.filter(t =>
    relevantEvents.some(ev => overlap(t.entryDate, t.exitDate, ev.date, ev.windowDays))
  );
  const outsideTrades = trades.filter(t =>
    !relevantEvents.some(ev => overlap(t.entryDate, t.exitDate, ev.date, ev.windowDays))
  );

  const winRateIn = allEventTrades.length
    ? (allEventTrades.filter(t => Number(t.pnl) > 0).length / allEventTrades.length) * 100
    : null;
  const winRateOut = outsideTrades.length
    ? (outsideTrades.filter(t => Number(t.pnl) > 0).length / outsideTrades.length) * 100
    : null;

  res.json({
    events: results,
    summary: {
      totalEvents: relevantEvents.length,
      activeEvents: activeEvents.length,
      tradesInEvents: allEventTrades.length,
      tradesOutEvents: outsideTrades.length,
      winRateInEvents: winRateIn,
      winRateOutEvents: winRateOut,
    },
  });
});

export default router;
