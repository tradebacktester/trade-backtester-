import type { IPriceLine, ISeriesApi, Time } from "lightweight-charts";

// ── Draw types ────────────────────────────────────────────────────

export type DrawTool = "cursor" | "hline" | "trendline" | "fibonacci" | "rectangle" | "ray" | "eraser" | "doodle" | "parallel_channel" | "text" | "pitchfork" | "arrow" | "long_pos" | "short_pos";

export type DrawnObject =
  | { kind: "hline";            priceLine: IPriceLine; id: number; price: number; color: string }
  | { kind: "trendline";        series: ISeriesApi<"Line">; id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; color: string }
  | { kind: "fibonacci";        priceLines: IPriceLine[]; id: number; high: number; low: number; color: string }
  | { kind: "rectangle";        series: ISeriesApi<"Line">; series2: ISeriesApi<"Line">; series3: ISeriesApi<"Line">; series4: ISeriesApi<"Line">; id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; color: string }
  | { kind: "arrow";            series: ISeriesApi<"Line">; id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; color: string }
  | { kind: "ray";              series: ISeriesApi<"Line">; id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; color: string }
  | { kind: "parallel_channel"; series: ISeriesApi<"Line">; series2: ISeriesApi<"Line">; id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; p3: { time: number; price: number }; color: string }
  | { kind: "text";             priceLine: IPriceLine; id: number; price: number; time: number; text: string; color: string }
  | { kind: "pitchfork";        series: ISeriesApi<"Line">; series2: ISeriesApi<"Line">; series3: ISeriesApi<"Line">; id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; p3: { time: number; price: number }; color: string };

export type SerializableDrawing =
  | { kind: "hline";            id: number; price: number; color: string }
  | { kind: "trendline";        id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; color: string }
  | { kind: "fibonacci";        id: number; high: number; low: number; color: string }
  | { kind: "rectangle";        id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; color: string }
  | { kind: "ray";              id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; color: string }
  | { kind: "parallel_channel"; id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; p3: { time: number; price: number }; color: string }
  | { kind: "text";             id: number; price: number; time: number; text: string; color: string }
  | { kind: "pitchfork";        id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; p3: { time: number; price: number }; color: string }
  | { kind: "arrow";            id: number; p1: { time: number; price: number }; p2: { time: number; price: number }; color: string };

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

export type IndicatorId =
  | "sma20" | "sma50"
  | "ema20" | "ema50" | "ema9"
  | "bb" | "rsi" | "macd" | "vwap" | "atr" | "stoch"
  | "ichimoku" | "supertrend" | "psar"
  | "obv" | "williams_r" | "cci" | "adx"
  | "hma" | "dema" | "tema" | "keltner" | "donchian";

export interface IndicatorConfig {
  id: IndicatorId;
  label: string;
  enabled: boolean;
  color: string;
  period: number;
  isOverlay: boolean;
}

