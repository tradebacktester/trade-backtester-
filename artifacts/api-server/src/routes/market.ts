import { Router, type IRouter } from "express";
import { fetchYahooQuote, isYahooSupported } from "../lib/yahoo-finance";

const router: IRouter = Router();

const quoteCache = new Map<string, { data: unknown; expiresAt: number; fetchedAt: number }>();
const QUOTE_TTL_MS = 15_000;

// ── Symbol search registry ────────────────────────────────────────────────────

const SYMBOL_REGISTRY = [
  // Crypto
  { value: "BTCUSDT",   label: "BTC/USDT",      category: "Crypto",          name: "Bitcoin" },
  { value: "ETHUSDT",   label: "ETH/USDT",      category: "Crypto",          name: "Ethereum" },
  { value: "SOLUSDT",   label: "SOL/USDT",      category: "Crypto",          name: "Solana" },
  { value: "BNBUSDT",   label: "BNB/USDT",      category: "Crypto",          name: "BNB" },
  { value: "XRPUSDT",   label: "XRP/USDT",      category: "Crypto",          name: "Ripple" },
  { value: "ADAUSDT",   label: "ADA/USDT",      category: "Crypto",          name: "Cardano" },
  { value: "DOGEUSDT",  label: "DOGE/USDT",     category: "Crypto",          name: "Dogecoin" },
  { value: "AVAXUSDT",  label: "AVAX/USDT",     category: "Crypto",          name: "Avalanche" },
  { value: "LINKUSDT",  label: "LINK/USDT",     category: "Crypto",          name: "Chainlink" },
  { value: "LTCUSDT",   label: "LTC/USDT",      category: "Crypto",          name: "Litecoin" },
  { value: "DOTUSDT",   label: "DOT/USDT",      category: "Crypto",          name: "Polkadot" },
  { value: "NEARUSDT",  label: "NEAR/USDT",     category: "Crypto",          name: "NEAR Protocol" },
  { value: "OPUSDT",    label: "OP/USDT",       category: "Crypto",          name: "Optimism" },
  { value: "ARBUSDT",   label: "ARB/USDT",      category: "Crypto",          name: "Arbitrum" },
  { value: "INJUSDT",   label: "INJ/USDT",      category: "Crypto",          name: "Injective" },
  { value: "AAVEUSDT",  label: "AAVE/USDT",     category: "Crypto",          name: "Aave" },
  // Forex
  { value: "EURUSD",    label: "EUR/USD",       category: "Forex",           name: "Euro / US Dollar" },
  { value: "GBPUSD",    label: "GBP/USD",       category: "Forex",           name: "British Pound / US Dollar" },
  { value: "USDJPY",    label: "USD/JPY",       category: "Forex",           name: "US Dollar / Japanese Yen" },
  { value: "AUDUSD",    label: "AUD/USD",       category: "Forex",           name: "Australian Dollar / US Dollar" },
  { value: "USDCAD",    label: "USD/CAD",       category: "Forex",           name: "US Dollar / Canadian Dollar" },
  { value: "USDCHF",    label: "USD/CHF",       category: "Forex",           name: "US Dollar / Swiss Franc" },
  { value: "NZDUSD",    label: "NZD/USD",       category: "Forex",           name: "New Zealand Dollar / US Dollar" },
  { value: "EURGBP",    label: "EUR/GBP",       category: "Forex",           name: "Euro / British Pound" },
  // Indices
  { value: "SPX500",    label: "S&P 500",       category: "Indices",         name: "S&P 500" },
  { value: "NAS100",    label: "Nasdaq 100",    category: "Indices",         name: "Nasdaq 100" },
  { value: "DOW30",     label: "Dow Jones",     category: "Indices",         name: "Dow Jones Industrial Average" },
  { value: "UK100",     label: "FTSE 100",      category: "Indices",         name: "FTSE 100" },
  { value: "GER40",     label: "DAX 40",        category: "Indices",         name: "DAX 40" },
  { value: "JPN225",    label: "Nikkei 225",    category: "Indices",         name: "Nikkei 225" },
  // Commodities
  { value: "XAUUSD",    label: "Gold",          category: "Commodities",     name: "Gold" },
  { value: "XAGUSD",    label: "Silver",        category: "Commodities",     name: "Silver" },
  { value: "WTIUSD",    label: "WTI Oil",       category: "Commodities",     name: "West Texas Intermediate Oil" },
  { value: "NATGAS",    label: "Nat. Gas",      category: "Commodities",     name: "Natural Gas" },
  // Stocks
  { value: "AAPL",      label: "Apple",         category: "Stocks",          name: "Apple Inc." },
  { value: "TSLA",      label: "Tesla",         category: "Stocks",          name: "Tesla Inc." },
  { value: "NVDA",      label: "Nvidia",        category: "Stocks",          name: "NVIDIA Corporation" },
  { value: "MSFT",      label: "Microsoft",     category: "Stocks",          name: "Microsoft Corporation" },
  { value: "AMZN",      label: "Amazon",        category: "Stocks",          name: "Amazon.com Inc." },
  { value: "GOOGL",     label: "Alphabet",      category: "Stocks",          name: "Alphabet Inc." },
  { value: "META",      label: "Meta",          category: "Stocks",          name: "Meta Platforms Inc." },
  { value: "NFLX",      label: "Netflix",       category: "Stocks",          name: "Netflix Inc." },
  { value: "AMD",       label: "AMD",           category: "Stocks",          name: "Advanced Micro Devices" },
  { value: "INTC",      label: "Intel",         category: "Stocks",          name: "Intel Corporation" },
  // Indian Indices
  { value: "NIFTY50",   label: "Nifty 50",      category: "Indian Indices",  name: "Nifty 50" },
  { value: "BANKNIFTY", label: "Bank Nifty",    category: "Indian Indices",  name: "Nifty Bank" },
  { value: "SENSEX",    label: "Sensex",        category: "Indian Indices",  name: "BSE Sensex" },
  { value: "NIFTYIT",   label: "Nifty IT",      category: "Indian Indices",  name: "Nifty IT" },
  { value: "FINNIFTY",  label: "Fin Nifty",     category: "Indian Indices",  name: "Nifty Financial Services" },
];

