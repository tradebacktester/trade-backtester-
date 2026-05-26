import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
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
  SelectItem,
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
} from "lucide-react";
import {
  calcSMA, calcEMA, calcBB, calcRSI, calcMACD,
  loadLayouts, saveLayouts, loadIndicators, persistIndicators,
  type DrawnObject, type DrawTool, type DrawStart, type OhlcState,
  type KlineBar, type Position, type SimTrade,
  type IndicatorConfig, type ChartLayout, type SerializableDrawing, type IndicatorId,
} from "@/lib/chart-utils";

// ── Constants ──────────────────────────────────────────────────────────

const SYMBOLS = [
  { value: "BTCUSDT", label: "BTC/USDT" },
  { value: "ETHUSDT", label: "ETH/USDT" },
  { value: "SOLUSDT", label: "SOL/USDT" },
  { value: "BNBUSDT", label: "BNB/USDT" },
  { value: "XRPUSDT", label: "XRP/USDT" },
  { value: "ADAUSDT", label: "ADA/USDT" },
  { value: "DOGEUSDT", label: "DOGE/USDT" },
  { value: "AVAXUSDT", label: "AVAX/USDT" },
  { value: "DOTUSDT", label: "DOT/USDT" },
  { value: "MATICUSDT", label: "MATIC/USDT" },
];

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
const STARTING_CAPITAL = 10_000;

// Shared chart visual config used for main + sub + multitf charts
const CHART_BG = "hsl(222,28%,7%)";
const CHART_TEXT = "hsl(220,14%,60%)";
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

