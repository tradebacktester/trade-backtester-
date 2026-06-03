import { Router, type IRouter } from "express";
import { db, liveTradesTable, backtestsTable, strategiesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { runBacktest, generatePriceData } from "../lib/backtest-engine";
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

// ─── All 55 symbols with seeds + volatilities ────────────────────────────────

const SYMBOL_META: Record<string, { seed: number; vol: number; sector: string; name: string; drift: number }> = {
  BTCUSDT:  { seed: 45000, vol: 0.055, sector: "Crypto",    name: "Bitcoin",       drift: 0.0004 },
  ETHUSDT:  { seed: 3000,  vol: 0.065, sector: "Crypto",    name: "Ethereum",      drift: 0.0004 },
  SOLUSDT:  { seed: 120,   vol: 0.08,  sector: "Crypto",    name: "Solana",        drift: 0.0005 },
  BNBUSDT:  { seed: 400,   vol: 0.06,  sector: "Crypto",    name: "BNB",           drift: 0.0003 },
  XRPUSDT:  { seed: 0.7,   vol: 0.07,  sector: "Crypto",    name: "Ripple",        drift: 0.0002 },
  ADAUSDT:  { seed: 0.5,   vol: 0.07,  sector: "Crypto",    name: "Cardano",       drift: 0.0002 },
  DOGEUSDT: { seed: 0.12,  vol: 0.09,  sector: "Crypto",    name: "Dogecoin",      drift: 0.0001 },
  AVAXUSDT: { seed: 35,    vol: 0.08,  sector: "Crypto",    name: "Avalanche",     drift: 0.0003 },
  DOTUSDT:  { seed: 8,     vol: 0.08,  sector: "Crypto",    name: "Polkadot",      drift: 0.0002 },
  LINKUSDT: { seed: 15,    vol: 0.07,  sector: "Crypto",    name: "Chainlink",     drift: 0.0003 },
  MATICUSDT:{ seed: 0.9,   vol: 0.09,  sector: "Crypto",    name: "Polygon",       drift: 0.0003 },
  UNIUSDT:  { seed: 6,     vol: 0.085, sector: "Crypto",    name: "Uniswap",       drift: 0.0002 },
  ATOMUSDT: { seed: 12,    vol: 0.08,  sector: "Crypto",    name: "Cosmos",        drift: 0.0002 },
  AAPL:     { seed: 185,   vol: 0.018, sector: "Tech",      name: "Apple",         drift: 0.0003 },
  MSFT:     { seed: 375,   vol: 0.016, sector: "Tech",      name: "Microsoft",     drift: 0.0003 },
  NVDA:     { seed: 500,   vol: 0.035, sector: "Tech",      name: "Nvidia",        drift: 0.0006 },
  GOOGL:    { seed: 155,   vol: 0.018, sector: "Tech",      name: "Alphabet",      drift: 0.0003 },
  AMZN:     { seed: 180,   vol: 0.022, sector: "Tech",      name: "Amazon",        drift: 0.0003 },
  META:     { seed: 350,   vol: 0.025, sector: "Tech",      name: "Meta",          drift: 0.0004 },
  TSLA:     { seed: 250,   vol: 0.04,  sector: "Auto",      name: "Tesla",         drift: 0.0003 },
  NFLX:     { seed: 450,   vol: 0.028, sector: "Media",     name: "Netflix",       drift: 0.0003 },
  AMD:      { seed: 165,   vol: 0.038, sector: "Tech",      name: "AMD",           drift: 0.0004 },
  INTC:     { seed: 40,    vol: 0.022, sector: "Tech",      name: "Intel",         drift: 0.0001 },
  ORCL:     { seed: 110,   vol: 0.02,  sector: "Tech",      name: "Oracle",        drift: 0.0002 },
  CRM:      { seed: 230,   vol: 0.025, sector: "Tech",      name: "Salesforce",    drift: 0.0003 },
  PYPL:     { seed: 75,    vol: 0.03,  sector: "Fintech",   name: "PayPal",        drift: 0.0001 },
  SQ:       { seed: 70,    vol: 0.04,  sector: "Fintech",   name: "Block",         drift: 0.0002 },
  SPY:      { seed: 450,   vol: 0.012, sector: "Index",     name: "S&P 500 ETF",   drift: 0.0003 },
  QQQ:      { seed: 380,   vol: 0.015, sector: "Index",     name: "NASDAQ ETF",    drift: 0.0003 },
  IWM:      { seed: 195,   vol: 0.016, sector: "Index",     name: "Russell 2000",  drift: 0.0002 },
  DIA:      { seed: 350,   vol: 0.011, sector: "Index",     name: "Dow Jones",     drift: 0.0003 },
  GLD:      { seed: 185,   vol: 0.01,  sector: "Commodity", name: "Gold ETF",      drift: 0.0001 },
  SLV:      { seed: 22,    vol: 0.018, sector: "Commodity", name: "Silver ETF",    drift: 0.0001 },
  TLT:      { seed: 95,    vol: 0.009, sector: "Bond",      name: "20yr Bond",     drift: 0.0001 },
  VIX:      { seed: 18,    vol: 0.05,  sector: "Vol",       name: "VIX",           drift: -0.0002 },
  EURUSD:   { seed: 1.08,  vol: 0.006, sector: "Forex",     name: "EUR/USD",       drift: 0.0 },
  GBPUSD:   { seed: 1.26,  vol: 0.007, sector: "Forex",     name: "GBP/USD",       drift: 0.0 },
  USDJPY:   { seed: 148,   vol: 0.005, sector: "Forex",     name: "USD/JPY",       drift: 0.0001 },
  AUDUSD:   { seed: 0.65,  vol: 0.007, sector: "Forex",     name: "AUD/USD",       drift: 0.0 },
  USDCAD:   { seed: 1.36,  vol: 0.005, sector: "Forex",     name: "USD/CAD",       drift: 0.0 },
  USDCHF:   { seed: 0.88,  vol: 0.005, sector: "Forex",     name: "USD/CHF",       drift: -0.0001 },
  NZDUSD:   { seed: 0.61,  vol: 0.007, sector: "Forex",     name: "NZD/USD",       drift: 0.0 },
  XAUUSD:   { seed: 2000,  vol: 0.01,  sector: "Commodity", name: "Gold Spot",     drift: 0.0001 },
  XAGUSD:   { seed: 24,    vol: 0.018, sector: "Commodity", name: "Silver Spot",   drift: 0.0001 },
  WTIUSD:   { seed: 78,    vol: 0.025, sector: "Energy",    name: "WTI Crude",     drift: 0.0001 },
  BRENTUSD: { seed: 82,    vol: 0.024, sector: "Energy",    name: "Brent Crude",   drift: 0.0001 },
  NATGASUSD:{ seed: 2.5,   vol: 0.04,  sector: "Energy",    name: "Natural Gas",   drift: -0.0001 },
  COPPER:   { seed: 3.8,   vol: 0.018, sector: "Metal",     name: "Copper",        drift: 0.0001 },
  DAX:      { seed: 16500, vol: 0.014, sector: "Index",     name: "DAX",           drift: 0.0003 },
  FTSE:     { seed: 7600,  vol: 0.012, sector: "Index",     name: "FTSE 100",      drift: 0.0002 },
  NIKKEI:   { seed: 33000, vol: 0.013, sector: "Index",     name: "Nikkei 225",    drift: 0.0002 },
  HANGSENG: { seed: 17000, vol: 0.016, sector: "Index",     name: "Hang Seng",     drift: 0.0001 },
  ASX200:   { seed: 7500,  vol: 0.012, sector: "Index",     name: "ASX 200",       drift: 0.0002 },
  CAC40:    { seed: 7500,  vol: 0.013, sector: "Index",     name: "CAC 40",        drift: 0.0002 },
};

export const ALL_SYMBOLS = Object.keys(SYMBOL_META);

// ─── Regime Classification (SMA50 + Rolling Vol) ─────────────────────────────
// Regimes: trending_bull, trending_bear, highvol_bull, highvol_bear

export interface RegimePeriod {
  startDate: string;
  endDate: string;
  regime: "trending_bull" | "trending_bear" | "highvol_bull" | "highvol_bear";
  avgReturn: number;
  volatility: number;
  tradeCount: number;
  winRate: number;
  totalPnl: number;
}

function computeSMA(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

export function classifyRegimes(
  bars: Array<{ date: string; close: number }>,
  trades: Array<{ entryDate: string; exitDate: string; pnl: number }>,
  windowDays = 30
): RegimePeriod[] {
  if (bars.length < 60) return [];

  const closes = bars.map((b) => b.close);
  const sma50 = computeSMA(closes, 50);

  const periods: RegimePeriod[] = [];
  let i = 50;

  while (i + windowDays <= bars.length) {
    const windowBars = bars.slice(i, i + windowDays);
    const startDate = windowBars[0].date;
    const endDate = windowBars[windowBars.length - 1].date;

    const returns: number[] = [];
    for (let j = 1; j < windowBars.length; j++) {
      returns.push((windowBars[j].close - windowBars[j - 1].close) / windowBars[j - 1].close);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, r) => a + (r - avgReturn) ** 2, 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;

    const midBar = windowBars[Math.floor(windowBars.length / 2)];
    const midIdx = bars.findIndex((b) => b.date === midBar.date);
    const currentSma = midIdx >= 0 ? sma50[midIdx] : null;
    const priceAboveSma = currentSma != null ? midBar.close > currentSma : true;

    const HIGH_VOL_THRESHOLD = 25;
    let regime: RegimePeriod["regime"];
    if (volatility >= HIGH_VOL_THRESHOLD) {
      regime = priceAboveSma ? "highvol_bull" : "highvol_bear";
    } else {
      regime = priceAboveSma ? "trending_bull" : "trending_bear";
    }

    const periodTrades = trades.filter(
      (t) => t.entryDate >= startDate && t.exitDate <= endDate
    );
    const winners = periodTrades.filter((t) => t.pnl > 0);
    const winRate = periodTrades.length > 0 ? (winners.length / periodTrades.length) * 100 : 0;
    const totalPnl = periodTrades.reduce((a, t) => a + t.pnl, 0);

    periods.push({
      startDate, endDate, regime,
      avgReturn: avgReturn * 252 * 100,
      volatility,
      tradeCount: periodTrades.length,
      winRate, totalPnl,
    });

    i += windowDays;
  }

  return periods;
}

// ─── Compute Strategy DNA vector (6 dimensions, 0-100) ───────────────────────

function computeDnaVector(params: {
  type: string;
  totalReturn: number; sharpeRatio: number; maxDrawdown: number;
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

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * b[i]!, 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (magA === 0 || magB === 0) return 0;
  return Math.max(0, Math.min(1, dot / (magA * magB)));
}

// ─── GET /strategies/dna — Pairwise similarity matrix ───────────────────────

router.get("/strategies/dna", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;

  const strategies = await db
    .select()
    .from(strategiesTable)
    .where(eq(strategiesTable.userId, userId));

  if (strategies.length === 0) {
    res.json({ strategies: [], matrix: [], duplicates: [] });
    return;
  }

  const backtests = await db
    .select()
    .from(backtestsTable)
    .where(eq(backtestsTable.userId, userId))
    .orderBy(desc(backtestsTable.createdAt));

  const latestByStrategy = new Map<number, typeof backtests[0]>();
  for (const bt of backtests) {
    if (bt.status === "complete" && !latestByStrategy.has(bt.strategyId)) {
      latestByStrategy.set(bt.strategyId, bt);
    }
  }

  type StratEntry = {
    id: number; name: string; type: string;
    dna: Record<string, number>; hasBacktest: boolean;
    grade: string; overallScore: number;
  };
  const entries: StratEntry[] = strategies.map((s) => {
    const bt = latestByStrategy.get(s.id);
    const dna = computeDnaVector({
      type: s.type,
      totalReturn: bt ? Number(bt.totalReturn ?? 0) : 0,
      sharpeRatio: bt ? Number(bt.sharpeRatio ?? 0) : 0,
      maxDrawdown: bt ? Number(bt.maxDrawdown ?? 0) : 0,
      winRate: bt ? Number(bt.winRate ?? 0) : 0,
      profitFactor: bt ? Number(bt.profitFactor ?? 0) : 0,
      annualizedReturn: bt ? Number(bt.annualizedReturn ?? 0) : 0,
      sortinoRatio: bt ? Number(bt.sortinoRatio ?? 0) : 0,
    });
    const overallScore = Math.round(Object.values(dna).reduce((a, b) => a + b, 0) / 6);
    const grade =
      overallScore >= 80 ? "S" :
      overallScore >= 65 ? "A" :
      overallScore >= 50 ? "B" :
      overallScore >= 35 ? "C" : "D";
    return { id: s.id, name: s.name, type: s.type, dna, hasBacktest: !!bt, grade, overallScore };
  });

  const matrix: { i: number; j: number; similarity: number }[] = [];
  const duplicates: { a: string; b: string; similarity: number }[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      const vecA = Object.values(a.dna);
      const vecB = Object.values(b.dna);
      const sim = cosineSimilarity(vecA, vecB);
      matrix.push({ i, j, similarity: Math.round(sim * 100) });
      if (sim >= 0.92) {
        duplicates.push({ a: a.name, b: b.name, similarity: Math.round(sim * 100) });
      }
    }
  }

  res.json({ strategies: entries, matrix, duplicates });
});

// ─── GET /backtests/:id/regime-analysis ─────────────────────────────────────

router.get("/backtests/:id/regime-analysis", async (req, res): Promise<void> => {
  const backtestId = parseInt(req.params.id, 10);
  if (isNaN(backtestId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [bt] = await db.select().from(backtestsTable).where(eq(backtestsTable.id, backtestId));
  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }
  if (bt.status !== "complete") { res.json({ regimes: [], summary: {} }); return; }

  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, bt.strategyId));
  if (!strategy) { res.status(404).json({ error: "Strategy not found" }); return; }

  const bars = generatePriceData(bt.symbol, bt.startDate, bt.endDate);
  const result = runBacktest(
    bt.symbol, strategy.type,
    strategy.parameters as Record<string, unknown>,
    bt.startDate, bt.endDate,
    Number(bt.initialCapital), Number(bt.commission ?? 0), Number(bt.slippage ?? 0)
  );

  const regimes = classifyRegimes(
    bars.map((b) => ({ date: b.date, close: b.close })),
    result.trades.map((t) => ({ entryDate: t.entryDate, exitDate: t.exitDate, pnl: t.pnl }))
  );

  const regimeKeys = ["trending_bull", "trending_bear", "highvol_bull", "highvol_bear"] as const;
  const grouped = Object.fromEntries(
    regimeKeys.map((k) => [k, regimes.filter((r) => r.regime === k)])
  );

  const avgByRegime = (list: RegimePeriod[]) =>
    list.length === 0 ? null : {
      count: list.length,
      totalTrades: list.reduce((a, r) => a + r.tradeCount, 0),
      avgWinRate: list.reduce((a, r) => a + r.winRate, 0) / list.length,
      avgReturn: list.reduce((a, r) => a + r.avgReturn, 0) / list.length,
      totalPnl: list.reduce((a, r) => a + r.totalPnl, 0),
    };

  res.json({
    regimes,
    summary: Object.fromEntries(
      regimeKeys.map((k) => [k, avgByRegime(grouped[k]!)])
    ),
  });
});

