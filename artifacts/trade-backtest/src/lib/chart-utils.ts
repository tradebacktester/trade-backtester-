import type { IPriceLine, ISeriesApi, Time } from "lightweight-charts";

// ── Draw types ────────────────────────────────────────────────────

export type DrawTool = "cursor" | "hline" | "trendline" | "fibonacci" | "rectangle" | "ray" | "eraser" | "doodle";

export type DrawnObject =
  | { kind: "hline";     priceLine: IPriceLine; id: number; price: number; color: string }
  | { kind: "trendline"; series: ISeriesApi<"Line">; id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; color: string }
  | { kind: "fibonacci"; priceLines: IPriceLine[]; id: number; high: number; low: number; color: string }
  | { kind: "rectangle"; series: ISeriesApi<"Line">; id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; color: string }
  | { kind: "ray";       series: ISeriesApi<"Line">; id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; color: string };

export type SerializableDrawing =
  | { kind: "hline";     id: number; price: number; color: string }
  | { kind: "trendline"; id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; color: string }
  | { kind: "fibonacci"; id: number; high: number; low: number; color: string }
  | { kind: "rectangle"; id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; color: string }
  | { kind: "ray";       id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; color: string };

export type DrawStart = { x: number; y: number; price: number; time: Time };

// ── Chart data ────────────────────────────────────────────────────

export type OhlcState = {
  open: number; high: number; low: number; close: number;
  time: string; volume?: number;
  pxX?: number; pxY?: number;
} | null;

export type KlineBar = {
  time: number; open: number; high: number; low: number; close: number; volume: number;
};

export type Position = {
  price: number; time: number; units: number; capitalAtEntry: number;
  side: "long" | "short";
};

export type SimTrade = {
  id: number; entryPrice: number; entryTime: number;
  exitPrice: number; exitTime: number; units: number;
  pnl: number; pnlPct: number;
  side?: "long" | "short";
  symbol?: string;
};

// ── Indicators ────────────────────────────────────────────────────

export type IndicatorId = "sma20" | "sma50" | "ema20" | "ema50" | "ema9" | "bb" | "rsi" | "macd" | "vwap" | "atr" | "stoch";

export interface IndicatorConfig {
  id: IndicatorId;
  label: string;
  enabled: boolean;
  color: string;
  period: number;
  isOverlay: boolean;
}

export const DEFAULT_INDICATORS: IndicatorConfig[] = [
  { id: "ema9",  label: "EMA 9",          enabled: false, color: "hsl(38,100%,65%)",  period: 9,  isOverlay: true  },
  { id: "ema20", label: "EMA 20",          enabled: false, color: "hsl(190,90%,55%)", period: 20, isOverlay: true  },
  { id: "ema50", label: "EMA 50",          enabled: false, color: "hsl(150,90%,55%)", period: 50, isOverlay: true  },
  { id: "sma20", label: "SMA 20",          enabled: false, color: "hsl(38,100%,60%)",  period: 20, isOverlay: true  },
  { id: "sma50", label: "SMA 50",          enabled: false, color: "hsl(260,80%,68%)", period: 50, isOverlay: true  },
  { id: "bb",    label: "Bollinger 20",    enabled: false, color: "hsl(200,80%,65%)", period: 20, isOverlay: true  },
  { id: "vwap",  label: "VWAP",            enabled: false, color: "hsl(38,100%,55%)", period: 1,  isOverlay: true  },
  { id: "rsi",   label: "RSI 14",          enabled: false, color: "hsl(38,100%,60%)",  period: 14, isOverlay: false },
  { id: "macd",  label: "MACD 12/26/9",    enabled: false, color: "hsl(190,90%,55%)", period: 12, isOverlay: false },
  { id: "atr",   label: "ATR 14",          enabled: false, color: "hsl(260,80%,68%)", period: 14, isOverlay: false },
  { id: "stoch", label: "Stochastic 14",   enabled: false, color: "hsl(150,90%,55%)", period: 14, isOverlay: false },
];

// ── Layouts ───────────────────────────────────────────────────────

