import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useCreateStrategy, useCreateBacktest, getListStrategiesQueryKey, getListBacktestsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, ArrowRight, Play, Save, TrendingUp, Activity, BarChart3,
  Zap, Target, GripVertical, Plus, X, ChevronRight, Cpu, Check,
  Triangle, Crosshair, Waves, BarChart2, Flame, RefreshCw, Sun, GitMerge, Star,
} from "lucide-react";
import { format, subYears } from "date-fns";

type StrategyType =
  | "sma_crossover" | "ema_crossover" | "rsi" | "macd" | "bollinger_bands"
  | "super_trend" | "breakout" | "vwap" | "macd_rsi" | "donchian_breakout"
  | "bollinger_reversal" | "orb" | "trend_following" | "golden_cross" | "turtle_trading";
type ConditionZone = "entry" | "exit";

interface ConditionCard {
  id: string;
  zone: ConditionZone;
  indicatorType: string;
  label: string;
  color: string;
}

interface StrategyDef {
  type: StrategyType;
  name: string;
  shortName: string;
  Icon: React.ElementType;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  description: string;
  longDesc: string;
  defaultParams: Record<string, number>;
  paramConfig: { key: string; label: string; min: number; max: number; step: number; unit?: string }[];
  entryConditions: (p: Record<string, number>) => { label: string; color: string }[];
  exitConditions: (p: Record<string, number>) => { label: string; color: string }[];
  logicSummary: (p: Record<string, number>) => string;
}

