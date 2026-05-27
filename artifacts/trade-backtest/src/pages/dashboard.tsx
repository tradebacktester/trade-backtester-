import React, { useMemo } from "react";
import { useGetBacktestSummary, useListBacktests } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Target, Shield,
  Clock, BarChart2, Zap, Activity, ArrowUpRight, Play, Globe,
  Bitcoin, Brain, Wifi, WifiOff, CandlestickChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── helpers ──────────────────────────────────────────────────────── */
function fmtPct(v: number | null | undefined, sign = true) {
  if (v == null) return "—";
  return `${sign && v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtNum(v: number | null | undefined, d = 2) {
  if (v == null) return "—";
  return v.toFixed(d);
}

/* ── Shimmer skeleton ────────────────────────────────────────────── */
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ background: "rgba(255,255,255,0.06)" }}
    />
  );
}

/* ── Base card style ─────────────────────────────────────────────── */
const CARD: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(255,255,255,0.042) 0%, rgba(255,255,255,0.016) 100%)",
  border: "1px solid rgba(255,255,255,0.072)",
  boxShadow: "0 4px 18px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04)",
};

/* ── Stat card ───────────────────────────────────────────────────── */
function StatCard({
  icon: Icon, iconColor, label, value, accent, isLoading = false,
}: {
  icon: React.ElementType; iconColor: string; label: string;
  value: React.ReactNode; accent?: string; isLoading?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 flex flex-col gap-3"
      style={CARD}
    >
      {accent && (
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg,transparent,${accent}45,transparent)` }}
        />
      )}
      <span
        className="h-9 w-9 flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ background: `${iconColor}12`, border: `1px solid ${iconColor}22` }}
      >
        <Icon className="h-[15px] w-[15px]" style={{ color: iconColor }} />
      </span>
      <div>
        <p className="text-[10px] uppercase tracking-wider mb-1.5 font-mono"
          style={{ color: "hsl(218,12%,38%)" }}>{label}</p>
        {isLoading
          ? <Skeleton className="h-7 w-20" />
          : <p className="text-[22px] font-bold font-mono leading-none"
              style={accent ? { color: accent } : { color: "hsl(218,14%,88%)" }}>
              {value}
            </p>
        }
      </div>
    </div>
  );
}