export interface ChartLayout {
  id: string;
  name: string;
  symbol: string;
  interval: string;
  drawings: SerializableDrawing[];
  indicators: IndicatorId[];
  createdAt: number;
}

const LAYOUTS_KEY = "chart_layouts_v2";

export function loadLayouts(): ChartLayout[] {
  try {
    const raw = localStorage.getItem(LAYOUTS_KEY);
    return raw ? (JSON.parse(raw) as ChartLayout[]) : [];
  } catch { return []; }
}

export function saveLayouts(layouts: ChartLayout[]) {
  try { localStorage.setItem(LAYOUTS_KEY, JSON.stringify(layouts)); } catch { /* ignore */ }
}

const INDICATORS_KEY = "chart_indicators_v2";

export function loadIndicators(): IndicatorConfig[] {
  try {
    const raw = localStorage.getItem(INDICATORS_KEY);
    if (!raw) return DEFAULT_INDICATORS;
    const saved = JSON.parse(raw) as { id: IndicatorId; enabled: boolean }[];
    return DEFAULT_INDICATORS.map(def => {
      const s = saved.find(x => x.id === def.id);
      return s ? { ...def, enabled: s.enabled } : def;
    });
  } catch { return DEFAULT_INDICATORS; }
}

export function persistIndicators(indicators: IndicatorConfig[]) {
  try {
    localStorage.setItem(INDICATORS_KEY, JSON.stringify(indicators.map(i => ({ id: i.id, enabled: i.enabled }))));
  } catch { /* ignore */ }
}

// ── Simulated data for non-crypto symbols ─────────────────────────

// Seeded PRNG for deterministic data per symbol
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function strToSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return h;
}

export function generateSimData(symbol: string, basePrice: number, count = 500, intervalSec = 86400): KlineBar[] {
  const rng = mulberry32(strToSeed(symbol));
  const bars: KlineBar[] = [];
  const now = Math.floor(Date.now() / 1000);
  let price = basePrice;
  for (let i = count - 1; i >= 0; i--) {
    const t = now - i * intervalSec;
    const vol = (rng() - 0.5) * 0.025;
    const open = price;
    const move = (rng() - 0.48) * 0.02 * price;
    const high = open + Math.abs(rng() * 0.012 * price);
    const low  = open - Math.abs(rng() * 0.012 * price);
    const close = Math.max(low, Math.min(high, open + move));
    const volume = basePrice * (50000 + rng() * 200000);
    bars.push({ time: t, open, high, low, close, volume });
    price = close;
  }
  return bars;
}

// ── Calculations ──────────────────────────────────────────────────

export function calcSMA(bars: KlineBar[], period: number): { time: number; value: number }[] {
  const result: { time: number; value: number }[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += bars[j].close;
    result.push({ time: bars[i].time, value: sum / period });
  }
  return result;
}

export function calcEMA(bars: KlineBar[], period: number): { time: number; value: number }[] {
  if (bars.length < period) return [];
  const k = 2 / (period + 1);
  const result: { time: number; value: number }[] = [];
  let ema = bars.slice(0, period).reduce((s, b) => s + b.close, 0) / period;
  result.push({ time: bars[period - 1].time, value: ema });
  for (let i = period; i < bars.length; i++) {
    ema = bars[i].close * k + ema * (1 - k);
    result.push({ time: bars[i].time, value: ema });
  }
  return result;
}

export function calcBB(bars: KlineBar[], period: number): {
  upper: { time: number; value: number }[];
  middle: { time: number; value: number }[];
  lower: { time: number; value: number }[];
} {
  const upper: { time: number; value: number }[] = [];
  const middle: { time: number; value: number }[] = [];
  const lower: { time: number; value: number }[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1).map(b => b.close);
    const avg = slice.reduce((s, v) => s + v, 0) / period;
    const variance = slice.reduce((s, v) => s + (v - avg) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    middle.push({ time: bars[i].time, value: avg });
    upper.push({ time: bars[i].time, value: avg + 2 * std });
    lower.push({ time: bars[i].time, value: avg - 2 * std });
  }
  return { upper, middle, lower };
}

