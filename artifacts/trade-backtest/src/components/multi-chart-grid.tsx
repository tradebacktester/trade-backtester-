import { useEffect, useRef, useState } from "react";
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
import { useGetKlines, getGetKlinesQueryKey, GetKlinesInterval } from "@workspace/api-client-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

const CHART_BG   = "hsl(222,28%,8%)";
const CHART_TEXT = "hsl(210,40%,75%)";

const MULTI_SYMBOLS = [
  { value: "BTCUSDT",  label: "BTC/USDT"  },
  { value: "ETHUSDT",  label: "ETH/USDT"  },
  { value: "SOLUSDT",  label: "SOL/USDT"  },
  { value: "BNBUSDT",  label: "BNB/USDT"  },
  { value: "XRPUSDT",  label: "XRP/USDT"  },
  { value: "ADAUSDT",  label: "ADA/USDT"  },
  { value: "DOGEUSDT", label: "DOGE/USDT" },
  { value: "AVAXUSDT", label: "AVAX/USDT" },
  { value: "DOTUSDT",  label: "DOT/USDT"  },
  { value: "MATICUSDT",label: "MATIC/USDT"},
  { value: "LTCUSDT",  label: "LTC/USDT"  },
  { value: "LINKUSDT", label: "LINK/USDT" },
  { value: "AAVEUSDT", label: "AAVE/USDT" },
  { value: "AAPL",     label: "AAPL"      },
  { value: "MSFT",     label: "MSFT"      },
  { value: "TSLA",     label: "TSLA"      },
  { value: "NVDA",     label: "NVDA"      },
  { value: "AMZN",     label: "AMZN"      },
  { value: "SPY",      label: "SPY"       },
  { value: "GLD",      label: "GLD"       },
];

