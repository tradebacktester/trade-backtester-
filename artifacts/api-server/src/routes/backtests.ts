import { Router, type IRouter } from "express";
import { eq, avg, max, min, count, sum, sql, inArray } from "drizzle-orm";
import { db, backtestsTable, strategiesTable, tradesTable, equityCurveTable } from "@workspace/db";
import {
  CreateBacktestBody,
  ListBacktestsQueryParams,
  GetBacktestParams,
  DeleteBacktestParams,
  GetBacktestTradesParams,
  GetEquityCurveParams,
} from "@workspace/api-zod";
import { runBacktest } from "../lib/backtest-engine";

const router: IRouter = Router();

function formatBacktest(row: typeof backtestsTable.$inferSelect, strategyName?: string | null) {
  return {
    id: row.id,
    strategyId: row.strategyId,
    strategyName: strategyName ?? null,
    symbol: row.symbol,
    startDate: row.startDate,
    endDate: row.endDate,
    initialCapital: Number(row.initialCapital),
    finalCapital: row.finalCapital != null ? Number(row.finalCapital) : null,
    totalReturn: row.totalReturn != null ? Number(row.totalReturn) : null,
    annualizedReturn: row.annualizedReturn != null ? Number(row.annualizedReturn) : null,
    maxDrawdown: row.maxDrawdown != null ? Number(row.maxDrawdown) : null,
    sharpeRatio: row.sharpeRatio != null ? Number(row.sharpeRatio) : null,
    winRate: row.winRate != null ? Number(row.winRate) : null,
    totalTrades: row.totalTrades,
    profitFactor: row.profitFactor != null ? Number(row.profitFactor) : null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/backtests/summary", async (_req, res): Promise<void> => {
  const [summary] = await db
    .select({
      totalBacktests: count(backtestsTable.id),
      avgReturn: avg(backtestsTable.totalReturn),
      bestReturn: max(backtestsTable.totalReturn),
      worstReturn: min(backtestsTable.totalReturn),
      totalTrades: sum(backtestsTable.totalTrades),
    })
    .from(backtestsTable)
    .where(eq(backtestsTable.status, "complete"));

  const [stratCount] = await db
    .select({ totalStrategies: count(strategiesTable.id) })
    .from(strategiesTable);

  // Find top strategy by avg return
  const stratPerf = await db
    .select({
      strategyId: backtestsTable.strategyId,
      avgReturn: avg(backtestsTable.totalReturn),
    })
    .from(backtestsTable)
    .where(eq(backtestsTable.status, "complete"))
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

router.get("/backtests", async (req, res): Promise<void> => {
  const query = ListBacktestsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let rows: typeof backtestsTable.$inferSelect[];
  if (query.data.strategyId != null) {
    rows = await db.select().from(backtestsTable)
      .where(eq(backtestsTable.strategyId, query.data.strategyId))
      .orderBy(sql`${backtestsTable.createdAt} DESC`);
  } else {
    rows = await db.select().from(backtestsTable)
      .orderBy(sql`${backtestsTable.createdAt} DESC`);
  }

  // Fetch strategy names
  const strategyIds = [...new Set(rows.map((r) => r.strategyId))];
  const strategies = strategyIds.length > 0
    ? await db.select().from(strategiesTable).where(inArray(strategiesTable.id, strategyIds))
    : [];
  const stratMap = new Map(strategies.map((s) => [s.id, s.name]));

  res.json(rows.map((r) => formatBacktest(r, stratMap.get(r.strategyId))));
});

router.post("/backtests", async (req, res): Promise<void> => {
  const parsed = CreateBacktestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, parsed.data.strategyId));
  if (!strategy) {
    res.status(400).json({ error: "Strategy not found" });
    return;
  }

  // Insert as running
  const [backtest] = await db.insert(backtestsTable).values({
    strategyId: parsed.data.strategyId,
    symbol: parsed.data.symbol,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    initialCapital: String(parsed.data.initialCapital),
    status: "running",
  }).returning();

  try {
    const result = runBacktest(
      parsed.data.symbol,
      strategy.type,
      strategy.parameters as Record<string, unknown>,
      parsed.data.startDate,
      parsed.data.endDate,
      parsed.data.initialCapital,
    );

    // Insert trades
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

    // Insert equity curve (sample to keep it manageable)
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

    // Update backtest with results
    const [updated] = await db.update(backtestsTable).set({
      status: "complete",
      finalCapital: String(result.finalCapital),
      totalReturn: String(result.totalReturn),
      annualizedReturn: String(result.annualizedReturn),
      maxDrawdown: String(result.maxDrawdown),
      sharpeRatio: String(result.sharpeRatio),
      winRate: String(result.winRate),
      totalTrades: result.totalTrades,
      profitFactor: String(result.profitFactor),
    }).where(eq(backtestsTable.id, backtest.id)).returning();

    res.status(201).json(formatBacktest(updated, strategy.name));
  } catch (err) {
    await db.update(backtestsTable).set({ status: "failed" }).where(eq(backtestsTable.id, backtest.id));
    res.status(500).json({ error: "Backtest execution failed" });
  }
});

router.get("/backtests/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db.select().from(backtestsTable).where(eq(backtestsTable.id, id));
  if (!row) { res.status(404).json({ error: "Backtest not found" }); return; }

  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, row.strategyId));
  const trades = await db.select().from(tradesTable).where(eq(tradesTable.backtestId, id)).orderBy(tradesTable.entryDate);
  const equity = await db.select().from(equityCurveTable).where(eq(equityCurveTable.backtestId, id)).orderBy(equityCurveTable.date);

  res.json({
    ...formatBacktest(row, strategy?.name),
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

router.delete("/backtests/:id", async (req, res): Promise<void> => {
  const params = DeleteBacktestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(backtestsTable).where(eq(backtestsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Backtest not found" }); return; }
  res.sendStatus(204);
});

router.get("/backtests/:id/trades", async (req, res): Promise<void> => {
  const params = GetBacktestTradesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [bt] = await db.select().from(backtestsTable).where(eq(backtestsTable.id, params.data.id));
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

router.get("/backtests/:id/equity", async (req, res): Promise<void> => {
  const params = GetEquityCurveParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [bt] = await db.select().from(backtestsTable).where(eq(backtestsTable.id, params.data.id));
  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }
  const equity = await db.select().from(equityCurveTable).where(eq(equityCurveTable.backtestId, params.data.id)).orderBy(equityCurveTable.date);
  res.json(equity.map((e) => ({
    date: e.date,
    value: Number(e.value),
    drawdown: Number(e.drawdown),
  })));
});

export default router;
