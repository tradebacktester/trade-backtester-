import { generatePriceData } from "./backtest-engine";

function sma(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function ema(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { result[i] = null; continue; }
    if (i === period - 1) {
      prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result[i] = prev; continue;
    }
    prev = prices[i]! * k + prev! * (1 - k);
    result[i] = prev;
  }
  return result;
}

function rsi(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null);
  if (prices.length < period + 1) return result;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i]! - prices[i - 1]!;
    if (diff > 0) avgGain += diff; else avgLoss += -diff;
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i]! - prices[i - 1]!;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

function macdCalc(prices: number[], fastP = 12, slowP = 26, signalP = 9): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const fastEma = ema(prices, fastP);
  const slowEma = ema(prices, slowP);
  const macdLine = prices.map((_, i) => {
    const f = fastEma[i], s = slowEma[i];
    return f != null && s != null ? f - s : null;
  });
  const validMacd = macdLine.filter((v): v is number => v != null);
  const signalLine: (number | null)[] = new Array(prices.length).fill(null);
  const sigEma = ema(validMacd, signalP);
  let vi = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] != null) signalLine[i] = sigEma[vi++] ?? null;
  }
  const histogram = macdLine.map((m, i) => {
    const s = signalLine[i];
    return m != null && s != null ? m - s : null;
  });
  return { macd: macdLine, signal: signalLine, histogram };
}

function bollingerBands(prices: number[], period = 20, stdDevMult = 2): {
  upper: (number | null)[];
  mid: (number | null)[];
  lower: (number | null)[];
} {
  const mid = sma(prices, period);
  const upper = prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    return (mid[i] ?? 0) + stdDevMult * Math.sqrt(variance);
  });
  const lower = prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    return (mid[i] ?? 0) - stdDevMult * Math.sqrt(variance);
  });
  return { upper, mid, lower };
}

