import YahooFinance from "yahoo-finance2";
import type { OHLCVBar } from "./backtest-engine";

// yahoo-finance2 v3 requires class instantiation
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const YAHOO_SYMBOL_MAP: Record<string, string> = {
  EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "USDJPY=X",
  AUDUSD: "AUDUSD=X", USDCAD: "USDCAD=X", USDCHF: "USDCHF=X",
  NZDUSD: "NZDUSD=X", EURGBP: "EURGBP=X", EURJPY: "EURJPY=X",
  GBPJPY: "GBPJPY=X", CHFJPY: "CHFJPY=X",
  "EUR/USD": "EURUSD=X", "GBP/USD": "GBPUSD=X", "USD/JPY": "USDJPY=X",
  SPX500: "^GSPC", NAS100: "^NDX", DOW30: "^DJI",
  UK100: "^FTSE", GER40: "^GDAXI", JPN225: "^N225",
  XAUUSD: "GC=F", XAGUSD: "SI=F", WTIUSD: "CL=F",
  NATGAS: "NG=F", BRENTUSD: "BZ=F", NATGASUSD: "NG=F",
  GLD: "GLD", SLV: "SLV",
  SPY: "SPY", QQQ: "QQQ", IWM: "IWM", DIA: "DIA", TLT: "TLT",
};

const STOCK_SYMBOLS = new Set([
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD", "INTC",
  "ORCL", "CRM", "NFLX", "PYPL", "SQ", "JPM", "BAC", "GS", "V", "MA",
  "DIS", "BA", "GE", "XOM", "WMT", "KO", "SPY", "QQQ", "IWM", "DIA", "TLT",
  "GLD", "SLV", "VIX",
]);

export function toYahooSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  return YAHOO_SYMBOL_MAP[upper] ?? upper;
}

export function isYahooSupported(symbol: string): boolean {
  const upper = symbol.toUpperCase();
  if (YAHOO_SYMBOL_MAP[upper]) return true;
  if (STOCK_SYMBOLS.has(upper)) return true;
  return false;
}

export interface YahooQuote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
  marketState: string;
}

type AnyRecord = Record<string, unknown>;

export async function fetchYahooQuote(symbol: string): Promise<YahooQuote> {
  const yahooSym = toYahooSymbol(symbol);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: AnyRecord = (await (yahooFinance.quote as any)(yahooSym)) as AnyRecord;
  const price = Number(result["regularMarketPrice"] ?? 0);
  const prevClose = Number(result["regularMarketPreviousClose"] ?? price);
  return {
    symbol,
    price,
    change: price - prevClose,
    changePct: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
    high: Number(result["regularMarketDayHigh"] ?? price),
    low: Number(result["regularMarketDayLow"] ?? price),
    open: Number(result["regularMarketOpen"] ?? price),
    previousClose: prevClose,
    volume: Number(result["regularMarketVolume"] ?? 0),
    marketState: String(result["marketState"] ?? "REGULAR"),
  };
}

export async function fetchYahooHistory(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<OHLCVBar[]> {
  const yahooSym = toYahooSymbol(symbol);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: AnyRecord[] = (await (yahooFinance.historical as any)(yahooSym, {
    period1: startDate,
    period2: endDate,
    interval: "1d",
  })) as AnyRecord[];

  if (!result || result.length === 0) {
    throw new Error(`No historical data available for ${symbol} in the requested date range`);
  }

  return result
    .filter(bar => bar["open"] != null && bar["high"] != null && bar["low"] != null && bar["close"] != null)
    .map(bar => ({
      date: new Date(bar["date"] as string | number | Date).toISOString().split("T")[0]!,
      open: Number(bar["open"] ?? 0),
      high: Number(bar["high"] ?? 0),
      low: Number(bar["low"] ?? 0),
      close: Number(bar["adjClose"] ?? bar["close"] ?? 0),
      volume: Number(bar["volume"] ?? 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const YF_INTERVAL_MAP: Record<string, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h",
  "4h": "1h", "1d": "1d", "1w": "1wk",
};

const INTERVAL_SECONDS: Record<string, number> = {
  "1m": 60, "5m": 300, "15m": 900, "1h": 3600,
  "4h": 14400, "1d": 86400, "1w": 604800,
};

export async function fetchYahooKlines(
  symbol: string,
  interval: string,
  limit: number,
): Promise<{ time: number; open: number; high: number; low: number; close: number; volume: number }[]> {
  const yahooSym = toYahooSymbol(symbol);
  const yfInterval = YF_INTERVAL_MAP[interval] ?? "1d";
  const intervalSec = INTERVAL_SECONDS[interval] ?? 86400;

  const endDate = new Date();
  const paddingFactor = ["1d", "1w"].includes(interval) ? 2.0 : 3.0;
  const startDate = new Date(endDate.getTime() - intervalSec * limit * 1000 * paddingFactor);

  const isIntraday = ["1m", "5m", "15m", "1h", "4h"].includes(interval);

  if (isIntraday) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: AnyRecord = (await (yahooFinance.chart as any)(yahooSym, {
      period1: startDate,
      period2: endDate,
      interval: yfInterval,
    })) as AnyRecord;

    const quotes = (result["quotes"] as AnyRecord[] | null) ?? [];
    return quotes
      .filter(q => q["open"] != null && q["close"] != null)
      .slice(-limit)
      .map(q => ({
        time: Math.floor(new Date(q["date"] as string | number | Date).getTime() / 1000),
        open: Number(q["open"] ?? 0),
        high: Number(q["high"] ?? 0),
        low: Number(q["low"] ?? 0),
        close: Number(q["close"] ?? 0),
        volume: Number(q["volume"] ?? 0),
      }));
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: AnyRecord[] = (await (yahooFinance.historical as any)(yahooSym, {
      period1: startDate,
      period2: endDate,
      interval: yfInterval,
    })) as AnyRecord[];

    return (result ?? [])
      .filter(bar => bar["open"] != null && bar["close"] != null)
      .slice(-limit)
      .map(bar => ({
        time: Math.floor(new Date(bar["date"] as string | number | Date).getTime() / 1000),
        open: Number(bar["open"] ?? 0),
        high: Number(bar["high"] ?? 0),
        low: Number(bar["low"] ?? 0),
        close: Number(bar["adjClose"] ?? bar["close"] ?? 0),
        volume: Number(bar["volume"] ?? 0),
      }));
  }
}
