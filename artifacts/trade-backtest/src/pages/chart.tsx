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
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────

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
  { pct: 0, color: "hsl(200,14%,65%)", label: "0%" },
  { pct: 0.236, color: "hsl(200,90%,60%)", label: "23.6%" },
  { pct: 0.382, color: "hsl(150,80%,55%)", label: "38.2%" },
  { pct: 0.5, color: "hsl(38,100%,55%)", label: "50%" },
  { pct: 0.618, color: "hsl(0,85%,62%)", label: "61.8%" },
  { pct: 0.786, color: "hsl(260,80%,68%)", label: "78.6%" },
  { pct: 1, color: "hsl(200,14%,65%)", label: "100%" },
];

const MIN_CANDLES = 30;
const STARTING_CAPITAL = 10_000;

// ── Types ──────────────────────────────────────────────────────────

type DrawTool = "cursor" | "hline" | "trendline" | "fibonacci" | "eraser";

type DrawnObject =
  | { kind: "hline"; priceLine: IPriceLine; id: number }
  | { kind: "trendline"; series: ISeriesApi<"Line">; id: number }
  | { kind: "fibonacci"; priceLines: IPriceLine[]; id: number };

type DrawStart = { x: number; y: number; price: number; time: Time };

type OhlcState = { open: number; high: number; low: number; close: number; time: string } | null;

type KlineBar = { time: number; open: number; high: number; low: number; close: number; volume: number };

type Position = { price: number; time: number; units: number; capitalAtEntry: number };

type SimTrade = {
  id: number; entryPrice: number; entryTime: number;
  exitPrice: number; exitTime: number; units: number;
  pnl: number; pnlPct: number;
};

// ── Helpers ────────────────────────────────────────────────────────

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

// ── Glass card helper ──────────────────────────────────────────────

const glass = "bg-white/[0.03] backdrop-blur-md border border-white/[0.07]";
const glassActive = "bg-cyan-400/[0.08] border-cyan-400/30";

// ── Component ──────────────────────────────────────────────────────