export function calcRSI(bars: KlineBar[], period = 14): { time: number; value: number }[] {
  if (bars.length <= period) return [];
  const result: { time: number; value: number }[] = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push({ time: bars[period].time, value: 100 - 100 / (1 + rs0) });
  for (let i = period + 1; i < bars.length; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({ time: bars[i].time, value: 100 - 100 / (1 + rs) });
  }
  return result;
}

export function calcMACD(bars: KlineBar[], fast = 12, slow = 26, signal = 9): {
  macd: { time: number; value: number }[];
  signal: { time: number; value: number }[];
  histogram: { time: number; value: number }[];
} {
  const emaF = calcEMA(bars, fast);
  const emaS = calcEMA(bars, slow);
  const slowMap = new Map(emaS.map(d => [d.time, d.value]));
  const macdLine: { time: number; value: number }[] = [];
  for (const { time, value } of emaF) {
    const sv = slowMap.get(time);
    if (sv !== undefined) macdLine.push({ time, value: value - sv });
  }
  if (macdLine.length < signal) return { macd: macdLine, signal: [], histogram: [] };
  const k = 2 / (signal + 1);
  let ema = macdLine.slice(0, signal).reduce((s, d) => s + d.value, 0) / signal;
  const signalLine: { time: number; value: number }[] = [];
  const histogram: { time: number; value: number }[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (i < signal - 1) continue;
    if (i === signal - 1) ema = macdLine.slice(0, signal).reduce((s, d) => s + d.value, 0) / signal;
    else ema = macdLine[i].value * k + ema * (1 - k);
    signalLine.push({ time: macdLine[i].time, value: ema });
    histogram.push({ time: macdLine[i].time, value: macdLine[i].value - ema });
  }
  return { macd: macdLine, signal: signalLine, histogram };
}

export function calcVWAP(bars: KlineBar[]): { time: number; value: number }[] {
  // Session-based VWAP reset at each day
  const result: { time: number; value: number }[] = [];
  let cumTV = 0, cumVol = 0;
  let lastDay = -1;
  for (const b of bars) {
    const day = Math.floor(b.time / 86400);
    if (day !== lastDay) { cumTV = 0; cumVol = 0; lastDay = day; }
    const tp = (b.high + b.low + b.close) / 3;
    cumTV += tp * b.volume;
    cumVol += b.volume;
    result.push({ time: b.time, value: cumVol > 0 ? cumTV / cumVol : tp });
  }
  return result;
}

export function calcATR(bars: KlineBar[], period = 14): { time: number; value: number }[] {
  if (bars.length < period + 1) return [];
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const hl = bars[i].high - bars[i].low;
    const hc = Math.abs(bars[i].high - bars[i - 1].close);
    const lc = Math.abs(bars[i].low - bars[i - 1].close);
    trs.push(Math.max(hl, hc, lc));
  }
  const result: { time: number; value: number }[] = [];
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  result.push({ time: bars[period].time, value: atr });
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result.push({ time: bars[i + 1].time, value: atr });
  }
  return result;
}

export function calcStochastic(bars: KlineBar[], period = 14, smooth = 3): {
  k: { time: number; value: number }[];
  d: { time: number; value: number }[];
} {
  const kRaw: { time: number; value: number }[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    const high = Math.max(...slice.map(b => b.high));
    const low  = Math.min(...slice.map(b => b.low));
    const k = high === low ? 50 : ((bars[i].close - low) / (high - low)) * 100;
    kRaw.push({ time: bars[i].time, value: k });
  }
  // Smooth %K into %D
  const dLine: { time: number; value: number }[] = [];
  for (let i = smooth - 1; i < kRaw.length; i++) {
    const avg = kRaw.slice(i - smooth + 1, i + 1).reduce((s, v) => s + v.value, 0) / smooth;
    dLine.push({ time: kRaw[i].time, value: avg });
  }
  return { k: kRaw, d: dLine };
}
