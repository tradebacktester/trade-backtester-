import { useState, useEffect, useRef } from "react";
import {
  createChart, CandlestickSeries, LineSeries, LineStyle,
  type IChartApi, type ISeriesApi, type CandlestickSeriesOptions,
  type IPriceLine, type Time,
} from "lightweight-charts";
import {
  TrendingUp, TrendingDown, RotateCcw, Zap, Activity,
  Target, BarChart2, Layers, AlertCircle, Clock,
  ChevronDown,
} from "lucide-react";

type OrderSide = "buy" | "sell";

interface DemoTrade {
  id: number;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  exitPrice?: number;
  size: number;
  leverage: number;
  margin: number;
  pnl?: number;
  pnlPct?: number;
  openTime: number;
  closeTime?: number;
  status: "open" | "closed";
}

interface OhlcCandle {
  time: number;
  open: number; high: number; low: number; close: number;
}

const BALANCE_OPTIONS = [
  { value: 1_000,   label: "$1,000",   badge: "Micro" },
  { value: 10_000,  label: "$10,000",  badge: "Retail" },
  { value: 100_000, label: "$100,000", badge: "Pro" },
  { value: 500_000, label: "$500,000", badge: "Institutional" },
];

const LEVERAGE_OPTIONS = [1, 2, 5, 10, 25, 50, 100];

const DEMO_SYMBOLS = [
  { value: "BTCUSDT",  label: "BTC/USDT",  price: 76_420.50, change: 2.34  },
  { value: "ETHUSDT",  label: "ETH/USDT",  price: 3_521.80,  change: 1.87  },
  { value: "SOLUSDT",  label: "SOL/USDT",  price: 182.40,    change: -0.92 },
  { value: "BNBUSDT",  label: "BNB/USDT",  price: 608.20,    change: 0.45  },
  { value: "XRPUSDT",  label: "XRP/USDT",  price: 0.6234,    change: -1.23 },
  { value: "ADAUSDT",  label: "ADA/USDT",  price: 0.4567,    change: 3.12  },
  { value: "LINKUSDT", label: "LINK/USDT", price: 18.92,     change: -0.67 },
  { value: "INJUSDT",  label: "INJ/USDT",  price: 28.45,     change: 5.23  },
];

/* ── helpers ─────────────────────────────────────────────────────── */
function fmtUSD(n: number) {
  return `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtPrice(p: number) {
  return p < 1 ? p.toFixed(4) : p < 100 ? p.toFixed(2) : p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── seeded candle history ───────────────────────────────────────── */
function seedCandles(basePrice: number, count = 80): OhlcCandle[] {
  const nowSec = Math.floor(Date.now() / 1000);
  const minuteStart = nowSec - (nowSec % 60);
  const candles: OhlcCandle[] = [];
  let price = basePrice;
  /* walk backwards from the slot BEFORE current open candle */
  for (let i = count; i >= 1; i--) {
    const time = minuteStart - i * 60;
    const vol = 0.0025;
    const open = price;
    const c1   = price * (1 + (Math.random() - 0.495) * vol * 2.4);
    const c2   = price * (1 + (Math.random() - 0.495) * vol * 2.4);
    const close = price * (1 + (Math.random() - 0.495) * vol);
    const high  = Math.max(open, close, c1, c2) * (1 + Math.random() * vol * 0.5);
    const low   = Math.min(open, close, c1, c2) * (1 - Math.random() * vol * 0.5);
    candles.push({ time, open, high, low, close });
    price = close;
  }
  return candles;
}

/* ── simulated live price ────────────────────────────────────────── */
function useSimPrice(base: number) {
  const [price, setPrice] = useState(base);
  const baseRef = useRef(base);
  baseRef.current = base;
  useEffect(() => {
    setPrice(baseRef.current);
    const id = setInterval(
      () => setPrice(p => Math.max(0.0001, p + (Math.random() - 0.5) * 0.0018 * p)),
      900,
    );
    return () => clearInterval(id);
  }, []);
  return price;
}

/* ── Card wrapper ────────────────────────────────────────────────── */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border ${className}`}
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.014))",
        borderColor: "rgba(255,255,255,0.075)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </div>
  );
}

const DEMO_DRAW_COLORS = [
  "hsl(190,90%,55%)", "hsl(38,100%,55%)", "hsl(150,90%,55%)",
  "hsl(0,85%,62%)",   "hsl(260,90%,70%)", "hsl(200,14%,75%)",
];