export const DEFAULT_INDICATORS: IndicatorConfig[] = [
  { id: "ema9",       label: "EMA 9",          enabled: false, color: "hsl(38,100%,65%)",  period: 9,  isOverlay: true  },
  { id: "ema20",      label: "EMA 20",          enabled: false, color: "hsl(190,90%,55%)", period: 20, isOverlay: true  },
  { id: "ema50",      label: "EMA 50",          enabled: false, color: "hsl(150,90%,55%)", period: 50, isOverlay: true  },
  { id: "sma20",      label: "SMA 20",          enabled: false, color: "hsl(38,100%,60%)",  period: 20, isOverlay: true  },
  { id: "sma50",      label: "SMA 50",          enabled: false, color: "hsl(260,80%,68%)", period: 50, isOverlay: true  },
  { id: "bb",         label: "Bollinger 20",    enabled: false, color: "hsl(200,80%,65%)", period: 20, isOverlay: true  },
  { id: "vwap",       label: "VWAP",            enabled: false, color: "hsl(38,100%,55%)", period: 1,  isOverlay: true  },
  { id: "ichimoku",   label: "Ichimoku Cloud",  enabled: false, color: "hsl(190,80%,60%)", period: 9,  isOverlay: true  },
  { id: "supertrend", label: "Supertrend 10/3", enabled: false, color: "hsl(150,90%,55%)", period: 10, isOverlay: true  },
  { id: "psar",       label: "Parabolic SAR",   enabled: false, color: "hsl(38,100%,60%)",  period: 14, isOverlay: true  },
  { id: "rsi",        label: "RSI 14",          enabled: false, color: "hsl(38,100%,60%)",  period: 14, isOverlay: false },
  { id: "macd",       label: "MACD 12/26/9",    enabled: false, color: "hsl(190,90%,55%)", period: 12, isOverlay: false },
  { id: "atr",        label: "ATR 14",          enabled: false, color: "hsl(260,80%,68%)", period: 14, isOverlay: false },
  { id: "stoch",      label: "Stochastic 14",   enabled: false, color: "hsl(150,90%,55%)", period: 14, isOverlay: false },
  { id: "obv",        label: "OBV",             enabled: false, color: "hsl(190,90%,60%)", period: 1,  isOverlay: false },
  { id: "williams_r", label: "Williams %R 14",  enabled: false, color: "hsl(38,100%,62%)",  period: 14, isOverlay: false },
  { id: "cci",        label: "CCI 20",          enabled: false, color: "hsl(260,80%,68%)", period: 20, isOverlay: false },
  { id: "adx",        label: "ADX 14",          enabled: false, color: "hsl(150,90%,55%)", period: 14, isOverlay: false },
  { id: "hma",        label: "HMA 20",          enabled: false, color: "hsl(310,80%,65%)", period: 20, isOverlay: true  },
  { id: "dema",       label: "DEMA 20",         enabled: false, color: "hsl(16,90%,62%)",  period: 20, isOverlay: true  },
  { id: "tema",       label: "TEMA 20",         enabled: false, color: "hsl(48,95%,60%)",  period: 20, isOverlay: true  },
  { id: "keltner",    label: "Keltner 20",      enabled: false, color: "hsl(170,80%,55%)", period: 20, isOverlay: true  },
  { id: "donchian",   label: "Donchian 20",     enabled: false, color: "hsl(230,80%,68%)", period: 20, isOverlay: true  },
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

// ── Price alerts ──────────────────────────────────────────────────

export interface PriceAlert {
  id: number;
  price: number;
  triggered: boolean;
  label: string;
}

const ALERTS_KEY = "chart_price_alerts_v1";

export function loadAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    return raw ? JSON.parse(raw) as PriceAlert[] : [];
  } catch { return []; }
}

export function saveAlerts(alerts: PriceAlert[]) {
  try { localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)); } catch { /* ignore */ }
}

// ── Simulated data for non-crypto symbols ─────────────────────────

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
    void vol;
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
  const dLine: { time: number; value: number }[] = [];
  for (let i = smooth - 1; i < kRaw.length; i++) {
    const avg = kRaw.slice(i - smooth + 1, i + 1).reduce((s, v) => s + v.value, 0) / smooth;
    dLine.push({ time: kRaw[i].time, value: avg });
  }
  return { k: kRaw, d: dLine };
}

export function calcIchimoku(bars: KlineBar[], tenkanP = 9, kijunP = 26, senkouBP = 52): {
  tenkan:  { time: number; value: number }[];
  kijun:   { time: number; value: number }[];
  spanA:   { time: number; value: number }[];
  spanB:   { time: number; value: number }[];
  chikou:  { time: number; value: number }[];
} {
  const hl2 = (period: number, i: number) => {
    const sl = bars.slice(Math.max(0, i - period + 1), i + 1);
    return (Math.max(...sl.map(b => b.high)) + Math.min(...sl.map(b => b.low))) / 2;
  };

  const tenkan: { time: number; value: number }[] = [];
  const kijun:  { time: number; value: number }[] = [];
  const spanA:  { time: number; value: number }[] = [];
  const spanB:  { time: number; value: number }[] = [];
  const chikou: { time: number; value: number }[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i >= tenkanP - 1) tenkan.push({ time: bars[i].time, value: hl2(tenkanP, i) });
    if (i >= kijunP  - 1) {
      const k = hl2(kijunP, i);
      kijun.push({ time: bars[i].time, value: k });
      const t = i >= tenkanP - 1 ? hl2(tenkanP, i) : k;
      spanA.push({ time: bars[i].time, value: (t + k) / 2 });
    }
    if (i >= senkouBP - 1) spanB.push({ time: bars[i].time, value: hl2(senkouBP, i) });
    if (i + kijunP < bars.length) chikou.push({ time: bars[i + kijunP].time, value: bars[i].close });
  }
  return { tenkan, kijun, spanA, spanB, chikou };
}

