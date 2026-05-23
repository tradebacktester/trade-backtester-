import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
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
} from "lucide-react";

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

const MIN_CANDLES = 30;

type OhlcState = {
  open: number;
  high: number;
  low: number;
  close: number;
  time: string;
} | null;

type KlineBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 1 ? 6 : 2,
  });
}

function fmtDate(unixSec: number) {
  return new Date(unixSec * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ChartPage() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState<GetKlinesInterval>(GetKlinesInterval["1d"]);
  const [ohlcDisplay, setOhlcDisplay] = useState<OhlcState>(null);

  // Replay state
  const [replayMode, setReplayMode] = useState(false);
  const [replayIndex, setReplayIndex] = useState(MIN_CANDLES);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(500);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sortedKlinesRef = useRef<KlineBar[]>([]);

  const queryClient = useQueryClient();
  const params = { symbol, interval, limit: 500 };

  const { data: klines, isLoading, error, isFetching } = useGetKlines(params, {
    query: {
      queryKey: getGetKlinesQueryKey(params),
      staleTime: 30_000,
      refetchInterval: replayMode ? false : 60_000,
    },
  });

  // ── Replay helpers ──────────────────────────────────────────────

  const enterReplay = useCallback(() => {
    setIsPlaying(false);
    setReplayIndex(MIN_CANDLES);
    setReplayMode(true);
  }, []);

  const exitReplay = useCallback(() => {
    setIsPlaying(false);
    setReplayMode(false);
    setOhlcDisplay(null);
  }, []);

  const stepForward = useCallback(() => {
    setReplayIndex((i) => Math.min(i + 1, sortedKlinesRef.current.length));
  }, []);

  const stepBack = useCallback(() => {
    setReplayIndex((i) => Math.max(i - 1, MIN_CANDLES));
  }, []);

  const jumpToStart = useCallback(() => {
    setIsPlaying(false);
    setReplayIndex(MIN_CANDLES);
  }, []);

  const jumpToEnd = useCallback(() => {
    setIsPlaying(false);
    setReplayIndex(sortedKlinesRef.current.length);
  }, []);

  // Exit replay when symbol or interval changes
  const handleSymbolChange = useCallback(
    (val: string) => {
      if (replayMode) exitReplay();
      setSymbol(val);
    },
    [replayMode, exitReplay]
  );

  const handleIntervalChange = useCallback(
    (val: string) => {
      if (replayMode) exitReplay();
      setInterval(val as GetKlinesInterval);
    },
    [replayMode, exitReplay]
  );

  // ── Auto-play interval ──────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying || !replayMode) return;
    const id = window.setInterval(() => {
      setReplayIndex((i) => {
        const total = sortedKlinesRef.current.length;
        if (i >= total) {
          setIsPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, replaySpeed);
    return () => window.clearInterval(id);
  }, [isPlaying, replayMode, replaySpeed]);

  // ── Keyboard shortcuts ──────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!replayMode) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowRight") { e.preventDefault(); stepForward(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); stepBack(); }
      if (e.key === " ") { e.preventDefault(); setIsPlaying((p) => !p); }
      if (e.key === "Escape") exitReplay();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [replayMode, stepForward, stepBack, exitReplay]);

  // ── Chart init ──────────────────────────────────────────────────

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const container = chartContainerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 480,
      layout: {
        background: { type: ColorType.Solid, color: "hsl(230, 15%, 10%)" },
        textColor: "hsl(220, 14%, 65%)",
        fontFamily: "'JetBrains Mono', Menlo, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "hsl(230, 15%, 18%)" },
        horzLines: { color: "hsl(230, 15%, 18%)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "hsl(190, 90%, 50%)",
          width: 1,
          style: 2,
          labelBackgroundColor: "hsl(230, 15%, 14%)",
        },
        horzLine: {
          color: "hsl(190, 90%, 50%)",
          width: 1,
          style: 2,
          labelBackgroundColor: "hsl(230, 15%, 14%)",
        },
      },
      rightPriceScale: { borderColor: "hsl(230, 15%, 20%)" },
      timeScale: {
        borderColor: "hsl(230, 15%, 20%)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "hsl(150, 90%, 50%)",
      downColor: "hsl(0, 85%, 60%)",
      borderUpColor: "hsl(150, 90%, 50%)",
      borderDownColor: "hsl(0, 85%, 60%)",
      wickUpColor: "hsl(150, 90%, 50%)",
      wickDownColor: "hsl(0, 85%, 60%)",
      priceLineVisible: true,
      priceLineColor: "hsl(190, 90%, 50%)",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "hsl(190, 90%, 50%)",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chart.subscribeCrosshairMove((param) => {
      if (param.time && candleSeriesRef.current) {
        const bar = param.seriesData.get(candleSeriesRef.current) as
          | { open: number; high: number; low: number; close: number }
          | undefined;
        if (bar) {
          setOhlcDisplay({
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            time: new Date((param.time as number) * 1000).toLocaleDateString(),
          });
          return;
        }
      }
      setOhlcDisplay(null);
    });

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
    };
  }, []);

  // ── Feed data (replay-aware) ────────────────────────────────────

  useEffect(() => {
    if (!klines || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const sorted = [...klines].sort((a, b) => a.time - b.time);
    sortedKlinesRef.current = sorted;

    const slice = replayMode ? sorted.slice(0, replayIndex) : sorted;

    candleSeriesRef.current.setData(
      slice.map((k) => ({
        time: k.time as Time,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
      }))
    );

    volumeSeriesRef.current.setData(
      slice.map((k) => ({
        time: k.time as Time,
        value: k.volume,
        color:
          k.close >= k.open
            ? "hsla(150, 90%, 50%, 0.35)"
            : "hsla(0, 85%, 60%, 0.35)",
      }))
    );

    if (replayMode) {
      chartRef.current?.timeScale().scrollToPosition(4, false);
    } else {
      chartRef.current?.timeScale().fitContent();
    }
  }, [klines, replayMode, replayIndex]);

  // ── Derived values ──────────────────────────────────────────────

  const sorted = sortedKlinesRef.current;
  const total = sorted.length;

  // In replay mode, the "current" bar is the last visible one
  const currentBar = replayMode
    ? sorted[Math.min(replayIndex, total) - 1] ?? null
    : klines && klines.length > 0
    ? klines[klines.length - 1]
    : null;

  const isUp = currentBar ? currentBar.close >= currentBar.open : true;
  const changePercent = currentBar
    ? (((currentBar.close - currentBar.open) / currentBar.open) * 100).toFixed(2)
    : null;

  const displayLabel = SYMBOLS.find((s) => s.value === symbol)?.label ?? symbol;

  const displayBar =
    ohlcDisplay ?? (currentBar ? { ...currentBar, time: "" } : null);

  const replayProgress = total > 0 ? (replayIndex / total) * 100 : 0;
  const currentDate =
    replayMode && currentBar ? fmtDate(currentBar.time) : null;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Live Chart</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real-time candlestick data from Binance
            </p>
          </div>
          {replayMode && (
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 font-mono tracking-widest text-[10px] px-2 py-0.5">
              ● REPLAY
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!replayMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              data-testid="button-refresh"
              className="gap-2"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          )}
          {!replayMode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={enterReplay}
              disabled={!klines || klines.length < MIN_CANDLES}
              data-testid="button-enter-replay"
              className="gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
            >
              <Clapperboard className="h-3.5 w-3.5" />
              Replay
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={exitReplay}
              data-testid="button-exit-replay"
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Exit Replay
            </Button>
          )}
        </div>
      </div>

      {/* Symbol + Interval controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={symbol} onValueChange={handleSymbolChange}>
          <SelectTrigger
            className="w-40"
            data-testid="select-symbol"
            disabled={replayMode}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYMBOLS.map((s) => (
              <SelectItem
                key={s.value}
                value={s.value}
                data-testid={`option-symbol-${s.value}`}
              >
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => handleIntervalChange(iv.value)}
              data-testid={`button-interval-${iv.value}`}
              className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                interval === iv.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>

        {currentBar && !replayMode && (
          <div className="flex items-center gap-3 ml-auto">
            <span
              className="text-lg font-mono font-bold"
              data-testid="text-last-price"
            >
              ${fmt(currentBar.close)}
            </span>
            <Badge
              variant="outline"
              data-testid="badge-change"
              className={
                isUp
                  ? "border-green-500 text-green-400"
                  : "border-red-500 text-red-400"
              }
            >
              {isUp ? "+" : ""}
              {changePercent}%
            </Badge>
          </div>
        )}
      </div>

      {/* Replay toolbar */}
      {replayMode && (
        <div
          className="flex flex-col gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3"
          data-testid="replay-toolbar"
        >
          {/* Controls row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Transport */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={jumpToStart}
                disabled={replayIndex <= MIN_CANDLES}
                title="Jump to start (⏮)"
                data-testid="replay-jump-start"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={stepBack}
                disabled={replayIndex <= MIN_CANDLES}
                title="Step back (←)"
                data-testid="replay-step-back"
              >
                <StepBack className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                className={`h-9 w-9 ${
                  isPlaying
                    ? "bg-amber-500 hover:bg-amber-600 text-black"
                    : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30"
                }`}
                onClick={() => setIsPlaying((p) => !p)}
                disabled={replayIndex >= total}
                title="Play / Pause (Space)"
                data-testid="replay-play-pause"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={stepForward}
                disabled={replayIndex >= total}
                title="Step forward (→)"
                data-testid="replay-step-forward"
              >
                <StepForward className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={jumpToEnd}
                disabled={replayIndex >= total}
                title="Jump to end (⏭)"
                data-testid="replay-jump-end"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            {/* Separator */}
            <div className="w-px h-6 bg-border mx-1" />

            {/* Speed */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">Speed</span>
              <div className="flex items-center gap-1">
                {SPEEDS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setReplaySpeed(s.value)}
                    data-testid={`replay-speed-${s.value}`}
                    className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                      replaySpeed === s.value
                        ? "bg-amber-500/30 text-amber-300 border border-amber-500/40"
                        : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Candle info */}
            <div className="ml-auto flex items-center gap-3">
              {currentDate && (
                <span className="text-sm font-mono text-amber-300/80">
                  {currentDate}
                </span>
              )}
              {currentBar && (
                <span
                  className={`text-base font-mono font-bold ${
                    isUp ? "text-green-400" : "text-red-400"
                  }`}
                >
                  ${fmt(currentBar.close)}
                </span>
              )}
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                {replayIndex} / {total}
              </span>
            </div>
          </div>

          {/* Scrubber */}
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={MIN_CANDLES}
              max={total}
              value={replayIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setReplayIndex(Number(e.target.value));
              }}
              data-testid="replay-scrubber"
              className="flex-1 h-1.5 accent-amber-400 cursor-pointer"
              style={{ accentColor: "hsl(38, 100%, 50%)" }}
            />
            <span className="text-xs font-mono text-muted-foreground tabular-nums w-10 text-right">
              {replayProgress.toFixed(0)}%
            </span>
          </div>

          {/* Keyboard hint */}
          <p className="text-[10px] text-muted-foreground/50 font-mono">
            ← → step · Space play/pause · Esc exit
          </p>
        </div>
      )}

      {/* OHLC crosshair line */}
      {displayBar && (
        <div
          className="flex items-center gap-4 text-xs font-mono text-muted-foreground"
          data-testid="ohlc-display"
        >
          {ohlcDisplay?.time && (
            <span className="text-foreground/50">{ohlcDisplay.time}</span>
          )}
          <span>
            O <span className="text-foreground">{fmt(displayBar.open)}</span>
          </span>
          <span>
            H <span className="text-green-400">{fmt(displayBar.high)}</span>
          </span>
          <span>
            L <span className="text-red-400">{fmt(displayBar.low)}</span>
          </span>
          <span>
            C{" "}
            <span
              className={
                displayBar.close >= displayBar.open
                  ? "text-green-400"
                  : "text-red-400"
              }
            >
              {fmt(displayBar.close)}
            </span>
          </span>
          {replayMode && changePercent && (
            <span
              className={
                isUp
                  ? "text-green-400 ml-2"
                  : "text-red-400 ml-2"
              }
            >
              {isUp ? "+" : ""}{changePercent}%
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      <div
        className={`relative flex-1 min-h-[480px] bg-card border rounded-lg overflow-hidden transition-colors ${
          replayMode ? "border-amber-500/30" : "border-border"
        }`}
      >
        {isLoading && (
          <div className="absolute inset-0 z-10 p-4">
            <Skeleton className="w-full h-full" />
          </div>
        )}

        {error && !isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center p-6">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">
                {(error as { data?: { error?: string } })?.data?.error ??
                  "Failed to load chart data"}
              </p>
              <Button size="sm" variant="outline" onClick={handleRefresh}>
                Try again
              </Button>
            </div>
          </div>
        )}

        <div
          ref={chartContainerRef}
          className="w-full h-full"
          data-testid="chart-container"
        />

        {/* Watermark */}
        <div className="absolute top-3 left-3 pointer-events-none select-none">
          <span className="text-3xl font-bold font-mono text-foreground/5">
            {displayLabel}
          </span>
        </div>

        {/* Replay overlay when paused at end */}
        {replayMode && replayIndex >= total && total > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
            <span className="bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-mono px-3 py-1.5 rounded-full">
              End of replay — all {total} candles shown
            </span>
          </div>
        )}
      </div>

      {/* Stats row */}
      {currentBar && (
        <div className="grid grid-cols-4 gap-3" data-testid="stats-row">
          {[
            { label: "Open", value: `$${fmt(currentBar.open)}` },
            { label: "High", value: `$${fmt(currentBar.high)}` },
            { label: "Low", value: `$${fmt(currentBar.low)}` },
            {
              label: "Volume",
              value: currentBar.volume.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              }),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-card border border-border rounded-lg p-3"
            >
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p
                className="text-sm font-mono font-semibold"
                data-testid={`stat-${item.label.toLowerCase()}`}
              >
                {item.value}
              </p>
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
