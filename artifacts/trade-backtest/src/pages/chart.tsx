import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { useGetKlines, getGetKlinesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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

type OhlcState = { open: number; high: number; low: number; close: number; time: string } | null;

export default function ChartPage() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState("1d");
  const [ohlcDisplay, setOhlcDisplay] = useState<OhlcState>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const queryClient = useQueryClient();

  const params = { symbol, interval, limit: 500 };
  const { data: klines, isLoading, error, isFetching } = useGetKlines(params, {
    query: {
      queryKey: getGetKlinesQueryKey(params),
      staleTime: 30_000,
      refetchInterval: 60_000,
    },
  });

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetKlinesQueryKey(params) });
  }, [queryClient, symbol, interval]);

  // Initialize chart once
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
      rightPriceScale: {
        borderColor: "hsl(230, 15%, 20%)",
      },
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
          const t = param.time as number;
          setOhlcDisplay({
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            time: new Date(t * 1000).toLocaleDateString(),
          });
        }
      } else {
        setOhlcDisplay(null);
      }
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

  // Feed data whenever klines change
  useEffect(() => {
    if (!klines || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const sorted = [...klines].sort((a, b) => a.time - b.time);

    candleSeriesRef.current.setData(
      sorted.map((k) => ({
        time: k.time as unknown as import("lightweight-charts").Time,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
      }))
    );

    volumeSeriesRef.current.setData(
      sorted.map((k) => ({
        time: k.time as unknown as import("lightweight-charts").Time,
        value: k.volume,
        color: k.close >= k.open ? "hsla(150, 90%, 50%, 0.35)" : "hsla(0, 85%, 60%, 0.35)",
      }))
    );

    chartRef.current?.timeScale().fitContent();
  }, [klines]);

  const lastBar = klines && klines.length > 0 ? klines[klines.length - 1] : null;
  const isUp = lastBar ? lastBar.close >= lastBar.open : true;
  const changePercent = lastBar
    ? (((lastBar.close - lastBar.open) / lastBar.open) * 100).toFixed(2)
    : null;
  const displayLabel = SYMBOLS.find((s) => s.value === symbol)?.label ?? symbol;

  function fmt(n: number) {
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: n < 1 ? 6 : 2,
    });
  }

  const displayBar = ohlcDisplay ?? (lastBar ? { ...lastBar, time: "" } : null);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Chart</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time candlestick data from Binance
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
          data-testid="button-refresh"
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Controls + Price */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={symbol} onValueChange={setSymbol}>
          <SelectTrigger className="w-40" data-testid="select-symbol">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYMBOLS.map((s) => (
              <SelectItem key={s.value} value={s.value} data-testid={`option-symbol-${s.value}`}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => setInterval(iv.value)}
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

        {lastBar && (
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-lg font-mono font-bold" data-testid="text-last-price">
              ${fmt(lastBar.close)}
            </span>
            <Badge
              variant="outline"
              data-testid="badge-change"
              className={
                isUp ? "border-green-500 text-green-400" : "border-red-500 text-red-400"
              }
            >
              {isUp ? "+" : ""}
              {changePercent}%
            </Badge>
          </div>
        )}
      </div>

      {/* OHLC crosshair line */}
      {displayBar && (
        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground" data-testid="ohlc-display">
          {ohlcDisplay?.time && (
            <span className="text-foreground/50">{ohlcDisplay.time}</span>
          )}
          <span>O <span className="text-foreground">{fmt(displayBar.open)}</span></span>
          <span>H <span className="text-green-400">{fmt(displayBar.high)}</span></span>
          <span>L <span className="text-red-400">{fmt(displayBar.low)}</span></span>
          <span>C <span className={displayBar.close >= displayBar.open ? "text-green-400" : "text-red-400"}>{fmt(displayBar.close)}</span></span>
        </div>
      )}

      {/* Chart */}
      <div className="relative flex-1 min-h-[480px] bg-card border border-border rounded-lg overflow-hidden">
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

        <div ref={chartContainerRef} className="w-full h-full" data-testid="chart-container" />

        {/* Watermark */}
        <div className="absolute top-3 left-3 pointer-events-none select-none">
          <span className="text-3xl font-bold font-mono text-foreground/5">{displayLabel}</span>
        </div>
      </div>

      {/* Stats row */}
      {lastBar && (
        <div className="grid grid-cols-4 gap-3" data-testid="stats-row">
          {[
            { label: "Open", value: `$${fmt(lastBar.open)}` },
            { label: "High", value: `$${fmt(lastBar.high)}` },
            { label: "Low", value: `$${fmt(lastBar.low)}` },
            {
              label: "Volume",
              value: lastBar.volume.toLocaleString(undefined, { maximumFractionDigits: 0 }),
            },
          ].map((item) => (
            <div key={item.label} className="bg-card border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className="text-sm font-mono font-semibold" data-testid={`stat-${item.label.toLowerCase()}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