const STRATEGY_DEFS: StrategyDef[] = [
  {
    type: "sma_crossover",
    name: "SMA Crossover",
    shortName: "SMA",
    Icon: TrendingUp,
    color: "#6366f1",
    gradientFrom: "#6366f1",
    gradientTo: "#8b5cf6",
    description: "Golden/death cross via Simple Moving Averages",
    longDesc: "Generates buy signals when a fast SMA crosses above a slower SMA (golden cross) and sell signals when it crosses below (death cross). Classic trend-following.",
    defaultParams: { fastPeriod: 10, slowPeriod: 50 },
    paramConfig: [
      { key: "fastPeriod", label: "Fast Period", min: 2, max: 50, step: 1 },
      { key: "slowPeriod", label: "Slow Period", min: 10, max: 200, step: 1 },
    ],
    entryConditions: (p) => [
      { label: `SMA(${p.fastPeriod}) crosses ABOVE SMA(${p.slowPeriod})`, color: "#22c55e" },
    ],
    exitConditions: (p) => [
      { label: `SMA(${p.fastPeriod}) crosses BELOW SMA(${p.slowPeriod})`, color: "#ef4444" },
    ],
    logicSummary: (p) => `Buy when SMA(${p.fastPeriod}) > SMA(${p.slowPeriod}), sell on reversal`,
  },
  {
    type: "ema_crossover",
    name: "EMA Crossover",
    shortName: "EMA",
    Icon: Activity,
    color: "#0ea5e9",
    gradientFrom: "#0ea5e9",
    gradientTo: "#3b82f6",
    description: "Responsive crossover using Exponential Moving Averages",
    longDesc: "Like SMA crossover but EMAs react faster to recent price changes, reducing lag. Better for volatile assets. Uses exponential weighting giving more importance to recent data.",
    defaultParams: { fastPeriod: 9, slowPeriod: 21 },
    paramConfig: [
      { key: "fastPeriod", label: "Fast Period", min: 2, max: 50, step: 1 },
      { key: "slowPeriod", label: "Slow Period", min: 10, max: 200, step: 1 },
    ],
    entryConditions: (p) => [
      { label: `EMA(${p.fastPeriod}) crosses ABOVE EMA(${p.slowPeriod})`, color: "#22c55e" },
    ],
    exitConditions: (p) => [
      { label: `EMA(${p.fastPeriod}) crosses BELOW EMA(${p.slowPeriod})`, color: "#ef4444" },
    ],
    logicSummary: (p) => `Buy when EMA(${p.fastPeriod}) > EMA(${p.slowPeriod}), sell on reversal`,
  },
  {
    type: "rsi",
    name: "RSI Mean Reversion",
    shortName: "RSI",
    Icon: BarChart3,
    color: "#f59e0b",
    gradientFrom: "#f59e0b",
    gradientTo: "#ef4444",
    description: "Buy oversold conditions, sell overbought",
    longDesc: "Uses the Relative Strength Index to identify overbought (>70) and oversold (<30) conditions. Enter on oversold recovery, exit at overbought. Great for ranging markets.",
    defaultParams: { period: 14, oversold: 30, overbought: 70 },
    paramConfig: [
      { key: "period", label: "RSI Period", min: 2, max: 50, step: 1 },
      { key: "oversold", label: "Oversold Level", min: 10, max: 40, step: 1 },
      { key: "overbought", label: "Overbought Level", min: 60, max: 90, step: 1 },
    ],
    entryConditions: (p) => [
      { label: `RSI(${p.period}) crosses ABOVE oversold (${p.oversold})`, color: "#22c55e" },
    ],
    exitConditions: (p) => [
      { label: `RSI(${p.period}) reaches overbought (${p.overbought})`, color: "#ef4444" },
    ],
    logicSummary: (p) => `Enter when RSI(${p.period}) rebounds from <${p.oversold}, exit at >${p.overbought}`,
  },
  {
    type: "macd",
    name: "MACD Momentum",
    shortName: "MACD",
    Icon: Zap,
    color: "#10b981",
    gradientFrom: "#10b981",
    gradientTo: "#06b6d4",
    description: "Momentum divergence with histogram signal",
    longDesc: "Moving Average Convergence Divergence. Buy when the MACD line crosses above the signal line and the histogram turns positive. Captures momentum shifts in trending markets.",
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    paramConfig: [
      { key: "fastPeriod", label: "Fast EMA", min: 3, max: 30, step: 1 },
      { key: "slowPeriod", label: "Slow EMA", min: 10, max: 60, step: 1 },
      { key: "signalPeriod", label: "Signal EMA", min: 3, max: 20, step: 1 },
    ],
    entryConditions: (p) => [
      { label: `MACD line crosses ABOVE signal line`, color: "#22c55e" },
      { label: `Histogram turns POSITIVE`, color: "#22c55e" },
    ],
    exitConditions: (p) => [
      { label: `MACD line crosses BELOW signal line`, color: "#ef4444" },
      { label: `Histogram turns NEGATIVE`, color: "#ef4444" },
    ],
    logicSummary: (p) => `EMA(${p.fastPeriod})-EMA(${p.slowPeriod}) MACD cross with Signal(${p.signalPeriod})`,
  },
  {
    type: "bollinger_bands",
    name: "Bollinger Bands",
    shortName: "BB",
    Icon: Target,
    color: "#ec4899",
    gradientFrom: "#ec4899",
    gradientTo: "#a855f7",
    description: "Volatility-based mean reversion at band extremes",
    longDesc: "Uses standard deviation bands around a SMA. Enter when price bounces off the lower band (oversold), exit when price reaches the upper band. Best in ranging/oscillating markets.",
    defaultParams: { period: 20, stdDev: 2 },
    paramConfig: [
      { key: "period", label: "BB Period", min: 5, max: 50, step: 1 },
      { key: "stdDev", label: "Std Deviation", min: 1, max: 4, step: 0.5 },
    ],
    entryConditions: (p) => [
      { label: `Price bounces off LOWER band (−${p.stdDev}σ)`, color: "#22c55e" },
      { label: `Close crosses ABOVE lower band`, color: "#22c55e" },
    ],
    exitConditions: (p) => [
      { label: `Price touches UPPER band (+${p.stdDev}σ)`, color: "#ef4444" },
    ],
    logicSummary: (p) => `SMA(${p.period}) ± ${p.stdDev}σ bands — buy bounce, sell at upper`,
  },
  {
    type: "super_trend",
    name: "SuperTrend",
    shortName: "ST",
    Icon: Triangle,
    color: "#f97316",
    gradientFrom: "#f97316",
    gradientTo: "#ef4444",
    description: "ATR-based dynamic support/resistance trend filter",
    longDesc: "SuperTrend uses Average True Range to plot dynamic support and resistance levels. When price closes above the SuperTrend line, go long; below it, exit. Excellent for trending markets.",
    defaultParams: { period: 10, multiplier: 3 },
    paramConfig: [
      { key: "period", label: "ATR Period", min: 5, max: 30, step: 1 },
      { key: "multiplier", label: "ATR Multiplier", min: 1, max: 6, step: 0.5 },
    ],
    entryConditions: (p) => [
      { label: `Price closes ABOVE SuperTrend(${p.period}, ${p.multiplier}x ATR)`, color: "#22c55e" },
    ],
    exitConditions: (p) => [
      { label: `Price closes BELOW SuperTrend line`, color: "#ef4444" },
    ],
    logicSummary: (p) => `ATR(${p.period}) × ${p.multiplier} SuperTrend band flip`,
  },
  {
    type: "breakout",
    name: "Price Breakout",
    shortName: "BRK",
    Icon: Crosshair,
    color: "#0ea5e9",
    gradientFrom: "#0ea5e9",
    gradientTo: "#6366f1",
    description: "Enter on decisive breaks above recent highs",
    longDesc: "Buy when price breaks above the highest high of the lookback period by a configurable threshold. Exit when price drops below the period low. Captures explosive breakout moves.",
    defaultParams: { period: 20, threshold: 2 },
    paramConfig: [
      { key: "period", label: "Lookback Period", min: 5, max: 60, step: 1 },
      { key: "threshold", label: "Threshold (%)", min: 0.5, max: 10, step: 0.5 },
    ],
    entryConditions: (p) => [
      { label: `Close breaks ${p.threshold}% above ${p.period}-bar high`, color: "#22c55e" },
    ],
    exitConditions: (p) => [
      { label: `Close drops below ${p.period}-bar low`, color: "#ef4444" },
    ],
    logicSummary: (p) => `${p.period}-bar high breakout with ${p.threshold}% buffer`,
  },
  {
    type: "vwap",
    name: "VWAP Deviation",
    shortName: "VWAP",
    Icon: Waves,
    color: "#14b8a6",
    gradientFrom: "#14b8a6",
    gradientTo: "#0ea5e9",
    description: "Mean-revert from VWAP extremes",
    longDesc: "Volume Weighted Average Price anchors intraday fair value. Buy when price dips significantly below VWAP and rebounds. Sell when price extends too far above VWAP. Ideal for mean-reversion setups.",
    defaultParams: { threshold: 2 },
    paramConfig: [
      { key: "threshold", label: "Deviation Threshold (%)", min: 0.5, max: 8, step: 0.5 },
    ],
    entryConditions: (_p) => [
      { label: `Price falls ${_p.threshold}% below VWAP then recovers`, color: "#22c55e" },
    ],
    exitConditions: (_p) => [
      { label: `Price rises ${_p.threshold}% above VWAP`, color: "#ef4444" },
    ],
    logicSummary: (p) => `VWAP ± ${p.threshold}% deviation mean-reversion`,
  },
  {
    type: "macd_rsi",
    name: "MACD + RSI Combo",
    shortName: "M+R",
    Icon: GitMerge,
    color: "#a855f7",
    gradientFrom: "#a855f7",
    gradientTo: "#ec4899",
    description: "Dual-filter: MACD momentum + RSI confirmation",
    longDesc: "Combines MACD crossover signal with RSI confirmation. Only enters when MACD crosses bullish AND RSI is in a favorable zone. Reduces false signals significantly compared to using either alone.",
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, rsiPeriod: 14, oversold: 40, overbought: 60 },
    paramConfig: [
      { key: "fastPeriod", label: "MACD Fast EMA", min: 3, max: 20, step: 1 },
      { key: "slowPeriod", label: "MACD Slow EMA", min: 10, max: 60, step: 1 },
      { key: "signalPeriod", label: "MACD Signal", min: 3, max: 20, step: 1 },
      { key: "rsiPeriod", label: "RSI Period", min: 5, max: 30, step: 1 },
      { key: "oversold", label: "RSI Oversold", min: 20, max: 50, step: 1 },
      { key: "overbought", label: "RSI Overbought", min: 50, max: 80, step: 1 },
    ],
    entryConditions: (p) => [
      { label: `MACD(${p.fastPeriod},${p.slowPeriod}) bullish cross`, color: "#22c55e" },
      { label: `RSI(${p.rsiPeriod}) rising above ${p.oversold}`, color: "#22c55e" },
    ],
    exitConditions: (p) => [
      { label: `MACD bearish cross OR RSI above ${p.overbought}`, color: "#ef4444" },
    ],
    logicSummary: (p) => `MACD(${p.fastPeriod},${p.slowPeriod},${p.signalPeriod}) + RSI(${p.rsiPeriod}) dual filter`,
  },
  {
    type: "donchian_breakout",
    name: "Donchian Breakout",
    shortName: "DCH",
    Icon: BarChart2,
    color: "#f59e0b",
    gradientFrom: "#f59e0b",
    gradientTo: "#f97316",
    description: "Channel breakout from N-period highs and lows",
    longDesc: "Donchian Channels plot the highest high and lowest low over N periods. Enter long on new channel highs, exit on new channel lows. A pure price-action breakout system with no indicator lag.",
    defaultParams: { period: 20 },
    paramConfig: [
      { key: "period", label: "Channel Period", min: 5, max: 100, step: 1 },
    ],
    entryConditions: (p) => [
      { label: `Price breaks ABOVE ${p.period}-period Donchian high`, color: "#22c55e" },
    ],
    exitConditions: (p) => [
      { label: `Price breaks BELOW ${p.period}-period Donchian low`, color: "#ef4444" },
    ],
    logicSummary: (p) => `${p.period}-period Donchian channel breakout`,
  },
  {
    type: "bollinger_reversal",
    name: "Bollinger Reversal",
    shortName: "BBR",
    Icon: RefreshCw,
    color: "#06b6d4",
    gradientFrom: "#06b6d4",
    gradientTo: "#0ea5e9",
    description: "Strong reversal signals at Bollinger Band extremes",
    longDesc: "Pure mean-reversion approach using Bollinger Bands. Unlike the standard BB strategy, this waits for price to actually pierce the band and then reverse — requiring stronger confirmation before entry.",
    defaultParams: { period: 20, stdDev: 2.5 },
    paramConfig: [
      { key: "period", label: "BB Period", min: 5, max: 50, step: 1 },
      { key: "stdDev", label: "Std Deviation", min: 1.5, max: 4, step: 0.5 },
    ],
    entryConditions: (p) => [
      { label: `Price pierces BELOW lower band (${p.stdDev}σ) then reverses`, color: "#22c55e" },
    ],
    exitConditions: (p) => [
      { label: `Price pierces ABOVE upper band (${p.stdDev}σ)`, color: "#ef4444" },
    ],
    logicSummary: (p) => `BB(${p.period}, ${p.stdDev}σ) piercing reversal`,
  },
  {
    type: "orb",
    name: "Opening Range Breakout",
    shortName: "ORB",
    Icon: Sun,
    color: "#eab308",
    gradientFrom: "#eab308",
    gradientTo: "#f97316",
    description: "Trade breakouts from the early session range",
    longDesc: "Defines the Opening Range as the high/low of the first N minutes. Enter when price breaks above (long) or below (short) that range. A classic intraday momentum strategy used by professionals.",
    defaultParams: { rangeMinutes: 30, multiplier: 1 },
    paramConfig: [
      { key: "rangeMinutes", label: "Range Minutes", min: 5, max: 120, step: 5 },
      { key: "multiplier", label: "ATR Target Multiplier", min: 0.5, max: 3, step: 0.5 },
    ],
    entryConditions: (p) => [
      { label: `Price breaks above ${p.rangeMinutes}-min opening range high`, color: "#22c55e" },
    ],
    exitConditions: (p) => [
      { label: `ATR-based target (${p.multiplier}x) or range low hit`, color: "#ef4444" },
    ],
    logicSummary: (p) => `${p.rangeMinutes}-min ORB with ${p.multiplier}x ATR target`,
  },
  {
    type: "trend_following",
    name: "Trend Following",
    shortName: "TRF",
    Icon: Flame,
    color: "#22c55e",
    gradientFrom: "#22c55e",
    gradientTo: "#14b8a6",
    description: "Triple EMA trend filter with momentum confirmation",
    longDesc: "Uses two EMAs to confirm trend direction. Enter when the fast EMA is above the slow EMA and price is rising. Rides the trend until the EMAs cross back. Best in strongly trending markets.",
    defaultParams: { fastPeriod: 10, slowPeriod: 50 },
    paramConfig: [
      { key: "fastPeriod", label: "Fast EMA", min: 3, max: 30, step: 1 },
      { key: "slowPeriod", label: "Slow EMA", min: 20, max: 200, step: 5 },
    ],
    entryConditions: (p) => [
      { label: `EMA(${p.fastPeriod}) > EMA(${p.slowPeriod}) — uptrend confirmed`, color: "#22c55e" },
    ],
    exitConditions: (p) => [
      { label: `EMA(${p.fastPeriod}) crosses BELOW EMA(${p.slowPeriod})`, color: "#ef4444" },
    ],
    logicSummary: (p) => `EMA(${p.fastPeriod}) / EMA(${p.slowPeriod}) trend alignment`,
  },
  {
    type: "golden_cross",
    name: "Golden Cross",
    shortName: "GC",
    Icon: Star,
    color: "#fbbf24",
    gradientFrom: "#fbbf24",
    gradientTo: "#f59e0b",
    description: "Classic 50/200 MA bull signal",
    longDesc: "The most well-known long-term trend signal. A Golden Cross occurs when the 50-period MA crosses above the 200-period MA, signaling a long-term bullish shift. Death cross is the bearish opposite.",
    defaultParams: { fastPeriod: 50, slowPeriod: 200 },
    paramConfig: [
      { key: "fastPeriod", label: "Fast MA Period", min: 20, max: 100, step: 5 },
      { key: "slowPeriod", label: "Slow MA Period", min: 100, max: 400, step: 10 },
    ],
    entryConditions: (p) => [
      { label: `MA(${p.fastPeriod}) crosses ABOVE MA(${p.slowPeriod}) — Golden Cross`, color: "#22c55e" },
    ],
    exitConditions: (p) => [
      { label: `MA(${p.fastPeriod}) crosses BELOW MA(${p.slowPeriod}) — Death Cross`, color: "#ef4444" },
    ],
    logicSummary: (p) => `Golden Cross MA(${p.fastPeriod})/MA(${p.slowPeriod})`,
  },
  {
    type: "turtle_trading",
    name: "Turtle Trading",
    shortName: "TRT",
    Icon: Activity,
    color: "#10b981",
    gradientFrom: "#10b981",
    gradientTo: "#059669",
    description: "Richard Dennis's legendary trend system",
    longDesc: "The Turtle Trading system uses two Donchian channels: a longer entry channel and a shorter exit channel. Enter on 20-day breakouts, exit on 10-day reversals. Risk is managed via ATR position sizing.",
    defaultParams: { entryPeriod: 20, exitPeriod: 10 },
    paramConfig: [
      { key: "entryPeriod", label: "Entry Period", min: 10, max: 60, step: 5 },
      { key: "exitPeriod", label: "Exit Period", min: 5, max: 30, step: 5 },
    ],
    entryConditions: (p) => [
      { label: `Price breaks ${p.entryPeriod}-day high (System 1)`, color: "#22c55e" },
    ],
    exitConditions: (p) => [
      { label: `Price breaks ${p.exitPeriod}-day low`, color: "#ef4444" },
    ],
    logicSummary: (p) => `Turtle ${p.entryPeriod}-day entry / ${p.exitPeriod}-day exit`,
  },
];

