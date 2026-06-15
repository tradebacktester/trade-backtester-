import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search, Star, ArrowUpRight, ArrowDownRight, RefreshCw,
  ChevronRight, Sparkles, Clock, Heart, TrendingUp, TrendingDown,
  BarChart2, X, SlidersHorizontal, ChevronDown, Zap,
} from "lucide-react";
import { API_BASE } from "@/lib/api-config";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ScreenerRow {
  symbol: string; name: string; ticker: string; sector: string;
  assetType: "crypto" | "forex" | "stock" | "index" | "commodity";
  price: number; change24h: number; change7d: number; volume24h: number;
  rsi: number; rsiSignal: string; macd: "bullish" | "bearish" | "neutral";
  trend: "bullish" | "bearish"; bbPosition: number; vwap: number;
  dataSource: "live" | "simulated"; mcapRank: number;
}

// ── Categories ────────────────────────────────────────────────────────────────
type CategoryId = "all" | "crypto" | "stocks" | "forex" | "futures" | "commodities" | "indices";
const CATEGORIES: { id: CategoryId; label: string; color: string }[] = [
  { id: "all",         label: "All",         color: "rgba(255,255,255,0.85)" },
  { id: "crypto",      label: "Crypto",      color: "#f59e0b" },
  { id: "stocks",      label: "Stocks",      color: "#3b82f6" },
  { id: "forex",       label: "Forex",       color: "#10b981" },
  { id: "futures",     label: "Futures",     color: "#8b5cf6" },
  { id: "commodities", label: "Commodities", color: "#ef4444" },
  { id: "indices",     label: "Indices",     color: "#06b6d4" },
];

// ── Static futures (not in screener) ─────────────────────────────────────────
const FUTURES_STATIC: ScreenerRow[] = [
  { symbol: "BTCPERP", name: "BTC Perpetual", ticker: "BTC-PERP", sector: "Futures", assetType: "crypto", price: 67500, change24h: 2.1, change7d: 5.4, volume24h: 980_000_000, rsi: 58, rsiSignal: "neutral", macd: "bullish", trend: "bullish", bbPosition: 62, vwap: 67200, dataSource: "simulated", mcapRank: 1 },
  { symbol: "ETHPERP", name: "ETH Perpetual", ticker: "ETH-PERP", sector: "Futures", assetType: "crypto", price: 3530,  change24h: 1.4, change7d: 3.2, volume24h: 450_000_000, rsi: 54, rsiSignal: "neutral", macd: "bullish", trend: "bullish", bbPosition: 55, vwap: 3510,  dataSource: "simulated", mcapRank: 2 },
  { symbol: "SOLPERP", name: "SOL Perpetual", ticker: "SOL-PERP", sector: "Futures", assetType: "crypto", price: 183,   change24h: 3.2, change7d: 8.1, volume24h: 180_000_000, rsi: 62, rsiSignal: "neutral", macd: "bullish", trend: "bullish", bbPosition: 68, vwap: 181,   dataSource: "simulated", mcapRank: 5 },
  { symbol: "XAUUSD",  name: "Gold Futures",  ticker: "XAU/USD",  sector: "Futures", assetType: "commodity", price: 2320, change24h: 0.3, change7d: 1.1, volume24h: 85_000_000, rsi: 51, rsiSignal: "neutral", macd: "neutral", trend: "bullish", bbPosition: 52, vwap: 2315, dataSource: "simulated", mcapRank: 62 },
];
const FUTURES_SYMBOLS = new Set(FUTURES_STATIC.map(f => f.symbol));

// Chart-symbol mapping (screener → chart page internal format)
const CHART_SYMBOL_MAP: Record<string, string> = { SPX: "SPX500", NDX: "NAS100" };
function toChartSymbol(sym: string) { return CHART_SYMBOL_MAP[sym] ?? sym; }