export function calcSupertrend(bars: KlineBar[], period = 10, multiplier = 3): {
  up:   { time: number; value: number }[];
  down: { time: number; value: number }[];
} {
  if (bars.length < period + 1) return { up: [], down: [] };

  const trs: number[] = [0];
  for (let i = 1; i < bars.length; i++) {
    trs.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low  - bars[i - 1].close)
    ));
  }
  const atr: number[] = Array(bars.length).fill(0);
  atr[period] = trs.slice(1, period + 1).reduce((s, v) => s + v, 0) / period;
  for (let i = period + 1; i < bars.length; i++) atr[i] = (atr[i - 1] * (period - 1) + trs[i]) / period;

  const hl2 = bars.map(b => (b.high + b.low) / 2);
  const rawUp  = hl2.map((v, i) => v + multiplier * atr[i]);
  const rawDn  = hl2.map((v, i) => v - multiplier * atr[i]);

  const finalUp  = [...rawUp];
  const finalDn  = [...rawDn];
  for (let i = 1; i < bars.length; i++) {
    finalUp[i]  = rawUp[i]  < finalUp[i - 1]  || bars[i - 1].close > finalUp[i - 1]  ? rawUp[i]  : finalUp[i - 1];
    finalDn[i]  = rawDn[i]  > finalDn[i - 1]  || bars[i - 1].close < finalDn[i - 1]  ? rawDn[i]  : finalDn[i - 1];
  }

  const up:   { time: number; value: number }[] = [];
  const down: { time: number; value: number }[] = [];
  let bull = true;

  for (let i = period; i < bars.length; i++) {
    if (bull) {
      if (bars[i].close < finalDn[i]) bull = false;
      else up.push({ time: bars[i].time, value: finalDn[i] });
    } else {
      if (bars[i].close > finalUp[i]) bull = true;
      else down.push({ time: bars[i].time, value: finalUp[i] });
    }
  }
  return { up, down };
}

export function calcParabolicSAR(bars: KlineBar[], step = 0.02, maxAF = 0.2): {
  up:   { time: number; value: number }[];
  down: { time: number; value: number }[];
} {
  if (bars.length < 3) return { up: [], down: [] };
  const up:   { time: number; value: number }[] = [];
  const down: { time: number; value: number }[] = [];

  let bull = true;
  let sar  = bars[0].low;
  let ep   = bars[0].high;
  let af   = step;

  for (let i = 1; i < bars.length; i++) {
    sar = sar + af * (ep - sar);
    if (bull) {
      sar = Math.min(sar, bars[Math.max(0, i - 1)].low, bars[Math.max(0, i - 2)].low);
      if (bars[i].low < sar) {
        bull = false; sar = ep; ep = bars[i].low; af = step;
      } else {
        if (bars[i].high > ep) { ep = bars[i].high; af = Math.min(af + step, maxAF); }
        up.push({ time: bars[i].time, value: sar });
      }
    } else {
      sar = Math.max(sar, bars[Math.max(0, i - 1)].high, bars[Math.max(0, i - 2)].high);
      if (bars[i].high > sar) {
        bull = true; sar = ep; ep = bars[i].high; af = step;
      } else {
        if (bars[i].low < ep) { ep = bars[i].low; af = Math.min(af + step, maxAF); }
        down.push({ time: bars[i].time, value: sar });
      }
    }
  }
  return { up, down };
}

export function calcOBV(bars: KlineBar[]): { time: number; value: number }[] {
  const result: { time: number; value: number }[] = [];
  let obv = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) obv = bars[0].volume;
    else if (bars[i].close > bars[i - 1].close) obv += bars[i].volume;
    else if (bars[i].close < bars[i - 1].close) obv -= bars[i].volume;
    result.push({ time: bars[i].time, value: obv });
  }
  return result;
}

export function calcWilliamsR(bars: KlineBar[], period = 14): { time: number; value: number }[] {
  const result: { time: number; value: number }[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const sl = bars.slice(i - period + 1, i + 1);
    const high = Math.max(...sl.map(b => b.high));
    const low  = Math.min(...sl.map(b => b.low));
    result.push({ time: bars[i].time, value: high === low ? -50 : ((high - bars[i].close) / (high - low)) * -100 });
  }
  return result;
}