export default function ChartPage() {
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

  // Refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const sortedKlinesRef = useRef<KlineBar[]>([]);
  const markersRef = useRef<SeriesMarker<Time>[]>([]);
  const drawingsRef = useRef<DrawnObject[]>([]);

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

  // ── Coord helpers ────────────────────────────────────────────────

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

  // ── Drawing handlers ─────────────────────────────────────────────

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

    if (activeTool === "eraser") {
      eraseLastDrawing();
      return;
    }

    if (activeTool === "hline") {
      const priceLine = candleSeriesRef.current!.createPriceLine({
        price,
        color: drawColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: fmt(price),
      });
      const id = Date.now();
      setDrawings(prev => [...prev, { kind: "hline", priceLine, id }]);
      setActiveTool("cursor");
      return;
    }

    if (activeTool === "trendline" || activeTool === "fibonacci") {
      if (!drawStart) {
        setDrawStart({ x, y, price, time });
      } else {
        // Second click — finalize
        const p1 = drawStart.price;
        const t1 = drawStart.time as number;
        const p2 = price;
        const t2 = time as number;
        const id = Date.now();

        if (activeTool === "trendline") {
          const sorted = t1 <= t2
            ? [{ time: t1 as Time, value: p1 }, { time: t2 as Time, value: p2 }]
            : [{ time: t2 as Time, value: p2 }, { time: t1 as Time, value: p1 }];
          const series = chartRef.current!.addSeries(LineSeries, {
            color: drawColor,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });
          series.setData(sorted);
          setDrawings(prev => [...prev, { kind: "trendline", series, id }]);
        } else {
          // Fibonacci
          const high = Math.max(p1, p2);
          const low = Math.min(p1, p2);
          const range = high - low;
          const priceLines: IPriceLine[] = FIB_LEVELS.map(({ pct, color, label }) => {
            const fibPrice = high - range * pct;
            return candleSeriesRef.current!.createPriceLine({
              price: fibPrice,
              color,
              lineWidth: 1,
              lineStyle: LineStyle.Dotted,
              axisLabelVisible: true,
              title: label,
            });
          });
          setDrawings(prev => [...prev, { kind: "fibonacci", priceLines, id }]);
        }

        setDrawStart(null);
        setActiveTool("cursor");
      }
    }
  }, [activeTool, drawColor, drawStart, eraseLastDrawing, getChartCoords]);

  // Cancel pending draw on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawStart) {
        setDrawStart(null);
        setActiveTool("cursor");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawStart]);

  // ── Trading helpers ──────────────────────────────────────────────

  const applyMarkers = useCallback(() => {
    if (markersPluginRef.current) {
      markersPluginRef.current.setMarkers([...markersRef.current]);
    }
  }, []);

  const resetTrading = useCallback(() => {
    setPosition(null);
    setTrades([]);
    setEquity(STARTING_CAPITAL);
    markersRef.current = [];
    applyMarkers();
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

  // ── Replay helpers ───────────────────────────────────────────────

  const enterReplay = useCallback(() => {
    setIsPlaying(false);
    setReplayIndex(MIN_CANDLES);
    setReplayMode(true);
    setPosition(null); setTrades([]); setEquity(STARTING_CAPITAL);
    markersRef.current = [];
  }, []);

  const exitReplay = useCallback(() => {
    setIsPlaying(false);
    setReplayMode(false);
    setOhlcDisplay(null);
    resetTrading();
  }, [resetTrading]);

  const stepForward = useCallback(() => setReplayIndex(i => Math.min(i + 1, sortedKlinesRef.current.length)), []);
  const stepBack = useCallback(() => setReplayIndex(i => Math.max(i - 1, MIN_CANDLES)), []);
  const jumpToStart = useCallback(() => { setIsPlaying(false); setReplayIndex(MIN_CANDLES); }, []);
  const jumpToEnd = useCallback(() => { setIsPlaying(false); setReplayIndex(sortedKlinesRef.current.length); }, []);

  const handleSymbolChange = useCallback((val: string) => {
    if (replayMode) exitReplay();
    setSymbol(val);
  }, [replayMode, exitReplay]);

  const handleIntervalChange = useCallback((val: string) => {
    if (replayMode) exitReplay();
    setInterval(val as GetKlinesInterval);
  }, [replayMode, exitReplay]);

  // ── Auto-play ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying || !replayMode) return;
    const id = window.setInterval(() => {
      setReplayIndex(i => {
        const total = sortedKlinesRef.current.length;
        if (i >= total) { setIsPlaying(false); return i; }
        return i + 1;
      });
    }, replaySpeed);
    return () => window.clearInterval(id);
  }, [isPlaying, replayMode, replaySpeed]);

  // ── Keyboard shortcuts ───────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (replayMode) {
        if (e.key === "ArrowRight") { e.preventDefault(); stepForward(); }
        if (e.key === "ArrowLeft") { e.preventDefault(); stepBack(); }
        if (e.key === " ") { e.preventDefault(); setIsPlaying(p => !p); }
        if (e.key === "b" || e.key === "B") { const bar = sortedKlinesRef.current[replayIndexRef.current - 1]; if (bar) handleBuy(bar); }
        if (e.key === "s" || e.key === "S") { if (positionRef.current) { const bar = sortedKlinesRef.current[replayIndexRef.current - 1]; if (bar) handleSell(bar, positionRef.current); } }
      }
      // Drawing shortcuts (always)
      if (e.key === "h") setActiveTool("hline");
      if (e.key === "t") setActiveTool("trendline");
      if (e.key === "f") setActiveTool("fibonacci");
      if (e.key === "e") setActiveTool("eraser");
      if (e.key === "Escape" && !drawStart) {
        setActiveTool("cursor");
        if (replayMode) exitReplay();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [replayMode, stepForward, stepBack, exitReplay, handleBuy, handleSell, drawStart]);

  // ── Chart init ───────────────────────────────────────────────────

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const container = chartContainerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 480,
      layout: {
        background: { type: ColorType.Solid, color: "hsl(222,28%,7%)" },
        textColor: "hsl(220,14%,60%)",
        fontFamily: "'JetBrains Mono', Menlo, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "hsla(220,20%,30%,0.15)" },
        horzLines: { color: "hsla(220,20%,30%,0.15)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "hsla(190,90%,60%,0.6)", width: 1, style: 2, labelBackgroundColor: "hsl(222,28%,12%)" },
        horzLine: { color: "hsla(190,90%,60%,0.6)", width: 1, style: 2, labelBackgroundColor: "hsl(222,28%,12%)" },
      },
      rightPriceScale: { borderColor: "hsla(220,20%,30%,0.3)" },
      timeScale: { borderColor: "hsla(220,20%,30%,0.3)", timeVisible: true, secondsVisible: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "hsl(150,90%,52%)",
      downColor: "hsl(0,85%,58%)",
      borderUpColor: "hsl(150,90%,52%)",
      borderDownColor: "hsl(0,85%,58%)",
      wickUpColor: "hsl(150,80%,45%)",
      wickDownColor: "hsl(0,75%,50%)",
      priceLineVisible: true,
      priceLineColor: "hsla(190,90%,60%,0.7)",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "hsl(190,90%,50%)",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });

    chart.subscribeCrosshairMove(param => {
      if (param.time && candleSeriesRef.current) {
        const bar = param.seriesData.get(candleSeriesRef.current) as { open: number; high: number; low: number; close: number } | undefined;
        if (bar) {
          setOhlcDisplay({ ...bar, time: new Date((param.time as number) * 1000).toLocaleDateString() });
          return;
        }
      }
      setOhlcDisplay(null);
    });

    markersPluginRef.current = createSeriesMarkers(candleSeries, []);
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const observer = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
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
    };
  }, []);

  // ── Feed data ────────────────────────────────────────────────────

  useEffect(() => {
    if (!klines || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    const sorted = [...klines].sort((a, b) => a.time - b.time);
    sortedKlinesRef.current = sorted;
    const slice = replayMode ? sorted.slice(0, replayIndex) : sorted;
    candleSeriesRef.current.setData(slice.map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close })));
    volumeSeriesRef.current.setData(slice.map(k => ({ time: k.time as Time, value: k.volume, color: k.close >= k.open ? "hsla(150,90%,50%,0.3)" : "hsla(0,85%,60%,0.3)" })));
    replayMode ? chartRef.current?.timeScale().scrollToPosition(4, false) : chartRef.current?.timeScale().fitContent();
  }, [klines, replayMode, replayIndex]);

  // ── Derived ──────────────────────────────────────────────────────

  const sorted = sortedKlinesRef.current;
  const total = sorted.length;
  const currentBar = replayMode ? sorted[Math.min(replayIndex, total) - 1] ?? null : klines && klines.length > 0 ? klines[klines.length - 1] : null;
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
    { id: "cursor", icon: <MousePointer2 className="h-3.5 w-3.5" />, label: "Select", key: "Esc" },
    { id: "hline", icon: <Minus className="h-3.5 w-3.5" />, label: "H-Line", key: "H" },
    { id: "trendline", icon: <GitCommit className="h-3.5 w-3.5 rotate-45" />, label: "Trend", key: "T" },
    { id: "fibonacci", icon: <Hash className="h-3.5 w-3.5" />, label: "Fib", key: "F" },
    { id: "eraser", icon: <Eraser className="h-3.5 w-3.5" />, label: "Erase", key: "E" },
  ];

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* ── Header ─────────────────────────────────────────────── */}
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
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ background: "linear-gradient(135deg, hsl(190,90%,65%), hsl(210,80%,75%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              Live Chart
            </h1>
            <p className="text-xs text-muted-foreground/70 mt-0.5 font-mono">Real-time Binance data</p>
          </div>
          {replayMode && (
            <span
              className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded-full border"
              style={{ background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.3)", color: "hsl(38,100%,65%)", boxShadow: "0 0 12px rgba(245,158,11,0.15)" }}
            >
              ● REPLAY
            </span>
          )}
          {drawings.length > 0 && (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1"
              style={{ background: "rgba(0,229,255,0.08)", borderColor: "rgba(0,229,255,0.25)", color: "hsl(190,90%,65%)" }}
            >
              <Pencil className="h-2.5 w-2.5" /> {drawings.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!replayMode && (
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "hsl(220,14%,65%)" }}
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
          {!replayMode ? (
            <button
              onClick={enterReplay}
              disabled={!klines || klines.length < MIN_CANDLES}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all"
              style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)", color: "hsl(38,100%,60%)", boxShadow: "0 0 16px rgba(245,158,11,0.08)" }}
            >
              <Clapperboard className="h-3.5 w-3.5" />
              Replay
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

      {/* ── Controls row ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Symbol */}
        <Select value={symbol} onValueChange={handleSymbolChange}>
          <SelectTrigger
            className="w-36 h-8 text-xs font-mono border"
            disabled={replayMode}
            style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYMBOLS.map(s => <SelectItem key={s.value} value={s.value} className="text-xs font-mono">{s.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Intervals */}
        <div
          className="flex items-center gap-0.5 rounded-lg p-0.5 border"
          style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}
        >
          {INTERVALS.map(iv => (
            <button
              key={iv.value}
              onClick={() => handleIntervalChange(iv.value)}
              className="px-2.5 py-1 text-[11px] font-mono rounded-md transition-all"
              style={interval === iv.value ? {
                background: "rgba(0,229,255,0.15)",
                color: "hsl(190,90%,65%)",
                boxShadow: "0 0 12px rgba(0,229,255,0.15), inset 0 1px 0 rgba(0,229,255,0.1)",
              } : { color: "hsl(220,14%,55%)" }}
            >
              {iv.label}
            </button>
          ))}
        </div>

        {/* Live price */}
        {currentBar && !replayMode && (
          <div className="ml-auto flex items-center gap-2">
            <span
              className="text-lg font-mono font-bold"
              style={{ color: isUp ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)", textShadow: isUp ? "0 0 20px rgba(52,211,153,0.4)" : "0 0 20px rgba(239,68,68,0.4)" }}
            >
              ${fmt(currentBar.close)}
            </span>
            <span
              className="text-xs font-mono px-2 py-0.5 rounded-md border"
              style={isUp ? { background: "rgba(52,211,153,0.08)", borderColor: "rgba(52,211,153,0.25)", color: "hsl(150,90%,58%)" }
                : { background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "hsl(0,85%,62%)" }}
            >
              {isUp ? "+" : ""}{changePercent}%
            </span>
          </div>
        )}
      </div>

      {/* ── Replay toolbar ───────────────────────────────────────── */}
      {replayMode && (
        <div
          className="flex flex-col gap-2 rounded-xl px-4 py-3 border"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))",
            borderColor: "rgba(245,158,11,0.2)",
            boxShadow: "0 0 30px rgba(245,158,11,0.06), inset 0 1px 0 rgba(245,158,11,0.08)",
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0.5">
              {[
                { icon: <SkipBack className="h-3.5 w-3.5" />, onClick: jumpToStart, disabled: replayIndex <= MIN_CANDLES },
                { icon: <StepBack className="h-3.5 w-3.5" />, onClick: stepBack, disabled: replayIndex <= MIN_CANDLES },
              ].map((btn, i) => (
                <button key={i} onClick={btn.onClick} disabled={btn.disabled}
                  className="h-8 w-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30 hover:bg-white/5"
                  style={{ color: "hsl(220,14%,65%)" }}
                >{btn.icon}</button>
              ))}

              <button
                onClick={() => setIsPlaying(p => !p)}
                disabled={replayIndex >= total}
                className="h-9 w-9 flex items-center justify-center rounded-lg border transition-all disabled:opacity-30"
                style={isPlaying ? {
                  background: "hsl(38,100%,55%)", borderColor: "transparent",
                  color: "#000", boxShadow: "0 0 20px rgba(245,158,11,0.5)",
                } : {
                  background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.3)",
                  color: "hsl(38,100%,60%)", boxShadow: "0 0 12px rgba(245,158,11,0.1)",
                }}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>

              {[
                { icon: <StepForward className="h-3.5 w-3.5" />, onClick: stepForward, disabled: replayIndex >= total },
                { icon: <SkipForward className="h-3.5 w-3.5" />, onClick: jumpToEnd, disabled: replayIndex >= total },
              ].map((btn, i) => (
                <button key={i} onClick={btn.onClick} disabled={btn.disabled}
                  className="h-8 w-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30 hover:bg-white/5"
                  style={{ color: "hsl(220,14%,65%)" }}
                >{btn.icon}</button>
              ))}
            </div>

            <div className="w-px h-5 bg-white/10" />

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono" style={{ color: "hsl(220,14%,50%)" }}>Speed</span>
              <div className="flex gap-0.5">
                {SPEEDS.map(s => (
                  <button key={s.value} onClick={() => setReplaySpeed(s.value)}
                    className="px-2 py-0.5 text-[11px] font-mono rounded transition-all"
                    style={replaySpeed === s.value ? { background: "rgba(245,158,11,0.2)", color: "hsl(38,100%,65%)", border: "1px solid rgba(245,158,11,0.3)" } : { color: "hsl(220,14%,50%)" }}
                  >{s.label}</button>
                ))}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-3">
              {currentDate && <span className="text-xs font-mono" style={{ color: "hsl(38,100%,65%)" }}>{currentDate}</span>}
              {currentBar && (
                <span className="text-sm font-mono font-bold" style={{ color: isUp ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>
                  ${fmt(currentBar.close)}
                </span>
              )}
              <span className="text-[11px] font-mono tabular-nums" style={{ color: "hsl(220,14%,45%)" }}>{replayIndex}/{total}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="range" min={MIN_CANDLES} max={total} value={replayIndex}
              onChange={e => { setIsPlaying(false); setReplayIndex(Number(e.target.value)); }}
              className="flex-1 h-1 cursor-pointer rounded-full"
              style={{ accentColor: "hsl(38,100%,55%)" }}
            />
            <span className="text-[10px] font-mono tabular-nums w-8 text-right" style={{ color: "hsl(220,14%,45%)" }}>{replayProgress.toFixed(0)}%</span>
          </div>
          <p className="text-[10px] font-mono" style={{ color: "hsl(220,14%,35%)" }}>
            ← → step · Space play/pause · B buy · S sell · H/T/F draw · Esc exit
          </p>
        </div>
      )}

      {/* ── OHLC row ─────────────────────────────────────────────── */}
      {displayBar && (
        <div className="flex items-center gap-4 text-[11px] font-mono px-1">
          {ohlcDisplay?.time && <span style={{ color: "hsl(220,14%,40%)" }}>{ohlcDisplay.time}</span>}
          {[
            { l: "O", v: displayBar.open, c: "hsl(220,14%,65%)" },
            { l: "H", v: displayBar.high, c: "hsl(150,90%,55%)" },
            { l: "L", v: displayBar.low, c: "hsl(0,85%,60%)" },
            { l: "C", v: displayBar.close, c: displayBar.close >= displayBar.open ? "hsl(150,90%,55%)" : "hsl(0,85%,60%)" },
          ].map(({ l, v, c }) => (
            <span key={l} style={{ color: "hsl(220,14%,50%)" }}>
              {l} <span style={{ color: c, fontWeight: 600 }}>{fmt(v)}</span>
            </span>
          ))}
          {replayMode && changePercent && (
            <span className="ml-1" style={{ color: isUp ? "hsl(150,90%,55%)" : "hsl(0,85%,60%)" }}>{isUp ? "+" : ""}{changePercent}%</span>
          )}
        </div>
      )}

      {/* ── Chart + drawing overlay ──────────────────────────────── */}
      <div
        className="relative flex-1 min-h-[400px] rounded-xl overflow-hidden"
        style={{
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

        {/* Drawing overlay — captures clicks when a tool is active */}
        <div
          className="absolute inset-0 z-20"
          style={{ cursor: activeTool === "cursor" ? "default" : activeTool === "eraser" ? "cell" : "crosshair", pointerEvents: activeTool === "cursor" ? "none" : "auto" }}
          onMouseDown={handleChartMouseDown}
        />

        {/* Drawing start point indicator */}
        {drawStart && (
          <div
            className="absolute z-30 pointer-events-none"
            style={{ left: drawStart.x - 5, top: drawStart.y - 5 }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full border-2"
              style={{
                borderColor: drawColor,
                background: `${drawColor}30`,
                boxShadow: `0 0 10px ${drawColor}, 0 0 20px ${drawColor}50`,
              }}
            />
          </div>
        )}

        {/* Floating drawing toolbar */}
        <div
          className="absolute top-3 right-3 z-25 flex flex-col gap-1.5 p-1.5 rounded-xl"
          style={{
            background: "rgba(10,12,18,0.85)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {/* Tool buttons */}
          {DRAW_TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              title={`${tool.label} [${tool.key}]`}
              className="group relative h-8 w-8 flex items-center justify-center rounded-lg transition-all"
              style={activeTool === tool.id ? {
                background: tool.id === "eraser" ? "rgba(239,68,68,0.2)" : "rgba(0,229,255,0.15)",
                color: tool.id === "eraser" ? "hsl(0,85%,65%)" : "hsl(190,90%,65%)",
                boxShadow: tool.id === "eraser" ? "0 0 12px rgba(239,68,68,0.3)" : "0 0 12px rgba(0,229,255,0.25)",
                border: `1px solid ${tool.id === "eraser" ? "rgba(239,68,68,0.3)" : "rgba(0,229,255,0.3)"}`,
              } : { color: "hsl(220,14%,50%)", border: "1px solid transparent" }}
            >
              {tool.icon}
            </button>
          ))}

          <div className="h-px bg-white/10 my-0.5" />

          {/* Color picker */}
          {DRAW_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => setDrawColor(c.value)}
              title={c.label}
              className="h-5 w-5 rounded-full mx-1.5 transition-all"
              style={{
                background: c.value,
                transform: drawColor === c.value ? "scale(1.3)" : "scale(1)",
                boxShadow: drawColor === c.value ? `0 0 10px ${c.value}, 0 0 20px ${c.value}60` : "none",
                outline: drawColor === c.value ? `2px solid ${c.value}` : "none",
                outlineOffset: "2px",
              }}
            />
          ))}

          {/* Erase all */}
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
              >
                ALL
              </button>
            </>
          )}
        </div>

        {/* Watermark */}
        <div className="absolute top-3 left-3 pointer-events-none select-none" style={{ zIndex: 5 }}>
          <span className="text-4xl font-bold font-mono" style={{ color: "rgba(255,255,255,0.025)" }}>{displayLabel}</span>
        </div>

        {replayMode && replayIndex >= total && total > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 25 }}>
            <span
              className="text-xs font-mono px-4 py-1.5 rounded-full"
              style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "hsl(38,100%,65%)" }}
            >
              End of replay — all {total} candles shown
            </span>
          </div>
        )}

        {/* Draw mode hint */}
        {activeTool !== "cursor" && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 25 }}>
            <span
              className="text-xs font-mono px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(0,229,255,0.1)",
                border: "1px solid rgba(0,229,255,0.25)",
                color: "hsl(190,90%,65%)",
                boxShadow: "0 0 20px rgba(0,229,255,0.15)",
              }}
            >
              {activeTool === "hline" && "Click to place horizontal line"}
              {activeTool === "trendline" && (drawStart ? "Click second point to finish trend line" : "Click to set start point")}
              {activeTool === "fibonacci" && (drawStart ? "Click second point for Fibonacci levels" : "Click high or low point to start")}
              {activeTool === "eraser" && "Click to erase last drawing · Esc to cancel"}
            </span>
          </div>
        )}
      </div>

      {/* ── Trading panel (replay mode) ──────────────────────────── */}
      {replayMode && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Position + Buy/Sell */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3 border"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
              borderColor: "rgba(255,255,255,0.07)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "hsl(220,14%,45%)" }}>Position</span>
              {trades.length > 0 && (
                <button onClick={resetTrading} className="flex items-center gap-1 text-[10px] font-mono transition-colors" style={{ color: "hsl(220,14%,40%)" }}>
                  <RotateCcw className="h-2.5 w-2.5" /> Reset
                </button>
              )}
            </div>

            {position ? (
              <div
                className="rounded-lg p-3 space-y-1 border"
                style={{ background: "rgba(52,211,153,0.05)", borderColor: "rgba(52,211,153,0.15)" }}
              >
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full animate-pulse" style={{ background: "hsl(150,90%,55%)", boxShadow: "0 0 6px hsl(150,90%,55%)" }} />
                  <span className="text-xs font-mono font-semibold" style={{ color: "hsl(150,90%,60%)" }}>LONG</span>
                </div>
                <p className="text-sm font-mono">Entry: <span className="font-bold">${fmt(position.price)}</span></p>
                <p className="text-xs font-mono" style={{ color: "hsl(220,14%,50%)" }}>{fmtDate(position.time)}</p>
                {unrealizedPnl !== null && unrealizedPct !== null && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="text-base font-mono font-bold" style={{ color: unrealizedPnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)", textShadow: unrealizedPnl >= 0 ? "0 0 20px rgba(52,211,153,0.4)" : "0 0 20px rgba(239,68,68,0.4)" }}>
                      {fmtPnl(unrealizedPnl)}
                    </p>
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
                <button
                  key={btn.label}
                  disabled={btn.disabled}
                  onClick={btn.onClick}
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
          <div
            className="rounded-xl p-4 flex flex-col gap-3 border"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
              borderColor: "rgba(255,255,255,0.07)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "hsl(220,14%,45%)" }}>Performance</span>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Equity", value: `$${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: fmtPct(equityGainPct), color: equityGain >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" },
                { label: "Realized P&L", value: fmtPnl(totalPnl), sub: `${trades.length} trade${trades.length !== 1 ? "s" : ""}`, color: totalPnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" },
                { label: "Win Rate", value: trades.length > 0 ? `${winRate.toFixed(0)}%` : "—", sub: trades.length > 0 ? `${wins}W / ${trades.length - wins}L` : "no trades yet", color: winRate >= 50 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" },
                { label: "Start Capital", value: `$${STARTING_CAPITAL.toLocaleString()}`, sub: "per session", color: "hsl(220,14%,60%)" },
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
          <div
            className="rounded-xl p-4 flex flex-col gap-3 border"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
              borderColor: "rgba(255,255,255,0.07)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "hsl(220,14%,45%)" }}>Trade Log</span>
            {trades.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs font-mono text-center" style={{ color: "hsl(220,14%,35%)" }}>No closed trades yet.<br />Press B to buy, S to sell.</p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[150px] space-y-1.5 pr-1">
                {[...trades].reverse().map((t, i) => (
                  <div key={t.id} className="rounded-lg px-2.5 py-2 border text-xs font-mono"
                    style={t.pnl >= 0
                      ? { background: "rgba(52,211,153,0.04)", borderColor: "rgba(52,211,153,0.12)" }
                      : { background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.12)" }
                    }
                  >
                    <div className="flex justify-between mb-0.5">
                      <span style={{ color: "hsl(220,14%,40%)" }}>#{trades.length - i}</span>
                      <span className="font-bold" style={{ color: t.pnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>
                        {fmtPnl(t.pnl)} ({fmtPct(t.pnlPct)})
                      </span>
                    </div>
                    <div className="flex justify-between" style={{ color: "hsl(220,14%,45%)" }}>
                      <span>B ${fmt(t.entryPrice)}</span>
                      <span>→</span>
                      <span>S ${fmt(t.exitPrice)}</span>
                    </div>
                    <div className="text-[9px] mt-0.5" style={{ color: "hsl(220,14%,35%)" }}>
                      {fmtDate(t.entryTime)} → {fmtDate(t.exitTime)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Live stats (non-replay) ──────────────────────────────── */}
      {!replayMode && currentBar && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Open", value: `$${fmt(currentBar.open)}` },
            { label: "High", value: `$${fmt(currentBar.high)}` },
            { label: "Low", value: `$${fmt(currentBar.low)}` },
            { label: "Volume", value: currentBar.volume.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
          ].map((item, i) => (
            <div
              key={item.label}
              className="rounded-xl p-3 border"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))",
                borderColor: "rgba(255,255,255,0.06)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
                transform: `perspective(800px) rotateX(${i % 2 === 0 ? "1" : "-1"}deg)`,
              }}
            >
              <p className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: "hsl(220,14%,40%)" }}>{item.label}</p>
              <p className="text-sm font-mono font-bold" style={{ color: "hsl(220,14%,80%)" }}>{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: getGetKlinesQueryKey(params) });
  }
}
