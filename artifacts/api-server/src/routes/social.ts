import { Router, type IRouter } from "express";
import { eq, desc, and, avg, count, sql } from "drizzle-orm";
import {
  db, backtestsTable, strategiesTable,
  marketplaceListingsTable, marketplaceVotesTable,
} from "@workspace/db";
import { verifyJwt } from "../lib/jwt";
import { checkDbRateLimit } from "../lib/rate-limit";
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

router.get("/backtests/:id/percentile", requireAuth, async (req, res): Promise<void> => {
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

  // Use SQL window functions to compute percentile ranks in a single database pass —
  // replaces loading up to 2,000 rows into Node.js memory and sorting in-process.
  const result = await db.execute(sql`
    SELECT
      b.id,
      ROUND(PERCENT_RANK() OVER (ORDER BY b.sharpe_ratio  NULLS FIRST)    * 100)::int AS sharpe_pct,
      ROUND(PERCENT_RANK() OVER (ORDER BY b.max_drawdown  DESC NULLS LAST) * 100)::int AS drawdown_pct,
      ROUND(PERCENT_RANK() OVER (ORDER BY b.win_rate      NULLS FIRST)    * 100)::int AS win_rate_pct,
      ROUND(PERCENT_RANK() OVER (ORDER BY b.total_return  NULLS FIRST)    * 100)::int AS return_pct,
      COUNT(*)                      OVER ()        AS peer_count,
      AVG(b.sharpe_ratio::float)    OVER ()        AS avg_sharpe,
      AVG(b.max_drawdown::float)    OVER ()        AS avg_drawdown,
      AVG(b.win_rate::float)        OVER ()        AS avg_win_rate,
      AVG(b.total_return::float)    OVER ()        AS avg_return
    FROM backtests b
    INNER JOIN strategies s ON s.id = b.strategy_id
    WHERE b.status  = 'complete'
      AND b.symbol  = ${bt.symbol}
      AND s.type    = ${strategy.type}
  `);

  type PeerRow = {
    id: unknown; sharpe_pct: unknown; drawdown_pct: unknown;
    win_rate_pct: unknown; return_pct: unknown; peer_count: unknown;
    avg_sharpe: unknown; avg_drawdown: unknown; avg_win_rate: unknown; avg_return: unknown;
  };
  const rows = result.rows as PeerRow[];
  const mine = rows.find(r => Number(r.id) === id);
  const any = rows[0];

  const sharpePercentile  = mine ? Number(mine.sharpe_pct)   : null;
  const drawdownPercentile = mine ? Number(mine.drawdown_pct) : null;
  const winRatePercentile = mine ? Number(mine.win_rate_pct)  : null;
  const returnPercentile  = mine ? Number(mine.return_pct)    : null;
  const peerCount = any ? Number(any.peer_count) : 0;

  const validPercentiles = [sharpePercentile, drawdownPercentile, winRatePercentile, returnPercentile].filter(p => p !== null) as number[];
  const overallPercentile = validPercentiles.length > 0
    ? Math.round(validPercentiles.reduce((a, b) => a + b, 0) / validPercentiles.length)
    : null;

  res.json({
    backtestId: id,
    symbol: bt.symbol,
    strategyType: strategy.type,
    peerCount,
    metrics: {
      sharpe:   { yours: bt.sharpeRatio !== null ? Number(bt.sharpeRatio) : null,  peerAvg: any ? Number(any.avg_sharpe ?? 0) : 0,    percentile: sharpePercentile },
      drawdown: { yours: bt.maxDrawdown !== null ? Number(bt.maxDrawdown) : null,   peerAvg: any ? Number(any.avg_drawdown ?? 0) : 0,  percentile: drawdownPercentile },
      winRate:  { yours: bt.winRate !== null ? Number(bt.winRate) : null,           peerAvg: any ? Number(any.avg_win_rate ?? 0) : 0,  percentile: winRatePercentile },
      return:   { yours: bt.totalReturn !== null ? Number(bt.totalReturn) : null,   peerAvg: any ? Number(any.avg_return ?? 0) : 0,    percentile: returnPercentile },
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

// POST /marketplace/:id/vote — upvote a listing (auth required, one vote per user, idempotent)
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

  // S-20: DB-based rate limit — max 10 votes per user per minute (survives restarts)
  const allowed = await checkDbRateLimit(`vote:${userId}`, 10, 60_000);
  if (!allowed) {
    res.status(429).json({ error: "You are voting too quickly. Please wait a moment." }); return;
  }

  // Attempt insert; the unique index on (userId, listingId) silently ignores duplicates.
  const inserted = await db
    .insert(marketplaceVotesTable)
    .values({ listingId: id, userId })
    .onConflictDoNothing()
    .returning({ id: marketplaceVotesTable.id });

  // Only increment the counter when a new vote row was actually created.
  const alreadyVoted = inserted.length === 0;
  let updatedListing = listing;
  if (!alreadyVoted) {
    const [updated] = await db
      .update(marketplaceListingsTable)
      .set({ votes: sql`${marketplaceListingsTable.votes} + 1` })
      .where(eq(marketplaceListingsTable.id, id))
      .returning();
    updatedListing = updated!;
  }

  res.json({ voted: true, votes: updatedListing.votes, alreadyVoted });
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
