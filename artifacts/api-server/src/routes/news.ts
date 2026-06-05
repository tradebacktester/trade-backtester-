import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface CacheEntry {
  data: unknown[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Alternative URLs to try in order
function getCalendarUrls(week: string): string[] {
  const tz = encodeURIComponent("America/New_York");
  return [
    `https://nfs.faireconomy.media/ff_calendar_${week}.json?timezone=${tz}`,
    `https://nfs.faireconomy.media/ff_calendar_${week}.json`,
  ];
}

async function fetchCalendarData(week: string): Promise<unknown[] | null> {
  const urls = getCalendarUrls(week);
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.forexfactory.com/",
          "Origin": "https://www.forexfactory.com",
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(12000),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && (contentType.includes("json") || contentType.includes("text"))) {
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data) && data.length > 0) return data;
        } catch {
          // try next URL
        }
      }
    } catch {
      // try next URL
    }
  }
  return null;
}

router.get("/news/calendar", async (req, res): Promise<void> => {
  const week = req.query.week === "next" ? "nextweek" : "thisweek";
  const cacheKey = week;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    res.json(cached.data);
    return;
  }

  const data = await fetchCalendarData(week);

  if (data !== null) {
    cache.set(cacheKey, { data, fetchedAt: Date.now() });
    res.json(data);
    return;
  }

  // Return stale cache if we have it, otherwise 503
  if (cached) {
    res.json(cached.data);
    return;
  }

  res.status(503).json({ error: "Calendar data temporarily unavailable. The Forex Factory API may be blocking automated access. Please try again later." });
});

export default router;