type DemoDrawTool = "cursor" | "hline" | "trendline" | "ray" | "eraser";
type DemoDrawnLine =
  | { kind: "hline"; priceLine: IPriceLine; color: string }
  | { kind: "trendline"; series: ISeriesApi<"Line">; color: string };

/* ══════════════════════════════════════════════════════════════════
   LIVE CANDLESTICK CHART
══════════════════════════════════════════════════════════════════ */
function DemoChart({ symbol, livePrice }: { symbol: string; livePrice: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<"Candlestick", CandlestickSeriesOptions> | null>(null);
  const candlesRef   = useRef<OhlcCandle[]>([]);

  /* Build chart once per symbol — tears down & rebuilds on symbol change */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width:  el.clientWidth,
      height: 268,
      layout: {
        background: { color: "transparent" },
        textColor:  "rgba(255,255,255,0.28)",
        fontSize:   11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        vertLine: { color: "rgba(59,130,246,0.5)", width: 1 },
        horzLine: { color: "rgba(59,130,246,0.5)", width: 1 },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
      timeScale: {
        borderColor:    "rgba(255,255,255,0.06)",
        timeVisible:    true,
        secondsVisible: false,
        fixLeftEdge:    true,
      },
      handleScroll: false,
      handleScale:  false,
    });

    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor:        "hsl(150,80%,55%)",
      downColor:      "hsl(0,78%,60%)",
      borderUpColor:  "hsl(150,80%,55%)",
      borderDownColor:"hsl(0,78%,60%)",
      wickUpColor:    "hsl(150,60%,46%)",
      wickDownColor:  "hsl(0,60%,48%)",
    });

    seriesRef.current = series;

    /* Seed history */
    const history = seedCandles(livePrice);
    candlesRef.current = history;
    series.setData(history as Parameters<typeof series.setData>[0]);
    chart.timeScale().fitContent();

    /* Resize observer */
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
      candlesRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  /* Update current candle on every price tick */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !candlesRef.current.length) return;

    const nowSec     = Math.floor(Date.now() / 1000);
    const minuteStart = nowSec - (nowSec % 60);
    const last       = candlesRef.current[candlesRef.current.length - 1];

    let updated: OhlcCandle;

    if (minuteStart > last.time) {
      /* Open a brand-new candle */
      updated = { time: minuteStart, open: livePrice, high: livePrice, low: livePrice, close: livePrice };
      candlesRef.current = [...candlesRef.current, updated];
    } else {
      /* Extend the current candle */
      updated = {
        ...last,
        high:  Math.max(last.high,  livePrice),
        low:   Math.min(last.low,   livePrice),
        close: livePrice,
      };
      candlesRef.current = [...candlesRef.current.slice(0, -1), updated];
    }

    series.update(updated as Parameters<typeof series.update>[0]);
  }, [livePrice]);

  // ── Drawing tools ──────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState<DemoDrawTool>("cursor");
  const [drawColor, setDrawColor]   = useState(DEMO_DRAW_COLORS[0]);
  const [drawings, setDrawings]     = useState<DemoDrawnLine[]>([]);
  const [drawStart, setDrawStart]   = useState<{ x: number; y: number; price: number; time: number } | null>(null);
  const drawingsRef = useRef<DemoDrawnLine[]>([]);
  useEffect(() => { drawingsRef.current = drawings; }, [drawings]);

  function getCoords(e: React.MouseEvent<HTMLDivElement>) {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const el = containerRef.current;
    if (!chart || !series || !el) return null;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const price = Number(series.coordinateToPrice(y) ?? 0);
    const logical = chart.timeScale().coordinateToLogical(x) ?? 0;
    const idx = Math.max(0, Math.min(Math.round(Number(logical)), candlesRef.current.length - 1));
    const time = candlesRef.current[idx]?.time ?? 0;
    return { x, y, price, time };
  }

  function handleDrawMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (activeTool === "cursor") return;
    e.preventDefault();
    const coords = getCoords(e);
    if (!coords) return;

    if (activeTool === "eraser") {
      const list = drawingsRef.current;
      if (!list.length) return;
      const last = list[list.length - 1];
      if (last.kind === "hline") seriesRef.current?.removePriceLine(last.priceLine);
      if (last.kind === "trendline") chartRef.current?.removeSeries(last.series);
      setDrawings(prev => prev.slice(0, -1));
      return;
    }

    if (activeTool === "hline") {
      if (!seriesRef.current) return;
      const pl = seriesRef.current.createPriceLine({
        price: coords.price, color: drawColor, lineWidth: 1 as const,
        lineStyle: LineStyle.Dashed, axisLabelVisible: true,
        title: coords.price.toFixed(2),
      });
      setDrawings(prev => [...prev, { kind: "hline", priceLine: pl, color: drawColor }]);
      setActiveTool("cursor");
      return;
    }

    if (activeTool === "trendline" || activeTool === "ray") {
      if (!drawStart) {
        setDrawStart(coords);
      } else {
        if (!chartRef.current) return;
        const t1 = drawStart.time; const t2 = coords.time;
        const pts = t1 <= t2
          ? [{ time: t1 as Time, value: drawStart.price }, { time: t2 as Time, value: coords.price }]
          : [{ time: t2 as Time, value: coords.price }, { time: t1 as Time, value: drawStart.price }];
        const ls = chartRef.current.addSeries(LineSeries, {
          color: drawColor, lineWidth: 1 as const,
          priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
          lineStyle: activeTool === "ray" ? LineStyle.SparseDotted : LineStyle.Solid,
        });
        ls.setData(pts);
        setDrawings(prev => [...prev, { kind: "trendline", series: ls, color: drawColor }]);
        setDrawStart(null);
        setActiveTool("cursor");
      }
      return;
    }
  }

  const DRAW_TOOL_DEFS: { id: DemoDrawTool; icon: string; title: string }[] = [
    { id: "cursor",    icon: "↖", title: "Select (no draw)" },
    { id: "hline",     icon: "—", title: "Horizontal Line" },
    { id: "trendline", icon: "╱", title: "Trendline" },
    { id: "ray",       icon: "↗", title: "Ray" },
    { id: "eraser",    icon: "✕", title: "Erase Last" },
  ];

  return (
    <div className="relative select-none">
      <div
        ref={containerRef}
        style={{ width: "100%", height: 268, minHeight: 268 }}
      />

      {/* Drawing overlay */}
      <div
        className="absolute inset-0 z-20"
        style={{
          cursor: activeTool === "cursor" ? "default" : activeTool === "eraser" ? "cell" : "crosshair",
          pointerEvents: activeTool === "cursor" ? "none" : "auto",
        }}
        onMouseDown={handleDrawMouseDown}
      />

      {/* Start-point dot */}
      {drawStart && (
        <div className="absolute z-30 pointer-events-none" style={{ left: drawStart.x - 4, top: drawStart.y - 4 }}>
          <div className="w-2 h-2 rounded-full border-2" style={{ borderColor: drawColor, background: `${drawColor}30`, boxShadow: `0 0 8px ${drawColor}` }} />
        </div>
      )}

      {/* Drawing toolbar */}
      <div
        className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto"
        style={{
          background: "rgba(8,10,16,0.92)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(12px)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {DRAW_TOOL_DEFS.map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTool(t.id); if (t.id !== activeTool) setDrawStart(null); }}
            title={t.title}
            className="h-7 min-w-[28px] px-1.5 flex items-center justify-center rounded-lg text-xs font-mono transition-all flex-shrink-0"
            style={activeTool === t.id
              ? {
                  background: t.id === "eraser" ? "rgba(239,68,68,0.18)" : "rgba(0,229,255,0.15)",
                  color: t.id === "eraser" ? "hsl(0,85%,65%)" : "hsl(190,90%,65%)",
                  border: `1px solid ${t.id === "eraser" ? "rgba(239,68,68,0.3)" : "rgba(0,229,255,0.3)"}`,
                  boxShadow: t.id === "eraser" ? "0 0 10px rgba(239,68,68,0.15)" : "0 0 10px rgba(0,229,255,0.15)",
                }
              : { color: "hsl(220,14%,48%)", border: "1px solid transparent" }}
          >
            {t.icon}
          </button>
        ))}
        <div className="w-px h-4 flex-shrink-0 mx-0.5" style={{ background: "rgba(255,255,255,0.08)" }} />
        {DEMO_DRAW_COLORS.map(c => (
          <button
            key={c}
            onClick={() => setDrawColor(c)}
            className="h-3.5 w-3.5 rounded-full flex-shrink-0 transition-all"
            style={{
              background: c,
              transform: drawColor === c ? "scale(1.45)" : "scale(1)",
              outline: drawColor === c ? `2px solid ${c}` : "none",
              outlineOffset: "2px",
            }}
          />
        ))}
        {drawings.length > 0 && (
          <>
            <div className="w-px h-4 flex-shrink-0 mx-0.5" style={{ background: "rgba(255,255,255,0.08)" }} />
            <button
              onClick={() => {
                drawingsRef.current.forEach(d => {
                  if (d.kind === "hline") seriesRef.current?.removePriceLine(d.priceLine);
                  if (d.kind === "trendline") chartRef.current?.removeSeries(d.series);
                });
                setDrawings([]);
                setDrawStart(null);
              }}
              className="h-6 px-2 rounded-lg text-[10px] font-mono flex-shrink-0 transition-all"
              style={{ color: "hsl(0,85%,60%)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
              title="Clear all drawings"
            >
              clear
            </button>
          </>
        )}
        {activeTool !== "cursor" && (
          <span className="ml-auto text-[10px] font-mono flex-shrink-0" style={{ color: "hsl(190,90%,55%)" }}>
            {activeTool === "hline" && "click to place"}
            {(activeTool === "trendline" || activeTool === "ray") && (drawStart ? "click 2nd point" : "click start")}
            {activeTool === "eraser" && "click to erase"}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Setup Screen ─────────────────────────────────────────────────── */
function SetupScreen({ onStart }: { onStart: (balance: number) => void }) {
  const [selected, setSelected] = useState(10_000);

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto py-2">
      <div
        className="rounded-2xl px-5 py-6 border relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.09) 0%, rgba(255,255,255,0.015) 100%)",
          borderColor: "rgba(59,130,246,0.22)",
          boxShadow: "0 8px 36px rgba(0,0,0,0.35), 0 0 50px rgba(59,130,246,0.06), inset 0 1px 0 rgba(59,130,246,0.1)",
        }}
      >
        <div className="absolute -top-8 -right-8 h-36 w-36 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.14), transparent)" }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(59,130,246,0.14)", border: "1px solid rgba(59,130,246,0.28)" }}>
              <Zap className="h-6 w-6" style={{ color: "hsl(210,90%,65%)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: "hsl(218,16%,90%)" }}>Paper Trading</h1>
              <p className="text-sm" style={{ color: "hsl(218,12%,42%)" }}>Practice without risking real money</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            {[
              { icon: <Activity className="h-3.5 w-3.5" />, label: "Live simulated prices" },
              { icon: <Target className="h-3.5 w-3.5" />,   label: "Real P&L tracking" },
              { icon: <BarChart2 className="h-3.5 w-3.5" />, label: "Live candlestick chart" },
              { icon: <Layers className="h-3.5 w-3.5" />,   label: "Up to 100x leverage" },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ color: "hsl(210,90%,62%)" }}>{f.icon}</span>
                <span style={{ color: "hsl(218,12%,52%)" }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest mb-3 px-1" style={{ color: "hsl(218,12%,38%)" }}>
          Choose Starting Balance
        </p>
        <div className="grid grid-cols-2 gap-2">
          {BALANCE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className="flex flex-col gap-1 p-4 rounded-2xl border transition-all text-left"
              style={selected === opt.value ? {
                background: "rgba(59,130,246,0.1)",
                borderColor: "rgba(59,130,246,0.35)",
                boxShadow: "0 0 20px rgba(59,130,246,0.1), inset 0 1px 0 rgba(59,130,246,0.1)",
              } : {
                background: "rgba(255,255,255,0.024)",
                borderColor: "rgba(255,255,255,0.07)",
              }}
            >
              <span className="text-xl font-bold font-mono"
                style={{ color: selected === opt.value ? "hsl(210,90%,65%)" : "hsl(218,14%,72%)" }}>
                {opt.label}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full self-start"
                style={{
                  background: selected === opt.value ? "rgba(59,130,246,0.14)" : "rgba(255,255,255,0.05)",
                  color: selected === opt.value ? "hsl(210,90%,65%)" : "hsl(218,12%,42%)",
                }}>
                {opt.badge}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onStart(selected)}
        className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, hsl(210,85%,44%), hsl(215,80%,54%))",
          color: "#fff",
          boxShadow: "0 8px 28px rgba(59,130,246,0.3), 0 0 0 1px rgba(59,130,246,0.2)",
        }}
      >
        Start Paper Trading
      </button>
    </div>
  );
}