export function calcCCI(bars: KlineBar[], period = 20): { time: number; value: number }[] {
  const result: { time: number; value: number }[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const sl = bars.slice(i - period + 1, i + 1);
    const tps = sl.map(b => (b.high + b.low + b.close) / 3);
    const mean = tps.reduce((s, v) => s + v, 0) / period;
    const mad  = tps.reduce((s, v) => s + Math.abs(v - mean), 0) / period;
    result.push({ time: bars[i].time, value: mad === 0 ? 0 : (tps[period - 1] - mean) / (0.015 * mad) });
  }
  return result;
}

export function calcADX(bars: KlineBar[], period = 14): {
  adx:     { time: number; value: number }[];
  diPlus:  { time: number; value: number }[];
  diMinus: { time: number; value: number }[];
} {
  if (bars.length < period * 2 + 1) return { adx: [], diPlus: [], diMinus: [] };

  const dmP: number[] = [0];
  const dmM: number[] = [0];
  const trs: number[] = [0];
  for (let i = 1; i < bars.length; i++) {
    const up   = bars[i].high - bars[i - 1].high;
    const down = bars[i - 1].low - bars[i].low;
    dmP.push(up > down && up > 0 ? up : 0);
    dmM.push(down > up && down > 0 ? down : 0);
    trs.push(Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i-1].close), Math.abs(bars[i].low - bars[i-1].close)));
  }

  let smTR = trs.slice(1, period + 1).reduce((s, v) => s + v, 0);
  let smP  = dmP.slice(1, period + 1).reduce((s, v) => s + v, 0);
  let smM  = dmM.slice(1, period + 1).reduce((s, v) => s + v, 0);

  const dxArr: number[] = [];
  const diPlusArr:  { time: number; value: number }[] = [];
  const diMinusArr: { time: number; value: number }[] = [];

  for (let i = period; i < bars.length; i++) {
    if (i > period) {
      smTR = smTR - smTR / period + trs[i];
      smP  = smP  - smP  / period + dmP[i];
      smM  = smM  - smM  / period + dmM[i];
    }
    const diP = smTR === 0 ? 0 : (smP / smTR) * 100;
    const diM = smTR === 0 ? 0 : (smM / smTR) * 100;
    const sum = diP + diM;
    dxArr.push(sum === 0 ? 0 : (Math.abs(diP - diM) / sum) * 100);
    diPlusArr.push({ time: bars[i].time, value: diP });
    diMinusArr.push({ time: bars[i].time, value: diM });
  }

  const adxArr: { time: number; value: number }[] = [];
  if (dxArr.length >= period) {
    let adx = dxArr.slice(0, period).reduce((s, v) => s + v, 0) / period;
    adxArr.push({ time: bars[period * 2 - 1].time, value: adx });
    for (let i = period; i < dxArr.length; i++) {
      adx = (adx * (period - 1) + dxArr[i]) / period;
      if (period + i < bars.length) adxArr.push({ time: bars[period + i].time, value: adx });
    }
  }
  return { adx: adxArr, diPlus: diPlusArr, diMinus: diMinusArr };
}

// ── Internal helpers ──────────────────────────────────────────────

function calcWMAValues(values: number[], period: number): number[] {
  const result: number[] = [];
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let wsum = 0;
    for (let j = 0; j < period; j++) wsum += (period - j) * values[i - j];
    result.push(wsum / denom);
  }
  return result;
}

