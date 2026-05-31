import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSimPrice } from "@/lib/use-sim-price";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type IPriceLine,
  type Time,
  type SeriesMarker,
} from "lightweight-charts";
import {
  useGetKlines,
  getGetKlinesQueryKey,
  GetKlinesInterval,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  RefreshCw,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  Clapperboard,
  X,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  MousePointer2,
  Minus,
  GitCommit,
  Hash,
  Eraser,
  Pencil,
  BarChart2,
  Save,
  FolderOpen,
  SplitSquareVertical,
  Trash2,
  Check,
  Layers,
  Flame,
} from "lucide-react";
import {
  calcSMA, calcEMA, calcBB, calcRSI, calcMACD, calcVWAP, calcATR, calcStochastic, generateSimData,
  loadLayouts, saveLayouts, loadIndicators, persistIndicators,
  type DrawnObject, type DrawTool, type DrawStart, type OhlcState,
  type KlineBar, type Position, type SimTrade,
  type IndicatorConfig, type ChartLayout, type SerializableDrawing, type IndicatorId,
} from "@/lib/chart-utils";

// ── Constants ──────────────────────────────────────────────────────────

const SYMBOLS = [
  // ── Crypto ──────────────────────────────────────────────────────
  { value: "BTCUSDT",  label: "BTC/USDT",  category: "Crypto",      sim: false, basePrice: 67420  },
  { value: "ETHUSDT",  label: "ETH/USDT",  category: "Crypto",      sim: false, basePrice: 3521   },
  { value: "SOLUSDT",  label: "SOL/USDT",  category: "Crypto",      sim: false, basePrice: 182    },
  { value: "BNBUSDT",  label: "BNB/USDT",  category: "Crypto",      sim: false, basePrice: 608    },
  { value: "XRPUSDT",  label: "XRP/USDT",  category: "Crypto",      sim: false, basePrice: 0.623  },
  { value: "ADAUSDT",  label: "ADA/USDT",  category: "Crypto",      sim: false, basePrice: 0.457  },
  { value: "DOGEUSDT", label: "DOGE/USDT", category: "Crypto",      sim: false, basePrice: 0.152  },
  { value: "AVAXUSDT", label: "AVAX/USDT", category: "Crypto",      sim: false, basePrice: 36     },
  { value: "LINKUSDT", label: "LINK/USDT", category: "Crypto",      sim: false, basePrice: 18.9   },
  { value: "LTCUSDT",  label: "LTC/USDT",  category: "Crypto",      sim: false, basePrice: 84     },
  { value: "DOTUSDT",  label: "DOT/USDT",  category: "Crypto",      sim: false, basePrice: 7.4    },
  { value: "NEARUSDT", label: "NEAR/USDT", category: "Crypto",      sim: false, basePrice: 5.8    },
  { value: "OPUSDT",   label: "OP/USDT",   category: "Crypto",      sim: false, basePrice: 2.4    },
  { value: "ARBUSDT",  label: "ARB/USDT",  category: "Crypto",      sim: false, basePrice: 1.1    },
  { value: "INJUSDT",  label: "INJ/USDT",  category: "Crypto",      sim: false, basePrice: 28.4   },
  { value: "AAVEUSDT", label: "AAVE/USDT", category: "Crypto",      sim: false, basePrice: 110    },
  // ── Futures ─────────────────────────────────────────────────────
  { value: "BTCPERP",  label: "BTC Perp",  category: "Futures",     sim: true,  basePrice: 67500  },
  { value: "ETHPERP",  label: "ETH Perp",  category: "Futures",     sim: true,  basePrice: 3530   },
  { value: "SOLPERP",  label: "SOL Perp",  category: "Futures",     sim: true,  basePrice: 183    },
  // ── Forex ───────────────────────────────────────────────────────
  { value: "EURUSD",   label: "EUR/USD",   category: "Forex",       sim: true,  basePrice: 1.0825 },
  { value: "GBPUSD",   label: "GBP/USD",   category: "Forex",       sim: true,  basePrice: 1.2685 },
  { value: "USDJPY",   label: "USD/JPY",   category: "Forex",       sim: true,  basePrice: 153.45 },
  { value: "AUDUSD",   label: "AUD/USD",   category: "Forex",       sim: true,  basePrice: 0.6530 },
  { value: "USDCAD",   label: "USD/CAD",   category: "Forex",       sim: true,  basePrice: 1.3680 },
  { value: "USDCHF",   label: "USD/CHF",   category: "Forex",       sim: true,  basePrice: 0.9020 },
  { value: "NZDUSD",   label: "NZD/USD",   category: "Forex",       sim: true,  basePrice: 0.5985 },
  { value: "EURGBP",   label: "EUR/GBP",   category: "Forex",       sim: true,  basePrice: 0.8535 },
  // ── Indices ─────────────────────────────────────────────────────
  { value: "SPX500",   label: "S&P 500",   category: "Indices",     sim: true,  basePrice: 5280   },
  { value: "NAS100",   label: "Nasdaq 100",category: "Indices",     sim: true,  basePrice: 18420  },
  { value: "DOW30",    label: "Dow Jones", category: "Indices",     sim: true,  basePrice: 39500  },
  { value: "UK100",    label: "FTSE 100",  category: "Indices",     sim: true,  basePrice: 8320   },
  { value: "GER40",    label: "DAX 40",    category: "Indices",     sim: true,  basePrice: 18700  },
  { value: "JPN225",   label: "Nikkei 225",category: "Indices",     sim: true,  basePrice: 38200  },
  // ── Commodities ─────────────────────────────────────────────────
  { value: "XAUUSD",   label: "Gold",      category: "Commodities", sim: true,  basePrice: 2320   },
  { value: "XAGUSD",   label: "Silver",    category: "Commodities", sim: true,  basePrice: 27.4   },
  { value: "WTIUSD",   label: "WTI Oil",   category: "Commodities", sim: true,  basePrice: 82.5   },
  { value: "NATGAS",   label: "Nat. Gas",  category: "Commodities", sim: true,  basePrice: 2.1    },
  // ── Stocks ──────────────────────────────────────────────────────
  { value: "AAPL",     label: "Apple",     category: "Stocks",      sim: true,  basePrice: 178    },
  { value: "TSLA",     label: "Tesla",     category: "Stocks",      sim: true,  basePrice: 185    },
  { value: "NVDA",     label: "Nvidia",    category: "Stocks",      sim: true,  basePrice: 880    },
  { value: "MSFT",     label: "Microsoft", category: "Stocks",      sim: true,  basePrice: 420    },
  { value: "AMZN",     label: "Amazon",    category: "Stocks",      sim: true,  basePrice: 188    },
  { value: "GOOGL",    label: "Alphabet",  category: "Stocks",      sim: true,  basePrice: 170    },
] as const;

const INTERVALS = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
];

const SPEEDS = [
  { value: 100, label: "10×" },
  { value: 250, label: "4×" },
  { value: 500, label: "2×" },
  { value: 1000, label: "1×" },
  { value: 2000, label: "0.5×" },
];

const DRAW_COLORS = [
  { value: "hsl(190,90%,55%)", label: "Cyan" },
  { value: "hsl(38,100%,55%)", label: "Amber" },
  { value: "hsl(150,90%,55%)", label: "Green" },
  { value: "hsl(0,85%,62%)", label: "Red" },
  { value: "hsl(260,90%,70%)", label: "Purple" },
  { value: "hsl(200,14%,75%)", label: "White" },
];

const VIRAL_INDICATOR_IDS = ["ema9", "ema20", "ema50", "bb", "vwap", "rsi"] as const;

const CHART_TYPES = [
  { id: "candlestick" as const, label: "C",  title: "Candlestick" },
  { id: "hollow"      as const, label: "HC", title: "Hollow Candle" },
  { id: "heikin_ashi" as const, label: "HA", title: "Heikin Ashi" },
  { id: "line"        as const, label: "L",  title: "Line" },
  { id: "area"        as const, label: "A",  title: "Area" },
  { id: "bar"         as const, label: "B",  title: "Bar" },
] as const;
type ChartType = typeof CHART_TYPES[number]["id"];

const FIB_LEVELS = [
  { pct: 0,     color: "hsl(200,14%,65%)", label: "0%" },
  { pct: 0.236, color: "hsl(200,90%,60%)", label: "23.6%" },
  { pct: 0.382, color: "hsl(150,80%,55%)", label: "38.2%" },
  { pct: 0.5,   color: "hsl(38,100%,55%)", label: "50%" },
  { pct: 0.618, color: "hsl(0,85%,62%)",   label: "61.8%" },
  { pct: 0.786, color: "hsl(260,80%,68%)", label: "78.6%" },
  { pct: 1,     color: "hsl(200,14%,65%)", label: "100%" },
];

const MIN_CANDLES = 30;

function readPtCapital(): number {
  try {
    const v = (JSON.parse(localStorage.getItem("pt_account") || "null") as { initialCapital?: number } | null);
    return v?.initialCapital ?? 10_000;
  } catch { return 10_000; }
}

function savePtTrade(trade: { id: number; entryPrice: number; entryTime: number; exitPrice: number; exitTime: number; units: number; pnl: number; pnlPct: number; side?: string; symbol?: string }) {
  try {
    const prev = JSON.parse(localStorage.getItem("pt_trades") || "[]") as typeof trade[];
    localStorage.setItem("pt_trades", JSON.stringify([...prev, trade]));
  } catch {}
}

function updatePtBalance(balance: number) {
  try {
    const acc = JSON.parse(localStorage.getItem("pt_account") || "null") as Record<string, unknown> | null;
    if (acc) localStorage.setItem("pt_account", JSON.stringify({ ...acc, balance }));
  } catch {}
}

// Shared chart visual config used for main + sub + multitf charts
const CHART_BG = "hsl(222,22%,8%)";
const CHART_TEXT = "hsl(218,12%,52%)";
const CHART_FONT = "'JetBrains Mono', Menlo, monospace";

// ── Helpers ────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 1 ? 6 : 2,
  });
}