function makeChartOptions(width: number, height: number, hideTimeScale = false) {
  return {
    width,
    height,
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

  // Trading sim
  const [position, setPosition] = useState<Position | null>(null);
  const [trades, setTrades] = useState<SimTrade[]>([]);
  const [equity, setEquity] = useState(STARTING_CAPITAL);

  // Drawing tools
  const [activeTool, setActiveTool] = useState<DrawTool>("cursor");
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0].value);
  const [drawings, setDrawings] = useState<DrawnObject[]>([]);
  const [drawStart, setDrawStart] = useState<DrawStart | null>(null);

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
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const sortedKlinesRef = useRef<KlineBar[]>([]);
  const markersRef = useRef<SeriesMarker<Time>[]>([]);
  const drawingsRef = useRef<DrawnObject[]>([]);

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

  const queryClient = useQueryClient();
  const params = { symbol, interval, limit: 500 };

  const { data: klines, isLoading, error, isFetching } = useGetKlines(params, {
    query: {
      queryKey: getGetKlinesQueryKey(params),
      staleTime: 30_000,
      refetchInterval: replayMode ? false : 60_000,
    },
  });

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
  const hasRSI  = !!indicators.find(i => i.id === "rsi")?.enabled;
  const hasMACD = !!indicators.find(i => i.id === "macd")?.enabled;

  const sorted = sortedKlinesRef.current;
  const total = sorted.length;
  const currentBar = replayMode
    ? sorted[Math.min(replayIndex, total) - 1] ?? null
    : klines && klines.length > 0 ? klines[klines.length - 1] : null;
  const isUp = currentBar ? currentBar.close >= currentBar.open : true;
  const changePercent = currentBar ? (((currentBar.close - currentBar.open) / currentBar.open) * 100).toFixed(2) : null;
  const displayLabel = SYMBOLS.find(s => s.value === symbol)?.label ?? symbol;
  const displayBar = ohlcDisplay ?? (currentBar ? { ...currentBar, time: "" } : null);
  const replayProgress = total > 0 ? (replayIndex / total) * 100 : 0;
  const currentDate = replayMode && currentBar ? fmtDate(currentBar.time) : null;

  const unrealizedPnl = position && currentBar ? (currentBar.close - position.price) * position.units : null;
  const unrealizedPct = position && currentBar ? ((currentBar.close - position.price) / position.price) * 100 : null;
  const wins = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const equityGain = equity - STARTING_CAPITAL;
  const equityGainPct = (equityGain / STARTING_CAPITAL) * 100;

  const DRAW_TOOLS: { id: DrawTool; icon: React.ReactNode; label: string; key: string }[] = [
    { id: "cursor",    icon: <MousePointer2 className="h-3.5 w-3.5" />, label: "Select",  key: "Esc" },
    { id: "hline",     icon: <Minus className="h-3.5 w-3.5" />,         label: "H-Line",  key: "H" },
    { id: "trendline", icon: <GitCommit className="h-3.5 w-3.5 rotate-45" />, label: "Trend", key: "T" },
    { id: "fibonacci", icon: <Hash className="h-3.5 w-3.5" />,          label: "Fib",     key: "F" },
    { id: "eraser",    icon: <Eraser className="h-3.5 w-3.5" />,        label: "Erase",   key: "E" },
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

    if (activeTool === "trendline" || activeTool === "fibonacci") {
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
    setPosition(null); setTrades([]); setEquity(STARTING_CAPITAL);
    markersRef.current = []; applyMarkers();
  }, [applyMarkers]);

  const handleBuy = useCallback((bar: KlineBar) => {
    if (position) return;
    const units = equity / bar.close;
    setPosition({ price: bar.close, time: bar.time, units, capitalAtEntry: equity });
    const marker: SeriesMarker<Time> = {
      time: bar.time as Time, position: "belowBar",
      color: "hsl(150,90%,55%)", shape: "arrowUp",
      text: `B $${fmt(bar.close)}`, size: 1,
    };
    markersRef.current = [...markersRef.current, marker].sort((a, b) => (a.time as number) - (b.time as number));
    applyMarkers();
  }, [position, equity, applyMarkers]);

  const handleSell = useCallback((bar: KlineBar, pos: Position) => {
    const exitValue = pos.units * bar.close;
    const pnl = exitValue - pos.capitalAtEntry;
    const pnlPct = (pnl / pos.capitalAtEntry) * 100;
    setTrades(prev => [...prev, { id: Date.now(), entryPrice: pos.price, entryTime: pos.time, exitPrice: bar.close, exitTime: bar.time, units: pos.units, pnl, pnlPct }]);
    setPosition(null);
    setEquity(pos.capitalAtEntry + pnl);
    const marker: SeriesMarker<Time> = {
      time: bar.time as Time, position: "aboveBar",
      color: pnl >= 0 ? "hsl(150,90%,55%)" : "hsl(0,85%,60%)",
      shape: "arrowDown", text: `S ${fmtPct(pnlPct)}`, size: 1,
    };
    markersRef.current = [...markersRef.current, marker].sort((a, b) => (a.time as number) - (b.time as number));
    applyMarkers();
  }, [applyMarkers]);

  // ── Replay helpers ─────────────────────────────────────────────────

  const enterReplay = useCallback(() => {
    setIsPlaying(false); setReplayIndex(MIN_CANDLES); setReplayMode(true);
    setPosition(null); setTrades([]); setEquity(STARTING_CAPITAL);
    markersRef.current = [];
  }, []);

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
    if (replayMode) exitReplay();
    setInterval(val as GetKlinesInterval);
  }, [replayMode, exitReplay]);

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
        if (e.key === "s" || e.key === "S") { if (positionRef.current) { const bar = sortedKlinesRef.current[replayIndexRef.current - 1]; if (bar) handleSell(bar, positionRef.current); } }
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

    const chart = createChart(container, makeChartOptions(container.clientWidth, container.clientHeight || 480));

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

    const observer = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markersPluginRef.current = null;
      indicatorSeriesRef.current.clear();
    };
  }, []);

  // ── Feed main chart data ───────────────────────────────────────────

  useEffect(() => {
    if (!klines || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    const sortedData = [...klines].sort((a, b) => a.time - b.time);
    sortedKlinesRef.current = sortedData;
    const slice = replayMode ? sortedData.slice(0, replayIndex) : sortedData;
    candleSeriesRef.current.setData(slice.map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
    volumeSeriesRef.current.setData(slice.map(k => ({ time: k.time as Time, value: k.volume, color: k.close >= k.open ? "hsla(150,90%,50%,0.3)" : "hsla(0,85%,60%,0.3)" })));
    replayMode ? chartRef.current?.timeScale().scrollToPosition(4, false) : chartRef.current?.timeScale().fitContent();

    // Restore pending layout drawings
    if (pendingRestoreRef.current) {
      const toRestore = pendingRestoreRef.current;
      pendingRestoreRef.current = null;
      restoreDrawingsFromData(toRestore, sortedData);
    }
  }, [klines, replayMode, replayIndex]);

  // ── Indicator overlay series (SMA, EMA, BB on main chart) ──────────

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const bars = sortedKlinesRef.current;
    const seriesMap = indicatorSeriesRef.current;

    const overlayIds: IndicatorId[] = ["sma20", "sma50", "ema20", "ema50", "bb"];

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
        if (ind.id === "ema20" || ind.id === "ema50") {
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
      const sc = createChart(container, makeChartOptions(container.clientWidth, container.clientHeight || 120, true));
      sc.priceScale("right").applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });

      // Sync scroll ↔ main chart
      sc.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (isSyncingRef.current || !range) return;
        isSyncingRef.current = true;
        try { chartRef.current?.timeScale().setVisibleLogicalRange(range); } catch { /* ignore */ }
        isSyncingRef.current = false;
      });

      const subObserver = new ResizeObserver(() => {
        if (subChartContainerRef.current && subChartRef.current) {
          subChartRef.current.applyOptions({
            width: subChartContainerRef.current.clientWidth,
            height: subChartContainerRef.current.clientHeight,
          });
        }
      });
      subObserver.observe(container);
      (container as HTMLElement & { _subObs?: ResizeObserver })._subObs = subObserver;

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

    // Sync visible range from main chart
    const mainRange = chartRef.current?.timeScale().getVisibleLogicalRange();
    if (mainRange) try { sc.timeScale().setVisibleLogicalRange(mainRange); } catch { /* ignore */ }

  }, [klines, hasSubChart, hasRSI, hasMACD]);

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
      const mc = createChart(container, makeChartOptions(container.clientWidth, container.clientHeight || 200));
      const mcCandle = mc.addSeries(CandlestickSeries, {
        upColor: "hsl(150,90%,52%)", downColor: "hsl(0,85%,58%)",
        borderUpColor: "hsl(150,90%,52%)", borderDownColor: "hsl(0,85%,58%)",
        wickUpColor: "hsl(150,80%,45%)", wickDownColor: "hsl(0,75%,50%)",
        priceLineVisible: true, priceLineColor: "hsla(190,90%,60%,0.7)",
      });
      const mcVol = mc.addSeries(HistogramSeries, { color: "hsl(190,90%,50%)", priceFormat: { type: "volume" }, priceScaleId: "vol2" });
      mc.priceScale("vol2").applyOptions({ scaleMargins: { top: 0.88, bottom: 0 } });

      const mcObs = new ResizeObserver(() => {
        if (multiTfContainerRef.current && multiTfChartRef.current) {
          multiTfChartRef.current.applyOptions({
            width: multiTfContainerRef.current.clientWidth,
            height: multiTfContainerRef.current.clientHeight,
          });
        }
      });
      mcObs.observe(container);
      (container as HTMLElement & { _mcObs?: ResizeObserver })._mcObs = mcObs;

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
      if (d.kind === "hline")     return { kind: "hline",     id: d.id, price: d.price, color: d.color };
      if (d.kind === "trendline") return { kind: "trendline", id: d.id, p1: d.p1, p2: d.p2, color: d.color };
      return { kind: "fibonacci", id: d.id, high: d.high, low: d.low, color: d.color };
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

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between rounded-xl px-5 py-3 border"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
          backdropFilter: "blur(12px)",
          borderColor: "rgba(255,255,255,0.07)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ background: "linear-gradient(135deg, hsl(190,90%,65%), hsl(210,80%,75%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Live Chart
            </h1>
            <p className="text-xs text-muted-foreground/70 mt-0.5 font-mono">Real-time Binance data</p>
          </div>
          {replayMode && (
            <span className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded-full border" style={{ background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.3)", color: "hsl(38,100%,65%)", boxShadow: "0 0 12px rgba(245,158,11,0.15)" }}>
              ● REPLAY
            </span>
          )}
          {drawings.length > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1" style={{ background: "rgba(0,229,255,0.08)", borderColor: "rgba(0,229,255,0.25)", color: "hsl(190,90%,65%)" }}>
              <Pencil className="h-2.5 w-2.5" /> {drawings.length}
            </span>
          )}
          {indicators.some(i => i.enabled) && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1" style={{ background: "rgba(150,90%,55%,0.08)", borderColor: "rgba(150,180,255,0.25)", color: "hsl(200,80%,65%)" }}>
              <Layers className="h-2.5 w-2.5" /> {indicators.filter(i => i.enabled).map(i => i.label.split(" ")[0]).join(" · ")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Indicators button */}
          <div className="relative">
            <button
              onClick={() => { setShowIndicators(v => !v); setShowLayoutPanel(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={showIndicators
                ? { background: "rgba(0,229,255,0.12)", borderColor: "rgba(0,229,255,0.3)", color: "hsl(190,90%,65%)" }
                : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}
            >
              <BarChart2 className="h-3.5 w-3.5" /> Indicators
            </button>

            {showIndicators && (
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-xl p-3 w-52 flex flex-col gap-1"
                style={{ background: "hsl(222,28%,11%)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
              >
                <p className="text-[9px] font-mono uppercase tracking-widest px-1 mb-1" style={{ color: "hsl(220,14%,40%)" }}>Overlays</p>
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
                    {ind.enabled && <Check className="h-3 w-3" style={{ color: ind.color }} />}
                  </button>
                ))}
                <div className="h-px my-1" style={{ background: "rgba(255,255,255,0.08)" }} />
                <p className="text-[9px] font-mono uppercase tracking-widest px-1 mb-1" style={{ color: "hsl(220,14%,40%)" }}>Sub-pane</p>
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
                    {ind.enabled && <Check className="h-3 w-3" style={{ color: ind.color }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

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
              Multi-TF
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
              <FolderOpen className="h-3.5 w-3.5" /> Layouts
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

          {!replayMode && (
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </button>
          )}
          {!replayMode ? (
            <button
              onClick={enterReplay}
              disabled={!klines || klines.length < MIN_CANDLES}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)", color: "hsl(38,100%,60%)", boxShadow: "0 0 16px rgba(245,158,11,0.08)" }}
            >
              <Clapperboard className="h-3.5 w-3.5" /> Replay
            </button>
          ) : (
            <button
              onClick={exitReplay}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all text-muted-foreground hover:text-foreground"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <X className="h-3 w-3" /> Exit Replay
            </button>
          )}
        </div>
      </div>

      {/* Click-away to close panels */}
      {(showIndicators || showLayoutPanel) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowIndicators(false); setShowLayoutPanel(false); }} />
      )}

      {/* ── Controls row ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={symbol} onValueChange={handleSymbolChange}>
          <SelectTrigger className="w-36 h-8 text-xs font-mono border" disabled={replayMode} style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYMBOLS.map(s => <SelectItem key={s.value} value={s.value} className="text-xs font-mono">{s.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-0.5 rounded-lg p-0.5 border" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
          {INTERVALS.map(iv => (
            <button
              key={iv.value}
              onClick={() => handleIntervalChange(iv.value)}
              className="px-2.5 py-1 text-[11px] font-mono rounded-md transition-all"
              style={interval === iv.value
                ? { background: "rgba(0,229,255,0.15)", color: "hsl(190,90%,65%)", boxShadow: "0 0 12px rgba(0,229,255,0.15), inset 0 1px 0 rgba(0,229,255,0.1)" }
                : { color: "hsl(220,14%,55%)" }}
            >
              {iv.label}
            </button>
          ))}
        </div>

        {currentBar && !replayMode && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-lg font-mono font-bold" style={{ color: isUp ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)", textShadow: isUp ? "0 0 20px rgba(52,211,153,0.4)" : "0 0 20px rgba(239,68,68,0.4)" }}>
              ${fmt(currentBar.close)}
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-md border" style={isUp
              ? { background: "rgba(52,211,153,0.08)", borderColor: "rgba(52,211,153,0.25)", color: "hsl(150,90%,58%)" }
              : { background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "hsl(0,85%,62%)" }}>
              {isUp ? "+" : ""}{changePercent}%
            </span>
          </div>
        )}
      </div>

      {/* ── Replay toolbar ───────────────────────────────────────── */}
      {replayMode && (
        <div className="flex flex-col gap-2 rounded-xl px-4 py-3 border" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))", borderColor: "rgba(245,158,11,0.2)", boxShadow: "0 0 30px rgba(245,158,11,0.06), inset 0 1px 0 rgba(245,158,11,0.08)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0.5">
              {[
                { icon: <SkipBack className="h-3.5 w-3.5" />, onClick: jumpToStart, disabled: replayIndex <= MIN_CANDLES },
                { icon: <StepBack className="h-3.5 w-3.5" />, onClick: stepBack, disabled: replayIndex <= MIN_CANDLES },
              ].map((btn, i) => (
                <button key={i} onClick={btn.onClick} disabled={btn.disabled} className="h-8 w-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30 hover:bg-white/5" style={{ color: "hsl(220,14%,65%)" }}>{btn.icon}</button>
              ))}
              <button
                onClick={() => setIsPlaying(p => !p)}
                disabled={replayIndex >= total}
                className="h-9 w-9 flex items-center justify-center rounded-lg border transition-all disabled:opacity-30"
                style={isPlaying
                  ? { background: "hsl(38,100%,55%)", borderColor: "transparent", color: "#000", boxShadow: "0 0 20px rgba(245,158,11,0.5)" }
                  : { background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.3)", color: "hsl(38,100%,60%)", boxShadow: "0 0 12px rgba(245,158,11,0.1)" }}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              {[
                { icon: <StepForward className="h-3.5 w-3.5" />, onClick: stepForward, disabled: replayIndex >= total },
                { icon: <SkipForward className="h-3.5 w-3.5" />, onClick: jumpToEnd, disabled: replayIndex >= total },
              ].map((btn, i) => (
                <button key={i} onClick={btn.onClick} disabled={btn.disabled} className="h-8 w-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30 hover:bg-white/5" style={{ color: "hsl(220,14%,65%)" }}>{btn.icon}</button>
              ))}
            </div>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono" style={{ color: "hsl(220,14%,50%)" }}>Speed</span>
              <div className="flex gap-0.5">
                {SPEEDS.map(s => (
                  <button key={s.value} onClick={() => setReplaySpeed(s.value)} className="px-2 py-0.5 text-[11px] font-mono rounded transition-all"
                    style={replaySpeed === s.value ? { background: "rgba(245,158,11,0.2)", color: "hsl(38,100%,65%)", border: "1px solid rgba(245,158,11,0.3)" } : { color: "hsl(220,14%,50%)" }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {currentDate && <span className="text-xs font-mono" style={{ color: "hsl(38,100%,65%)" }}>{currentDate}</span>}
              {currentBar && <span className="text-sm font-mono font-bold" style={{ color: isUp ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>${fmt(currentBar.close)}</span>}
              <span className="text-[11px] font-mono tabular-nums" style={{ color: "hsl(220,14%,45%)" }}>{replayIndex}/{total}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="range" min={MIN_CANDLES} max={total} value={replayIndex}
              onChange={e => { setIsPlaying(false); setReplayIndex(Number(e.target.value)); }}
              className="flex-1 h-1 cursor-pointer rounded-full" style={{ accentColor: "hsl(38,100%,55%)" }} />
            <span className="text-[10px] font-mono tabular-nums w-8 text-right" style={{ color: "hsl(220,14%,45%)" }}>{replayProgress.toFixed(0)}%</span>
          </div>
          <p className="text-[10px] font-mono" style={{ color: "hsl(220,14%,35%)" }}>← → step · Space play/pause · B buy · S sell · H/T/F draw · Esc exit</p>
        </div>
      )}

      {/* ── Chart area ───────────────────────────────────────────── */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* ── Charts column ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">

          {/* Main chart container */}
          <div
            className="relative rounded-xl overflow-hidden"
            style={{
              flex: (hasSubChart || showMultiTf) ? "0 0 auto" : "1 1 auto",
              minHeight: (hasSubChart || showMultiTf) ? 300 : 400,
              height: (hasSubChart || showMultiTf) ? "55%" : undefined,
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
            <div ref={chartContainerRef} className="w-full h-full" />

            {/* Drawing overlay */}
            <div
              className="absolute inset-0 z-20"
              style={{ cursor: activeTool === "cursor" ? "default" : activeTool === "eraser" ? "cell" : "crosshair", pointerEvents: activeTool === "cursor" ? "none" : "auto" }}
              onMouseDown={handleChartMouseDown}
            />

            {/* Floating OHLC popup near crosshair */}
            {ohlcDisplay && ohlcDisplay.pxX !== undefined && ohlcDisplay.pxY !== undefined && (
              <div
                className="absolute z-30 pointer-events-none"
                style={{
                  left: (ohlcDisplay.pxX ?? 0) > (chartContainerRef.current?.clientWidth ?? 600) / 2
                    ? Math.max(0, (ohlcDisplay.pxX ?? 0) - 168)
                    : (ohlcDisplay.pxX ?? 0) + 14,
                  top: Math.max(8, Math.min((ohlcDisplay.pxY ?? 0) - 10, (chartContainerRef.current?.clientHeight ?? 480) - 130)),
                }}
              >
                <div
                  className="rounded-xl px-3 py-2 text-[11px] font-mono space-y-0.5"
                  style={{
                    background: "rgba(8,10,16,0.92)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(16px)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    minWidth: 150,
                  }}
                >
                  {ohlcDisplay.time && <div className="text-[9px] mb-1" style={{ color: "hsl(220,14%,40%)" }}>{ohlcDisplay.time}</div>}
                  {[
                    { l: "O", v: ohlcDisplay.open,  c: "hsl(220,14%,70%)" },
                    { l: "H", v: ohlcDisplay.high,  c: "hsl(150,90%,58%)" },
                    { l: "L", v: ohlcDisplay.low,   c: "hsl(0,85%,62%)" },
                    { l: "C", v: ohlcDisplay.close, c: ohlcDisplay.close >= ohlcDisplay.open ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" },
                  ].map(({ l, v, c }) => (
                    <div key={l} className="flex justify-between gap-4">
                      <span style={{ color: "hsl(220,14%,45%)" }}>{l}</span>
                      <span style={{ color: c, fontWeight: 600 }}>{fmt(v)}</span>
                    </div>
                  ))}
                  {ohlcDisplay.volume !== undefined && (
                    <div className="flex justify-between gap-4 pt-0.5 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                      <span style={{ color: "hsl(220,14%,45%)" }}>V</span>
                      <span style={{ color: "hsl(220,14%,65%)" }}>{ohlcDisplay.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  )}
                  {(() => {
                    const chg = ((ohlcDisplay.close - ohlcDisplay.open) / ohlcDisplay.open) * 100;
                    return (
                      <div className="flex justify-between gap-4">
                        <span style={{ color: "hsl(220,14%,45%)" }}>Δ</span>
                        <span style={{ color: chg >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)", fontWeight: 600 }}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Drawing start-point indicator */}
            {drawStart && (
              <div className="absolute z-30 pointer-events-none" style={{ left: drawStart.x - 5, top: drawStart.y - 5 }}>
                <div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: drawColor, background: `${drawColor}30`, boxShadow: `0 0 10px ${drawColor}, 0 0 20px ${drawColor}50` }} />
              </div>
            )}

            {/* Drawing toolbar */}
            <div
              className="absolute top-3 right-3 z-25 flex flex-col gap-1.5 p-1.5 rounded-xl"
              style={{ background: "rgba(10,12,18,0.85)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)" }}
            >
              {DRAW_TOOLS.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  title={`${tool.label} [${tool.key}]`}
                  className="group relative h-8 w-8 flex items-center justify-center rounded-lg transition-all"
                  style={activeTool === tool.id
                    ? { background: tool.id === "eraser" ? "rgba(239,68,68,0.2)" : "rgba(0,229,255,0.15)", color: tool.id === "eraser" ? "hsl(0,85%,65%)" : "hsl(190,90%,65%)", boxShadow: tool.id === "eraser" ? "0 0 12px rgba(239,68,68,0.3)" : "0 0 12px rgba(0,229,255,0.25)", border: `1px solid ${tool.id === "eraser" ? "rgba(239,68,68,0.3)" : "rgba(0,229,255,0.3)"}` }
                    : { color: "hsl(220,14%,50%)", border: "1px solid transparent" }}
                >
                  {tool.icon}
                </button>
              ))}
              <div className="h-px bg-white/10 my-0.5" />
              {DRAW_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setDrawColor(c.value)}
                  title={c.label}
                  className="h-5 w-5 rounded-full mx-1.5 transition-all"
                  style={{ background: c.value, transform: drawColor === c.value ? "scale(1.3)" : "scale(1)", boxShadow: drawColor === c.value ? `0 0 10px ${c.value}, 0 0 20px ${c.value}60` : "none", outline: drawColor === c.value ? `2px solid ${c.value}` : "none", outlineOffset: "2px" }}
                />
              ))}
              {drawings.length > 0 && (
                <>
                  <div className="h-px bg-white/10 my-0.5" />
                  <button
                    onClick={() => {
                      drawings.forEach(d => {
                        if (d.kind === "hline") candleSeriesRef.current?.removePriceLine(d.priceLine);
                        if (d.kind === "trendline") chartRef.current?.removeSeries(d.series);
                        if (d.kind === "fibonacci") d.priceLines.forEach(pl => candleSeriesRef.current?.removePriceLine(pl));
                      });
                      setDrawings([]);
                    }}
                    className="h-6 w-8 mx-auto flex items-center justify-center rounded text-[9px] font-mono transition-all"
                    style={{ color: "hsl(220,14%,40%)", background: "rgba(255,255,255,0.03)" }}
                    title="Clear all drawings"
                  >ALL</button>
                </>
              )}
            </div>

            {/* Watermark */}
            <div className="absolute top-3 left-3 pointer-events-none select-none" style={{ zIndex: 5 }}>
              <span className="text-4xl font-bold font-mono" style={{ color: "rgba(255,255,255,0.025)" }}>{displayLabel}</span>
            </div>

            {replayMode && replayIndex >= total && total > 0 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 25 }}>
                <span className="text-xs font-mono px-4 py-1.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "hsl(38,100%,65%)" }}>
                  End of replay — all {total} candles shown
                </span>
              </div>
            )}
            {activeTool !== "cursor" && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 25 }}>
                <span className="text-xs font-mono px-3 py-1.5 rounded-full" style={{ background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.25)", color: "hsl(190,90%,65%)", boxShadow: "0 0 20px rgba(0,229,255,0.15)" }}>
                  {activeTool === "hline" && "Click to place horizontal line"}
                  {activeTool === "trendline" && (drawStart ? "Click second point to finish trend line" : "Click to set start point")}
                  {activeTool === "fibonacci" && (drawStart ? "Click second point for Fibonacci levels" : "Click high or low point to start")}
                  {activeTool === "eraser" && "Click to erase last drawing · Esc to cancel"}
                </span>
              </div>
            )}
          </div>

          {/* ── RSI / MACD sub-chart ─────────────────────────────── */}
          {hasSubChart && (
            <div
              className="relative rounded-xl overflow-hidden border flex-shrink-0"
              style={{ height: 120, borderColor: "rgba(255,255,255,0.06)", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}
            >
              <div className="absolute flex items-center gap-2 px-3 pt-2 pb-0 z-10 pointer-events-none">
                {hasRSI  && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.18)", color: "hsl(38,100%,65%)", border: "1px solid rgba(245,158,11,0.2)" }}>RSI 14</span>}
                {hasMACD && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(0,229,255,0.12)", color: "hsl(190,90%,65%)", border: "1px solid rgba(0,229,255,0.2)" }}>MACD 12/26/9</span>}
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

        {/* ── Trading sim sidebar (replay mode) ────────────────── */}
        {replayMode && (
          <div className="w-52 flex flex-col gap-3 overflow-y-auto shrink-0">
            {/* Position + Buy/Sell */}
            <div className="rounded-xl p-4 flex flex-col gap-3 border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", borderColor: "rgba(255,255,255,0.07)", boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "hsl(220,14%,45%)" }}>Position</span>
                {trades.length > 0 && (
                  <button onClick={resetTrading} className="flex items-center gap-1 text-[10px] font-mono transition-colors" style={{ color: "hsl(220,14%,40%)" }}>
                    <RotateCcw className="h-2.5 w-2.5" /> Reset
                  </button>
                )}
              </div>
              {position ? (
                <div className="rounded-lg p-3 space-y-1 border" style={{ background: "rgba(52,211,153,0.05)", borderColor: "rgba(52,211,153,0.15)" }}>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: "hsl(150,90%,55%)", boxShadow: "0 0 6px hsl(150,90%,55%)" }} />
                    <span className="text-xs font-mono font-semibold" style={{ color: "hsl(150,90%,60%)" }}>LONG</span>
                  </div>
                  <p className="text-sm font-mono">Entry: <span className="font-bold">${fmt(position.price)}</span></p>
                  <p className="text-xs font-mono" style={{ color: "hsl(220,14%,50%)" }}>{fmtDate(position.time)}</p>
                  {unrealizedPnl !== null && unrealizedPct !== null && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <p className="text-base font-mono font-bold" style={{ color: unrealizedPnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)", textShadow: unrealizedPnl >= 0 ? "0 0 20px rgba(52,211,153,0.4)" : "0 0 20px rgba(239,68,68,0.4)" }}>{fmtPnl(unrealizedPnl)}</p>
                      <p className="text-xs font-mono" style={{ color: "hsl(220,14%,50%)" }}>{fmtPct(unrealizedPct)} unrealized</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-center py-3 font-mono" style={{ color: "hsl(220,14%,35%)" }}>No open position</div>
              )}
              <div className="grid grid-cols-2 gap-2 mt-auto">
                {[
                  { label: "BUY", key: "B", icon: <TrendingUp className="h-3.5 w-3.5" />, disabled: !currentBar || !!position, onClick: () => currentBar && handleBuy(currentBar), style: { background: "linear-gradient(135deg, hsl(150,80%,28%), hsl(150,80%,22%))", borderColor: "rgba(52,211,153,0.3)", color: "hsl(150,90%,65%)", boxShadow: "0 4px 20px rgba(52,211,153,0.15), inset 0 1px 0 rgba(52,211,153,0.1)" } },
                  { label: "SELL", key: "S", icon: <TrendingDown className="h-3.5 w-3.5" />, disabled: !currentBar || !position, onClick: () => currentBar && position && handleSell(currentBar, position), style: { background: "linear-gradient(135deg, hsl(0,70%,28%), hsl(0,70%,22%))", borderColor: "rgba(239,68,68,0.3)", color: "hsl(0,85%,70%)", boxShadow: "0 4px 20px rgba(239,68,68,0.15), inset 0 1px 0 rgba(239,68,68,0.1)" } },
                ].map(btn => (
                  <button key={btn.label} disabled={btn.disabled} onClick={btn.onClick}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-lg border font-mono font-bold text-sm transition-all disabled:opacity-25"
                    style={btn.disabled ? { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "hsl(220,14%,40%)" } : btn.style}
                  >
                    {btn.icon} {btn.label}
                    <span className="text-[9px] opacity-60">[{btn.key}]</span>
                  </button>
                ))}
              </div>
              {currentBar && <p className="text-[10px] text-center font-mono" style={{ color: "hsl(220,14%,35%)" }}>at market close ${fmt(currentBar.close)}</p>}
            </div>

            {/* Performance */}
            <div className="rounded-xl p-4 flex flex-col gap-3 border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", borderColor: "rgba(255,255,255,0.07)", boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "hsl(220,14%,45%)" }}>Performance</span>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Equity",      value: `$${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: fmtPct(equityGainPct), color: equityGain >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" },
                  { label: "Realized P&L",value: fmtPnl(totalPnl), sub: `${trades.length} trade${trades.length !== 1 ? "s" : ""}`, color: totalPnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" },
                  { label: "Win Rate",    value: trades.length > 0 ? `${winRate.toFixed(0)}%` : "—", sub: trades.length > 0 ? `${wins}W / ${trades.length - wins}L` : "no trades yet", color: winRate >= 50 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" },
                  { label: "Start Capital",value: `$${STARTING_CAPITAL.toLocaleString()}`, sub: "per session", color: "hsl(220,14%,60%)" },
                ].map(stat => (
                  <div key={stat.label}>
                    <p className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: "hsl(220,14%,40%)" }}>{stat.label}</p>
                    <p className="text-sm font-mono font-bold" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: "hsl(220,14%,38%)" }}>{stat.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Trade log */}
            <div className="rounded-xl p-4 flex flex-col gap-3 border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))", borderColor: "rgba(255,255,255,0.07)", boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "hsl(220,14%,45%)" }}>Trade Log</span>
              {trades.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs font-mono text-center" style={{ color: "hsl(220,14%,35%)" }}>No closed trades yet.<br />Press B to buy, S to sell.</p>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[150px] space-y-1.5 pr-1">
                  {[...trades].reverse().map((t, i) => (
                    <div key={t.id} className="rounded-lg px-2.5 py-2 border text-xs font-mono"
                      style={t.pnl >= 0 ? { background: "rgba(52,211,153,0.04)", borderColor: "rgba(52,211,153,0.12)" } : { background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.12)" }}>
                      <div className="flex justify-between mb-0.5">
                        <span style={{ color: "hsl(220,14%,40%)" }}>#{trades.length - i}</span>
                        <span className="font-bold" style={{ color: t.pnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>{fmtPnl(t.pnl)} ({fmtPct(t.pnlPct)})</span>
                      </div>
                      <div className="flex justify-between" style={{ color: "hsl(220,14%,45%)" }}>
                        <span>B ${fmt(t.entryPrice)}</span><span>→</span><span>S ${fmt(t.exitPrice)}</span>
                      </div>
                      <div className="text-[9px] mt-0.5" style={{ color: "hsl(220,14%,35%)" }}>{fmtDate(t.entryTime)} → {fmtDate(t.exitTime)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Live stats bar (non-replay) ──────────────────────────── */}
      {!replayMode && currentBar && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Open",   value: `$${fmt(currentBar.open)}` },
            { label: "High",   value: `$${fmt(currentBar.high)}` },
            { label: "Low",    value: `$${fmt(currentBar.low)}` },
            { label: "Volume", value: currentBar.volume.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
          ].map((item, i) => (
            <div key={item.label} className="rounded-xl p-3 border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))", borderColor: "rgba(255,255,255,0.06)", boxShadow: "0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)", transform: `perspective(800px) rotateX(${i % 2 === 0 ? "1" : "-1"}deg)` }}>
              <p className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: "hsl(220,14%,40%)" }}>{item.label}</p>
              <p className="text-sm font-mono font-bold" style={{ color: "hsl(220,14%,80%)" }}>{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