const MULTI_INTERVALS = [
  { value: "1m",  label: "1m"  },
  { value: "5m",  label: "5m"  },
  { value: "15m", label: "15m" },
  { value: "1h",  label: "1h"  },
  { value: "4h",  label: "4h"  },
  { value: "1d",  label: "1D"  },
  { value: "1w",  label: "1W"  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PanelConfig { symbol: string; interval: GetKlinesInterval }

type SyncHandlers = React.MutableRefObject<Array<(t: number) => void>>;

// ── ChartPanelMini ────────────────────────────────────────────────────────────

interface ChartPanelMiniProps {
  config: PanelConfig;
  onChange: (c: PanelConfig) => void;
  panelIndex: number;
  syncRef: SyncHandlers;
}

function ChartPanelMini({ config, onChange, panelIndex, syncRef }: ChartPanelMiniProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef  = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef    = useRef<ISeriesApi<"Histogram"> | null>(null);

  const params = { symbol: config.symbol, interval: config.interval, limit: 300 };
  const { data: klines } = useGetKlines(params, {
    query: { queryKey: getGetKlinesQueryKey(params), staleTime: 60_000 },
  });

  // Create / recreate chart when component mounts
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_BG },
        textColor: CHART_TEXT,
        fontFamily: "'Inter', 'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "hsla(220,20%,30%,0.12)" },
        horzLines: { color: "hsla(220,20%,30%,0.12)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
        scaleMargins: { top: 0.08, bottom: 0.18 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor:        "hsl(142,70%,50%)",
      downColor:      "hsl(0,72%,55%)",
      borderUpColor:  "hsl(142,70%,50%)",
      borderDownColor:"hsl(0,72%,55%)",
      wickUpColor:    "hsl(142,70%,50%)",
      wickDownColor:  "hsl(0,72%,55%)",
    });

    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    chartRef.current  = chart;
    candleRef.current = candle;
    volRef.current    = vol;

    // Publish sync handler for this panel
    syncRef.current[panelIndex] = (t: number) => {
      try { chart.setCrosshairPosition(0, t as Time, candle); } catch { /* ignore */ }
    };

    // Subscribe crosshair move → sync siblings
    chart.subscribeCrosshairMove(param => {
      if (param.time) {
        const t = param.time as number;
        syncRef.current.forEach((fn, i) => { if (i !== panelIndex) fn(t); });
      }
    });

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (container) chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      syncRef.current[panelIndex] = () => {};
      try { chart.remove(); } catch { /* ignore */ }
      chartRef.current  = null;
      candleRef.current = null;
      volRef.current    = null;
    };
  // Only run on mount/unmount — symbol/interval changes trigger data re-fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update chart data when klines arrive or symbol/interval changes
  useEffect(() => {
    if (!candleRef.current || !volRef.current || !klines?.length) return;
    const sorted = [...klines].sort((a, b) => a.time - b.time);

    const maxVol = Math.max(...sorted.map(k => k.volume ?? 0));
    candleRef.current.setData(
      sorted.map(k => ({ time: k.time as Time, open: k.open, high: k.high, low: k.low, close: k.close }))
    );
    volRef.current.setData(
      sorted.map(k => ({
        time: k.time as Time,
        value: k.volume ?? 0,
        color: k.close >= k.open
          ? "rgba(34,197,94,0.28)"
          : "rgba(239,68,68,0.28)",
      }))
    );
    void maxVol; // silence unused-var
    chartRef.current?.timeScale().fitContent();
  }, [klines]);

  // Compute display stats
  const lastBar  = klines?.at(-1);
  const prevBar  = klines?.at(-2);
  const lastClose = lastBar?.close;
  const prevClose = prevBar?.close;
  const pctChange = lastClose != null && prevClose != null && prevClose !== 0
    ? ((lastClose - prevClose) / prevClose) * 100
    : null;
  const isUp = pctChange == null ? null : pctChange >= 0;

  const fmtPrice = (v: number) =>
    v < 0.01  ? v.toFixed(6)
    : v < 1    ? v.toFixed(4)
    : v < 1000 ? v.toFixed(2)
    : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border relative"
      style={{ background: CHART_BG, borderColor: "rgba(255,255,255,0.07)" }}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-1 px-2 py-1 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}
      >
        {/* Symbol picker */}
        <Select value={config.symbol} onValueChange={s => onChange({ ...config, symbol: s })}>
          <SelectTrigger
            className="h-6 text-[10px] font-mono border-0 bg-transparent p-0 focus:ring-0 gap-0.5"
            style={{ width: "5.5rem", color: "hsl(var(--foreground))" }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="text-xs font-mono">
            {MULTI_SYMBOLS.map(s => (
              <SelectItem key={s.value} value={s.value} className="text-xs font-mono">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Interval picker */}
        <Select value={config.interval} onValueChange={v => onChange({ ...config, interval: v as GetKlinesInterval })}>
          <SelectTrigger
            className="h-6 text-[10px] font-mono border-0 bg-transparent p-0 focus:ring-0 gap-0.5"
            style={{ width: "2.5rem", color: "hsl(200,80%,65%)" }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="text-xs font-mono">
            {MULTI_INTERVALS.map(iv => (
              <SelectItem key={iv.value} value={iv.value} className="text-xs font-mono">{iv.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Price + change */}
        {lastClose != null && (
          <div className="ml-auto flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-mono font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>
              {fmtPrice(lastClose)}
            </span>
            {pctChange != null && (
              <span
                className="text-[9px] font-mono flex-shrink-0"
                style={{ color: isUp ? "hsl(142,70%,50%)" : "hsl(0,72%,55%)" }}
              >
                {isUp ? "▲" : "▼"} {Math.abs(pctChange).toFixed(2)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chart canvas */}
      <div ref={containerRef} className="flex-1 w-full min-h-0" />
    </div>
  );
}

// ── MultiChartGrid (exported) ─────────────────────────────────────────────────

const DEFAULT_PANELS: PanelConfig[] = [
  { symbol: "BTCUSDT", interval: GetKlinesInterval["4h"] },
  { symbol: "ETHUSDT", interval: GetKlinesInterval["4h"] },
  { symbol: "SOLUSDT", interval: GetKlinesInterval["1d"] },
  { symbol: "BNBUSDT", interval: GetKlinesInterval["1d"] },
];

interface MultiChartGridProps {
  defaultSymbol?: string;
  onClose: () => void;
}

export function MultiChartGrid({ defaultSymbol, onClose }: MultiChartGridProps) {
  const [panels, setPanels] = useState<PanelConfig[]>(() => {
    const p = DEFAULT_PANELS.map(x => ({ ...x }));
    if (defaultSymbol) p[0] = { ...p[0], symbol: defaultSymbol };
    return p;
  });

  // One sync-handler slot per panel; populated by each ChartPanelMini
  const syncRef = useRef<Array<(t: number) => void>>([
    () => {}, () => {}, () => {}, () => {},
  ]);

  function updatePanel(i: number, c: PanelConfig) {
    setPanels(prev => prev.map((p, idx) => (idx === i ? c : p)));
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Grid header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-mono uppercase tracking-widest font-semibold"
            style={{ color: "hsl(200,80%,60%)" }}
          >
            2 × 2 Multi-Chart
          </span>
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(100,180,255,0.08)",
              color: "hsl(200,80%,60%)",
              border: "1px solid rgba(100,180,255,0.18)",
            }}
          >
            Crosshair sync
          </span>
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 rounded flex items-center justify-center transition-colors hover:opacity-70"
          style={{ color: "hsl(220,14%,50%)" }}
          title="Return to single chart"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 2 × 2 grid */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 p-2 min-h-0">
        {panels.map((panel, i) => (
          <ChartPanelMini
            key={i}
            config={panel}
            onChange={c => updatePanel(i, c)}
            panelIndex={i}
            syncRef={syncRef}
          />
        ))}
      </div>
    </div>
  );
}