// ─── GET /backtests/:id/divergence ───────────────────────────────────────────

router.get("/backtests/:id/divergence", requireAuth, async (req, res): Promise<void> => {
  const backtestId = parseInt(req.params.id, 10);
  if (isNaN(backtestId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [bt] = await db.select().from(backtestsTable).where(eq(backtestsTable.id, backtestId));
  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }
  if (bt.status !== "complete") { res.json({ expected: [], actual: [] }); return; }

  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, bt.strategyId));
  if (!strategy) { res.status(404).json({ error: "Strategy not found" }); return; }

  const result = runBacktest(
    bt.symbol, strategy.type,
    strategy.parameters as Record<string, unknown>,
    bt.startDate, bt.endDate,
    Number(bt.initialCapital), Number(bt.commission ?? 0), Number(bt.slippage ?? 0)
  );

  const expectedCurve = result.equityCurve.map((p) => ({
    date: p.date,
    value: Number((p.value - Number(bt.initialCapital)).toFixed(2)),
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

  res.json({
    expected: expectedCurve,
    actual: actualCurve,
    liveTotal,
    expectedTotal,
    divergenceScore,
    initialCapital: Number(bt.initialCapital),
  });
});

// ─── POST /superpowers/stress-test ──────────────────────────────────────────

router.post("/superpowers/stress-test", async (req, res): Promise<void> => {
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
      const sharpeRatio = result.sharpeRatio;
      const edgeVerdict: "edge" | "noise" = sharpeRatio > 0.5 ? "edge" : "noise";
      return {
        symbol, name: meta?.name ?? symbol, sector: meta?.sector ?? "Unknown",
        totalReturn: result.totalReturn, sharpeRatio,
        maxDrawdown: result.maxDrawdown, winRate: result.winRate,
        totalTrades: result.totalTrades, profitFactor: result.profitFactor,
        finalCapital: result.finalCapital, annualizedReturn: result.annualizedReturn,
        edgeVerdict,
      };
    } catch { return null; }
  }).filter(Boolean) as NonNullable<ReturnType<typeof results[0]>>[];

  // Sort by Sharpe ratio descending
  const sorted = [...results].sort((a, b) => b.sharpeRatio - a.sharpeRatio);

  const bySector = new Map<string, typeof sorted>();
  for (const r of sorted) {
    if (!bySector.has(r.sector)) bySector.set(r.sector, []);
    bySector.get(r.sector)!.push(r);
  }

  const sectorSummary = Array.from(bySector.entries()).map(([sector, rows]) => ({
    sector,
    count: rows.length,
    avgReturn: rows.reduce((a, r) => a + r.totalReturn, 0) / rows.length,
    avgSharpe: rows.reduce((a, r) => a + r.sharpeRatio, 0) / rows.length,
    avgDrawdown: rows.reduce((a, r) => a + r.maxDrawdown, 0) / rows.length,
    edgeCount: rows.filter((r) => r.edgeVerdict === "edge").length,
    best: [...rows].sort((a, b) => b.sharpeRatio - a.sharpeRatio)[0]?.symbol ?? "",
  }));

  const edgeCount = results.filter((r) => r.edgeVerdict === "edge").length;

  res.json({
    strategyName: strategy.name,
    strategyType: strategy.type,
    startDate, endDate, initialCapital: cap,
    totalSymbols: results.length,
    results: sorted,
    sectorSummary,
    stats: {
      avgReturn: results.reduce((a, r) => a + r.totalReturn, 0) / results.length,
      avgSharpe: results.reduce((a, r) => a + r.sharpeRatio, 0) / results.length,
      profitable: results.filter((r) => r.totalReturn > 0).length,
      edgeCount,
      topSymbol: sorted[0]?.symbol ?? "",
      worstSymbol: sorted[sorted.length - 1]?.symbol ?? "",
    },
  });
});

