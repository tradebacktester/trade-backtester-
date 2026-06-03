import { Router, type IRouter } from "express";
import { db, liveTradesTable, backtestsTable, strategiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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
  next();
}

const router: IRouter = Router();

// ─── All 55 symbols with seeds + volatilities ────────────────────────────────

const SYMBOL_META: Record<string, { seed: number; vol: number; sector: string; name: string; drift: number }> = {
  // Crypto
  BTCUSDT:  { seed: 45000, vol: 0.055, sector: "Crypto", name: "Bitcoin",     drift: 0.0004 },
  ETHUSDT:  { seed: 3000,  vol: 0.065, sector: "Crypto", name: "Ethereum",    drift: 0.0004 },
  SOLUSDT:  { seed: 120,   vol: 0.08,  sector: "Crypto", name: "Solana",      drift: 0.0005 },
  BNBUSDT:  { seed: 400,   vol: 0.06,  sector: "Crypto", name: "BNB",         drift: 0.0003 },
  XRPUSDT:  { seed: 0.7,   vol: 0.07,  sector: "Crypto", name: "Ripple",      drift: 0.0002 },
  ADAUSDT:  { seed: 0.5,   vol: 0.07,  sector: "Crypto", name: "Cardano",     drift: 0.0002 },
  DOGEUSDT: { seed: 0.12,  vol: 0.09,  sector: "Crypto", name: "Dogecoin",    drift: 0.0001 },
  AVAXUSDT: { seed: 35,    vol: 0.08,  sector: "Crypto", name: "Avalanche",   drift: 0.0003 },
  DOTUSDT:  { seed: 8,     vol: 0.08,  sector: "Crypto", name: "Polkadot",    drift: 0.0002 },
  LINKUSDT: { seed: 15,    vol: 0.07,  sector: "Crypto", name: "Chainlink",   drift: 0.0003 },
  MATICUSDT:{ seed: 0.9,   vol: 0.09,  sector: "Crypto", name: "Polygon",     drift: 0.0003 },
  UNIUSDT:  { seed: 6,     vol: 0.085, sector: "Crypto", name: "Uniswap",     drift: 0.0002 },
  ATOMUSDT: { seed: 12,    vol: 0.08,  sector: "Crypto", name: "Cosmos",      drift: 0.0002 },
  // US Stocks
  AAPL:     { seed: 185,   vol: 0.018, sector: "Tech",   name: "Apple",       drift: 0.0003 },
  MSFT:     { seed: 375,   vol: 0.016, sector: "Tech",   name: "Microsoft",   drift: 0.0003 },
  NVDA:     { seed: 500,   vol: 0.035, sector: "Tech",   name: "Nvidia",      drift: 0.0006 },
  GOOGL:    { seed: 155,   vol: 0.018, sector: "Tech",   name: "Alphabet",    drift: 0.0003 },
  AMZN:     { seed: 180,   vol: 0.022, sector: "Tech",   name: "Amazon",      drift: 0.0003 },
  META:     { seed: 350,   vol: 0.025, sector: "Tech",   name: "Meta",        drift: 0.0004 },
  TSLA:     { seed: 250,   vol: 0.04,  sector: "Auto",   name: "Tesla",       drift: 0.0003 },
  NFLX:     { seed: 450,   vol: 0.028, sector: "Media",  name: "Netflix",     drift: 0.0003 },
  AMD:      { seed: 165,   vol: 0.038, sector: "Tech",   name: "AMD",         drift: 0.0004 },
  INTC:     { seed: 40,    vol: 0.022, sector: "Tech",   name: "Intel",       drift: 0.0001 },
  ORCL:     { seed: 110,   vol: 0.02,  sector: "Tech",   name: "Oracle",      drift: 0.0002 },
  CRM:      { seed: 230,   vol: 0.025, sector: "Tech",   name: "Salesforce",  drift: 0.0003 },
  PYPL:     { seed: 75,    vol: 0.03,  sector: "Fintech",name: "PayPal",      drift: 0.0001 },
  SQ:       { seed: 70,    vol: 0.04,  sector: "Fintech",name: "Block",       drift: 0.0002 },
  // ETFs / Indices
  SPY:      { seed: 450,   vol: 0.012, sector: "Index",  name: "S&P 500 ETF", drift: 0.0003 },
  QQQ:      { seed: 380,   vol: 0.015, sector: "Index",  name: "NASDAQ ETF",  drift: 0.0003 },
  IWM:      { seed: 195,   vol: 0.016, sector: "Index",  name: "Russell 2000",drift: 0.0002 },
  DIA:      { seed: 350,   vol: 0.011, sector: "Index",  name: "Dow Jones",   drift: 0.0003 },
  GLD:      { seed: 185,   vol: 0.01,  sector: "Commodity",name:"Gold ETF",   drift: 0.0001 },
  SLV:      { seed: 22,    vol: 0.018, sector: "Commodity",name:"Silver ETF", drift: 0.0001 },
  TLT:      { seed: 95,    vol: 0.009, sector: "Bond",   name: "20yr Bond",   drift: 0.0001 },
  VIX:      { seed: 18,    vol: 0.05,  sector: "Vol",    name: "VIX",         drift: -0.0002},
  // Forex
  EURUSD:   { seed: 1.08,  vol: 0.006, sector: "Forex",  name: "EUR/USD",     drift: 0.0 },
  GBPUSD:   { seed: 1.26,  vol: 0.007, sector: "Forex",  name: "GBP/USD",     drift: 0.0 },
  USDJPY:   { seed: 148,   vol: 0.005, sector: "Forex",  name: "USD/JPY",     drift: 0.0001 },
  AUDUSD:   { seed: 0.65,  vol: 0.007, sector: "Forex",  name: "AUD/USD",     drift: 0.0 },
  USDCAD:   { seed: 1.36,  vol: 0.005, sector: "Forex",  name: "USD/CAD",     drift: 0.0 },
  USDCHF:   { seed: 0.88,  vol: 0.005, sector: "Forex",  name: "USD/CHF",     drift: -0.0001},
  NZDUSD:   { seed: 0.61,  vol: 0.007, sector: "Forex",  name: "NZD/USD",     drift: 0.0 },
  // Commodities
  XAUUSD:   { seed: 2000,  vol: 0.01,  sector: "Commodity",name:"Gold Spot",  drift: 0.0001 },
  XAGUSD:   { seed: 24,    vol: 0.018, sector: "Commodity",name:"Silver Spot",drift: 0.0001 },
  WTIUSD:   { seed: 78,    vol: 0.025, sector: "Energy", name: "WTI Crude",   drift: 0.0001 },
  BRENTUSD: { seed: 82,    vol: 0.024, sector: "Energy", name: "Brent Crude", drift: 0.0001 },
  NATGASUSD:{ seed: 2.5,   vol: 0.04,  sector: "Energy", name: "Natural Gas", drift: -0.0001},
  COPPER:   { seed: 3.8,   vol: 0.018, sector: "Metal",  name: "Copper",      drift: 0.0001 },
  // International
  DAX:      { seed: 16500, vol: 0.014, sector: "Index",  name: "DAX",         drift: 0.0003 },
  FTSE:     { seed: 7600,  vol: 0.012, sector: "Index",  name: "FTSE 100",    drift: 0.0002 },
  NIKKEI:   { seed: 33000, vol: 0.013, sector: "Index",  name: "Nikkei 225",  drift: 0.0002 },
  HANGSENG: { seed: 17000, vol: 0.016, sector: "Index",  name: "Hang Seng",   drift: 0.0001 },
  ASX200:   { seed: 7500,  vol: 0.012, sector: "Index",  name: "ASX 200",     drift: 0.0002 },
  CAC40:    { seed: 7500,  vol: 0.013, sector: "Index",  name: "CAC 40",      drift: 0.0002 },
};

