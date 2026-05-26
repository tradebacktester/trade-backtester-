import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface CacheEntry {
  data: unknown[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

router.get("/news/calendar", async (req, res): Promise<void> => {
  const week = req.query.week === "next" ? "nextweek" : "thisweek";
  const cacheKey = week;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    res.json(cached.data);
    return;
  }

  const tz = encodeURIComponent("America/New_York");
  const url = `https://nfs.faireconomy.media/ff_calendar_${week}.json?timezone=${tz}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.forexfactory.com/",
        "Origin": "https://www.forexfactory.com",
      },
      signal: AbortSignal.timeout(10000),
    });

    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok || !contentType.includes("json")) {
      if (cached) {
        res.json(cached.data);
        return;
      }
      res.status(503).json({ error: "Calendar data temporarily unavailable. Please try again later." });
      return;
    }

    const data = await response.json();
    const result = Array.isArray(data) ? data : [];
    cache.set(cacheKey, { data: result, fetchedAt: Date.now() });
    res.json(result);
  } catch {
    if (cached) {
      res.json(cached.data);
      return;
    }
    res.status(503).json({ error: "Calendar data temporarily unavailable. Please try again later." });
  }
});

export default router;
