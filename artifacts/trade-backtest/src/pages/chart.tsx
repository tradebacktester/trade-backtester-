import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useBinanceLivePrice, useBinancePrices } from "@/lib/use-binance-ws";
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
  PriceScaleMode,
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
  AlertCircle, RefreshCw, Play, Pause, SkipBack, SkipForward,
  StepBack, StepForward, Clapperboard, X, TrendingUp, TrendingDown,
  RotateCcw, MousePointer2, Minus, GitCommit, Hash, Eraser,
  BarChart2, Save, SplitSquareVertical, Trash2, Check, Layers,
  Flame, Bell, BellOff, ArrowLeftRight, BookOpen, List,
  CalendarClock, GitBranch, Type, Triangle,
  Sun, Moon, Keyboard, Crosshair,
} from "lucide-react";
import {
  calcSMA, calcEMA, calcBB, calcRSI, calcMACD, calcVWAP, calcATR, calcStochastic,
  calcIchimoku, calcSupertrend, calcParabolicSAR,
  calcOBV, calcWilliamsR, calcCCI, calcADX, calcVolumeProfile,
  calcHMA, calcDEMA, calcTEMA, calcKeltner, calcDonchian,
  generateSimData,
  loadIndicators, persistIndicators,
  loadLayouts, saveLayouts,
  loadAlerts, saveAlerts,
  type DrawnObject, type DrawTool, type DrawStart, type OhlcState,
  type KlineBar, type Position, type SimTrade,
  type IndicatorConfig, type SerializableDrawing, type IndicatorId,
  type ChartLayout, type PriceAlert,
} from "@/lib/chart-utils";

// ── Constants ──────────────────────────────────────────────────────────

