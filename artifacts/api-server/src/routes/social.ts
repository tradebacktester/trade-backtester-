import { Router, type IRouter } from "express";
import { eq, desc, and, avg, count, sql, ne } from "drizzle-orm";
import {
  db, backtestsTable, strategiesTable,
  marketplaceListingsTable, marketplaceVotesTable,
} from "@workspace/db";
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
  res.locals["userEmail"] = payload.email;
  next();
}

const router: IRouter = Router();

// ── Profanity filter ─────────────────────────────────────────────────────────
const BANNED_WORDS = [
  "fuck", "shit", "bitch", "bastard", "cunt", "dick", "pussy",
  "cock", "whore", "slut", "nigger", "faggot", "retard",
];
function containsBannedWords(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some(w => lower.includes(w));
}

function serializeListing(l: typeof marketplaceListingsTable.$inferSelect, voted = false) {
  return {
    id: l.id,
    userId: l.userId,
    authorName: l.authorName,
    title: l.title,
    description: l.description,
    strategyType: l.strategyType,
    symbol: l.symbol,
    timeframe: l.timeframe,
    parameters: l.parameters,
    avgSharpe: l.avgSharpe !== null ? Number(l.avgSharpe) : null,
    avgReturn: l.avgReturn !== null ? Number(l.avgReturn) : null,
    avgWinRate: l.avgWinRate !== null ? Number(l.avgWinRate) : null,
    avgMaxDrawdown: l.avgMaxDrawdown !== null ? Number(l.avgMaxDrawdown) : null,
    totalBacktests: l.totalBacktests,
    votes: l.votes,
    voted,
    createdAt: l.createdAt.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PEER PERCENTILE RANKING
// GET /backtests/:id/percentile
// Returns where this backtest's Sharpe, drawdown, and win rate sit relative
// to all completed backtests on the same symbol + strategy type.
// ─────────────────────────────────────────────────────────────────────────────

router.get("/backtests/:id/percentile", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [bt] = await db
    .select({
      id: backtestsTable.id,
      strategyId: backtestsTable.strategyId,
      symbol: backtestsTable.symbol,
      sharpeRatio: backtestsTable.sharpeRatio,
      maxDrawdown: backtestsTable.maxDrawdown,
      winRate: backtestsTable.winRate,
      totalReturn: backtestsTable.totalReturn,
    })
    .from(backtestsTable)
    .where(and(eq(backtestsTable.id, id), eq(backtestsTable.status, "complete")));

  if (!bt) { res.status(404).json({ error: "Backtest not found" }); return; }

  const [strategy] = await db
    .select({ type: strategiesTable.type })
    .from(strategiesTable)
    .where(eq(strategiesTable.id, bt.strategyId));

  if (!strategy) { res.status(404).json({ error: "Strategy not found" }); return; }

  const peers = await db
    .select({
      sharpeRatio: backtestsTable.sharpeRatio,
      maxDrawdown: backtestsTable.maxDrawdown,
      winRate: backtestsTable.winRate,
      totalReturn: backtestsTable.totalReturn,
    })
    .from(backtestsTable)
    .innerJoin(strategiesTable, eq(backtestsTable.strategyId, strategiesTable.id))
    .where(
      and(
        eq(backtestsTable.status, "complete"),
        eq(backtestsTable.symbol, bt.symbol),
        eq(strategiesTable.type, strategy.type),
        ne(backtestsTable.id, id),
      )
    )
    .limit(2000);

  const peerCount = peers.length;

  function percentileRank(myValue: number | null | string, values: (number | null | string)[], higherIsBetter: boolean): number | null {
    if (myValue === null || myValue === undefined) return null;
    const myNum = Number(myValue);
    if (isNaN(myNum)) return null;
    const nums = values.map(v => Number(v)).filter(v => !isNaN(v));
    if (nums.length === 0) return null;
    const below = nums.filter(v => higherIsBetter ? v < myNum : v > myNum).length;
    return Math.round((below / nums.length) * 100);
  }

  const sharpeValues = peers.map(p => p.sharpeRatio);
  const drawdownValues = peers.map(p => p.maxDrawdown);
  const winRateValues = peers.map(p => p.winRate);
  const returnValues = peers.map(p => p.totalReturn);

  const sharpePercentile = percentileRank(bt.sharpeRatio, sharpeValues, true);
  const drawdownPercentile = percentileRank(bt.maxDrawdown, drawdownValues, false);
  const winRatePercentile = percentileRank(bt.winRate, winRateValues, true);
  const returnPercentile = percentileRank(bt.totalReturn, returnValues, true);

  const validPercentiles = [sharpePercentile, drawdownPercentile, winRatePercentile, returnPercentile].filter(p => p !== null) as number[];
  const overallPercentile = validPercentiles.length > 0
    ? Math.round(validPercentiles.reduce((a, b) => a + b, 0) / validPercentiles.length)
    : null;

  const [peerAgg] = await db
    .select({
      avgSharpe: avg(backtestsTable.sharpeRatio),
      avgDrawdown: avg(backtestsTable.maxDrawdown),
      avgWinRate: avg(backtestsTable.winRate),
      avgReturn: avg(backtestsTable.totalReturn),
      total: count(backtestsTable.id),
    })
    .from(backtestsTable)
    .innerJoin(strategiesTable, eq(backtestsTable.strategyId, strategiesTable.id))
    .where(
      and(
        eq(backtestsTable.status, "complete"),
        eq(backtestsTable.symbol, bt.symbol),
        eq(strategiesTable.type, strategy.type),
      )
    );

  res.json({
    backtestId: id,
    symbol: bt.symbol,
    strategyType: strategy.type,
    peerCount: peerCount + 1,
    metrics: {
      sharpe:   { yours: bt.sharpeRatio !== null ? Number(bt.sharpeRatio) : null,   peerAvg: Number(peerAgg?.avgSharpe ?? 0),    percentile: sharpePercentile },
      drawdown: { yours: bt.maxDrawdown !== null ? Number(bt.maxDrawdown) : null,    peerAvg: Number(peerAgg?.avgDrawdown ?? 0),  percentile: drawdownPercentile },
      winRate:  { yours: bt.winRate !== null ? Number(bt.winRate) : null,            peerAvg: Number(peerAgg?.avgWinRate ?? 0),   percentile: winRatePercentile },
      return:   { yours: bt.totalReturn !== null ? Number(bt.totalReturn) : null,    peerAvg: Number(peerAgg?.avgReturn ?? 0),    percentile: returnPercentile },
    },
    overallPercentile,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MARKETPLACE
// ─────────────────────────────────────────────────────────────────────────────

// GET /marketplace — list all active listings (newest first)
router.get("/marketplace", async (req, res): Promise<void> => {
  const { type, symbol } = req.query as { type?: string; symbol?: string };

  let query = db
    .select()
    .from(marketplaceListingsTable)
    .where(eq(marketplaceListingsTable.isActive, true))
    .$dynamic();

  const conditions = [eq(marketplaceListingsTable.isActive, true)];
  if (type) conditions.push(eq(marketplaceListingsTable.strategyType, type));
  if (symbol) conditions.push(eq(marketplaceListingsTable.symbol, symbol));

  const listings = await db
    .select()
    .from(marketplaceListingsTable)
    .where(and(...conditions))
    .orderBy(desc(marketplaceListingsTable.votes), desc(marketplaceListingsTable.createdAt))
    .limit(100);

  res.json(listings.map(l => serializeListing(l, false)));
});

// GET /marketplace/:id — single listing
router.get("/marketplace/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [listing] = await db
    .select()
    .from(marketplaceListingsTable)
    .where(and(eq(marketplaceListingsTable.id, id), eq(marketplaceListingsTable.isActive, true)));

  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }

  res.json(serializeListing(listing, false));
});

// POST /marketplace — publish a strategy listing (auth required)
router.post("/marketplace", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const { title, description, strategyId, authorName } = req.body as {
    title?: string;
    description?: string;
    strategyId?: number;
    authorName?: string;
  };

  if (!title || title.trim().length < 5) {
    res.status(400).json({ error: "Title must be at least 5 characters." }); return;
  }
  if (!description || description.trim().length < 20) {
    res.status(400).json({ error: "Description must be at least 20 characters." }); return;
  }
  if (!authorName || authorName.trim().length < 2) {
    res.status(400).json({ error: "Author name must be at least 2 characters." }); return;
  }
  if (containsBannedWords(title) || containsBannedWords(description)) {
    res.status(400).json({ error: "Your submission contains disallowed language." }); return;
  }

  if (!strategyId) {
    res.status(400).json({ error: "strategyId is required." }); return;
  }

  const [strategy] = await db
    .select()
    .from(strategiesTable)
    .where(eq(strategiesTable.id, strategyId));

  if (!strategy) {
    res.status(404).json({ error: "Strategy not found." }); return;
  }

  const existing = await db
    .select({ id: marketplaceListingsTable.id })
    .from(marketplaceListingsTable)
    .where(and(
      eq(marketplaceListingsTable.userId, userId),
      eq(marketplaceListingsTable.isActive, true),
    ));

  if (existing.length >= 10) {
    res.status(400).json({ error: "You can have at most 10 active listings." }); return;
  }

  const [perf] = await db
    .select({
      avgSharpe: avg(backtestsTable.sharpeRatio),
      avgReturn: avg(backtestsTable.totalReturn),
      avgWinRate: avg(backtestsTable.winRate),
      avgMaxDrawdown: avg(backtestsTable.maxDrawdown),
      total: count(backtestsTable.id),
    })
    .from(backtestsTable)
    .where(and(
      eq(backtestsTable.strategyId, strategyId),
      eq(backtestsTable.status, "complete"),
    ));

  const [listing] = await db
    .insert(marketplaceListingsTable)
    .values({
      userId,
      authorName: authorName.trim(),
      title: title.trim(),
      description: description.trim(),
      strategyType: strategy.type,
      symbol: strategy.symbol,
      timeframe: strategy.timeframe,
      parameters: strategy.parameters,
      avgSharpe: perf?.avgSharpe ?? null,
      avgReturn: perf?.avgReturn ?? null,
      avgWinRate: perf?.avgWinRate ?? null,
      avgMaxDrawdown: perf?.avgMaxDrawdown ?? null,
      totalBacktests: perf?.total ?? 0,
    })
    .returning();

  res.status(201).json(serializeListing(listing!));
});

// DELETE /marketplace/:id — remove own listing (auth required)
router.delete("/marketplace/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [listing] = await db
    .select()
    .from(marketplaceListingsTable)
    .where(and(eq(marketplaceListingsTable.id, id), eq(marketplaceListingsTable.userId, userId)));

  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }

  await db
    .update(marketplaceListingsTable)
    .set({ isActive: false })
    .where(eq(marketplaceListingsTable.id, id));

  res.json({ success: true });
});