/* ── Section panel ───────────────────────────────────────────────── */
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${className}`} style={CARD}>
      {children}
    </div>
  );
}

/* ── Section label ───────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono uppercase tracking-widest mb-3"
      style={{ color: "hsl(218,12%,38%)" }}>
      {children}
    </p>
  );
}

/* ── Watchlist item ──────────────────────────────────────────────── */
interface WatchItem { symbol: string; price: string; change: number; sub: string }
const WATCHLIST: WatchItem[] = [
  { symbol: "BTC/USD", price: "67,420", change: 2.14,  sub: "Bitcoin" },
  { symbol: "ETH/USD", price: "3,512",  change: 1.87,  sub: "Ethereum" },
  { symbol: "EUR/USD", price: "1.0842", change: -0.31, sub: "Forex" },
  { symbol: "GBP/USD", price: "1.2671", change: -0.18, sub: "Forex" },
  { symbol: "SPX500",  price: "5,284",  change: 0.42,  sub: "Equities" },
  { symbol: "GOLD",    price: "2,318",  change: 0.74,  sub: "Commodity" },
];

function WatchRow({ item }: { item: WatchItem }) {
  const up = item.change >= 0;
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0"
      style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <div>
        <p className="text-sm font-mono font-semibold" style={{ color: "hsl(218,14%,82%)" }}>
          {item.symbol}
        </p>
        <p className="text-[10px] font-mono" style={{ color: "hsl(218,12%,38%)" }}>{item.sub}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-mono font-bold" style={{ color: "hsl(218,14%,80%)" }}>
          {item.price}
        </p>
        <p className="text-[11px] font-mono font-semibold"
          style={{ color: up ? "#34d399" : "#f87171" }}>
          {up ? "+" : ""}{item.change.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}

/* ── Trading session ─────────────────────────────────────────────── */
interface Session { name: string; hours: string; status: "open" | "closed" | "overlap"; tz: string }
const SESSIONS: Session[] = [
  { name: "Sydney",  hours: "22:00–07:00", status: "closed",  tz: "AEST" },
  { name: "Tokyo",   hours: "00:00–09:00", status: "closed",  tz: "JST" },
  { name: "London",  hours: "08:00–17:00", status: "open",    tz: "BST" },
  { name: "New York",hours: "13:00–22:00", status: "overlap", tz: "EST" },
];

const SESSION_COLOR: Record<string, string> = {
  open: "#34d399", closed: "hsl(218,12%,38%)", overlap: "hsl(38,95%,58%)"
};
const SESSION_LABEL: Record<string, string> = {
  open: "Open", closed: "Closed", overlap: "Active"
};

function SessionRow({ s }: { s: Session }) {
  const color = SESSION_COLOR[s.status];
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0"
      style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <div className="flex items-center gap-2.5">
        <span className="h-2 w-2 rounded-full flex-shrink-0"
          style={{ background: color, boxShadow: s.status !== "closed" ? `0 0 6px ${color}90` : "none" }} />
        <div>
          <p className="text-xs font-mono font-semibold" style={{ color: "hsl(218,14%,80%)" }}>
            {s.name}
          </p>
          <p className="text-[10px] font-mono" style={{ color: "hsl(218,12%,38%)" }}>
            {s.hours} {s.tz}
          </p>
        </div>
      </div>
      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
        style={{
          color,
          background: `${color}12`,
          border: `1px solid ${color}28`,
        }}>
        {SESSION_LABEL[s.status]}
      </span>
    </div>
  );
}

/* ── AI insight preview card ─────────────────────────────────────── */
interface Insight { icon: React.ElementType; color: string; title: string; body: string; tag: string }
const AI_INSIGHTS: Insight[] = [
  {
    icon: Bitcoin, color: "#f59e0b",
    title: "Crypto Outlook",
    body: "BTC holding above $65K support with bullish structure. ETH showing relative strength.",
    tag: "Bullish",
  },
  {
    icon: Globe, color: "hsl(210,90%,62%)",
    title: "Forex Signals",
    body: "DXY strength pressuring EUR/USD near 1.0820 support. GBP remains range-bound.",
    tag: "Neutral",
  },
  {
    icon: BarChart2, color: "#a78bfa",
    title: "Equities",
    body: "SPX consolidating near ATH. Tech (QQQ) leading. Watch for breakout above 5,300.",
    tag: "Watch",
  },
];

function InsightCard({ item }: { item: Insight }) {
  const Icon = item.icon;
  return (
    <Link href="/ai">
      <div className="rounded-2xl p-4 cursor-pointer transition-colors duration-150 hover:border-white/10"
        style={{
          ...CARD,
          borderColor: `${item.color}20`,
        }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="h-7 w-7 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: `${item.color}12`, border: `1px solid ${item.color}28` }}>
            <Icon className="h-3.5 w-3.5" style={{ color: item.color }} />
          </span>
          <p className="text-xs font-mono font-semibold" style={{ color: "hsl(218,14%,78%)" }}>
            {item.title}
          </p>
          <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-full"
            style={{ color: item.color, background: `${item.color}12`, border: `1px solid ${item.color}25` }}>
            {item.tag}
          </span>
        </div>
        <p className="text-[11px] font-mono leading-relaxed" style={{ color: "hsl(218,12%,50%)" }}>
          {item.body}
        </p>
      </div>
    </Link>
  );
}

/* ── Demo account summary ────────────────────────────────────────── */
function DemoSummary() {
  const items = [
    { label: "Balance",     value: "$10,000.00", color: "hsl(218,14%,82%)" },
    { label: "Equity",      value: "$10,284.50",  color: "#34d399" },
    { label: "Open P&L",    value: "+$284.50",    color: "#34d399" },
    { label: "Margin Used", value: "$1,200.00",   color: "hsl(38,95%,58%)" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(it => (
        <div key={it.label} className="rounded-xl px-3 py-2.5"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[10px] font-mono uppercase tracking-wider mb-1"
            style={{ color: "hsl(218,12%,36%)" }}>{it.label}</p>
          <p className="text-sm font-mono font-bold" style={{ color: it.color }}>{it.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Recent backtest row ─────────────────────────────────────────── */
function RecentRow({ bt, i }: { bt: any; i: number }) {
  const isPos = (bt.totalReturn ?? 0) >= 0;
  return (
    <Link href={`/backtests/${bt.id}`}>
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 cursor-pointer group"
        style={{ border: "1px solid transparent" }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "";
          (e.currentTarget as HTMLElement).style.borderColor = "transparent";
        }}
      >
        <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: isPos ? "rgba(52,211,153,0.09)" : "rgba(239,68,68,0.09)",
            border: `1px solid ${isPos ? "rgba(52,211,153,0.18)" : "rgba(239,68,68,0.18)"}`,
          }}>
          {isPos
            ? <TrendingUp className="h-3.5 w-3.5" style={{ color: "#34d399" }} />
            : <TrendingDown className="h-3.5 w-3.5" style={{ color: "#f87171" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "hsl(218,14%,82%)" }}>
            {bt.strategyName || `Strategy #${bt.strategyId}`}
          </p>
          <p className="text-[11px] font-mono" style={{ color: "hsl(218,12%,40%)" }}>
            {bt.symbol} · {bt.startDate?.slice(0, 7)}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-sm font-bold font-mono ${isPos ? "text-emerald-400" : "text-red-400"}`}>
            {fmtPct(bt.totalReturn)}
          </p>
          <p className="text-[10px] font-mono" style={{ color: "hsl(218,12%,38%)" }}>
            WR: {bt.winRate != null ? `${bt.winRate.toFixed(0)}%` : "—"}
          </p>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-30 transition-opacity flex-shrink-0"
          style={{ color: "hsl(218,12%,55%)" }} />
      </div>
    </Link>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetBacktestSummary();
  const { data: backtests, isLoading: loadingBacktests } = useListBacktests();

  const isLoading = loadingSummary || loadingBacktests;

  const analytics = useMemo(() => {
    if (!backtests?.length) return null;
    const completed = backtests.filter((b: any) => b.status === "complete");
    if (!completed.length) return null;
    const wins = completed.filter((b: any) => (b.totalReturn ?? 0) > 0);
    const allReturns = completed.map((b: any) => b.totalReturn ?? 0);
    const allPf = completed.map((b: any) => b.profitFactor ?? 0).filter((v: number) => v > 0);
    const allWr = completed.map((b: any) => b.winRate ?? 0).filter((v: number) => v > 0);
    const allSharpe = completed.map((b: any) => b.sharpeRatio ?? 0);
    const allDd = completed.map((b: any) => b.maxDrawdown ?? 0);
    const avg = (arr: number[]) => arr.length ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : 0;
    return {
      completed,
      wins,
      avgWR: avg(allWr),
      avgPF: avg(allPf),
      avgSharpe: avg(allSharpe),
      avgDD: avg(allDd),
      bestReturn: Math.max(...allReturns),
      worstReturn: Math.min(...allReturns),
    };
  }, [backtests]);

  const recentBacktests = useMemo(
    () => (backtests ?? []).filter((b: any) => b.status === "complete").slice(0, 6),
    [backtests],
  );

  return (
    <div className="flex flex-col gap-4 pb-4">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, hsl(218,16%,88%) 40%, hsl(210,90%,65%))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Dashboard
          </h1>
          <p className="text-xs mt-0.5 font-mono" style={{ color: "hsl(218,12%,42%)" }}>
            Market overview &amp; performance summary
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="flex-shrink-0">
          <Link href="/backtests/new">
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Run Backtest
          </Link>
        </Button>
      </div>

      {/* ── Market Overview bar ───────────────────────────────────── */}
      <Panel>
        <div className="flex items-center gap-2 mb-3">
          <Wifi className="h-3.5 w-3.5" style={{ color: "#34d399" }} />
          <SectionLabel>Market Overview</SectionLabel>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {WATCHLIST.map(w => (
            <div key={w.symbol} className="rounded-xl px-3 py-2 text-center"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-[10px] font-mono mb-1" style={{ color: "hsl(218,12%,40%)" }}>{w.symbol}</p>
              <p className="text-sm font-mono font-bold" style={{ color: "hsl(218,14%,82%)" }}>{w.price}</p>
              <p className="text-[11px] font-mono font-semibold"
                style={{ color: w.change >= 0 ? "#34d399" : "#f87171" }}>
                {w.change >= 0 ? "+" : ""}{w.change.toFixed(2)}%
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {/* ── Performance stat cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <StatCard icon={TrendingUp} iconColor="#34d399" label="Best Return" accent="#34d399"
          value={isLoading ? null : fmtPct(summary?.bestReturn)} isLoading={isLoading} />
        <StatCard icon={Percent} iconColor="hsl(210,90%,62%)" label="Avg Win Rate" accent="hsl(210,90%,62%)"
          value={isLoading ? null : analytics ? `${analytics.avgWR.toFixed(1)}%` : "—"} isLoading={isLoading} />
        <StatCard icon={Target} iconColor="hsl(38,95%,58%)" label="Profit Factor" accent="hsl(38,95%,58%)"
          value={isLoading ? null : analytics ? fmtNum(analytics.avgPF) : "—"} isLoading={isLoading} />
        <StatCard icon={Zap} iconColor="#a78bfa" label="Avg Sharpe"
          value={isLoading ? null : analytics ? fmtNum(analytics.avgSharpe) : "—"} isLoading={isLoading} />
        <StatCard icon={Clock} iconColor="hsl(218,12%,52%)" label="Total Backtests"
          value={isLoading ? null : (summary?.totalBacktests ?? 0)} isLoading={isLoading} />
        <StatCard icon={Shield} iconColor="#f87171" label="Avg Drawdown" accent="#f87171"
          value={isLoading ? null : analytics ? `-${Math.abs(analytics.avgDD).toFixed(1)}%` : "—"} isLoading={isLoading} />
        <StatCard icon={DollarSign} iconColor="#34d399" label="Best Trade" accent="#34d399"
          value={isLoading ? null : analytics ? fmtPct(analytics.bestReturn) : "—"} isLoading={isLoading} />
        <StatCard icon={Activity} iconColor="hsl(210,90%,62%)" label="Total Trades"
          value={isLoading ? null : (summary?.totalTrades ?? 0)} isLoading={isLoading} />
      </div>

      {/* ── Middle row: Watchlist + Sessions ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Watchlist */}
        <Panel>
          <div className="flex items-center justify-between mb-1">
            <SectionLabel>Watchlist</SectionLabel>
            <Link href="/chart">
              <span className="text-[10px] font-mono flex items-center gap-1 transition-opacity hover:opacity-70 cursor-pointer"
                style={{ color: "hsl(210,90%,62%)" }}>
                <CandlestickChart className="h-3 w-3" />
                View Charts
              </span>
            </Link>
          </div>
          <div>
            {WATCHLIST.map(w => <WatchRow key={w.symbol} item={w} />)}
          </div>
        </Panel>

        {/* Right column: Trading Sessions + Demo Account */}
        <div className="flex flex-col gap-4">
          <Panel>
            <SectionLabel>Trading Sessions</SectionLabel>
            <div>
              {SESSIONS.map(s => <SessionRow key={s.name} s={s} />)}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Demo Account</SectionLabel>
              <Link href="/demo">
                <span className="text-[10px] font-mono transition-opacity hover:opacity-70 cursor-pointer"
                  style={{ color: "hsl(210,90%,62%)" }}>
                  Open Demo →
                </span>
              </Link>
            </div>
            <DemoSummary />
          </Panel>
        </div>
      </div>

      {/* ── AI Insights preview ───────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5" style={{ color: "#a78bfa" }} />
            <p className="text-[10px] font-mono uppercase tracking-widest"
              style={{ color: "hsl(218,12%,38%)" }}>AI Insights</p>
          </div>
          <Link href="/ai">
            <span className="text-[10px] font-mono transition-opacity hover:opacity-70 cursor-pointer flex items-center gap-1"
              style={{ color: "hsl(210,90%,62%)" }}>
              Full Analysis <ArrowUpRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {AI_INSIGHTS.map(item => <InsightCard key={item.title} item={item} />)}
        </div>
      </div>

      {/* ── Recent Backtests ─────────────────────────────────────── */}
      <Panel>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Recent Backtests</SectionLabel>
          <Link href="/backtests">
            <span className="text-[10px] font-mono transition-opacity hover:opacity-70 cursor-pointer flex items-center gap-1"
              style={{ color: "hsl(210,90%,62%)" }}>
              View All <ArrowUpRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : recentBacktests.length ? (
          <div>
            {recentBacktests.map((bt: any, i: number) => <RecentRow key={bt.id} bt={bt} i={i} />)}
          </div>
        ) : (
          <div className="py-10 text-center">
            <BarChart2 className="h-8 w-8 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-mono" style={{ color: "hsl(218,12%,36%)" }}>
              No backtests yet
            </p>
            <Link href="/backtests/new">
              <Button variant="outline" size="sm" className="mt-3">
                Run your first backtest
              </Button>
            </Link>
          </div>
        )}
      </Panel>

    </div>
  );
}
