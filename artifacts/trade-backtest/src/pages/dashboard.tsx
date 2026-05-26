import React, { useMemo, useState } from "react";
import { useGetBacktestSummary, useListBacktests } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Target, Shield,
  Clock, BarChart2, Zap, Activity, ChevronUp, ChevronDown,
  ArrowUpRight, Search, Filter, ExternalLink, Play
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ── Helpers ────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined, sign = true) {
  if (v == null) return "—";
  return `${sign && v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtUSD(v: number | null | undefined) {
  if (v == null) return "—";
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtNum(v: number | null | undefined, d = 2) {
  if (v == null) return "—";
  return v.toFixed(d);
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }
  }),
};

// ── Micro Components ─────────────────────────────────────────────

function StatCard({
  icon: Icon, iconColor, label, value, sub, accent, delay = 0, isLoading = false
}: {
  icon: React.ElementType; iconColor: string; label: string; value: React.ReactNode;
  sub?: string; accent?: string; delay?: number; isLoading?: boolean;
}) {
  return (
    <motion.div
      custom={delay}
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="relative overflow-hidden rounded-2xl p-4 flex flex-col gap-3 group cursor-default"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(20px)",
        transition: "border-color 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease",
      }}
      whileHover={{
        y: -2,
        borderColor: accent ? `${accent}40` : "rgba(255,255,255,0.14)",
        boxShadow: accent ? `0 0 30px ${accent}15, 0 8px 32px rgba(0,0,0,0.4)` : "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}50, transparent)` }} />
      )}
      <div className="flex items-center justify-between">
        <span
          className="h-9 w-9 flex items-center justify-center rounded-xl"
          style={{ background: `${iconColor}15`, border: `1px solid ${iconColor}25` }}
        >
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </span>
        {sub && !isLoading && (
          <span className="text-[11px] font-mono" style={{ color: "hsl(220,14%,42%)" }}>{sub}</span>
        )}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "hsl(220,14%,40%)" }}>{label}</p>
        {isLoading ? (
          <div className="skeleton-shimmer h-7 w-24 rounded" />
        ) : (
          <p className="text-2xl font-bold font-mono leading-none" style={accent ? { color: accent } : { color: "hsl(220,14%,90%)" }}>
            {value}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── SVG Donut Chart (reliable, no Recharts) ───────────────────────

function DonutChart({ segments, size = 160 }: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
}) {
  const r = 54; const ri = 34;
  const cx = size / 2; const cy = size / 2;
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  let startAngle = -Math.PI / 2;
  const arcs = segments.map(seg => {
    const angle = (seg.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle); const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);   const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + ri * Math.cos(endAngle); const iy1 = cy + ri * Math.sin(endAngle);
    const ix2 = cx + ri * Math.cos(startAngle);const iy2 = cy + ri * Math.sin(startAngle);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ri} ${ri} 0 ${large} 0 ${ix2} ${iy2} Z`;
    const midA = startAngle + angle / 2;
    const labelX = cx + (r + ri) / 2 * Math.cos(midA);
    const labelY = cy + (r + ri) / 2 * Math.sin(midA);
    const pct = Math.round((seg.value / total) * 100);
    startAngle = endAngle;
    return { path, color: seg.color, pct, labelX, labelY, angle };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
      <circle cx={cx} cy={cy} r={ri - 2} fill="rgba(255,255,255,0.02)" />
      {arcs.map((arc, i) => (
        <g key={i}>
          <path d={arc.path} fill={arc.color} opacity={0.92} />
          {arc.pct >= 8 && (
            <text x={arc.labelX} y={arc.labelY} textAnchor="middle" dominantBaseline="central"
              fill="rgba(255,255,255,0.9)" fontSize="10" fontWeight="700" fontFamily="monospace"
            >
              {arc.pct}%
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ── Recent Backtests Row ──────────────────────────────────────────

function RecentRow({ bt, i }: { bt: any; i: number }) {
  const isPos = bt.totalReturn != null && bt.totalReturn >= 0;
  return (
    <motion.div
      custom={i}
      variants={fadeUp}
      initial="hidden"
      animate="show"
    >
      <Link href={`/backtests/${bt.id}`}>
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 cursor-pointer group"
          style={{ border: "1px solid transparent" }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor = "transparent";
          }}
        >
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: isPos ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              border: `1px solid ${isPos ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
            }}
          >
            {isPos
              ? <TrendingUp className="h-3.5 w-3.5" style={{ color: "#22c55e" }} />
              : <TrendingDown className="h-3.5 w-3.5" style={{ color: "#ef4444" }} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "hsl(220,14%,85%)" }}>
              {bt.strategyName || `Strategy #${bt.strategyId}`}
            </p>
            <p className="text-[11px] font-mono" style={{ color: "hsl(220,14%,42%)" }}>
              {bt.symbol} · {bt.startDate?.slice(0, 7)} → {bt.endDate?.slice(0, 7)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-sm font-bold font-mono ${isPos ? "text-green-400" : "text-red-400"}`}>
              {fmtPct(bt.totalReturn)}
            </p>
            <p className="text-[10px] font-mono" style={{ color: "hsl(220,14%,40%)" }}>
              WR: {bt.winRate != null ? `${bt.winRate.toFixed(0)}%` : "—"}
            </p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" style={{ color: "hsl(220,14%,60%)" }} />
        </div>
      </Link>
    </motion.div>
  );
}

// ── Custom Recharts Tooltip ───────────────────────────────────────

function ChartTooltip({ active, payload, label, prefix = "", suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs font-mono shadow-xl" style={{
      background: "rgba(8,10,18,0.95)",
      border: "1px solid rgba(255,255,255,0.1)",
      backdropFilter: "blur(16px)",
    }}>
      <p style={{ color: "hsl(220,14%,50%)", marginBottom: 4 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || "hsl(190,90%,60%)" }}>
          {p.name}: {prefix}{typeof p.value === "number" ? p.value.toFixed(2) : p.value}{suffix}
        </p>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetBacktestSummary();
  const { data: backtests, isLoading: loadingBacktests } = useListBacktests();
  const [tradeFilter, setTradeFilter] = useState<"all" | "wins" | "losses">("all");
  const [searchQ, setSearchQ] = useState("");

  const isLoading = loadingSummary || loadingBacktests;

  // ── Analytics derived from backtests ──────────────────────────
  const analytics = useMemo(() => {
    if (!backtests?.length) return null;
    const completed = backtests.filter(b => b.status === "complete");
    if (!completed.length) return null;

    const wins = completed.filter(b => (b.totalReturn ?? 0) > 0);
    const losses = completed.filter(b => (b.totalReturn ?? 0) <= 0);
    const longs = completed.filter(b => b.symbol.endsWith("USDT"));
    const shorts = completed.filter(b => !b.symbol.endsWith("USDT"));

    const allReturns = completed.map(b => b.totalReturn ?? 0);
    const allDd = completed.map(b => b.maxDrawdown ?? 0);
    const allPf = completed.map(b => b.profitFactor ?? 0).filter(v => v > 0);
    const allWr = completed.map(b => b.winRate ?? 0).filter(v => v > 0);
    const allSharpe = completed.map(b => b.sharpeRatio ?? 0);

    const avgReturn = allReturns.reduce((a, b) => a + b, 0) / allReturns.length;
    const avgDD = allDd.reduce((a, b) => a + b, 0) / allDd.length;
    const avgPF = allPf.length ? allPf.reduce((a, b) => a + b, 0) / allPf.length : 0;
    const avgWR = allWr.length ? allWr.reduce((a, b) => a + b, 0) / allWr.length : 0;
    const avgSharpe = allSharpe.reduce((a, b) => a + b, 0) / allSharpe.length;
    const bestReturn = Math.max(...allReturns);
    const worstReturn = Math.min(...allReturns);

    // Monthly aggregate
    const monthlyMap = new Map<string, { returns: number[], count: number }>();
    for (const bt of completed) {
      const m = bt.endDate?.slice(0, 7) ?? "unknown";
      const entry = monthlyMap.get(m) ?? { returns: [], count: 0 };
      entry.returns.push(bt.totalReturn ?? 0);
      entry.count++;
      monthlyMap.set(m, entry);
    }
    const monthlyData = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, d]) => ({
        month,
        label: format(new Date(month + "-01"), "MMM yy"),
        avg: d.returns.reduce((a, b) => a + b, 0) / d.returns.length,
        count: d.count,
      }));

    // Cumulative equity curve (simulate $10k starting)
    let capital = 10000;
    const equityCurve = completed
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
      .map((bt, idx) => {
        capital = capital * (1 + (bt.totalReturn ?? 0) / 100);
        return {
          idx: idx + 1,
          label: `#${idx + 1}`,
          value: Math.round(capital * 100) / 100,
          ret: bt.totalReturn ?? 0,
        };
      });

    return {
      wins, losses, longs, shorts, completed,
      avgReturn, avgDD, avgPF, avgWR, avgSharpe,
      bestReturn, worstReturn, monthlyData, equityCurve,
    };
  }, [backtests]);

  // ── Filtered backtests for recent table ───────────────────────
  const filteredRecent = useMemo(() => {
    if (!backtests) return [];
    return backtests
      .filter(b => b.status === "complete")
      .filter(b => {
        if (tradeFilter === "wins") return (b.totalReturn ?? 0) > 0;
        if (tradeFilter === "losses") return (b.totalReturn ?? 0) <= 0;
        return true;
      })
      .filter(b => {
        if (!searchQ) return true;
        const q = searchQ.toLowerCase();
        return (
          (b.strategyName ?? "").toLowerCase().includes(q) ||
          b.symbol.toLowerCase().includes(q) ||
          b.startDate?.includes(q) ||
          b.endDate?.includes(q)
        );
      })
      .slice(0, 8);
  }, [backtests, tradeFilter, searchQ]);

  const PIE_COLORS_WL = ["#22c55e", "#ef4444"];
  const PIE_COLORS_LS = ["hsl(190,90%,55%)", "hsl(260,80%,65%)"];

  return (
    <div className="space-y-6 pb-4">
      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{
            background: "linear-gradient(135deg, hsl(220,14%,90%) 40%, hsl(190,90%,55%))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(220,14%,45%)" }}>
            Performance overview across all backtests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/backtests/new">
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Run Backtest
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* ── 9 Stat Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <StatCard
          icon={DollarSign} iconColor="#22c55e"
          label="Best Return" delay={0}
          value={isLoading ? null : fmtPct(summary?.bestReturn)}
          accent="#22c55e"
          isLoading={isLoading}
        />
        <StatCard
          icon={Percent} iconColor="hsl(190,90%,55%)"
          label="Avg Win Rate" delay={1}
          value={isLoading ? null : analytics ? `${analytics.avgWR.toFixed(1)}%` : "—"}
          accent="hsl(190,90%,55%)"
          isLoading={isLoading}
        />
        <StatCard
          icon={Target} iconColor="hsl(38,100%,55%)"
          label="Avg Profit Factor" delay={2}
          value={isLoading ? null : analytics ? fmtNum(analytics.avgPF) : "—"}
          accent="hsl(38,100%,55%)"
          isLoading={isLoading}
        />
        <StatCard
          icon={Zap} iconColor="hsl(260,80%,65%)"
          label="Avg Sharpe Ratio" delay={3}
          value={isLoading ? null : analytics ? fmtNum(analytics.avgSharpe) : "—"}
          isLoading={isLoading}
        />
        <StatCard
          icon={Clock} iconColor="hsl(220,14%,55%)"
          label="Total Backtests" delay={4}
          value={isLoading ? null : (summary?.totalBacktests ?? 0)}
          isLoading={isLoading}
        />
        <StatCard
          icon={Shield} iconColor="#ef4444"
          label="Avg Max Drawdown" delay={5}
          value={isLoading ? null : analytics ? `-${Math.abs(analytics.avgDD).toFixed(1)}%` : "—"}
          accent="#ef4444"
          isLoading={isLoading}
        />
        <StatCard
          icon={TrendingUp} iconColor="#22c55e"
          label="Best Trade" delay={6}
          value={isLoading ? null : analytics ? fmtPct(analytics.bestReturn) : "—"}
          accent="#22c55e"
          isLoading={isLoading}
        />
        <StatCard
          icon={TrendingDown} iconColor="#ef4444"
          label="Worst Trade" delay={7}
          value={isLoading ? null : analytics ? fmtPct(analytics.worstReturn) : "—"}
          accent="#ef4444"
          isLoading={isLoading}
        />
        <StatCard
          icon={Activity} iconColor="hsl(190,90%,55%)"
          label="Total Trades" delay={8}
          value={isLoading ? null : (summary?.totalTrades ?? 0)}
          isLoading={isLoading}
        />
      </div>

      {/* ── Charts Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Pie 1: Win vs Loss */}
        <motion.div
          custom={9}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "hsl(220,14%,40%)" }}>Win vs Loss Ratio</p>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center"><div className="skeleton-shimmer h-40 w-40 rounded-full" /></div>
          ) : analytics ? (
            <div className="flex items-center gap-6">
              <DonutChart segments={[
                { value: analytics.wins.length, color: "#22c55e", label: "Wins" },
                { value: analytics.losses.length, color: "#ef4444", label: "Losses" },
              ]} />
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e80" }} />
                    <span className="text-xs" style={{ color: "hsl(220,14%,55%)" }}>Profitable</span>
                  </div>
                  <p className="text-2xl font-bold font-mono text-green-400">{analytics.wins.length}</p>
                  <p className="text-[11px] font-mono" style={{ color: "hsl(220,14%,40%)" }}>
                    {analytics.completed.length > 0 ? ((analytics.wins.length / analytics.completed.length) * 100).toFixed(1) : 0}% of runs
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#ef4444", boxShadow: "0 0 8px #ef444480" }} />
                    <span className="text-xs" style={{ color: "hsl(220,14%,55%)" }}>Loss-making</span>
                  </div>
                  <p className="text-2xl font-bold font-mono text-red-400">{analytics.losses.length}</p>
                  <p className="text-[11px] font-mono" style={{ color: "hsl(220,14%,40%)" }}>
                    {analytics.completed.length > 0 ? ((analytics.losses.length / analytics.completed.length) * 100).toFixed(1) : 0}% of runs
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color: "hsl(220,14%,35%)" }}>No data yet</div>
          )}
        </motion.div>

        {/* Pie 2: Symbol Distribution */}
        <motion.div
          custom={10}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "hsl(220,14%,40%)" }}>Symbol Distribution</p>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center"><div className="skeleton-shimmer h-40 w-40 rounded-full" /></div>
          ) : analytics ? (() => {
            const symbolMap = new Map<string, number>();
            analytics.completed.forEach(b => {
              symbolMap.set(b.symbol, (symbolMap.get(b.symbol) ?? 0) + 1);
            });
            const symbolData = Array.from(symbolMap.entries())
              .sort(([, a], [, b]) => b - a)
              .slice(0, 6)
              .map(([name, value]) => ({ name: name.replace("/USDT", "").replace("USDT", ""), value }));
            const COLORS = ["hsl(190,90%,55%)", "hsl(150,80%,50%)", "hsl(38,100%,55%)", "hsl(260,80%,65%)", "hsl(0,85%,62%)", "hsl(217,91%,60%)"];
            const total = symbolData.reduce((a, b) => a + b.value, 0);
            return (
              <div className="flex items-center gap-6">
                <DonutChart segments={symbolData.map((s, i) => ({ value: s.value, color: COLORS[i % COLORS.length], label: s.name }))} />
                <div className="flex-1 space-y-2">
                  {symbolData.slice(0, 4).map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-xs font-mono" style={{ color: "hsl(220,14%,65%)" }}>{s.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold" style={{ color: COLORS[i % COLORS.length] }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })() : (
            <div className="h-48 flex items-center justify-center text-sm" style={{ color: "hsl(220,14%,35%)" }}>No data yet</div>
          )}
        </motion.div>
      </div>

      {/* ── Equity Curve ───────────────────────────────────────── */}
      <motion.div
        custom={11}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="rounded-2xl p-5"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,40%)" }}>Cumulative Equity Curve</p>
            <p className="text-[11px] mt-0.5" style={{ color: "hsl(220,14%,35%)" }}>Simulated $10,000 starting capital across all backtests</p>
          </div>
          {analytics?.equityCurve.length ? (
            <div className="text-right">
              <p className={`text-xl font-bold font-mono ${analytics.equityCurve[analytics.equityCurve.length - 1].value >= 10000 ? "text-green-400" : "text-red-400"}`}>
                {fmtUSD(analytics.equityCurve[analytics.equityCurve.length - 1].value)}
              </p>
              <p className="text-[10px] font-mono" style={{ color: "hsl(220,14%,40%)" }}>Final equity</p>
            </div>
          ) : null}
        </div>
        {isLoading ? (
          <div className="skeleton-shimmer h-48 rounded-xl" />
        ) : analytics?.equityCurve.length ? (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={analytics.equityCurve} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(190,90%,55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(190,90%,55%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: "hsl(220,14%,40%)", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(220,14%,40%)", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} width={40} />
              <RechartsTooltip content={<ChartTooltip prefix="$" />} />
              <ReferenceLine y={10000} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="value" name="Equity" stroke="hsl(190,90%,55%)" strokeWidth={2} fill="url(#eqGrad)" dot={false} activeDot={{ r: 4, fill: "hsl(190,90%,55%)", strokeWidth: 2, stroke: "rgba(255,255,255,0.3)" }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-sm border border-dashed rounded-xl" style={{ borderColor: "rgba(255,255,255,0.07)", color: "hsl(220,14%,35%)" }}>
            Run some backtests to see your equity curve
          </div>
        )}
      </motion.div>

      {/* ── Monthly PnL ────────────────────────────────────────── */}
      {analytics?.monthlyData && analytics.monthlyData.length > 0 && (
        <motion.div
          custom={12}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="text-xs font-mono uppercase tracking-widest mb-5" style={{ color: "hsl(220,14%,40%)" }}>Monthly Avg Returns (%)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={analytics.monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "hsl(220,14%,40%)", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(220,14%,40%)", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(0)}%`} width={36} />
              <RechartsTooltip content={<ChartTooltip suffix="%" />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
              <Bar dataKey="avg" name="Avg Return" radius={[4, 4, 0, 0]}>
                {analytics.monthlyData.map((entry, i) => (
                  <Cell key={i} fill={entry.avg >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* ── Recent Backtests Table ──────────────────────────────── */}
      <motion.div
        custom={13}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-xs font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,40%)" }}>Recent Backtests</p>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <Search className="h-3 w-3" style={{ color: "hsl(220,14%,40%)" }} />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search…"
                className="text-xs bg-transparent outline-none w-24"
                style={{ color: "hsl(220,14%,75%)" }}
              />
            </div>
            {/* Filter pills */}
            <div className="flex items-center gap-1">
              {(["all", "wins", "losses"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTradeFilter(f)}
                  className="px-2.5 py-1 text-[10px] font-mono rounded-lg capitalize transition-all"
                  style={tradeFilter === f
                    ? { background: "rgba(0,229,255,0.12)", color: "hsl(190,90%,65%)", border: "1px solid rgba(0,229,255,0.25)" }
                    : { color: "hsl(220,14%,45%)", border: "1px solid transparent" }}
                >
                  {f}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link href="/backtests">View all →</Link>
            </Button>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y" style={{ divideColor: "rgba(255,255,255,0.04)" }}>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="skeleton-shimmer h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton-shimmer h-3 w-32 rounded" />
                  <div className="skeleton-shimmer h-2.5 w-24 rounded" />
                </div>
                <div className="skeleton-shimmer h-4 w-16 rounded" />
              </div>
            ))
          ) : filteredRecent.length > 0 ? (
            filteredRecent.map((bt, i) => <RecentRow key={bt.id} bt={bt} i={i} />)
          ) : (
            <div className="py-12 text-center text-sm" style={{ color: "hsl(220,14%,35%)" }}>
              {backtests?.filter(b => b.status === "complete").length === 0
                ? "No completed backtests yet. Run your first one!"
                : "No results match your filter."}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