// POST /marketplace/:id/vote — upvote a listing (auth required, one vote per user)
router.post("/marketplace/:id/vote", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [listing] = await db
    .select()
    .from(marketplaceListingsTable)
    .where(and(eq(marketplaceListingsTable.id, id), eq(marketplaceListingsTable.isActive, true)));

  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }

  if (listing.userId === userId) {
    res.status(400).json({ error: "You cannot vote on your own listing." }); return;
  }

  const existingVote = await db
    .select()
    .from(marketplaceVotesTable)
    .where(and(
      eq(marketplaceVotesTable.listingId, id),
      eq(marketplaceVotesTable.userId, userId),
    ));

  if (existingVote.length > 0) {
    await db
      .delete(marketplaceVotesTable)
      .where(and(
        eq(marketplaceVotesTable.listingId, id),
        eq(marketplaceVotesTable.userId, userId),
      ));

    const [updated] = await db
      .update(marketplaceListingsTable)
      .set({ votes: Math.max(0, listing.votes - 1) })
      .where(eq(marketplaceListingsTable.id, id))
      .returning();

    res.json({ voted: false, votes: updated!.votes });
    return;
  }

  await db.insert(marketplaceVotesTable).values({ listingId: id, userId });

  const [updated] = await db
    .update(marketplaceListingsTable)
    .set({ votes: listing.votes + 1 })
    .where(eq(marketplaceListingsTable.id, id))
    .returning();

  res.json({ voted: true, votes: updated!.votes });
});