export const ALL_SYMBOLS = Object.keys(SYMBOL_META);

// ─── Regime Classification ──────────────────────────────────────────────────

export interface RegimePeriod {
  startDate: string;
  endDate: string;
  regime: "bull" | "bear" | "sideways" | "volatile";
  avgReturn: number;
  volatility: number;
  tradeCount: number;
  winRate: number;
  totalPnl: number;
}

export function classifyRegimes(
  bars: Array<{ date: string; close: number }>,
  trades: Array<{ entryDate: string; exitDate: string; pnl: number }>,
  windowDays = 30
): RegimePeriod[] {
  if (bars.length < windowDays * 2) return [];

  const periods: RegimePeriod[] = [];
  let i = windowDays;

  while (i < bars.length) {
    const windowBars = bars.slice(i - windowDays, i);
    const endBar = bars[Math.min(i + windowDays - 1, bars.length - 1)];
    const startDate = windowBars[0].date;
    const endDate = endBar.date;

    const returns: number[] = [];
    for (let j = 1; j < windowBars.length; j++) {
      returns.push((windowBars[j].close - windowBars[j - 1].close) / windowBars[j - 1].close);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, r) => a + (r - avgReturn) ** 2, 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;

    const trendPct = ((windowBars[windowBars.length - 1].close - windowBars[0].close) / windowBars[0].close) * 100;

    let regime: RegimePeriod["regime"];
    if (volatility > 35) regime = "volatile";
    else if (trendPct > 5) regime = "bull";
    else if (trendPct < -5) regime = "bear";
    else regime = "sideways";

    const periodTrades = trades.filter(
      (t) => t.entryDate >= startDate && t.exitDate <= endDate
    );
    const winners = periodTrades.filter((t) => t.pnl > 0);
    const winRate = periodTrades.length > 0 ? (winners.length / periodTrades.length) * 100 : 0;
    const totalPnl = periodTrades.reduce((a, t) => a + t.pnl, 0);

    periods.push({
      startDate,
      endDate,
      regime,
      avgReturn: avgReturn * 252 * 100,
      volatility,
      tradeCount: periodTrades.length,
      winRate,
      totalPnl,
    });

    i += windowDays;
  }

  return periods;
}

