import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, asc } from "drizzle-orm";
import { db, paperTradesTable } from "@workspace/db";
import { verifyJwt } from "../lib/jwt";

const router: IRouter = Router();

// ── Auth helpers (inline pattern matching other routes) ──────────────────────
function extractUserId(req: Request): number | null {
  try {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return null;
    const payload = verifyJwt(token, process.env.JWT_SECRET!);
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

// ── GET /api/paper/trades — list all closed paper trades for this user ────────
router.get("/paper/trades", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const rows = await db
    .select()
    .from(paperTradesTable)
    .where(eq(paperTradesTable.userId, userId))
    .orderBy(asc(paperTradesTable.createdAt))
    .limit(500);

  res.json(rows.map(r => ({
    id: r.id,
    symbol: r.symbol,
    side: r.side,
    entryPrice: Number(r.entryPrice),
    exitPrice: Number(r.exitPrice),
    units: Number(r.units),
    pnl: Number(r.pnl),
    pnlPct: Number(r.pnlPct),
    entryTime: r.entryTime,
    exitTime: r.exitTime,
    status: "closed",
    openedAt: new Date(r.entryTime).toISOString(),
    closedAt: new Date(r.exitTime).toISOString(),
    createdAt: r.createdAt,
  })));
});

// ── POST /api/paper/trades — persist a closed paper trade ────────────────────
router.post("/paper/trades", requireAuth, async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  const symbol   = typeof b.symbol   === "string" && b.symbol.length   ? b.symbol   : null;
  const side     = typeof b.side     === "string" && b.side.length     ? b.side     : null;
  const entryPrice = typeof b.entryPrice === "number" ? b.entryPrice : null;
  const exitPrice  = typeof b.exitPrice  === "number" ? b.exitPrice  : null;
  const units      = typeof b.units      === "number" && b.units > 0  ? b.units     : null;
  const pnl        = typeof b.pnl        === "number" ? b.pnl        : null;
  const pnlPct     = typeof b.pnlPct     === "number" ? b.pnlPct     : null;
  const entryTime  = typeof b.entryTime  === "number" ? Math.floor(b.entryTime) : null;
  const exitTime   = typeof b.exitTime   === "number" ? Math.floor(b.exitTime)  : null;

  if (!symbol || !side || entryPrice === null || exitPrice === null ||
      units === null || pnl === null || pnlPct === null ||
      entryTime === null || exitTime === null) {
    res.status(400).json({ error: "Missing or invalid trade fields" });
    return;
  }

  const userId = res.locals["userId"] as number;
  const [row] = await db.insert(paperTradesTable).values({
    userId,
    symbol,
    side,
    entryPrice: String(entryPrice),
    exitPrice:  String(exitPrice),
    units:      String(units),
    pnl:        String(pnl),
    pnlPct:     String(pnlPct),
    entryTime,
    exitTime,
  }).returning();

  res.status(201).json({ id: row.id });
});

// ── DELETE /api/paper/trades — reset all paper trades for this user ───────────
router.delete("/paper/trades", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  await db.delete(paperTradesTable).where(eq(paperTradesTable.userId, userId));
  res.json({ ok: true });
});

export default router;