function fmtDate(unixSec: number) {
  return new Date(unixSec * 1000).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

function fmtPnl(n: number) {
  return `${n >= 0 ? "+" : ""}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function calcHeikinAshi(bars: { time: number; open: number; high: number; low: number; close: number }[]) {
  const ha: { time: number; open: number; high: number; low: number; close: number }[] = [];
  for (let i = 0; i < bars.length; i++) {
    const close = (bars[i].open + bars[i].high + bars[i].low + bars[i].close) / 4;
    const open  = i === 0 ? (bars[i].open + bars[i].close) / 2 : (ha[i-1].open + ha[i-1].close) / 2;
    const high  = Math.max(bars[i].high, open, close);
    const low   = Math.min(bars[i].low,  open, close);
    ha.push({ time: bars[i].time, open, high, low, close });
  }
  return ha;
}

function makeChartOptions(hideTimeScale = false) {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: CHART_BG },
      textColor: CHART_TEXT,
      fontFamily: CHART_FONT,
      fontSize: 11,
    },
    grid: {
      vertLines: { color: "hsla(220,20%,30%,0.15)" },
      horzLines: { color: "hsla(220,20%,30%,0.15)" },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: "hsla(190,90%,60%,0.6)", width: 1 as const, style: 2, labelBackgroundColor: "hsl(222,28%,12%)" },
      horzLine: { color: "hsla(190,90%,60%,0.6)", width: 1 as const, style: 2, labelBackgroundColor: "hsl(222,28%,12%)" },
    },
    rightPriceScale: { borderColor: "hsla(220,20%,30%,0.3)" },
    timeScale: {
      borderColor: "hsla(220,20%,30%,0.3)",
      timeVisible: true,
      secondsVisible: false,
      visible: !hideTimeScale,
    },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
    handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
  };
}

// ── Component ──────────────────────────────────────────────────────────

export default function ChartPage() {
  // ── Core state ─────────────────────────────────────────────────────
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState<GetKlinesInterval>(GetKlinesInterval["1d"]);
  const [ohlcDisplay, setOhlcDisplay] = useState<OhlcState>(null);

  // Replay
  const [replayMode, setReplayMode] = useState(false);
  const [replayIndex, setReplayIndex] = useState(MIN_CANDLES);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(500);
  const [replaySidebarOpen, setReplaySidebarOpen] = useState(false);

  // Paper trading account
  const [ptCapital, setPtCapital] = useState<number>(readPtCapital);
  const [accountModalOpen, setAccountModalOpen] = useState<boolean>(() => !localStorage.getItem("pt_account"));
  const [customCapitalInput, setCustomCapitalInput] = useState("");

  // Trading sim
  const [position, setPosition] = useState<Position | null>(null);
  const [trades, setTrades] = useState<SimTrade[]>([]);
  const [equity, setEquity] = useState<number>(readPtCapital);

  // Order panel
  const [showOrderPanel, setShowOrderPanel] = useState(true);
  const [chartOrderType, setChartOrderType] = useState<"market" | "limit" | "stop">("market");
  const [chartLimitPrice, setChartLimitPrice] = useState("");
  const [chartStopPrice, setChartStopPrice] = useState("");
  const [chartLeverage, setChartLeverage] = useState(1);
  type PendingChartOrder = { id: number; side: "buy" | "sell"; orderType: "limit" | "stop"; price: number };
  const [pendingChartOrders, setPendingChartOrders] = useState<PendingChartOrder[]>([]);
  const entryPriceLineRef = useRef<import("lightweight-charts").IPriceLine | null>(null);

  // Drawing tools
  const [activeTool, setActiveTool] = useState<DrawTool>("cursor");
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0].value);
  const [drawings, setDrawings] = useState<DrawnObject[]>([]);
  const [drawStart, setDrawStart] = useState<DrawStart | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Doodle canvas
  const doodleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [doodlePaths, setDoodlePaths] = useState<{ points: { x: number; y: number }[]; color: string }[]>([]);
  const isDoodlingRef = useRef(false);
  const currentDoodleRef = useRef<{ x: number; y: number }[]>([]);

  // Chart type
  const [chartType, setChartType] = useState<ChartType>("candlestick");

  // ── Indicators state ───────────────────────────────────────────────
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(loadIndicators);
  const [showIndicators, setShowIndicators] = useState(false);

  // ── Multi-TF state ─────────────────────────────────────────────────
  const [showMultiTf, setShowMultiTf] = useState(false);
  const [multiTfInterval, setMultiTfInterval] = useState<GetKlinesInterval>(GetKlinesInterval["1w"]);

  // ── Layouts state ──────────────────────────────────────────────────
  const [savedLayouts, setSavedLayouts] = useState<ChartLayout[]>(loadLayouts);
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);
  const [layoutNameInput, setLayoutNameInput] = useState("");

  // ── Refs ───────────────────────────────────────────────────────────
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const altSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const sortedKlinesRef = useRef<KlineBar[]>([]);
  const markersRef = useRef<SeriesMarker<Time>[]>([]);
  const drawingsRef = useRef<DrawnObject[]>([]);
  const indicatorPanelRef = useRef<HTMLDivElement>(null);

  // Indicator overlay series (on main chart)
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line"> | ISeriesApi<"Line">[]>>(new Map());

  // Sub-chart (RSI / MACD)
  const subChartContainerRef = useRef<HTMLDivElement>(null);
  const subChartRef = useRef<IChartApi | null>(null);
  const subSeriesRef = useRef<Map<string, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>>(new Map());
  const subPrimarySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Multi-TF chart
  const multiTfContainerRef = useRef<HTMLDivElement>(null);
  const multiTfChartRef = useRef<IChartApi | null>(null);
  const multiTfCandleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Sync guard + layout restore queue
  const isSyncingRef = useRef(false);
  const pendingRestoreRef = useRef<SerializableDrawing[] | null>(null);

  // Replay / position refs for stale-closure access
  const replayIndexRef = useRef(replayIndex);
  const positionRef = useRef(position);
  useEffect(() => { replayIndexRef.current = replayIndex; }, [replayIndex]);
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { drawingsRef.current = drawings; }, [drawings]);

  // Redraw doodle canvas when paths change
  useEffect(() => {
    const canvas = doodleCanvasRef.current;
    const container = chartContainerRef.current;
    if (!canvas || !container) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    doodlePaths.forEach(({ points, color }) => {
      if (points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    });
  }, [doodlePaths]);

  const queryClient = useQueryClient();

  // ── Sim symbol support ─────────────────────────────────────────────
  const currentSymbolDef = SYMBOLS.find(s => s.value === symbol);
  const isSim = currentSymbolDef?.sim ?? false;
  const displayLabel = currentSymbolDef?.label ?? symbol;
  const displayCategory = currentSymbolDef?.category ?? "Crypto";

  const params = { symbol, interval, limit: 500 };

  const { data: apiKlines, isLoading: apiLoading, error: apiError, isFetching } = useGetKlines(params, {
    query: {
      queryKey: getGetKlinesQueryKey(params),
      staleTime: 30_000,
      refetchInterval: replayMode ? false : 60_000,
      enabled: !isSim,
    },
  });

  // For simulated symbols, generate deterministic OHLCV data
  const simBars = useMemo(() => {
    if (!isSim || !currentSymbolDef) return null;
    const intervalSec = interval === "1m" ? 60 : interval === "5m" ? 300 : interval === "15m" ? 900 :
      interval === "1h" ? 3600 : interval === "4h" ? 14400 : interval === "1w" ? 604800 : 86400;
    return generateSimData(symbol, currentSymbolDef.basePrice, 500, intervalSec);
  }, [isSim, symbol, currentSymbolDef, interval]);

  const klines = isSim ? simBars : apiKlines;
  const isLoading = isSim ? false : apiLoading;
  const error = isSim ? null : apiError;

  // Live ticking price for non-replay paper trade P&L
  const lastKlineClose = klines && klines.length > 0 ? klines[klines.length - 1].close : 100;
  const liveChartPrice = useSimPrice(lastKlineClose);

  const multiTfParams = { symbol, interval: multiTfInterval, limit: 300 };
  const { data: multiTfKlines } = useGetKlines(multiTfParams, {
    query: {
      enabled: showMultiTf,
      queryKey: getGetKlinesQueryKey(multiTfParams),
      staleTime: 60_000,
    },
  });

  // ── Derived ────────────────────────────────────────────────────────
  const hasSubChart = indicators.some(i => !i.isOverlay && i.enabled);
  const hasRSI   = !!indicators.find(i => i.id === "rsi")?.enabled;
  const hasMACD  = !!indicators.find(i => i.id === "macd")?.enabled;
  const hasATR   = !!indicators.find(i => i.id === "atr")?.enabled;
  const hasStoch = !!indicators.find(i => i.id === "stoch")?.enabled;

  const sorted = sortedKlinesRef.current;
  const total = sorted.length;
  const currentBar = replayMode
    ? sorted[Math.min(replayIndex, total) - 1] ?? null
    : klines && klines.length > 0 ? klines[klines.length - 1] : null;
  const isUp = currentBar ? currentBar.close >= currentBar.open : true;
  const changePercent = currentBar ? (((currentBar.close - currentBar.open) / currentBar.open) * 100).toFixed(2) : null;
  const displayBar = ohlcDisplay ?? (currentBar ? { ...currentBar, time: "" } : null);
  const replayProgress = total > 0 ? (replayIndex / total) * 100 : 0;
  const currentDate = replayMode && currentBar ? fmtDate(currentBar.time) : null;

  // In replay mode use the bar close; in live paper-trade mode use the ticking sim price
  const livePrice = replayMode ? (currentBar?.close ?? 0) : liveChartPrice;
  const unrealizedPnl = position
    ? position.side === "short"
      ? (position.price - livePrice) * position.units
      : (livePrice - position.price) * position.units
    : null;
  const unrealizedPct = position
    ? position.side === "short"
      ? ((position.price - livePrice) / position.price) * 100
      : ((livePrice - position.price) / position.price) * 100
    : null;

  // Monitor pending chart orders — trigger when bar price crosses the trigger level
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!pendingChartOrders.length || !currentBar) return;
    const price = currentBar.close;
    const toTrigger = pendingChartOrders.filter(o =>
      o.orderType === "limit"
        ? (o.side === "buy" ? price <= o.price : price >= o.price)
        : (o.side === "buy" ? price >= o.price : price <= o.price)
    );
    if (!toTrigger.length) return;
    toTrigger.forEach(o => {
      if (o.side === "buy" && !positionRef.current) handleBuy(currentBar, o.price);
      else if (o.side === "sell" && positionRef.current) handleSell(currentBar, positionRef.current);
    });
    setPendingChartOrders(prev => prev.filter(o => !toTrigger.includes(o)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBar]);

  const wins = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const equityGain = equity - ptCapital;
  const equityGainPct = (equityGain / ptCapital) * 100;

  const DRAW_TOOLS: { id: DrawTool; icon: React.ReactNode; label: string; key: string }[] = [
    { id: "cursor",    icon: <MousePointer2 className="h-3.5 w-3.5" />,          label: "Select",    key: "Esc" },
    { id: "hline",     icon: <Minus className="h-3.5 w-3.5" />,                  label: "H-Line",    key: "H" },
    { id: "trendline", icon: <GitCommit className="h-3.5 w-3.5 rotate-45" />,    label: "Trend",     key: "T" },
    { id: "ray",       icon: <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="2" y1="12" x2="12" y2="2"/><circle cx="12" cy="2" r="1.5" fill="currentColor"/></svg>, label: "Ray", key: "R" },
    { id: "fibonacci", icon: <Hash className="h-3.5 w-3.5" />,                   label: "Fib",       key: "F" },
    { id: "rectangle", icon: <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="10" height="6" rx="1"/></svg>, label: "Zone", key: "Z" },
    { id: "doodle",    icon: <Pencil className="h-3.5 w-3.5" />,                 label: "Doodle",    key: "D" },
    { id: "eraser",    icon: <Eraser className="h-3.5 w-3.5" />,                 label: "Erase",     key: "E" },
  ];

  // ── Coord helpers ──────────────────────────────────────────────────

  const getChartCoords = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = chartContainerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const price = candleSeriesRef.current?.coordinateToPrice(y) ?? null;
    const logical = chartRef.current?.timeScale().coordinateToLogical(x) ?? null;
    let time: Time | null = null;
    if (logical !== null) {
      const idx = Math.max(0, Math.min(Math.round(Number(logical)), sortedKlinesRef.current.length - 1));
      time = (sortedKlinesRef.current[idx]?.time ?? null) as Time | null;
    }
    return { x, y, price: price !== null ? Number(price) : null, time };
  }, []);

  // ── Drawing handlers ───────────────────────────────────────────────

  const eraseLastDrawing = useCallback(() => {
    const list = drawingsRef.current;
    if (!list.length || !chartRef.current || !candleSeriesRef.current) return;
    const last = list[list.length - 1];
    if (last.kind === "hline") candleSeriesRef.current.removePriceLine(last.priceLine);
    if (last.kind === "trendline") chartRef.current.removeSeries(last.series);
    if (last.kind === "fibonacci") last.priceLines.forEach(pl => candleSeriesRef.current!.removePriceLine(pl));
    if (last.kind === "rectangle") chartRef.current.removeSeries(last.series);
    if (last.kind === "ray") chartRef.current.removeSeries(last.series);
    setDrawings(prev => prev.slice(0, -1));
  }, []);

  const handleChartMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === "cursor") return;
    e.preventDefault();

    if (activeTool === "doodle") {
      const rect = chartContainerRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      isDoodlingRef.current = true;
      currentDoodleRef.current = [{ x, y }];
      const ctx = doodleCanvasRef.current?.getContext("2d");
      if (ctx) { ctx.beginPath(); ctx.moveTo(x, y); }
      return;
    }

    const { x, y, price, time } = getChartCoords(e);
    if (price === null || time === null) return;

    if (activeTool === "eraser") { eraseLastDrawing(); return; }

    if (activeTool === "hline") {
      const priceLine = candleSeriesRef.current!.createPriceLine({
        price, color: drawColor, lineWidth: 1, lineStyle: LineStyle.Dashed,
        axisLabelVisible: true, title: fmt(price),
      });
      setDrawings(prev => [...prev, { kind: "hline", priceLine, id: Date.now(), price, color: drawColor }]);
      setActiveTool("cursor");
      return;
    }

    if (activeTool === "trendline" || activeTool === "fibonacci" || activeTool === "ray" || activeTool === "rectangle") {
      if (!drawStart) {
        setDrawStart({ x, y, price, time });
      } else {
        const p1 = drawStart.price;
        const t1 = drawStart.time as number;
        const p2 = price;
        const t2 = time as number;
        const id = Date.now();

        if (activeTool === "trendline") {
          const pts = t1 <= t2
            ? [{ time: t1 as Time, value: p1 }, { time: t2 as Time, value: p2 }]
            : [{ time: t2 as Time, value: p2 }, { time: t1 as Time, value: p1 }];
          const series = chartRef.current!.addSeries(LineSeries, {
            color: drawColor, lineWidth: 1,
            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
          });
          series.setData(pts);
          setDrawings(prev => [...prev, {
            kind: "trendline", series, id, color: drawColor,
            p1: { time: t1, price: p1 }, p2: { time: t2, price: p2 },
          }]);
        } else if (activeTool === "ray") {
          // Ray: extends from p1 through p2 by adding many extra points
          const bars = sortedKlinesRef.current;
          const slope = t2 !== t1 ? (p2 - p1) / (t2 - t1) : 0;
          const tStart = Math.min(t1, t2);
          const tEnd = bars.length > 0 ? bars[bars.length - 1].time + 100 * 86400 : t2 + 100 * 86400;
          const pts = [
            { time: tStart as Time, value: p1 },
            { time: (tStart + (tEnd - tStart) / 2) as Time, value: p1 + slope * (tStart + (tEnd - tStart) / 2 - t1) },
            { time: tEnd as Time, value: p1 + slope * (tEnd - t1) },
          ];
          const series = chartRef.current!.addSeries(LineSeries, {
            color: drawColor, lineWidth: 1,
            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
            lineStyle: LineStyle.SparseDotted,
          });
          series.setData(pts);
          setDrawings(prev => [...prev, {
            kind: "ray", series, id, color: drawColor,
            p1: { time: t1, price: p1 }, p2: { time: t2, price: p2 },
          }]);
        } else if (activeTool === "rectangle") {
          // Rectangle: draw 4 corners + close as a box
          const tMin = Math.min(t1, t2) as Time;
          const tMax = Math.max(t1, t2) as Time;
          const pMin = Math.min(p1, p2);
          const pMax = Math.max(p1, p2);
          const pts = [
            { time: tMin, value: pMax },
            { time: tMax, value: pMax },
            { time: tMax, value: pMin },
            { time: tMin, value: pMin },
            { time: tMin, value: pMax },
          ];
          const series = chartRef.current!.addSeries(LineSeries, {
            color: drawColor, lineWidth: 1,
            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
          });
          series.setData(pts);
          setDrawings(prev => [...prev, {
            kind: "rectangle", series, id, color: drawColor,
            p1: { time: t1, price: p1 }, p2: { time: t2, price: p2 },
          }]);
        } else {
          const high = Math.max(p1, p2);
          const low = Math.min(p1, p2);
          const range = high - low;
          const priceLines: IPriceLine[] = FIB_LEVELS.map(({ pct, color, label }) =>
            candleSeriesRef.current!.createPriceLine({
              price: high - range * pct, color, lineWidth: 1,
              lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: label,
            })
          );
          setDrawings(prev => [...prev, { kind: "fibonacci", priceLines, id, high, low, color: drawColor }]);
        }
        setDrawStart(null);
        setActiveTool("cursor");
      }
    }
  }, [activeTool, drawColor, drawStart, eraseLastDrawing, getChartCoords]);

  // Cancel pending draw on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawStart) { setDrawStart(null); setActiveTool("cursor"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawStart]);

  // ── Trading helpers ────────────────────────────────────────────────

  const applyMarkers = useCallback(() => {
    if (markersPluginRef.current) markersPluginRef.current.setMarkers([...markersRef.current]);
  }, []);

  const resetTrading = useCallback(() => {
    setPosition(null); setTrades([]); setEquity(ptCapital);
    localStorage.removeItem("pt_trades");
    updatePtBalance(ptCapital);
    markersRef.current = []; applyMarkers();
  }, [applyMarkers, ptCapital]);

  // BUY = open long (if no position) OR close short (if short position open)
  const handleBuy = useCallback((bar: KlineBar, priceOverride?: number) => {
    const exitPrice = priceOverride ?? bar.close;

    if (position?.side === "short") {
      // Close the short position
      const pnl = position.units * (position.price - exitPrice);
      const pnlPct = (pnl / position.capitalAtEntry) * 100;
      const newEquity = position.capitalAtEntry + pnl;
      const trade = { id: Date.now(), entryPrice: position.price, entryTime: position.time, exitPrice, exitTime: bar.time, units: position.units, pnl, pnlPct, side: "short" as const, symbol };
      setTrades(prev => [...prev, trade]);
      setPosition(null);
      setEquity(newEquity);
      savePtTrade(trade);
      updatePtBalance(newEquity);
      if (candleSeriesRef.current && entryPriceLineRef.current) {
        try { candleSeriesRef.current.removePriceLine(entryPriceLineRef.current); } catch { /**/ }
        entryPriceLineRef.current = null;
      }
      const marker: SeriesMarker<Time> = { time: bar.time as Time, position: "belowBar", color: pnl >= 0 ? "hsl(150,90%,55%)" : "hsl(0,85%,60%)", shape: "arrowUp", text: `SC ${fmtPct(pnlPct)}`, size: 1 };
      markersRef.current = [...markersRef.current, marker].sort((a, b) => (a.time as number) - (b.time as number));
      applyMarkers();
      return;
    }

    if (position?.side === "long") return; // Already long

    // Open long
    const entryPrice = exitPrice;
    const units = (equity * chartLeverage) / entryPrice;
    setPosition({ price: entryPrice, time: bar.time, units, capitalAtEntry: equity, side: "long" });
    if (candleSeriesRef.current) {
      if (entryPriceLineRef.current) { try { candleSeriesRef.current.removePriceLine(entryPriceLineRef.current); } catch { /**/ } }
      entryPriceLineRef.current = candleSeriesRef.current.createPriceLine({
        price: entryPrice, color: "hsl(150,90%,55%)", lineWidth: 1,
        lineStyle: 2, axisLabelVisible: true,
        title: `▲ Long ${chartLeverage}x`,
      });
    }
    const marker: SeriesMarker<Time> = { time: bar.time as Time, position: "belowBar", color: "hsl(150,90%,55%)", shape: "arrowUp", text: `B $${fmt(entryPrice)}`, size: 1 };
    markersRef.current = [...markersRef.current, marker].sort((a, b) => (a.time as number) - (b.time as number));
    applyMarkers();
  }, [position, equity, chartLeverage, applyMarkers, symbol]);

  // SELL = close long (if long position open) OR open short (if no position)
  const handleSell = useCallback((bar: KlineBar, pos?: Position) => {
    const currentPos = pos ?? position;
    const exitPrice = bar.close;

    if (currentPos?.side === "long") {
      // Close the long position
      const pnl = currentPos.units * (exitPrice - currentPos.price);
      const pnlPct = (pnl / currentPos.capitalAtEntry) * 100;
      const newEquity = currentPos.capitalAtEntry + pnl;
      const trade = { id: Date.now(), entryPrice: currentPos.price, entryTime: currentPos.time, exitPrice, exitTime: bar.time, units: currentPos.units, pnl, pnlPct, side: "long" as const, symbol };
      setTrades(prev => [...prev, trade]);
      setPosition(null);
      setEquity(newEquity);
      savePtTrade(trade);
      updatePtBalance(newEquity);
      if (candleSeriesRef.current && entryPriceLineRef.current) {
        try { candleSeriesRef.current.removePriceLine(entryPriceLineRef.current); } catch { /**/ }
        entryPriceLineRef.current = null;
      }
      const marker: SeriesMarker<Time> = { time: bar.time as Time, position: "aboveBar", color: pnl >= 0 ? "hsl(150,90%,55%)" : "hsl(0,85%,60%)", shape: "arrowDown", text: `S ${fmtPct(pnlPct)}`, size: 1 };
      markersRef.current = [...markersRef.current, marker].sort((a, b) => (a.time as number) - (b.time as number));
      applyMarkers();
      return;
    }

    if (currentPos?.side === "short") return; // Already short

    // Open short
    const units = (equity * chartLeverage) / exitPrice;
    setPosition({ price: exitPrice, time: bar.time, units, capitalAtEntry: equity, side: "short" });
    if (candleSeriesRef.current) {
      if (entryPriceLineRef.current) { try { candleSeriesRef.current.removePriceLine(entryPriceLineRef.current); } catch { /**/ } }
      entryPriceLineRef.current = candleSeriesRef.current.createPriceLine({
        price: exitPrice, color: "hsl(0,85%,62%)", lineWidth: 1,
        lineStyle: 2, axisLabelVisible: true,
        title: `▼ Short ${chartLeverage}x`,
      });
    }
    const marker: SeriesMarker<Time> = { time: bar.time as Time, position: "aboveBar", color: "hsl(0,85%,62%)", shape: "arrowDown", text: `SS $${fmt(exitPrice)}`, size: 1 };
    markersRef.current = [...markersRef.current, marker].sort((a, b) => (a.time as number) - (b.time as number));
    applyMarkers();
  }, [position, equity, chartLeverage, applyMarkers, symbol]);

  // ── Replay helpers ─────────────────────────────────────────────────

  const enterReplay = useCallback(() => {
    setIsPlaying(false); setReplayIndex(MIN_CANDLES); setReplayMode(true);
    setReplaySidebarOpen(false);
    setPosition(null); setTrades([]); setEquity(ptCapital);
    markersRef.current = [];
    markersPluginRef.current?.setMarkers([]);
  }, [ptCapital]);

  const exitReplay = useCallback(() => {
    setIsPlaying(false); setReplayMode(false); setOhlcDisplay(null); resetTrading();
  }, [resetTrading]);

  const stepForward = useCallback(() => setReplayIndex(i => Math.min(i + 1, sortedKlinesRef.current.length)), []);
  const stepBack    = useCallback(() => setReplayIndex(i => Math.max(i - 1, MIN_CANDLES)), []);
  const jumpToStart = useCallback(() => { setIsPlaying(false); setReplayIndex(MIN_CANDLES); }, []);
  const jumpToEnd   = useCallback(() => { setIsPlaying(false); setReplayIndex(sortedKlinesRef.current.length); }, []);

  const handleSymbolChange = useCallback((val: string) => {
    if (replayMode) exitReplay();
    setSymbol(val);
  }, [replayMode, exitReplay]);

  const handleIntervalChange = useCallback((val: string) => {
    if (replayMode) {
      setIsPlaying(false);
      setReplayIndex(MIN_CANDLES);
      setPosition(null); setTrades([]); setEquity(ptCapital);
      markersRef.current = [];
    }
    setInterval(val as GetKlinesInterval);
  }, [replayMode]);

  // ── Auto-play ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying || !replayMode) return;
    const id = window.setInterval(() => {
      setReplayIndex(i => {
        const t = sortedKlinesRef.current.length;
        if (i >= t) { setIsPlaying(false); return i; }
        return i + 1;
      });
    }, replaySpeed);
    return () => window.clearInterval(id);
  }, [isPlaying, replayMode, replaySpeed]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (replayMode) {
        if (e.key === "ArrowRight") { e.preventDefault(); stepForward(); }
        if (e.key === "ArrowLeft")  { e.preventDefault(); stepBack(); }
        if (e.key === " ")          { e.preventDefault(); setIsPlaying(p => !p); }
        if (e.key === "b" || e.key === "B") { const bar = sortedKlinesRef.current[replayIndexRef.current - 1]; if (bar) handleBuy(bar); }
        if (e.key === "s" || e.key === "S") { const bar = sortedKlinesRef.current[replayIndexRef.current - 1]; if (bar) handleSell(bar, positionRef.current ?? undefined); }
      }
      if (e.key === "h") setActiveTool("hline");
      if (e.key === "t") setActiveTool("trendline");
      if (e.key === "f") setActiveTool("fibonacci");
      if (e.key === "e") setActiveTool("eraser");
      if (e.key === "Escape" && !drawStart) { setActiveTool("cursor"); if (replayMode) exitReplay(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [replayMode, stepForward, stepBack, exitReplay, handleBuy, handleSell, drawStart]);

  // ── Chart init ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const container = chartContainerRef.current;

    const chart = createChart(container, makeChartOptions());

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "hsl(150,90%,52%)",   downColor: "hsl(0,85%,58%)",
      borderUpColor: "hsl(150,90%,52%)", borderDownColor: "hsl(0,85%,58%)",
      wickUpColor: "hsl(150,80%,45%)",   wickDownColor: "hsl(0,75%,50%)",
      priceLineVisible: true,
      priceLineColor: "hsla(190,90%,60%,0.7)",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "hsl(190,90%,50%)",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });

    // Crosshair move → floating OHLC + sync sub/multi-tf
    chart.subscribeCrosshairMove(param => {
      if (param.time && candleSeriesRef.current) {
        const bar = param.seriesData.get(candleSeriesRef.current) as { open: number; high: number; low: number; close: number } | undefined;
        const vol = volumeSeriesRef.current
          ? (param.seriesData.get(volumeSeriesRef.current) as { value: number } | undefined)?.value
          : undefined;
        if (bar) {
          setOhlcDisplay({
            ...bar,
            volume: vol,
            time: new Date((param.time as number) * 1000).toLocaleDateString(),
            pxX: param.point?.x,
            pxY: param.point?.y,
          });
        } else {
          setOhlcDisplay(null);
        }
      } else {
        setOhlcDisplay(null);
      }

      // Sync sub-chart crosshair
      if (subChartRef.current && subPrimarySeriesRef.current && param.time) {
        try { subChartRef.current.setCrosshairPosition(0, param.time, subPrimarySeriesRef.current); }
        catch { /* ignore */ }
      } else if (subChartRef.current && !param.time) {
        try { subChartRef.current.clearCrosshairPosition(); } catch { /* ignore */ }
      }

      // Sync multi-TF crosshair
      if (multiTfChartRef.current && multiTfCandleRef.current && param.time) {
        try { multiTfChartRef.current.setCrosshairPosition(0, param.time, multiTfCandleRef.current); }
        catch { /* ignore */ }
      } else if (multiTfChartRef.current && !param.time) {
        try { multiTfChartRef.current.clearCrosshairPosition(); } catch { /* ignore */ }
      }
    });

    // Scroll/zoom sync → sub-chart (same bars)
    chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (isSyncingRef.current || !range) return;
      isSyncingRef.current = true;
      try { subChartRef.current?.timeScale().setVisibleLogicalRange(range); } catch { /* ignore */ }
      isSyncingRef.current = false;
    });

    markersPluginRef.current = createSeriesMarkers(candleSeries, []);
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      altSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markersPluginRef.current = null;
      indicatorSeriesRef.current.clear();
    };
  }, []);

  // ── Feed main chart data ───────────────────────────────────────────

  useEffect(() => {
    const chart = chartRef.current;
    if (!klines || !candleSeriesRef.current || !volumeSeriesRef.current || !chart) return;
    const sortedData = [...klines].sort((a, b) => a.time - b.time);
    sortedKlinesRef.current = sortedData;
    const slice = replayMode ? sortedData.slice(0, replayIndex) : sortedData;

    volumeSeriesRef.current.setData(slice.map(k => ({
      time: k.time as Time, value: k.volume,
      color: k.close >= k.open ? "hsla(150,90%,50%,0.3)" : "hsla(0,85%,60%,0.3)",
    })));

    // Remove alt series when switching back to OHLC types
    if (altSeriesRef.current && (chartType === "candlestick" || chartType === "hollow" || chartType === "heikin_ashi")) {
      try { chart.removeSeries(altSeriesRef.current); } catch { /* ignore */ }
      altSeriesRef.current = null;
    }

    if (chartType === "candlestick") {
      candleSeriesRef.current.applyOptions({
        upColor: "hsl(150,90%,52%)", downColor: "hsl(0,85%,58%)",
        borderUpColor: "hsl(150,90%,52%)", borderDownColor: "hsl(0,85%,58%)",
        wickUpColor: "hsl(150,80%,45%)", wickDownColor: "hsl(0,75%,50%)",
      });
      candleSeriesRef.current.setData(slice.map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
    } else if (chartType === "hollow") {
      candleSeriesRef.current.applyOptions({
        upColor: "transparent", downColor: "hsl(0,85%,58%)",
        borderUpColor: "hsl(150,90%,52%)", borderDownColor: "hsl(0,85%,58%)",
        wickUpColor: "hsl(150,80%,45%)", wickDownColor: "hsl(0,75%,50%)",
      });
      candleSeriesRef.current.setData(slice.map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
    } else if (chartType === "heikin_ashi") {
      candleSeriesRef.current.applyOptions({
        upColor: "hsl(150,90%,52%)", downColor: "hsl(0,85%,58%)",
        borderUpColor: "hsl(150,90%,52%)", borderDownColor: "hsl(0,85%,58%)",
        wickUpColor: "hsl(150,80%,45%)", wickDownColor: "hsl(0,75%,50%)",
      });
      const ha = calcHeikinAshi(slice);
      candleSeriesRef.current.setData(ha.map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
    } else {
      // line / area / bar — clear candle, use alt series
      candleSeriesRef.current.setData([]);
      if (altSeriesRef.current) {
        try { chart.removeSeries(altSeriesRef.current); } catch { /* ignore */ }
        altSeriesRef.current = null;
      }
      if (chartType === "line") {
        const s = chart.addSeries(LineSeries, {
          color: "hsl(190,90%,55%)", lineWidth: 2,
          priceLineVisible: true, lastValueVisible: true, crosshairMarkerVisible: true,
        });
        s.setData(slice.map(k => ({ time: k.time as Time, value: k.close })));
        altSeriesRef.current = s;
      } else if (chartType === "area") {
        const s = chart.addSeries(AreaSeries, {
          lineColor: "hsl(190,90%,55%)",
          topColor: "hsla(190,90%,55%,0.32)",
          bottomColor: "hsla(190,90%,55%,0.0)",
          lineWidth: 2,
          priceLineVisible: true, lastValueVisible: true, crosshairMarkerVisible: true,
        });
        s.setData(slice.map(k => ({ time: k.time as Time, value: k.close })));
        altSeriesRef.current = s as unknown as ISeriesApi<"Line">;
      } else if (chartType === "bar") {
        const s = chart.addSeries(BarSeries, {
          upColor: "hsl(150,90%,52%)", downColor: "hsl(0,85%,58%)",
        });
        s.setData(slice.map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
        altSeriesRef.current = s as unknown as ISeriesApi<"Line">;
      }
    }

    chart.timeScale().fitContent();

    // Re-apply trade markers after data change (setData can clear them)
    markersPluginRef.current?.setMarkers([...markersRef.current]);

    // Restore pending layout drawings
    if (pendingRestoreRef.current) {
      const toRestore = pendingRestoreRef.current;
      pendingRestoreRef.current = null;
      restoreDrawingsFromData(toRestore, sortedData);
    }
  }, [klines, replayMode, replayIndex, chartType]);

  // ── Indicator overlay series (SMA, EMA, BB on main chart) ──────────

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const bars = sortedKlinesRef.current;
    const seriesMap = indicatorSeriesRef.current;

    const overlayIds: IndicatorId[] = ["sma20", "sma50", "ema9", "ema20", "ema50", "bb", "vwap"];

    for (const ind of indicators.filter(i => overlayIds.includes(i.id as IndicatorId))) {
      if (ind.enabled) {
        if (ind.id === "sma20" || ind.id === "sma50") {
          let s = seriesMap.get(ind.id) as ISeriesApi<"Line"> | undefined;
          if (!s) {
            s = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
            seriesMap.set(ind.id, s);
          }
          if (bars.length >= ind.period)
            s.setData(calcSMA(bars, ind.period).map(d => ({ time: d.time as Time, value: d.value })));
        }
        if (ind.id === "ema9" || ind.id === "ema20" || ind.id === "ema50") {
          let s = seriesMap.get(ind.id) as ISeriesApi<"Line"> | undefined;
          if (!s) {
            s = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
            seriesMap.set(ind.id, s);
          }
          if (bars.length >= ind.period)
            s.setData(calcEMA(bars, ind.period).map(d => ({ time: d.time as Time, value: d.value })));
        }
        if (ind.id === "bb") {
          let arr = seriesMap.get("bb") as ISeriesApi<"Line">[] | undefined;
          if (!arr) {
            const opts = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
            const upper = chart.addSeries(LineSeries, { ...opts, color: "hsla(200,80%,65%,0.7)" });
            const mid   = chart.addSeries(LineSeries, { ...opts, color: "hsla(200,80%,65%,0.4)", lineStyle: LineStyle.Dashed });
            const lower = chart.addSeries(LineSeries, { ...opts, color: "hsla(200,80%,65%,0.7)" });
            arr = [upper, mid, lower];
            seriesMap.set("bb", arr);
          }
          if (bars.length >= ind.period) {
            const { upper, middle, lower } = calcBB(bars, ind.period);
            arr[0].setData(upper.map(d => ({ time: d.time as Time, value: d.value })));
            arr[1].setData(middle.map(d => ({ time: d.time as Time, value: d.value })));
            arr[2].setData(lower.map(d => ({ time: d.time as Time, value: d.value })));
          }
        }
        if (ind.id === "vwap") {
          let s = seriesMap.get("vwap") as ISeriesApi<"Line"> | undefined;
          if (!s) {
            s = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false });
            seriesMap.set("vwap", s);
          }
          if (bars.length > 1)
            s.setData(calcVWAP(bars).map(d => ({ time: d.time as Time, value: d.value })));
        }
      } else {
        const existing = seriesMap.get(ind.id);
        if (existing) {
          if (Array.isArray(existing)) existing.forEach(s => { try { chart.removeSeries(s); } catch { /* ignore */ } });
          else { try { chart.removeSeries(existing as ISeriesApi<"Line">); } catch { /* ignore */ } }
          seriesMap.delete(ind.id);
        }
      }
    }
  }, [klines, indicators]);

  // ── Sub-chart effect (RSI / MACD) ──────────────────────────────────

  useEffect(() => {
    const container = subChartContainerRef.current;
    if (!hasSubChart) {
      if (subChartRef.current) {
        try { subChartRef.current.remove(); } catch { /* ignore */ }
        subChartRef.current = null;
        subSeriesRef.current.clear();
        subPrimarySeriesRef.current = null;
      }
      return;
    }
    if (!container) return;

    const bars = sortedKlinesRef.current;
    if (bars.length === 0) return;

    // Create chart if needed
    if (!subChartRef.current) {
      const sc = createChart(container, makeChartOptions(true));
      sc.priceScale("right").applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });

      // Sync scroll ↔ main chart
      sc.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (isSyncingRef.current || !range) return;
        isSyncingRef.current = true;
        try { chartRef.current?.timeScale().setVisibleLogicalRange(range); } catch { /* ignore */ }
        isSyncingRef.current = false;
      });

      subChartRef.current = sc;
    }

    const sc = subChartRef.current;

    // Clear old series
    subSeriesRef.current.forEach(s => { try { sc.removeSeries(s); } catch { /* ignore */ } });
    subSeriesRef.current.clear();
    subPrimarySeriesRef.current = null;

    // RSI
    if (hasRSI && bars.length > 14) {
      const rsiData = calcRSI(bars, 14);
      const rsiSeries = sc.addSeries(LineSeries, {
        color: "hsl(38,100%,60%)", lineWidth: 2,
        priceLineVisible: false, lastValueVisible: true,
        title: "RSI",
      });
      rsiSeries.setData(rsiData.map(d => ({ time: d.time as Time, value: d.value })));
      rsiSeries.createPriceLine({ price: 70, color: "hsla(0,85%,62%,0.5)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "70" });
      rsiSeries.createPriceLine({ price: 50, color: "hsla(220,14%,50%,0.3)", lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: false, title: "" });
      rsiSeries.createPriceLine({ price: 30, color: "hsla(150,90%,55%,0.5)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "30" });
      subSeriesRef.current.set("rsi", rsiSeries);
      subPrimarySeriesRef.current = rsiSeries;
    }

    // MACD
    if (hasMACD && bars.length > 35) {
      const macdData = calcMACD(bars);
      const macdLine = sc.addSeries(LineSeries, {
        color: "hsl(190,90%,55%)", lineWidth: 1,
        priceLineVisible: false, lastValueVisible: false, title: "MACD",
      });
      const sigLine = sc.addSeries(LineSeries, {
        color: "hsl(0,85%,62%)", lineWidth: 1,
        priceLineVisible: false, lastValueVisible: false, title: "Signal",
      });
      const histSeries = sc.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
      macdLine.setData(macdData.macd.map(d => ({ time: d.time as Time, value: d.value })));
      sigLine.setData(macdData.signal.map(d => ({ time: d.time as Time, value: d.value })));
      histSeries.setData(macdData.histogram.map(d => ({
        time: d.time as Time, value: d.value,
        color: d.value >= 0 ? "hsla(150,90%,50%,0.65)" : "hsla(0,85%,62%,0.65)",
      })));
      subSeriesRef.current.set("macd", macdLine);
      subSeriesRef.current.set("macd-sig", sigLine);
      subSeriesRef.current.set("macd-hist", histSeries);
      if (!subPrimarySeriesRef.current) subPrimarySeriesRef.current = macdLine;
    }

    // ATR
    if (hasATR && bars.length > 15) {
      const atrData = calcATR(bars, 14);
      const atrSeries = sc.addSeries(LineSeries, {
        color: "hsl(260,80%,68%)", lineWidth: 2,
        priceLineVisible: false, lastValueVisible: true, title: "ATR",
      });
      atrSeries.setData(atrData.map(d => ({ time: d.time as Time, value: d.value })));
      subSeriesRef.current.set("atr", atrSeries);
      if (!subPrimarySeriesRef.current) subPrimarySeriesRef.current = atrSeries;
    }

    // Stochastic
    if (hasStoch && bars.length > 17) {
      const stochData = calcStochastic(bars, 14, 3);
      const kSeries = sc.addSeries(LineSeries, {
        color: "hsl(150,90%,55%)", lineWidth: 2,
        priceLineVisible: false, lastValueVisible: true, title: "%K",
      });
      const dSeries = sc.addSeries(LineSeries, {
        color: "hsl(0,85%,62%)", lineWidth: 1, lineStyle: LineStyle.Dashed,
        priceLineVisible: false, lastValueVisible: false, title: "%D",
      });
      kSeries.createPriceLine({ price: 80, color: "hsla(0,85%,62%,0.4)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "80" });
      kSeries.createPriceLine({ price: 20, color: "hsla(150,90%,55%,0.4)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "20" });
      kSeries.setData(stochData.k.map(d => ({ time: d.time as Time, value: d.value })));
      dSeries.setData(stochData.d.map(d => ({ time: d.time as Time, value: d.value })));
      subSeriesRef.current.set("stoch-k", kSeries);
      subSeriesRef.current.set("stoch-d", dSeries);
      if (!subPrimarySeriesRef.current) subPrimarySeriesRef.current = kSeries;
    }

    // Sync visible range from main chart
    const mainRange = chartRef.current?.timeScale().getVisibleLogicalRange();
    if (mainRange) try { sc.timeScale().setVisibleLogicalRange(mainRange); } catch { /* ignore */ }

  }, [klines, hasSubChart, hasRSI, hasMACD, hasATR, hasStoch]);

  // ── Multi-TF chart ─────────────────────────────────────────────────

  useEffect(() => {
    const container = multiTfContainerRef.current;

    if (!showMultiTf) {
      if (multiTfChartRef.current) {
        try { multiTfChartRef.current.remove(); } catch { /* ignore */ }
        multiTfChartRef.current = null;
        multiTfCandleRef.current = null;
      }
      return;
    }

    if (!container || !multiTfKlines) return;

    if (!multiTfChartRef.current) {
      const mc = createChart(container, makeChartOptions());
      const mcCandle = mc.addSeries(CandlestickSeries, {
        upColor: "hsl(150,90%,52%)", downColor: "hsl(0,85%,58%)",
        borderUpColor: "hsl(150,90%,52%)", borderDownColor: "hsl(0,85%,58%)",
        wickUpColor: "hsl(150,80%,45%)", wickDownColor: "hsl(0,75%,50%)",
        priceLineVisible: true, priceLineColor: "hsla(190,90%,60%,0.7)",
      });
      const mcVol = mc.addSeries(HistogramSeries, { color: "hsl(190,90%,50%)", priceFormat: { type: "volume" }, priceScaleId: "vol2" });
      mc.priceScale("vol2").applyOptions({ scaleMargins: { top: 0.88, bottom: 0 } });

      multiTfChartRef.current = mc;
      multiTfCandleRef.current = mcCandle;

      const sortedMtf = [...multiTfKlines].sort((a, b) => a.time - b.time);
      mcCandle.setData(sortedMtf.map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
      mcVol.setData(sortedMtf.map(k => ({ time: k.time as Time, value: k.volume, color: k.close >= k.open ? "hsla(150,90%,50%,0.3)" : "hsla(0,85%,60%,0.3)" })));
      mc.timeScale().fitContent();
    } else {
      // Update data if interval changed
      const sortedMtf = [...multiTfKlines].sort((a, b) => a.time - b.time);
      multiTfCandleRef.current?.setData(sortedMtf.map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
      multiTfChartRef.current?.timeScale().fitContent();
    }
  }, [showMultiTf, multiTfKlines]);

  // ── Persist indicators ─────────────────────────────────────────────

  useEffect(() => { persistIndicators(indicators); }, [indicators]);

  // ── Close indicators panel on outside click ─────────────────────────

  useEffect(() => {
    if (!showIndicators) return;
    function handleClickOutside(e: MouseEvent) {
      if (indicatorPanelRef.current && !indicatorPanelRef.current.contains(e.target as Node)) {
        setShowIndicators(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showIndicators]);

  // ── Layout helpers ─────────────────────────────────────────────────

  function restoreDrawingsFromData(toRestore: SerializableDrawing[], bars: KlineBar[]) {
    if (!candleSeriesRef.current || !chartRef.current) return;
    const newDrawings: DrawnObject[] = [];

    for (const d of toRestore) {
      try {
        if (d.kind === "hline") {
          const pl = candleSeriesRef.current.createPriceLine({
            price: d.price, color: d.color, lineWidth: 1,
            lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: fmt(d.price),
          });
          newDrawings.push({ kind: "hline", priceLine: pl, id: d.id, price: d.price, color: d.color });
        } else if (d.kind === "trendline") {
          const t1 = d.p1.time; const t2 = d.p2.time;
          const pts = t1 <= t2
            ? [{ time: t1 as Time, value: d.p1.price }, { time: t2 as Time, value: d.p2.price }]
            : [{ time: t2 as Time, value: d.p2.price }, { time: t1 as Time, value: d.p1.price }];
          // Validate times exist in bars
          const times = new Set(bars.map(b => b.time));
          if (!times.has(t1) || !times.has(t2)) continue;
          const series = chartRef.current.addSeries(LineSeries, {
            color: d.color, lineWidth: 1,
            priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
          });
          series.setData(pts);
          newDrawings.push({ kind: "trendline", series, id: d.id, p1: d.p1, p2: d.p2, color: d.color });
        } else if (d.kind === "fibonacci") {
          const range = d.high - d.low;
          const pls: IPriceLine[] = FIB_LEVELS.map(({ pct, color, label }) =>
            candleSeriesRef.current!.createPriceLine({
              price: d.high - range * pct, color, lineWidth: 1,
              lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: label,
            })
          );
          newDrawings.push({ kind: "fibonacci", priceLines: pls, id: d.id, high: d.high, low: d.low, color: d.color });
        }
      } catch { /* ignore individual drawing errors */ }
    }

    setDrawings(newDrawings);
  }

  const serializeDrawings = useCallback((): SerializableDrawing[] => {
    return drawingsRef.current.map(d => {
      if (d.kind === "hline")     return { kind: "hline",     id: d.id, price: d.price, color: d.color } as SerializableDrawing;
      if (d.kind === "trendline") return { kind: "trendline", id: d.id, p1: d.p1, p2: d.p2, color: d.color } as SerializableDrawing;
      if (d.kind === "fibonacci") return { kind: "fibonacci", id: d.id, high: d.high, low: d.low, color: d.color } as SerializableDrawing;
      if (d.kind === "rectangle") return { kind: "rectangle", id: d.id, p1: d.p1, p2: d.p2, color: d.color } as SerializableDrawing;
      return { kind: "ray", id: d.id, p1: d.p1, p2: d.p2, color: d.color } as SerializableDrawing;
    });
  }, []);

  const handleSaveLayout = useCallback(() => {
    const name = layoutNameInput.trim() || `Layout ${savedLayouts.length + 1}`;
    const layout: ChartLayout = {
      id: Date.now().toString(),
      name,
      symbol,
      interval,
      drawings: serializeDrawings(),
      indicators: indicators.filter(i => i.enabled).map(i => i.id),
      createdAt: Date.now(),
    };
    const next = [layout, ...savedLayouts].slice(0, 20);
    setSavedLayouts(next);
    saveLayouts(next);
    setLayoutNameInput("");
    setShowLayoutPanel(false);
  }, [layoutNameInput, savedLayouts, symbol, interval, serializeDrawings, indicators]);

  const handleLoadLayout = useCallback((layout: ChartLayout) => {
    // Clear current drawings
    drawingsRef.current.forEach(d => {
      try {
        if (d.kind === "hline") candleSeriesRef.current?.removePriceLine(d.priceLine);
        if (d.kind === "trendline") chartRef.current?.removeSeries(d.series);
        if (d.kind === "fibonacci") d.priceLines.forEach(pl => candleSeriesRef.current?.removePriceLine(pl));
      } catch { /* ignore */ }
    });
    setDrawings([]);

    // Restore indicators
    setIndicators(prev => prev.map(i => ({ ...i, enabled: layout.indicators.includes(i.id) })));

    // Set symbol/interval
    setSymbol(layout.symbol);
    setInterval(layout.interval as GetKlinesInterval);

    // Queue drawing restore (runs after klines reload)
    pendingRestoreRef.current = layout.drawings;
    setShowLayoutPanel(false);
  }, []);

  const handleDeleteLayout = useCallback((id: string) => {
    const next = savedLayouts.filter(l => l.id !== id);
    setSavedLayouts(next);
    saveLayouts(next);
  }, [savedLayouts]);

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: getGetKlinesQueryKey(params) });
  }

  // ── Render ─────────────────────────────────────────────────────────

  // ── Account setup helper ───────────────────────────────────────────
  const CAPITAL_OPTIONS = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000];

  const openAccountWithCapital = (cap: number) => {
    const acc = { initialCapital: cap, balance: cap, createdAt: new Date().toISOString() };
    localStorage.setItem("pt_account", JSON.stringify(acc));
    setPtCapital(cap);
    setEquity(cap);
    setAccountModalOpen(false);
  };

  return (
    <div className="tt-chart-page flex flex-col gap-2" style={{ maxWidth: "100%", overflowX: "hidden" }}>

      {/* ── Paper Trading Account Setup Modal ─────────────────────────── */}
      {accountModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}
        >
          <div className="w-full max-w-md rounded-2xl border overflow-hidden"
            style={{ background: "hsl(222,22%,10%)", borderColor: "rgba(255,255,255,0.1)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>

            {/* Header */}
            <div className="px-6 pt-6 pb-4 text-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="h-12 w-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, hsl(150,75%,22%), hsl(150,75%,15%))", border: "1px solid rgba(52,211,153,0.3)" }}>
                <TrendingUp className="h-5 w-5" style={{ color: "hsl(150,90%,65%)" }} />
              </div>
              <h2 className="text-lg font-bold font-mono" style={{ color: "hsl(220,14%,90%)" }}>Open Paper Trading Account</h2>
              <p className="text-xs font-mono mt-1.5" style={{ color: "hsl(220,14%,45%)" }}>
                Choose your virtual starting balance. You can reset and restart anytime.
              </p>
            </div>

            {/* Capital options */}
            <div className="px-6 py-4">
              <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: "hsl(220,14%,40%)" }}>Select Starting Balance</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {CAPITAL_OPTIONS.map(cap => (
                  <button
                    key={cap}
                    onClick={() => openAccountWithCapital(cap)}
                    className="py-3 rounded-xl border font-mono font-bold text-sm transition-all hover:scale-[1.02]"
                    style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "hsl(220,14%,75%)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(52,211,153,0.4)"; (e.currentTarget as HTMLElement).style.color = "hsl(150,90%,65%)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "hsl(220,14%,75%)"; }}
                  >
                    ${cap >= 1000 ? `${(cap / 1000).toFixed(0)}K` : cap}
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
                  <span className="text-xs font-mono" style={{ color: "hsl(220,14%,45%)" }}>$</span>
                  <input
                    type="number"
                    placeholder="Custom amount"
                    value={customCapitalInput}
                    onChange={e => setCustomCapitalInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { const n = Number(customCapitalInput); if (n >= 100) openAccountWithCapital(n); } }}
                    className="flex-1 bg-transparent text-xs font-mono outline-none"
                    style={{ color: "hsl(220,14%,80%)" }}
                    min={100}
                  />
                </div>
                <button
                  onClick={() => { const n = Number(customCapitalInput); if (n >= 100) openAccountWithCapital(n); }}
                  disabled={!customCapitalInput || Number(customCapitalInput) < 100}
                  className="px-4 py-2 rounded-xl font-mono font-bold text-xs transition-all disabled:opacity-30"
                  style={{ background: "linear-gradient(135deg, hsl(150,75%,22%), hsl(150,75%,15%))", border: "1px solid rgba(52,211,153,0.3)", color: "hsl(150,90%,65%)" }}
                >
                  Start
                </button>
              </div>
            </div>

            <div className="px-6 pb-5">
              <p className="text-[10px] font-mono text-center" style={{ color: "hsl(220,14%,30%)" }}>
                Paper trading uses virtual money — no real funds are at risk.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────── */}
      <div
        className="rounded-xl px-3 sm:px-4 py-2.5 border"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
          backdropFilter: "blur(12px)",
          borderColor: "rgba(255,255,255,0.07)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
          position: "relative",
          zIndex: 60,
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight flex-shrink-0" style={{ background: "linear-gradient(135deg, hsl(190,90%,65%), hsl(210,80%,75%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Live Chart
            </h1>
            {replayMode && (
              <span className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded-full border flex-shrink-0" style={{ background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.3)", color: "hsl(38,100%,65%)" }}>
                ● REPLAY
              </span>
            )}
            {currentBar && !replayMode && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm sm:text-base font-mono font-bold flex-shrink-0" style={{ color: isUp ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>
                  ${fmt(currentBar.close)}
                </span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded flex-shrink-0" style={isUp
                  ? { background: "rgba(52,211,153,0.1)", color: "hsl(150,90%,58%)" }
                  : { background: "rgba(239,68,68,0.1)", color: "hsl(0,85%,62%)" }}>
                  {isUp ? "+" : ""}{changePercent}%
                </span>
              </div>
            )}
          </div>
          <span className="text-[10px] font-mono hidden sm:block" style={{ color: "hsl(220,14%,35%)" }}>
            {isSim ? `${displayCategory} · Sim` : "Binance · Live"}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-wrap"  style={{ rowGap: "4px" }}>
          {/* Indicators button */}
          <div className="relative" ref={indicatorPanelRef}>
            <button
              onClick={() => { setShowIndicators(v => !v); setShowLayoutPanel(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={showIndicators
                ? { background: "rgba(0,229,255,0.12)", borderColor: "rgba(0,229,255,0.3)", color: "hsl(190,90%,65%)" }
                : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Indicators</span>
              {indicators.filter(i => i.enabled).length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                  style={{ background: "rgba(0,229,255,0.25)", color: "hsl(190,90%,70%)" }}>
                  {indicators.filter(i => i.enabled).length}
                </span>
              )}
            </button>

            {showIndicators && (
              <div
                className="absolute left-0 top-full mt-1 z-50 rounded-xl p-3 w-64 flex flex-col gap-1"
                style={{ background: "hsl(222,28%,11%)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
              >
                <div className="flex items-center justify-between px-1 mb-1">
                  <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,40%)" }}>Overlays</p>
                  {indicators.some(i => i.isOverlay && i.enabled) && (
                    <button onClick={() => setIndicators(prev => prev.map(i => i.isOverlay ? { ...i, enabled: false } : i))}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded transition-all"
                      style={{ color: "hsl(0,78%,65%)", background: "rgba(239,68,68,0.1)" }}>
                      clear
                    </button>
                  )}
                </div>
                {indicators.filter(i => i.isOverlay).map(ind => (
                  <button
                    key={ind.id}
                    onClick={() => setIndicators(prev => prev.map(i => i.id === ind.id ? { ...i, enabled: !i.enabled } : i))}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono transition-all"
                    style={ind.enabled
                      ? { background: "rgba(255,255,255,0.06)", color: "hsl(220,14%,80%)" }
                      : { color: "hsl(220,14%,50%)" }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-0.5 rounded" style={{ background: ind.color }} />
                      {ind.label}
                    </div>
                    {ind.enabled && <Check className="h-3 w-3 shrink-0" style={{ color: ind.color }} />}
                  </button>
                ))}
                <div className="h-px my-1" style={{ background: "rgba(255,255,255,0.08)" }} />
                <div className="flex items-center justify-between px-1 mb-1">
                  <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,40%)" }}>Sub-pane</p>
                  {indicators.some(i => !i.isOverlay && i.enabled) && (
                    <button onClick={() => setIndicators(prev => prev.map(i => !i.isOverlay ? { ...i, enabled: false } : i))}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded transition-all"
                      style={{ color: "hsl(0,78%,65%)", background: "rgba(239,68,68,0.1)" }}>
                      clear
                    </button>
                  )}
                </div>
                {indicators.filter(i => !i.isOverlay).map(ind => (
                  <button
                    key={ind.id}
                    onClick={() => setIndicators(prev => prev.map(i => i.id === ind.id ? { ...i, enabled: !i.enabled } : i))}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono transition-all"
                    style={ind.enabled
                      ? { background: "rgba(255,255,255,0.06)", color: "hsl(220,14%,80%)" }
                      : { color: "hsl(220,14%,50%)" }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-0.5 rounded" style={{ background: ind.color }} />
                      {ind.label}
                    </div>
                    {ind.enabled && <Check className="h-3 w-3 shrink-0" style={{ color: ind.color }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Viral indicators quick preset */}
          <button
            onClick={() => {
              const allOn = VIRAL_INDICATOR_IDS.every(id => indicators.find(i => i.id === id)?.enabled);
              setIndicators(prev => prev.map(i =>
                (VIRAL_INDICATOR_IDS as readonly string[]).includes(i.id) ? { ...i, enabled: !allOn } : i
              ));
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
            style={VIRAL_INDICATOR_IDS.every(id => indicators.find(i => i.id === id)?.enabled)
              ? { background: "rgba(251,115,22,0.18)", borderColor: "rgba(251,115,22,0.4)", color: "hsl(28,100%,65%)", boxShadow: "0 0 16px rgba(251,115,22,0.2)" }
              : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}
          >
            <Flame className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Viral</span>
          </button>

          {/* Multi-TF toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMultiTf(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={showMultiTf
                ? { background: "rgba(100,180,255,0.12)", borderColor: "rgba(100,180,255,0.3)", color: "hsl(200,80%,65%)" }
                : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}
            >
              <SplitSquareVertical className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Multi-TF</span>
            </button>
            {showMultiTf && (
              <div onClick={e => e.stopPropagation()}>
                <Select value={multiTfInterval} onValueChange={v => setMultiTfInterval(v as GetKlinesInterval)}>
                  <SelectTrigger
                    className="h-8 text-xs font-mono border"
                    style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(100,180,255,0.25)", color: "hsl(200,80%,65%)", width: "4.5rem" }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map(iv => <SelectItem key={iv.value} value={iv.value} className="text-xs font-mono">{iv.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Layout save/load */}
          <div className="relative">
            <button
              onClick={() => { setShowLayoutPanel(v => !v); setShowIndicators(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={showLayoutPanel
                ? { background: "rgba(38,100%,55%,0.12)", borderColor: "rgba(245,158,11,0.3)", color: "hsl(38,100%,65%)" }
                : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}
            >
              <FolderOpen className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Layouts</span>
            </button>

            {showLayoutPanel && (
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-xl p-3 w-64 flex flex-col gap-2"
                style={{ background: "hsl(222,28%,11%)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
              >
                <p className="text-[9px] font-mono uppercase tracking-widest px-1" style={{ color: "hsl(220,14%,40%)" }}>Save Current Layout</p>
                <div className="flex gap-2">
                  <input
                    value={layoutNameInput}
                    onChange={e => setLayoutNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveLayout(); }}
                    placeholder="Layout name…"
                    className="flex-1 text-xs font-mono px-2 py-1.5 rounded-lg outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "hsl(220,14%,80%)" }}
                  />
                  <button onClick={handleSaveLayout} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg transition-all" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "hsl(38,100%,65%)" }}>
                    <Save className="h-3 w-3" />
                  </button>
                </div>

                {savedLayouts.length > 0 && (
                  <>
                    <div className="h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                    <p className="text-[9px] font-mono uppercase tracking-widest px-1" style={{ color: "hsl(220,14%,40%)" }}>Saved Layouts</p>
                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                      {savedLayouts.map(layout => (
                        <div key={layout.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono truncate" style={{ color: "hsl(220,14%,80%)" }}>{layout.name}</p>
                            <p className="text-[10px] font-mono" style={{ color: "hsl(220,14%,40%)" }}>
                              {layout.symbol} · {layout.interval} · {layout.drawings.length}d
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-2 shrink-0">
                            <button onClick={() => handleLoadLayout(layout)} className="h-6 w-6 flex items-center justify-center rounded text-xs transition-all hover:bg-cyan-500/10" style={{ color: "hsl(190,90%,60%)" }}>
                              <FolderOpen className="h-3 w-3" />
                            </button>
                            <button onClick={() => handleDeleteLayout(layout.id)} className="h-6 w-6 flex items-center justify-center rounded text-xs transition-all hover:bg-red-500/10" style={{ color: "hsl(0,85%,60%)" }}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowOrderPanel(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
            style={showOrderPanel
              ? { background: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.3)", color: "hsl(150,90%,65%)" }
              : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}
          >
            <TrendingUp className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Trade</span>
          </button>
          {!replayMode && (
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
          {!replayMode ? (
            <button
              onClick={enterReplay}
              disabled={!klines || klines.length < MIN_CANDLES}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.28)", color: "hsl(38,100%,62%)", boxShadow: "0 0 18px rgba(245,158,11,0.1)" }}
            >
              <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: "hsl(38,100%,60%)", boxShadow: "0 0 6px hsl(38,100%,55%)" }} />
              <span className="hidden sm:inline">Replay</span>
            </button>
          ) : (
            <button
              onClick={exitReplay}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={{ background: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.2)", color: "hsl(38,100%,50%)" }}
            >
              <X className="h-3 w-3" /> <span className="hidden sm:inline">Exit Replay</span>
            </button>
          )}
        </div>
      </div>

      {/* Click-away to close panels */}
      {(showIndicators || showLayoutPanel) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowIndicators(false); setShowLayoutPanel(false); }} />
      )}

      {/* ── Controls row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: "touch" }}>
        <Select value={symbol} onValueChange={handleSymbolChange}>
          <SelectTrigger className="h-8 text-xs font-mono border flex-shrink-0" disabled={replayMode} style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", minWidth: "7rem", maxWidth: "9rem" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {(["Crypto", "Futures", "Forex", "Indices", "Commodities", "Stocks"] as const).map(cat => {
              const items = SYMBOLS.filter(s => s.category === cat);
              if (!items.length) return null;
              return (
                <SelectGroup key={cat}>
                  <SelectLabel className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1">{cat}</SelectLabel>
                  {items.map(s => (
                    <SelectItem key={s.value} value={s.value} className="text-xs font-mono">
                      <span>{s.label}</span>
                      {s.sim && <span className="ml-1.5 text-[9px] opacity-50 font-sans">SIM</span>}
                    </SelectItem>
                  ))}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-0.5 rounded-lg p-0.5 border flex-shrink-0" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
          {INTERVALS.map(iv => (
            <button
              key={iv.value}
              onClick={() => handleIntervalChange(iv.value)}
              className="px-2 py-1 text-[11px] font-mono rounded-md transition-all"
              style={interval === iv.value
                ? { background: "rgba(0,229,255,0.15)", color: "hsl(190,90%,65%)", boxShadow: "0 0 12px rgba(0,229,255,0.15), inset 0 1px 0 rgba(0,229,255,0.1)" }
                : { color: "hsl(220,14%,55%)" }}
            >
              {iv.label}
            </button>
          ))}
        </div>

        {/* Chart type selector */}
        <div className="flex items-center gap-0.5 rounded-lg p-0.5 border flex-shrink-0" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
          {CHART_TYPES.map(ct => (
            <button
              key={ct.id}
              onClick={() => setChartType(ct.id)}
              title={ct.title}
              className="px-2 py-1 text-[11px] font-mono rounded-md transition-all"
              style={chartType === ct.id
                ? { background: "rgba(139,92,246,0.18)", color: "hsl(260,80%,75%)", boxShadow: "inset 0 1px 0 rgba(139,92,246,0.2)" }
                : { color: "hsl(220,14%,50%)" }}
            >
              {ct.label}
            </button>
          ))}
        </div>

        {replayMode && currentDate && (
          <span className="text-xs font-mono flex-shrink-0" style={{ color: "hsl(38,100%,65%)" }}>{currentDate}</span>
        )}
      </div>

      {/* ── Replay toolbar ───────────────────────────────────────── */}
      {replayMode && (
        <div className="rounded-xl border" style={{ background: "linear-gradient(180deg, rgba(245,158,11,0.06) 0%, rgba(245,158,11,0.02) 100%)", borderColor: "rgba(245,158,11,0.18)" }}>
          {/* Main controls row */}
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(245,158,11,0.08)" }}>

            {/* Transport */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={jumpToStart} disabled={replayIndex <= MIN_CANDLES} title="Jump to start"
                className="h-7 w-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:bg-white/5"
                style={{ color: "hsl(220,14%,55%)" }}><SkipBack className="h-3 w-3" /></button>
              <button onClick={stepBack} disabled={replayIndex <= MIN_CANDLES} title="Step back (←)"
                className="h-7 w-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:bg-white/5"
                style={{ color: "hsl(220,14%,55%)" }}><StepBack className="h-3.5 w-3.5" /></button>
              <button onClick={() => setIsPlaying(p => !p)} disabled={replayIndex >= total} title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                className="h-8 w-8 flex items-center justify-center rounded-lg border transition-all disabled:opacity-25 mx-0.5"
                style={isPlaying
                  ? { background: "hsl(38,100%,52%)", borderColor: "transparent", color: "#000", boxShadow: "0 0 14px rgba(245,158,11,0.45)" }
                  : { background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.3)", color: "hsl(38,100%,62%)" }}>
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-px" />}
              </button>
              <button onClick={stepForward} disabled={replayIndex >= total} title="Step forward (→)"
                className="h-7 w-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:bg-white/5"
                style={{ color: "hsl(220,14%,55%)" }}><StepForward className="h-3.5 w-3.5" /></button>
              <button onClick={jumpToEnd} disabled={replayIndex >= total} title="Jump to end"
                className="h-7 w-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:bg-white/5"
                style={{ color: "hsl(220,14%,55%)" }}><SkipForward className="h-3 w-3" /></button>
            </div>

            <div className="w-px h-4 flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }} />

            {/* Speed */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,35%)" }}>SPD</span>
              {SPEEDS.map(s => (
                <button key={s.value} onClick={() => setReplaySpeed(s.value)}
                  className="px-1.5 py-0.5 text-[10px] font-mono rounded transition-all"
                  style={replaySpeed === s.value
                    ? { background: "rgba(245,158,11,0.18)", color: "hsl(38,100%,65%)", border: "1px solid rgba(245,158,11,0.28)" }
                    : { color: "hsl(220,14%,38%)", border: "1px solid transparent" }}>
                  {s.label}
                </button>
              ))}
            </div>

            <div className="w-px h-4 flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }} />

            {/* Scrubber */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <input type="range" min={MIN_CANDLES} max={total} value={replayIndex}
                onChange={e => { setIsPlaying(false); setReplayIndex(Number(e.target.value)); }}
                className="flex-1 h-1 cursor-pointer rounded-full"
                style={{ accentColor: "hsl(38,100%,55%)" }} />
            </div>

            {/* Date + price + counter */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {currentDate && <span className="text-[10px] font-mono hidden md:block" style={{ color: "hsl(38,100%,55%)" }}>{currentDate}</span>}
              {currentBar && <span className="text-sm font-mono font-bold" style={{ color: isUp ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>${fmt(currentBar.close)}</span>}
              <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded"
                style={{ background: "rgba(245,158,11,0.08)", color: "hsl(38,100%,50%)", minWidth: "3.5rem", textAlign: "center" }}>
                {replayIndex}<span style={{ color: "hsl(220,14%,35%)" }}>/{total}</span>
              </span>
            </div>

            <div className="w-px h-4 flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }} />

            {/* Sidebar toggle */}
            <button
              onClick={() => setReplaySidebarOpen(v => !v)}
              title={replaySidebarOpen ? "Hide trade panel" : "Show trade panel (B/S)"}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono transition-all flex-shrink-0"
              style={replaySidebarOpen
                ? { background: "rgba(52,211,153,0.15)", color: "hsl(150,90%,60%)", border: "1px solid rgba(52,211,153,0.28)" }
                : { background: "rgba(255,255,255,0.04)", color: "hsl(220,14%,45%)", border: "1px solid rgba(255,255,255,0.08)" }}>
              B/S
            </button>
          </div>
        </div>
      )}

      {/* ── Chart area ───────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-2 flex-1 min-h-0">

        {/* ── Charts column ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto">

          {/* Main chart container */}
          <div
            className="relative rounded-xl overflow-hidden"
            style={{
              flex: (hasSubChart || showMultiTf) ? "0 0 auto" : "1 1 auto",
              height: (hasSubChart || showMultiTf) ? "min(320px, 42vh)" : "clamp(420px, calc(100vh - 260px), 700px)",
              minHeight: (hasSubChart || showMultiTf) ? "200px" : "380px",
              border: replayMode ? "1px solid rgba(245,158,11,0.25)" : "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {isLoading && <div className="absolute inset-0 z-10 p-4"><Skeleton className="w-full h-full" /></div>}
            {error && !isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center p-6">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <p className="text-sm text-muted-foreground">{(error as { data?: { error?: string } })?.data?.error ?? "Failed to load chart data"}</p>
                  <Button size="sm" variant="outline" onClick={handleRefresh}>Try again</Button>
                </div>
              </div>
            )}

            {/* Chart canvas */}
            <div ref={chartContainerRef} className="absolute inset-0" />

            {/* Doodle canvas */}
            <canvas
              ref={doodleCanvasRef}
              className="absolute inset-0 pointer-events-none"
              style={{ zIndex: 15, width: "100%", height: "100%" }}
            />

            {/* Drawing overlay */}
            <div
              className="absolute inset-0 z-20"
              style={{ cursor: activeTool === "cursor" ? "default" : activeTool === "eraser" ? "cell" : "crosshair", pointerEvents: activeTool === "cursor" ? "none" : "auto" }}
              onMouseDown={handleChartMouseDown}
              onMouseMove={e => {
                const rect = chartContainerRef.current?.getBoundingClientRect();
                if (!rect) return;
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setMousePos({ x, y });
                if (activeTool === "doodle" && isDoodlingRef.current) {
                  currentDoodleRef.current.push({ x, y });
                  const ctx = doodleCanvasRef.current?.getContext("2d");
                  if (ctx) {
                    ctx.strokeStyle = drawColor;
                    ctx.lineWidth = 2.5;
                    ctx.lineCap = "round";
                    ctx.lineJoin = "round";
                    ctx.lineTo(x, y);
                    ctx.stroke();
                  }
                }
              }}
              onMouseUp={() => {
                if (activeTool === "doodle" && isDoodlingRef.current) {
                  isDoodlingRef.current = false;
                  if (currentDoodleRef.current.length > 1) {
                    setDoodlePaths(prev => [...prev, { points: [...currentDoodleRef.current], color: drawColor }]);
                  }
                  currentDoodleRef.current = [];
                }
                setMousePos(null);
              }}
              onMouseLeave={() => { setMousePos(null); isDoodlingRef.current = false; }}
            />


            {/* Ghost preview while drawing */}
            {drawStart && mousePos && (activeTool === "trendline" || activeTool === "ray" || activeTool === "rectangle" || activeTool === "fibonacci") && (
              <svg
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 22, width: "100%", height: "100%", overflow: "visible" }}
              >
                <defs>
                  <filter id="glow-filter-lw">
                    <feGaussianBlur stdDeviation="2" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                <line
                  x1={drawStart.x} y1={drawStart.y}
                  x2={mousePos.x}  y2={mousePos.y}
                  stroke={drawColor} strokeWidth="1.5"
                  strokeDasharray="6 3" opacity="0.8"
                  filter="url(#glow-filter-lw)"
                />
                <circle cx={mousePos.x} cy={mousePos.y} r="3.5"
                  fill={drawColor} opacity="0.7" filter="url(#glow-filter-lw)" />
              </svg>
            )}

            {/* Drawing start-point indicator */}
            {drawStart && (
              <div className="absolute z-30 pointer-events-none" style={{ left: drawStart.x - 5, top: drawStart.y - 5 }}>
                <div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: drawColor, background: `${drawColor}30`, boxShadow: `0 0 10px ${drawColor}, 0 0 20px ${drawColor}50` }} />
              </div>
            )}

            {/* Watermark */}
            <div className="absolute top-3 left-3 pointer-events-none select-none" style={{ zIndex: 5 }}>
              <span className="text-4xl font-bold font-mono" style={{ color: "rgba(255,255,255,0.025)" }}>{displayLabel}</span>
            </div>

            {replayMode && replayIndex >= total && total > 0 && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 25 }}>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: "rgba(10,12,18,0.88)", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 20px rgba(245,158,11,0.08)" }}>
                  <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: "hsl(38,100%,58%)" }} />
                  <span className="text-xs font-mono" style={{ color: "hsl(38,100%,62%)" }}>End of data</span>
                  <span className="text-xs font-mono" style={{ color: "hsl(220,14%,40%)" }}>—</span>
                  <span className="text-xs font-mono" style={{ color: "hsl(220,14%,50%)" }}>all {total} bars shown</span>
                </div>
              </div>
            )}
            {activeTool !== "cursor" && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 25 }}>
                <span className="text-xs font-mono px-3 py-1.5 rounded-full" style={{ background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.25)", color: "hsl(190,90%,65%)", boxShadow: "0 0 20px rgba(0,229,255,0.15)" }}>
                  {activeTool === "hline" && "Click to place horizontal line"}
                  {activeTool === "trendline" && (drawStart ? "Click 2nd point to finish" : "Click to set start point")}
                  {activeTool === "ray" && (drawStart ? "Click 2nd point — ray extends infinitely" : "Click start point")}
                  {activeTool === "rectangle" && (drawStart ? "Click opposite corner to finish zone" : "Click first corner")}
                  {activeTool === "fibonacci" && (drawStart ? "Click second point for Fib levels" : "Click high or low to start")}
                  {activeTool === "eraser" && "Click to erase last drawing · Esc to cancel"}
                  {activeTool === "doodle" && "Draw freehand on the chart · release to finish"}
                </span>
              </div>
            )}
          </div>

          {/* ── Drawing toolbar — BELOW chart ────────────────────── */}
          {!replayMode && <div
            className="flex items-center gap-1 px-2 py-1.5 rounded-2xl overflow-x-auto"
            style={{ background: "rgba(10,12,18,0.88)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)", flexShrink: 0 }}
          >
            {DRAW_TOOLS.map(tool => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                title={`${tool.label} [${tool.key}]`}
                className="h-8 w-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
                style={activeTool === tool.id
                  ? { background: tool.id === "eraser" ? "rgba(239,68,68,0.2)" : "rgba(0,229,255,0.15)", color: tool.id === "eraser" ? "hsl(0,85%,65%)" : "hsl(190,90%,65%)", boxShadow: tool.id === "eraser" ? "0 0 12px rgba(239,68,68,0.3)" : "0 0 12px rgba(0,229,255,0.25)", border: `1px solid ${tool.id === "eraser" ? "rgba(239,68,68,0.3)" : "rgba(0,229,255,0.3)"}` }
                  : { color: "hsl(220,14%,50%)", border: "1px solid transparent" }}
              >
                {tool.icon}
              </button>
            ))}
            <div className="w-px h-5 bg-white/10 mx-1 flex-shrink-0" />
            {DRAW_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setDrawColor(c.value)}
                title={c.label}
                className="h-4 w-4 rounded-full flex-shrink-0 transition-all"
                style={{ background: c.value, transform: drawColor === c.value ? "scale(1.4)" : "scale(1)", boxShadow: drawColor === c.value ? `0 0 8px ${c.value}` : "none", outline: drawColor === c.value ? `2px solid ${c.value}` : "none", outlineOffset: "2px" }}
              />
            ))}
            {doodlePaths.length > 0 && (
              <>
                <div className="w-px h-5 bg-white/10 mx-1 flex-shrink-0" />
                <button
                  onClick={() => setDoodlePaths([])}
                  className="h-6 px-2 flex items-center justify-center gap-1 rounded-lg text-[9px] font-mono transition-all flex-shrink-0"
                  style={{ color: "hsl(38,100%,60%)", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
                  title="Clear doodles"
                ><Pencil className="h-3 w-3" /></button>
              </>
            )}
            {drawings.length > 0 && (
              <>
                <div className="w-px h-5 bg-white/10 mx-1 flex-shrink-0" />
                <button
                  onClick={() => {
                    drawings.forEach(d => {
                      if (d.kind === "hline") candleSeriesRef.current?.removePriceLine(d.priceLine);
                      if (d.kind === "trendline" || d.kind === "rectangle" || d.kind === "ray") chartRef.current?.removeSeries(d.series);
                      if (d.kind === "fibonacci") d.priceLines.forEach(pl => candleSeriesRef.current?.removePriceLine(pl));
                    });
                    setDrawings([]);
                  }}
                  className="h-6 px-2 flex items-center justify-center rounded-lg text-[9px] font-mono transition-all flex-shrink-0"
                  style={{ color: "hsl(0,85%,60%)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
                  title="Clear all drawings"
                ><Trash2 className="h-3 w-3" /></button>
              </>
            )}
          </div>}

          {/* ── Sub-chart: RSI / MACD / ATR / Stoch ─────────────── */}
          {hasSubChart && (
            <div
              className="relative rounded-xl overflow-hidden border flex-shrink-0"
              style={{ height: 120, borderColor: "rgba(255,255,255,0.06)", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}
            >
              <div className="absolute flex items-center gap-2 px-3 pt-2 pb-0 z-10 pointer-events-none flex-wrap">
                {hasRSI   && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.18)", color: "hsl(38,100%,65%)", border: "1px solid rgba(245,158,11,0.2)" }}>RSI 14</span>}
                {hasMACD  && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(0,229,255,0.12)", color: "hsl(190,90%,65%)", border: "1px solid rgba(0,229,255,0.2)" }}>MACD 12/26/9</span>}
                {hasATR   && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.15)", color: "hsl(260,80%,72%)", border: "1px solid rgba(139,92,246,0.2)" }}>ATR 14</span>}
                {hasStoch && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(52,211,153,0.12)", color: "hsl(150,90%,60%)", border: "1px solid rgba(52,211,153,0.2)" }}>Stoch 14/3</span>}
              </div>
              <div ref={subChartContainerRef} className="w-full h-full" />
            </div>
          )}

          {/* ── Multi-TF chart ───────────────────────────────────── */}
          {showMultiTf && (
            <div
              className="relative rounded-xl overflow-hidden border flex-shrink-0"
              style={{ height: 200, borderColor: "rgba(100,180,255,0.2)", boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(100,180,255,0.08)" }}
            >
              <div className="absolute flex items-center gap-2 px-3 pt-2 z-10 pointer-events-none">
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(100,180,255,0.12)", color: "hsl(200,80%,70%)", border: "1px solid rgba(100,180,255,0.25)" }}>
                  MTF · {displayLabel} · {INTERVALS.find(i => i.value === multiTfInterval)?.label ?? multiTfInterval}
                </span>
              </div>
              <div ref={multiTfContainerRef} className="w-full h-full" />
            </div>
          )}
        </div>

        {/* ── Trading sidebar ────────────────── */}
        {((replayMode && replaySidebarOpen) || (showOrderPanel && !replayMode)) && (
          <div className="w-full lg:w-[264px] flex flex-col gap-3 overflow-y-auto shrink-0">

            {/* Paper Trade panel — always-on, non-replay */}
            {showOrderPanel && !replayMode && (
              <div className="rounded-xl p-4 flex flex-col gap-3 border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", borderColor: "rgba(52,211,153,0.15)", boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(52,211,153,0.05)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "hsl(150,90%,55%)" }}>Paper Trade</span>
                  {(trades.length > 0 || position) && (
                    <button onClick={resetTrading} className="flex items-center gap-1 text-[10px] font-mono" style={{ color: "hsl(220,14%,40%)" }}>
                      <RotateCcw className="h-2.5 w-2.5" /> Reset
                    </button>
                  )}
                </div>

                {/* Order type */}
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{ color: "hsl(220,14%,40%)" }}>Order Type</p>
                  <div className="flex gap-0.5 p-0.5 rounded-lg border" style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.07)" }}>
                    {(["market", "limit", "stop"] as const).map(ot => (
                      <button key={ot} onClick={() => setChartOrderType(ot)}
                        className="flex-1 py-1.5 text-[10px] font-mono rounded-md transition-all"
                        style={chartOrderType === ot
                          ? { background: "rgba(0,229,255,0.15)", color: "hsl(190,90%,65%)", border: "1px solid rgba(0,229,255,0.25)" }
                          : { color: "hsl(220,14%,45%)", border: "1px solid transparent" }}>
                        {ot.charAt(0).toUpperCase() + ot.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price input */}
                {chartOrderType !== "market" && (
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{ color: "hsl(220,14%,40%)" }}>
                      {chartOrderType === "limit" ? "Limit Price" : "Stop Price"}
                    </p>
                    <input type="number"
                      value={chartOrderType === "limit" ? chartLimitPrice : chartStopPrice}
                      onChange={e => chartOrderType === "limit" ? setChartLimitPrice(e.target.value) : setChartStopPrice(e.target.value)}
                      placeholder={currentBar ? fmt(currentBar.close) : "price"}
                      className="w-full text-xs font-mono px-2.5 py-2 rounded-lg outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "hsl(220,14%,80%)" }}
                    />
                  </div>
                )}

                {/* Leverage */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,40%)" }}>Leverage</p>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "hsl(38,95%,65%)", border: "1px solid rgba(245,158,11,0.2)" }}>{chartLeverage}x</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {[1, 2, 5, 10, 25].map(lev => (
                      <button key={lev} onClick={() => setChartLeverage(lev)}
                        className="px-2 py-0.5 text-[10px] font-mono rounded transition-all"
                        style={chartLeverage === lev
                          ? { background: "rgba(245,158,11,0.14)", color: "hsl(38,95%,65%)", border: "1px solid rgba(245,158,11,0.28)" }
                          : { background: "rgba(255,255,255,0.04)", color: "hsl(220,14%,45%)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        {lev}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Open position display */}
                {position && (
                  <div className="rounded-lg p-3 border" style={{ background: "rgba(52,211,153,0.05)", borderColor: "rgba(52,211,153,0.15)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: "hsl(150,90%,55%)", boxShadow: "0 0 6px hsl(150,90%,55%)" }} />
                        <span className="text-xs font-mono font-semibold" style={{ color: "hsl(150,90%,60%)" }}>LONG {chartLeverage}x</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "hsl(190,90%,55%)" }} />
                        <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(190,90%,55%)" }}>Live</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs font-mono mb-2">
                      <div>
                        <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,14%,40%)" }}>Entry</p>
                        <p className="font-bold">${fmt(position.price)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,14%,40%)" }}>Current</p>
                        <p className="font-bold">${fmt(liveChartPrice)}</p>
                      </div>
                    </div>
                    {unrealizedPnl !== null && unrealizedPct !== null && (
                      <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                        <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: "hsl(220,14%,40%)" }}>Unrealized P&L</p>
                        <p className="text-base font-mono font-bold" style={{ color: unrealizedPnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)", textShadow: unrealizedPnl >= 0 ? "0 0 20px rgba(52,211,153,0.4)" : "0 0 20px rgba(239,68,68,0.4)" }}>{fmtPnl(unrealizedPnl)}</p>
                        <p className="text-[10px] font-mono mt-0.5" style={{ color: unrealizedPnl >= 0 ? "hsl(150,90%,50%)" : "hsl(0,78%,55%)" }}>{fmtPct(unrealizedPct)}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Equity + P&L summary */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div><p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,14%,40%)" }}>Equity</p><p className="font-bold" style={{ color: equityGain >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p></div>
                  <div><p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,14%,40%)" }}>P&L</p><p className="font-bold" style={{ color: totalPnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>{fmtPnl(totalPnl)}</p></div>
                </div>

                {/* Buy / Sell / Close */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: position?.side === "short" ? "CLOSE SHORT" : "BUY LONG",
                      disabled: !currentBar || position?.side === "long",
                      onClick: () => {
                        if (!currentBar) return;
                        if (chartOrderType === "market") { handleBuy(currentBar); }
                        else { const price = Number(chartOrderType === "limit" ? chartLimitPrice : chartStopPrice); if (price) setPendingChartOrders(prev => [...prev, { id: Date.now(), side: "buy" as const, orderType: chartOrderType as "limit" | "stop", price }]); }
                      },
                      style: { background: "linear-gradient(135deg, hsl(150,80%,28%), hsl(150,80%,22%))", borderColor: "rgba(52,211,153,0.3)", color: "hsl(150,90%,65%)" } },
                    { label: position?.side === "long" ? "CLOSE LONG" : "SELL SHORT",
                      disabled: !currentBar || position?.side === "short",
                      onClick: () => { if (currentBar) handleSell(currentBar, position ?? undefined); },
                      style: { background: "linear-gradient(135deg, hsl(0,70%,28%), hsl(0,70%,22%))", borderColor: "rgba(239,68,68,0.3)", color: "hsl(0,85%,70%)" } },
                  ].map(btn => (
                    <button key={btn.label} disabled={btn.disabled} onClick={btn.onClick}
                      className="flex items-center justify-center py-2 rounded-lg border font-mono font-bold text-xs transition-all disabled:opacity-25"
                      style={btn.disabled ? { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "hsl(220,14%,40%)" } : btn.style}
                    >{btn.label}</button>
                  ))}
                </div>
                {currentBar && <p className="text-[10px] text-center font-mono" style={{ color: "hsl(220,14%,35%)" }}>price ${fmt(currentBar.close)}</p>}

                {/* Pending orders */}
                {pendingChartOrders.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,38%)" }}>Pending ({pendingChartOrders.length})</p>
                    {pendingChartOrders.map(o => (
                      <div key={o.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="flex-1 text-[10px] font-mono" style={{ color: o.side === "buy" ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>
                          {o.side.toUpperCase()} {o.orderType.toUpperCase()} @ ${fmt(o.price)}
                        </p>
                        <button onClick={() => setPendingChartOrders(prev => prev.filter(p => p.id !== o.id))}
                          className="h-5 w-5 flex items-center justify-center rounded" style={{ color: "hsl(0,78%,60%)" }}>
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Replay simulator ─────────────────────────────── */}
            {replayMode && (
              <div className="flex flex-col gap-3">

                {/* Header: session info */}
                <div className="rounded-xl border overflow-hidden" style={{ background: "linear-gradient(160deg, rgba(245,158,11,0.07) 0%, rgba(245,158,11,0.02) 100%)", borderColor: "rgba(245,158,11,0.18)" }}>
                  <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(245,158,11,0.1)" }}>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "hsl(38,100%,60%)", boxShadow: "0 0 6px hsl(38,100%,55%)" }} />
                      <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(38,100%,55%)" }}>Replay Mode</span>
                    </div>
                    <button onClick={resetTrading} className="flex items-center gap-1 text-[10px] font-mono transition-colors hover:opacity-80" style={{ color: "hsl(220,14%,38%)" }}>
                      <RotateCcw className="h-2.5 w-2.5" /> Reset
                    </button>
                  </div>
                  <div className="px-3 py-2.5">
                    {currentDate && <p className="text-[10px] font-mono mb-1" style={{ color: "hsl(38,100%,50%)" }}>{currentDate}</p>}
                    {currentBar ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-mono font-bold" style={{ color: isUp ? "hsl(150,90%,60%)" : "hsl(0,85%,62%)" }}>${fmt(currentBar.close)}</span>
                        {changePercent && (
                          <span className="text-xs font-mono" style={{ color: isUp ? "hsl(150,90%,50%)" : "hsl(0,85%,55%)" }}>
                            {isUp ? "+" : ""}{changePercent}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="h-7 flex items-center">
                        <span className="text-xs font-mono" style={{ color: "hsl(220,14%,35%)" }}>Waiting for data…</span>
                      </div>
                    )}
                    {/* Progress bar */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full transition-all duration-150" style={{ width: `${replayProgress}%`, background: "linear-gradient(90deg, hsl(38,100%,45%), hsl(38,100%,60%))" }} />
                      </div>
                      <span className="text-[9px] font-mono tabular-nums flex-shrink-0" style={{ color: "hsl(220,14%,40%)" }}>{replayProgress.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                {/* Trade controls */}
                <div className="rounded-xl border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)", borderColor: "rgba(255,255,255,0.07)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
                  <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,42%)" }}>Position</span>
                    {currentBar && <span className="text-[10px] font-mono" style={{ color: "hsl(220,14%,32%)" }}>at close ${fmt(currentBar.close)}</span>}
                  </div>

                  <div className="px-3 py-2.5">
                    {position ? (
                      <div className="rounded-lg px-3 py-2.5 mb-3 border" style={position.side === "short"
                        ? { background: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.18)" }
                        : { background: "rgba(52,211,153,0.05)", borderColor: "rgba(52,211,153,0.18)" }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: position.side === "short" ? "hsl(0,85%,62%)" : "hsl(150,90%,55%)" }} />
                            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: position.side === "short" ? "hsl(0,85%,65%)" : "hsl(150,90%,60%)" }}>
                              {position.side === "short" ? "Short" : "Long"}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono" style={{ color: "hsl(220,14%,40%)" }}>{fmtDate(position.time)}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-mono" style={{ color: "hsl(220,14%,50%)" }}>Entry <span className="text-sm font-bold" style={{ color: "hsl(220,14%,75%)" }}>${fmt(position.price)}</span></span>
                          {unrealizedPnl !== null && unrealizedPct !== null && (
                            <div className="text-right">
                              <p className="text-sm font-mono font-bold leading-none" style={{ color: unrealizedPnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)", textShadow: unrealizedPnl >= 0 ? "0 0 16px rgba(52,211,153,0.35)" : "0 0 16px rgba(239,68,68,0.35)" }}>
                                {fmtPnl(unrealizedPnl)}
                              </p>
                              <p className="text-[10px] font-mono" style={{ color: unrealizedPnl >= 0 ? "hsl(150,80%,45%)" : "hsl(0,75%,55%)" }}>{fmtPct(unrealizedPct)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg px-3 py-2.5 mb-3 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.07)" }}>
                        <p className="text-[10px] font-mono" style={{ color: "hsl(220,14%,32%)" }}>No open position</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        disabled={!currentBar || position?.side === "long"}
                        onClick={() => currentBar && handleBuy(currentBar)}
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border font-mono font-bold text-sm transition-all disabled:opacity-20"
                        style={(!currentBar || position?.side === "long")
                          ? { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)", color: "hsl(220,14%,38%)" }
                          : { background: "linear-gradient(160deg, hsl(150,75%,22%), hsl(150,75%,17%))", borderColor: "rgba(52,211,153,0.28)", color: "hsl(150,90%,65%)", boxShadow: "0 4px 18px rgba(52,211,153,0.12), inset 0 1px 0 rgba(52,211,153,0.12)" }}
                      >
                        <TrendingUp className="h-3.5 w-3.5" />
                        {position?.side === "short" ? "CLOSE" : "BUY"}
                        <span className="text-[9px] opacity-50">[B]</span>
                      </button>
                      <button
                        disabled={!currentBar || position?.side === "short"}
                        onClick={() => currentBar && handleSell(currentBar, position ?? undefined)}
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border font-mono font-bold text-sm transition-all disabled:opacity-20"
                        style={(!currentBar || position?.side === "short")
                          ? { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)", color: "hsl(220,14%,38%)" }
                          : { background: "linear-gradient(160deg, hsl(0,65%,24%), hsl(0,65%,18%))", borderColor: "rgba(239,68,68,0.28)", color: "hsl(0,85%,68%)", boxShadow: "0 4px 18px rgba(239,68,68,0.12), inset 0 1px 0 rgba(239,68,68,0.1)" }}
                      >
                        <TrendingDown className="h-3.5 w-3.5" />
                        {position?.side === "long" ? "CLOSE" : "SELL"}
                        <span className="text-[9px] opacity-50">[S]</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Session stats */}
                <div className="rounded-xl border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)", borderColor: "rgba(255,255,255,0.07)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
                  <div className="px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,42%)" }}>Session</span>
                  </div>
                  <div className="px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-wider mb-0.5" style={{ color: "hsl(220,14%,36%)" }}>Equity</p>
                      <p className="text-sm font-mono font-bold leading-none" style={{ color: equityGain >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>
                        ${equity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-[10px] font-mono mt-0.5" style={{ color: equityGain >= 0 ? "hsl(150,70%,40%)" : "hsl(0,70%,48%)" }}>{fmtPct(equityGainPct)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-wider mb-0.5" style={{ color: "hsl(220,14%,36%)" }}>Realized P&L</p>
                      <p className="text-sm font-mono font-bold leading-none" style={{ color: totalPnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>{fmtPnl(totalPnl)}</p>
                      <p className="text-[10px] font-mono mt-0.5" style={{ color: "hsl(220,14%,38%)" }}>{trades.length} trade{trades.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-wider mb-0.5" style={{ color: "hsl(220,14%,36%)" }}>Win Rate</p>
                      <p className="text-sm font-mono font-bold leading-none" style={{ color: trades.length > 0 ? (winRate >= 50 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)") : "hsl(220,14%,45%)" }}>
                        {trades.length > 0 ? `${winRate.toFixed(0)}%` : "—"}
                      </p>
                      <p className="text-[10px] font-mono mt-0.5" style={{ color: "hsl(220,14%,38%)" }}>
                        {trades.length > 0 ? `${wins}W · ${trades.length - wins}L` : "no trades yet"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-wider mb-0.5" style={{ color: "hsl(220,14%,36%)" }}>Capital</p>
                      <p className="text-sm font-mono font-bold leading-none" style={{ color: "hsl(220,14%,58%)" }}>${ptCapital.toLocaleString()}</p>
                      <p className="text-[10px] font-mono mt-0.5" style={{ color: "hsl(220,14%,35%)" }}>starting</p>
                    </div>
                  </div>
                </div>

                {/* Trade log */}
                <div className="rounded-xl border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)", borderColor: "rgba(255,255,255,0.07)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
                  <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,42%)" }}>Trade Log</span>
                    {trades.length > 0 && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "hsl(220,14%,45%)" }}>{trades.length}</span>}
                  </div>
                  {trades.length === 0 ? (
                    <div className="px-3 py-5 text-center">
                      <p className="text-[10px] font-mono leading-relaxed" style={{ color: "hsl(220,14%,30%)" }}>No closed trades yet.<br />Press <kbd className="px-1 rounded" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "hsl(220,14%,45%)" }}>B</kbd> to buy, <kbd className="px-1 rounded" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "hsl(220,14%,45%)" }}>S</kbd> to sell.</p>
                    </div>
                  ) : (
                    <div className="overflow-y-auto max-h-[180px] px-2 py-2 space-y-1.5">
                      {[...trades].reverse().map((t, i) => (
                        <div key={t.id} className="rounded-lg px-2.5 py-2 border"
                          style={t.pnl >= 0
                            ? { background: "rgba(52,211,153,0.04)", borderColor: "rgba(52,211,153,0.12)" }
                            : { background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.1)" }}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-mono" style={{ color: "hsl(220,14%,38%)" }}>#{trades.length - i}</span>
                            <span className="text-xs font-mono font-bold" style={{ color: t.pnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>
                              {fmtPnl(t.pnl)} <span className="text-[10px] font-normal opacity-75">({fmtPct(t.pnlPct)})</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-mono" style={{ color: "hsl(220,14%,42%)" }}>
                            <span style={{ color: "hsl(150,80%,50%)" }}>B</span>
                            <span>${fmt(t.entryPrice)}</span>
                            <span style={{ color: "hsl(220,14%,30%)" }}>→</span>
                            <span style={{ color: "hsl(0,75%,60%)" }}>S</span>
                            <span>${fmt(t.exitPrice)}</span>
                          </div>
                          <div className="text-[9px] font-mono mt-0.5" style={{ color: "hsl(220,14%,30%)" }}>
                            {fmtDate(t.entryTime)} → {fmtDate(t.exitTime)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