// ── Market quote ─────────────────────────────────────────────────────────────

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
    res.json({ ...(cached.data as object), fetchedAt: cached.fetchedAt, stale: false });
    return;
  }

  try {
    const quote = await fetchYahooQuote(upper);
    const fetchedAt = Date.now();
    quoteCache.set(upper, { data: quote, expiresAt: fetchedAt + QUOTE_TTL_MS, fetchedAt });
    res.json({ ...(quote as object), fetchedAt, stale: false });
  } catch (err) {
    // Return stale cache if available, marked as stale
    if (cached) {
      res.json({ ...(cached.data as object), fetchedAt: cached.fetchedAt, stale: true });
      return;
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(503).json({ error: `Failed to fetch quote for ${symbol}: ${msg}` });
  }
});

// ── Symbol search ─────────────────────────────────────────────────────────────

router.get("/market/search", (req, res): void => {
  const { q } = req.query as Record<string, string>;

  if (!q || q.trim().length < 1) {
    res.json({ results: [] });
    return;
  }

  const query = q.trim().toLowerCase();

  const results = SYMBOL_REGISTRY.filter(s =>
    s.value.toLowerCase().includes(query) ||
    s.label.toLowerCase().includes(query) ||
    s.name.toLowerCase().includes(query) ||
    s.category.toLowerCase().includes(query)
  ).slice(0, 10);

  res.json({ results });
});

// ── Market movers ─────────────────────────────────────────────────────────────
// Returns top symbols sorted by price change % (uses cached quotes when available)

const MOVER_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "NVDA", "TSLA", "AAPL", "MSFT", "AMZN",
  "XAUUSD", "SPX500", "EURUSD",
];

const moversCache = { data: null as unknown, expiresAt: 0 };
const MOVERS_TTL_MS = 60_000;

router.get("/market/movers", async (_req, res): Promise<void> => {
  if (moversCache.data && Date.now() < moversCache.expiresAt) {
    res.json(moversCache.data);
    return;
  }

  const results = await Promise.allSettled(
    MOVER_SYMBOLS.filter(s => isYahooSupported(s)).map(async (symbol) => {
      // Check quote cache first
      const cached = quoteCache.get(symbol);
      if (cached && Date.now() < cached.expiresAt) return { symbol, ...(cached.data as object) };
      const quote = await fetchYahooQuote(symbol);
      const fetchedAt = Date.now();
      quoteCache.set(symbol, { data: quote, expiresAt: fetchedAt + QUOTE_TTL_MS, fetchedAt });
      return { symbol, ...(quote as object) };
    })
  );

  const movers = results
    .filter((r): r is PromiseFulfilledResult<Record<string, unknown>> => r.status === "fulfilled")
    .map(r => r.value)
    .sort((a, b) => {
      const aChg = Math.abs(Number(a["changePercent"] ?? 0));
      const bChg = Math.abs(Number(b["changePercent"] ?? 0));
      return bChg - aChg;
    })
    .slice(0, 12);

  const data = { movers, generatedAt: Date.now() };
  moversCache.data = data;
  moversCache.expiresAt = Date.now() + MOVERS_TTL_MS;

  res.json(data);
});

export default router;