// ─── GET /superpowers/live-trades/:backtestId — requires auth ────────────────

router.get("/superpowers/live-trades/:backtestId", requireAuth, async (req, res): Promise<void> => {
  const backtestId = parseInt(req.params.backtestId, 10);
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

// ─── POST /superpowers/live-trades ──────────────────────────────────────────

router.post("/superpowers/live-trades", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const { backtestId, tradeDate, symbol, side, entryPrice, exitPrice, pnlAmount, note } = req.body;

  if (!backtestId || !tradeDate || !symbol || !side || !entryPrice) {
    res.status(400).json({ error: "backtestId, tradeDate, symbol, side, entryPrice required" });
    return;
  }

  const [bt] = await db.select().from(backtestsTable).where(eq(backtestsTable.id, Number(backtestId)));
  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }

  const [row] = await db.insert(liveTradesTable).values({
    backtestId: Number(backtestId), tradeDate, symbol, side,
    entryPrice: String(entryPrice),
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

// ─── DELETE /superpowers/live-trades/:id ─────────────────────────────────────

router.delete("/superpowers/live-trades/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [trade] = await db.select().from(liveTradesTable).where(eq(liveTradesTable.id, id));
  if (!trade) { res.status(404).json({ error: "Trade not found" }); return; }

  await db.delete(liveTradesTable).where(eq(liveTradesTable.id, id));
  res.json({ ok: true });
});

export default router;
