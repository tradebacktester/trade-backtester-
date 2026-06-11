import { Router, type IRouter } from "express";
import { fetchYahooQuote, isYahooSupported } from "../lib/yahoo-finance";

const router: IRouter = Router();

const quoteCache = new Map<string, { data: unknown; expiresAt: number }>();
const QUOTE_TTL_MS = 15_000;

router.get("/market/quote", async (req, res): Promise<void> => {
  const { symbol } = req.query as Record<string, string>;

  if (!symbol) {
    res.status(400).json({ error: "symbol is required" });
    return;
  }

  const upper = symbol.toUpperCase();

  if (!isYahooSupported(upper)) {
    res.status(404).json({ error: `No real-time quote available for ${symbol}` });
    return;
  }

  const cached = quoteCache.get(upper);
  if (cached && Date.now() < cached.expiresAt) {
    res.json(cached.data);
    return;
  }

  try {
    const quote = await fetchYahooQuote(upper);
    quoteCache.set(upper, { data: quote, expiresAt: Date.now() + QUOTE_TTL_MS });
    res.json(quote);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(503).json({ error: `Failed to fetch quote for ${symbol}: ${msg}` });
  }
});

export default router;