// ── Seeded RNG + Sparkline ────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function strSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function genSparkline(symbol: string, change24h: number, n = 14): number[] {
  const rng = mulberry32(strSeed(symbol + Math.floor(Date.now() / 3_600_000)));
  const pts: number[] = [50];
  for (let i = 1; i < n; i++) {
    const drift = (change24h / n) * 0.35;
    pts.push(Math.max(2, Math.min(98, pts[i - 1] + drift + (rng() - 0.48) * 9)));
  }
  return pts;
}
function Sparkline({ symbol, change24h, w = 70, h = 30 }: { symbol: string; change24h: number; w?: number; h?: number }) {
  const pts = useMemo(() => genSparkline(symbol, change24h), [symbol, change24h]);
  const min = Math.min(...pts), max = Math.max(...pts), range = max - min || 1;
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * w);
  const ys = pts.map(p => h - ((p - min) / range) * (h - 5) - 2);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const color = change24h >= 0 ? "#4ade80" : "#f87171";
  const uid = `sg-${symbol.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg width={w} height={h} style={{ overflow: "visible", flexShrink: 0, display: "block" }}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#${uid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── AI Intelligence ───────────────────────────────────────────────────────────
function computeAiScore(r: ScreenerRow): number {
  let s = 50;
  if (r.trend === "bullish") s += 15; else s -= 10;
  if (r.macd === "bullish") s += 15; else if (r.macd === "bearish") s -= 10;
  if (r.rsi >= 48 && r.rsi < 68) s += 10;
  else if (r.rsi >= 68) s -= 8;
  else if (r.rsi <= 32) s += 5;
  else s -= 5;
  if (r.bbPosition >= 35 && r.bbPosition <= 72) s += 8;
  else if (r.bbPosition > 80) s -= 5;
  return Math.max(5, Math.min(98, Math.round(s)));
}
function scoreColor(s: number) { return s >= 72 ? "#4ade80" : s >= 52 ? "#fbbf24" : "#f87171"; }
function bestTf(r: ScreenerRow) {
  if (r.rsi > 68 || r.rsi < 32) return "1H";
  if (r.trend === "bullish" && r.macd === "bullish") return "4H";
  return "1D";
}
function dnaMatch(r: ScreenerRow): { label: string; color: string } {
  const n = (r.trend === "bullish" ? 1 : 0) + (r.macd === "bullish" ? 1 : 0);
  if (n === 2) return { label: "High Match", color: "#4ade80" };
  if (n === 1) return { label: "Med Match",  color: "#fbbf24" };
  return { label: "Low Match", color: "#f87171" };
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtP(v: number) {
  if (v < 0.00001) return v.toFixed(8);
  if (v < 0.01) return v.toFixed(6);
  if (v < 1) return v.toFixed(4);
  if (v < 100) return v.toFixed(2);
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function fmtV(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
}

// ── Persistence ───────────────────────────────────────────────────────────────
const LS = { FAV: "ms_favs", REC: "ms_recents", LAST: "market_sel_last_symbol" };
const loadFavs = (): string[] => { try { return JSON.parse(localStorage.getItem(LS.FAV) || "[]"); } catch { return []; } };
const loadRecents = (): string[] => { try { return JSON.parse(localStorage.getItem(LS.REC) || "[]"); } catch { return []; } };
function pushRecent(sym: string) {
  const r = [sym, ...loadRecents().filter(s => s !== sym)].slice(0, 10);
  localStorage.setItem(LS.REC, JSON.stringify(r));
}

// ── Asset Card ────────────────────────────────────────────────────────────────
interface CardProps { row: ScreenerRow; isFav: boolean; onFav: (s: string) => void; onSelect: (r: ScreenerRow) => void; catColor: string; }
function AssetCard({ row, isFav, onFav, onSelect, catColor }: CardProps) {
  const score = computeAiScore(row);
  const sc = scoreColor(score);
  const tf = bestTf(row);
  const dna = dnaMatch(row);
  const pos = row.change24h >= 0;
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onSelect(row)}
      style={{
        background: hov ? "var(--card-bg-hover, var(--card-bg))" : "var(--card-bg)",
        border: `1px solid ${hov ? catColor + "44" : "var(--glass-border)"}`,
        borderRadius: "18px",
        padding: "15px 16px 13px",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s ease, border-color 0.18s ease",
        transform: hov ? "translateY(-3px)" : "none",
        boxShadow: hov ? `0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px ${catColor}22` : "var(--shadow-card)",
        minWidth: 0,
      }}
    >
      {/* Top accent line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, ${catColor}99 0%, ${catColor}00 100%)`, borderRadius: "18px 18px 0 0" }} />

      {/* Row 1: Symbol + Live badge + Star */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
            <span style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--foreground)", fontFamily: "var(--app-font-display)", lineHeight: 1 }}>
              {row.ticker}
            </span>
            {row.dataSource === "live" && (
              <span style={{ fontSize: "7.5px", fontWeight: 700, padding: "2px 5px", borderRadius: "999px", background: "rgba(74,222,128,0.13)", color: "#4ade80", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "3px" }}>
                <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 5px rgba(74,222,128,0.8)", display: "inline-block", animation: "pulse 2s infinite" }} />
                LIVE
              </span>
            )}
          </div>
          <span style={{ fontSize: "10.5px", color: "var(--muted-foreground)", letterSpacing: "0.01em", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onFav(row.symbol); }}
          style={{ width: "32px", height: "32px", borderRadius: "10px", border: `1px solid ${isFav ? "#fbbf2444" : "var(--glass-border)"}`, background: isFav ? "rgba(251,191,36,0.1)" : "transparent", color: isFav ? "#fbbf24" : "var(--muted-foreground)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s ease" }}
        >
          <Star style={{ width: "13px", height: "13px", fill: isFav ? "#fbbf24" : "none", strokeWidth: 1.8 }} />
        </button>
      </div>

      {/* Row 2: Price + Change + Sparkline */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "10px" }}>
        <div>
          <div style={{ fontSize: "19px", fontWeight: 700, letterSpacing: "-0.045em", color: "var(--foreground)", fontFamily: "var(--app-font-mono, 'JetBrains Mono', monospace)", lineHeight: 1, marginBottom: "3px" }}>
            ${fmtP(row.price)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            {pos ? <ArrowUpRight style={{ width: "11px", height: "11px", color: "#4ade80", flexShrink: 0 }} />
                 : <ArrowDownRight style={{ width: "11px", height: "11px", color: "#f87171", flexShrink: 0 }} />}
            <span style={{ fontSize: "12px", fontWeight: 650, color: pos ? "#4ade80" : "#f87171", letterSpacing: "-0.01em" }}>
              {pos ? "+" : ""}{row.change24h.toFixed(2)}%
            </span>
            <span style={{ fontSize: "9.5px", color: "var(--muted-foreground)", letterSpacing: "0.02em" }}>24H</span>
          </div>
        </div>
        <Sparkline symbol={row.symbol} change24h={row.change24h} w={68} h={30} />
      </div>

      {/* Row 3: Volume + RSI */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "9px" }}>
        <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
          Vol <strong style={{ color: "var(--foreground)", fontWeight: 600 }}>{fmtV(row.volume24h)}</strong>
        </span>
        <span style={{ width: "2px", height: "2px", borderRadius: "50%", background: "var(--muted-foreground)", opacity: 0.35, flexShrink: 0 }} />
        <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
          RSI <strong style={{ color: row.rsi > 70 ? "#f87171" : row.rsi < 30 ? "#4ade80" : "var(--foreground)", fontWeight: 600 }}>{row.rsi.toFixed(0)}</strong>
        </span>
        <span style={{ width: "2px", height: "2px", borderRadius: "50%", background: "var(--muted-foreground)", opacity: 0.35, flexShrink: 0 }} />
        <span style={{ fontSize: "10px", color: "var(--muted-foreground)" }}>
          7D <strong style={{ color: row.change7d >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>{row.change7d >= 0 ? "+" : ""}{row.change7d.toFixed(1)}%</strong>
        </span>
      </div>

      {/* Row 4: Badges */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "8px", background: `${sc}18`, color: sc, display: "flex", alignItems: "center", gap: "3px", letterSpacing: "0.02em", flexShrink: 0 }}>
          <Sparkles style={{ width: "8px", height: "8px" }} />{score}
        </span>
        <span style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "8px", background: `${dna.color}14`, color: dna.color, flexShrink: 0 }}>
          {dna.label}
        </span>
        <span style={{ fontSize: "9.5px", fontWeight: 600, padding: "3px 8px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", color: "var(--muted-foreground)", marginLeft: "auto", letterSpacing: "0.03em", flexShrink: 0 }}>
          {tf}
        </span>
        <ChevronRight style={{ width: "12px", height: "12px", color: catColor, opacity: hov ? 1 : 0.4, transition: "opacity 0.15s", flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ── Mini Chip (for Recents / Favorites) ──────────────────────────────────────
function AssetChip({ row, onSelect, onRemove, color }: { row: ScreenerRow; onSelect: (r: ScreenerRow) => void; onRemove?: (s: string) => void; color: string }) {
  const pos = row.change24h >= 0;
  return (
    <div
      onClick={() => onSelect(row)}
      style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "7px 11px", borderRadius: "12px", background: "var(--card-bg)", border: "1px solid var(--glass-border)", cursor: "pointer", flexShrink: 0, transition: "border-color 0.15s", minWidth: "110px" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = color + "55"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--glass-border)"}
    >
      <div>
        <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--foreground)", fontFamily: "var(--app-font-display)", lineHeight: 1, marginBottom: "1px" }}>{row.ticker}</div>
        <div style={{ fontSize: "10px", fontWeight: 600, color: pos ? "#4ade80" : "#f87171" }}>{pos ? "+" : ""}{row.change24h.toFixed(1)}%</div>
      </div>
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove(row.symbol); }}
          style={{ width: "18px", height: "18px", borderRadius: "999px", background: "rgba(255,255,255,0.08)", border: "none", color: "var(--muted-foreground)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <X style={{ width: "9px", height: "9px" }} />
        </button>
      )}
    </div>
  );
}