// ─── Strategy DNA Fingerprint ────────────────────────────────────────────────

router.get("/superpowers/dna/:backtestId", async (req, res): Promise<void> => {
  const backtestId = parseInt(req.params.backtestId, 10);
  if (isNaN(backtestId)) { res.status(400).json({ error: "Invalid backtestId" }); return; }

  const [bt] = await db.select().from(backtestsTable).where(eq(backtestsTable.id, backtestId));
  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }

  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, bt.strategyId));
  if (!strategy) { res.status(404).json({ error: "Strategy not found" }); return; }

  const totalReturn = Number(bt.totalReturn ?? 0);
  const sharpeRatio = Number(bt.sharpeRatio ?? 0);
  const maxDrawdown = Number(bt.maxDrawdown ?? 0);
  const winRate = Number(bt.winRate ?? 0);
  const profitFactor = Number(bt.profitFactor ?? 0);
  const annualizedReturn = Number(bt.annualizedReturn ?? 0);
  const sortinoRatio = Number(bt.sortinoRatio ?? 0);

  // Compute DNA dimensions (0-100 scale)
  const dna = {
    momentum: Math.min(100, Math.max(0, Math.round(
      (strategy.type === "sma_crossover" || strategy.type === "ema_crossover" || strategy.type === "macd" ? 60 : 20)
      + (totalReturn > 0 ? Math.min(30, totalReturn / 2) : 0)
    ))),
    meanReversion: Math.min(100, Math.max(0, Math.round(
      (strategy.type === "rsi" || strategy.type === "bollinger_bands" ? 65 : 20)
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
      + (strategy.type === "bollinger_bands" ? 15 : strategy.type === "macd" ? 10 : 0)
    ))),
    profitability: Math.min(100, Math.max(0, Math.round(
      50
      + Math.min(30, Math.max(-30, annualizedReturn / 2))
      + (profitFactor > 1 ? Math.min(20, (profitFactor - 1) * 10) : -20)
    ))),
  };

  const overallScore = Math.round(Object.values(dna).reduce((a, b) => a + b, 0) / Object.keys(dna).length);

  const grade =
    overallScore >= 80 ? "S" :
    overallScore >= 65 ? "A" :
    overallScore >= 50 ? "B" :
    overallScore >= 35 ? "C" : "D";

  const archetypes: string[] = [];
  if (dna.momentum > 65) archetypes.push("Trend Follower");
  if (dna.meanReversion > 65) archetypes.push("Mean Reverter");
  if (dna.riskControl > 65) archetypes.push("Risk-Conscious");
  if (dna.consistency > 65) archetypes.push("Consistent");
  if (dna.adaptability > 65) archetypes.push("Adaptive");
  if (dna.profitability > 65) archetypes.push("High-Return");
  if (archetypes.length === 0) archetypes.push("Balanced");

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const dims = Object.entries(dna) as [string, number][];
  for (const [dim, val] of dims) {
    if (val >= 70) strengths.push(dim);
    if (val <= 35) weaknesses.push(dim);
  }

  res.json({
    backtestId,
    strategyName: strategy.name,
    strategyType: strategy.type,
    symbol: bt.symbol,
    dna,
    overallScore,
    grade,
    archetypes,
    strengths,
    weaknesses,
    metrics: { totalReturn, sharpeRatio, maxDrawdown, winRate, profitFactor, annualizedReturn },
  });
});

// ─── Regime Analysis for a backtest ─────────────────────────────────────────