function atr(bars: { high: number; low: number; close: number }[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(bars.length).fill(null);
  if (bars.length < 2) return result;
  const tr: number[] = [bars[0]!.high - bars[0]!.low];
  for (let i = 1; i < bars.length; i++) {
    const hl = bars[i]!.high - bars[i]!.low;
    const hc = Math.abs(bars[i]!.high - bars[i - 1]!.close);
    const lc = Math.abs(bars[i]!.low - bars[i - 1]!.close);
    tr.push(Math.max(hl, hc, lc));
  }
  let avg = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = avg;
  for (let i = period; i < bars.length; i++) { avg = (avg * (period - 1) + tr[i]!) / period; result[i] = avg; }
  return result;
}

function stochRsi(prices: number[], rsiPeriod = 14, stochPeriod = 14): { k: (number | null)[]; d: (number | null)[] } {
  const rsiValues = rsi(prices, rsiPeriod);
  const k: (number | null)[] = new Array(prices.length).fill(null);
  for (let i = stochPeriod - 1; i < prices.length; i++) {
    const window = rsiValues.slice(i - stochPeriod + 1, i + 1).filter((v): v is number => v !== null);
    if (window.length < stochPeriod) continue;
    const minR = Math.min(...window);
    const maxR = Math.max(...window);
    const curr = rsiValues[i];
    k[i] = curr == null ? null : maxR === minR ? 0 : ((curr - minR) / (maxR - minR)) * 100;
  }
  const d = sma(k.map((v) => v ?? 0), 3);
  return { k, d };
}

function vwap(bars: { high: number; low: number; close: number; volume: number }[]): (number | null)[] {
  const result: (number | null)[] = new Array(bars.length).fill(null);
  let cumTPV = 0, cumVol = 0;
  for (let i = 0; i < bars.length; i++) {
    const tp = (bars[i]!.high + bars[i]!.low + bars[i]!.close) / 3;
    cumTPV += tp * (bars[i]!.volume ?? 0);
    cumVol += bars[i]!.volume ?? 0;
    result[i] = cumVol === 0 ? null : cumTPV / cumVol;
  }
  return result;
}

function adx(bars: { high: number; low: number; close: number }[], period = 14): {
  adx: (number | null)[];
  plusDI: (number | null)[];
  minusDI: (number | null)[];
} {
  const n = bars.length;
  const adxArr: (number | null)[] = new Array(n).fill(null);
  const plusDIArr: (number | null)[] = new Array(n).fill(null);
  const minusDIArr: (number | null)[] = new Array(n).fill(null);
  if (n < period * 2) return { adx: adxArr, plusDI: plusDIArr, minusDI: minusDIArr };

  const trArr: number[] = [];
  const plusDMArr: number[] = [];
  const minusDMArr: number[] = [];

  for (let i = 1; i < n; i++) {
    const hl = bars[i]!.high - bars[i]!.low;
    const hpc = Math.abs(bars[i]!.high - bars[i - 1]!.close);
    const lpc = Math.abs(bars[i]!.low - bars[i - 1]!.close);
    trArr.push(Math.max(hl, hpc, lpc));

    const upMove = bars[i]!.high - bars[i - 1]!.high;
    const downMove = bars[i - 1]!.low - bars[i]!.low;
    plusDMArr.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMArr.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  let smoothTR = trArr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDMArr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDMArr.slice(0, period).reduce((a, b) => a + b, 0);

  const dxArr: number[] = [];

  for (let i = period; i < trArr.length; i++) {
    smoothTR = smoothTR - smoothTR / period + trArr[i]!;
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDMArr[i]!;
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDMArr[i]!;

    const pdi = smoothTR === 0 ? 0 : (smoothPlusDM / smoothTR) * 100;
    const mdi = smoothTR === 0 ? 0 : (smoothMinusDM / smoothTR) * 100;
    const idx = i + 1;
    plusDIArr[idx] = pdi;
    minusDIArr[idx] = mdi;

    const diSum = pdi + mdi;
    dxArr.push(diSum === 0 ? 0 : (Math.abs(pdi - mdi) / diSum) * 100);
  }

  let adxVal = dxArr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const adxStart = period * 2;
  adxArr[adxStart] = adxVal;
  for (let i = 1; i < dxArr.length - period; i++) {
    adxVal = (adxVal * (period - 1) + dxArr[period + i]!) / period;
    adxArr[adxStart + i] = adxVal;
  }

  return { adx: adxArr, plusDI: plusDIArr, minusDI: minusDIArr };
}

function supertrend(bars: { high: number; low: number; close: number }[], period = 10, multiplier = 3): {
  value: (number | null)[];
  direction: (number | null)[];
} {
  const n = bars.length;
  const valueArr: (number | null)[] = new Array(n).fill(null);
  const dirArr: (number | null)[] = new Array(n).fill(null);
  const atrValues = atr(bars, period);

  let upperBand = 0, lowerBand = 0, prevUpperBand = 0, prevLowerBand = 0;
  let dir = 1;

  for (let i = period; i < n; i++) {
    const atrV = atrValues[i];
    if (atrV == null) continue;
    const hl2 = (bars[i]!.high + bars[i]!.low) / 2;
    const basicUpper = hl2 + multiplier * atrV;
    const basicLower = hl2 - multiplier * atrV;

    upperBand = basicUpper < prevUpperBand || bars[i - 1]!.close > prevUpperBand ? basicUpper : prevUpperBand;
    lowerBand = basicLower > prevLowerBand || bars[i - 1]!.close < prevLowerBand ? basicLower : prevLowerBand;

    if (bars[i]!.close <= upperBand && dir === -1) dir = -1;
    else if (bars[i]!.close > upperBand) dir = 1;
    if (bars[i]!.close >= lowerBand && dir === 1) dir = 1;
    else if (bars[i]!.close < lowerBand) dir = -1;

    valueArr[i] = dir === 1 ? lowerBand : upperBand;
    dirArr[i] = dir;
    prevUpperBand = upperBand;
    prevLowerBand = lowerBand;
  }

  return { value: valueArr, direction: dirArr };
}

function stochastic(bars: { high: number; low: number; close: number }[], kPeriod = 14, dPeriod = 3): {
  k: (number | null)[];
  d: (number | null)[];
} {
  const n = bars.length;
  const k: (number | null)[] = new Array(n).fill(null);
  for (let i = kPeriod - 1; i < n; i++) {
    const window = bars.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...window.map(b => b.high));
    const lowest = Math.min(...window.map(b => b.low));
    k[i] = highest === lowest ? 0 : ((bars[i]!.close - lowest) / (highest - lowest)) * 100;
  }
  const dRaw = sma(k.map(v => v ?? 0), dPeriod);
  const d: (number | null)[] = k.map((v, i) => v == null ? null : dRaw[i]);
  return { k, d };
}

function volumeSma(bars: { volume: number }[], period = 20): (number | null)[] {
  const vols = bars.map(b => b.volume ?? 0);
  return sma(vols, period);
}

export type IndicatorSnapshot = Record<string, { prev: number | null; curr: number | null }>;

export const SUPPORTED_INDICATOR_KEYS: ReadonlySet<string> = new Set([
  "price_close",
  "price_open",
  "price_high",
  "price_low",
  "price_volume",
  "sma_10_value",
  "sma_20_value",
  "sma_50_value",
  "sma_100_value",
  "sma_200_value",
  "ema_9_value",
  "ema_10_value",
  "ema_12_value",
  "ema_20_value",
  "ema_26_value",
  "ema_50_value",
  "ema_100_value",
  "ema_200_value",
  "rsi_7_value",
  "rsi_14_value",
  "rsi_21_value",
  "macd_12_26_9_macd",
  "macd_12_26_9_signal",
  "macd_12_26_9_histogram",
  "bb_20_2_upper",
  "bb_20_2_mid",
  "bb_20_2_lower",
  "atr_14_value",
  "stochrsi_14_k",
  "stochrsi_14_d",
  "vwap_value",
  "adx_14_value",
  "adx_14_plus_di",
  "adx_14_minus_di",
  "supertrend_10_3_value",
  "supertrend_10_3_direction",
  "stoch_14_3_k",
  "stoch_14_3_d",
  "volume_sma_20_value",
]);

export function isIndicatorKeySupported(indicatorId: string, outputKey: string): boolean {
  return SUPPORTED_INDICATOR_KEYS.has(`${indicatorId}_${outputKey}`);
}

export interface CatalogEntry {
  key: string;
  indicatorId: string;
  outputKey: string;
  label: string;
  category: "price" | "trend" | "momentum" | "volatility" | "volume" | "drawing";
  description: string;
  unit?: string;
  minPlan: "free" | "pro" | "elite";
  supportedOperators: string[];
}

// Operator sets used by catalog entries
const OPS_THRESHOLD = ["gt", "lt", "eq", "enters", "exits"];
const OPS_CROSS     = ["crossAbove", "crossBelow", ...OPS_THRESHOLD];
const OPS_SIGNAL    = ["signal"];
const OPS_DRAWING   = ["touch", "breakAbove", "breakBelow", "enterZone", "exitZone", "fibLevel"];

export function getIndicatorCatalog(): CatalogEntry[] {
  return [
    { key: "price_close",  indicatorId: "price", outputKey: "close",  label: "Close Price",   category: "price",      description: "Candle closing price",           minPlan: "free",  supportedOperators: OPS_CROSS },
    { key: "price_open",   indicatorId: "price", outputKey: "open",   label: "Open Price",    category: "price",      description: "Candle opening price",           minPlan: "free",  supportedOperators: OPS_CROSS },
    { key: "price_high",   indicatorId: "price", outputKey: "high",   label: "High Price",    category: "price",      description: "Candle high price",              minPlan: "free",  supportedOperators: OPS_CROSS },
    { key: "price_low",    indicatorId: "price", outputKey: "low",    label: "Low Price",     category: "price",      description: "Candle low price",               minPlan: "free",  supportedOperators: OPS_CROSS },
    { key: "price_volume", indicatorId: "price", outputKey: "volume", label: "Volume",        category: "volume",     description: "Trading volume",                 minPlan: "free",  supportedOperators: OPS_THRESHOLD },

    { key: "sma_10_value",  indicatorId: "sma_10",  outputKey: "value", label: "SMA 10",   category: "trend", description: "Simple moving average (10)",   minPlan: "pro", supportedOperators: OPS_CROSS },
    { key: "sma_20_value",  indicatorId: "sma_20",  outputKey: "value", label: "SMA 20",   category: "trend", description: "Simple moving average (20)",   minPlan: "pro", supportedOperators: OPS_CROSS },
    { key: "sma_50_value",  indicatorId: "sma_50",  outputKey: "value", label: "SMA 50",   category: "trend", description: "Simple moving average (50)",   minPlan: "pro", supportedOperators: OPS_CROSS },
    { key: "sma_100_value", indicatorId: "sma_100", outputKey: "value", label: "SMA 100",  category: "trend", description: "Simple moving average (100)",  minPlan: "pro", supportedOperators: OPS_CROSS },
    { key: "sma_200_value", indicatorId: "sma_200", outputKey: "value", label: "SMA 200",  category: "trend", description: "Simple moving average (200)",  minPlan: "pro", supportedOperators: OPS_CROSS },

    { key: "ema_9_value",   indicatorId: "ema_9",   outputKey: "value", label: "EMA 9",    category: "trend", description: "Exponential moving average (9)",   minPlan: "pro", supportedOperators: OPS_CROSS },
    { key: "ema_20_value",  indicatorId: "ema_20",  outputKey: "value", label: "EMA 20",   category: "trend", description: "Exponential moving average (20)",  minPlan: "pro", supportedOperators: OPS_CROSS },
    { key: "ema_50_value",  indicatorId: "ema_50",  outputKey: "value", label: "EMA 50",   category: "trend", description: "Exponential moving average (50)",  minPlan: "pro", supportedOperators: OPS_CROSS },
    { key: "ema_100_value", indicatorId: "ema_100", outputKey: "value", label: "EMA 100",  category: "trend", description: "Exponential moving average (100)", minPlan: "pro", supportedOperators: OPS_CROSS },
    { key: "ema_200_value", indicatorId: "ema_200", outputKey: "value", label: "EMA 200",  category: "trend", description: "Exponential moving average (200)", minPlan: "pro", supportedOperators: OPS_CROSS },

    { key: "rsi_7_value",  indicatorId: "rsi_7",  outputKey: "value", label: "RSI (7)",  category: "momentum", description: "Relative Strength Index 7-period",  unit: "%", minPlan: "pro", supportedOperators: OPS_THRESHOLD },
    { key: "rsi_14_value", indicatorId: "rsi_14", outputKey: "value", label: "RSI (14)", category: "momentum", description: "Relative Strength Index 14-period", unit: "%", minPlan: "pro", supportedOperators: OPS_THRESHOLD },
    { key: "rsi_21_value", indicatorId: "rsi_21", outputKey: "value", label: "RSI (21)", category: "momentum", description: "Relative Strength Index 21-period", unit: "%", minPlan: "pro", supportedOperators: OPS_THRESHOLD },

    { key: "macd_12_26_9_macd",      indicatorId: "macd_12_26_9", outputKey: "macd",      label: "MACD Line",      category: "momentum", description: "MACD line (12,26,9)",       minPlan: "pro", supportedOperators: OPS_CROSS },
    { key: "macd_12_26_9_signal",    indicatorId: "macd_12_26_9", outputKey: "signal",    label: "MACD Signal",    category: "momentum", description: "MACD signal line (9 EMA)",  minPlan: "pro", supportedOperators: OPS_CROSS },
    { key: "macd_12_26_9_histogram", indicatorId: "macd_12_26_9", outputKey: "histogram", label: "MACD Histogram", category: "momentum", description: "MACD histogram divergence", minPlan: "pro", supportedOperators: OPS_THRESHOLD },

    { key: "bb_20_2_upper", indicatorId: "bb_20_2", outputKey: "upper", label: "BB Upper",  category: "volatility", description: "Bollinger Band upper (20,2)", minPlan: "pro", supportedOperators: OPS_CROSS },
    { key: "bb_20_2_mid",   indicatorId: "bb_20_2", outputKey: "mid",   label: "BB Middle", category: "volatility", description: "Bollinger Band middle SMA",   minPlan: "pro", supportedOperators: OPS_CROSS },
    { key: "bb_20_2_lower", indicatorId: "bb_20_2", outputKey: "lower", label: "BB Lower",  category: "volatility", description: "Bollinger Band lower (20,2)", minPlan: "pro", supportedOperators: OPS_CROSS },

    { key: "atr_14_value",    indicatorId: "atr_14",    outputKey: "value", label: "ATR (14)",         category: "volatility", description: "Average True Range 14-period",       minPlan: "pro", supportedOperators: OPS_THRESHOLD },
    { key: "stochrsi_14_k",   indicatorId: "stochrsi_14", outputKey: "k",  label: "StochRSI %K",      category: "momentum",   description: "Stochastic RSI %K line",             unit: "%", minPlan: "pro", supportedOperators: OPS_THRESHOLD },
    { key: "stochrsi_14_d",   indicatorId: "stochrsi_14", outputKey: "d",  label: "StochRSI %D",      category: "momentum",   description: "Stochastic RSI %D signal",           unit: "%", minPlan: "pro", supportedOperators: OPS_THRESHOLD },
    { key: "vwap_value",      indicatorId: "vwap",      outputKey: "value", label: "VWAP",             category: "volume",     description: "Volume-Weighted Average Price",      minPlan: "pro", supportedOperators: OPS_CROSS },
    { key: "adx_14_value",    indicatorId: "adx_14",    outputKey: "value", label: "ADX (14)",         category: "trend",      description: "Average Directional Index strength", unit: "%", minPlan: "pro", supportedOperators: OPS_THRESHOLD },
    { key: "adx_14_plus_di",  indicatorId: "adx_14",    outputKey: "plus_di",  label: "ADX +DI",     category: "trend",      description: "Positive directional indicator",     unit: "%", minPlan: "pro", supportedOperators: OPS_THRESHOLD },
    { key: "adx_14_minus_di", indicatorId: "adx_14",    outputKey: "minus_di", label: "ADX -DI",     category: "trend",      description: "Negative directional indicator",     unit: "%", minPlan: "pro", supportedOperators: OPS_THRESHOLD },
    { key: "supertrend_10_3_value",     indicatorId: "supertrend_10_3", outputKey: "value",     label: "Supertrend Value",     category: "trend",      description: "Supertrend support/resistance level",   minPlan: "pro", supportedOperators: OPS_CROSS },
    { key: "supertrend_10_3_direction", indicatorId: "supertrend_10_3", outputKey: "direction", label: "Supertrend Direction",  category: "trend",      description: "Supertrend direction: 1=bull, -1=bear", minPlan: "pro", supportedOperators: OPS_SIGNAL },
    { key: "stoch_14_3_k",    indicatorId: "stoch_14_3", outputKey: "k", label: "Stochastic %K",     category: "momentum",   description: "Stochastic oscillator %K",           unit: "%", minPlan: "pro", supportedOperators: OPS_THRESHOLD },
    { key: "stoch_14_3_d",    indicatorId: "stoch_14_3", outputKey: "d", label: "Stochastic %D",     category: "momentum",   description: "Stochastic oscillator %D signal",    unit: "%", minPlan: "pro", supportedOperators: OPS_THRESHOLD },
    { key: "volume_sma_20_value", indicatorId: "volume_sma_20", outputKey: "value", label: "Volume SMA (20)", category: "volume", description: "20-period volume simple moving average", minPlan: "pro", supportedOperators: OPS_THRESHOLD },
  ];
}

export const DRAWING_CATALOG_ENTRY: CatalogEntry = {
  key: "drawing_price",
  indicatorId: "drawing",
  outputKey: "price",
  label: "Drawing Tool",
  category: "drawing",
  description: "Price alert attached to a drawing (hline, trendline, rect, fib, vline)",
  minPlan: "pro",
  supportedOperators: OPS_DRAWING,
};

export function getIndicatorCatalogByCategory(): Record<string, CatalogEntry[]> {
  const catalog = getIndicatorCatalog();
  const result: Record<string, CatalogEntry[]> = {};
  for (const entry of catalog) {
    if (!result[entry.category]) result[entry.category] = [];
    result[entry.category]!.push(entry);
  }
  return result;
}

export function getIndicatorSnapshot(symbol: string, timeframe: string): IndicatorSnapshot {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);

  const bars = generatePriceData(
    symbol,
    startDate.toISOString().split("T")[0]!,
    endDate.toISOString().split("T")[0]!,
    timeframe,
  );

  if (bars.length < 2) return {};

  const closes = bars.map((b) => b.close);
  const snapshot: IndicatorSnapshot = {};
  const last = closes.length - 1;

  const setVal = (key: string, arr: (number | null)[], idx: number) => {
    snapshot[key] = { prev: arr[idx - 1] ?? null, curr: arr[idx] ?? null };
  };

  snapshot["price_close"]  = { prev: closes[last - 1] ?? null, curr: closes[last] ?? null };
  snapshot["price_open"]   = { prev: bars[last - 1]?.open ?? null, curr: bars[last]?.open ?? null };
  snapshot["price_high"]   = { prev: bars[last - 1]?.high ?? null, curr: bars[last]?.high ?? null };
  snapshot["price_low"]    = { prev: bars[last - 1]?.low ?? null, curr: bars[last]?.low ?? null };
  snapshot["price_volume"] = { prev: bars[last - 1]?.volume ?? null, curr: bars[last]?.volume ?? null };

  for (const p of [10, 20, 50, 100, 200]) {
    const v = sma(closes, p); setVal(`sma_${p}_value`, v, last);
  }
  for (const p of [9, 10, 12, 20, 26, 50, 100, 200]) {
    const v = ema(closes, p); setVal(`ema_${p}_value`, v, last);
  }
  for (const p of [7, 14, 21]) {
    const v = rsi(closes, p); setVal(`rsi_${p}_value`, v, last);
  }

  const { macd: macdLine, signal: macdSignal, histogram: macdHist } = macdCalc(closes);
  setVal("macd_12_26_9_macd",      macdLine,    last);
  setVal("macd_12_26_9_signal",    macdSignal,  last);
  setVal("macd_12_26_9_histogram", macdHist,    last);

  const bb = bollingerBands(closes);
  setVal("bb_20_2_upper", bb.upper, last);
  setVal("bb_20_2_mid",   bb.mid,   last);
  setVal("bb_20_2_lower", bb.lower, last);

  const atr14 = atr(bars, 14); setVal("atr_14_value", atr14, last);

  const { k: srsiK, d: srsiD } = stochRsi(closes, 14, 14);
  setVal("stochrsi_14_k", srsiK, last);
  setVal("stochrsi_14_d", srsiD, last);

  const vwapVals = vwap(bars);
  setVal("vwap_value", vwapVals, last);

  const { adx: adxVals, plusDI, minusDI } = adx(bars, 14);
  setVal("adx_14_value",    adxVals, last);
  setVal("adx_14_plus_di",  plusDI,  last);
  setVal("adx_14_minus_di", minusDI, last);

  const { value: stVal, direction: stDir } = supertrend(bars, 10, 3);
  setVal("supertrend_10_3_value",     stVal, last);
  setVal("supertrend_10_3_direction", stDir, last);

  const { k: stochK, d: stochD } = stochastic(bars, 14, 3);
  setVal("stoch_14_3_k", stochK, last);
  setVal("stoch_14_3_d", stochD, last);

  const volSma20 = volumeSma(bars, 20);
  setVal("volume_sma_20_value", volSma20, last);

  return snapshot;
}