/* ── Market ticker row ───────────────────────────────────────────── */
function MarketRow({ sym, isSelected, onClick }: {
  sym: typeof DEMO_SYMBOLS[0]; isSelected: boolean; onClick: () => void;
}) {
  const price = useSimPrice(sym.price);
  const isUp  = sym.change >= 0;
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between px-3 py-2 rounded-xl transition-all w-full text-left"
      style={isSelected ? {
        background: "rgba(59,130,246,0.1)",
        border: "1px solid rgba(59,130,246,0.25)",
      } : {
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <p className="text-xs font-mono font-semibold"
        style={{ color: isSelected ? "hsl(210,90%,65%)" : "hsl(218,14%,72%)" }}>
        {sym.label}
      </p>
      <div className="text-right">
        <p className="text-xs font-mono font-bold"
          style={{ color: isUp ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>
          {fmtPrice(price)}
        </p>
        <p className="text-[10px] font-mono"
          style={{ color: isUp ? "hsl(150,78%,52%)" : "hsl(0,76%,58%)" }}>
          {isUp ? "+" : ""}{sym.change.toFixed(2)}%
        </p>
      </div>
    </button>
  );
}

/* ── Trading Interface ───────────────────────────────────────────── */
function TradingInterface({ initialBalance, onReset }: { initialBalance: number; onReset: () => void }) {
  const [balance, setBalance]             = useState(initialBalance);
  const [trades, setTrades]               = useState<DemoTrade[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState(DEMO_SYMBOLS[0]);
  const [leverage, setLeverage]           = useState(10);
  const [riskPct, setRiskPct]             = useState(5);
  const [tab, setTab]                     = useState<"trade" | "positions" | "history" | "analytics">("trade");
  const [showMarkets, setShowMarkets]     = useState(false);
  const livePrice = useSimPrice(selectedSymbol.price);

  const openPositions    = trades.filter(t => t.status === "open");
  const closedTrades     = trades.filter(t => t.status === "closed");
  const totalOpenPnl     = openPositions.reduce((acc, t) => {
    const diff = livePrice - t.entryPrice;
    return acc + (t.side === "buy" ? diff : -diff) * t.size * t.leverage / t.entryPrice;
  }, 0);
  const equity           = balance + totalOpenPnl;
  const usedMargin       = openPositions.reduce((acc, t) => acc + t.margin, 0);
  const freeMargin       = equity - usedMargin;
  const totalRealizedPnl = closedTrades.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
  const wins             = closedTrades.filter(t => (t.pnl ?? 0) > 0).length;
  const losses_          = closedTrades.filter(t => (t.pnl ?? 0) <= 0).length;
  const winRate          = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
  const riskAmount       = (balance * riskPct) / 100;
  const positionSize     = (riskAmount * leverage) / livePrice;
  const margin           = riskAmount;

  function placeOrder(side: OrderSide) {
    if (margin > freeMargin) return;
    const trade: DemoTrade = {
      id: Date.now(), symbol: selectedSymbol.value, side,
      entryPrice: livePrice, size: positionSize, leverage, margin,
      openTime: Date.now(), status: "open",
    };
    setTrades(prev => [trade, ...prev]);
    setBalance(b => b - margin);
  }

  function closePosition(tradeId: number, closePrice: number) {
    let pnlAmount = 0; let marginBack = 0;
    setTrades(prev => prev.map(t => {
      if (t.id !== tradeId || t.status !== "open") return t;
      const diff   = closePrice - t.entryPrice;
      const pnl    = (t.side === "buy" ? diff : -diff) * t.size * t.leverage / t.entryPrice;
      const pnlPct = (pnl / t.margin) * 100;
      pnlAmount = pnl; marginBack = t.margin;
      return { ...t, exitPrice: closePrice, pnl, pnlPct, closeTime: Date.now(), status: "closed" };
    }));
    setBalance(b => b + marginBack + pnlAmount);
  }

  const ACCENT = "hsl(210,90%,62%)";

  const statCards = [
    { label: "Equity",       value: fmtUSD(equity),               color: equity >= initialBalance ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)", sub: fmtPct(((equity - initialBalance) / initialBalance) * 100) },
    { label: "Free Margin",  value: fmtUSD(freeMargin),           color: "hsl(218,14%,72%)", sub: usedMargin > 0 ? `${fmtUSD(usedMargin)} used` : "No positions" },
    { label: "Realized P&L", value: (totalRealizedPnl >= 0 ? "+" : "") + fmtUSD(totalRealizedPnl), color: totalRealizedPnl >= 0 ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)", sub: `${closedTrades.length} closed` },
    { label: "Win Rate",     value: closedTrades.length > 0 ? `${winRate.toFixed(0)}%` : "—", color: winRate >= 50 ? "hsl(150,80%,55%)" : winRate > 0 ? "hsl(0,78%,60%)" : "hsl(218,12%,50%)", sub: `${wins}W / ${losses_}L` },
  ];

  const TABS = [
    { id: "trade"     as const, label: "Trade" },
    { id: "positions" as const, label: `Positions (${openPositions.length})` },
    { id: "history"   as const, label: `History (${closedTrades.length})` },
    { id: "analytics" as const, label: "Analytics" },
  ];

  return (
    <div className="flex flex-col gap-3 pb-6">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {statCards.map(s => (
          <div key={s.label} className="rounded-xl px-3 py-3 border flex flex-col gap-0.5"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.038), rgba(255,255,255,0.012))",
              borderColor: "rgba(255,255,255,0.07)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
            }}>
            <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(218,12%,34%)" }}>{s.label}</p>
            <p className="text-base sm:text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] font-mono" style={{ color: "hsl(218,12%,38%)" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Header bar ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowMarkets(v => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all"
          style={{ background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.2)", color: ACCENT }}
        >
          <span className="text-sm font-mono font-bold">{selectedSymbol.label}</span>
          <span className="text-base font-bold font-mono"
            style={{ color: selectedSymbol.change >= 0 ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>
            {fmtPrice(livePrice)}
          </span>
          <ChevronDown className="h-3.5 w-3.5"
            style={{ color: ACCENT, transform: showMarkets ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono transition-all"
          style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "hsl(218,12%,45%)" }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {/* ── Markets dropdown ── */}
      {showMarkets && (
        <Card className="p-3">
          <p className="text-[9px] font-mono uppercase tracking-widest px-1 mb-2" style={{ color: "hsl(218,12%,36%)" }}>Select Market</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {DEMO_SYMBOLS.map(sym => (
              <MarketRow key={sym.value} sym={sym}
                isSelected={sym.value === selectedSymbol.value}
                onClick={() => { setSelectedSymbol(sym); setShowMarkets(false); }} />
            ))}
          </div>
        </Card>
      )}

      {/* ── Tab bar ── */}
      <div className="flex gap-0.5 p-0.5 rounded-2xl"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.065)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2 text-[10px] sm:text-xs font-mono rounded-xl transition-all"
            style={tab === t.id ? {
              background: "rgba(59,130,246,0.14)",
              color: ACCENT,
              border: "1px solid rgba(59,130,246,0.22)",
            } : { color: "hsl(218,12%,44%)", border: "1px solid transparent" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════
          TAB: TRADE  (chart + order panel)
      ════════════════════════════════════════ */}
      {tab === "trade" && (
        <div className="flex flex-col gap-3">

          {/* ── Live Chart ── */}
          <Card className="overflow-hidden">
            {/* Chart header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold" style={{ color: ACCENT }}>
                  {selectedSymbol.label}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(255,255,255,0.05)", color: "hsl(218,12%,44%)" }}>
                  1m
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-base font-bold font-mono"
                  style={{ color: selectedSymbol.change >= 0 ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>
                  {fmtPrice(livePrice)}
                </span>
                <span className="text-[11px] font-mono"
                  style={{ color: selectedSymbol.change >= 0 ? "hsl(150,78%,52%)" : "hsl(0,76%,58%)" }}>
                  {selectedSymbol.change >= 0 ? "+" : ""}{selectedSymbol.change.toFixed(2)}%
                </span>
                <span className="hidden sm:flex items-center gap-1 text-[10px] font-mono"
                  style={{ color: "hsl(150,76%,50%)" }}>
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse inline-block"
                    style={{ background: "hsl(150,76%,50%)" }} />
                  Live
                </span>
              </div>
            </div>

            {/* Chart canvas */}
            <div className="px-1 pb-1 pt-1">
              <DemoChart symbol={selectedSymbol.value} livePrice={livePrice} />
            </div>
          </Card>

          {/* ── Order panel + Markets side by side ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

            {/* Order panel */}
            <Card className="p-4 flex flex-col gap-4">
              {/* Leverage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(218,12%,36%)" }}>Leverage</p>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg"
                    style={{ background: "rgba(245,158,11,0.1)", color: "hsl(38,95%,65%)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    {leverage}x
                  </span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {LEVERAGE_OPTIONS.map(lev => (
                    <button key={lev} onClick={() => setLeverage(lev)}
                      className="px-2 py-1 text-[11px] font-mono rounded-lg transition-all"
                      style={leverage === lev
                        ? { background: "rgba(245,158,11,0.14)", color: "hsl(38,95%,65%)", border: "1px solid rgba(245,158,11,0.28)" }
                        : { background: "rgba(255,255,255,0.04)", color: "hsl(218,12%,48%)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      {lev}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(218,12%,36%)" }}>Risk</p>
                  <span className="text-xs font-mono font-bold" style={{ color: "hsl(218,14%,62%)" }}>
                    {riskPct}% · {fmtUSD(riskAmount)} margin
                  </span>
                </div>
                <input type="range" min={1} max={50} value={riskPct}
                  onChange={e => setRiskPct(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full cursor-pointer"
                  style={{ accentColor: ACCENT }} />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] font-mono" style={{ color: "hsl(218,12%,33%)" }}>1%</span>
                  <span className="text-[9px] font-mono" style={{ color: "hsl(218,12%,33%)" }}>50%</span>
                </div>
              </div>

              {/* Order summary */}
              <div className="rounded-xl p-3 flex flex-col gap-1.5"
                style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  { label: "Position Size",  value: `${positionSize.toFixed(4)} ${selectedSymbol.label.split("/")[0]}` },
                  { label: "Notional Value", value: fmtUSD(positionSize * livePrice) },
                  { label: "Required Margin",value: fmtUSD(margin) },
                  { label: "Available",      value: fmtUSD(freeMargin), warn: margin > freeMargin },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between text-xs font-mono">
                    <span style={{ color: "hsl(218,12%,40%)" }}>{r.label}</span>
                    <span style={{ color: r.warn ? "hsl(0,78%,60%)" : "hsl(218,14%,72%)" }}>{r.value}</span>
                  </div>
                ))}
              </div>

              {margin > freeMargin && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono"
                  style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", color: "hsl(0,78%,62%)" }}>
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  Insufficient margin — reduce risk or close positions
                </div>
              )}

              {/* Buy / Sell */}
              <div className="grid grid-cols-2 gap-2">
                {(["buy", "sell"] as OrderSide[]).map(side => (
                  <button key={side}
                    disabled={margin > freeMargin}
                    onClick={() => placeOrder(side)}
                    className="py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-30 active:scale-[0.97]"
                    style={side === "buy" ? {
                      background: "linear-gradient(135deg, hsl(150,72%,22%), hsl(150,72%,17%))",
                      color: "hsl(150,80%,62%)",
                      border: "1px solid rgba(52,211,153,0.28)",
                      boxShadow: "0 4px 18px rgba(52,211,153,0.12)",
                    } : {
                      background: "linear-gradient(135deg, hsl(0,62%,24%), hsl(0,62%,18%))",
                      color: "hsl(0,78%,68%)",
                      border: "1px solid rgba(239,68,68,0.28)",
                      boxShadow: "0 4px 18px rgba(239,68,68,0.12)",
                    }}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      {side === "buy" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {side.toUpperCase()}
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            {/* Market list */}
            <Card className="p-3 flex flex-col gap-2">
              <p className="text-[9px] font-mono uppercase tracking-widest px-1" style={{ color: "hsl(218,12%,36%)" }}>Markets</p>
              <div className="flex flex-col gap-1.5">
                {DEMO_SYMBOLS.map(sym => (
                  <MarketRow key={sym.value} sym={sym}
                    isSelected={sym.value === selectedSymbol.value}
                    onClick={() => setSelectedSymbol(sym)} />
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          TAB: POSITIONS
      ════════════════════════════════════════ */}
      {tab === "positions" && (
        <Card className="p-3">
          {openPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10">
              <Activity className="h-8 w-8 opacity-15" />
              <p className="text-xs font-mono" style={{ color: "hsl(218,12%,36%)" }}>No open positions</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {openPositions.map(t => {
                const diff   = livePrice - t.entryPrice;
                const pnl    = (t.side === "buy" ? diff : -diff) * t.size * t.leverage / t.entryPrice;
                const pnlPct = (pnl / t.margin) * 100;
                const isPos  = pnl >= 0;
                return (
                  <div key={t.id} className="rounded-xl p-3 border"
                    style={isPos
                      ? { background: "rgba(52,211,153,0.04)", borderColor: "rgba(52,211,153,0.14)" }
                      : { background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.14)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold"
                          style={t.side === "buy"
                            ? { background: "rgba(52,211,153,0.14)", color: "hsl(150,80%,62%)" }
                            : { background: "rgba(239,68,68,0.14)", color: "hsl(0,78%,65%)" }}>
                          {t.side.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono font-semibold" style={{ color: "hsl(218,14%,70%)" }}>
                          {DEMO_SYMBOLS.find(s => s.value === t.symbol)?.label}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: "hsl(38,95%,58%)" }}>{t.leverage}x</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-bold font-mono" style={{ color: isPos ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>
                            {isPos ? "+" : ""}{fmtUSD(pnl)}
                          </p>
                          <p className="text-[10px] font-mono" style={{ color: isPos ? "hsl(150,76%,52%)" : "hsl(0,74%,58%)" }}>
                            {fmtPct(pnlPct)}
                          </p>
                        </div>
                        <button
                          onClick={() => closePosition(t.id, livePrice)}
                          className="text-[10px] font-mono px-2 py-1 rounded-lg"
                          style={{ background: "rgba(239,68,68,0.1)", color: "hsl(0,78%,62%)", border: "1px solid rgba(239,68,68,0.2)" }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                      {[
                        { label: "Entry",   value: fmtPrice(t.entryPrice) },
                        { label: "Current", value: fmtPrice(livePrice) },
                        { label: "Margin",  value: fmtUSD(t.margin) },
                      ].map(r => (
                        <div key={r.label} className="flex flex-col gap-0.5">
                          <span style={{ color: "hsl(218,12%,38%)" }}>{r.label}</span>
                          <span style={{ color: "hsl(218,14%,65%)" }}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] font-mono mt-2" style={{ color: "hsl(218,12%,32%)" }}>
                      Opened {fmtTime(t.openTime)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ════════════════════════════════════════
          TAB: HISTORY
      ════════════════════════════════════════ */}
      {tab === "history" && (
        <Card className="p-3">
          {closedTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10">
              <Clock className="h-8 w-8 opacity-15" />
              <p className="text-xs font-mono" style={{ color: "hsl(218,12%,36%)" }}>No closed trades yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {closedTrades.map(t => {
                const isProfit = (t.pnl ?? 0) > 0;
                return (
                  <div key={t.id} className="rounded-xl p-3 border"
                    style={{ background: "rgba(255,255,255,0.022)", borderColor: "rgba(255,255,255,0.065)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold"
                          style={t.side === "buy"
                            ? { background: "rgba(52,211,153,0.1)", color: "hsl(150,80%,60%)" }
                            : { background: "rgba(239,68,68,0.1)", color: "hsl(0,78%,62%)" }}>
                          {t.side.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono font-semibold" style={{ color: "hsl(218,14%,70%)" }}>
                          {DEMO_SYMBOLS.find(s => s.value === t.symbol)?.label}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: "hsl(38,95%,58%)" }}>{t.leverage}x</span>
                      </div>
                      <span className="text-sm font-bold font-mono"
                        style={{ color: isProfit ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>
                        {isProfit ? "+" : ""}{fmtUSD(t.pnl ?? 0)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                      {[
                        { label: "Entry", value: fmtPrice(t.entryPrice) },
                        { label: "Exit",  value: fmtPrice(t.exitPrice ?? 0) },
                        { label: "P&L %", value: fmtPct(t.pnlPct ?? 0), color: isProfit ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" },
                      ].map(r => (
                        <div key={r.label} className="flex flex-col gap-0.5">
                          <span style={{ color: "hsl(218,12%,38%)" }}>{r.label}</span>
                          <span style={{ color: r.color ?? "hsl(218,14%,65%)" }}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] font-mono mt-2" style={{ color: "hsl(218,12%,32%)" }}>
                      {fmtTime(t.openTime)} → {t.closeTime ? fmtTime(t.closeTime) : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ════════════════════════════════════════
          TAB: ANALYTICS
      ════════════════════════════════════════ */}
      {tab === "analytics" && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Total Trades",    value: String(closedTrades.length),  color: "hsl(218,14%,80%)" },
            { label: "Win Rate",        value: closedTrades.length ? `${winRate.toFixed(0)}%` : "—", color: winRate >= 50 ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" },
            { label: "Profitable",      value: String(wins),                 color: "hsl(150,80%,55%)" },
            { label: "Losses",          value: String(losses_),              color: "hsl(0,78%,60%)" },
            { label: "Realized P&L",    value: (totalRealizedPnl >= 0 ? "+" : "") + fmtUSD(totalRealizedPnl), color: totalRealizedPnl >= 0 ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" },
            { label: "Open Equity PnL", value: (totalOpenPnl >= 0 ? "+" : "") + fmtUSD(totalOpenPnl), color: totalOpenPnl >= 0 ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" },
          ].map(s => (
            <Card key={s.label} className="p-3 flex flex-col gap-0.5">
              <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(218,12%,34%)" }}>{s.label}</p>
              <p className="text-base font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────── */
export default function DemoPage() {
  const [startBalance, setStartBalance] = useState<number | null>(null);

  if (!startBalance) {
    return <SetupScreen onStart={setStartBalance} />;
  }

  return <TradingInterface initialBalance={startBalance} onReset={() => setStartBalance(null)} />;
}