// ── Sort bar ──────────────────────────────────────────────────────────────────
type SortKey = "mcapRank" | "volume24h" | "change24h" | "aiScore";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "mcapRank",  label: "Rank" },
  { key: "volume24h", label: "Volume" },
  { key: "change24h", label: "Change" },
  { key: "aiScore",   label: "AI Score" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MarketSelectionPage() {
  const [, navigate] = useLocation();
  const [category, setCategory] = useState<CategoryId>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("mcapRank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [favs, setFavs] = useState<string[]>(loadFavs);
  const [recents, setRecents] = useState<string[]>(loadRecents);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const { data: screenerData, isLoading, refetch, isFetching } = useQuery<ScreenerRow[]>({
    queryKey: ["ms-screener"],
    queryFn: () => fetch(`${API_BASE}/api/tools/screener`).then(r => r.json()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  function toggleFav(sym: string) {
    setFavs(prev => {
      const next = prev.includes(sym) ? prev.filter(s => s !== sym) : [sym, ...prev];
      localStorage.setItem(LS.FAV, JSON.stringify(next));
      return next;
    });
  }

  function removeRecent(sym: string) {
    setRecents(prev => {
      const next = prev.filter(s => s !== sym);
      localStorage.setItem(LS.REC, JSON.stringify(next));
      return next;
    });
  }

  function handleSelect(row: ScreenerRow) {
    pushRecent(row.symbol);
    setRecents(loadRecents());
    localStorage.setItem(LS.LAST, row.symbol);
    navigate(`/chart?symbol=${toChartSymbol(row.symbol)}`);
  }

  // Build full asset list
  const allRows = useMemo<ScreenerRow[]>(() => screenerData ?? [], [screenerData]);

  // Category counts
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of allRows) {
      const cat = { crypto: "crypto", stock: "stocks", forex: "forex", index: "indices", commodity: "commodities" }[r.assetType];
      if (cat) c[cat] = (c[cat] ?? 0) + 1;
    }
    c.all = allRows.length;
    c.futures = FUTURES_STATIC.length;
    return c;
  }, [allRows]);

  // Row lookup map (for recents / favorites)
  const rowMap = useMemo<Map<string, ScreenerRow>>(() => {
    const m = new Map<string, ScreenerRow>();
    for (const r of allRows) m.set(r.symbol, r);
    for (const r of FUTURES_STATIC) m.set(r.symbol, r);
    return m;
  }, [allRows]);

  // Filtered + sorted asset grid rows
  const gridRows = useMemo<ScreenerRow[]>(() => {
    let rows: ScreenerRow[];
    if (category === "futures") {
      rows = FUTURES_STATIC;
    } else if (category === "all") {
      rows = allRows;
    } else {
      const typeMap: Partial<Record<CategoryId, string>> = { crypto: "crypto", stocks: "stock", forex: "forex", commodities: "commodity", indices: "index" };
      const type = typeMap[category] ?? "";
      rows = allRows.filter(r => r.assetType === type);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.ticker.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.symbol.toLowerCase().includes(q));
    }

    return [...rows].sort((a, b) => {
      const av = sortKey === "aiScore" ? computeAiScore(a) : (a[sortKey] as number);
      const bv = sortKey === "aiScore" ? computeAiScore(b) : (b[sortKey] as number);
      const dir = sortDir === "asc" ? 1 : -1;
      return (av - bv) * dir;
    });
  }, [allRows, category, search, sortKey, sortDir]);

  // Favorite rows
  const favRows = useMemo(() => favs.map(s => rowMap.get(s)).filter(Boolean) as ScreenerRow[], [favs, rowMap]);
  // Recent rows
  const recentRows = useMemo(() => recents.map(s => rowMap.get(s)).filter(Boolean) as ScreenerRow[], [recents, rowMap]);

  // Category color for active
  const activeCatColor = CATEGORIES.find(c => c.id === category)?.color ?? "rgba(255,255,255,0.85)";

  // Skeleton loading
  const skeletons = Array.from({ length: 8 });

  const C = {
    bg: "var(--background)",
    card: "var(--card-bg)",
    border: "var(--glass-border)",
    text: "var(--foreground)",
    sub: "var(--muted-foreground)",
  };

  return (
    <div style={{ minHeight: "calc(100vh - 120px)" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.04em", color: C.text, fontFamily: "var(--app-font-display)", lineHeight: 1, marginBottom: "4px" }}>
            Markets
          </h1>
          <p style={{ fontSize: "12px", color: C.sub, letterSpacing: "0.01em" }}>
            {gridRows.length} assets · {isFetching ? "Updating..." : "Live data"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={() => refetch()} disabled={isFetching}
            style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 13px", borderRadius: "10px", border: "1px solid var(--glass-border)", background: "var(--card-bg)", color: C.sub, cursor: "pointer", fontSize: "12px", fontWeight: 500, transition: "opacity 0.15s" }}>
            <RefreshCw style={{ width: "12px", height: "12px", animation: isFetching ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────────── */}
      <div style={{ position: "relative", marginBottom: "16px" }}>
        <Search style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", width: "15px", height: "15px", color: C.sub, pointerEvents: "none" }} />
        <input
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search markets — BTC, Apple, EUR/USD…"
          style={{
            width: "100%", boxSizing: "border-box",
            height: "44px", paddingLeft: "40px", paddingRight: search ? "40px" : "16px",
            borderRadius: "14px", border: "1px solid var(--glass-border)",
            background: "var(--card-bg)", color: C.text,
            fontSize: "14px", fontFamily: "var(--app-font-display)",
            outline: "none", transition: "border-color 0.15s",
          }}
          onFocus={e => (e.target as HTMLInputElement).parentElement!.querySelector("input")!.style.borderColor = "rgba(255,255,255,0.25)"}
          onBlur={e => (e.target as HTMLInputElement).parentElement!.querySelector("input")!.style.borderColor = "var(--glass-border)"}
        />
        {search && (
          <button onClick={() => setSearch("")}
            style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", width: "20px", height: "20px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", color: C.sub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X style={{ width: "10px", height: "10px" }} />
          </button>
        )}
      </div>

      {/* ── Category Pills ─────────────────────────────────────────────── */}
      <div style={{ overflowX: "auto", marginBottom: "20px", scrollbarWidth: "none" }}>
        <div style={{ display: "flex", gap: "6px", paddingBottom: "2px", minWidth: "max-content" }}>
          {CATEGORIES.map(cat => {
            const active = category === cat.id;
            const count = counts[cat.id] ?? 0;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "7px 14px", borderRadius: "12px",
                  border: `1px solid ${active ? cat.color + "55" : "var(--glass-border)"}`,
                  background: active ? `${cat.color}14` : "var(--card-bg)",
                  color: active ? cat.color : C.sub,
                  cursor: "pointer", fontSize: "12.5px", fontWeight: active ? 600 : 500,
                  fontFamily: "var(--app-font-display)",
                  transition: "all 0.15s ease", flexShrink: 0,
                  boxShadow: active ? `0 0 0 1px ${cat.color}22` : "none",
                  letterSpacing: "-0.01em",
                }}
              >
                {cat.label}
                {count > 0 && (
                  <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "6px", background: active ? `${cat.color}22` : "rgba(255,255,255,0.06)", color: active ? cat.color : C.sub, fontWeight: 600 }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Recents ────────────────────────────────────────────────────── */}
      {recentRows.length > 0 && !search && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <Clock style={{ width: "12px", height: "12px", color: C.sub }} />
            <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", color: C.sub, textTransform: "uppercase" }}>Recent</span>
          </div>
          <div style={{ display: "flex", gap: "7px", overflowX: "auto", paddingBottom: "2px", scrollbarWidth: "none" }}>
            {recentRows.map(row => (
              <AssetChip key={row.symbol} row={row} onSelect={handleSelect} onRemove={removeRecent}
                color={CATEGORIES.find(c => c.id === ({ crypto: "crypto", stock: "stocks", forex: "forex", index: "indices", commodity: "commodities" }[row.assetType] as CategoryId))?.color ?? "#fff"} />
            ))}
          </div>
        </div>
      )}

      {/* ── Favorites ──────────────────────────────────────────────────── */}
      {favRows.length > 0 && !search && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <Star style={{ width: "12px", height: "12px", color: "#fbbf24", fill: "#fbbf24" }} />
            <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", color: C.sub, textTransform: "uppercase" }}>Favorites</span>
          </div>
          <div style={{ display: "flex", gap: "7px", overflowX: "auto", paddingBottom: "2px", scrollbarWidth: "none" }}>
            {favRows.map(row => (
              <AssetChip key={row.symbol} row={row} onSelect={handleSelect}
                color="#fbbf24" />
            ))}
          </div>
        </div>
      )}

      {/* ── Sort bar ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", color: C.sub, letterSpacing: "0.04em", marginRight: "2px" }}>Sort:</span>
        {SORTS.map(s => {
          const active = sortKey === s.key;
          return (
            <button key={s.key}
              onClick={() => { if (active) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(s.key); setSortDir(s.key === "volume24h" || s.key === "aiScore" ? "desc" : "asc"); } }}
              style={{ display: "flex", alignItems: "center", gap: "3px", padding: "5px 11px", borderRadius: "9px", border: `1px solid ${active ? "var(--nav-active-border)" : "var(--glass-border)"}`, background: active ? "var(--nav-active-bg)" : "transparent", color: active ? "var(--foreground)" : C.sub, cursor: "pointer", fontSize: "11.5px", fontWeight: active ? 600 : 500, transition: "all 0.14s ease" }}>
              {s.label}
              {active && (
                <span style={{ fontSize: "9px", opacity: 0.7 }}>{sortDir === "asc" ? "↑" : "↓"}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Asset Grid ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {skeletons.map((_, i) => (
            <div key={i} style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", borderRadius: "18px", height: "170px", animation: "pulse 1.8s ease-in-out infinite", opacity: 0.6 }} />
          ))}
        </div>
      ) : gridRows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <BarChart2 style={{ width: "36px", height: "36px", color: C.sub, margin: "0 auto 12px", opacity: 0.4 }} />
          <p style={{ color: C.sub, fontSize: "14px" }}>No assets found</p>
          {search && <button onClick={() => setSearch("")} style={{ marginTop: "10px", fontSize: "13px", color: activeCatColor, background: "none", border: "none", cursor: "pointer" }}>Clear search</button>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))", gap: "12px" }}>
          {gridRows.map(row => (
            <AssetCard
              key={row.symbol}
              row={row}
              isFav={favs.includes(row.symbol)}
              onFav={toggleFav}
              onSelect={handleSelect}
              catColor={CATEGORIES.find(c => c.id === ({ crypto: "crypto", stock: "stocks", forex: "forex", index: "indices", commodity: "commodities" }[row.assetType] as CategoryId))?.color ?? activeCatColor}
            />
          ))}
        </div>
      )}

      {/* ── Footer note ────────────────────────────────────────────────── */}
      <p style={{ fontSize: "10.5px", color: C.sub, marginTop: "20px", letterSpacing: "0.02em", opacity: 0.6 }}>
        {gridRows.length} assets · Crypto prices from Binance · Simulated data for Forex, Stocks, Indices · AI scores computed locally
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
