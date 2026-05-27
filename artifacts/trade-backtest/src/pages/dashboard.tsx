import React, { useMemo, useState } from "react";
import { useGetBacktestSummary, useListBacktests } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Target, Shield,
  Clock, BarChart2, Zap, Activity, ArrowUpRight, Play,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

/* ── helpers ─────────────────────────────────────────────────────── */
function fmtPct(v: number | null | undefined, sign = true) {
  if (v == null) return "—";
  return `${sign && v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtNum(v: number | null | undefined, d = 2) {
  if (v == null) return "—";
  return v.toFixed(d);
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1], delay: i * 0.045 }
  }),
};

/* ── Stat Card ───────────────────────────────────────────────────── */
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
      className="relative overflow-hidden rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
        border: "1px solid rgba(255,255,255,0.075)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04)",
        transition: "box-shadow 0.25s ease, border-color 0.25s ease, transform 0.2s ease",
      }}
      whileHover={{
        y: -2,
        boxShadow: accent
          ? `0 0 0 1px ${accent}30, 0 0 24px ${accent}12, 0 8px 28px rgba(0,0,0,0.35)`
          : "0 8px 28px rgba(0,0,0,0.35)",
      }}
    >
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}45, transparent)` }} />
      )}
      <div className="flex items-center justify-between">
        <span
          className="h-9 w-9 flex items-center justify-center rounded-xl"
          style={{ background: `${iconColor}12`, border: `1px solid ${iconColor}22` }}
        >
          <Icon className="h-[15px] w-[15px]" style={{ color: iconColor }} />
        </span>
        {sub && !isLoading && (
          <span className="text-[10px] font-mono" style={{ color: "hsl(218,12%,40%)" }}>{sub}</span>
        )}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "hsl(218,12%,38%)" }}>{label}</p>
        {isLoading ? (
          <div className="skeleton-shimmer h-7 w-20 rounded-lg" />
        ) : (
          <p className="text-[22px] font-bold font-mono leading-none"
            style={accent ? { color: accent } : { color: "hsl(218,14%,88%)" }}>
            {value}
          </p>
        )}
      </div>
    </motion.div>
  );
}