// POST /marketplace/:id/backtest-stats — refresh real backtest stats on a listing (auth: listing owner)
router.post("/marketplace/:id/refresh-stats", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [listing] = await db
    .select()
    .from(marketplaceListingsTable)
    .where(and(eq(marketplaceListingsTable.id, id), eq(marketplaceListingsTable.userId, userId)));

  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }

  const [perf] = await db
    .select({
      avgSharpe: avg(backtestsTable.sharpeRatio),
      avgReturn: avg(backtestsTable.totalReturn),
      avgWinRate: avg(backtestsTable.winRate),
      avgMaxDrawdown: avg(backtestsTable.maxDrawdown),
      total: count(backtestsTable.id),
    })
    .from(backtestsTable)
    .innerJoin(strategiesTable, eq(backtestsTable.strategyId, strategiesTable.id))
    .where(and(
      eq(strategiesTable.type, listing.strategyType),
      eq(backtestsTable.symbol, listing.symbol),
      eq(backtestsTable.status, "complete"),
    ));

  const [updated] = await db
    .update(marketplaceListingsTable)
    .set({
      avgSharpe: perf?.avgSharpe ?? null,
      avgReturn: perf?.avgReturn ?? null,
      avgWinRate: perf?.avgWinRate ?? null,
      avgMaxDrawdown: perf?.avgMaxDrawdown ?? null,
      totalBacktests: perf?.total ?? 0,
    })
    .where(eq(marketplaceListingsTable.id, id))
    .returning();

  res.json(serializeListing(updated!));
});

export default router;
