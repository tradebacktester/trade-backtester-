import React, { useMemo } from "react";
import { useGetBacktestSummary, useListBacktests } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Target, Shield,
  Clock, BarChart2, Zap, Activity, ArrowUpRight, Play,
  Globe, Bitcoin, Brain, CandlestickChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── Helpers ──────────────────────────────────────────────────────── */
function fmtPct(v: number | null | undefined, sign = true) {
  if (v == null) return "—";
  return `${sign && v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtNum(v: number | null | undefined, d = 2) {
  if (v == null) return "—";
  return v.toFixed(d);
}

/* ── Design tokens ────────────────────────────────────────────────── */
const C = {
  text:    "hsl(0,0%,84%)",
  sub:     "hsl(0,0%,44%)",
  muted:   "hsl(0,0%,34%)",
  border:  "rgba(255,255,255,0.07)",
  surface: "hsl(0,0%,11%)",
  surfaceHover: "rgba(255,255,255,0.04)",
  positive: "#34d399",
  negative: "#f87171",
  amber:   "#fbbf24",
};

const CARD: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  boxShadow: "0 2px 12px rgba(0,0,0,0.28)",
};

/* ── Skeleton ─────────────────────────────────────────────────────── */
function Skel({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ background: "rgba(255,255,255,0.06)" }}
    />
  );
}

/* ── Section label ────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: C.muted }}>
      {children}
    </p>
  );
}

/* ── Panel ────────────────────────────────────────────────────────── */
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${className}`} style={CARD}>
      {children}
    </div>
  );
}