router.get("/superpowers/regime/:backtestId", async (req, res): Promise<void> => {
  const backtestId = parseInt(req.params.backtestId, 10);
  if (isNaN(backtestId)) { res.status(400).json({ error: "Invalid backtestId" }); return; }

  const [bt] = await db.select().from(backtestsTable).where(eq(backtestsTable.id, backtestId));
  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }
  if (bt.status !== "complete") { res.json({ regimes: [] }); return; }

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

  const summary = {
    bull:     regimes.filter((r) => r.regime === "bull"),
    bear:     regimes.filter((r) => r.regime === "bear"),
    sideways: regimes.filter((r) => r.regime === "sideways"),
    volatile: regimes.filter((r) => r.regime === "volatile"),
  };

  const avgByRegime = (list: RegimePeriod[]) =>
    list.length === 0 ? null : {
      count: list.length,
      totalTrades: list.reduce((a, r) => a + r.tradeCount, 0),
      avgWinRate: list.reduce((a, r) => a + r.winRate, 0) / list.length,
      totalPnl: list.reduce((a, r) => a + r.totalPnl, 0),
    };

  res.json({
    regimes,
    summary: {
      bull:     avgByRegime(summary.bull),
      bear:     avgByRegime(summary.bear),
      sideways: avgByRegime(summary.sideways),
      volatile: avgByRegime(summary.volatile),
    },
  });
});

// ─── Cross-Asset Stress Test ─────────────────────────────────────────────────

router.post("/superpowers/stress-test", async (req, res): Promise<void> => {
  const { strategyId, startDate, endDate, initialCapital, symbols } = req.body as {
    strategyId: number;
    startDate: string;
    endDate: string;
    initialCapital: number;
    symbols?: string[];
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
      return {
        symbol,
        name: meta?.name ?? symbol,
        sector: meta?.sector ?? "Unknown",
        totalReturn: result.totalReturn,
        sharpeRatio: result.sharpeRatio,
        maxDrawdown: result.maxDrawdown,
        winRate: result.winRate,
        totalTrades: result.totalTrades,
        profitFactor: result.profitFactor,
        finalCapital: result.finalCapital,
        annualizedReturn: result.annualizedReturn,
      };
    } catch {
      return null;
    }
  }).filter(Boolean);

  const sorted = [...results].sort((a: any, b: any) => b.totalReturn - a.totalReturn);
  const bySector = new Map<string, typeof results>();
  for (const r of results) {
    if (!r) continue;
    const s = (r as any).sector as string;
    if (!bySector.has(s)) bySector.set(s, []);
    bySector.get(s)!.push(r);
  }

  const sectorSummary = Array.from(bySector.entries()).map(([sector, rows]) => {
    const validRows = rows.filter(Boolean) as any[];
    return {
      sector,
      count: validRows.length,
      avgReturn: validRows.reduce((a: number, r: any) => a + r.totalReturn, 0) / validRows.length,
      avgSharpe: validRows.reduce((a: number, r: any) => a + r.sharpeRatio, 0) / validRows.length,
      avgDrawdown: validRows.reduce((a: number, r: any) => a + r.maxDrawdown, 0) / validRows.length,
      best: validRows.sort((a: any, b: any) => b.totalReturn - a.totalReturn)[0]?.symbol ?? "",
    };
  });

  res.json({
    strategyName: strategy.name,
    strategyType: strategy.type,
    startDate,
    endDate,
    initialCapital: cap,
    totalSymbols: results.length,
    results: sorted,
    sectorSummary,
    stats: {
      avgReturn: results.reduce((a: number, r: any) => a + (r?.totalReturn ?? 0), 0) / results.length,
      avgSharpe: results.reduce((a: number, r: any) => a + (r?.sharpeRatio ?? 0), 0) / results.length,
      profitable: results.filter((r: any) => r?.totalReturn > 0).length,
      topSymbol: (sorted[0] as any)?.symbol ?? "",
      worstSymbol: (sorted[sorted.length - 1] as any)?.symbol ?? "",
    },
  });
});

// ─── Live Trades (Divergence Monitor) ───────────────────────────────────────

router.get("/superpowers/live-trades/:backtestId", async (req, res): Promise<void> => {
  const backtestId = parseInt(req.params.backtestId, 10);
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
  if (!backtestId || !tradeDate || !symbol || !side || !entryPrice) {
    res.status(400).json({ error: "backtestId, tradeDate, symbol, side, entryPrice required" });
    return;
  }
  const [row] = await db.insert(liveTradesTable).values({
    backtestId: Number(backtestId),
    tradeDate,
    symbol,
    side,
    entryPrice: String(entryPrice),
    exitPrice: exitPrice != null ? String(exitPrice) : null,
    pnlAmount: pnlAmount != null ? String(pnlAmount) : null,
    note: note ?? null,
  }).returning();
  res.status(201).json({
    ...row,
    entryPrice: Number(row.entryPrice),
    exitPrice: row.exitPrice != null ? Number(row.exitPrice) : null,
    pnlAmount: row.pnlAmount != null ? Number(row.pnlAmount) : null,
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/superpowers/live-trades/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(liveTradesTable).where(eq(liveTradesTable.id, id));
  res.json({ ok: true });
});

export default router;
