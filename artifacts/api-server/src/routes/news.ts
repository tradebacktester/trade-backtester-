import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/news/calendar", async (req, res): Promise<void> => {
  const week = req.query.week === "next" ? "nextweek" : "thisweek";
  const tz = encodeURIComponent("America/New_York");
  const url = `https://nfs.faireconomy.media/ff_calendar_${week}.json?timezone=${tz}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TradeBacktester/1.0)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Forex Factory responded ${response.status}`);
    }

    const data = await response.json();
    res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    res.json([]);
  }
});

export default router;
