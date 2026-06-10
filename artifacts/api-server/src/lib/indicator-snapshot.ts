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
]);

export function isIndicatorKeySupported(indicatorId: string, outputKey: string): boolean {
  return SUPPORTED_INDICATOR_KEYS.has(`${indicatorId}_${outputKey}`);
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

  return snapshot;
}