const SYMBOLS = ["AAPL", "MSFT", "TSLA", "BTC/USD", "ETH/USD", "SPY", "QQQ", "NVDA", "AMZN", "GOOGL"];

function SliderInput({ value, min, max, step, onChange }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative flex items-center gap-3">
      <div className="relative flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${pct}%`, background: "hsl(var(--primary))" }}
        />
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-background"
          style={{
            left: `calc(${pct}% - 7px)`,
            background: "hsl(var(--primary))",
            boxShadow: "0 0 8px hsl(var(--primary)/0.5)",
          }}
        />
      </div>
      <span className="w-10 text-right text-xs font-mono font-semibold" style={{ color: "hsl(var(--primary))" }}>{value}</span>
    </div>
  );
}

export default function BacktestBuilder() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const createStrategy = useCreateStrategy();
  const createBacktest = useCreateBacktest();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedType, setSelectedType] = useState<StrategyType>("sma_crossover");
  const [params, setParams] = useState<Record<string, number>>(STRATEGY_DEFS[0].defaultParams);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("AAPL");
  const [timeframe, setTimeframe] = useState("1d");
  const [startDate, setStartDate] = useState(format(subYears(new Date(), 2), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [initialCapital, setInitialCapital] = useState(100000);
  const [isRunning, setIsRunning] = useState(false);

  // MED-009: Restore form state from sessionStorage on mount
  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem("builder_state");
      if (!saved) return;
      const s = JSON.parse(saved) as {
        selectedType?: string; params?: Record<string, number>;
        name?: string; symbol?: string; timeframe?: string;
        startDate?: string; endDate?: string; initialCapital?: number;
      };
      if (s.selectedType && STRATEGY_DEFS.some(d => d.type === s.selectedType)) {
        setSelectedType(s.selectedType as StrategyType);
      }
      if (s.params) setParams(s.params);
      if (s.name) setName(s.name);
      if (s.symbol) setSymbol(s.symbol);
      if (s.timeframe) setTimeframe(s.timeframe);
      if (s.startDate) setStartDate(s.startDate);
      if (s.endDate) setEndDate(s.endDate);
      if (typeof s.initialCapital === "number") setInitialCapital(s.initialCapital);
    } catch { }
  }, []);

  // MED-009: Persist form state to sessionStorage on every change
  React.useEffect(() => {
    try {
      sessionStorage.setItem("builder_state", JSON.stringify({
        selectedType, params, name, symbol, timeframe, startDate, endDate, initialCapital,
      }));
    } catch { }
  }, [selectedType, params, name, symbol, timeframe, startDate, endDate, initialCapital]);

  // Drag state for condition reordering
  const [draggedCondition, setDraggedCondition] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<ConditionZone | null>(null);
  const [highlightedPalette, setHighlightedPalette] = useState<string | null>(null);

  const def = STRATEGY_DEFS.find((d) => d.type === selectedType) ?? STRATEGY_DEFS[0];

  function selectStrategy(type: StrategyType) {
    const d = STRATEGY_DEFS.find((x) => x.type === type)!;
    setSelectedType(type);
    setParams(d.defaultParams);
    if (!name) setName(`My ${d.name} Strategy`);
  }

  function updateParam(key: string, value: number) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  async function handleSaveAndRun() {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!name.trim()) {
      toast({ title: "Name required", description: "Please enter a strategy name.", variant: "destructive" });
      return;
    }
    setIsRunning(true);
    try {
      const strategy = await new Promise<{ id: number }>((resolve, reject) => {
        createStrategy.mutate(
          { data: { name: name.trim(), type: selectedType, symbol, timeframe: timeframe as any, parameters: params, description: def.logicSummary(params) } as any },
          { onSuccess: resolve, onError: reject }
        );
      });
      queryClient.invalidateQueries({ queryKey: getListStrategiesQueryKey() });

      const backtest = await new Promise<{ id: number }>((resolve, reject) => {
        createBacktest.mutate(
          { data: { strategyId: strategy.id, symbol, startDate, endDate, initialCapital } },
          { onSuccess: resolve, onError: reject }
        );
      });
      queryClient.invalidateQueries({ queryKey: getListBacktestsQueryKey() });

      toast({ title: "Backtest started!", description: `Running ${name}...` });
      try { sessionStorage.removeItem("builder_state"); } catch { }
      setLocation(`/backtests/${backtest.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? err?.message ?? "Something went wrong", variant: "destructive" });
    } finally {
      setIsRunning(false);
    }
  }

  async function handleSaveOnly() {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!name.trim()) {
      toast({ title: "Name required", description: "Please enter a strategy name.", variant: "destructive" });
      return;
    }
    createStrategy.mutate(
      { data: { name: name.trim(), type: selectedType, symbol, timeframe: timeframe as any, parameters: params, description: def.logicSummary(params) } as any },
      {
        onSuccess: (strategy: { id: number }) => {
          queryClient.invalidateQueries({ queryKey: getListStrategiesQueryKey() });
          toast({ title: "Strategy saved!", description: `${name} created.` });
          setLocation(`/strategies/${strategy.id}`);
        },
        onError: (err: { data?: { error?: string } | null }) => toast({ title: "Error", description: err.data?.error ?? "Failed", variant: "destructive" }),
      }
    );
  }

  const entryConditions = def.entryConditions(params);
  const exitConditions = def.exitConditions(params);

  const stepLabels = ["Choose Strategy", "Configure Logic", "Run Settings"];

  return (
    <motion.div
      className="space-y-6 max-w-7xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/backtests"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Strategy Builder</h1>
          <p className="text-muted-foreground">Visually compose your trading strategy with drag-drop conditions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono">VISUAL BUILDER</span>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {stepLabels.map((label, i) => {
          const s = i + 1;
          const isActive = step === s;
          const isDone = step > s;
          return (
            <React.Fragment key={s}>
              <button
                onClick={() => s < step && setStep(s as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive ? "bg-primary/15 text-primary" : isDone ? "text-green-500 cursor-pointer hover:bg-green-500/10" : "text-muted-foreground cursor-default"
                }`}
              >
                <span className={`flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-bold ${
                  isActive ? "bg-primary text-white" : isDone ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {isDone ? <Check className="h-3 w-3" /> : s}
                </span>
                {label}
              </button>
              {i < stepLabels.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1 shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1: Choose Strategy Type */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Select the base logic for your strategy. Each type uses a different set of technical indicators.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {STRATEGY_DEFS.map((d) => {
              const isSelected = selectedType === d.type;
              return (
                <button
                  key={d.type}
                  onClick={() => selectStrategy(d.type)}
                  className="relative text-left p-5 rounded-xl border transition-all duration-200 group hover:scale-[1.03] hover:shadow-lg"
                  style={{
                    background: isSelected
                      ? `linear-gradient(135deg, ${d.gradientFrom}18, ${d.gradientTo}10)`
                      : "var(--card-bg)",
                    borderColor: isSelected ? d.color : "hsl(var(--border))",
                    boxShadow: isSelected ? `0 0 0 1px ${d.color}40, 0 4px 24px ${d.color}20` : undefined,
                  }}
                >
                  {isSelected && (
                    <span
                      className="absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center"
                      style={{ background: d.color }}
                    >
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  )}
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110"
                    style={{ background: `${d.color}20`, color: d.color }}
                  >
                    <d.Icon className="h-5 w-5" />
                  </div>
                  <div className="font-semibold text-sm mb-1">{d.name}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{d.description}</div>
                </button>
              );
            })}
          </div>

          {/* Strategy detail card */}
          <div
            className="p-5 rounded-xl border glass-panel"
            style={{
              background: `linear-gradient(135deg, ${def.gradientFrom}10, ${def.gradientTo}08)`,
              borderColor: `${def.color}30`,
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${def.color}20`, color: def.color }}
              >
                <def.Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold mb-1">{def.name}</div>
                <p className="text-sm text-muted-foreground">{def.longDesc}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => { selectStrategy(selectedType); setStep(2); }}>
              Configure Conditions <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Configure Conditions */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Indicator palette */}
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Indicator Library
              </div>
              <div className="space-y-2">
                {STRATEGY_DEFS.map((d) => (
                  <div
                    key={d.type}
                    draggable
                    onDragStart={() => setHighlightedPalette(d.type)}
                    onDragEnd={() => setHighlightedPalette(null)}
                    onClick={() => selectStrategy(d.type)}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-150 select-none"
                    style={{
                      background: selectedType === d.type
                        ? `${d.color}15`
                        : highlightedPalette === d.type
                        ? `${d.color}20`
                        : "var(--card-bg)",
                      borderColor: selectedType === d.type ? d.color : "hsl(var(--border))",
                    }}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    <div
                      className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${d.color}20`, color: d.color }}
                    >
                      <d.Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.shortName}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{d.name}</div>
                    </div>
                    {selectedType === d.type && (
                      <Badge variant="secondary" className="text-[10px] shrink-0" style={{ color: d.color, borderColor: `${d.color}40` }}>
                        ACTIVE
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Click any indicator to switch the active strategy type.</p>
            </div>

            {/* Center: Conditions canvas */}
            <div className="lg:col-span-2 space-y-4">
              {/* Parameters */}
              <div
                className="p-4 rounded-xl border"
                style={{ background: `${def.color}08`, borderColor: `${def.color}25` }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="h-6 w-6 rounded-md flex items-center justify-center"
                    style={{ background: `${def.color}20`, color: def.color }}
                  >
                    <def.Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-semibold">{def.name} — Parameters</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {def.paramConfig.map((pc) => (
                    <div key={pc.key}>
                      <div className="flex justify-between mb-2">
                        <span className="text-xs text-muted-foreground">{pc.label}</span>
                      </div>
                      <SliderInput
                        value={params[pc.key] ?? pc.min}
                        min={pc.min}
                        max={pc.max}
                        step={pc.step}
                        onChange={(v) => updateParam(pc.key, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Entry conditions */}
              <div
                className="p-4 rounded-xl border-2 border-dashed transition-all"
                style={{
                  borderColor: dragOverZone === "entry" ? "#22c55e80" : "#22c55e30",
                  background: dragOverZone === "entry" ? "#22c55e08" : "transparent",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOverZone("entry"); }}
                onDragLeave={() => setDragOverZone(null)}
                onDrop={(e) => { e.preventDefault(); setDragOverZone(null); if (highlightedPalette) selectStrategy(highlightedPalette as StrategyType); }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-green-500">Entry Conditions</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">Drop indicator to switch strategy</span>
                </div>
                <div className="space-y-2">
                  {entryConditions.map((cond, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg border"
                      style={{ background: "#22c55e10", borderColor: "#22c55e30" }}
                    >
                      <GripVertical className="h-4 w-4 text-green-500/40 shrink-0 cursor-grab" />
                      <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                      <span className="text-sm font-mono text-green-400">{cond.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Exit conditions */}
              <div
                className="p-4 rounded-xl border-2 border-dashed transition-all"
                style={{
                  borderColor: dragOverZone === "exit" ? "#ef444480" : "#ef444430",
                  background: dragOverZone === "exit" ? "#ef444408" : "transparent",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOverZone("exit"); }}
                onDragLeave={() => setDragOverZone(null)}
                onDrop={(e) => { e.preventDefault(); setDragOverZone(null); if (highlightedPalette) selectStrategy(highlightedPalette as StrategyType); }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-red-500">Exit Conditions</span>
                </div>
                <div className="space-y-2">
                  {exitConditions.map((cond, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg border"
                      style={{ background: "#ef444410", borderColor: "#ef444430" }}
                    >
                      <GripVertical className="h-4 w-4 text-red-500/40 shrink-0 cursor-grab" />
                      <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                      <span className="text-sm font-mono text-red-400">{cond.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Logic summary */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider mr-2">Logic:</span>
                <span className="text-xs font-mono">{def.logicSummary(params)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button onClick={() => setStep(3)}>
              Run Settings <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Run Settings */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Strategy summary */}
            <div
              className="p-5 rounded-xl border space-y-4"
              style={{
                background: `linear-gradient(135deg, ${def.gradientFrom}10, ${def.gradientTo}06)`,
                borderColor: `${def.color}30`,
              }}
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Strategy Summary</div>
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${def.color}20`, color: def.color }}
                >
                  <def.Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">{def.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{def.logicSummary(params)}</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground mb-1">Parameters</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(params).map(([k, v]) => (
                    <div key={k} className="flex justify-between p-2 rounded-lg bg-background/50 border border-border">
                      <span className="text-xs text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="text-xs font-mono font-semibold">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">Entry</div>
                {entryConditions.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                    <span className="text-xs font-mono text-green-400">{c.label}</span>
                  </div>
                ))}
                <div className="text-xs font-medium text-muted-foreground mt-2">Exit</div>
                {exitConditions.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                    <span className="text-xs font-mono text-red-400">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Settings form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Strategy Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`My ${def.name} Strategy`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Symbol</label>
                  <Select value={symbol} onValueChange={setSymbol}>
                    <SelectTrigger className="font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYMBOLS.map((s) => (
                        <SelectItem key={s} value={s} className="font-mono">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Timeframe</label>
                  <Select value={timeframe} onValueChange={setTimeframe}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">1 Hour</SelectItem>
                      <SelectItem value="4h">4 Hours</SelectItem>
                      <SelectItem value="1d">Daily</SelectItem>
                      <SelectItem value="1w">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="font-mono" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Initial Capital ($)</label>
                <Input
                  type="number"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Number(e.target.value))}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleSaveOnly} disabled={createStrategy.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Save Strategy
              </Button>
              <Button onClick={handleSaveAndRun} disabled={isRunning}>
                {isRunning ? (
                  <>
                    <div className="mr-2 h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Save & Run Backtest
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
    <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
  );
}
