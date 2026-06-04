import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2, Search, TrendingUp, TrendingDown, Minus,
  RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown,
  Filter, Clock, Globe, AlertTriangle, Calendar,
  Calculator, Activity, Zap, RotateCcw, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  text:    "hsl(var(--foreground))",
  sub:     "hsl(var(--muted-foreground))",
  muted:   "hsl(var(--muted-foreground))",
  border:  "var(--glass-border)",
  surface: "var(--card-bg)",
  pos:     "#4ade80",
  neg:     "#f87171",
  amber:   "#fbbf24",
  blue:    "#4DA3FF",
};
const CARD: React.CSSProperties = {
  background: "var(--card-bg)",
  border: "1px solid var(--glass-border)",
  borderRadius: "14px",
  boxShadow: "var(--shadow-card)",
};

// ── Tiny helpers ────────────────────────────────────────────────────────────
function fmtPct(v: number, sign = true) {
  return `${sign && v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtPrice(v: number) {
  if (v < 0.00001) return v.toFixed(8);
  if (v < 0.01)    return v.toFixed(6);
  if (v < 1)       return v.toFixed(4);
  if (v < 100)     return v.toFixed(2);
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function fmtVol(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}
function Skel({ w = "100%", h = 16 }: { w?: string | number; h?: number }) {
  return <div className="animate-pulse rounded" style={{ width: w, height: h, background: "rgba(0,0,0,0.07)" }} />;
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: C.muted }}>{children}</p>;
}
function PctBadge({ v }: { v: number }) {
  const color = v > 0 ? C.pos : v < 0 ? C.neg : C.muted;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{ color }}>
      {v > 0 ? <TrendingUp className="h-3 w-3" /> : v < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {fmtPct(v)}
    </span>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "screener",    label: "Screener",         icon: Search },
  { id: "heatmap",     label: "Heat Map",          icon: BarChart2 },
  { id: "depth",       label: "Depth Chart",       icon: Activity },
  { id: "correlation", label: "Correlation",       icon: TrendingUp },
  { id: "calendar",    label: "Econ Calendar",     icon: Calendar },
  { id: "calculator",  label: "Risk Calculator",   icon: Calculator },
  { id: "funding",     label: "Funding Rates",     icon: Zap },
] as const;
type TabId = (typeof TABS)[number]["id"];

// ══════════════════════════════════════════════════════════════════════════════
// 1. SCREENER
// ══════════════════════════════════════════════════════════════════════════════
type ScreenerRow = {
  symbol: string; name: string; ticker: string; sector: string; mcapRank: number;
  price: number; change24h: number; change7d: number; volume24h: number;
  rsi: number; rsiSignal: string; macd: string; trend: string; bbPosition: number; vwap: number;
  assetType?: string; dataSource?: "live" | "simulated";
};
type SortKey = keyof ScreenerRow;

function heatColor(v: number, min = -5, max = 5) {
  const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
  if (t < 0.5) {
    const r = Math.round(220 + (247 - 220) * (t / 0.5));
    const g = Math.round(38 + (200 - 38) * (t / 0.5));
    const b = Math.round(38 + (38 - 38) * (t / 0.5));
    return `rgb(${r},${g},${b})`;
  } else {
    const u = (t - 0.5) / 0.5;
    const r = Math.round(247 + (22 - 247) * u);
    const g = Math.round(200 + (163 - 200) * u);
    const b = Math.round(38 + (74 - 38) * u);
    return `rgb(${r},${g},${b})`;
  }
}

function ScreenerTab() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("mcapRank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterRsi, setFilterRsi] = useState("all");
  const [filterMacd, setFilterMacd] = useState("all");
  const [filterTrend, setFilterTrend] = useState("all");
  const [filterAssetType, setFilterAssetType] = useState("all");

  const { data, isLoading, refetch, isFetching } = useQuery<ScreenerRow[]>({
    queryKey: ["tools-screener"],
    queryFn: () => fetch("/api/tools/screener").then(r => r.json()),
    refetchInterval: 30_000,
  });

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }, [sortKey]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data
      .filter(r => {
        const q = search.toLowerCase();
        if (q && !r.ticker.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false;
        if (filterRsi === "overbought" && r.rsiSignal !== "overbought") return false;
        if (filterRsi === "oversold"   && r.rsiSignal !== "oversold")   return false;
        if (filterMacd !== "all"       && r.macd !== filterMacd)        return false;
        if (filterTrend !== "all"      && r.trend !== filterTrend)      return false;
        if (filterAssetType !== "all"  && r.assetType !== filterAssetType) return false;
        return true;
      })
      .sort((a, b) => {
        const av = a[sortKey] as number | string;
        const bv = b[sortKey] as number | string;
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [data, search, sortKey, sortDir, filterRsi, filterMacd, filterTrend]);

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  const Col = ({ k, children, right = false }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th
      className={`px-3 py-2.5 text-[11px] font-medium cursor-pointer select-none whitespace-nowrap ${right ? "text-right" : "text-left"}`}
      style={{ color: sortKey === k ? C.text : C.muted }}
      onClick={() => handleSort(k)}
    >
      <span className="inline-flex items-center gap-1">{children}<SortIcon k={k} /></span>
    </th>
  );

  const signalPill = (label: string, color: string) => (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>{label}</span>
  );

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5" style={{ color: C.muted }} />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search asset…"
            className="pl-7 h-8 text-xs" style={{ border: `1px solid ${C.border}` }} />
        </div>
        <select value={filterRsi} onChange={e => setFilterRsi(e.target.value)}
          className="h-8 text-xs px-2.5 rounded-lg" style={{ border: `1px solid ${C.border}`, background: "var(--card-bg)", color: C.sub }}>
          <option value="all">RSI: All</option>
          <option value="overbought">Overbought (≥70)</option>
          <option value="oversold">Oversold (≤30)</option>
        </select>
        <select value={filterMacd} onChange={e => setFilterMacd(e.target.value)}
          className="h-8 text-xs px-2.5 rounded-lg" style={{ border: `1px solid ${C.border}`, background: "var(--card-bg)", color: C.sub }}>
          <option value="all">MACD: All</option>
          <option value="bullish">Bullish</option>
          <option value="bearish">Bearish</option>
          <option value="neutral">Neutral</option>
        </select>
        <select value={filterTrend} onChange={e => setFilterTrend(e.target.value)}
          className="h-8 text-xs px-2.5 rounded-lg" style={{ border: `1px solid ${C.border}`, background: "var(--card-bg)", color: C.sub }}>
          <option value="all">Trend: All</option>
          <option value="bullish">Bullish</option>
          <option value="bearish">Bearish</option>
        </select>
        <select value={filterAssetType} onChange={e => setFilterAssetType(e.target.value)}
          className="h-8 text-xs px-2.5 rounded-lg" style={{ border: `1px solid ${C.border}`, background: "var(--card-bg)", color: C.sub }}>
          <option value="all">Type: All</option>
          <option value="crypto">Crypto</option>
          <option value="forex">Forex</option>
          <option value="stock">Stocks</option>
          <option value="index">Indices</option>
          <option value="commodity">Commodity</option>
        </select>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}
          className="h-8 px-3 text-xs gap-1.5" style={{ border: `1px solid ${C.border}` }}>
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${C.border}` }}>
        <table className="w-full text-sm">
          <thead style={{ background: C.surface }}>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <Col k="mcapRank">#</Col>
              <Col k="ticker">Asset</Col>
              <Col k="price" right>Price</Col>
              <Col k="change24h" right>24h %</Col>
              <Col k="change7d" right>7d %</Col>
              <Col k="volume24h" right>Volume</Col>
              <Col k="rsi" right>RSI</Col>
              <th className="px-3 py-2.5 text-[11px] font-medium text-left" style={{ color: C.muted }}>MACD</th>
              <th className="px-3 py-2.5 text-[11px] font-medium text-left" style={{ color: C.muted }}>Trend</th>
              <Col k="bbPosition" right>BB%</Col>
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                {Array.from({ length: 10 }).map((__, j) => (
                  <td key={j} className="px-3 py-2.5"><Skel /></td>
                ))}
              </tr>
            )) : rows.map((r, i) => (
              <tr key={r.symbol}
                className="transition-colors hover:bg-black/[0.02]"
                style={{ borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <td className="px-3 py-2.5 text-[11px]" style={{ color: C.muted }}>{r.mcapRank}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold" style={{ color: C.text }}>{r.ticker}</span>
                        {r.dataSource === "live" && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}>
                            <span className="h-1 w-1 rounded-full bg-green-500 animate-pulse inline-block" />LIVE
                          </span>
                        )}
                      </div>
                      <span className="text-[10px]" style={{ color: C.muted }}>{r.sector}</span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-[12px] font-mono font-medium" style={{ color: C.text }}>${fmtPrice(r.price)}</td>
                <td className="px-3 py-2.5 text-right"><PctBadge v={r.change24h} /></td>
                <td className="px-3 py-2.5 text-right"><PctBadge v={r.change7d} /></td>
                <td className="px-3 py-2.5 text-right text-[11px]" style={{ color: C.sub }}>{fmtVol(r.volume24h)}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className="text-[12px] font-mono font-medium"
                    style={{ color: r.rsi >= 70 ? C.neg : r.rsi <= 30 ? C.pos : C.text }}>
                    {r.rsi.toFixed(1)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {r.macd === "bullish"  && signalPill("Bullish", C.pos)}
                  {r.macd === "bearish"  && signalPill("Bearish", C.neg)}
                  {r.macd === "neutral"  && signalPill("Neutral", C.muted)}
                </td>
                <td className="px-3 py-2.5">
                  {r.trend === "bullish" ? signalPill("↑ Bull", C.pos) : signalPill("↓ Bear", C.neg)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="h-1.5 w-14 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${r.bbPosition}%`, background: r.bbPosition > 80 ? C.neg : r.bbPosition < 20 ? C.pos : C.blue }} />
                    </div>
                    <span className="text-[10px] font-mono w-8 text-right" style={{ color: C.sub }}>{r.bbPosition.toFixed(0)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] mt-2" style={{ color: C.muted }}>{rows.length} assets · Simulated data · Auto-refreshes every 30s</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. HEAT MAP
// ══════════════════════════════════════════════════════════════════════════════
type HeatCell = {
  symbol: string; ticker: string; name: string; sector: string;
  price: number; change1h: number; change4h: number; change24h: number; change7d: number; change30d: number;
  marketCapB: number; mcapRank: number;
};

function HeatMapTab() {
  const [period, setPeriod] = useState<"change1h"|"change4h"|"change24h"|"change7d"|"change30d">("change24h");
  const { data, isLoading, refetch, isFetching } = useQuery<HeatCell[]>({
    queryKey: ["tools-heatmap"],
    queryFn: () => fetch("/api/tools/heatmap").then(r => r.json()),
    refetchInterval: 60_000,
  });

  const periods = [
    { key: "change1h" as const,  label: "1H" },
    { key: "change4h" as const,  label: "4H" },
    { key: "change24h" as const, label: "24H" },
    { key: "change7d" as const,  label: "7D" },
    { key: "change30d" as const, label: "30D" },
  ];

  const sectors = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, HeatCell[]>();
    data.forEach(c => {
      if (!map.has(c.sector)) map.set(c.sector, []);
      map.get(c.sector)!.push(c);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const avgA = a[1].reduce((s, x) => s + Math.abs(x[period]), 0) / a[1].length;
      const avgB = b[1].reduce((s, x) => s + Math.abs(x[period]), 0) / b[1].length;
      return avgB - avgA;
    });
  }, [data, period]);

  function cellBg(v: number) {
    if (v === 0) return "var(--glass-bg)";
    const abs = Math.min(Math.abs(v), 8) / 8;
    const alpha = 0.15 + abs * 0.7;
    return v > 0 ? `rgba(74,222,128,${alpha})` : `rgba(248,113,113,${alpha})`;
  }
  function cellText(v: number) {
    const abs = Math.min(Math.abs(v), 8) / 8;
    return abs > 0.5 ? "#fff" : C.text;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          {periods.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={period === p.key ? { background: "var(--card-bg)", color: C.text, boxShadow: "var(--shadow-tab-active)" } : { color: C.muted }}>
              {p.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}
          className="h-8 px-3 text-xs gap-1.5" style={{ border: `1px solid ${C.border}` }}>
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 20 }).map((_, i) => <Skel key={i} h={80} />)}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {sectors.map(([sector, cells]) => (
            <div key={sector}>
              <SectionLabel>{sector}</SectionLabel>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}>
                {cells.sort((a, b) => b.marketCapB - a.marketCapB).map(c => {
                  const v = c[period];
                  return (
                    <div key={c.symbol} className="rounded-xl p-3 flex flex-col gap-1 cursor-default select-none transition-transform hover:scale-[1.02]"
                      style={{ background: cellBg(v), border: "1px solid rgba(0,0,0,0.06)" }}>
                      <span className="text-[13px] font-bold" style={{ color: cellText(v) }}>{c.ticker}</span>
                      <span className="text-[10px]" style={{ color: cellText(v), opacity: 0.75 }}>${c.marketCapB}B</span>
                      <span className="text-[12px] font-semibold font-mono" style={{ color: cellText(v) }}>
                        {v >= 0 ? "+" : ""}{v.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-5">
        <span className="text-[10px]" style={{ color: C.muted }}>Strong sell</span>
        <div className="flex h-3 flex-1 max-w-[160px] rounded-full overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="flex-1" style={{ background: cellBg(((i / 19) * 16) - 8) }} />
          ))}
        </div>
        <span className="text-[10px]" style={{ color: C.muted }}>Strong buy</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. DEPTH CHART
// ══════════════════════════════════════════════════════════════════════════════
const DEPTH_SYMBOLS = [
  "BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT",
  "ADAUSDT","DOGEUSDT","AVAXUSDT","LINKUSDT","LTCUSDT",
];

type DepthLevel = { price: number; size: number; total: number };
type DepthData  = { symbol: string; ticker: string; midPrice: number; bids: DepthLevel[]; asks: DepthLevel[] };

function DepthTab() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const { data, isLoading, refetch, isFetching } = useQuery<DepthData>({
    queryKey: ["tools-depth", symbol],
    queryFn: () => fetch(`/api/tools/depth/${symbol}`).then(r => r.json()),
    refetchInterval: 15_000,
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    const bids = [...data.bids].reverse().map(b => ({ price: b.price, bid: b.total,  ask: 0 }));
    const asks = data.asks.map(a => ({ price: a.price, bid: 0, ask: a.total }));
    return [...bids, ...asks];
  }, [data]);

  const maxTotal = useMemo(() => {
    if (!data) return 1;
    const maxBid = data.bids[0]?.total ?? 0;
    const maxAsk = data.asks[data.asks.length - 1]?.total ?? 0;
    return Math.max(maxBid, maxAsk);
  }, [data]);

  const spread = useMemo(() => {
    if (!data || !data.asks[0] || !data.bids[0]) return null;
    const s = data.asks[0].price - data.bids[0].price;
    const pct = (s / data.midPrice * 100).toFixed(4);
    return { abs: s.toFixed(data.midPrice < 1 ? 6 : 2), pct };
  }, [data]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <select value={symbol} onChange={e => setSymbol(e.target.value)}
          className="h-9 text-sm px-3 rounded-xl font-medium" style={{ border: `1px solid ${C.border}`, background: "var(--card-bg)", color: C.text }}>
          {DEPTH_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {data && (
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px]" style={{ color: C.muted }}>Mid Price</p>
              <p className="text-sm font-semibold font-mono" style={{ color: C.text }}>${fmtPrice(data.midPrice)}</p>
            </div>
            {spread && (
              <div>
                <p className="text-[10px]" style={{ color: C.muted }}>Spread</p>
                <p className="text-sm font-semibold font-mono" style={{ color: C.amber }}>{spread.pct}%</p>
              </div>
            )}
          </div>
        )}
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}
          className="h-8 px-3 text-xs gap-1.5 ml-auto" style={{ border: `1px solid ${C.border}` }}>
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? <Skel h={280} /> : (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 16, right: 16, bottom: 8, left: 8 }} barCategoryGap={0}>
              <XAxis dataKey="price" tick={{ fontSize: 10, fill: C.muted }} tickLine={false}
                tickFormatter={v => fmtPrice(Number(v))} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false}
                tickFormatter={v => v.toFixed(2)} domain={[0, maxTotal * 1.1]} />
              <Tooltip
                contentStyle={{ background: "var(--card-bg)", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }}
                formatter={(value: number, name: string) => [`${value.toFixed(4)}`, name === "bid" ? "Bid Depth" : "Ask Depth"]}
                labelFormatter={v => `$${fmtPrice(Number(v))}`}
              />
              <Bar dataKey="bid" fill={C.pos} opacity={0.85} />
              <Bar dataKey="ask" fill={C.neg} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Order book table */}
      {data && (
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            <div className="px-3 py-2 flex justify-between text-[11px] font-medium" style={{ borderBottom: `1px solid ${C.border}`, background: C.surface, color: C.muted }}>
              <span>Price</span><span>Size</span><span>Total</span>
            </div>
            {data.bids.slice(0, 10).map((b, i) => (
              <div key={i} className="px-3 py-1.5 flex justify-between text-[11px] font-mono relative"
                style={{ borderBottom: i < 9 ? `1px solid ${C.border}` : "none" }}>
                <div className="absolute inset-y-0 right-0 opacity-10 rounded-sm" style={{ background: C.pos, width: `${(b.total / maxTotal) * 100}%` }} />
                <span style={{ color: C.pos }}>${fmtPrice(b.price)}</span>
                <span style={{ color: C.sub }}>{b.size.toFixed(4)}</span>
                <span style={{ color: C.muted }}>{b.total.toFixed(3)}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            <div className="px-3 py-2 flex justify-between text-[11px] font-medium" style={{ borderBottom: `1px solid ${C.border}`, background: C.surface, color: C.muted }}>
              <span>Price</span><span>Size</span><span>Total</span>
            </div>
            {data.asks.slice(0, 10).map((a, i) => (
              <div key={i} className="px-3 py-1.5 flex justify-between text-[11px] font-mono relative"
                style={{ borderBottom: i < 9 ? `1px solid ${C.border}` : "none" }}>
                <div className="absolute inset-y-0 left-0 opacity-10 rounded-sm" style={{ background: C.neg, width: `${(a.total / maxTotal) * 100}%` }} />
                <span style={{ color: C.neg }}>${fmtPrice(a.price)}</span>
                <span style={{ color: C.sub }}>{a.size.toFixed(4)}</span>
                <span style={{ color: C.muted }}>{a.total.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. CORRELATION MATRIX
// ══════════════════════════════════════════════════════════════════════════════
type CorrData = { assets: { symbol: string; ticker: string; name: string }[]; matrix: number[][]; timeframe: string };

function corrColor(v: number) {
  if (v === 1) return { bg: "rgba(77,163,255,0.18)", text: C.blue };
  if (v > 0.7)  return { bg: "rgba(74,222,128,0.18)", text: C.pos };
  if (v > 0.3)  return { bg: "rgba(74,222,128,0.08)", text: C.pos };
  if (v > -0.3) return { bg: "var(--glass-bg)", text: C.sub };
  if (v > -0.7) return { bg: "rgba(248,113,113,0.08)", text: C.neg };
  return           { bg: "rgba(248,113,113,0.18)", text: C.neg };
}

function CorrelationTab() {
  const [tf, setTf] = useState("30d");
  const { data, isLoading } = useQuery<CorrData>({
    queryKey: ["tools-correlation", tf],
    queryFn: () => fetch(`/api/tools/correlation?timeframe=${tf}`).then(r => r.json()),
    refetchInterval: 120_000,
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[11px]" style={{ color: C.muted }}>Timeframe:</span>
        {["7d","30d","90d"].map(t => (
          <button key={t} onClick={() => setTf(t)}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            style={tf === t ? { background: "#4DA3FF", color: "#050505" } : { background: C.surface, color: C.sub, border: `1px solid ${C.border}` }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {isLoading ? <Skel h={400} /> : data && (
        <div>
          <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${C.border}` }}>
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-[11px] font-medium text-left sticky left-0 z-10"
                    style={{ background: C.surface, color: C.muted, minWidth: 70, borderBottom: `1px solid ${C.border}` }} />
                  {data.assets.map(a => (
                    <th key={a.symbol} className="px-3 py-2 text-[11px] font-semibold text-center"
                      style={{ background: C.surface, color: C.text, minWidth: 56, borderBottom: `1px solid ${C.border}` }}>
                      {a.ticker}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.assets.map((rowAsset, i) => (
                  <tr key={rowAsset.symbol}>
                    <td className="px-3 py-2 text-[12px] font-semibold sticky left-0 z-10"
                      style={{ background: C.surface, color: C.text, borderBottom: i < data.assets.length - 1 ? `1px solid ${C.border}` : "none", borderRight: `1px solid ${C.border}` }}>
                      {rowAsset.ticker}
                    </td>
                    {data.matrix[i].map((v, j) => {
                      const { bg, text } = corrColor(v);
                      return (
                        <td key={j} className="px-1 py-1 text-center"
                          style={{ borderBottom: i < data.assets.length - 1 ? `1px solid ${C.border}` : "none" }}>
                          <div className="flex items-center justify-center rounded-lg text-[11px] font-mono font-semibold w-12 h-8 mx-auto"
                            style={{ background: bg, color: text }}>
                            {v === 1 ? "1.0" : v.toFixed(2)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4">
            {[
              { label: "Strong positive (>0.7)", bg: "rgba(74,222,128,0.18)", text: C.pos },
              { label: "Mild positive (0.3–0.7)", bg: "rgba(74,222,128,0.08)", text: C.pos },
              { label: "Neutral (−0.3–0.3)", bg: "var(--glass-bg)", text: C.sub },
              { label: "Mild negative (−0.3–−0.7)", bg: "rgba(248,113,113,0.08)", text: C.neg },
              { label: "Strong negative (<−0.7)", bg: "rgba(248,113,113,0.18)", text: C.neg },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="h-4 w-10 rounded" style={{ background: l.bg, border: "1px solid var(--glass-border)" }} />
                <span className="text-[10px]" style={{ color: C.muted }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. ECONOMIC CALENDAR
// ══════════════════════════════════════════════════════════════════════════════
type CalEvent = {
  id: string; timestamp: number; date: string; time: string;
  country: string; flag: string; event: string; currency: string;
  impact: "high" | "medium" | "low"; category: string;
  previous: string; forecast: string; actual: string | null; surprise: "beat" | "miss" | "inline" | null;
};

function CalendarTab() {
  const [filterImpact, setFilterImpact] = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const { data, isLoading } = useQuery<CalEvent[]>({
    queryKey: ["tools-calendar"],
    queryFn: () => fetch("/api/tools/calendar").then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  const now = Date.now();

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter(e => {
      if (filterImpact !== "all" && e.impact !== filterImpact) return false;
      if (filterCurrency !== "all" && e.currency !== filterCurrency) return false;
      return true;
    });
  }, [data, filterImpact, filterCurrency]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    filtered.forEach(e => {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    });
    return Array.from(map.entries());
  }, [filtered]);

  function ImpactDot({ v }: { v: string }) {
    const colors = { high: C.neg, medium: C.amber, low: "#4ade80" };
    return <span className="inline-block h-2 w-2 rounded-full flex-shrink-0" style={{ background: colors[v as keyof typeof colors] ?? C.muted }} />;
  }

  function SurpriseBadge({ v }: { v: string | null }) {
    if (!v || v === "inline") return null;
    const ok = v === "beat";
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: ok ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)", color: ok ? C.pos : C.neg }}>{ok ? "BEAT" : "MISS"}</span>;
  }

  const currencies = ["USD","EUR","GBP","JPY","AUD","CAD","CNY"];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterImpact} onChange={e => setFilterImpact(e.target.value)}
          className="h-8 text-xs px-2.5 rounded-lg" style={{ border: `1px solid ${C.border}`, background: "var(--card-bg)", color: C.sub }}>
          <option value="all">All Impact</option>
          <option value="high">🔴 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
        <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value)}
          className="h-8 text-xs px-2.5 rounded-lg" style={{ border: `1px solid ${C.border}`, background: "var(--card-bg)", color: C.sub }}>
          <option value="all">All Currencies</option>
          {currencies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skel key={i} h={56} />)}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(([date, events]) => {
            const d = new Date(date + "T12:00:00Z");
            const isToday = date === new Date().toISOString().split("T")[0];
            const isPast  = d < new Date(now - 86_400_000);
            return (
              <div key={date}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-semibold"
                    style={{ color: isToday ? C.blue : isPast ? C.muted : C.text }}>
                    {isToday ? "Today — " : ""}{d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  {isToday && <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.blue }} />}
                </div>
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  {events.map((e, i) => {
                    const isPastEvent = e.timestamp < now;
                    const isNext      = !isPastEvent && events.slice(0, i).every(x => x.timestamp < now);
                    return (
                      <div key={e.id}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{
                          borderBottom: i < events.length - 1 ? `1px solid ${C.border}` : "none",
                          background: isNext ? "rgba(37,99,235,0.02)" : isPastEvent ? "transparent" : "transparent",
                          opacity: isPastEvent ? 0.7 : 1,
                        }}>
                        {isNext && <div className="w-0.5 h-full absolute left-0 top-0 rounded-r" style={{ background: C.blue }} />}
                        <ImpactDot v={e.impact} />
                        <span className="text-[11px] font-mono w-10 flex-shrink-0" style={{ color: C.muted }}>{e.time}</span>
                        <span className="text-lg flex-shrink-0">{e.flag}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] font-medium truncate" style={{ color: C.text }}>{e.event}</span>
                          <span className="text-[10px] ml-2" style={{ color: C.muted }}>{e.category}</span>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-[9px]" style={{ color: C.muted }}>Prev</p>
                            <p className="text-[11px] font-mono" style={{ color: C.sub }}>{e.previous}</p>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-[9px]" style={{ color: C.muted }}>Forecast</p>
                            <p className="text-[11px] font-mono" style={{ color: C.sub }}>{e.forecast}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px]" style={{ color: C.muted }}>Actual</p>
                            {e.actual ? (
                              <div className="flex items-center gap-1 justify-end">
                                <p className="text-[11px] font-mono font-semibold" style={{ color: e.surprise === "beat" ? C.pos : e.surprise === "miss" ? C.neg : C.text }}>
                                  {e.actual}
                                </p>
                                <SurpriseBadge v={e.surprise} />
                              </div>
                            ) : (
                              <p className="text-[11px]" style={{ color: C.muted }}>—</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. POSITION SIZE & RISK CALCULATOR
// ══════════════════════════════════════════════════════════════════════════════
function CalculatorTab() {
  const [accountSize,  setAccountSize]  = useState("10000");
  const [riskPct,      setRiskPct]      = useState("1");
  const [entryPrice,   setEntryPrice]   = useState("67420");
  const [stopLoss,     setStopLoss]     = useState("66000");
  const [takeProfit,   setTakeProfit]   = useState("70000");
  const [leverage,     setLeverage]     = useState("1");
  const [side,         setSide]         = useState<"long" | "short">("long");

  const calc = useMemo(() => {
    const acc   = parseFloat(accountSize) || 0;
    const risk  = parseFloat(riskPct)     / 100 || 0;
    const entry = parseFloat(entryPrice)  || 0;
    const sl    = parseFloat(stopLoss)    || 0;
    const tp    = parseFloat(takeProfit)  || 0;
    const lev   = parseFloat(leverage)    || 1;
    if (!acc || !entry || !sl || entry === sl) return null;

    const riskDollar     = acc * risk;
    const slPctPerUnit   = Math.abs(entry - sl) / entry;
    const slPctLevered   = slPctPerUnit * lev;
    const positionSize   = riskDollar / (acc * slPctLevered);   // as fraction of account
    const positionDollar = acc * positionSize;
    const units          = positionDollar / entry;

    const tpPctPerUnit = tp && entry ? Math.abs(tp - entry) / entry : 0;
    const rrRatio      = slPctPerUnit > 0 ? tpPctPerUnit / slPctPerUnit : 0;

    const breakEvenWinRate = rrRatio > 0 ? 1 / (1 + rrRatio) : 0;

    const requiredMargin = positionDollar / lev;
    const pnlTP          = units * (tp - entry) * (side === "long" ? 1 : -1);
    const pnlSL          = units * (sl - entry) * (side === "long" ? 1 : -1);

    return {
      riskDollar,
      positionSize,
      positionDollar,
      units,
      rrRatio,
      breakEvenWinRate: breakEvenWinRate * 100,
      requiredMargin,
      pnlTP,
      pnlSL: Math.abs(pnlSL),
      slPct: slPctPerUnit * 100,
      tpPct: tpPctPerUnit * 100,
    };
  }, [accountSize, riskPct, entryPrice, stopLoss, takeProfit, leverage, side]);

  function Field({ label, value, onChange, prefix = "$", step = "any", note = "" }: {
    label: string; value: string; onChange: (v: string) => void;
    prefix?: string; step?: string; note?: string;
  }) {
    return (
      <div>
        <label className="block text-[11px] font-medium mb-1" style={{ color: C.sub }}>{label}</label>
        <div className="relative">
          {prefix && <span className="absolute left-3 top-2.5 text-xs" style={{ color: C.muted }}>{prefix}</span>}
          <Input type="number" step={step} value={value} onChange={e => onChange(e.target.value)}
            className={`h-9 text-sm font-mono ${prefix ? "pl-6" : "pl-3"}`}
            style={{ border: `1px solid ${C.border}` }} />
        </div>
        {note && <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{note}</p>}
      </div>
    );
  }

  function ResultRow({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
    return (
      <div className="flex items-center justify-between py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
        <span className="text-[12px]" style={{ color: C.sub }}>{label}</span>
        <div className="text-right">
          <span className="text-[14px] font-semibold font-mono"
            style={{ color: positive === true ? C.pos : positive === false ? C.neg : C.text }}>{value}</span>
          {sub && <p className="text-[10px]" style={{ color: C.muted }}>{sub}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Inputs */}
      <div className="rounded-2xl p-5 flex flex-col gap-4" style={CARD}>
        <SectionLabel>Trade Setup</SectionLabel>

        {/* Side selector */}
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: C.sub }}>Direction</label>
          <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            <button onClick={() => setSide("long")} className="flex-1 py-2 text-sm font-semibold transition-colors"
              style={{ background: side === "long" ? "rgba(22,163,74,0.12)" : "var(--card-bg)", color: side === "long" ? C.pos : C.muted, border: `1px solid ${C.border}` }}>
              Long ↑
            </button>
            <button onClick={() => setSide("short")} className="flex-1 py-2 text-sm font-semibold transition-colors"
              style={{ background: side === "short" ? "rgba(220,38,38,0.12)" : "var(--card-bg)", color: side === "short" ? C.neg : C.muted, border: `1px solid ${C.border}` }}>
              Short ↓
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Account Size" value={accountSize} onChange={setAccountSize} />
          <Field label="Risk per Trade" value={riskPct} onChange={setRiskPct} prefix="%" step="0.1" note="% of account" />
        </div>
        <Field label="Entry Price" value={entryPrice} onChange={setEntryPrice} />
        <Field label="Stop Loss Price" value={stopLoss} onChange={setStopLoss} />
        <Field label="Take Profit Price" value={takeProfit} onChange={setTakeProfit} />
        <Field label="Leverage" value={leverage} onChange={setLeverage} prefix="×" step="1" note="1× = no leverage" />

        <Button variant="ghost" className="h-8 gap-1.5 text-xs self-start" style={{ border: `1px solid ${C.border}` }}
          onClick={() => { setAccountSize("10000"); setRiskPct("1"); setEntryPrice("67420"); setStopLoss("66000"); setTakeProfit("70000"); setLeverage("1"); setSide("long"); }}>
          <RotateCcw className="h-3 w-3" /> Reset
        </Button>
      </div>

      {/* Results */}
      <div className="rounded-2xl p-5 flex flex-col" style={CARD}>
        <SectionLabel>Position Summary</SectionLabel>
        {!calc ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: C.muted }}>
            Enter entry price and stop loss to calculate
          </div>
        ) : (
          <div className="flex flex-col">
            <ResultRow label="Risk Amount" value={`$${calc.riskDollar.toFixed(2)}`} sub={`${riskPct}% of account`} />
            <ResultRow label="Position Size" value={`$${calc.positionDollar.toFixed(2)}`} sub={`${(calc.positionSize * 100).toFixed(1)}% of account`} />
            <ResultRow label="Units / Contracts" value={calc.units.toFixed(calc.units < 1 ? 6 : 4)} />
            <ResultRow label="Stop Loss Distance" value={`${calc.slPct.toFixed(2)}%`} positive={false} />
            {parseFloat(takeProfit) > 0 && (
              <>
                <ResultRow label="Take Profit Distance" value={`${calc.tpPct.toFixed(2)}%`} positive={true} />
                <ResultRow label="Risk / Reward Ratio" value={`1 : ${calc.rrRatio.toFixed(2)}`} positive={calc.rrRatio >= 1.5} />
                <ResultRow label="Max Profit (TP)" value={`+$${calc.pnlTP.toFixed(2)}`} positive={true} />
                <ResultRow label="Break-even Win Rate" value={`${calc.breakEvenWinRate.toFixed(1)}%`} />
              </>
            )}
            <ResultRow label="Max Loss (SL)" value={`-$${calc.pnlSL.toFixed(2)}`} positive={false} />
            {parseFloat(leverage) > 1 && (
              <ResultRow label="Required Margin" value={`$${calc.requiredMargin.toFixed(2)}`} />
            )}

            {/* R:R visual */}
            {calc.rrRatio > 0 && (
              <div className="mt-4 rounded-xl p-3" style={{ background: "rgba(0,0,0,0.03)", border: `1px solid ${C.border}` }}>
                <p className="text-[10px] mb-2" style={{ color: C.muted }}>Risk / Reward Visual</p>
                <div className="flex h-5 rounded-lg overflow-hidden gap-0.5">
                  <div className="rounded-l-lg flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: C.neg, width: `${100 / (1 + calc.rrRatio)}%` }}>
                    1×
                  </div>
                  <div className="rounded-r-lg flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: C.pos, width: `${100 * calc.rrRatio / (1 + calc.rrRatio)}%` }}>
                    {calc.rrRatio.toFixed(1)}×
                  </div>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px]" style={{ color: C.neg }}>Risk: ${calc.pnlSL.toFixed(0)}</span>
                  <span className="text-[9px]" style={{ color: C.pos }}>Reward: ${calc.pnlTP.toFixed(0)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. FUNDING RATES
// ══════════════════════════════════════════════════════════════════════════════
type FundingRate = {
  symbol: string; ticker: string; name: string; price: number;
  currentRate: number; currentRatePct: number; h8avg: number; d7avg: number;
  annualizedPct: number; nextFundingMs: number; openInterestM: number;
  sentiment: "long_biased" | "short_biased" | "neutral";
};
type FundingData = { rates: FundingRate[]; updatedAt: number };

function FundingTab() {
  const [sortKey, setSortKey] = useState<keyof FundingRate>("annualizedPct");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const { data, isLoading, refetch, isFetching } = useQuery<FundingData>({
    queryKey: ["tools-funding"],
    queryFn: () => fetch("/api/tools/funding-rates").then(r => r.json()),
    refetchInterval: 30_000,
  });

  const [countdown, setCountdown] = React.useState("");
  React.useEffect(() => {
    if (!data?.rates[0]) return;
    const target = data.rates[0].nextFundingMs;
    const id = setInterval(() => {
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown("00:00:00"); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setCountdown(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    }, 1000);
    return () => clearInterval(id);
  }, [data]);

  const rows = useMemo(() => {
    if (!data?.rates) return [];
    return [...data.rates].sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [data, sortKey, sortDir]);

  function handleSort(k: keyof FundingRate) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  function SortIcon({ k }: { k: keyof FundingRate }) {
    if (sortKey !== k) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }
  function TH({ k, children, right = false }: { k: keyof FundingRate; children: React.ReactNode; right?: boolean }) {
    return (
      <th className={`px-3 py-2.5 text-[11px] font-medium cursor-pointer select-none whitespace-nowrap ${right ? "text-right" : "text-left"}`}
        style={{ color: sortKey === k ? C.text : C.muted }} onClick={() => handleSort(k)}>
        <span className="inline-flex items-center gap-1">{children}<SortIcon k={k} /></span>
      </th>
    );
  }

  function SentimentBadge({ v }: { v: string }) {
    if (v === "long_biased")  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(220,38,38,0.1)", color: C.neg }}>Longs Pay</span>;
    if (v === "short_biased") return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(22,163,74,0.1)", color: C.pos }}>Shorts Pay</span>;
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.05)", color: C.muted }}>Neutral</span>;
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-5">
        {countdown && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <Clock className="h-3.5 w-3.5" style={{ color: C.muted }} />
            <div>
              <p className="text-[9px]" style={{ color: C.muted }}>Next Funding</p>
              <p className="text-sm font-mono font-semibold" style={{ color: C.text }}>{countdown}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: C.muted }}>
          <Activity className="h-3 w-3" />
          Funding every 8h — perpetual futures
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}
          className="h-8 px-3 text-xs gap-1.5 ml-auto" style={{ border: `1px solid ${C.border}` }}>
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${C.border}` }}>
        <table className="w-full text-sm">
          <thead style={{ background: C.surface }}>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <TH k="ticker">Asset</TH>
              <TH k="price" right>Price</TH>
              <TH k="currentRatePct" right>8h Rate</TH>
              <TH k="h8avg" right>8h Avg</TH>
              <TH k="d7avg" right>7d Avg</TH>
              <TH k="annualizedPct" right>Annualized</TH>
              <TH k="openInterestM" right>Open Interest</TH>
              <th className="px-3 py-2.5 text-[11px] font-medium text-left" style={{ color: C.muted }}>Sentiment</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                {Array.from({ length: 8 }).map((__, j) => <td key={j} className="px-3 py-2.5"><Skel /></td>)}
              </tr>
            )) : rows.map((r, i) => (
              <tr key={r.symbol} className="hover:bg-black/[0.02] transition-colors"
                style={{ borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <td className="px-3 py-2.5">
                  <span className="text-[13px] font-semibold" style={{ color: C.text }}>{r.ticker}</span>
                  <span className="text-[10px] ml-1.5" style={{ color: C.muted }}>PERP</span>
                </td>
                <td className="px-3 py-2.5 text-right text-[12px] font-mono font-medium" style={{ color: C.text }}>${fmtPrice(r.price)}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className="text-[12px] font-mono font-semibold"
                    style={{ color: r.currentRatePct > 0 ? C.neg : r.currentRatePct < 0 ? C.pos : C.muted }}>
                    {r.currentRatePct > 0 ? "+" : ""}{r.currentRatePct.toFixed(4)}%
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-[11px] font-mono"
                  style={{ color: r.h8avg > 0 ? C.neg : r.h8avg < 0 ? C.pos : C.muted }}>
                  {r.h8avg > 0 ? "+" : ""}{r.h8avg.toFixed(4)}%
                </td>
                <td className="px-3 py-2.5 text-right text-[11px] font-mono"
                  style={{ color: r.d7avg > 0 ? C.neg : r.d7avg < 0 ? C.pos : C.muted }}>
                  {r.d7avg > 0 ? "+" : ""}{r.d7avg.toFixed(4)}%
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="text-[12px] font-semibold font-mono"
                    style={{ color: Math.abs(r.annualizedPct) > 50 ? C.amber : r.annualizedPct > 0 ? C.neg : C.pos }}>
                    {r.annualizedPct > 0 ? "+" : ""}{r.annualizedPct.toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-[11px]" style={{ color: C.sub }}>
                  ${r.openInterestM.toFixed(0)}M
                </td>
                <td className="px-3 py-2.5"><SentimentBadge v={r.sentiment} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] mt-2" style={{ color: C.muted }}>Positive rate = longs pay shorts · Negative rate = shorts pay longs · Auto-refreshes every 30s</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("screener");

  return (
    <div>
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ color: C.text }}>Market Tools</h1>
        <p className="text-[13px] mt-0.5" style={{ color: C.muted }}>Screener, heatmap, depth, correlation, calendar, risk calculator & funding rates</p>
      </div>

      {/* Tab bar */}
      <div className="mb-5 overflow-x-auto">
        <div className="flex gap-1 p-1 rounded-2xl w-fit" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all whitespace-nowrap"
                style={active ? {
                  background: "var(--card-bg)",
                  color: C.text,
                  boxShadow: "var(--shadow-tab-active)",
                  border: `1px solid ${C.border}`,
                } : {
                  color: C.muted,
                  background: "transparent",
                }}>
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Simulated-data notice for tools that use generated prices */}
      {(activeTab === "heatmap" || activeTab === "depth" || activeTab === "correlation") && (
        <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.22)", color: C.amber }}>
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Simulated data</strong> — prices and volumes shown here are algorithmically generated
            for educational purposes and do not reflect real market conditions.
          </span>
        </div>
      )}

      {/* Tab content */}
      <div className="rounded-2xl p-5" style={CARD}>
        {activeTab === "screener"    && <ScreenerTab />}
        {activeTab === "heatmap"     && <HeatMapTab />}
        {activeTab === "depth"       && <DepthTab />}
        {activeTab === "correlation" && <CorrelationTab />}
        {activeTab === "calendar"    && <CalendarTab />}
        {activeTab === "calculator"  && <CalculatorTab />}
        {activeTab === "funding"     && <FundingTab />}
      </div>
    </div>
  );
}
