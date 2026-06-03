import type { Request, Response, NextFunction } from "express";

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
