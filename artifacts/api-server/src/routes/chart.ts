import { Router, type IRouter } from "express";

const router: IRouter = Router();

const SYMBOL_MAP: Record<string, string> = {
  "BTC/USD": "BTCUSDT",
  "ETH/USD": "ETHUSDT",
  "BNB/USD": "BNBUSDT",
  "SOL/USD": "SOLUSDT",
  "XRP/USD": "XRPUSDT",
  "ADA/USD": "ADAUSDT",
  "DOGE/USD": "DOGEUSDT",
  "AVAX/USD": "AVAXUSDT",
  "DOT/USD": "DOTUSDT",
  "MATIC/USD": "MATICUSDT",
};

const STOCK_SYMBOLS = new Set(["AAPL", "MSFT", "TSLA", "NVDA", "AMZN", "GOOGL", "SPY", "QQQ"]);

const VALID_INTERVALS = new Set(["1m", "5m", "15m", "1h", "4h", "1d", "1w"]);

router.get("/klines", async (req, res): Promise<void> => {
  const { symbol, interval, limit } = req.query as Record<string, string>;

  if (!symbol || !interval) {
    res.status(400).json({ error: "symbol and interval are required" });
    return;
  }

  if (!VALID_INTERVALS.has(interval)) {
    res.status(400).json({ error: `interval must be one of: ${[...VALID_INTERVALS].join(", ")}` });
    return;
  }

  if (STOCK_SYMBOLS.has(symbol.toUpperCase())) {
    res.status(400).json({ error: `${symbol} is a stock symbol. Candlestick chart supports crypto pairs only (e.g. BTC/USD, ETH/USD).` });
    return;
  }

  const binanceSymbol = SYMBOL_MAP[symbol.toUpperCase()] ?? symbol.replace("/", "").toUpperCase();
  const klinesLimit = Math.min(Math.max(parseInt(limit ?? "200", 10) || 200, 1), 1000);

  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${klinesLimit}`;

  let raw: unknown;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      req.log.warn({ status: response.status, body: text }, "Binance API error");
      res.status(502).json({ error: `Binance returned ${response.status}` });
      return;
    }
    raw = await response.json();
  } catch (err) {
    req.log.error({ err }, "Failed to fetch from Binance");
    res.status(502).json({ error: "Failed to reach Binance API" });
    return;
  }

  if (!Array.isArray(raw)) {
    res.status(502).json({ error: "Unexpected response from Binance" });
    return;
  }

  const bars = raw.map((kline: unknown) => {
    const k = kline as [number, string, string, string, string, string, ...unknown[]];
    return {
      time: Math.floor(k[0] / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    };
  });

  res.json(bars);
});

export default router;
