import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, avg, max, min, count, sql } from "drizzle-orm";
import { db, strategiesTable, backtestsTable } from "@workspace/db";
import { verifyJwt } from "../lib/jwt";
import {
  ListStrategiesResponseItem,
  CreateStrategyBody,
  GetStrategyParams,
  UpdateStrategyParams,
  UpdateStrategyBody,
  DeleteStrategyParams,
  GetStrategyPerformanceParams,
} from "@workspace/api-zod";

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
  if (!extractUserId(req)) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

router.get("/strategies", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(strategiesTable).orderBy(strategiesTable.createdAt);
  res.json(rows.map((r) => ListStrategiesResponseItem.parse({
    ...r,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/strategies", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateStrategyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(strategiesTable).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    type: parsed.data.type,
    symbol: parsed.data.symbol,
    timeframe: parsed.data.timeframe,
    parameters: parsed.data.parameters as Record<string, unknown>,
  }).returning();
  res.status(201).json(ListStrategiesResponseItem.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
});

router.get("/strategies/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetStrategyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  res.json(ListStrategiesResponseItem.parse({ ...row, createdAt: row.createdAt.toISOString() }));
});

router.patch("/strategies/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateStrategyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateStrategyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Partial<typeof strategiesTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
  if (parsed.data.symbol !== undefined) updateData.symbol = parsed.data.symbol;
  if (parsed.data.timeframe !== undefined) updateData.timeframe = parsed.data.timeframe;
  if (parsed.data.parameters !== undefined) updateData.parameters = parsed.data.parameters as Record<string, unknown>;

  const [row] = await db.update(strategiesTable).set(updateData).where(eq(strategiesTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  res.json(ListStrategiesResponseItem.parse({ ...row, createdAt: row.createdAt.toISOString() }));
});

router.delete("/strategies/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteStrategyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(strategiesTable).where(eq(strategiesTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/strategies/:id/performance", requireAuth, async (req, res): Promise<void> => {
  const params = GetStrategyPerformanceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [strategy] = await db.select().from(strategiesTable).where(eq(strategiesTable.id, params.data.id));
  if (!strategy) {
    res.status(404).json({ error: "Strategy not found" });
    return;
  }
  const [perf] = await db
    .select({
      totalBacktests: count(backtestsTable.id),
      avgReturn: avg(backtestsTable.totalReturn),
      bestReturn: max(backtestsTable.totalReturn),
      worstReturn: min(backtestsTable.totalReturn),
      avgSharpe: avg(backtestsTable.sharpeRatio),
      avgWinRate: avg(backtestsTable.winRate),
      avgMaxDrawdown: avg(backtestsTable.maxDrawdown),
    })
    .from(backtestsTable)
    .where(sql`${backtestsTable.strategyId} = ${params.data.id} AND ${backtestsTable.status} = 'complete'`);

  res.json({
    strategyId: params.data.id,
    totalBacktests: perf?.totalBacktests ?? 0,
    avgReturn: Number(perf?.avgReturn ?? 0),
    bestReturn: Number(perf?.bestReturn ?? 0),
    worstReturn: Number(perf?.worstReturn ?? 0),
    avgSharpe: Number(perf?.avgSharpe ?? 0),
    avgWinRate: Number(perf?.avgWinRate ?? 0),
    avgMaxDrawdown: Number(perf?.avgMaxDrawdown ?? 0),
  });
});

export default router;