function calcEMAValues(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const result: number[] = [ema];
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

// ── HMA (Hull Moving Average) ─────────────────────────────────────

export function calcHMA(bars: KlineBar[], period: number): { time: number; value: number }[] {
  if (bars.length < period) return [];
  const closes = bars.map(b => b.close);
  const half  = Math.max(2, Math.floor(period / 2));
  const sqrtP = Math.max(2, Math.round(Math.sqrt(period)));
  const wmaHalf = calcWMAValues(closes, half);
  const wmaFull = calcWMAValues(closes, period);
  const offset  = period - half;
  const raw: number[] = [];
  for (let i = 0; i < wmaFull.length; i++) raw.push(2 * wmaHalf[i + offset] - wmaFull[i]);
  const hma = calcWMAValues(raw, sqrtP);
  const startIdx = period - 1 + sqrtP - 1;
  return hma.map((v, i) => ({ time: bars[startIdx + i].time, value: v }));
}

// ── DEMA (Double EMA) ─────────────────────────────────────────────

export function calcDEMA(bars: KlineBar[], period: number): { time: number; value: number }[] {
  if (bars.length < period * 2) return [];
  const ema1  = calcEMA(bars, period);
  const ema2v = calcEMAValues(ema1.map(d => d.value), period);
  const startIdx = 2 * period - 2;
  return ema2v.map((e2, i) => ({
    time: bars[startIdx + i].time,
    value: 2 * ema1[period - 1 + i].value - e2,
  }));
}

// ── TEMA (Triple EMA) ─────────────────────────────────────────────

export function calcTEMA(bars: KlineBar[], period: number): { time: number; value: number }[] {
  if (bars.length < period * 3) return [];
  const ema1  = calcEMA(bars, period);
  const ema2v = calcEMAValues(ema1.map(d => d.value), period);
  const ema3v = calcEMAValues(ema2v, period);
  const startIdx = 3 * period - 3;
  return ema3v.map((e3, i) => ({
    time: bars[startIdx + i].time,
    value: 3 * ema1[2 * period - 2 + i].value - 3 * ema2v[period - 1 + i] + e3,
  }));
}

// ── Keltner Channels ─────────────────────────────────────────────

export function calcKeltner(bars: KlineBar[], period = 20, atrPeriod = 10, multiplier = 2): {
  upper: { time: number; value: number }[];
  middle: { time: number; value: number }[];
  lower: { time: number; value: number }[];
} {
  const ema    = calcEMA(bars, period);
  const atr    = calcATR(bars, atrPeriod);
  const atrMap = new Map(atr.map(d => [d.time, d.value]));
  const upper: { time: number; value: number }[] = [];
  const middle: { time: number; value: number }[] = [];
  const lower:  { time: number; value: number }[] = [];
  for (const e of ema) {
    const a = atrMap.get(e.time);
    if (a !== undefined) {
      middle.push({ time: e.time, value: e.value });
      upper.push({ time: e.time, value: e.value + multiplier * a });
      lower.push({ time: e.time, value: e.value - multiplier * a });
    }
  }
  return { upper, middle, lower };
}

// ── Donchian Channels ─────────────────────────────────────────────

export function calcDonchian(bars: KlineBar[], period = 20): {
  upper: { time: number; value: number }[];
  middle: { time: number; value: number }[];
  lower: { time: number; value: number }[];
} {
  const upper: { time: number; value: number }[] = [];
  const middle: { time: number; value: number }[] = [];
  const lower:  { time: number; value: number }[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    const hi = Math.max(...slice.map(b => b.high));
    const lo = Math.min(...slice.map(b => b.low));
    upper.push({ time: bars[i].time, value: hi });
    lower.push({ time: bars[i].time, value: lo });
    middle.push({ time: bars[i].time, value: (hi + lo) / 2 });
  }
  return { upper, middle, lower };
}

export function calcVolumeProfile(bars: KlineBar[], buckets = 24): { price: number; volume: number; pct: number }[] {
  if (!bars.length) return [];
  const high = Math.max(...bars.map(b => b.high));
  const low  = Math.min(...bars.map(b => b.low));
  const range = high - low;
  if (range === 0) return [];
  const size = range / buckets;
  const vols = Array(buckets).fill(0);
  for (const b of bars) {
    const idx = Math.min(Math.floor((b.close - low) / size), buckets - 1);
    vols[idx] += b.volume;
  }
  const maxVol = Math.max(...vols);
  return vols.map((vol, i) => ({
    price: low + (i + 0.5) * size,
    volume: vol,
    pct: maxVol > 0 ? (vol / maxVol) * 100 : 0,
  }));
}

// ── Position drawing tool ──────────────────────────────────────────

export interface PositionTool {
  id: number;
  side: "long" | "short";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  accountSize: number;
  riskPct: number;
  symbol: string;
  createdAt: number;
}

const POSITIONS_KEY = "chart_positions_v1";

export function loadPositions(): PositionTool[] {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    return raw ? (JSON.parse(raw) as PositionTool[]) : [];
  } catch { return []; }
}

export function savePositions(positions: PositionTool[]): void {
  try { localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions)); } catch { /* ignore */ }
}