/* ── Stat card ────────────────────────────────────────────────────── */
function StatCard({
  icon: Icon, label, value, accent, isLoading = false,
}: {
  icon: React.ElementType; label: string; value: React.ReactNode;
  accent?: string; isLoading?: boolean;
}) {
  const iconColor = accent ?? "hsl(0,0%,50%)";
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 flex flex-col gap-3" style={CARD}>
      {accent && (
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg,transparent,${accent}40,transparent)` }}
        />
      )}
      <span
        className="h-8 w-8 flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <Icon className="h-[14px] w-[14px]" style={{ color: iconColor }} />
      </span>
      <div>
        <p className="text-[10px] uppercase tracking-wider mb-1.5 font-mono" style={{ color: C.muted }}>
          {label}
        </p>
        {isLoading
          ? <Skel className="h-6 w-16" />
          : <p className="text-[20px] font-bold font-mono leading-none"
              style={accent ? { color: accent } : { color: C.text }}>
              {value}
            </p>
        }
      </div>
    </div>
  );
}

/* ── Watchlist ────────────────────────────────────────────────────── */
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
    <div
      className="flex items-center justify-between py-2.5"
      style={{ borderBottom: `1px solid ${C.border}` }}
    >
      <div>
        <p className="text-sm font-mono font-semibold" style={{ color: C.text }}>{item.symbol}</p>
        <p className="text-[10px] font-mono" style={{ color: C.muted }}>{item.sub}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-mono font-bold" style={{ color: C.text }}>{item.price}</p>
        <p className="text-[11px] font-mono font-semibold"
          style={{ color: up ? C.positive : C.negative }}>
          {up ? "+" : ""}{item.change.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}

/* ── Trading sessions ─────────────────────────────────────────────── */
interface Session { name: string; hours: string; status: "open" | "closed" | "overlap"; tz: string }
const SESSIONS: Session[] = [
  { name: "Sydney",   hours: "22:00–07:00", status: "closed",  tz: "AEST" },
  { name: "Tokyo",    hours: "00:00–09:00", status: "closed",  tz: "JST" },
  { name: "London",   hours: "08:00–17:00", status: "open",    tz: "BST" },
  { name: "New York", hours: "13:00–22:00", status: "overlap", tz: "EST" },
];
const SESSION_COLOR: Record<string, string> = {
  open: C.positive, closed: "hsl(0,0%,30%)", overlap: C.amber,
};
const SESSION_LABEL: Record<string, string> = {
  open: "Open", closed: "Closed", overlap: "Active",
};

function SessionRow({ s }: { s: Session }) {
  const color = SESSION_COLOR[s.status];
  return (
    <div
      className="flex items-center justify-between py-2.5"
      style={{ borderBottom: `1px solid ${C.border}` }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
          style={{ background: color }}
        />
        <div>
          <p className="text-xs font-mono font-semibold" style={{ color: C.text }}>{s.name}</p>
          <p className="text-[10px] font-mono" style={{ color: C.muted }}>{s.hours} {s.tz}</p>
        </div>
      </div>
      <span
        className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
        style={{ color, background: `${color}12`, border: `1px solid ${color}28` }}
      >
        {SESSION_LABEL[s.status]}
      </span>
    </div>
  );
}

/* ── Demo account ─────────────────────────────────────────────────── */
function DemoSummary() {
  const items = [
    { label: "Balance",     value: "$10,000.00", color: C.text },
    { label: "Equity",      value: "$10,284.50", color: C.positive },
    { label: "Open P&L",    value: "+$284.50",   color: C.positive },
    { label: "Margin Used", value: "$1,200.00",  color: C.amber },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(it => (
        <div
          key={it.label}
          className="rounded-xl px-3 py-2.5"
          style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}
        >
          <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: C.muted }}>
            {it.label}
          </p>
          <p className="text-sm font-mono font-bold" style={{ color: it.color }}>{it.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ── AI insight card ──────────────────────────────────────────────── */
interface Insight { icon: React.ElementType; title: string; body: string; tag: string; tagColor: string }
const AI_INSIGHTS: Insight[] = [
  { icon: Bitcoin,  title: "Crypto",   body: "BTC holding $65K support with bullish structure. ETH showing relative strength.",  tag: "Bullish", tagColor: C.positive },
  { icon: Globe,    title: "Forex",    body: "DXY strength pressuring EUR/USD near 1.0820. GBP remains range-bound.",              tag: "Neutral", tagColor: C.amber },
  { icon: BarChart2,title: "Equities", body: "SPX consolidating near ATH. Tech leading. Watch for breakout above 5,300.",          tag: "Watch",   tagColor: C.sub },
];

function InsightCard({ item }: { item: Insight }) {
  const Icon = item.icon;
  return (
    <Link href="/ai">
      <div
        className="rounded-2xl p-4 cursor-pointer transition-colors duration-150"
        style={CARD}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = C.border;
        }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <span
            className="h-7 w-7 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: "hsl(0,0%,60%)" }} />
          </span>
          <p className="text-xs font-mono font-semibold" style={{ color: C.text }}>{item.title}</p>
          <span
            className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-full"
            style={{ color: item.tagColor, background: `${item.tagColor}12`, border: `1px solid ${item.tagColor}25` }}
          >
            {item.tag}
          </span>
        </div>
        <p className="text-[11px] font-mono leading-relaxed" style={{ color: C.sub }}>{item.body}</p>
      </div>
    </Link>
  );
}

/* ── Recent backtest row ──────────────────────────────────────────── */
function RecentRow({ bt }: { bt: any }) {
  const isPos = (bt.totalReturn ?? 0) >= 0;
  return (
    <Link href={`/backtests/${bt.id}`}>
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 cursor-pointer group"
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = C.surfaceHover;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "";
        }}
      >
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: isPos ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
            border: `1px solid ${isPos ? "rgba(52,211,153,0.16)" : "rgba(248,113,113,0.16)"}`,
          }}
        >
          {isPos
            ? <TrendingUp className="h-3.5 w-3.5" style={{ color: C.positive }} />
            : <TrendingDown className="h-3.5 w-3.5" style={{ color: C.negative }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: C.text }}>
            {bt.strategyName || `Strategy #${bt.strategyId}`}
          </p>
          <p className="text-[11px] font-mono" style={{ color: C.muted }}>
            {bt.symbol} · {bt.startDate?.slice(0, 7)}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold font-mono" style={{ color: isPos ? C.positive : C.negative }}>
            {fmtPct(bt.totalReturn)}
          </p>
          <p className="text-[10px] font-mono" style={{ color: C.muted }}>
            WR: {bt.winRate != null ? `${bt.winRate.toFixed(0)}%` : "—"}
          </p>
        </div>
        <ArrowUpRight
          className="h-3.5 w-3.5 opacity-0 group-hover:opacity-30 transition-opacity flex-shrink-0"
          style={{ color: C.sub }}
        />
      </div>
    </Link>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetBacktestSummary();
  const { data: backtests, isLoading: loadingBacktests } = useListBacktests();
  const isLoading = loadingSummary || loadingBacktests;

  const analytics = useMemo(() => {
    if (!backtests?.length) return null;
    const completed = backtests.filter((b: any) => b.status === "complete");
    if (!completed.length) return null;
    const wins = completed.filter((b: any) => (b.totalReturn ?? 0) > 0);
    const nums = (fn: (b: any) => number) => completed.map(fn);
    const avg = (arr: number[]) => arr.length ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : 0;
    const allReturns = nums((b: any) => b.totalReturn ?? 0);
    const allPf = nums((b: any) => b.profitFactor ?? 0).filter((v: number) => v > 0);
    const allWr = nums((b: any) => b.winRate ?? 0).filter((v: number) => v > 0);
    const allSharpe = nums((b: any) => b.sharpeRatio ?? 0);
    const allDd = nums((b: any) => b.maxDrawdown ?? 0);
    return {
      wins,
      avgWR: avg(allWr),
      avgPF: avg(allPf),
      avgSharpe: avg(allSharpe),
      avgDD: avg(allDd),
      bestReturn: Math.max(...allReturns),
    };
  }, [backtests]);

  const recentBacktests = useMemo(
    () => (backtests ?? []).filter((b: any) => b.status === "complete").slice(0, 6),
    [backtests],
  );

  return (
    <div className="flex flex-col gap-4 pb-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "hsl(0,0%,88%)" }}>
            Dashboard
          </h1>
          <p className="text-xs mt-0.5 font-mono" style={{ color: C.muted }}>
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

      {/* Market overview bar */}
      <Panel>
        <SectionLabel>Market Overview</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {WATCHLIST.map(w => (
            <div
              key={w.symbol}
              className="rounded-xl px-3 py-2 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}
            >
              <p className="text-[10px] font-mono mb-1" style={{ color: C.muted }}>{w.symbol}</p>
              <p className="text-sm font-mono font-bold" style={{ color: C.text }}>{w.price}</p>
              <p className="text-[11px] font-mono font-semibold"
                style={{ color: w.change >= 0 ? C.positive : C.negative }}>
                {w.change >= 0 ? "+" : ""}{w.change.toFixed(2)}%
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <StatCard icon={TrendingUp} label="Best Return" accent={C.positive}
          value={isLoading ? null : fmtPct(summary?.bestReturn)} isLoading={isLoading} />
        <StatCard icon={Percent} label="Avg Win Rate"
          value={isLoading ? null : analytics ? `${analytics.avgWR.toFixed(1)}%` : "—"} isLoading={isLoading} />
        <StatCard icon={Target} label="Profit Factor"
          value={isLoading ? null : analytics ? fmtNum(analytics.avgPF) : "—"} isLoading={isLoading} />
        <StatCard icon={Zap} label="Avg Sharpe"
          value={isLoading ? null : analytics ? fmtNum(analytics.avgSharpe) : "—"} isLoading={isLoading} />
        <StatCard icon={Clock} label="Total Backtests"
          value={isLoading ? null : (summary?.totalBacktests ?? 0)} isLoading={isLoading} />
        <StatCard icon={Shield} label="Avg Drawdown" accent={C.negative}
          value={isLoading ? null : analytics ? `-${Math.abs(analytics.avgDD).toFixed(1)}%` : "—"} isLoading={isLoading} />
        <StatCard icon={DollarSign} label="Best Trade" accent={C.positive}
          value={isLoading ? null : analytics ? fmtPct(analytics.bestReturn) : "—"} isLoading={isLoading} />
        <StatCard icon={Activity} label="Total Trades"
          value={isLoading ? null : (summary?.totalTrades ?? 0)} isLoading={isLoading} />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Watchlist */}
        <Panel>
          <div className="flex items-center justify-between mb-1">
            <SectionLabel>Watchlist</SectionLabel>
            <Link href="/chart">
              <span
                className="text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-opacity hover:opacity-70 mb-3"
                style={{ color: C.sub }}
              >
                <CandlestickChart className="h-3 w-3" />
                View Charts
              </span>
            </Link>
          </div>
          <div>
            {WATCHLIST.map((w, i) => (
              <div key={w.symbol} style={i === WATCHLIST.length - 1 ? { borderBottom: "none" } : {}}>
                <WatchRow item={w} />
              </div>
            ))}
          </div>
        </Panel>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <Panel>
            <SectionLabel>Trading Sessions</SectionLabel>
            <div>
              {SESSIONS.map((s, i) => (
                <div key={s.name} style={i === SESSIONS.length - 1 ? { borderBottom: "none" } : {}}>
                  <SessionRow s={s} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Demo Account</SectionLabel>
              <Link href="/demo">
                <span className="text-[10px] font-mono cursor-pointer transition-opacity hover:opacity-70"
                  style={{ color: C.sub }}>
                  Open Demo →
                </span>
              </Link>
            </div>
            <DemoSummary />
          </Panel>
        </div>
      </div>

      {/* AI Insights */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5" style={{ color: C.sub }} />
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.muted }}>
              AI Insights
            </p>
          </div>
          <Link href="/ai">
            <span className="text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: C.sub }}>
              Full Analysis <ArrowUpRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {AI_INSIGHTS.map(item => <InsightCard key={item.title} item={item} />)}
        </div>
      </div>

      {/* Recent backtests */}
      <Panel>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Recent Backtests</SectionLabel>
          <Link href="/backtests">
            <span className="text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: C.sub }}>
              View All <ArrowUpRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => <Skel key={i} className="h-11" />)}
          </div>
        ) : recentBacktests.length ? (
          <div>
            {recentBacktests.map((bt: any) => <RecentRow key={bt.id} bt={bt} />)}
          </div>
        ) : (
          <div className="py-10 text-center">
            <BarChart2 className="h-8 w-8 mx-auto mb-3 opacity-15" style={{ color: C.sub }} />
            <p className="text-sm font-mono" style={{ color: C.muted }}>No backtests yet</p>
            <Link href="/backtests/new">
              <Button variant="outline" size="sm" className="mt-3">Run your first backtest</Button>
            </Link>
          </div>
        )}
      </Panel>

    </div>
  );
}