const SYMBOLS = [
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
  { value: "BTCPERP",  label: "BTC Perp",  category: "Futures",     sim: true,  basePrice: 67500  },
  { value: "ETHPERP",  label: "ETH Perp",  category: "Futures",     sim: true,  basePrice: 3530   },
  { value: "SOLPERP",  label: "SOL Perp",  category: "Futures",     sim: true,  basePrice: 183    },
  { value: "EURUSD",   label: "EUR/USD",   category: "Forex",       sim: true,  basePrice: 1.0825 },
  { value: "GBPUSD",   label: "GBP/USD",   category: "Forex",       sim: true,  basePrice: 1.2685 },
  { value: "USDJPY",   label: "USD/JPY",   category: "Forex",       sim: true,  basePrice: 153.45 },
  { value: "AUDUSD",   label: "AUD/USD",   category: "Forex",       sim: true,  basePrice: 0.6530 },
  { value: "USDCAD",   label: "USD/CAD",   category: "Forex",       sim: true,  basePrice: 1.3680 },
  { value: "USDCHF",   label: "USD/CHF",   category: "Forex",       sim: true,  basePrice: 0.9020 },
  { value: "NZDUSD",   label: "NZD/USD",   category: "Forex",       sim: true,  basePrice: 0.5985 },
  { value: "EURGBP",   label: "EUR/GBP",   category: "Forex",       sim: true,  basePrice: 0.8535 },
  { value: "SPX500",   label: "S&P 500",   category: "Indices",     sim: true,  basePrice: 5280   },
  { value: "NAS100",   label: "Nasdaq 100",category: "Indices",     sim: true,  basePrice: 18420  },
  { value: "DOW30",    label: "Dow Jones", category: "Indices",     sim: true,  basePrice: 39500  },
  { value: "UK100",    label: "FTSE 100",  category: "Indices",     sim: true,  basePrice: 8320   },
  { value: "GER40",    label: "DAX 40",    category: "Indices",     sim: true,  basePrice: 18700  },
  { value: "JPN225",   label: "Nikkei 225",category: "Indices",     sim: true,  basePrice: 38200  },
  { value: "XAUUSD",   label: "Gold",      category: "Commodities", sim: true,  basePrice: 2320   },
  { value: "XAGUSD",   label: "Silver",    category: "Commodities", sim: true,  basePrice: 27.4   },
  { value: "WTIUSD",   label: "WTI Oil",   category: "Commodities", sim: true,  basePrice: 82.5   },
  { value: "NATGAS",   label: "Nat. Gas",  category: "Commodities", sim: true,  basePrice: 2.1    },
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
const CHART_BG   = "hsl(222,22%,8%)";
const CHART_TEXT  = "hsl(218,12%,52%)";
const CHART_FONT  = "'JetBrains Mono', Menlo, monospace";

const DARK_THEME  = { bg: CHART_BG, text: CHART_TEXT, grid: "hsla(220,20%,30%,0.15)", xhair: "hsla(190,90%,60%,0.6)", xhairLbl: "hsl(222,28%,12%)", border: "hsla(220,20%,30%,0.3)" };
const LIGHT_THEME = { bg: "#f0f2f5", text: "#374151",  grid: "rgba(0,0,0,0.08)",       xhair: "rgba(10,80,180,0.65)",     xhairLbl: "#dde5ee",           border: "rgba(0,0,0,0.13)"  };

// ── Helpers ────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 });
}
function fmtDate(unixSec: number) {
  return new Date(unixSec * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function fmtPnl(n: number) {
  return `${n >= 0 ? "+" : ""}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`; }

function readPtCapital(): number {
  try {
    const v = (JSON.parse(localStorage.getItem("pt_account") || "null") as { initialCapital?: number } | null);
    return v?.initialCapital ?? 10_000;
  } catch { return 10_000; }
}
function savePtTrade(trade: { id: number; entryPrice: number; entryTime: number; exitPrice: number; exitTime: number; units: number; pnl: number; pnlPct: number; side?: string; symbol?: string }) {
  // Normalise shape so ai-assistant.tsx (status/openedAt/closedAt) can read it correctly
  const normalized = {
    ...trade,
    status: "closed",
    openedAt: new Date(trade.entryTime).toISOString(),
    closedAt: new Date(trade.exitTime).toISOString(),
  };
  try {
    const prev = JSON.parse(localStorage.getItem("pt_trades") || "[]") as typeof normalized[];
    localStorage.setItem("pt_trades", JSON.stringify([...prev, normalized]));
  } catch {}
  // Also persist to server for logged-in users (fire and forget)
  const token = localStorage.getItem("tt_token");
  if (token) {
    fetch("/api/paper/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        symbol: trade.symbol ?? "UNKNOWN",
        side: trade.side ?? "long",
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        units: trade.units,
        pnl: trade.pnl,
        pnlPct: trade.pnlPct,
        entryTime: trade.entryTime,
        exitTime: trade.exitTime,
      }),
    }).catch(() => {});
  }
}
function updatePtBalance(balance: number) {
  try {
    const acc = JSON.parse(localStorage.getItem("pt_account") || "null") as Record<string, unknown> | null;
    if (acc) localStorage.setItem("pt_account", JSON.stringify({ ...acc, balance }));
  } catch {}
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

function makeChartOptions(hideTimeScale = false, logScale = false, theme: "dark" | "light" = "dark") {
  const t = theme === "light" ? LIGHT_THEME : DARK_THEME;
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: t.bg },
      textColor: t.text,
      fontFamily: CHART_FONT,
      fontSize: 11,
    },
    grid: {
      vertLines: { color: t.grid },
      horzLines: { color: t.grid },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: t.xhair, width: 1 as const, style: 2, labelBackgroundColor: t.xhairLbl },
      horzLine: { color: t.xhair, width: 1 as const, style: 2, labelBackgroundColor: t.xhairLbl },
    },
    rightPriceScale: {
      borderColor: t.border,
      mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    },
    timeScale: {
      borderColor: t.border,
      timeVisible: true,
      secondsVisible: false,
      visible: !hideTimeScale,
    },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
    handleScale:  { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
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

  // Paper trading
  const [ptCapital, setPtCapital] = useState<number>(readPtCapital);
  // Never auto-open on load — paper trading is opt-in (HIGH-002 fix)
  const [accountModalOpen, setAccountModalOpen] = useState<boolean>(false);
  const [customCapitalInput, setCustomCapitalInput] = useState("");
  const [position, setPosition] = useState<Position | null>(null);
  const [trades, setTrades] = useState<SimTrade[]>([]);
  const [equity, setEquity] = useState<number>(readPtCapital);
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
  const [drawStart2, setDrawStart2] = useState<DrawStart | null>(null); // for 3-point tools
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; price: number; time: Time } | null>(null);
  const [textValue, setTextValue] = useState("");

  // Chart type
  const [chartType, setChartType] = useState<ChartType>("candlestick");

  // Indicators
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(loadIndicators);
  const [showIndicators, setShowIndicators] = useState(false);

  // Multi-TF
  const [showMultiTf, setShowMultiTf] = useState(false);
  const [multiTfInterval, setMultiTfInterval] = useState<GetKlinesInterval>(GetKlinesInterval["1w"]);

  // Log/Linear scale
  const [logScale, setLogScale] = useState(false);

  // Compare symbol
  const [compareSymbol, setCompareSymbol] = useState<string | null>(null);
  const [showComparePanel, setShowComparePanel] = useState(false);
  const compareSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Price alerts
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>(loadAlerts);
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [alertInput, setAlertInput] = useState("");
  const alertPriceLinesRef = useRef<Map<number, IPriceLine>>(new Map());

  // Watchlist
  const [showWatchlist, setShowWatchlist] = useState(false);

  // Volume Profile
  const [showVPVR, setShowVPVR] = useState(false);
  const [vpvrBuckets, setVpvrBuckets] = useState<{ price: number; volume: number; pct: number }[]>([]);

  // Go to date
  const [goToDate, setGoToDate] = useState("");

  // Save layouts
  const [showSaveLayout, setShowSaveLayout] = useState(false);
  const [layoutName, setLayoutName] = useState("");
  const [savedLayouts, setSavedLayouts] = useState<ChartLayout[]>(loadLayouts);
  const [showLoadLayout, setShowLoadLayout] = useState(false);

  // Chart theme, magnet mode, shortcuts panel
  const [chartTheme, setChartTheme] = useState<"dark" | "light">("dark");
  const [magnetMode, setMagnetMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef           = useRef<IChartApi | null>(null);
  const candleSeriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const altSeriesRef       = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef    = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersPluginRef   = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const sortedKlinesRef    = useRef<KlineBar[]>([]);
  const markersRef         = useRef<SeriesMarker<Time>[]>([]);
  const drawingsRef        = useRef<DrawnObject[]>([]);
  const indicatorPanelRef  = useRef<HTMLDivElement>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line"> | ISeriesApi<"Line">[]>>(new Map());

  // Sub-chart
  const subChartContainerRef = useRef<HTMLDivElement>(null);
  const subChartRef          = useRef<IChartApi | null>(null);
  const subSeriesRef         = useRef<Map<string, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>>(new Map());
  const subPrimarySeriesRef  = useRef<ISeriesApi<"Line"> | null>(null);

  // Multi-TF chart
  const multiTfContainerRef = useRef<HTMLDivElement>(null);
  const multiTfChartRef     = useRef<IChartApi | null>(null);
  const multiTfCandleRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const isSyncingRef       = useRef(false);
  const pendingRestoreRef  = useRef<SerializableDrawing[] | null>(null);
  const replayIndexRef     = useRef(replayIndex);
  const positionRef        = useRef(position);
  useEffect(() => { replayIndexRef.current = replayIndex; }, [replayIndex]);
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { drawingsRef.current = drawings; }, [drawings]);

  const queryClient = useQueryClient();

  // ── Sim symbol support ─────────────────────────────────────────────
  const currentSymbolDef = SYMBOLS.find(s => s.value === symbol);
  const isSim = currentSymbolDef?.sim ?? false;
  const displayLabel    = currentSymbolDef?.label ?? symbol;
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

  const simBars = useMemo(() => {
    if (!isSim || !currentSymbolDef) return null;
    const intervalSec = interval === "1m" ? 60 : interval === "5m" ? 300 : interval === "15m" ? 900 :
      interval === "1h" ? 3600 : interval === "4h" ? 14400 : interval === "1w" ? 604800 : 86400;
    return generateSimData(symbol, currentSymbolDef.basePrice, 500, intervalSec);
  }, [isSim, symbol, currentSymbolDef, interval]);

  const klines   = isSim ? simBars : apiKlines;
  const isLoading = isSim ? false : apiLoading;
  const error     = isSim ? null : apiError;

  const lastKlineClose  = klines && klines.length > 0 ? klines[klines.length - 1].close : 100;
  const liveChartPrice  = useBinanceLivePrice(symbol, isSim, lastKlineClose);

  // ── Multi-TF ───────────────────────────────────────────────────────
  const multiTfParams = { symbol, interval: multiTfInterval, limit: 300 };
  const { data: multiTfKlines } = useGetKlines(multiTfParams, {
    query: { enabled: showMultiTf, queryKey: getGetKlinesQueryKey(multiTfParams), staleTime: 60_000 },
  });

  // ── Compare symbol data ────────────────────────────────────────────
  const compareSymbolDef = compareSymbol ? SYMBOLS.find(s => s.value === compareSymbol) : null;
  const compareIsSim     = compareSymbolDef?.sim ?? true;

  const compareParams = { symbol: compareSymbol ?? "BTCUSDT", interval, limit: 500 };
  const { data: compareApiKlines } = useGetKlines(compareParams, {
    query: {
      enabled: !!(compareSymbol && !compareIsSim),
      queryKey: getGetKlinesQueryKey(compareParams),
      staleTime: 60_000,
    },
  });

  const compareBars = useMemo(() => {
    if (!compareSymbol || !compareSymbolDef) return null;
    if (compareIsSim) {
      const intervalSec = interval === "1m" ? 60 : interval === "5m" ? 300 : interval === "15m" ? 900 :
        interval === "1h" ? 3600 : interval === "4h" ? 14400 : interval === "1w" ? 604800 : 86400;
      return generateSimData(compareSymbol, compareSymbolDef.basePrice, 500, intervalSec);
    }
    return compareApiKlines ?? null;
  }, [compareSymbol, compareSymbolDef, compareIsSim, compareApiKlines, interval]);

  // ── Derived ────────────────────────────────────────────────────────
  const hasRSI        = !!indicators.find(i => i.id === "rsi")?.enabled;
  const hasMACD       = !!indicators.find(i => i.id === "macd")?.enabled;
  const hasATR        = !!indicators.find(i => i.id === "atr")?.enabled;
  const hasStoch      = !!indicators.find(i => i.id === "stoch")?.enabled;
  const hasOBV        = !!indicators.find(i => i.id === "obv")?.enabled;
  const hasWilliamsR  = !!indicators.find(i => i.id === "williams_r")?.enabled;
  const hasCCI        = !!indicators.find(i => i.id === "cci")?.enabled;
  const hasADX        = !!indicators.find(i => i.id === "adx")?.enabled;
  const hasHMA        = !!indicators.find(i => i.id === "hma")?.enabled;
  const hasDEMA       = !!indicators.find(i => i.id === "dema")?.enabled;
  const hasTEMA       = !!indicators.find(i => i.id === "tema")?.enabled;
  const hasKeltner    = !!indicators.find(i => i.id === "keltner")?.enabled;
  const hasDonchian   = !!indicators.find(i => i.id === "donchian")?.enabled;
  const hasSubChart   = indicators.some(i => !i.isOverlay && i.enabled);

  const sorted       = sortedKlinesRef.current;
  const total        = sorted.length;
  const currentBar   = replayMode
    ? sorted[Math.min(replayIndex, total) - 1] ?? null
    : klines && klines.length > 0 ? klines[klines.length - 1] : null;
  const isUp          = currentBar ? currentBar.close >= currentBar.open : true;
  const changePercent = currentBar ? (((currentBar.close - currentBar.open) / currentBar.open) * 100).toFixed(2) : null;
  const displayBar    = ohlcDisplay ?? (currentBar ? { ...currentBar, time: "" } : null);
  const replayProgress = total > 0 ? (replayIndex / total) * 100 : 0;
  const currentDate   = replayMode && currentBar ? fmtDate(currentBar.time) : null;

  const livePrice       = replayMode ? (currentBar?.close ?? 0) : liveChartPrice;
  const unrealizedPnl   = position ? (position.side === "short" ? (position.price - livePrice) * position.units : (livePrice - position.price) * position.units) : null;
  const unrealizedPct   = position ? (position.side === "short" ? ((position.price - livePrice) / position.price) * 100 : ((livePrice - position.price) / position.price) * 100) : null;

  const wins      = trades.filter(t => t.pnl > 0).length;
  const winRate   = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const totalPnl  = trades.reduce((s, t) => s + t.pnl, 0);
  const equityGain    = equity - ptCapital;
  const equityGainPct = (equityGain / ptCapital) * 100;

  // ── Monitor pending orders ─────────────────────────────────────────
  useEffect(() => {
    if (!pendingChartOrders.length || !currentBar) return;
    const price     = currentBar.close;
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

  // ── Draw tools definition ──────────────────────────────────────────
  const DRAW_TOOLS: { id: DrawTool; icon: React.ReactNode; label: string; key: string }[] = [
    { id: "cursor",           icon: <MousePointer2 className="h-3.5 w-3.5" />,                label: "Select",    key: "Esc" },
    { id: "hline",            icon: <Minus className="h-3.5 w-3.5" />,                         label: "H-Line",    key: "H" },
    { id: "trendline",        icon: <GitCommit className="h-3.5 w-3.5 rotate-45" />,           label: "Trend",     key: "T" },
    { id: "ray",              icon: <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="2" y1="12" x2="12" y2="2"/><polyline points="8,2 12,2 12,6" fill="none"/></svg>, label: "Ray", key: "R" },
    { id: "fibonacci",        icon: <Hash className="h-3.5 w-3.5" />,                          label: "Fib",       key: "F" },
    { id: "rectangle",        icon: <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="10" height="8" rx="1"/></svg>, label: "Rect", key: "Q" },
    { id: "parallel_channel", icon: <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="4" x2="12" y2="4"/><line x1="2" y1="10" x2="12" y2="10"/></svg>, label: "Channel", key: "C" },
    { id: "pitchfork",        icon: <GitBranch className="h-3.5 w-3.5" />,                     label: "Pitchfork", key: "P" },
    { id: "text",             icon: <Type className="h-3.5 w-3.5" />,                          label: "Text",      key: "X" },
    { id: "eraser",           icon: <Eraser className="h-3.5 w-3.5" />,                        label: "Erase",     key: "E" },
  ];

  // ── Coord helpers ──────────────────────────────────────────────────
  const getChartCoords = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect    = chartContainerRef.current!.getBoundingClientRect();
    const x       = e.clientX - rect.left;
    const y       = e.clientY - rect.top;
    let   price   = candleSeriesRef.current?.coordinateToPrice(y) ?? null;
    const logical = chartRef.current?.timeScale().coordinateToLogical(x) ?? null;
    let time: Time | null = null;
    if (logical !== null) {
      const idx = Math.max(0, Math.min(Math.round(Number(logical)), sortedKlinesRef.current.length - 1));
      const bar = sortedKlinesRef.current[idx];
      time = (bar?.time ?? null) as Time | null;
      if (magnetMode && bar && price !== null) {
        const candidates = [bar.open, bar.high, bar.low, bar.close];
        const raw = Number(price);
        const snapped = candidates.reduce((best, v) => Math.abs(v - raw) < Math.abs(best - raw) ? v : best);
        return { x, y, price: snapped, time };
      }
    }
    return { x, y, price: price !== null ? Number(price) : null, time };
  }, [magnetMode]);

  // ── Drawing helpers ────────────────────────────────────────────────
  const eraseLastDrawing = useCallback(() => {
    const list = drawingsRef.current;
    if (!list.length || !chartRef.current || !candleSeriesRef.current) return;
    const last = list[list.length - 1];
    if (last.kind === "hline")            candleSeriesRef.current.removePriceLine(last.priceLine);
    if (last.kind === "text")             candleSeriesRef.current.removePriceLine(last.priceLine);
    if (last.kind === "trendline")        chartRef.current.removeSeries(last.series);
    if (last.kind === "fibonacci")        last.priceLines.forEach(pl => candleSeriesRef.current!.removePriceLine(pl));
    if (last.kind === "rectangle")        { chartRef.current.removeSeries(last.series); chartRef.current.removeSeries(last.series2); }
    if (last.kind === "ray")              chartRef.current.removeSeries(last.series);
    if (last.kind === "parallel_channel") { chartRef.current.removeSeries(last.series); chartRef.current.removeSeries(last.series2); }
    if (last.kind === "pitchfork")        { chartRef.current.removeSeries(last.series); chartRef.current.removeSeries(last.series2); chartRef.current.removeSeries(last.series3); }
    setDrawings(prev => prev.slice(0, -1));
  }, []);

  const handleChartMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === "cursor") return;
    e.preventDefault();
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

    if (activeTool === "text") {
      setTextInput({ x, y, price, time });
      return;
    }

    // 2-point tools
    if (activeTool === "trendline" || activeTool === "fibonacci" || activeTool === "ray" || activeTool === "rectangle") {
      if (!drawStart) {
        setDrawStart({ x, y, price, time });
      } else {
        const p1 = drawStart.price; const t1 = drawStart.time as number;
        const p2 = price;           const t2 = time as number;
        const id = Date.now();

        if (activeTool === "trendline") {
          const pts = t1 <= t2
            ? [{ time: t1 as Time, value: p1 }, { time: t2 as Time, value: p2 }]
            : [{ time: t2 as Time, value: p2 }, { time: t1 as Time, value: p1 }];
          const series = chartRef.current!.addSeries(LineSeries, { color: drawColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
          series.setData(pts);
          setDrawings(prev => [...prev, { kind: "trendline", series, id, color: drawColor, p1: { time: t1, price: p1 }, p2: { time: t2, price: p2 } }]);
        } else if (activeTool === "ray") {
          const bars  = sortedKlinesRef.current;
          const slope = t2 !== t1 ? (p2 - p1) / (t2 - t1) : 0;
          const tStart = Math.min(t1, t2);
          const tEnd   = bars.length > 0 ? bars[bars.length - 1].time + 100 * 86400 : t2 + 100 * 86400;
          const pts = [
            { time: tStart as Time, value: p1 },
            { time: (tStart + (tEnd - tStart) / 2) as Time, value: p1 + slope * (tStart + (tEnd - tStart) / 2 - t1) },
            { time: tEnd as Time, value: p1 + slope * (tEnd - t1) },
          ];
          const series = chartRef.current!.addSeries(LineSeries, { color: drawColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, lineStyle: LineStyle.SparseDotted });
          series.setData(pts);
          setDrawings(prev => [...prev, { kind: "ray", series, id, color: drawColor, p1: { time: t1, price: p1 }, p2: { time: t2, price: p2 } }]);
        } else if (activeTool === "rectangle") {
          const tMin = Math.min(t1, t2) as Time; const tMax = Math.max(t1, t2) as Time;
          const pMin = Math.min(p1, p2);         const pMax = Math.max(p1, p2);
          const opts = { color: drawColor, lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
          const s  = chartRef.current!.addSeries(LineSeries, opts);
          s.setData([{ time: tMin, value: pMax }, { time: tMax, value: pMax }]);
          const s2 = chartRef.current!.addSeries(LineSeries, opts);
          s2.setData([{ time: tMin, value: pMin }, { time: tMax, value: pMin }]);
          setDrawings(prev => [...prev, { kind: "rectangle", series: s, series2: s2, id, color: drawColor, p1: { time: t1, price: p1 }, p2: { time: t2, price: p2 } }]);
        } else {
          // Fibonacci
          const high = Math.max(p1, p2); const low = Math.min(p1, p2); const range = high - low;
          const priceLines: IPriceLine[] = FIB_LEVELS.map(({ pct, color, label }) =>
            candleSeriesRef.current!.createPriceLine({ price: high - range * pct, color, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: label })
          );
          setDrawings(prev => [...prev, { kind: "fibonacci", priceLines, id, high, low, color: drawColor }]);
        }
        setDrawStart(null);
        setActiveTool("cursor");
      }
      return;
    }

    // Parallel channel: 2-point (top line), then 3rd click sets channel width
    if (activeTool === "parallel_channel") {
      if (!drawStart) {
        setDrawStart({ x, y, price, time });
      } else if (!drawStart2) {
        setDrawStart2({ x, y, price, time });
      } else {
        // 3rd click: offset for bottom line
        const t1 = drawStart.time as number;  const p1 = drawStart.price;
        const t2 = drawStart2.time as number; const p2 = drawStart2.price;
        const offset = price - (p1 + (p2 - p1) * ((time as number - t1) / (t2 - t1 || 1)));
        const tMin = Math.min(t1, t2) as Time; const tMax = Math.max(t1, t2) as Time;
        const opts = { color: drawColor, lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
        const top = chartRef.current!.addSeries(LineSeries, opts);
        const bot = chartRef.current!.addSeries(LineSeries, opts);
        top.setData(t1 <= t2
          ? [{ time: tMin, value: p1 }, { time: tMax, value: p2 }]
          : [{ time: tMin, value: p2 }, { time: tMax, value: p1 }]);
        bot.setData(t1 <= t2
          ? [{ time: tMin, value: p1 + offset }, { time: tMax, value: p2 + offset }]
          : [{ time: tMin, value: p2 + offset }, { time: tMax, value: p1 + offset }]);
        const id = Date.now();
        setDrawings(prev => [...prev, { kind: "parallel_channel", series: top, series2: bot, id, color: drawColor, p1: { time: t1, price: p1 }, p2: { time: t2, price: p2 }, p3: { time: time as number, price } }]);
        setDrawStart(null); setDrawStart2(null); setActiveTool("cursor");
      }
      return;
    }

    // Andrews pitchfork: 3 points
    if (activeTool === "pitchfork") {
      if (!drawStart) {
        setDrawStart({ x, y, price, time });
      } else if (!drawStart2) {
        setDrawStart2({ x, y, price, time });
      } else {
        const t1 = drawStart.time  as number; const p1 = drawStart.price;
        const t2 = drawStart2.time as number; const p2 = drawStart2.price;
        const t3 = time as number;             const p3 = price;
        const midT = (t2 + t3) / 2; const midP = (p2 + p3) / 2;
        const bars = sortedKlinesRef.current;
        const tEnd = bars.length > 0 ? bars[bars.length - 1].time + 100 * 86400 : t3 + 100 * 86400;
        const slope = midT !== t1 ? (midP - p1) / (midT - t1) : 0;
        const opts  = { color: drawColor, lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
        // Median line
        const med = chartRef.current!.addSeries(LineSeries, opts);
        med.setData([{ time: t1 as Time, value: p1 }, { time: tEnd as Time, value: p1 + slope * (tEnd - t1) }]);
        // Upper tine (from p2, parallel to median)
        const tine1 = chartRef.current!.addSeries(LineSeries, { ...opts, lineStyle: LineStyle.Dashed });
        tine1.setData([{ time: t2 as Time, value: p2 }, { time: tEnd as Time, value: p2 + slope * (tEnd - t2) }]);
        // Lower tine (from p3, parallel to median)
        const tine2 = chartRef.current!.addSeries(LineSeries, { ...opts, lineStyle: LineStyle.Dashed });
        tine2.setData([{ time: t3 as Time, value: p3 }, { time: tEnd as Time, value: p3 + slope * (tEnd - t3) }]);
        const id = Date.now();
        setDrawings(prev => [...prev, { kind: "pitchfork", series: med, series2: tine1, series3: tine2, id, color: drawColor, p1: { time: t1, price: p1 }, p2: { time: t2, price: p2 }, p3: { time: t3, price: p3 } }]);
        setDrawStart(null); setDrawStart2(null); setActiveTool("cursor");
      }
      return;
    }
  }, [activeTool, drawColor, drawStart, drawStart2, eraseLastDrawing, getChartCoords]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput || !textValue.trim() || !candleSeriesRef.current) return;
    const priceLine = candleSeriesRef.current.createPriceLine({
      price: textInput.price, color: drawColor, lineWidth: 1, lineStyle: LineStyle.Dotted,
      axisLabelVisible: true, title: `◆ ${textValue.trim()}`,
    });
    setDrawings(prev => [...prev, { kind: "text", priceLine, id: Date.now(), price: textInput.price, time: textInput.time as number, text: textValue.trim(), color: drawColor }]);
    setTextInput(null); setTextValue(""); setActiveTool("cursor");
  }, [textInput, textValue, drawColor]);

  // Cancel pending draw on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (drawStart || drawStart2 || textInput)) {
        setDrawStart(null); setDrawStart2(null); setTextInput(null); setTextValue(""); setActiveTool("cursor");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawStart, drawStart2, textInput]);

  // ── Trading helpers ────────────────────────────────────────────────
  const applyMarkers = useCallback(() => {
    if (markersPluginRef.current) markersPluginRef.current.setMarkers([...markersRef.current]);
  }, []);

  const resetTrading = useCallback(() => {
    setPosition(null); setTrades([]); setEquity(ptCapital);
    localStorage.removeItem("pt_trades");
    updatePtBalance(ptCapital);
    markersRef.current = []; applyMarkers();
    // Also reset server-side trades for logged-in users
    const token = localStorage.getItem("tt_token");
    if (token) {
      fetch("/api/paper/trades", {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      }).catch(() => {});
    }
  }, [applyMarkers, ptCapital]);

  const handleBuy = useCallback((bar: KlineBar, priceOverride?: number) => {
    const exitPrice = priceOverride ?? bar.close;
    if (position?.side === "short") {
      const pnl = position.units * (position.price - exitPrice);
      const pnlPct = (pnl / position.capitalAtEntry) * 100;
      const newEquity = position.capitalAtEntry + pnl;
      const trade = { id: Date.now(), entryPrice: position.price, entryTime: position.time * 1000, exitPrice, exitTime: bar.time * 1000, units: position.units, pnl, pnlPct, side: "short" as const, symbol };
      setTrades(prev => [...prev, trade]); setPosition(null); setEquity(newEquity);
      savePtTrade(trade); updatePtBalance(newEquity);
      if (candleSeriesRef.current && entryPriceLineRef.current) { try { candleSeriesRef.current.removePriceLine(entryPriceLineRef.current); } catch { /**/ } entryPriceLineRef.current = null; }
      const marker: SeriesMarker<Time> = { time: bar.time as Time, position: "belowBar", color: pnl >= 0 ? "hsl(150,90%,55%)" : "hsl(0,85%,60%)", shape: "arrowUp", text: `SC ${fmtPct(pnlPct)}`, size: 1 };
      markersRef.current = [...markersRef.current, marker].sort((a, b) => (a.time as number) - (b.time as number));
      applyMarkers(); return;
    }
    if (position?.side === "long") return;
    const units = (equity * chartLeverage) / exitPrice;
    setPosition({ price: exitPrice, time: bar.time, units, capitalAtEntry: equity, side: "long" });
    if (candleSeriesRef.current) {
      if (entryPriceLineRef.current) { try { candleSeriesRef.current.removePriceLine(entryPriceLineRef.current); } catch { /**/ } }
      entryPriceLineRef.current = candleSeriesRef.current.createPriceLine({ price: exitPrice, color: "hsl(150,90%,55%)", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `▲ Long ${chartLeverage}x` });
    }
    const marker: SeriesMarker<Time> = { time: bar.time as Time, position: "belowBar", color: "hsl(150,90%,55%)", shape: "arrowUp", text: `B $${fmt(exitPrice)}`, size: 1 };
    markersRef.current = [...markersRef.current, marker].sort((a, b) => (a.time as number) - (b.time as number));
    applyMarkers();
  }, [position, equity, chartLeverage, applyMarkers, symbol]);

  const handleSell = useCallback((bar: KlineBar, pos?: Position) => {
    const currentPos = pos ?? position;
    const exitPrice  = bar.close;
    if (currentPos?.side === "long") {
      const pnl = currentPos.units * (exitPrice - currentPos.price);
      const pnlPct = (pnl / currentPos.capitalAtEntry) * 100;
      const newEquity = currentPos.capitalAtEntry + pnl;
      const trade = { id: Date.now(), entryPrice: currentPos.price, entryTime: currentPos.time * 1000, exitPrice, exitTime: bar.time * 1000, units: currentPos.units, pnl, pnlPct, side: "long" as const, symbol };
      setTrades(prev => [...prev, trade]); setPosition(null); setEquity(newEquity);
      savePtTrade(trade); updatePtBalance(newEquity);
      if (candleSeriesRef.current && entryPriceLineRef.current) { try { candleSeriesRef.current.removePriceLine(entryPriceLineRef.current); } catch { /**/ } entryPriceLineRef.current = null; }
      const marker: SeriesMarker<Time> = { time: bar.time as Time, position: "aboveBar", color: pnl >= 0 ? "hsl(150,90%,55%)" : "hsl(0,85%,60%)", shape: "arrowDown", text: `S ${fmtPct(pnlPct)}`, size: 1 };
      markersRef.current = [...markersRef.current, marker].sort((a, b) => (a.time as number) - (b.time as number));
      applyMarkers(); return;
    }
    if (currentPos?.side === "short") return;
    const units = (equity * chartLeverage) / exitPrice;
    setPosition({ price: exitPrice, time: bar.time, units, capitalAtEntry: equity, side: "short" });
    if (candleSeriesRef.current) {
      if (entryPriceLineRef.current) { try { candleSeriesRef.current.removePriceLine(entryPriceLineRef.current); } catch { /**/ } }
      entryPriceLineRef.current = candleSeriesRef.current.createPriceLine({ price: exitPrice, color: "hsl(0,85%,62%)", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `▼ Short ${chartLeverage}x` });
    }
    const marker: SeriesMarker<Time> = { time: bar.time as Time, position: "aboveBar", color: "hsl(0,85%,62%)", shape: "arrowDown", text: `SS $${fmt(exitPrice)}`, size: 1 };
    markersRef.current = [...markersRef.current, marker].sort((a, b) => (a.time as number) - (b.time as number));
    applyMarkers();
  }, [position, equity, chartLeverage, applyMarkers, symbol]);

  // ── Replay helpers ─────────────────────────────────────────────────
  const enterReplay = useCallback(() => {
    setIsPlaying(false); setReplayIndex(MIN_CANDLES); setReplayMode(true);
    setReplaySidebarOpen(false); setPosition(null); setTrades([]); setEquity(ptCapital);
    markersRef.current = []; markersPluginRef.current?.setMarkers([]);
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
    if (replayMode) { setIsPlaying(false); setReplayIndex(MIN_CANDLES); setPosition(null); setTrades([]); setEquity(ptCapital); markersRef.current = []; }
    setInterval(val as GetKlinesInterval);
  }, [replayMode, ptCapital]);

  // ── Auto-play ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || !replayMode) return;
    const id = window.setInterval(() => {
      setReplayIndex(i => { const t = sortedKlinesRef.current.length; if (i >= t) { setIsPlaying(false); return i; } return i + 1; });
    }, replaySpeed);
    return () => window.clearInterval(id);
  }, [isPlaying, replayMode, replaySpeed]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
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
      if (e.key === "q") setActiveTool("rectangle");
      if (e.key === "c") setActiveTool("parallel_channel");
      if (e.key === "p") setActiveTool("pitchfork");
      if (e.key === "x") setActiveTool("text");
      if (e.key === "m" || e.key === "M") setMagnetMode(v => !v);
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) setShowShortcuts(v => !v);
      if (e.key === "Escape" && !drawStart && !drawStart2 && !textInput) { setActiveTool("cursor"); setShowShortcuts(false); if (replayMode) exitReplay(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [replayMode, stepForward, stepBack, exitReplay, handleBuy, handleSell, drawStart, drawStart2, textInput]);

  // ── Chart init ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const container = chartContainerRef.current;
    const chart = createChart(container, makeChartOptions(false, logScale));

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "hsl(150,90%,52%)",   downColor: "hsl(0,85%,58%)",
      borderUpColor: "hsl(150,90%,52%)", borderDownColor: "hsl(0,85%,58%)",
      wickUpColor: "hsl(150,80%,45%)",   wickDownColor: "hsl(0,75%,50%)",
      priceLineVisible: true, priceLineColor: "hsla(190,90%,60%,0.7)",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "hsl(190,90%,50%)", priceFormat: { type: "volume" }, priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });

    chart.subscribeCrosshairMove(param => {
      if (param.time && candleSeriesRef.current) {
        const bar = param.seriesData.get(candleSeriesRef.current) as { open: number; high: number; low: number; close: number } | undefined;
        const vol = volumeSeriesRef.current ? (param.seriesData.get(volumeSeriesRef.current) as { value: number } | undefined)?.value : undefined;
        if (bar) setOhlcDisplay({ ...bar, volume: vol, time: new Date((param.time as number) * 1000).toLocaleDateString(), pxX: param.point?.x, pxY: param.point?.y });
        else setOhlcDisplay(null);
      } else setOhlcDisplay(null);

      if (subChartRef.current && subPrimarySeriesRef.current && param.time) {
        try { subChartRef.current.setCrosshairPosition(0, param.time, subPrimarySeriesRef.current); } catch { /* ignore */ }
      } else if (subChartRef.current && !param.time) {
        try { subChartRef.current.clearCrosshairPosition(); } catch { /* ignore */ }
      }
      if (multiTfChartRef.current && multiTfCandleRef.current && param.time) {
        try { multiTfChartRef.current.setCrosshairPosition(0, param.time, multiTfCandleRef.current); } catch { /* ignore */ }
      } else if (multiTfChartRef.current && !param.time) {
        try { multiTfChartRef.current.clearCrosshairPosition(); } catch { /* ignore */ }
      }
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (isSyncingRef.current || !range) return;
      isSyncingRef.current = true;
      try { subChartRef.current?.timeScale().setVisibleLogicalRange(range); } catch { /* ignore */ }
      isSyncingRef.current = false;
    });

    markersPluginRef.current = createSeriesMarkers(candleSeries, []);
    chartRef.current         = chart;
    candleSeriesRef.current  = candleSeries;
    volumeSeriesRef.current  = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null; candleSeriesRef.current = null; altSeriesRef.current = null;
      volumeSeriesRef.current = null; markersPluginRef.current = null;
      indicatorSeriesRef.current.clear();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Log scale toggle ───────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.priceScale("right").applyOptions({
      mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
  }, [logScale]);

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

    if (altSeriesRef.current && (chartType === "candlestick" || chartType === "hollow" || chartType === "heikin_ashi")) {
      try { chart.removeSeries(altSeriesRef.current); } catch { /* ignore */ }
      altSeriesRef.current = null;
    }

    if (chartType === "candlestick") {
      candleSeriesRef.current.applyOptions({ upColor: "hsl(150,90%,52%)", downColor: "hsl(0,85%,58%)", borderUpColor: "hsl(150,90%,52%)", borderDownColor: "hsl(0,85%,58%)", wickUpColor: "hsl(150,80%,45%)", wickDownColor: "hsl(0,75%,50%)" });
      candleSeriesRef.current.setData(slice.map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
    } else if (chartType === "hollow") {
      candleSeriesRef.current.applyOptions({ upColor: "transparent", downColor: "hsl(0,85%,58%)", borderUpColor: "hsl(150,90%,52%)", borderDownColor: "hsl(0,85%,58%)", wickUpColor: "hsl(150,80%,45%)", wickDownColor: "hsl(0,75%,50%)" });
      candleSeriesRef.current.setData(slice.map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
    } else if (chartType === "heikin_ashi") {
      candleSeriesRef.current.applyOptions({ upColor: "hsl(150,90%,52%)", downColor: "hsl(0,85%,58%)", borderUpColor: "hsl(150,90%,52%)", borderDownColor: "hsl(0,85%,58%)", wickUpColor: "hsl(150,80%,45%)", wickDownColor: "hsl(0,75%,50%)" });
      candleSeriesRef.current.setData(calcHeikinAshi(slice).map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
    } else {
      candleSeriesRef.current.setData([]);
      if (altSeriesRef.current) { try { chart.removeSeries(altSeriesRef.current); } catch { /* ignore */ } altSeriesRef.current = null; }
      if (chartType === "line") {
        const s = chart.addSeries(LineSeries, { color: "hsl(190,90%,55%)", lineWidth: 2, priceLineVisible: true, lastValueVisible: true, crosshairMarkerVisible: true });
        s.setData(slice.map(k => ({ time: k.time as Time, value: k.close })));
        altSeriesRef.current = s;
      } else if (chartType === "area") {
        const s = chart.addSeries(AreaSeries, { lineColor: "hsl(190,90%,55%)", topColor: "hsla(190,90%,55%,0.32)", bottomColor: "hsla(190,90%,55%,0.0)", lineWidth: 2, priceLineVisible: true, lastValueVisible: true, crosshairMarkerVisible: true });
        s.setData(slice.map(k => ({ time: k.time as Time, value: k.close })));
        altSeriesRef.current = s as unknown as ISeriesApi<"Line">;
      } else if (chartType === "bar") {
        const s = chart.addSeries(BarSeries, { upColor: "hsl(150,90%,52%)", downColor: "hsl(0,85%,58%)" });
        s.setData(slice.map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
        altSeriesRef.current = s as unknown as ISeriesApi<"Line">;
      }
    }

    chart.timeScale().fitContent();
    markersPluginRef.current?.setMarkers([...markersRef.current]);

    // Restore pending layout drawings
    if (pendingRestoreRef.current) {
      const toRestore = pendingRestoreRef.current;
      pendingRestoreRef.current = null;
      restoreDrawingsFromData(toRestore, sortedData);
    }

    // Update VPVR
    if (showVPVR) setVpvrBuckets(calcVolumeProfile(slice));
  }, [klines, replayMode, replayIndex, chartType, showVPVR]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Compare symbol overlay ─────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!compareSymbol || !compareBars || !klines) {
      if (compareSeriesRef.current) { try { chart.removeSeries(compareSeriesRef.current); } catch { /* ignore */ } compareSeriesRef.current = null; }
      return;
    }
    if (compareSeriesRef.current) { try { chart.removeSeries(compareSeriesRef.current); } catch { /* ignore */ } compareSeriesRef.current = null; }

    const mainBars = [...klines].sort((a, b) => a.time - b.time);
    const compBars = [...compareBars].sort((a, b) => a.time - b.time);
    if (!mainBars.length || !compBars.length) return;

    // Normalize compare to start at same price as main
    const mainBase = mainBars[0].close;
    const compBase = compBars[0].close;
    const normalized = compBars.map(b => ({ time: b.time as Time, value: mainBase * (b.close / compBase) }));

    const s = chart.addSeries(LineSeries, {
      color: "hsl(260,80%,70%)", lineWidth: 2,
      priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: true,
      title: compareSymbolDef?.label ?? compareSymbol,
    });
    s.setData(normalized);
    compareSeriesRef.current = s;
  }, [compareSymbol, compareBars, klines, compareSymbolDef]);

  // ── Price alerts effect ────────────────────────────────────────────
  useEffect(() => {
    const cs = candleSeriesRef.current;
    if (!cs) return;
    // Remove old price lines and re-create
    alertPriceLinesRef.current.forEach(pl => { try { cs.removePriceLine(pl); } catch { /* ignore */ } });
    alertPriceLinesRef.current.clear();
    for (const alert of priceAlerts) {
      const pl = cs.createPriceLine({
        price: alert.price,
        color: alert.triggered ? "hsl(0,85%,62%)" : "hsl(38,100%,55%)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `⚠ ${alert.label || fmt(alert.price)}`,
      });
      alertPriceLinesRef.current.set(alert.id, pl);
    }
  }, [priceAlerts, klines]); // re-run when klines change (chart re-init rebuilds series)

  // Check if current bar crosses any alert
  useEffect(() => {
    if (!currentBar || !priceAlerts.length) return;
    const price = currentBar.close;
    let changed = false;
    const updated = priceAlerts.map(a => {
      if (!a.triggered && Math.abs(price - a.price) / a.price < 0.002) { changed = true; return { ...a, triggered: true }; }
      return a;
    });
    if (changed) { setPriceAlerts(updated); saveAlerts(updated); }
  }, [currentBar]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── VPVR update ────────────────────────────────────────────────────
  useEffect(() => {
    if (!showVPVR) return;
    const bars = sortedKlinesRef.current;
    if (!bars.length) return;
    const slice = replayMode ? bars.slice(0, replayIndex) : bars;
    setVpvrBuckets(calcVolumeProfile(slice));
  }, [showVPVR, replayIndex, replayMode]);

  // ── Indicator overlay series ───────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const bars     = sortedKlinesRef.current;
    const seriesMap = indicatorSeriesRef.current;

    const overlayIds: IndicatorId[] = ["sma20","sma50","ema9","ema20","ema50","bb","vwap","ichimoku","supertrend","psar","hma","dema","tema","keltner","donchian"];

    for (const ind of indicators.filter(i => overlayIds.includes(i.id as IndicatorId))) {
      if (ind.enabled) {
        // ── SMA ──────────────────────────────────────────────────────
        if (ind.id === "sma20" || ind.id === "sma50") {
          let s = seriesMap.get(ind.id) as ISeriesApi<"Line"> | undefined;
          if (!s) { s = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }); seriesMap.set(ind.id, s); }
          if (bars.length >= ind.period) s.setData(calcSMA(bars, ind.period).map(d => ({ time: d.time as Time, value: d.value })));
        }
        // ── EMA ──────────────────────────────────────────────────────
        if (ind.id === "ema9" || ind.id === "ema20" || ind.id === "ema50") {
          let s = seriesMap.get(ind.id) as ISeriesApi<"Line"> | undefined;
          if (!s) { s = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }); seriesMap.set(ind.id, s); }
          if (bars.length >= ind.period) s.setData(calcEMA(bars, ind.period).map(d => ({ time: d.time as Time, value: d.value })));
        }
        // ── BB ───────────────────────────────────────────────────────
        if (ind.id === "bb") {
          let arr = seriesMap.get("bb") as ISeriesApi<"Line">[] | undefined;
          if (!arr) {
            const opts = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
            arr = [
              chart.addSeries(LineSeries, { ...opts, color: "hsla(200,80%,65%,0.7)" }),
              chart.addSeries(LineSeries, { ...opts, color: "hsla(200,80%,65%,0.4)", lineStyle: LineStyle.Dashed }),
              chart.addSeries(LineSeries, { ...opts, color: "hsla(200,80%,65%,0.7)" }),
            ];
            seriesMap.set("bb", arr);
          }
          if (bars.length >= ind.period) {
            const { upper, middle, lower } = calcBB(bars, ind.period);
            arr[0].setData(upper.map(d => ({ time: d.time as Time, value: d.value })));
            arr[1].setData(middle.map(d => ({ time: d.time as Time, value: d.value })));
            arr[2].setData(lower.map(d => ({ time: d.time as Time, value: d.value })));
          }
        }
        // ── VWAP ─────────────────────────────────────────────────────
        if (ind.id === "vwap") {
          let s = seriesMap.get("vwap") as ISeriesApi<"Line"> | undefined;
          if (!s) { s = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false }); seriesMap.set("vwap", s); }
          if (bars.length > 1) s.setData(calcVWAP(bars).map(d => ({ time: d.time as Time, value: d.value })));
        }
        // ── Ichimoku ─────────────────────────────────────────────────
        if (ind.id === "ichimoku" && bars.length >= 52) {
          let arr = seriesMap.get("ichimoku") as ISeriesApi<"Line">[] | undefined;
          if (!arr) {
            const base = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
            arr = [
              chart.addSeries(LineSeries, { ...base, color: "hsl(0,85%,60%)" }),         // tenkan
              chart.addSeries(LineSeries, { ...base, color: "hsl(190,90%,55%)" }),        // kijun
              chart.addSeries(LineSeries, { ...base, color: "hsla(150,80%,55%,0.6)" }),   // spanA
              chart.addSeries(LineSeries, { ...base, color: "hsla(0,80%,60%,0.6)" }),     // spanB
              chart.addSeries(LineSeries, { ...base, color: "hsla(260,80%,65%,0.5)", lineStyle: LineStyle.Dotted }), // chikou
            ];
            seriesMap.set("ichimoku", arr);
          }
          const ichi = calcIchimoku(bars);
          arr[0].setData(ichi.tenkan.map(d => ({ time: d.time as Time, value: d.value })));
          arr[1].setData(ichi.kijun.map(d  => ({ time: d.time as Time, value: d.value })));
          arr[2].setData(ichi.spanA.map(d  => ({ time: d.time as Time, value: d.value })));
          arr[3].setData(ichi.spanB.map(d  => ({ time: d.time as Time, value: d.value })));
          arr[4].setData(ichi.chikou.map(d => ({ time: d.time as Time, value: d.value })));
        }
        // ── Supertrend ───────────────────────────────────────────────
        if (ind.id === "supertrend" && bars.length >= 12) {
          let arr = seriesMap.get("supertrend") as ISeriesApi<"Line">[] | undefined;
          if (!arr) {
            const base = { lineWidth: 2 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
            arr = [
              chart.addSeries(LineSeries, { ...base, color: "hsl(150,90%,55%)" }),   // up
              chart.addSeries(LineSeries, { ...base, color: "hsl(0,85%,60%)" }),     // down
            ];
            seriesMap.set("supertrend", arr);
          }
          const st = calcSupertrend(bars, 10, 3);
          arr[0].setData(st.up.map(d   => ({ time: d.time as Time, value: d.value })));
          arr[1].setData(st.down.map(d => ({ time: d.time as Time, value: d.value })));
        }
        // ── Parabolic SAR ────────────────────────────────────────────
        if (ind.id === "psar" && bars.length >= 4) {
          let arr = seriesMap.get("psar") as ISeriesApi<"Line">[] | undefined;
          if (!arr) {
            const base = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, lineStyle: LineStyle.SparseDotted };
            arr = [
              chart.addSeries(LineSeries, { ...base, color: "hsl(150,90%,55%)" }),
              chart.addSeries(LineSeries, { ...base, color: "hsl(0,85%,60%)" }),
            ];
            seriesMap.set("psar", arr);
          }
          const psar = calcParabolicSAR(bars);
          arr[0].setData(psar.up.map(d   => ({ time: d.time as Time, value: d.value })));
          arr[1].setData(psar.down.map(d => ({ time: d.time as Time, value: d.value })));
        }
        // ── HMA ──────────────────────────────────────────────────────
        if (ind.id === "hma") {
          let s = seriesMap.get("hma") as ISeriesApi<"Line"> | undefined;
          if (!s) { s = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }); seriesMap.set("hma", s); }
          const data = calcHMA(bars, ind.period);
          if (data.length) s.setData(data.map(d => ({ time: d.time as Time, value: d.value })));
        }
        // ── DEMA ─────────────────────────────────────────────────────
        if (ind.id === "dema") {
          let s = seriesMap.get("dema") as ISeriesApi<"Line"> | undefined;
          if (!s) { s = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }); seriesMap.set("dema", s); }
          const data = calcDEMA(bars, ind.period);
          if (data.length) s.setData(data.map(d => ({ time: d.time as Time, value: d.value })));
        }
        // ── TEMA ─────────────────────────────────────────────────────
        if (ind.id === "tema") {
          let s = seriesMap.get("tema") as ISeriesApi<"Line"> | undefined;
          if (!s) { s = chart.addSeries(LineSeries, { color: ind.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }); seriesMap.set("tema", s); }
          const data = calcTEMA(bars, ind.period);
          if (data.length) s.setData(data.map(d => ({ time: d.time as Time, value: d.value })));
        }
        // ── Keltner Channels ─────────────────────────────────────────
        if (ind.id === "keltner") {
          let arr = seriesMap.get("keltner") as ISeriesApi<"Line">[] | undefined;
          if (!arr) {
            const opts = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
            arr = [
              chart.addSeries(LineSeries, { ...opts, color: `${ind.color}` }),
              chart.addSeries(LineSeries, { ...opts, color: `${ind.color}88`, lineStyle: LineStyle.Dashed }),
              chart.addSeries(LineSeries, { ...opts, color: `${ind.color}` }),
            ];
            seriesMap.set("keltner", arr);
          }
          const kc = calcKeltner(bars, ind.period);
          if (kc.upper.length) {
            arr[0].setData(kc.upper.map(d  => ({ time: d.time as Time, value: d.value })));
            arr[1].setData(kc.middle.map(d => ({ time: d.time as Time, value: d.value })));
            arr[2].setData(kc.lower.map(d  => ({ time: d.time as Time, value: d.value })));
          }
        }
        // ── Donchian Channels ─────────────────────────────────────────
        if (ind.id === "donchian") {
          let arr = seriesMap.get("donchian") as ISeriesApi<"Line">[] | undefined;
          if (!arr) {
            const opts = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
            arr = [
              chart.addSeries(LineSeries, { ...opts, color: `${ind.color}` }),
              chart.addSeries(LineSeries, { ...opts, color: `${ind.color}66`, lineStyle: LineStyle.Dashed }),
              chart.addSeries(LineSeries, { ...opts, color: `${ind.color}` }),
            ];
            seriesMap.set("donchian", arr);
          }
          const dc = calcDonchian(bars, ind.period);
          if (dc.upper.length) {
            arr[0].setData(dc.upper.map(d  => ({ time: d.time as Time, value: d.value })));
            arr[1].setData(dc.middle.map(d => ({ time: d.time as Time, value: d.value })));
            arr[2].setData(dc.lower.map(d  => ({ time: d.time as Time, value: d.value })));
          }
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

  // ── Sub-chart effect ───────────────────────────────────────────────
  useEffect(() => {
    const container = subChartContainerRef.current;
    if (!hasSubChart) {
      if (subChartRef.current) { try { subChartRef.current.remove(); } catch { /* ignore */ } subChartRef.current = null; subSeriesRef.current.clear(); subPrimarySeriesRef.current = null; }
      return;
    }
    if (!container) return;
    const bars = sortedKlinesRef.current;
    if (bars.length === 0) return;

    if (!subChartRef.current) {
      const sc = createChart(container, makeChartOptions(true, false, chartTheme));
      sc.priceScale("right").applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });
      sc.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (isSyncingRef.current || !range) return;
        isSyncingRef.current = true;
        try { chartRef.current?.timeScale().setVisibleLogicalRange(range); } catch { /* ignore */ }
        isSyncingRef.current = false;
      });
      subChartRef.current = sc;
    }

    const sc = subChartRef.current;
    subSeriesRef.current.forEach(s => { try { sc.removeSeries(s); } catch { /* ignore */ } });
    subSeriesRef.current.clear();
    subPrimarySeriesRef.current = null;

    // RSI
    if (hasRSI && bars.length > 14) {
      const rsiData = calcRSI(bars, 14);
      const s = sc.addSeries(LineSeries, { color: "hsl(38,100%,60%)", lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: "RSI" });
      s.setData(rsiData.map(d => ({ time: d.time as Time, value: d.value })));
      s.createPriceLine({ price: 70, color: "hsla(0,85%,62%,0.5)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "70" });
      s.createPriceLine({ price: 50, color: "hsla(220,14%,50%,0.3)", lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: false, title: "" });
      s.createPriceLine({ price: 30, color: "hsla(150,90%,55%,0.5)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "30" });
      subSeriesRef.current.set("rsi", s);
      subPrimarySeriesRef.current = s;
    }

    // MACD
    if (hasMACD && bars.length > 35) {
      const md = calcMACD(bars);
      const ml = sc.addSeries(LineSeries, { color: "hsl(190,90%,55%)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: "MACD" });
      const sl = sc.addSeries(LineSeries, { color: "hsl(0,85%,62%)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: "Signal" });
      const hs = sc.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
      ml.setData(md.macd.map(d => ({ time: d.time as Time, value: d.value })));
      sl.setData(md.signal.map(d => ({ time: d.time as Time, value: d.value })));
      hs.setData(md.histogram.map(d => ({ time: d.time as Time, value: d.value, color: d.value >= 0 ? "hsla(150,90%,50%,0.65)" : "hsla(0,85%,62%,0.65)" })));
      subSeriesRef.current.set("macd", ml); subSeriesRef.current.set("macd-sig", sl); subSeriesRef.current.set("macd-hist", hs);
      if (!subPrimarySeriesRef.current) subPrimarySeriesRef.current = ml;
    }

    // ATR
    if (hasATR && bars.length > 15) {
      const s = sc.addSeries(LineSeries, { color: "hsl(260,80%,68%)", lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: "ATR" });
      s.setData(calcATR(bars, 14).map(d => ({ time: d.time as Time, value: d.value })));
      subSeriesRef.current.set("atr", s);
      if (!subPrimarySeriesRef.current) subPrimarySeriesRef.current = s;
    }

    // Stochastic
    if (hasStoch && bars.length > 17) {
      const sd = calcStochastic(bars, 14, 3);
      const ks = sc.addSeries(LineSeries, { color: "hsl(150,90%,55%)", lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: "%K" });
      const ds = sc.addSeries(LineSeries, { color: "hsl(0,85%,62%)", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, title: "%D" });
      ks.createPriceLine({ price: 80, color: "hsla(0,85%,62%,0.4)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "80" });
      ks.createPriceLine({ price: 20, color: "hsla(150,90%,55%,0.4)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "20" });
      ks.setData(sd.k.map(d => ({ time: d.time as Time, value: d.value })));
      ds.setData(sd.d.map(d => ({ time: d.time as Time, value: d.value })));
      subSeriesRef.current.set("stoch-k", ks); subSeriesRef.current.set("stoch-d", ds);
      if (!subPrimarySeriesRef.current) subPrimarySeriesRef.current = ks;
    }

    // OBV
    if (hasOBV && bars.length > 1) {
      const s = sc.addSeries(LineSeries, { color: "hsl(190,90%,60%)", lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: "OBV" });
      s.setData(calcOBV(bars).map(d => ({ time: d.time as Time, value: d.value })));
      subSeriesRef.current.set("obv", s);
      if (!subPrimarySeriesRef.current) subPrimarySeriesRef.current = s;
    }

    // Williams %R
    if (hasWilliamsR && bars.length > 14) {
      const s = sc.addSeries(LineSeries, { color: "hsl(38,100%,62%)", lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: "%R" });
      s.setData(calcWilliamsR(bars, 14).map(d => ({ time: d.time as Time, value: d.value })));
      s.createPriceLine({ price: -20, color: "hsla(0,85%,62%,0.4)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "-20" });
      s.createPriceLine({ price: -80, color: "hsla(150,90%,55%,0.4)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "-80" });
      subSeriesRef.current.set("williams_r", s);
      if (!subPrimarySeriesRef.current) subPrimarySeriesRef.current = s;
    }

    // CCI
    if (hasCCI && bars.length > 20) {
      const s = sc.addSeries(LineSeries, { color: "hsl(260,80%,68%)", lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: "CCI" });
      s.setData(calcCCI(bars, 20).map(d => ({ time: d.time as Time, value: d.value })));
      s.createPriceLine({ price: 100,  color: "hsla(0,85%,62%,0.4)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "+100" });
      s.createPriceLine({ price: -100, color: "hsla(150,90%,55%,0.4)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "-100" });
      subSeriesRef.current.set("cci", s);
      if (!subPrimarySeriesRef.current) subPrimarySeriesRef.current = s;
    }

    // ADX
    if (hasADX && bars.length > 30) {
      const adxData = calcADX(bars, 14);
      const adxS  = sc.addSeries(LineSeries, { color: "hsl(150,90%,55%)", lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title: "ADX" });
      const diPS  = sc.addSeries(LineSeries, { color: "hsl(190,90%,55%)", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, title: "+DI" });
      const diMS  = sc.addSeries(LineSeries, { color: "hsl(0,85%,60%)", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, title: "-DI" });
      adxS.setData(adxData.adx.map(d    => ({ time: d.time as Time, value: d.value })));
      diPS.setData(adxData.diPlus.map(d => ({ time: d.time as Time, value: d.value })));
      diMS.setData(adxData.diMinus.map(d => ({ time: d.time as Time, value: d.value })));
      adxS.createPriceLine({ price: 25, color: "hsla(38,100%,55%,0.4)", lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: true, title: "25" });
      subSeriesRef.current.set("adx", adxS); subSeriesRef.current.set("adx-diplus", diPS); subSeriesRef.current.set("adx-diminus", diMS);
      if (!subPrimarySeriesRef.current) subPrimarySeriesRef.current = adxS;
    }

    const mainRange = chartRef.current?.timeScale().getVisibleLogicalRange();
    if (mainRange) try { sc.timeScale().setVisibleLogicalRange(mainRange); } catch { /* ignore */ }

  }, [klines, hasSubChart, hasRSI, hasMACD, hasATR, hasStoch, hasOBV, hasWilliamsR, hasCCI, hasADX]);

  // ── Multi-TF chart ─────────────────────────────────────────────────
  useEffect(() => {
    const container = multiTfContainerRef.current;
    if (!showMultiTf) {
      if (multiTfChartRef.current) { try { multiTfChartRef.current.remove(); } catch { /* ignore */ } multiTfChartRef.current = null; multiTfCandleRef.current = null; }
      return;
    }
    if (!container || !multiTfKlines) return;
    if (!multiTfChartRef.current) {
      const mc = createChart(container, makeChartOptions());
      const mcC = mc.addSeries(CandlestickSeries, { upColor: "hsl(150,90%,52%)", downColor: "hsl(0,85%,58%)", borderUpColor: "hsl(150,90%,52%)", borderDownColor: "hsl(0,85%,58%)", wickUpColor: "hsl(150,80%,45%)", wickDownColor: "hsl(0,75%,50%)", priceLineVisible: true, priceLineColor: "hsla(190,90%,60%,0.7)" });
      const mcV = mc.addSeries(HistogramSeries, { color: "hsl(190,90%,50%)", priceFormat: { type: "volume" }, priceScaleId: "vol2" });
      mc.priceScale("vol2").applyOptions({ scaleMargins: { top: 0.88, bottom: 0 } });
      multiTfChartRef.current = mc; multiTfCandleRef.current = mcC;
      const sorted = [...multiTfKlines].sort((a, b) => a.time - b.time);
      mcC.setData(sorted.map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
      mcV.setData(sorted.map(k => ({ time: k.time as Time, value: k.volume, color: k.close >= k.open ? "hsla(150,90%,50%,0.3)" : "hsla(0,85%,60%,0.3)" })));
      mc.timeScale().fitContent();
    } else {
      const sorted = [...multiTfKlines].sort((a, b) => a.time - b.time);
      multiTfCandleRef.current?.setData(sorted.map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
      multiTfChartRef.current?.timeScale().fitContent();
    }
  }, [showMultiTf, multiTfKlines]);

  // ── Persist indicators ─────────────────────────────────────────────
  useEffect(() => { persistIndicators(indicators); }, [indicators]);

  // ── Close indicators panel on outside click ────────────────────────
  useEffect(() => {
    if (!showIndicators) return;
    function handleClickOutside(e: MouseEvent) {
      if (indicatorPanelRef.current && !indicatorPanelRef.current.contains(e.target as Node)) setShowIndicators(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showIndicators]);

  // ── Chart theme ────────────────────────────────────────────────────
  useEffect(() => {
    if (chartRef.current) chartRef.current.applyOptions(makeChartOptions(false, logScale, chartTheme));
    if (subChartRef.current) subChartRef.current.applyOptions(makeChartOptions(true, false, chartTheme));
    if (multiTfChartRef.current) multiTfChartRef.current.applyOptions(makeChartOptions(false, false, chartTheme));
  }, [chartTheme, logScale]);

  // ── Go to date ─────────────────────────────────────────────────────
  const handleGoToDate = useCallback(() => {
    if (!goToDate || !chartRef.current) return;
    const ts = Math.floor(new Date(goToDate).getTime() / 1000);
    const bars = sortedKlinesRef.current;
    if (!bars.length) return;
    let idx = bars.findIndex(b => b.time >= ts);
    if (idx < 0) idx = bars.length - 1;
    chartRef.current.timeScale().scrollToPosition(idx - Math.floor(bars.length * 0.1), false);
  }, [goToDate]);

  // ── Layout helpers ─────────────────────────────────────────────────
  function restoreDrawingsFromData(toRestore: SerializableDrawing[], bars: KlineBar[]) {
    if (!candleSeriesRef.current || !chartRef.current) return;
    const newDrawings: DrawnObject[] = [];
    const times = new Set(bars.map(b => b.time));

    for (const d of toRestore) {
      try {
        if (d.kind === "hline") {
          const pl = candleSeriesRef.current.createPriceLine({ price: d.price, color: d.color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: fmt(d.price) });
          newDrawings.push({ kind: "hline", priceLine: pl, id: d.id, price: d.price, color: d.color });
        } else if (d.kind === "text") {
          const pl = candleSeriesRef.current.createPriceLine({ price: d.price, color: d.color, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: `◆ ${d.text}` });
          newDrawings.push({ kind: "text", priceLine: pl, id: d.id, price: d.price, time: d.time, text: d.text, color: d.color });
        } else if (d.kind === "trendline") {
          const t1 = d.p1.time; const t2 = d.p2.time;
          if (!times.has(t1) || !times.has(t2)) continue;
          const pts = t1 <= t2 ? [{ time: t1 as Time, value: d.p1.price }, { time: t2 as Time, value: d.p2.price }] : [{ time: t2 as Time, value: d.p2.price }, { time: t1 as Time, value: d.p1.price }];
          const s = chartRef.current.addSeries(LineSeries, { color: d.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
          s.setData(pts);
          newDrawings.push({ kind: "trendline", series: s, id: d.id, p1: d.p1, p2: d.p2, color: d.color });
        } else if (d.kind === "fibonacci") {
          const range = d.high - d.low;
          const pls: IPriceLine[] = FIB_LEVELS.map(({ pct, color, label }) => candleSeriesRef.current!.createPriceLine({ price: d.high - range * pct, color, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: label }));
          newDrawings.push({ kind: "fibonacci", priceLines: pls, id: d.id, high: d.high, low: d.low, color: d.color });
        } else if (d.kind === "rectangle") {
          const tMin = Math.min(d.p1.time, d.p2.time) as Time; const tMax = Math.max(d.p1.time, d.p2.time) as Time;
          const pMin = Math.min(d.p1.price, d.p2.price);        const pMax = Math.max(d.p1.price, d.p2.price);
          const opts = { color: d.color, lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
          const s  = chartRef.current.addSeries(LineSeries, opts); s.setData([{ time: tMin, value: pMax }, { time: tMax, value: pMax }]);
          const s2 = chartRef.current.addSeries(LineSeries, opts); s2.setData([{ time: tMin, value: pMin }, { time: tMax, value: pMin }]);
          newDrawings.push({ kind: "rectangle", series: s, series2: s2, id: d.id, p1: d.p1, p2: d.p2, color: d.color });
        } else if (d.kind === "ray") {
          const t1 = d.p1.time; const p1 = d.p1.price; const t2 = d.p2.time; const p2 = d.p2.price;
          const slope = t2 !== t1 ? (p2 - p1) / (t2 - t1) : 0;
          const tStart = Math.min(t1, t2);
          const tEnd   = bars.length > 0 ? bars[bars.length - 1]!.time + 100 * 86400 : t2 + 100 * 86400;
          const pts = [{ time: tStart as Time, value: p1 }, { time: ((tStart + tEnd) / 2) as Time, value: p1 + slope * ((tStart + tEnd) / 2 - t1) }, { time: tEnd as Time, value: p1 + slope * (tEnd - t1) }];
          const s = chartRef.current.addSeries(LineSeries, { color: d.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, lineStyle: LineStyle.SparseDotted });
          s.setData(pts);
          newDrawings.push({ kind: "ray", series: s, id: d.id, p1: d.p1, p2: d.p2, color: d.color });
        } else if (d.kind === "parallel_channel") {
          const t1 = d.p1.time; const p1 = d.p1.price; const t2 = d.p2.time; const p2 = d.p2.price; const p3 = d.p3.price;
          const offset = p3 - (p1 + (p2 - p1) * ((d.p3.time - t1) / (t2 - t1 || 1)));
          const tMin = Math.min(t1, t2) as Time; const tMax = Math.max(t1, t2) as Time;
          const opts = { color: d.color, lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
          const top = chartRef.current.addSeries(LineSeries, opts); const bot = chartRef.current.addSeries(LineSeries, opts);
          top.setData(t1 <= t2 ? [{ time: tMin, value: p1 }, { time: tMax, value: p2 }] : [{ time: tMin, value: p2 }, { time: tMax, value: p1 }]);
          bot.setData(t1 <= t2 ? [{ time: tMin, value: p1 + offset }, { time: tMax, value: p2 + offset }] : [{ time: tMin, value: p2 + offset }, { time: tMax, value: p1 + offset }]);
          newDrawings.push({ kind: "parallel_channel", series: top, series2: bot, id: d.id, p1: d.p1, p2: d.p2, p3: d.p3, color: d.color });
        } else if (d.kind === "pitchfork") {
          const t1 = d.p1.time; const p1 = d.p1.price; const t2 = d.p2.time; const p2 = d.p2.price; const t3 = d.p3.time; const p3 = d.p3.price;
          const midT = (t2 + t3) / 2; const midP = (p2 + p3) / 2;
          const tEnd = bars.length > 0 ? bars[bars.length - 1].time + 100 * 86400 : t3 + 100 * 86400;
          const slope = midT !== t1 ? (midP - p1) / (midT - t1) : 0;
          const opts = { color: d.color, lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
          const med   = chartRef.current.addSeries(LineSeries, opts);
          const tine1 = chartRef.current.addSeries(LineSeries, { ...opts, lineStyle: LineStyle.Dashed });
          const tine2 = chartRef.current.addSeries(LineSeries, { ...opts, lineStyle: LineStyle.Dashed });
          med.setData([{ time: t1 as Time, value: p1 }, { time: tEnd as Time, value: p1 + slope * (tEnd - t1) }]);
          tine1.setData([{ time: t2 as Time, value: p2 }, { time: tEnd as Time, value: p2 + slope * (tEnd - t2) }]);
          tine2.setData([{ time: t3 as Time, value: p3 }, { time: tEnd as Time, value: p3 + slope * (tEnd - t3) }]);
          newDrawings.push({ kind: "pitchfork", series: med, series2: tine1, series3: tine2, id: d.id, p1: d.p1, p2: d.p2, p3: d.p3, color: d.color });
        }
      } catch { /* ignore */ }
    }
    setDrawings(newDrawings);
  }

  const serializeDrawings = useCallback((): SerializableDrawing[] => {
    return drawingsRef.current.map(d => {
      if (d.kind === "hline")            return { kind: "hline", id: d.id, price: d.price, color: d.color } as SerializableDrawing;
      if (d.kind === "text")             return { kind: "text", id: d.id, price: d.price, time: d.time, text: d.text, color: d.color } as SerializableDrawing;
      if (d.kind === "trendline")        return { kind: "trendline", id: d.id, p1: d.p1, p2: d.p2, color: d.color } as SerializableDrawing;
      if (d.kind === "fibonacci")        return { kind: "fibonacci", id: d.id, high: d.high, low: d.low, color: d.color } as SerializableDrawing;
      if (d.kind === "rectangle")        return { kind: "rectangle", id: d.id, p1: d.p1, p2: d.p2, color: d.color } as SerializableDrawing;
      if (d.kind === "ray")              return { kind: "ray", id: d.id, p1: d.p1, p2: d.p2, color: d.color } as SerializableDrawing;
      if (d.kind === "parallel_channel") return { kind: "parallel_channel", id: d.id, p1: d.p1, p2: d.p2, p3: d.p3, color: d.color } as SerializableDrawing;
      if (d.kind === "pitchfork")        return { kind: "pitchfork", id: d.id, p1: d.p1, p2: d.p2, p3: d.p3, color: d.color } as SerializableDrawing;
      return null!;
    }).filter(Boolean);
  }, []);

  const handleSaveLayout = useCallback(() => {
    if (!layoutName.trim()) return;
    const layout: ChartLayout = {
      id: `layout-${Date.now()}`,
      name: layoutName.trim(),
      symbol, interval,
      drawings: serializeDrawings(),
      indicators: indicators.filter(i => i.enabled).map(i => i.id),
      createdAt: Date.now(),
    };
    const updated = [...savedLayouts, layout];
    setSavedLayouts(updated); saveLayouts(updated);
    setLayoutName(""); setShowSaveLayout(false);
  }, [layoutName, symbol, interval, serializeDrawings, indicators, savedLayouts]);

  const handleLoadLayout = useCallback((layout: ChartLayout) => {
    setSymbol(layout.symbol);
    setInterval(layout.interval as GetKlinesInterval);
    setIndicators(prev => prev.map(i => ({ ...i, enabled: layout.indicators.includes(i.id) })));
    pendingRestoreRef.current = layout.drawings;
    setShowLoadLayout(false);
  }, []);

  const handleDeleteLayout = useCallback((id: string) => {
    const updated = savedLayouts.filter(l => l.id !== id);
    setSavedLayouts(updated); saveLayouts(updated);
  }, [savedLayouts]);

  function handleRefresh() { queryClient.invalidateQueries({ queryKey: getGetKlinesQueryKey(params) }); }

  const CAPITAL_OPTIONS = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000];
  const openAccountWithCapital = (cap: number) => {
    const acc = { initialCapital: cap, balance: cap, createdAt: new Date().toISOString() };
    localStorage.setItem("pt_account", JSON.stringify(acc));
    setPtCapital(cap); setEquity(cap); setAccountModalOpen(false);
  };

  // ── Watchlist live prices via Binance WebSocket ─────────────────────
  const watchlistSymbols = useMemo(
    () => SYMBOLS.filter(s => !s.sim).map(s => s.value),
    []
  );
  const wsBinancePrices = useBinancePrices(watchlistSymbols);

  // ── Watchlist sparkline data (sim sparklines for shape; live price overlay) ──
  const watchlistData = useMemo(() => {
    return SYMBOLS.slice(0, 20).map(sym => {
      const bars = generateSimData(sym.value, sym.basePrice, 20, 86400);
      const simLast = bars[bars.length - 1].close;
      const liveP = !sym.sim && wsBinancePrices[sym.value]?.price;
      const last = liveP || simLast;
      const first = liveP
        ? last / (1 + (wsBinancePrices[sym.value]?.changePct24h ?? 0) / 100)
        : bars[0].close;
      const change = first > 0 ? ((last - first) / first) * 100 : 0;
      const minP = Math.min(...bars.map(b => b.close));
      const maxP = Math.max(...bars.map(b => b.close));
      const sparkPoints = bars.map((b, i) => {
        const x = (i / (bars.length - 1)) * 60;
        const y = maxP === minP ? 10 : 20 - ((b.close - minP) / (maxP - minP)) * 20;
        return `${x},${y}`;
      }).join(" ");
      return { ...sym, lastPrice: last, change, sparkPoints, isLive: !!liveP };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsBinancePrices]);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="tt-chart-page flex flex-col gap-2" style={{ maxWidth: "100%" }}>

      {/* ── Paper Trading Account Setup Modal ─────────────────────────── */}
      {accountModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md rounded-2xl border overflow-y-auto" style={{ background: "hsl(222,22%,10%)", borderColor: "rgba(255,255,255,0.1)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)", maxHeight: "90dvh" }}>
            <div className="px-6 pt-6 pb-4 text-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="h-12 w-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(150,75%,22%), hsl(150,75%,15%))", border: "1px solid rgba(52,211,153,0.3)" }}>
                <TrendingUp className="h-5 w-5" style={{ color: "hsl(150,90%,65%)" }} />
              </div>
              <h2 className="text-lg font-bold font-mono" style={{ color: "hsl(220,14%,90%)" }}>Open Paper Trading Account</h2>
              <p className="text-xs font-mono mt-1.5" style={{ color: "hsl(220,14%,45%)" }}>Choose your virtual starting balance. You can reset and restart anytime.</p>
            </div>
            <div className="px-6 py-4">
              <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: "hsl(220,14%,40%)" }}>Select Starting Balance</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {CAPITAL_OPTIONS.map(cap => (
                  <button key={cap} onClick={() => openAccountWithCapital(cap)}
                    className="py-3 rounded-xl border font-mono font-bold text-sm transition-all hover:scale-[1.02]"
                    style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "hsl(220,14%,75%)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(52,211,153,0.4)"; (e.currentTarget as HTMLElement).style.color = "hsl(150,90%,65%)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "hsl(220,14%,75%)"; }}>
                    ${cap >= 1000 ? `${(cap / 1000).toFixed(0)}K` : cap}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
                  <span className="text-xs font-mono" style={{ color: "hsl(220,14%,45%)" }}>$</span>
                  <input type="number" placeholder="Custom amount" value={customCapitalInput} onChange={e => setCustomCapitalInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { const n = Number(customCapitalInput); if (n >= 100) openAccountWithCapital(n); } }}
                    className="flex-1 bg-transparent text-xs font-mono outline-none" style={{ color: "hsl(220,14%,80%)" }} min={100} />
                </div>
                <button onClick={() => { const n = Number(customCapitalInput); if (n >= 100) openAccountWithCapital(n); }}
                  disabled={!customCapitalInput || Number(customCapitalInput) < 100}
                  className="px-4 py-2 rounded-xl font-mono font-bold text-xs transition-all disabled:opacity-30"
                  style={{ background: "linear-gradient(135deg, hsl(150,75%,22%), hsl(150,75%,15%))", border: "1px solid rgba(52,211,153,0.3)", color: "hsl(150,90%,65%)" }}>
                  Start
                </button>
              </div>
            </div>
            <div className="px-6 pb-5">
              <p className="text-[10px] font-mono text-center" style={{ color: "hsl(220,14%,30%)" }}>Paper trading uses virtual money — no real funds are at risk.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="rounded-xl px-3 sm:px-4 py-2.5 border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)", backdropFilter: "blur(12px)", borderColor: "rgba(255,255,255,0.07)", boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)", position: "relative", zIndex: 60 }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight flex-shrink-0" style={{ background: "linear-gradient(135deg, hsl(190,90%,65%), hsl(210,80%,75%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Live Chart</h1>
            {replayMode && <span className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded-full border flex-shrink-0" style={{ background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.3)", color: "hsl(38,100%,65%)" }}>● REPLAY</span>}
            {currentBar && !replayMode && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm sm:text-base font-mono font-bold flex-shrink-0" style={{ color: isUp ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>${fmt(currentBar.close)}</span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded flex-shrink-0" style={isUp ? { background: "rgba(52,211,153,0.1)", color: "hsl(150,90%,58%)" } : { background: "rgba(239,68,68,0.1)", color: "hsl(0,85%,62%)" }}>{isUp ? "+" : ""}{changePercent}%</span>
              </div>
            )}
          </div>
          <span className="text-[10px] font-mono hidden sm:block" style={{ color: "hsl(220,14%,35%)" }}>{isSim ? `${displayCategory} · Sim` : "Binance · Live"}</span>
        </div>

        <div className="flex items-center gap-1 flex-wrap" style={{ rowGap: "4px" }}>
          {/* Indicators button */}
          <div className="relative" ref={indicatorPanelRef}>
            <button onClick={() => setShowIndicators(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={showIndicators ? { background: "rgba(0,229,255,0.12)", borderColor: "rgba(0,229,255,0.3)", color: "hsl(190,90%,65%)" } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
              <BarChart2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Indicators</span>
              {indicators.filter(i => i.enabled).length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold" style={{ background: "rgba(0,229,255,0.25)", color: "hsl(190,90%,70%)" }}>{indicators.filter(i => i.enabled).length}</span>
              )}
            </button>

            {showIndicators && (
              <div className="absolute left-0 top-full mt-1 z-50 rounded-xl p-3 w-64 flex flex-col gap-1" style={{ background: "hsl(222,28%,11%)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
                <div className="flex items-center justify-between px-1 mb-1">
                  <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,40%)" }}>Overlays</p>
                  {indicators.some(i => i.isOverlay && i.enabled) && (
                    <button onClick={() => setIndicators(prev => prev.map(i => i.isOverlay ? { ...i, enabled: false } : i))} className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: "hsl(0,78%,65%)", background: "rgba(239,68,68,0.1)" }}>clear</button>
                  )}
                </div>
                {indicators.filter(i => i.isOverlay).map(ind => (
                  <button key={ind.id} onClick={() => setIndicators(prev => prev.map(i => i.id === ind.id ? { ...i, enabled: !i.enabled } : i))}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono transition-all"
                    style={ind.enabled ? { background: "rgba(255,255,255,0.06)", color: "hsl(220,14%,80%)" } : { color: "hsl(220,14%,50%)" }}>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-0.5 rounded" style={{ background: ind.color }} />{ind.label}</div>
                    {ind.enabled && <Check className="h-3 w-3 shrink-0" style={{ color: ind.color }} />}
                  </button>
                ))}
                <div className="h-px my-1" style={{ background: "rgba(255,255,255,0.08)" }} />
                <div className="flex items-center justify-between px-1 mb-1">
                  <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,40%)" }}>Sub-pane</p>
                  {indicators.some(i => !i.isOverlay && i.enabled) && (
                    <button onClick={() => setIndicators(prev => prev.map(i => !i.isOverlay ? { ...i, enabled: false } : i))} className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: "hsl(0,78%,65%)", background: "rgba(239,68,68,0.1)" }}>clear</button>
                  )}
                </div>
                {indicators.filter(i => !i.isOverlay).map(ind => (
                  <button key={ind.id} onClick={() => setIndicators(prev => prev.map(i => i.id === ind.id ? { ...i, enabled: !i.enabled } : i))}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono transition-all"
                    style={ind.enabled ? { background: "rgba(255,255,255,0.06)", color: "hsl(220,14%,80%)" } : { color: "hsl(220,14%,50%)" }}>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-0.5 rounded" style={{ background: ind.color }} />{ind.label}</div>
                    {ind.enabled && <Check className="h-3 w-3 shrink-0" style={{ color: ind.color }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Viral preset */}
          <button onClick={() => { const allOn = VIRAL_INDICATOR_IDS.every(id => indicators.find(i => i.id === id)?.enabled); setIndicators(prev => prev.map(i => (VIRAL_INDICATOR_IDS as readonly string[]).includes(i.id) ? { ...i, enabled: !allOn } : i)); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
            style={VIRAL_INDICATOR_IDS.every(id => indicators.find(i => i.id === id)?.enabled) ? { background: "rgba(251,115,22,0.18)", borderColor: "rgba(251,115,22,0.4)", color: "hsl(28,100%,65%)" } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
            <Flame className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Viral</span>
          </button>

          {/* Log/Linear scale toggle */}
          <button onClick={() => setLogScale(v => !v)}
            title={logScale ? "Switch to Linear scale" : "Switch to Log scale"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
            style={logScale ? { background: "rgba(139,92,246,0.18)", borderColor: "rgba(139,92,246,0.4)", color: "hsl(260,80%,75%)" } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
            <span className="font-mono text-[10px] font-bold">{logScale ? "LOG" : "LIN"}</span>
          </button>

          {/* Multi-TF */}
          <div className="flex items-center gap-1">
            <button onClick={() => setShowMultiTf(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={showMultiTf ? { background: "rgba(100,180,255,0.12)", borderColor: "rgba(100,180,255,0.3)", color: "hsl(200,80%,65%)" } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
              <SplitSquareVertical className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Multi-TF</span>
            </button>
            {showMultiTf && (
              <div onClick={e => e.stopPropagation()}>
                <Select value={multiTfInterval} onValueChange={v => setMultiTfInterval(v as GetKlinesInterval)}>
                  <SelectTrigger className="h-8 text-xs font-mono border" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(100,180,255,0.25)", color: "hsl(200,80%,65%)", width: "4.5rem" }}><SelectValue /></SelectTrigger>
                  <SelectContent>{INTERVALS.map(iv => <SelectItem key={iv.value} value={iv.value} className="text-xs font-mono">{iv.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Compare symbol */}
          <div className="flex items-center gap-1">
            <button onClick={() => setShowComparePanel(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={compareSymbol ? { background: "rgba(139,92,246,0.15)", borderColor: "rgba(139,92,246,0.35)", color: "hsl(260,80%,72%)" } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
              <ArrowLeftRight className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{compareSymbol ? SYMBOLS.find(s => s.value === compareSymbol)?.label ?? compareSymbol : "Compare"}</span>
            </button>
            {showComparePanel && (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <Select value={compareSymbol ?? ""} onValueChange={v => { setCompareSymbol(v || null); setShowComparePanel(false); }}>
                  <SelectTrigger className="h-8 text-xs font-mono border" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(139,92,246,0.25)", color: "hsl(260,80%,72%)", width: "8rem" }}><SelectValue placeholder="Pick symbol" /></SelectTrigger>
                  <SelectContent className="max-h-64">{SYMBOLS.filter(s => s.value !== symbol).map(s => <SelectItem key={s.value} value={s.value} className="text-xs font-mono">{s.label}</SelectItem>)}</SelectContent>
                </Select>
                {compareSymbol && <button onClick={() => { setCompareSymbol(null); setShowComparePanel(false); }} className="h-7 w-7 flex items-center justify-center rounded-lg" style={{ color: "hsl(0,78%,62%)", background: "rgba(239,68,68,0.1)" }}><X className="h-3 w-3" /></button>}
              </div>
            )}
          </div>

          {/* Price alerts */}
          <button onClick={() => setShowAlertPanel(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
            style={showAlertPanel ? { background: "rgba(245,158,11,0.15)", borderColor: "rgba(245,158,11,0.4)", color: "hsl(38,100%,65%)" } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
            <Bell className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Alerts</span>
            {priceAlerts.length > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold" style={{ background: "rgba(245,158,11,0.3)", color: "hsl(38,100%,70%)" }}>{priceAlerts.length}</span>}
          </button>

          {/* VPVR */}
          <button onClick={() => setShowVPVR(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
            style={showVPVR ? { background: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.3)", color: "hsl(150,90%,65%)" } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
            <Layers className="h-3.5 w-3.5" /> <span className="hidden sm:inline">VPVR</span>
          </button>

          {/* Watchlist */}
          <button onClick={() => setShowWatchlist(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
            style={showWatchlist ? { background: "rgba(100,180,255,0.12)", borderColor: "rgba(100,180,255,0.3)", color: "hsl(200,80%,65%)" } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
            <List className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Watchlist</span>
          </button>

          {/* Save/Load layouts */}
          <div className="flex items-center gap-1">
            <button onClick={() => { setShowSaveLayout(v => !v); setShowLoadLayout(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={showSaveLayout ? { background: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.3)", color: "hsl(150,90%,65%)" } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
              <Save className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Save</span>
            </button>
            {savedLayouts.length > 0 && (
              <button onClick={() => { setShowLoadLayout(v => !v); setShowSaveLayout(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
                style={showLoadLayout ? { background: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.3)", color: "hsl(150,90%,65%)" } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
                <BookOpen className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Layouts ({savedLayouts.length})</span>
              </button>
            )}
          </div>

          {/* Trade panel toggle */}
          <button onClick={() => setShowOrderPanel(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
            style={showOrderPanel ? { background: "rgba(52,211,153,0.12)", borderColor: "rgba(52,211,153,0.3)", color: "hsl(150,90%,65%)" } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
            <TrendingUp className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Trade</span>
          </button>

          {/* Magnet mode */}
          <button onClick={() => setMagnetMode(v => !v)} title="Magnet mode — snap to OHLC (M)"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
            style={magnetMode ? { background: "rgba(0,229,255,0.15)", borderColor: "rgba(0,229,255,0.35)", color: "hsl(190,90%,65%)" } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
            <Crosshair className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Magnet</span>
          </button>

          {/* Theme toggle */}
          <button onClick={() => setChartTheme(t => t === "dark" ? "light" : "dark")} title="Toggle chart theme"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
            style={chartTheme === "light" ? { background: "rgba(250,204,21,0.15)", borderColor: "rgba(250,204,21,0.35)", color: "hsl(48,95%,60%)" } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
            {chartTheme === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{chartTheme === "dark" ? "Dark" : "Light"}</span>
          </button>

          {/* Keyboard shortcuts */}
          <button onClick={() => setShowShortcuts(v => !v)} title="Keyboard shortcuts (?)"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
            style={showShortcuts ? { background: "rgba(139,92,246,0.15)", borderColor: "rgba(139,92,246,0.35)", color: "hsl(260,80%,72%)" } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
            <Keyboard className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Shortcuts</span>
          </button>

          {!replayMode && (
            <button onClick={handleRefresh} disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}>
              <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          {!replayMode ? (
            <button onClick={enterReplay} disabled={!klines || klines.length < MIN_CANDLES}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.28)", color: "hsl(38,100%,62%)" }}>
              <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: "hsl(38,100%,60%)" }} />
              <span className="hidden sm:inline">Replay</span>
            </button>
          ) : (
            <button onClick={exitReplay} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all" style={{ background: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.2)", color: "hsl(38,100%,50%)" }}>
              <X className="h-3 w-3" /> <span className="hidden sm:inline">Exit Replay</span>
            </button>
          )}
        </div>
      </div>

      {/* Click-away to close panels */}
      {showIndicators && <div className="fixed inset-0 z-40" onClick={() => setShowIndicators(false)} />}

      {/* ── Keyboard Shortcuts Panel ────────────────────────────────── */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }} onClick={() => setShowShortcuts(false)}>
          <div className="rounded-2xl border overflow-hidden w-full max-w-lg" style={{ background: "hsl(222,22%,10%)", borderColor: "rgba(255,255,255,0.1)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4" style={{ color: "hsl(260,80%,72%)" }} />
                <span className="font-mono font-bold text-sm" style={{ color: "hsl(220,14%,88%)" }}>Keyboard Shortcuts</span>
              </div>
              <button onClick={() => setShowShortcuts(false)} className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10" style={{ color: "hsl(220,14%,50%)" }}><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-1.5 max-h-[70vh] overflow-y-auto">
              {[
                { section: "Drawing Tools" },
                { key: "H", label: "Horizontal line" },
                { key: "T", label: "Trend line" },
                { key: "F", label: "Fibonacci retracement" },
                { key: "R", label: "Ray" },
                { key: "Q", label: "Rectangle" },
                { key: "C", label: "Parallel channel" },
                { key: "P", label: "Pitchfork" },
                { key: "X", label: "Text annotation" },
                { key: "E", label: "Eraser" },
                { key: "Esc", label: "Select / deselect tool" },
                { section: "Chart Controls" },
                { key: "M", label: "Toggle magnet mode" },
                { key: "?", label: "Toggle shortcuts panel" },
                { section: "Replay Mode" },
                { key: "→", label: "Step forward" },
                { key: "←", label: "Step back" },
                { key: "Space", label: "Play / pause" },
                { key: "B", label: "Buy at current bar" },
                { key: "S", label: "Sell at current bar" },
              ].map((item, idx) =>
                "section" in item ? (
                  <div key={idx} className="col-span-2 pt-3 first:pt-0">
                    <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: "hsl(220,14%,38%)" }}>{item.section}</p>
                  </div>
                ) : (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono" style={{ color: "hsl(220,14%,60%)" }}>{item.label}</span>
                    <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "hsl(220,14%,80%)" }}>{item.key}</kbd>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Alert panel ────────────────────────────────────────────── */}
      {showAlertPanel && (
        <div className="rounded-xl p-3 border" style={{ background: "hsl(222,28%,10%)", borderColor: "rgba(245,158,11,0.25)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(38,100%,55%)" }}>Price Alerts</span>
            <button onClick={() => setShowAlertPanel(false)} className="h-5 w-5 flex items-center justify-center" style={{ color: "hsl(220,14%,40%)" }}><X className="h-3 w-3" /></button>
          </div>
          <div className="flex gap-2 mb-2">
            <input type="number" value={alertInput} onChange={e => setAlertInput(e.target.value)}
              placeholder={currentBar ? fmt(currentBar.close) : "Price"}
              onKeyDown={e => { if (e.key === "Enter" && alertInput) { const price = Number(alertInput); if (price > 0) { const a: PriceAlert = { id: Date.now(), price, triggered: false, label: fmt(price) }; const updated = [...priceAlerts, a]; setPriceAlerts(updated); saveAlerts(updated); setAlertInput(""); } } }}
              className="flex-1 text-xs font-mono px-2.5 py-1.5 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "hsl(220,14%,80%)" }} />
            <button onClick={() => {
              const price = Number(alertInput);
              if (price > 0) { const a: PriceAlert = { id: Date.now(), price, triggered: false, label: fmt(price) }; const updated = [...priceAlerts, a]; setPriceAlerts(updated); saveAlerts(updated); setAlertInput(""); }
            }} className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "hsl(38,100%,65%)" }}>+ Add</button>
          </div>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {priceAlerts.length === 0 && <p className="text-[10px] font-mono text-center py-2" style={{ color: "hsl(220,14%,35%)" }}>No alerts set — enter a price above</p>}
            {priceAlerts.map(a => (
              <div key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: a.triggered ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.05)", border: `1px solid ${a.triggered ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.15)"}` }}>
                <Bell className="h-3 w-3 flex-shrink-0" style={{ color: a.triggered ? "hsl(0,85%,62%)" : "hsl(38,100%,55%)" }} />
                <span className="flex-1 text-[11px] font-mono font-bold" style={{ color: a.triggered ? "hsl(0,85%,62%)" : "hsl(38,100%,65%)" }}>{fmt(a.price)}</span>
                {a.triggered && <span className="text-[9px] font-mono px-1 rounded" style={{ background: "rgba(239,68,68,0.15)", color: "hsl(0,85%,62%)" }}>TRIGGERED</span>}
                <button onClick={() => { const updated = priceAlerts.filter(x => x.id !== a.id); setPriceAlerts(updated); saveAlerts(updated); }} className="h-4 w-4 flex items-center justify-center" style={{ color: "hsl(220,14%,40%)" }}><X className="h-2.5 w-2.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Save layout panel ──────────────────────────────────────── */}
      {showSaveLayout && (
        <div className="rounded-xl p-3 border" style={{ background: "hsl(222,28%,10%)", borderColor: "rgba(52,211,153,0.2)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(150,90%,55%)" }}>Save Layout</span>
            <button onClick={() => setShowSaveLayout(false)} className="h-5 w-5 flex items-center justify-center" style={{ color: "hsl(220,14%,40%)" }}><X className="h-3 w-3" /></button>
          </div>
          <div className="flex gap-2">
            <input type="text" value={layoutName} onChange={e => setLayoutName(e.target.value)}
              placeholder="Layout name (e.g. BTC Trend Setup)"
              onKeyDown={e => { if (e.key === "Enter") handleSaveLayout(); }}
              className="flex-1 text-xs font-mono px-2.5 py-1.5 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "hsl(220,14%,80%)" }} />
            <button onClick={handleSaveLayout} disabled={!layoutName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold disabled:opacity-30"
              style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", color: "hsl(150,90%,65%)" }}>Save</button>
          </div>
          <p className="text-[9px] font-mono mt-1.5" style={{ color: "hsl(220,14%,35%)" }}>Saves: {displayLabel} · {interval} · {indicators.filter(i => i.enabled).length} indicators · {drawings.length} drawings</p>
        </div>
      )}

      {/* ── Load layout panel ──────────────────────────────────────── */}
      {showLoadLayout && savedLayouts.length > 0 && (
        <div className="rounded-xl p-3 border" style={{ background: "hsl(222,28%,10%)", borderColor: "rgba(52,211,153,0.2)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(150,90%,55%)" }}>Saved Layouts</span>
            <button onClick={() => setShowLoadLayout(false)} className="h-5 w-5 flex items-center justify-center" style={{ color: "hsl(220,14%,40%)" }}><X className="h-3 w-3" /></button>
          </div>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {savedLayouts.map(l => (
              <div key={l.id} className="flex items-center gap-2 px-2 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-semibold truncate" style={{ color: "hsl(220,14%,75%)" }}>{l.name}</p>
                  <p className="text-[9px] font-mono" style={{ color: "hsl(220,14%,35%)" }}>{SYMBOLS.find(s => s.value === l.symbol)?.label ?? l.symbol} · {l.interval} · {new Date(l.createdAt).toLocaleDateString()}</p>
                </div>
                <button onClick={() => handleLoadLayout(l)} className="px-2 py-1 rounded text-[10px] font-mono" style={{ background: "rgba(52,211,153,0.1)", color: "hsl(150,90%,60%)", border: "1px solid rgba(52,211,153,0.2)" }}>Load</button>
                <button onClick={() => handleDeleteLayout(l.id)} className="h-5 w-5 flex items-center justify-center" style={{ color: "hsl(0,78%,60%)" }}><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Controls row ───────────────────────────────────────────── */}
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
                  {items.map(s => <SelectItem key={s.value} value={s.value} className="text-xs font-mono"><span>{s.label}</span>{s.sim && <span className="ml-1.5 text-[9px] opacity-50 font-sans">SIM</span>}</SelectItem>)}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-0.5 rounded-lg p-0.5 border flex-shrink-0" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
          {INTERVALS.map(iv => (
            <button key={iv.value} onClick={() => handleIntervalChange(iv.value)}
              className="px-2 py-1 text-[11px] font-mono rounded-md transition-all"
              style={interval === iv.value ? { background: "rgba(0,229,255,0.15)", color: "hsl(190,90%,65%)" } : { color: "hsl(220,14%,55%)" }}>
              {iv.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 rounded-lg p-0.5 border flex-shrink-0" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
          {CHART_TYPES.map(ct => (
            <button key={ct.id} onClick={() => setChartType(ct.id)} title={ct.title}
              className="px-2 py-1 text-[11px] font-mono rounded-md transition-all"
              style={chartType === ct.id ? { background: "rgba(139,92,246,0.18)", color: "hsl(260,80%,75%)" } : { color: "hsl(220,14%,50%)" }}>
              {ct.label}
            </button>
          ))}
        </div>

        {/* Go to date */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <input type="date" value={goToDate} onChange={e => setGoToDate(e.target.value)}
            className="h-8 text-xs font-mono px-2 rounded-lg border outline-none" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "hsl(220,14%,60%)", colorScheme: "dark" }} />
          <button onClick={handleGoToDate} disabled={!goToDate} title="Jump to date"
            className="h-8 w-8 flex items-center justify-center rounded-lg border transition-all disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "hsl(220,14%,60%)" }}>
            <CalendarClock className="h-3.5 w-3.5" />
          </button>
        </div>

        {replayMode && currentDate && <span className="text-xs font-mono flex-shrink-0" style={{ color: "hsl(38,100%,65%)" }}>{currentDate}</span>}
      </div>

      {/* ── Replay toolbar ────────────────────────────────────────── */}
      {replayMode && (
        <div className="rounded-xl border" style={{ background: "linear-gradient(180deg, rgba(245,158,11,0.06) 0%, rgba(245,158,11,0.02) 100%)", borderColor: "rgba(245,158,11,0.18)" }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid rgba(245,158,11,0.08)" }}>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={jumpToStart} disabled={replayIndex <= MIN_CANDLES} title="Jump to start" className="h-7 w-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:bg-white/5" style={{ color: "hsl(220,14%,55%)" }}><SkipBack className="h-3 w-3" /></button>
              <button onClick={stepBack} disabled={replayIndex <= MIN_CANDLES} title="Step back (←)" className="h-7 w-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:bg-white/5" style={{ color: "hsl(220,14%,55%)" }}><StepBack className="h-3.5 w-3.5" /></button>
              <button onClick={() => setIsPlaying(p => !p)} disabled={replayIndex >= total} title={isPlaying ? "Pause" : "Play"}
                className="h-8 w-8 flex items-center justify-center rounded-lg border transition-all disabled:opacity-25 mx-0.5"
                style={isPlaying ? { background: "hsl(38,100%,52%)", borderColor: "transparent", color: "#000" } : { background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.3)", color: "hsl(38,100%,62%)" }}>
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-px" />}
              </button>
              <button onClick={stepForward} disabled={replayIndex >= total} title="Step forward (→)" className="h-7 w-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:bg-white/5" style={{ color: "hsl(220,14%,55%)" }}><StepForward className="h-3.5 w-3.5" /></button>
              <button onClick={jumpToEnd} disabled={replayIndex >= total} title="Jump to end" className="h-7 w-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-25 hover:bg-white/5" style={{ color: "hsl(220,14%,55%)" }}><SkipForward className="h-3 w-3" /></button>
            </div>

            <div className="w-px h-4 flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }} />

            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,35%)" }}>SPD</span>
              {SPEEDS.map(s => (
                <button key={s.value} onClick={() => setReplaySpeed(s.value)}
                  className="px-1.5 py-0.5 text-[10px] font-mono rounded transition-all"
                  style={replaySpeed === s.value ? { background: "rgba(245,158,11,0.18)", color: "hsl(38,100%,65%)", border: "1px solid rgba(245,158,11,0.28)" } : { color: "hsl(220,14%,38%)", border: "1px solid transparent" }}>
                  {s.label}
                </button>
              ))}
            </div>

            <div className="w-px h-4 flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }} />

            <div className="flex-1 flex items-center gap-2 min-w-0">
              <input type="range" min={MIN_CANDLES} max={total} value={replayIndex}
                onChange={e => { setIsPlaying(false); setReplayIndex(Number(e.target.value)); }}
                className="flex-1 h-1 cursor-pointer rounded-full" style={{ accentColor: "hsl(38,100%,55%)" }} />
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {currentDate && <span className="text-[10px] font-mono hidden md:block" style={{ color: "hsl(38,100%,55%)" }}>{currentDate}</span>}
              {currentBar && <span className="text-sm font-mono font-bold" style={{ color: isUp ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>${fmt(currentBar.close)}</span>}
              <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.08)", color: "hsl(38,100%,50%)", minWidth: "3.5rem", textAlign: "center" }}>
                {replayIndex}<span style={{ color: "hsl(220,14%,35%)" }}>/{total}</span>
              </span>
            </div>

            <div className="w-px h-4 flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }} />
            <button onClick={() => setReplaySidebarOpen(v => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono transition-all flex-shrink-0"
              style={replaySidebarOpen ? { background: "rgba(52,211,153,0.15)", color: "hsl(150,90%,60%)", border: "1px solid rgba(52,211,153,0.28)" } : { background: "rgba(255,255,255,0.04)", color: "hsl(220,14%,45%)", border: "1px solid rgba(255,255,255,0.08)" }}>
              B/S
            </button>
          </div>
        </div>
      )}

      {/* ── Chart area ──────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-2 flex-1 min-h-0">

        {/* ── Charts column ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto">

          {/* Main chart */}
          <div className="relative rounded-xl overflow-hidden"
            style={{ flex: (hasSubChart || showMultiTf) ? "0 0 auto" : "1 1 auto", height: (hasSubChart || showMultiTf) ? "min(320px, 42vh)" : "clamp(420px, calc(100vh - 260px), 700px)", minHeight: (hasSubChart || showMultiTf) ? "200px" : "380px", border: replayMode ? "1px solid rgba(245,158,11,0.25)" : "1px solid rgba(255,255,255,0.06)", boxShadow: "0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
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

            <div ref={chartContainerRef} className="absolute inset-0" />

            {/* VPVR overlay */}
            {showVPVR && vpvrBuckets.length > 0 && (
              <div className="absolute top-0 right-0 bottom-0 pointer-events-none" style={{ width: "80px", zIndex: 8, padding: "4px 0" }}>
                <svg width="80" height="100%" viewBox={`0 0 80 ${vpvrBuckets.length * 10}`} preserveAspectRatio="none" style={{ display: "block" }}>
                  {vpvrBuckets.map((b, i) => (
                    <rect key={i} x={80 - b.pct * 0.6} y={i * 10} width={b.pct * 0.6} height={9}
                      fill={b.pct > 70 ? "hsla(38,100%,55%,0.6)" : "hsla(190,90%,55%,0.35)"} />
                  ))}
                </svg>
              </div>
            )}

            {/* Drawing overlay */}
            <div className="absolute inset-0 z-20"
              style={{ cursor: activeTool === "cursor" ? "default" : activeTool === "eraser" ? "cell" : "crosshair", pointerEvents: activeTool === "cursor" ? "none" : "auto" }}
              onMouseDown={handleChartMouseDown}
              onMouseMove={e => { const rect = chartContainerRef.current?.getBoundingClientRect(); if (!rect) return; setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top }); }}
              onMouseUp={() => setMousePos(null)}
              onMouseLeave={() => setMousePos(null)}
            />

            {/* Text annotation input */}
            {textInput && (
              <div className="absolute z-30 pointer-events-auto" style={{ left: textInput.x + 8, top: textInput.y - 16, zIndex: 35 }}>
                <div className="flex gap-1.5 px-2 py-1.5 rounded-xl" style={{ background: "hsl(222,28%,12%)", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}>
                  <input autoFocus type="text" value={textValue} onChange={e => setTextValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleTextSubmit(); if (e.key === "Escape") { setTextInput(null); setTextValue(""); setActiveTool("cursor"); } }}
                    placeholder="Annotation text…"
                    className="text-xs font-mono outline-none bg-transparent w-40" style={{ color: drawColor }} />
                  <button onClick={handleTextSubmit} className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "rgba(0,229,255,0.15)", color: "hsl(190,90%,65%)" }}>OK</button>
                </div>
              </div>
            )}

            {/* Ghost preview while drawing (2-point tools) */}
            {drawStart && mousePos && (activeTool === "trendline" || activeTool === "ray" || activeTool === "fibonacci" || activeTool === "rectangle") && (
              <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 22, width: "100%", height: "100%", overflow: "visible" }}>
                <defs><filter id="glow-filter-lw"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
                {activeTool === "rectangle" ? (
                  <rect x={Math.min(drawStart.x, mousePos.x)} y={Math.min(drawStart.y, mousePos.y)}
                    width={Math.abs(mousePos.x - drawStart.x)} height={Math.abs(mousePos.y - drawStart.y)}
                    fill={`${drawColor}15`} stroke={drawColor} strokeWidth="1" strokeDasharray="6 3" opacity="0.7" filter="url(#glow-filter-lw)" />
                ) : (
                  <line x1={drawStart.x} y1={drawStart.y} x2={mousePos.x} y2={mousePos.y} stroke={drawColor} strokeWidth="1.5" strokeDasharray="6 3" opacity="0.8" filter="url(#glow-filter-lw)" />
                )}
                <circle cx={mousePos.x} cy={mousePos.y} r="3.5" fill={drawColor} opacity="0.7" filter="url(#glow-filter-lw)" />
              </svg>
            )}
            {/* Ghost for 3-point tools (parallel channel, pitchfork) */}
            {drawStart && mousePos && (activeTool === "parallel_channel" || activeTool === "pitchfork") && !drawStart2 && (
              <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 22, width: "100%", height: "100%", overflow: "visible" }}>
                <line x1={drawStart.x} y1={drawStart.y} x2={mousePos.x} y2={mousePos.y} stroke={drawColor} strokeWidth="1.5" strokeDasharray="6 3" opacity="0.8" />
                <circle cx={mousePos.x} cy={mousePos.y} r="3.5" fill={drawColor} opacity="0.7" />
              </svg>
            )}
            {drawStart && drawStart2 && mousePos && (activeTool === "parallel_channel" || activeTool === "pitchfork") && (
              <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 22, width: "100%", height: "100%", overflow: "visible" }}>
                <line x1={drawStart.x} y1={drawStart.y} x2={drawStart2.x} y2={drawStart2.y} stroke={drawColor} strokeWidth="1.5" opacity="0.8" />
                <line x1={mousePos.x} y1={mousePos.y} x2={mousePos.x + (drawStart2.x - drawStart.x)} y2={mousePos.y + (drawStart2.y - drawStart.y)} stroke={drawColor} strokeWidth="1.5" strokeDasharray="6 3" opacity="0.6" />
                <circle cx={mousePos.x} cy={mousePos.y} r="3.5" fill={drawColor} opacity="0.7" />
              </svg>
            )}

            {/* Drawing start-point indicator */}
            {drawStart && <div className="absolute z-30 pointer-events-none" style={{ left: drawStart.x - 5, top: drawStart.y - 5 }}><div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: drawColor, background: `${drawColor}30`, boxShadow: `0 0 10px ${drawColor}` }} /></div>}
            {drawStart2 && <div className="absolute z-30 pointer-events-none" style={{ left: drawStart2.x - 5, top: drawStart2.y - 5 }}><div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: drawColor, background: `${drawColor}30` }} /></div>}

            {/* Watermark */}
            <div className="absolute top-3 left-3 pointer-events-none select-none" style={{ zIndex: 5 }}>
              <span className="text-4xl font-bold font-mono" style={{ color: "rgba(255,255,255,0.025)" }}>{displayLabel}</span>
            </div>

            {/* OHLC display */}
            {displayBar && (
              <div className="absolute top-2 left-3 pointer-events-none select-none flex items-center gap-2 flex-wrap" style={{ zIndex: 6 }}>
                {(["open","high","low","close"] as const).map(k => (
                  <span key={k} className="text-[10px] font-mono" style={{ color: "hsl(220,14%,45%)" }}>
                    <span style={{ color: "hsl(220,14%,35%)" }}>{k.charAt(0).toUpperCase()} </span>
                    <span style={{ color: k === "high" ? "hsl(150,90%,58%)" : k === "low" ? "hsl(0,85%,62%)" : "hsl(220,14%,65%)" }}>{fmt(displayBar[k])}</span>
                  </span>
                ))}
                {displayBar.volume !== undefined && <span className="text-[10px] font-mono" style={{ color: "hsl(220,14%,35%)" }}>V <span style={{ color: "hsl(220,14%,50%)" }}>{(displayBar.volume / 1e6).toFixed(2)}M</span></span>}
                {compareSymbol && <span className="text-[10px] font-mono px-1 rounded" style={{ background: "rgba(139,92,246,0.1)", color: "hsl(260,80%,70%)" }}>vs {SYMBOLS.find(s => s.value === compareSymbol)?.label}</span>}
              </div>
            )}

            {replayMode && replayIndex >= total && total > 0 && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 25 }}>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: "rgba(10,12,18,0.88)", border: "1px solid rgba(245,158,11,0.3)" }}>
                  <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: "hsl(38,100%,58%)" }} />
                  <span className="text-xs font-mono" style={{ color: "hsl(38,100%,62%)" }}>End of data</span>
                  <span className="text-xs font-mono" style={{ color: "hsl(220,14%,40%)" }}>—</span>
                  <span className="text-xs font-mono" style={{ color: "hsl(220,14%,50%)" }}>all {total} bars shown</span>
                </div>
              </div>
            )}

            {activeTool !== "cursor" && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 25 }}>
                <span className="text-xs font-mono px-3 py-1.5 rounded-full" style={{ background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.25)", color: "hsl(190,90%,65%)" }}>
                  {activeTool === "hline" && "Click to place horizontal line"}
                  {activeTool === "text" && "Click on chart to place text annotation"}
                  {activeTool === "trendline" && (drawStart ? "Click 2nd point to finish" : "Click to set start point")}
                  {activeTool === "ray" && (drawStart ? "Click 2nd point — ray extends forward" : "Click start point")}
                  {activeTool === "fibonacci" && (drawStart ? "Click 2nd point for Fib levels" : "Click high or low to start")}
                  {activeTool === "rectangle" && (drawStart ? "Click 2nd point to finish" : "Click first corner")}
                  {activeTool === "parallel_channel" && (!drawStart ? "Click start of top line" : !drawStart2 ? "Click end of top line" : "Click to set channel width")}
                  {activeTool === "pitchfork" && (!drawStart ? "Click first point (pivot)" : !drawStart2 ? "Click second point" : "Click third point")}
                  {activeTool === "eraser" && "Click to erase last drawing · Esc to cancel"}
                </span>
              </div>
            )}
          </div>

          {/* ── Drawing toolbar ─────────────────────────────────────── */}
          {!replayMode && (
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-2xl overflow-x-auto scrollbar-none"
              style={{ background: "rgba(10,12,18,0.88)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.09)", flexShrink: 0 }}>
              {DRAW_TOOLS.map(tool => (
                <button key={tool.id} onClick={() => setActiveTool(tool.id)} title={`${tool.label} [${tool.key}]`}
                  className="h-8 w-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
                  style={activeTool === tool.id
                    ? { background: tool.id === "eraser" ? "rgba(239,68,68,0.2)" : "rgba(0,229,255,0.15)", color: tool.id === "eraser" ? "hsl(0,85%,65%)" : "hsl(190,90%,65%)", border: `1px solid ${tool.id === "eraser" ? "rgba(239,68,68,0.3)" : "rgba(0,229,255,0.3)"}`, boxShadow: `0 0 12px ${tool.id === "eraser" ? "rgba(239,68,68,0.3)" : "rgba(0,229,255,0.25)"}` }
                    : { color: "hsl(220,14%,50%)", border: "1px solid transparent" }}>
                  {tool.icon}
                </button>
              ))}
              <div className="w-px h-5 bg-white/10 mx-1 flex-shrink-0" />
              {DRAW_COLORS.map(c => (
                <button key={c.value} onClick={() => setDrawColor(c.value)} title={c.label}
                  className="h-4 w-4 rounded-full flex-shrink-0 transition-all"
                  style={{ background: c.value, transform: drawColor === c.value ? "scale(1.4)" : "scale(1)", boxShadow: drawColor === c.value ? `0 0 8px ${c.value}` : "none", outline: drawColor === c.value ? `2px solid ${c.value}` : "none", outlineOffset: "2px" }} />
              ))}
              {drawings.length > 0 && (
                <>
                  <div className="w-px h-5 bg-white/10 mx-1 flex-shrink-0" />
                  <button onClick={() => {
                    drawings.forEach(d => {
                      if (d.kind === "hline" || d.kind === "text") candleSeriesRef.current?.removePriceLine(d.priceLine);
                      if (d.kind === "trendline" || d.kind === "ray") chartRef.current?.removeSeries(d.series);
                      if (d.kind === "rectangle" || d.kind === "parallel_channel") { chartRef.current?.removeSeries(d.series); chartRef.current?.removeSeries(d.series2); }
                      if (d.kind === "fibonacci") d.priceLines.forEach(pl => candleSeriesRef.current?.removePriceLine(pl));
                      if (d.kind === "pitchfork") { chartRef.current?.removeSeries(d.series); chartRef.current?.removeSeries(d.series2); chartRef.current?.removeSeries(d.series3); }
                    });
                    setDrawings([]);
                  }} className="h-6 px-2 flex items-center justify-center rounded-lg text-[9px] font-mono flex-shrink-0"
                    style={{ color: "hsl(0,85%,60%)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }} title="Clear all drawings">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Sub-chart ─────────────────────────────────────────── */}
          {hasSubChart && (
            <div className="relative rounded-xl overflow-hidden border flex-shrink-0" style={{ height: 120, borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="absolute flex items-center gap-1.5 px-3 pt-2 pb-0 z-10 pointer-events-none flex-wrap">
                {hasRSI       && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.18)", color: "hsl(38,100%,65%)", border: "1px solid rgba(245,158,11,0.2)" }}>RSI 14</span>}
                {hasMACD      && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(0,229,255,0.12)", color: "hsl(190,90%,65%)", border: "1px solid rgba(0,229,255,0.2)" }}>MACD 12/26/9</span>}
                {hasATR       && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.15)", color: "hsl(260,80%,72%)", border: "1px solid rgba(139,92,246,0.2)" }}>ATR 14</span>}
                {hasStoch     && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(52,211,153,0.12)", color: "hsl(150,90%,60%)", border: "1px solid rgba(52,211,153,0.2)" }}>Stoch 14/3</span>}
                {hasOBV       && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(0,229,255,0.12)", color: "hsl(190,90%,65%)", border: "1px solid rgba(0,229,255,0.2)" }}>OBV</span>}
                {hasWilliamsR && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.18)", color: "hsl(38,100%,65%)", border: "1px solid rgba(245,158,11,0.2)" }}>%R 14</span>}
                {hasCCI       && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.15)", color: "hsl(260,80%,72%)", border: "1px solid rgba(139,92,246,0.2)" }}>CCI 20</span>}
                {hasADX       && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(52,211,153,0.12)", color: "hsl(150,90%,60%)", border: "1px solid rgba(52,211,153,0.2)" }}>ADX 14</span>}
              </div>
              <div ref={subChartContainerRef} className="w-full h-full" />
            </div>
          )}

          {/* ── Multi-TF chart ─────────────────────────────────────── */}
          {showMultiTf && (
            <div className="relative rounded-xl overflow-hidden border flex-shrink-0" style={{ height: 200, borderColor: "rgba(100,180,255,0.2)" }}>
              <div className="absolute flex items-center gap-2 px-3 pt-2 z-10 pointer-events-none">
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(100,180,255,0.12)", color: "hsl(200,80%,70%)", border: "1px solid rgba(100,180,255,0.25)" }}>
                  MTF · {displayLabel} · {INTERVALS.find(i => i.value === multiTfInterval)?.label ?? multiTfInterval}
                </span>
              </div>
              <div ref={multiTfContainerRef} className="w-full h-full" />
            </div>
          )}
        </div>

        {/* ── Sidebars ─────────────────────────────────────────────── */}
        <div className="w-full lg:w-[264px] flex flex-col gap-3 overflow-y-auto shrink-0">

          {/* Watchlist panel */}
          {showWatchlist && (
            <div className="rounded-xl border overflow-hidden" style={{ background: "hsl(222,22%,9%)", borderColor: "rgba(100,180,255,0.2)" }}>
              <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(200,80%,60%)" }}>Watchlist</span>
                <button onClick={() => setShowWatchlist(false)} className="h-5 w-5 flex items-center justify-center" style={{ color: "hsl(220,14%,40%)" }}><X className="h-3 w-3" /></button>
              </div>
              <div className="overflow-y-auto max-h-64">
                {watchlistData.map(sym => (
                  <button key={sym.value} onClick={() => handleSymbolChange(sym.value)}
                    className="w-full flex items-center gap-2 px-3 py-2 transition-all text-left"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: sym.value === symbol ? "rgba(100,180,255,0.08)" : "transparent" }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-mono font-semibold" style={{ color: "hsl(220,14%,75%)" }}>{sym.label}</p>
                        {sym.isLive && <span className="h-1.5 w-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: "hsl(150,90%,55%)" }} title="Live price" />}
                      </div>
                      <p className="text-[9px] font-mono" style={{ color: "hsl(220,14%,38%)" }}>${fmt(sym.lastPrice)}</p>
                    </div>
                    <svg width="60" height="20" viewBox="0 0 60 20" className="flex-shrink-0">
                      <polyline points={sym.sparkPoints} fill="none" stroke={sym.change >= 0 ? "hsl(150,90%,55%)" : "hsl(0,85%,60%)"} strokeWidth="1.2" />
                    </svg>
                    <span className="text-[10px] font-mono font-bold flex-shrink-0" style={{ color: sym.change >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>
                      {sym.change >= 0 ? "+" : ""}{sym.change.toFixed(2)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Paper Trade panel */}
          {showOrderPanel && !replayMode && (
            <div className="rounded-xl p-4 flex flex-col gap-3 border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", borderColor: "rgba(52,211,153,0.15)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "hsl(150,90%,55%)" }}>Paper Trade</span>
                {(trades.length > 0 || position) && (
                  <button onClick={resetTrading} className="flex items-center gap-1 text-[10px] font-mono" style={{ color: "hsl(220,14%,40%)" }}><RotateCcw className="h-2.5 w-2.5" /> Reset</button>
                )}
              </div>

              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{ color: "hsl(220,14%,40%)" }}>Order Type</p>
                <div className="flex gap-0.5 p-0.5 rounded-lg border" style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.07)" }}>
                  {(["market", "limit", "stop"] as const).map(ot => (
                    <button key={ot} onClick={() => setChartOrderType(ot)}
                      className="flex-1 py-1.5 text-[10px] font-mono rounded-md transition-all"
                      style={chartOrderType === ot ? { background: "rgba(0,229,255,0.15)", color: "hsl(190,90%,65%)", border: "1px solid rgba(0,229,255,0.25)" } : { color: "hsl(220,14%,45%)", border: "1px solid transparent" }}>
                      {ot.charAt(0).toUpperCase() + ot.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {chartOrderType !== "market" && (
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{ color: "hsl(220,14%,40%)" }}>{chartOrderType === "limit" ? "Limit Price" : "Stop Price"}</p>
                  <input type="number" value={chartOrderType === "limit" ? chartLimitPrice : chartStopPrice} onChange={e => chartOrderType === "limit" ? setChartLimitPrice(e.target.value) : setChartStopPrice(e.target.value)} placeholder={currentBar ? fmt(currentBar.close) : "price"} className="w-full text-xs font-mono px-2.5 py-2 rounded-lg outline-none" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "hsl(220,14%,80%)" }} />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,40%)" }}>Leverage</p>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "hsl(38,95%,65%)", border: "1px solid rgba(245,158,11,0.2)" }}>{chartLeverage}x</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {[1, 2, 5, 10, 25].map(lev => (
                    <button key={lev} onClick={() => setChartLeverage(lev)} className="px-2 py-0.5 text-[10px] font-mono rounded transition-all"
                      style={chartLeverage === lev ? { background: "rgba(245,158,11,0.14)", color: "hsl(38,95%,65%)", border: "1px solid rgba(245,158,11,0.28)" } : { background: "rgba(255,255,255,0.04)", color: "hsl(220,14%,45%)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      {lev}x
                    </button>
                  ))}
                </div>
              </div>

              {position && (
                <div className="rounded-lg p-3 border" style={{ background: "rgba(52,211,153,0.05)", borderColor: "rgba(52,211,153,0.15)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: "hsl(150,90%,55%)" }} />
                      <span className="text-xs font-mono font-semibold" style={{ color: "hsl(150,90%,60%)" }}>{position.side.toUpperCase()} {chartLeverage}x</span>
                    </div>
                    <div className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "hsl(190,90%,55%)" }} /><span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(190,90%,55%)" }}>Live</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs font-mono mb-2">
                    <div><p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,14%,40%)" }}>Entry</p><p className="font-bold">${fmt(position.price)}</p></div>
                    <div><p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,14%,40%)" }}>Current</p><p className="font-bold">${fmt(liveChartPrice)}</p></div>
                  </div>
                  {unrealizedPnl !== null && unrealizedPct !== null && (
                    <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                      <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: "hsl(220,14%,40%)" }}>Unrealized P&L</p>
                      <p className="text-base font-mono font-bold" style={{ color: unrealizedPnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>{fmtPnl(unrealizedPnl)}</p>
                      <p className="text-[10px] font-mono mt-0.5" style={{ color: unrealizedPnl >= 0 ? "hsl(150,90%,50%)" : "hsl(0,78%,55%)" }}>{fmtPct(unrealizedPct)}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div><p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,14%,40%)" }}>Equity</p><p className="font-bold" style={{ color: equityGain >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p></div>
                <div><p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,14%,40%)" }}>P&L</p><p className="font-bold" style={{ color: totalPnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>{fmtPnl(totalPnl)}</p></div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: position?.side === "short" ? "CLOSE SHORT" : "BUY LONG", disabled: !currentBar || position?.side === "long",
                    onClick: () => { if (!currentBar) return; if (chartOrderType === "market") handleBuy(currentBar); else { const p = Number(chartOrderType === "limit" ? chartLimitPrice : chartStopPrice); if (p) setPendingChartOrders(prev => [...prev, { id: Date.now(), side: "buy" as const, orderType: chartOrderType as "limit"|"stop", price: p }]); } },
                    style: { background: "linear-gradient(135deg, hsl(150,80%,28%), hsl(150,80%,22%))", borderColor: "rgba(52,211,153,0.3)", color: "hsl(150,90%,65%)" } },
                  { label: position?.side === "long" ? "CLOSE LONG" : "SELL SHORT", disabled: !currentBar || position?.side === "short",
                    onClick: () => { if (currentBar) handleSell(currentBar, position ?? undefined); },
                    style: { background: "linear-gradient(135deg, hsl(0,70%,28%), hsl(0,70%,22%))", borderColor: "rgba(239,68,68,0.3)", color: "hsl(0,85%,70%)" } },
                ].map(btn => (
                  <button key={btn.label} disabled={btn.disabled} onClick={btn.onClick}
                    className="flex items-center justify-center py-2 rounded-lg border font-mono font-bold text-xs transition-all disabled:opacity-25"
                    style={btn.disabled ? { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "hsl(220,14%,40%)" } : btn.style}>
                    {btn.label}
                  </button>
                ))}
              </div>
              {currentBar && <p className="text-[10px] text-center font-mono" style={{ color: "hsl(220,14%,35%)" }}>price ${fmt(currentBar.close)}</p>}

              {pendingChartOrders.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,38%)" }}>Pending ({pendingChartOrders.length})</p>
                  {pendingChartOrders.map(o => (
                    <div key={o.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="flex-1 text-[10px] font-mono" style={{ color: o.side === "buy" ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>{o.side.toUpperCase()} {o.orderType.toUpperCase()} @ ${fmt(o.price)}</p>
                      <button onClick={() => setPendingChartOrders(prev => prev.filter(p => p.id !== o.id))} className="h-5 w-5 flex items-center justify-center rounded" style={{ color: "hsl(0,78%,60%)" }}><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Replay simulator ──────────────────────────────────── */}
          {replayMode && (replaySidebarOpen || showOrderPanel) && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border overflow-hidden" style={{ background: "linear-gradient(160deg, rgba(245,158,11,0.07) 0%, rgba(245,158,11,0.02) 100%)", borderColor: "rgba(245,158,11,0.18)" }}>
                <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(245,158,11,0.1)" }}>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "hsl(38,100%,60%)" }} />
                    <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(38,100%,55%)" }}>Replay Mode</span>
                  </div>
                  <button onClick={resetTrading} className="flex items-center gap-1 text-[10px] font-mono" style={{ color: "hsl(220,14%,38%)" }}><RotateCcw className="h-2.5 w-2.5" /> Reset</button>
                </div>
                <div className="px-3 py-2.5">
                  {currentDate && <p className="text-[10px] font-mono mb-1" style={{ color: "hsl(38,100%,50%)" }}>{currentDate}</p>}
                  {currentBar ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-mono font-bold" style={{ color: isUp ? "hsl(150,90%,60%)" : "hsl(0,85%,62%)" }}>${fmt(currentBar.close)}</span>
                      {changePercent && <span className="text-xs font-mono" style={{ color: isUp ? "hsl(150,90%,50%)" : "hsl(0,85%,55%)" }}>{isUp ? "+" : ""}{changePercent}%</span>}
                    </div>
                  ) : <div className="h-7 flex items-center"><span className="text-xs font-mono" style={{ color: "hsl(220,14%,35%)" }}>Waiting for data…</span></div>}
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-all duration-150" style={{ width: `${replayProgress}%`, background: "linear-gradient(90deg, hsl(38,100%,45%), hsl(38,100%,60%))" }} />
                    </div>
                    <span className="text-[9px] font-mono tabular-nums flex-shrink-0" style={{ color: "hsl(220,14%,40%)" }}>{replayProgress.toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)", borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,42%)" }}>Position</span>
                  {currentBar && <span className="text-[10px] font-mono" style={{ color: "hsl(220,14%,32%)" }}>at close ${fmt(currentBar.close)}</span>}
                </div>
                <div className="px-3 py-2.5">
                  {position ? (
                    <div className="rounded-lg px-3 py-2.5 mb-3 border" style={position.side === "short" ? { background: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.18)" } : { background: "rgba(52,211,153,0.05)", borderColor: "rgba(52,211,153,0.18)" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: position.side === "short" ? "hsl(0,85%,62%)" : "hsl(150,90%,55%)" }} />
                          <span className="text-[10px] font-mono font-semibold uppercase" style={{ color: position.side === "short" ? "hsl(0,85%,65%)" : "hsl(150,90%,60%)" }}>{position.side === "short" ? "Short" : "Long"}</span>
                        </div>
                        <span className="text-[10px] font-mono" style={{ color: "hsl(220,14%,40%)" }}>{fmtDate(position.time)}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-mono" style={{ color: "hsl(220,14%,50%)" }}>Entry <span className="text-sm font-bold" style={{ color: "hsl(220,14%,75%)" }}>${fmt(position.price)}</span></span>
                        {unrealizedPnl !== null && unrealizedPct !== null && (
                          <div className="text-right">
                            <p className="text-sm font-mono font-bold leading-none" style={{ color: unrealizedPnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>{fmtPnl(unrealizedPnl)}</p>
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
                    <button disabled={!currentBar || position?.side === "long"} onClick={() => currentBar && handleBuy(currentBar)}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border font-mono font-bold text-sm transition-all disabled:opacity-20"
                      style={(!currentBar || position?.side === "long") ? { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)", color: "hsl(220,14%,38%)" } : { background: "linear-gradient(160deg, hsl(150,75%,22%), hsl(150,75%,17%))", borderColor: "rgba(52,211,153,0.28)", color: "hsl(150,90%,65%)" }}>
                      <TrendingUp className="h-3.5 w-3.5" />{position?.side === "short" ? "CLOSE" : "BUY"}<span className="text-[9px] opacity-50">[B]</span>
                    </button>
                    <button disabled={!currentBar || position?.side === "short"} onClick={() => currentBar && handleSell(currentBar, position ?? undefined)}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border font-mono font-bold text-sm transition-all disabled:opacity-20"
                      style={(!currentBar || position?.side === "short") ? { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)", color: "hsl(220,14%,38%)" } : { background: "linear-gradient(160deg, hsl(0,65%,24%), hsl(0,65%,18%))", borderColor: "rgba(239,68,68,0.28)", color: "hsl(0,85%,68%)" }}>
                      <TrendingDown className="h-3.5 w-3.5" />{position?.side === "long" ? "CLOSE" : "SELL"}<span className="text-[9px] opacity-50">[S]</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)", borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,42%)" }}>Session</span>
                  <button
                    onClick={() => setAccountModalOpen(true)}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors"
                    style={{ color: "hsl(220,14%,40%)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                    title="Configure paper trading account"
                  >Setup</button>
                </div>
                <div className="px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-3">
                  <div><p className="text-[9px] font-mono uppercase tracking-wider mb-0.5" style={{ color: "hsl(220,14%,36%)" }}>Equity</p><p className="text-sm font-mono font-bold leading-none" style={{ color: equityGain >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p><p className="text-[10px] font-mono mt-0.5" style={{ color: equityGain >= 0 ? "hsl(150,70%,40%)" : "hsl(0,70%,48%)" }}>{fmtPct(equityGainPct)}</p></div>
                  <div><p className="text-[9px] font-mono uppercase tracking-wider mb-0.5" style={{ color: "hsl(220,14%,36%)" }}>Realized P&L</p><p className="text-sm font-mono font-bold leading-none" style={{ color: totalPnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>{fmtPnl(totalPnl)}</p><p className="text-[10px] font-mono mt-0.5" style={{ color: "hsl(220,14%,38%)" }}>{trades.length} trade{trades.length !== 1 ? "s" : ""}</p></div>
                  <div><p className="text-[9px] font-mono uppercase tracking-wider mb-0.5" style={{ color: "hsl(220,14%,36%)" }}>Win Rate</p><p className="text-sm font-mono font-bold leading-none" style={{ color: trades.length > 0 ? (winRate >= 50 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)") : "hsl(220,14%,45%)" }}>{trades.length > 0 ? `${winRate.toFixed(0)}%` : "—"}</p><p className="text-[10px] font-mono mt-0.5" style={{ color: "hsl(220,14%,38%)" }}>{trades.length > 0 ? `${wins}W · ${trades.length - wins}L` : "no trades yet"}</p></div>
                  <div><p className="text-[9px] font-mono uppercase tracking-wider mb-0.5" style={{ color: "hsl(220,14%,36%)" }}>Capital</p><p className="text-sm font-mono font-bold leading-none" style={{ color: "hsl(220,14%,58%)" }}>${ptCapital.toLocaleString()}</p><p className="text-[10px] font-mono mt-0.5" style={{ color: "hsl(220,14%,35%)" }}>starting</p></div>
                </div>
              </div>

              <div className="rounded-xl border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)", borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,42%)" }}>Trade Log</span>
                  {trades.length > 0 && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "hsl(220,14%,45%)" }}>{trades.length}</span>}
                </div>
                {trades.length === 0 ? (
                  <div className="px-3 py-5 text-center"><p className="text-[10px] font-mono leading-relaxed" style={{ color: "hsl(220,14%,30%)" }}>No closed trades yet.<br />Press <kbd className="px-1 rounded" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>B</kbd> to buy, <kbd className="px-1 rounded" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>S</kbd> to sell.</p></div>
                ) : (
                  <div className="overflow-y-auto max-h-[180px] px-2 py-2 space-y-1.5">
                    {[...trades].reverse().map((t, i) => (
                      <div key={t.id} className="rounded-lg px-2.5 py-2 border" style={t.pnl >= 0 ? { background: "rgba(52,211,153,0.04)", borderColor: "rgba(52,211,153,0.12)" } : { background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.1)" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-mono" style={{ color: "hsl(220,14%,38%)" }}>#{trades.length - i}</span>
                          <span className="text-xs font-mono font-bold" style={{ color: t.pnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>{fmtPnl(t.pnl)} <span className="text-[10px] font-normal opacity-75">({fmtPct(t.pnlPct)})</span></span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-mono" style={{ color: "hsl(220,14%,42%)" }}>
                          <span style={{ color: "hsl(150,80%,50%)" }}>B</span><span>${fmt(t.entryPrice)}</span>
                          <span style={{ color: "hsl(220,14%,30%)" }}>→</span>
                          <span style={{ color: "hsl(0,75%,60%)" }}>S</span><span>${fmt(t.exitPrice)}</span>
                        </div>
                        <div className="text-[9px] font-mono mt-0.5" style={{ color: "hsl(220,14%,30%)" }}>{fmtDate(t.entryTime)} → {fmtDate(t.exitTime)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
