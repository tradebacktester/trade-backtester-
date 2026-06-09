import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Dna, BarChart2, Brain, Shield, BookOpen, Activity, Sparkles,
  ArrowUpRight, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Target, Zap, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useListBacktests } from "@workspace/api-client-react";
import { API_BASE } from "@/lib/api-config";

const C = {
  text:     "hsl(var(--foreground))",
  sub:      "hsl(var(--muted-foreground))",
  muted:    "hsl(var(--muted-foreground))",
  border:   "hsl(var(--border))",
  positive: "#22c55e",
  negative: "#ef4444",
  amber:    "#f59e0b",
  purple:   "#a855f7",
  cyan:     "#06b6d4",
  blue:     "#3b82f6",
};

const CARD: React.CSSProperties = {
  background: "var(--card-bg)",
  border: "1px solid hsl(var(--border))",
  boxShadow: "var(--shadow-card)",
};

const GLASS: React.CSSProperties = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
};

function Skel({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg animate-pulse ${className}`} style={{ background: "hsl(var(--muted))" }} />;
}

/* ── Tabs ─────────────────────────────────────────────────────────── */
const TABS = [
  { id: "performance",  label: "Performance",      icon: BarChart2, color: C.positive },
  { id: "sessions",     label: "Session Analysis", icon: Activity,  color: C.cyan    },
  { id: "psychology",   label: "Psychology",        icon: Brain,     color: C.purple  },
  { id: "risk",         label: "Risk Profile",      icon: Shield,    color: C.amber   },
  { id: "journal",      label: "Journal",           icon: BookOpen,  color: C.blue    },
] as const;
type TabId = typeof TABS[number]["id"];

/* ── Performance Tab ──────────────────────────────────────────────── */
function PerformanceTab() {
  const { data: backtests, isLoading } = useListBacktests();
  const completed = (backtests ?? []).filter((b: any) => b.status === "complete");

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const avgWR     = avg(completed.map((b: any) => Number(b.winRate ?? 0)));
  const avgSharpe = avg(completed.map((b: any) => Number(b.sharpeRatio ?? 0)));
  const avgDD     = avg(completed.map((b: any) => Number(b.maxDrawdown ?? 0)));
  const avgPF     = avg(completed.map((b: any) => Number(b.profitFactor ?? 0)));
  const avgReturn = avg(completed.map((b: any) => Number(b.totalReturn ?? 0)));

  const metrics = [
    { label: "Avg Win Rate",    value: isLoading ? null : `${avgWR.toFixed(1)}%`,        good: avgWR >= 50,    icon: Target },
    { label: "Avg Sharpe",      value: isLoading ? null : avgSharpe.toFixed(2),            good: avgSharpe >= 1, icon: Zap },
    { label: "Avg Return",      value: isLoading ? null : `${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(2)}%`, good: avgReturn >= 0, icon: TrendingUp },
    { label: "Avg Max Drawdown",value: isLoading ? null : `-${Math.abs(avgDD).toFixed(1)}%`, good: avgDD < 15, icon: TrendingDown },
    { label: "Profit Factor",   value: isLoading ? null : avgPF.toFixed(2),                good: avgPF >= 1.5,  icon: BarChart2 },
    { label: "Backtests Run",   value: isLoading ? null : String(completed.length),         good: true,           icon: CheckCircle2 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map(m => (
          <div key={m.label} className="rounded-2xl p-4" style={GLASS}>
            <div className="flex items-center gap-2 mb-2">
              <m.icon className="h-3.5 w-3.5" style={{ color: C.muted }} />
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.muted }}>{m.label}</p>
            </div>
            {isLoading
              ? <Skel className="h-6 w-20" />
              : <p className="text-xl font-bold font-mono" style={{ color: m.good ? C.positive : C.negative }}>
                  {m.value ?? "—"}
                </p>
            }
          </div>
        ))}
      </div>

      {!isLoading && completed.length === 0 && (
        <div className="text-center py-8" style={GLASS}>
          <BarChart2 className="h-8 w-8 mx-auto mb-2 opacity-15" style={{ color: C.muted }} />
          <p className="text-xs font-mono" style={{ color: C.muted }}>No completed backtests yet</p>
          <Link href="/backtests/new">
            <button className="mt-3 text-[11px] font-mono px-4 py-2 rounded-xl"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: C.text }}>
              Run First Backtest
            </button>
          </Link>
        </div>
      )}

      {!isLoading && completed.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={CARD}>
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid hsl(var(--border))" }}>
            <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: C.muted }}>Recent Backtests</p>
            <Link href="/backtests">
              <span className="text-[10px] font-mono flex items-center gap-1 cursor-pointer hover:opacity-70" style={{ color: C.sub }}>
                View All <ArrowUpRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          {completed.slice(0, 5).map((b: any) => {
            const ret = Number(b.totalReturn ?? 0);
            const wr  = Number(b.winRate ?? 0);
            return (
              <Link key={b.id} href={`/backtests/${b.id}`}>
                <div className="flex items-center gap-3 px-4 py-3 hover:opacity-80 cursor-pointer"
                  style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: ret >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
                    {ret >= 0
                      ? <TrendingUp className="h-4 w-4" style={{ color: C.positive }} />
                      : <TrendingDown className="h-4 w-4" style={{ color: C.negative }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: C.text }}>{b.symbol}</p>
                    <p className="text-[10px] font-mono" style={{ color: C.muted }}>
                      WR {wr.toFixed(1)}% · {b.totalTrades ?? 0} trades
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold font-mono" style={{ color: ret >= 0 ? C.positive : C.negative }}>
                      {ret >= 0 ? "+" : ""}{ret.toFixed(2)}%
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 opacity-30" style={{ color: C.muted }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Link href="/analytics">
        <div className="rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:opacity-80" style={GLASS}>
          <div className="flex items-center gap-3">
            <BarChart2 className="h-4 w-4" style={{ color: C.positive }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: C.text }}>Deep Analytics</p>
              <p className="text-[11px] font-mono" style={{ color: C.muted }}>Full performance breakdown with charts</p>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4" style={{ color: C.muted }} />
        </div>
      </Link>
    </div>
  );
}

/* ── Session Analysis Tab ─────────────────────────────────────────── */
type SessionBucket = { label: string; wins: number; losses: number; trades: number; winRate: number; totalPnl: number };
type SessionData = {
  hasData: boolean;
  totalTrades: number;
  byDay: SessionBucket[];
  bySession: SessionBucket[];
  byMarket: SessionBucket[];
};

function SessionBar({ label, winRate, totalPnl, trades, color }: { label: string; winRate: number; totalPnl: number; trades: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-[11px] font-mono w-20 flex-shrink-0" style={{ color: C.muted }}>{label}</p>
      <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full" style={{
          width: `${Math.max(3, winRate)}%`,
          background: color,
          opacity: 0.8,
          transition: "width 0.8s ease",
        }} />
      </div>
      <p className="text-[10px] font-mono w-12 text-right flex-shrink-0" style={{ color: winRate >= 50 ? C.positive : C.negative }}>
        {winRate.toFixed(0)}%
      </p>
      <p className="text-[10px] font-mono w-16 text-right flex-shrink-0"
        style={{ color: totalPnl >= 0 ? C.positive : C.negative }}>
        {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toFixed(0)}
      </p>
      <p className="text-[9px] font-mono w-10 text-right flex-shrink-0" style={{ color: C.muted }}>
        {trades}T
      </p>
    </div>
  );
}

function SessionAnalysisTab() {
  const { token } = useAuth();
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${API_BASE}/api/ai/session-analysis`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setData(d as SessionData))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) {
    return (
      <div className="text-center py-8">
        <p className="text-xs font-mono" style={{ color: C.muted }}>Sign in to view session analysis</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex flex-col gap-4">
      {[1, 2, 3].map(i => <Skel key={i} className="h-40 w-full rounded-2xl" />)}
    </div>
  );

  if (!data?.hasData) {
    return (
      <div className="rounded-2xl p-8 text-center" style={GLASS}>
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-15" style={{ color: C.muted }} />
        <p className="text-xs font-mono" style={{ color: C.muted }}>
          No paper trades yet — start trading on the Charts page to unlock session analysis
        </p>
        <Link href="/chart">
          <button className="mt-3 text-[11px] font-mono px-4 py-2 rounded-xl"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: C.text }}>
            Open Charts
          </button>
        </Link>
      </div>
    );
  }

  const sections = [
    { title: "By Day of Week",        items: data.byDay,     color: C.cyan   },
    { title: "By Trading Session",    items: data.bySession, color: C.purple },
    { title: "By Market Type",        items: data.byMarket,  color: C.amber  },
  ];

  const best = (items: SessionBucket[]) =>
    items.length ? [...items].sort((a, b) => b.winRate - a.winRate)[0] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl p-4 flex items-center gap-3" style={GLASS}>
        <Activity className="h-4 w-4 flex-shrink-0" style={{ color: C.cyan }} />
        <p className="text-xs font-mono" style={{ color: C.sub }}>
          Based on <span style={{ color: C.text, fontWeight: 600 }}>{data.totalTrades} paper trade{data.totalTrades !== 1 ? "s" : ""}</span> — paper trade on the Charts page to improve accuracy
        </p>
      </div>

      {sections.map(sec => {
        const b = best(sec.items);
        return (
          <div key={sec.title} className="rounded-2xl overflow-hidden" style={CARD}>
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: "1px solid hsl(var(--border))" }}>
              <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: C.muted }}>{sec.title}</p>
              {b && (
                <span className="text-[10px] font-mono flex items-center gap-1"
                  style={{ color: C.positive }}>
                  <CheckCircle2 className="h-3 w-3" />
                  Best: {b.label}
                </span>
              )}
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3 mb-1">
                <p className="text-[9px] font-mono w-20 flex-shrink-0" style={{ color: C.muted }}></p>
                <p className="flex-1 text-[9px] font-mono uppercase tracking-widest" style={{ color: C.muted }}>Win Rate</p>
                <p className="text-[9px] font-mono w-12 text-right flex-shrink-0" style={{ color: C.muted }}>WR%</p>
                <p className="text-[9px] font-mono w-16 text-right flex-shrink-0" style={{ color: C.muted }}>Total P&L</p>
                <p className="text-[9px] font-mono w-10 text-right flex-shrink-0" style={{ color: C.muted }}>Trades</p>
              </div>
              {sec.items.map(item => (
                <SessionBar key={item.label} {...item} color={sec.color} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Psychology Tab ───────────────────────────────────────────────── */
function PsychologyTab() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl p-5" style={GLASS}>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}>
            <Brain className="h-[18px] w-[18px]" style={{ color: C.purple }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: C.text }}>Trading Psychology Match</p>
            <p className="text-[11px] font-mono" style={{ color: C.muted }}>Discover your personality type & best-fit strategies</p>
          </div>
        </div>
        <p className="text-[12px] font-mono leading-relaxed mb-4" style={{ color: C.sub }}>
          Based on your backtest history, our AI analyzes your behavioral patterns — holding time, loss tolerance,
          trade frequency — and recommends the strategy types that best match your psychology.
        </p>
        <Link href="/psych-match">
          <div className="rounded-xl p-3 flex items-center justify-between cursor-pointer hover:opacity-80"
            style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
            <span className="text-sm font-semibold" style={{ color: C.purple }}>Open Psychology Match</span>
            <ArrowUpRight className="h-4 w-4" style={{ color: C.purple }} />
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Trend Rider",        desc: "Patient, systematic, rides momentum",      color: C.positive },
          { label: "Momentum Hunter",     desc: "Aggressive entry, fast decision-making",   color: C.amber },
          { label: "Patient Contrarian",  desc: "Mean-reversion focused, disciplined",       color: C.cyan },
        ].map(t => (
          <div key={t.label} className="rounded-2xl p-4" style={GLASS}>
            <div className="h-8 w-8 rounded-xl mb-3 flex items-center justify-center"
              style={{ background: `${t.color}12`, border: `1px solid ${t.color}25` }}>
              <Brain className="h-4 w-4" style={{ color: t.color }} />
            </div>
            <p className="text-xs font-semibold mb-1" style={{ color: C.text }}>{t.label}</p>
            <p className="text-[10px] font-mono leading-relaxed" style={{ color: C.muted }}>{t.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Risk Profile Tab ─────────────────────────────────────────────── */
function RiskTab() {
  const { data: backtests, isLoading } = useListBacktests();
  const completed = (backtests ?? []).filter((b: any) => b.status === "complete");

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const avgDD      = avg(completed.map((b: any) => Number(b.maxDrawdown ?? 0)));
  const avgSharpe  = avg(completed.map((b: any) => Number(b.sharpeRatio ?? 0)));
  const avgSortino = avg(completed.map((b: any) => Number(b.sortinoRatio ?? 0)));
  const avgCalmar  = avg(completed.map((b: any) => Number(b.calmarRatio ?? 0)));
  const maxDD      = completed.length ? Math.max(...completed.map((b: any) => Number(b.maxDrawdown ?? 0))) : 0;
  const maxConsL   = completed.length ? Math.max(...completed.map((b: any) => b.consecutiveLosses ?? 0)) : 0;

  const riskLevel = avgDD < 10 ? "Low" : avgDD < 20 ? "Medium" : "High";
  const riskColor = avgDD < 10 ? C.positive : avgDD < 20 ? C.amber : C.negative;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl p-5" style={CARD}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: C.muted }}>Risk Assessment</p>
          {!isLoading && completed.length > 0 && (
            <span className="text-xs font-semibold font-mono px-2 py-0.5 rounded-full"
              style={{ background: `${riskColor}12`, border: `1px solid ${riskColor}25`, color: riskColor }}>
              {riskLevel} Risk
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[1,2,3,4,5,6].map(i => <Skel key={i} className="h-10 w-full" />)}
          </div>
        ) : completed.length === 0 ? (
          <div className="text-center py-6">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-15" style={{ color: C.muted }} />
            <p className="text-xs font-mono" style={{ color: C.muted }}>No backtest data available for risk analysis</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {[
              { label: "Avg Max Drawdown",   value: `-${avgDD.toFixed(1)}%`,      good: avgDD < 15,     detail: "Lower is better — target <15%" },
              { label: "Worst Drawdown",      value: `-${maxDD.toFixed(1)}%`,      good: maxDD < 25,     detail: "Single backtest worst case" },
              { label: "Sharpe Ratio",        value: avgSharpe.toFixed(2),          good: avgSharpe >= 1, detail: "Risk-adjusted return (>1 is good)" },
              { label: "Sortino Ratio",       value: avgSortino.toFixed(2),         good: avgSortino >= 1,detail: "Downside risk-adjusted return" },
              { label: "Calmar Ratio",        value: avgCalmar.toFixed(2),          good: avgCalmar >= 0.5,detail: "Return per unit of max drawdown" },
              { label: "Max Consecutive Loss",value: String(maxConsL),              good: maxConsL <= 5,  detail: "Streak of losing trades" },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={GLASS}>
                <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: row.good ? C.positive : C.negative }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: C.text }}>{row.label}</p>
                  <p className="text-[10px] font-mono" style={{ color: C.muted }}>{row.detail}</p>
                </div>
                <p className="text-sm font-bold font-mono flex-shrink-0" style={{ color: row.good ? C.positive : C.negative }}>
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {completed.length > 0 && avgDD > 15 && (
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)" }}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: C.negative }} />
          <div>
            <p className="text-xs font-semibold mb-0.5" style={{ color: C.negative }}>Elevated Risk Profile</p>
            <p className="text-[11px] font-mono leading-relaxed" style={{ color: C.muted }}>
              Your average drawdown of {avgDD.toFixed(1)}% is above the healthy threshold of 15%.
              Consider adding stop-loss rules or reducing position sizes in your strategies.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Journal Tab ──────────────────────────────────────────────────── */
function JournalTab() {
  const TIPS = [
    { icon: "📝", title: "Log after every trade", desc: "Write your entry while the trade is fresh — capture emotions, market conditions, and reasoning." },
    { icon: "🎯", title: "Track your mistakes", desc: "Label recurring mistakes (revenge trading, FOMO, oversize) to spot behavioral patterns over time." },
    { icon: "⭐", title: "Rate each trade", desc: "Rate execution quality (not just outcome) so you separate skill from luck in your analysis." },
    { icon: "🧠", title: "Note your mood", desc: "Tracking emotional state at entry reveals how psychology drives your decision-making." },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl p-5" style={GLASS}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}>
            <BookOpen className="h-[18px] w-[18px]" style={{ color: C.blue }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: C.text }}>Trade Journal</p>
            <p className="text-[11px] font-mono" style={{ color: C.muted }}>
              Log notes, emotions, and mistakes for each trade
            </p>
          </div>
        </div>
        <p className="text-[12px] font-mono leading-relaxed mb-4" style={{ color: C.sub }}>
          Journal entries are attached to individual backtest trades. Open any backtest, expand a trade,
          and click the journal icon to add your notes, mood, mistakes, and rating.
        </p>
        <Link href="/backtests">
          <div className="rounded-xl p-3 flex items-center justify-between cursor-pointer hover:opacity-80"
            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
            <span className="text-sm font-semibold" style={{ color: C.blue }}>Open Backtests &amp; Start Journaling</span>
            <ArrowUpRight className="h-4 w-4" style={{ color: C.blue }} />
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TIPS.map(tip => (
          <div key={tip.title} className="rounded-2xl p-4" style={CARD}>
            <p className="text-lg mb-2">{tip.icon}</p>
            <p className="text-xs font-semibold mb-1" style={{ color: C.text }}>{tip.title}</p>
            <p className="text-[11px] font-mono leading-relaxed" style={{ color: C.muted }}>{tip.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────── */
export default function TraderDnaPage() {
  const [activeTab, setActiveTab] = useState<TabId>("performance");

  return (
    <div className="flex flex-col gap-5 pb-4 page-enter">

      {/* Hero */}
      <div className="rounded-3xl p-6 sm:p-8 relative overflow-hidden" style={CARD}>
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 80% at 100% 50%, rgba(168,85,247,0.07) 0%, transparent 65%)" }} />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 50% 60% at 0% 30%, rgba(99,102,241,0.05) 0%, transparent 65%)" }} />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}>
            <Dna className="h-7 w-7" style={{ color: "#a855f7" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl sm:text-[36px] font-bold" style={{ color: C.text, letterSpacing: "-0.032em" }}>
                Trader DNA
              </h1>
              <span className="flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full"
                style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)", color: "#a855f7" }}>
                <Sparkles style={{ height: "8px", width: "8px" }} />
                AI-Powered
              </span>
            </div>
            <p className="text-sm font-mono" style={{ color: C.sub }}>
              Your personal trading intelligence center — performance, sessions, psychology, risk, and journal.
            </p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-mono font-medium whitespace-nowrap flex-shrink-0 border-b-2 transition-colors"
              style={{
                borderColor: isActive ? tab.color : "transparent",
                color: isActive ? tab.color : C.muted,
                background: "transparent",
              }}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "performance" && <PerformanceTab />}
        {activeTab === "sessions"    && <SessionAnalysisTab />}
        {activeTab === "psychology"  && <PsychologyTab />}
        {activeTab === "risk"        && <RiskTab />}
        {activeTab === "journal"     && <JournalTab />}
      </div>

    </div>
  );
}
