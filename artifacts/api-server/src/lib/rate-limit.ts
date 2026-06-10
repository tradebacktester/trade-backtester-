import type { Request, Response, NextFunction } from "express";
import { db, rateLimitLogTable } from "@workspace/db";
import { eq, gt, lt, count as drizzleCount, and } from "drizzle-orm";

// ── In-memory global rate limiter ────────────────────────────────────────────
// Used for broad DoS protection at 200 req/min per IP.
// In-memory is intentional here: this fires on every request so DB overhead
// would be unacceptable. Auth and vote endpoints use the DB-based helper below.
const counts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;

export function createRateLimit(maxPerMin: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)
        ?.split(",")[0]
        ?.trim() ??
      req.socket.remoteAddress ??
      "unknown";
    const key = `${maxPerMin}:${ip}`;
    const now = Date.now();
    const rec = counts.get(key);
    if (!rec || now >= rec.resetAt) {
      counts.set(key, { count: 1, resetAt: now + WINDOW_MS });
      next();
      return;
    }
    if (rec.count >= maxPerMin) {
      res.status(429).json({ error: "Too many requests. Please slow down." });
      return;
    }
    rec.count++;
    next();
  };
}

// ── DB-based rate limiter ────────────────────────────────────────────────────
// Survives server restarts. Use for high-value write endpoints (votes, etc.).
// key format: "<action>:<userId|ip>"
export async function checkDbRateLimit(
  key: string,
  maxCount: number,
  windowMs: number,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs);
  const [{ cnt }] = await db
    .select({ cnt: drizzleCount(rateLimitLogTable.id) })
    .from(rateLimitLogTable)
    .where(and(eq(rateLimitLogTable.key, key), gt(rateLimitLogTable.createdAt, windowStart)));
  if (cnt >= maxCount) return false;
  await db.insert(rateLimitLogTable).values({ key });
  // Prune old records to prevent unbounded growth
  const pruneOlderThan = new Date(Date.now() - windowMs * 2);
  await db.delete(rateLimitLogTable).where(lt(rateLimitLogTable.createdAt, pruneOlderThan));
  return true;
}