/* ── SVG Donut ───────────────────────────────────────────────────── */
function DonutChart({ segments, size = 148 }: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
}) {
  const r = 52; const ri = 33;
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
    const ix2 = cx + ri * Math.cos(startAngle); const iy2 = cy + ri * Math.sin(startAngle);
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
      <circle cx={cx} cy={cy} r={ri - 2} fill="rgba(255,255,255,0.018)" />
      {arcs.map((arc, i) => (
        <g key={i}>
          <path d={arc.path} fill={arc.color} opacity={0.9} />
          {arc.pct >= 10 && (
            <text x={arc.labelX} y={arc.labelY} textAnchor="middle" dominantBaseline="central"
              fill="rgba(255,255,255,0.9)" fontSize="10" fontWeight="700" fontFamily="monospace">
              {arc.pct}%
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ── Recent backtest row ─────────────────────────────────────────── */
function RecentRow({ bt, i }: { bt: any; i: number }) {
  const isPos = bt.totalReturn != null && bt.totalReturn >= 0;
  return (
    <motion.div custom={i} variants={fadeUp} initial="hidden" animate="show">
      <Link href={`/backtests/${bt.id}`}>
        <div
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 cursor-pointer group"
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
            className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: isPos ? "rgba(52,211,153,0.09)" : "rgba(239,68,68,0.09)",
              border: `1px solid ${isPos ? "rgba(52,211,153,0.18)" : "rgba(239,68,68,0.18)"}`,
            }}
          >
            {isPos
              ? <TrendingUp className="h-3.5 w-3.5" style={{ color: "#34d399" }} />
              : <TrendingDown className="h-3.5 w-3.5" style={{ color: "#f87171" }} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "hsl(218,14%,82%)" }}>
              {bt.strategyName || `Strategy #${bt.strategyId}`}
            </p>
            <p className="text-[11px] font-mono" style={{ color: "hsl(218,12%,40%)" }}>
              {bt.symbol} · {bt.startDate?.slice(0, 7)} → {bt.endDate?.slice(0, 7)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-sm font-bold font-mono ${isPos ? "text-emerald-400" : "text-red-400"}`}>
              {fmtPct(bt.totalReturn)}
            </p>
            <p className="text-[10px] font-mono" style={{ color: "hsl(218,12%,38%)" }}>
              WR: {bt.winRate != null ? `${bt.winRate.toFixed(0)}%` : "—"}
            </p>
          </div>
          <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-35 transition-opacity shrink-0"
            style={{ color: "hsl(218,12%,55%)" }} />
        </div>
      </Link>
    </motion.div>
  );
}

/* ── Custom tooltip ──────────────────────────────────────────────── */
function ChartTip({ active, payload, label, prefix = "", suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs font-mono shadow-xl"
      style={{
        background: "rgba(12,15,24,0.96)",
        border: "1px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(16px)",
      }}>
      <p style={{ color: "hsl(218,12%,48%)", marginBottom: 4 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || "hsl(210,90%,65%)" }}>
          {p.name}: {prefix}{typeof p.value === "number" ? p.value.toFixed(2) : p.value}{suffix}
        </p>
      ))}
    </div>
  );
}

/* ── Section header ─────────────────────────────────────────────── */
function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(218,12%,38%)" }}>{label}</p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: "hsl(218,12%,32%)" }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ── Panel wrapper ───────────────────────────────────────────────── */
function Panel({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      custom={delay}
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className={`rounded-2xl p-5 ${className}`}
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.014))",
        border: "1px solid rgba(255,255,255,0.072)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetBacktestSummary();
  const { data: backtests, isLoading: loadingBacktests } = useListBacktests();
  const [tradeFilter, setTradeFilter] = useState<"all" | "wins" | "losses">("all");

  const isLoading = loadingSummary || loadingBacktests;

  const analytics = useMemo(() => {
    if (!backtests?.length) return null;
    const completed = backtests.filter(b => b.status === "complete");
    if (!completed.length) return null;

    const wins = completed.filter(b => (b.totalReturn ?? 0) > 0);
    const losses = completed.filter(b => (b.totalReturn ?? 0) <= 0);

    const allReturns = completed.map(b => b.totalReturn ?? 0);
    const allDd = completed.map(b => b.maxDrawdown ?? 0);
    const allPf = completed.map(b => b.profitFactor ?? 0).filter((v: number) => v > 0);
    const allWr = completed.map(b => b.winRate ?? 0).filter((v: number) => v > 0);
    const allSharpe = completed.map(b => b.sharpeRatio ?? 0);

    const avgReturn  = allReturns.reduce((a: number, b: number) => a + b, 0) / allReturns.length;
    const avgDD      = allDd.reduce((a: number, b: number) => a + b, 0) / allDd.length;
    const avgPF      = allPf.length ? allPf.reduce((a: number, b: number) => a + b, 0) / allPf.length : 0;
    const avgWR      = allWr.length ? allWr.reduce((a: number, b: number) => a + b, 0) / allWr.length : 0;
    const avgSharpe  = allSharpe.reduce((a: number, b: number) => a + b, 0) / allSharpe.length;
    const bestReturn = Math.max(...allReturns);
    const worstReturn = Math.min(...allReturns);

    const monthlyMap = new Map<string, { returns: number[]; count: number }>();
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

    let capital = 10000;
    const equityCurve = completed
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
      .map((bt, idx) => {
        capital = capital * (1 + (bt.totalReturn ?? 0) / 100);
        return { idx: idx + 1, label: `#${idx + 1}`, value: Math.round(capital * 100) / 100, ret: bt.totalReturn ?? 0 };
      });

    const symbolMap = new Map<string, number>();
    completed.forEach(b => symbolMap.set(b.symbol, (symbolMap.get(b.symbol) ?? 0) + 1));
    const symbolData = Array.from(symbolMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, value]) => ({ name: name.replace("/USDT", "").replace("USDT", ""), value }));

    return { wins, losses, completed, avgReturn, avgDD, avgPF, avgWR, avgSharpe, bestReturn, worstReturn, monthlyData, equityCurve, symbolData };
  }, [backtests]);

  const filteredRecent = useMemo(() => {
    if (!backtests) return [];
    return backtests
      .filter(b => b.status === "complete")
      .filter(b => {
        if (tradeFilter === "wins") return (b.totalReturn ?? 0) > 0;
        if (tradeFilter === "losses") return (b.totalReturn ?? 0) <= 0;
        return true;
      })
      .slice(0, 8);
  }, [backtests, tradeFilter]);

  const SYM_COLORS = [
    "hsl(210,90%,60%)", "hsl(150,80%,52%)", "hsl(38,95%,58%)",
    "hsl(270,75%,65%)", "hsl(0,78%,60%)", "hsl(200,85%,55%)",
  ];

  const finalEquity = analytics?.equityCurve.at(-1)?.value;
  const equityGainPct = finalEquity ? ((finalEquity - 10000) / 10000) * 100 : null;

  return (
    <div className="space-y-5 pb-4">

      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, hsl(218,16%,88%) 40%, hsl(210,90%,65%))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
            Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(218,12%,42%)" }}>
            Performance overview across all backtests
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href="/backtests/new">
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Run Backtest
          </Link>
        </Button>
      </motion.div>

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <StatCard icon={DollarSign} iconColor="#34d399" label="Best Return" delay={0}
          value={isLoading ? null : fmtPct(summary?.bestReturn)} accent="#34d399" isLoading={isLoading} />
        <StatCard icon={Percent} iconColor="hsl(210,90%,62%)" label="Avg Win Rate" delay={1}
          value={isLoading ? null : analytics ? `${analytics.avgWR.toFixed(1)}%` : "—"}
          accent="hsl(210,90%,62%)" isLoading={isLoading} />
        <StatCard icon={Target} iconColor="hsl(38,95%,58%)" label="Avg Profit Factor" delay={2}
          value={isLoading ? null : analytics ? fmtNum(analytics.avgPF) : "—"}
          accent="hsl(38,95%,58%)" isLoading={isLoading} />
        <StatCard icon={Zap} iconColor="hsl(270,75%,65%)" label="Avg Sharpe" delay={3}
          value={isLoading ? null : analytics ? fmtNum(analytics.avgSharpe) : "—"} isLoading={isLoading} />
        <StatCard icon={Clock} iconColor="hsl(218,12%,52%)" label="Total Backtests" delay={4}
          value={isLoading ? null : (summary?.totalBacktests ?? 0)} isLoading={isLoading} />
        <StatCard icon={Shield} iconColor="#f87171" label="Avg Max Drawdown" delay={5}
          value={isLoading ? null : analytics ? `-${Math.abs(analytics.avgDD).toFixed(1)}%` : "—"}
          accent="#f87171" isLoading={isLoading} />
        <StatCard icon={TrendingUp} iconColor="#34d399" label="Best Trade" delay={6}
          value={isLoading ? null : analytics ? fmtPct(analytics.bestReturn) : "—"}
          accent="#34d399" isLoading={isLoading} />
        <StatCard icon={TrendingDown} iconColor="#f87171" label="Worst Trade" delay={7}
          value={isLoading ? null : analytics ? fmtPct(analytics.worstReturn) : "—"}
          accent="#f87171" isLoading={isLoading} />
        <StatCard icon={Activity} iconColor="hsl(210,90%,62%)" label="Total Trades" delay={8}
          value={isLoading ? null : (summary?.totalTrades ?? 0)} isLoading={isLoading} />
      </div>

      {/* ── Analytics row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Win vs Loss */}
        <Panel delay={9}>
          <SectionHeader label="Win vs Loss Ratio" />
          {isLoading ? (
            <div className="h-44 flex items-center justify-center">
              <div className="skeleton-shimmer h-36 w-36 rounded-full" />
            </div>
          ) : analytics ? (
            <div className="flex items-center gap-5">
              <DonutChart segments={[
                { value: analytics.wins.length, color: "#34d399", label: "Wins" },
                { value: analytics.losses.length, color: "#f87171", label: "Losses" },
              ]} />
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-2 w-2 rounded-full" style={{ background: "#34d399", boxShadow: "0 0 6px #34d39970" }} />
                    <span className="text-xs" style={{ color: "hsl(218,12%,52%)" }}>Profitable</span>
                  </div>
                  <p className="text-[22px] font-bold font-mono text-emerald-400">{analytics.wins.length}</p>
                  <p className="text-[11px] font-mono" style={{ color: "hsl(218,12%,38%)" }}>
                    {analytics.completed.length > 0
                      ? ((analytics.wins.length / analytics.completed.length) * 100).toFixed(1)
                      : 0}% of runs
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-2 w-2 rounded-full" style={{ background: "#f87171", boxShadow: "0 0 6px #f8717170" }} />
                    <span className="text-xs" style={{ color: "hsl(218,12%,52%)" }}>Loss-making</span>
                  </div>
                  <p className="text-[22px] font-bold font-mono text-red-400">{analytics.losses.length}</p>
                  <p className="text-[11px] font-mono" style={{ color: "hsl(218,12%,38%)" }}>
                    {analytics.completed.length > 0
                      ? ((analytics.losses.length / analytics.completed.length) * 100).toFixed(1)
                      : 0}% of runs
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-sm" style={{ color: "hsl(218,12%,32%)" }}>No data yet</div>
          )}
        </Panel>

        {/* Symbol Distribution */}
        <Panel delay={10}>
          <SectionHeader label="Symbol Distribution" />
          {isLoading ? (
            <div className="h-44 flex items-center justify-center">
              <div className="skeleton-shimmer h-36 w-36 rounded-full" />
            </div>
          ) : analytics?.symbolData?.length ? (
            <div className="flex items-center gap-5">
              <DonutChart segments={analytics.symbolData.map((s, i) => ({
                value: s.value, color: SYM_COLORS[i % SYM_COLORS.length], label: s.name
              }))} />
              <div className="flex-1 space-y-2">
                {analytics.symbolData.slice(0, 4).map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ background: SYM_COLORS[i % SYM_COLORS.length] }} />
                      <span className="text-xs font-mono" style={{ color: "hsl(218,12%,62%)" }}>{s.name}</span>
                    </div>
                    <span className="text-xs font-mono font-bold" style={{ color: SYM_COLORS[i % SYM_COLORS.length] }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-sm" style={{ color: "hsl(218,12%,32%)" }}>No data yet</div>
          )}
        </Panel>
      </div>

      {/* ── Equity Curve ──────────────────────────────────────── */}
      <Panel delay={11}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(218,12%,38%)" }}>
              Cumulative Equity Curve
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "hsl(218,12%,32%)" }}>
              Simulated $10,000 starting capital across all backtests
            </p>
          </div>
          {finalEquity && (
            <div className="text-right">
              <p className="text-sm font-mono font-bold" style={{ color: equityGainPct && equityGainPct >= 0 ? "#34d399" : "#f87171" }}>
                ${finalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] font-mono" style={{ color: "hsl(218,12%,40%)" }}>
                {fmtPct(equityGainPct)}
              </p>
            </div>
          )}
        </div>
        {isLoading ? (
          <div className="skeleton-shimmer h-44 w-full rounded-xl" />
        ) : analytics?.equityCurve?.length ? (
          <ResponsiveContainer width="100%" height={176}>
            <AreaChart data={analytics.equityCurve} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="hsl(210,90%,60%)" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="hsl(210,90%,60%)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.045)" />
              <XAxis dataKey="label" tick={{ fill: "hsl(218,12%,36%)", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(218,12%,36%)", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={52}
                tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
              <RechartsTooltip content={<ChartTip prefix="$" />} />
              <Area type="monotone" dataKey="value" name="Equity" stroke="hsl(210,90%,60%)" strokeWidth={1.5}
                fill="url(#eqGrad)" dot={false} activeDot={{ r: 3, fill: "hsl(210,90%,60%)" }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-44 flex items-center justify-center text-sm" style={{ color: "hsl(218,12%,32%)" }}>
            Run backtests to see your equity curve
          </div>
        )}
      </Panel>

      {/* ── Monthly Returns ────────────────────────────────────── */}
      {(analytics?.monthlyData?.length ?? 0) > 0 && (
        <Panel delay={12}>
          <SectionHeader label="Monthly Performance" sub="Average return per calendar month" />
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={analytics!.monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "hsl(218,12%,36%)", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(218,12%,36%)", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} width={32}
                tickFormatter={v => `${v.toFixed(0)}%`} />
              <RechartsTooltip content={<ChartTip suffix="%" />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
              <Bar dataKey="avg" name="Avg Return" radius={[4, 4, 0, 0]}
                fill="hsl(210,90%,60%)"
                label={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      {/* ── Recent backtests ───────────────────────────────────── */}
      <Panel delay={13}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(218,12%,38%)" }}>
            Recent Backtests
          </p>
          <div className="flex items-center gap-0.5 rounded-xl p-0.5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {(["all", "wins", "losses"] as const).map(f => (
              <button key={f} onClick={() => setTradeFilter(f)}
                className="px-2.5 py-1 text-[10px] font-mono rounded-lg capitalize transition-all"
                style={tradeFilter === f
                  ? { background: "rgba(59,130,246,0.15)", color: "hsl(210,90%,65%)" }
                  : { color: "hsl(218,12%,42%)" }}>
                {f}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="skeleton-shimmer h-14 w-full rounded-xl" />)}
          </div>
        ) : filteredRecent.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-3 text-center">
            <BarChart2 className="h-8 w-8 opacity-15" />
            <p className="text-sm" style={{ color: "hsl(218,12%,35%)" }}>No backtests yet</p>
            <Button size="sm" asChild><Link href="/backtests/new">Run your first backtest</Link></Button>
          </div>
        ) : (
          <div>
            {filteredRecent.map((bt, i) => <RecentRow key={bt.id} bt={bt} i={i} />)}
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <Link href="/backtests">
                <span className="flex items-center justify-center gap-1.5 text-xs font-mono transition-all cursor-pointer"
                  style={{ color: "hsl(210,90%,62%)" }}>
                  View all in Journal
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
