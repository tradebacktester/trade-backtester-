import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db, watchlistItemsTable } from "@workspace/db";
import { verifyJwt } from "../lib/jwt";

const router: IRouter = Router();

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

router.get("/watchlist", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const items = await db
    .select()
    .from(watchlistItemsTable)
    .where(eq(watchlistItemsTable.userId, userId));
  res.json(items.map((item: typeof items[0]) => ({
    id: item.id,
    symbol: item.symbol,
    name: item.name,
    ticker: item.ticker,
    addedAt: item.addedAt.toISOString(),
  })));
});

router.post("/watchlist", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const b = req.body as Record<string, unknown>;
  const symbol = typeof b["symbol"] === "string" && (b["symbol"] as string).length ? (b["symbol"] as string).trim() : null;
  const name   = typeof b["name"]   === "string" ? (b["name"] as string).trim()   : null;
  const ticker = typeof b["ticker"] === "string" ? (b["ticker"] as string).trim() : null;

  if (!symbol) {
    res.status(400).json({ error: "symbol is required" });
    return;
  }

  const existing = await db
    .select()
    .from(watchlistItemsTable)
    .where(and(eq(watchlistItemsTable.userId, userId), eq(watchlistItemsTable.symbol, symbol)));

  if (existing.length > 0) {
    const row = existing[0]!;
    res.json({ id: row.id, symbol: row.symbol, name: row.name, ticker: row.ticker, addedAt: row.addedAt.toISOString() });
    return;
  }

  const [row] = await db
    .insert(watchlistItemsTable)
    .values({ userId, symbol, name: name ?? symbol, ticker: ticker ?? symbol })
    .returning();

  res.json({ id: row!.id, symbol: row!.symbol, name: row!.name, ticker: row!.ticker, addedAt: row!.addedAt.toISOString() });
});

router.delete("/watchlist/:symbol", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals["userId"] as number;
  const sym = decodeURIComponent((req.params["symbol"] as string) ?? "");
  if (!sym) {
    res.status(400).json({ error: "symbol param required" });
    return;
  }
  await db
    .delete(watchlistItemsTable)
    .where(and(eq(watchlistItemsTable.userId, userId), eq(watchlistItemsTable.symbol, sym)));
  res.json({ success: true });
});

export default router;
