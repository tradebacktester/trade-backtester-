import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useGetBacktestSummary, useListBacktests } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useBinancePrices } from "@/lib/use-binance-ws";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Target, Shield,
  Clock, BarChart2, Zap, Activity, ArrowUpRight, Play,
  Brain, CandlestickChart, Cpu, Globe, Bitcoin, Gauge,
  MessageCircle, Send, X, Bot, Sparkles, AlertTriangle, ChevronDown, Bell, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/api-config";
import { useAuth } from "@/lib/auth-context";

/* ── Helpers ──────────────────────────────────────────────────────── */
function fmtPct(v: number | null | undefined, sign = true) {
  if (v == null) return "—";
  return `${sign && v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtNum(v: number | null | undefined, d = 2) {
  if (v == null) return "—";
  return v.toFixed(d);
}

/* ── Design tokens — theme-adaptive via CSS variables ────────────── */
const C = {
  text:        "hsl(var(--foreground))",
  sub:         "hsl(var(--muted-foreground))",
  muted:       "hsl(var(--muted-foreground))",
  border:      "hsl(var(--border))",
  surface:     "var(--card-bg)",
  surfaceHov:  "var(--glass-bg)",
  positive:    "#22c55e",
  negative:    "#ef4444",
  amber:       "#f59e0b",
};

const CARD: React.CSSProperties = {
  background:  "var(--card-bg)",
  border:      "1px solid hsl(var(--border))",
  boxShadow:   "var(--shadow-card)",
};

/* ── Skeleton ─────────────────────────────────────────────────────── */
function Skel({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ background: "hsl(var(--muted))" }}
    />
  );
}

/* ── Section label ────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="apple-label mb-3">{children}</p>
  );
}

/* ── Panel ────────────────────────────────────────────────────────── */
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`specular-card rounded-2xl p-4 sm:p-5 relative overflow-hidden glass-shine ${className}`} style={CARD}>
      <div className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, transparent 50%)", zIndex: 0 }} />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

/* ── AI Coach Section ─────────────────────────────────────────────── */
type CoachingInsight = { text: string; improvementPct: number; category: string };
type CoachingData = {
  traderScore: number;
  traderStyle: string;
  traderStyleColor: string;
  avgHoldingDays: number;
  backtestCount: number;
  avgWinRate: number;
  avgSharpe: number;
  avgDrawdown: number;
  mistakes: { label: string; severity: "high" | "medium" | "low"; detail: string }[];
  insights: CoachingInsight[];
  hasData: boolean;
};

/* ── Alert Engine Card (dashboard widget) ────────────────────────── */
function AlertEngineCard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<{ total: number; active: number; unread: number; planSlug: string; maxAlerts: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/alerts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((d: any) => setStats({ total: d.total ?? 0, active: d.active ?? 0, unread: d.unreadNotifications ?? 0, planSlug: d.planSlug ?? "free", maxAlerts: d.maxAlerts ?? 5 }))
      .catch(() => {});
  }, [token]);

  if (!token) return null;
  const CYAN = "hsl(188,100%,42%)";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid rgba(0,210,210,0.18)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,210,210,0.10)" }}>
        <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(0,210,210,0.10)", border: "1px solid rgba(0,210,210,0.22)" }}>
          <Bell className="h-3.5 w-3.5" style={{ color: CYAN }} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-bold" style={{ color: "hsl(var(--foreground))" }}>Alert Engine</span>
          <span className="text-[10px] font-mono ml-2" style={{ color: "hsl(var(--muted-foreground))" }}>
            Multi-condition smart alerts
          </span>
        </div>
        {stats && stats.unread > 0 && (
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
            {stats.unread} new
          </span>
        )}
        <Link href="/alerts">
          <span className="text-[10px] font-mono flex items-center gap-1 cursor-pointer hover:opacity-70 flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>
            Manage <ArrowUpRight className="h-3 w-3" />
          </span>
        </Link>
      </div>
      <div className="px-5 py-3 flex items-center gap-4">
        {[
          { label: "Total Alerts",  value: stats?.total  ?? "—", color: CYAN },
          { label: "Active",        value: stats?.active ?? "—", color: "#22c55e" },
          { label: "Notifications", value: stats?.unread ?? "—", color: stats && stats.unread > 0 ? "#ef4444" : "hsl(var(--muted-foreground))" },
          { label: "Plan",          value: stats?.planSlug ? stats.planSlug.charAt(0).toUpperCase() + stats.planSlug.slice(1) : "—", color: stats?.planSlug === "elite" ? "#f59e0b" : stats?.planSlug === "pro" ? "#a855f7" : "hsl(var(--muted-foreground))" },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center flex-1">
            <span className="text-base font-bold font-mono" style={{ color: s.color }}>{String(s.value)}</span>
            <span className="text-[9px] font-mono uppercase tracking-wider mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{s.label}</span>
          </div>
        ))}
        <Link href="/alerts">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[11px] font-semibold transition-all hover:opacity-80 flex-shrink-0"
            style={{ background: "rgba(0,210,210,0.10)", border: "1px solid rgba(0,210,210,0.22)", color: CYAN }}>
            <Plus className="h-3 w-3" /> New Alert
          </button>
        </Link>
      </div>
    </div>
  );
}

/* ── Daily Coach Card (compact dashboard widget) ─────────────────── */
function DailyCoachCard() {
  const { token } = useAuth();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_BASE}/api/ai/daily-coach`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setData(d as Record<string, unknown>))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (!token || (!loading && !data?.hasData)) return null;

  const PURPLE = "#a855f7";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ ...CARD, borderColor: "rgba(168,85,247,0.22)" }}>
      {/* header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left"
        style={{ borderBottom: open ? "1px solid rgba(168,85,247,0.15)" : "none" }}
      >
        <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}>
          <Zap className="h-3.5 w-3.5" style={{ color: PURPLE }} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-bold" style={{ color: C.text }}>Daily Coach</span>
          <span className="text-[10px] font-mono ml-2" style={{ color: C.sub }}>
            {loading ? "Loading…" : (data?.traderStyle as string) ?? "Personal briefing"}
          </span>
        </div>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.2)", color: PURPLE }}>
          AI
        </span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 transition-transform"
          style={{ color: C.sub, transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {open && (
        <div className="px-5 py-4 flex flex-col gap-3">
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1,2,3].map(i => <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: "var(--glass-bg)" }} />)}
            </div>
          ) : (
            <>
              {data?.greeting && (
                <p className="text-[12px] leading-relaxed" style={{ color: C.sub }}>{data.greeting as string}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { icon: Target,       label: "Today's Goal",      value: data?.todayGoal as string,          color: PURPLE },
                  { icon: Zap,          label: "Top Tip",           value: data?.recommendation as string,     color: C.amber },
                  { icon: TrendingUp,   label: "Best Session",       value: data?.bestSession as string,        color: C.positive },
                  { icon: AlertTriangle,label: "Watch Out",          value: data?.recentLossPattern as string,  color: C.negative },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                    style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                    <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${row.color}12`, border: `1px solid ${row.color}20` }}>
                      <row.icon className="h-3 w-3" style={{ color: row.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-mono uppercase tracking-wider" style={{ color: C.sub }}>{row.label}</p>
                      <p className="text-[11px] font-mono leading-snug mt-0.5" style={{ color: C.text }}>{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AiCoachSection() {
  const { token } = useAuth();
  const [data, setData] = useState<CoachingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMistakes, setShowMistakes] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${API_BASE}/api/ai/coaching-insights`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setData(d as CoachingData))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) return null;

  const RADIUS = 52;
  const STROKE = 6;
  const CIRCUM = 2 * Math.PI * RADIUS;
  const ARC = 0.75;
  const dashArray = CIRCUM * ARC;
  const dashOffset = data ? dashArray * (1 - data.traderScore / 100) : dashArray;
  const rotation = -225;
  const sevColor = (s: string) => s === "high" ? C.negative : s === "medium" ? C.amber : "#6b7280";

  return (
    <div className="rounded-3xl overflow-hidden relative" style={{ ...CARD }}>
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 100% at 0% 50%, rgba(168,85,247,0.07) 0%, transparent 65%)" }} />
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 50% 60% at 100% 30%, rgba(34,197,94,0.04) 0%, transparent 65%)" }} />

      <div className="relative p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}>
            <Brain className="h-[18px] w-[18px]" style={{ color: "#a855f7" }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold" style={{ color: C.text }}>AI Coach</p>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.2)", color: "#a855f7" }}>
                Live Insights
              </span>
            </div>
            <p className="text-[10px] font-mono" style={{ color: C.muted }}>Personalized coaching from your backtest history</p>
          </div>
          <Link href="/trader-dna">
            <span className="text-[10px] font-mono flex items-center gap-1 cursor-pointer hover:opacity-70" style={{ color: C.sub }}>
              Full DNA <ArrowUpRight className="h-3 w-3" />
            </span>
          </Link>
        </div>

        {loading ? (
          <div className="flex gap-4">
            <Skel className="h-28 w-28 rounded-2xl flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-2 pt-2">
              <Skel className="h-4 w-32" />
              <Skel className="h-3 w-48" />
              <Skel className="h-3 w-40" />
              <Skel className="h-8 w-full mt-1 rounded-xl" />
            </div>
          </div>
        ) : !data?.hasData ? (
          <div className="flex flex-col items-center py-4 gap-2">
            <Brain className="h-8 w-8 opacity-15" style={{ color: C.muted }} />
            <p className="text-xs font-mono text-center" style={{ color: C.muted }}>
              Run your first backtest to unlock personalized AI coaching
            </p>
            <Link href="/backtests/new">
              <Button variant="outline" size="sm" className="mt-1">Run First Backtest</Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="relative" style={{ width: 130, height: 130 }}>
                <svg width="130" height="130" viewBox="0 0 150 150"
                  style={{ transform: `rotate(${rotation}deg)` }}>
                  <circle cx="75" cy="75" r={RADIUS} fill="none"
                    stroke="rgba(255,255,255,0.07)" strokeWidth={STROKE}
                    strokeDasharray={`${dashArray} ${CIRCUM}`} strokeLinecap="round" />
                  <circle cx="75" cy="75" r={RADIUS} fill="none"
                    stroke={data!.traderStyleColor} strokeWidth={STROKE}
                    strokeDasharray={`${dashArray} ${CIRCUM}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1s ease", filter: `drop-shadow(0 0 6px ${data!.traderStyleColor}60)` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: 8 }}>
                  <span className="text-3xl font-bold font-mono leading-none" style={{ color: data!.traderStyleColor }}>
                    {data!.traderScore}
                  </span>
                  <span className="text-[9px] font-mono uppercase tracking-widest mt-0.5" style={{ color: C.muted }}>score</span>
                </div>
              </div>
              <p className="text-[11px] font-semibold text-center font-mono" style={{ color: data!.traderStyleColor }}>
                {data!.traderStyle}
              </p>
              <p className="text-[10px] font-mono text-center" style={{ color: C.muted }}>
                {data!.backtestCount} backtest{data!.backtestCount !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Win Rate", value: `${data!.avgWinRate}%`, good: data!.avgWinRate >= 50 },
                  { label: "Sharpe",   value: data!.avgSharpe.toFixed(2),    good: data!.avgSharpe >= 1 },
                  { label: "Drawdown", value: `-${data!.avgDrawdown}%`,       good: data!.avgDrawdown < 15 },
                ].map(stat => (
                  <div key={stat.label} className="rounded-xl px-2.5 py-2 text-center"
                    style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                    <p className="text-[10px] font-mono" style={{ color: C.muted }}>{stat.label}</p>
                    <p className="text-xs font-bold font-mono" style={{ color: stat.good ? C.positive : C.amber }}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {data!.insights && data!.insights.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {data!.insights.slice(0, 4).map((insight, i) => (
                    <div key={i} className="rounded-xl px-3 py-2 flex items-start gap-2.5"
                      style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full mt-0.5 flex-shrink-0"
                        style={{ background: "rgba(34,197,94,0.1)", color: C.positive, border: "1px solid rgba(34,197,94,0.2)" }}>
                        +{insight.improvementPct}%
                      </span>
                      <p className="text-[11px] font-mono leading-relaxed" style={{ color: C.sub }}>
                        {insight.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {data!.mistakes.length > 0 && (
                <button
                  onClick={() => setShowMistakes(v => !v)}
                  className="flex items-center gap-1.5 text-[11px] font-mono hover:opacity-80 w-fit"
                  style={{ color: C.negative }}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {data!.mistakes.length} mistake{data!.mistakes.length !== 1 ? "s" : ""} detected
                  <ChevronDown className="h-3 w-3" style={{
                    transform: showMistakes ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                  }} />
                </button>
              )}
            </div>
          </div>
        )}

        {showMistakes && data && data.mistakes.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: C.muted }}>
              Mistake Alert Center
            </p>
            {data.mistakes.map(m => (
              <div key={m.label} className="rounded-xl px-3 py-2.5 flex items-start gap-2.5"
                style={{ background: `${sevColor(m.severity)}08`, border: `1px solid ${sevColor(m.severity)}22` }}>
                <div className="h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: sevColor(m.severity) }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: sevColor(m.severity) }}>{m.label}</p>
                  <p className="text-[11px] font-mono leading-relaxed" style={{ color: C.muted }}>{m.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── AI Market Pulse Hero ──────────────────────────────────────────── */
function AiMarketPulse() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  const SCORE = 72;
  const RADIUS = 64;
  const STROKE = 5.5;
  const CIRCUM = 2 * Math.PI * RADIUS;
  const ARC_PCT = 0.75;
  const dashArray = CIRCUM * ARC_PCT;
  const dashOffset = dashArray * (1 - SCORE / 100);
  const rotation = -225;

  const pulseItems = [
    { icon: Bitcoin, label: "Crypto",   score: 72, col: "#4ade80",  tag: "Bullish" },
    { icon: Globe,   label: "Forex",    score: 38, col: "#f87171",  tag: "Bearish" },
    { icon: BarChart2, label: "Equities", score: 51, col: "#facc15", tag: "Neutral" },
    { icon: Cpu,     label: "AI Signal", score: 80, col: "#818cf8", tag: "Strong" },
  ];

  return (
    <div
      className="specular-card relative rounded-3xl overflow-hidden p-5 sm:p-6"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.07)",
      }}
    >
      {/* Ambient glow layers */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 70% at 0% 50%, rgba(255,255,255,0.030) 0%, transparent 65%)" }} />
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 50% 60% at 90% 10%, rgba(139,92,246,0.045) 0%, transparent 65%)" }} />
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.025) 0%, transparent 45%)" }} />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Left — badge + copy */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#FFFFFF" }}>
              <span className="h-1.5 w-1.5 rounded-full live-pulse"
                style={{ background: "#FFFFFF", boxShadow: "0 0 6px rgba(255,255,255,0.5)" }} />
              AI MARKET PULSE
            </span>
            <span className="hidden sm:block text-[10px] font-mono" style={{ color: "var(--nav-dim-color)" }}>
              Updated {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <h2 className="text-2xl sm:text-[30px] font-bold mb-1" style={{ color: "hsl(var(--foreground))", letterSpacing: "-0.030em" }}>
            Markets trending&nbsp;
            <span style={{ color: "#22C55E", textShadow: "0 0 28px rgba(34,197,94,0.35)" }}>bullish</span>
          </h2>
          <p className="text-[11px] sm:text-xs font-mono leading-relaxed mb-4"
            style={{ color: "hsl(var(--muted-foreground))" }}>
            Crypto momentum strong · USD weakening · Risk-on sentiment detected
          </p>

          {/* Pulse metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {pulseItems.map(item => (
              <div key={item.label}
                className="rounded-xl px-3 py-2.5 flex flex-col gap-1.5 glass-shine"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  boxShadow: "var(--shadow-2xs)",
                }}>
                <div className="flex items-center gap-1.5">
                  <item.icon style={{ height: "11px", width: "11px", color: item.col }} />
                  <span className="text-[10px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {item.label}
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-sm font-bold font-mono" style={{ color: item.col }}>
                    {item.score}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                    style={{ color: item.col, background: `${item.col}15`, border: `1px solid ${item.col}30` }}>
                    {item.tag}
                  </span>
                </div>
                {/* Mini bar */}
                <div className="h-0.5 rounded-full" style={{ background: "var(--glass-border)" }}>
                  <div className="h-full rounded-full transition-all duration-[1.5s]"
                    style={{ width: `${item.score}%`, background: item.col, boxShadow: `0 0 6px ${item.col}80` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — SVG gauge */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2.5">
          <div className="relative" style={{ width: 156, height: 156 }}>
            {/* Ambient glow behind gauge */}
            <div className="absolute inset-0 rounded-full"
              style={{ background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 50%, transparent 72%)" }} />

            <svg width="156" height="156" viewBox="0 0 156 156" style={{ transform: `rotate(${rotation}deg)` }}>
              {/* Track */}
              <circle cx="78" cy="78" r={RADIUS} fill="none"
                stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${dashArray} ${CIRCUM - dashArray}`}
                strokeDashoffset={0}
              />
              {/* Value arc */}
              <circle cx="78" cy="78" r={RADIUS} fill="none"
                stroke="url(#gaugeGrad)" strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${dashArray} ${CIRCUM - dashArray}`}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
              />
              <defs>
                <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,1.0)" />
                </linearGradient>
              </defs>
            </svg>

            {/* Center value */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-bold font-mono leading-none tabular" style={{ fontSize: "34px", color: "#FFFFFF", letterSpacing: "-0.030em" }}>
                {SCORE}
              </span>
              <span className="apple-label mt-1">BULLISH</span>
            </div>
          </div>

          {/* Confidence badge */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.75)" }}>
            <Sparkles style={{ height: "9px", width: "9px" }} />
            82% Confidence
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Trader DNA Command Center ────────────────────────────────────── */
interface DnaProfile {
  totalTrades: number; avgWinRate: number; avgReturn: number; avgDrawdown: number;
  traderStyle: string; preferredSide: string; riskProfile: string;
  sessionStats: { label: string; winRate: number; trades: number }[];
  bestSession: { label: string; winRate: number } | null;
  worstSession: { label: string; winRate: number } | null;
  topMistakes: { label: string; count: number }[];
  bestStrategy: { type: string; avgWinRate: number } | null;
  backtestCount: number;
}

function TraderDNACommandCenter() {
  const { token } = useAuth();
  const [data, setData] = useState<DnaProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_BASE}/api/alerts/dna-analysis`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then((d: DnaProfile | null) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) return null;

  const riskColor = (r: string) =>
    r === "aggressive" ? C.negative : r === "conservative" ? C.positive : C.amber;

  const SEV_COLORS = ["hsl(0,80%,60%)", "hsl(25,95%,60%)", "hsl(38,100%,60%)"];

  return (
    <div
      className="specular-card relative overflow-hidden rounded-3xl"
      style={{ ...CARD, boxShadow: "var(--shadow-card), inset 0 1px 0 rgba(255,255,255,0.06)" }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 80% at 100% 0%, rgba(0,229,255,0.045) 0%, transparent 65%)" }} />

      <div className="relative p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.2)" }}>
              <Brain className="h-4 w-4" style={{ color: "hsl(180,90%,60%)" }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: C.text }}>Trader DNA Command Center</p>
              <p className="text-[10px] font-mono" style={{ color: C.muted }}>Behavioral intelligence from your trade history</p>
            </div>
          </div>
          <Link href="/alerts?from=dna&type=dna">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              style={{ background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.2)", color: "hsl(180,90%,60%)" }}>
              <Bell className="h-3 w-3" />
              DNA Alert
            </span>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map(i => <Skel key={i} className="h-16" />)}
          </div>
        ) : !data || data.totalTrades === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Brain className="h-8 w-8 opacity-15" style={{ color: C.muted }} />
            <p className="text-sm font-mono" style={{ color: C.muted }}>Run backtests to unlock DNA insights</p>
            <Link href="/backtests/new">
              <Button variant="outline" size="sm" className="mt-1">Run First Backtest</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Profile stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {[
                { label: "Trader Style", value: data.traderStyle, color: "hsl(210,90%,65%)" },
                { label: "Preferred Side", value: data.preferredSide.charAt(0).toUpperCase() + data.preferredSide.slice(1), color: "hsl(142,70%,50%)" },
                { label: "Avg Win Rate", value: `${data.avgWinRate}%`, color: data.avgWinRate >= 50 ? C.positive : C.negative },
                { label: "Risk Profile", value: data.riskProfile.charAt(0).toUpperCase() + data.riskProfile.slice(1), color: riskColor(data.riskProfile) },
              ].map(s => (
                <div key={s.label} className="rounded-xl px-3 py-2.5 glass-shine"
                  style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                  <p className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: C.muted }}>{s.label}</p>
                  <p className="text-xs font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Session performance */}
            {data.sessionStats.length > 0 && (
              <div className="mb-4 rounded-2xl p-3"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                <p className="text-[9px] font-mono uppercase tracking-widest mb-3" style={{ color: C.muted }}>Session Win Rates</p>
                <div className="space-y-2">
                  {data.sessionStats.map(s => {
                    const isBest = s.label === data.bestSession?.label;
                    const isWorst = s.label === data.worstSession?.label;
                    const barColor = isBest ? C.positive : isWorst ? C.negative : C.amber;
                    return (
                      <div key={s.label}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono" style={{ color: C.sub }}>{s.label}</span>
                            {isBest && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: `${C.positive}15`, color: C.positive, border: `1px solid ${C.positive}30` }}>BEST</span>}
                            {isWorst && <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: `${C.negative}15`, color: C.negative, border: `1px solid ${C.negative}30` }}>AVOID</span>}
                          </div>
                          <span className="text-[11px] font-mono font-bold" style={{ color: barColor }}>{s.winRate.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(100, s.winRate)}%`, background: barColor, boxShadow: `0 0 6px ${barColor}60` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top mistakes + expand */}
            {data.topMistakes.length > 0 && (
              <>
                <button onClick={() => setExpanded(v => !v)}
                  className="flex items-center gap-1.5 text-[11px] font-mono w-full mb-2 hover:opacity-80"
                  style={{ color: C.negative }}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {data.topMistakes.length} recurring mistake{data.topMistakes.length !== 1 ? "s" : ""} detected
                  <ChevronDown className="h-3 w-3 ml-auto" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>
                {expanded && (
                  <div className="space-y-2">
                    {data.topMistakes.map((m, i) => (
                      <div key={m.label} className="flex items-start gap-2.5 px-3 py-2 rounded-xl"
                        style={{ background: `${SEV_COLORS[i] ?? C.amber}08`, border: `1px solid ${SEV_COLORS[i] ?? C.amber}22` }}>
                        <div className="h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: SEV_COLORS[i] ?? C.amber }} />
                        <div className="flex-1">
                          <p className="text-xs font-semibold" style={{ color: SEV_COLORS[i] ?? C.amber }}>{m.label}</p>
                          <p className="text-[10px] font-mono" style={{ color: C.muted }}>Logged {m.count}× in trading journal</p>
                        </div>
                        <Link href={`/alerts?from=strategy&type=dna`}>
                          <span className="text-[9px] font-mono px-2 py-1 rounded-lg cursor-pointer transition-all"
                            style={{ background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.2)", color: "hsl(180,90%,60%)" }}>
                            Guard →
                          </span>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Best strategy */}
            {data.bestStrategy && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                <Zap className="h-3.5 w-3.5 flex-shrink-0" style={{ color: C.positive }} />
                <p className="text-[11px] font-mono" style={{ color: C.sub }}>
                  Best strategy: <strong style={{ color: C.positive }}>{data.bestStrategy.type}</strong> — {data.bestStrategy.avgWinRate.toFixed(0)}% avg win rate
                </p>
                <Link href="/alerts?from=strategy&type=strategy" className="ml-auto flex-shrink-0">
                  <span className="text-[9px] font-mono px-2 py-1 rounded-lg cursor-pointer"
                    style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: C.positive }}>
                    Alert →
                  </span>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
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
  return (
    <div className="specular-card relative overflow-hidden rounded-2xl p-5 flex flex-col gap-5"
      style={{ ...CARD, transition: "box-shadow 0.30s cubic-bezier(0.34,1.56,0.64,1), border-color 0.22s ease, transform 0.30s cubic-bezier(0.34,1.56,0.64,1)" }}>
      {/* Top edge specular gradient */}
      <div
        className="absolute top-0 left-[15%] right-[15%] h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${accent ?? "rgba(255,255,255,0.09)"} 50%, transparent)` }}
      />
      {/* Label row + icon */}
      <div className="flex items-center justify-between gap-2">
        <p className="apple-label">{label}</p>
        <div
          className="h-[22px] w-[22px] flex items-center justify-center rounded-lg flex-shrink-0"
          style={{
            background: accent ? `${accent}12` : "rgba(255,255,255,0.04)",
            border: `1px solid ${accent ? `${accent}22` : "rgba(255,255,255,0.07)"}`,
          }}
        >
          <Icon className="h-[10px] w-[10px]" style={{ color: accent ?? "rgba(255,255,255,0.32)" }} />
        </div>
      </div>
      {/* Apple display number */}
      {isLoading
        ? <Skel className="h-9 w-20" />
        : <p className="apple-num" style={{ color: accent ?? "hsl(var(--foreground))" }}>
            {value}
          </p>
      }
    </div>
  );
}

/* ── Watchlist ────────────────────────────────────────────────────── */
interface WatchItem { symbol: string; price: string; change: number; sub: string; binanceKey?: string }
const WATCHLIST: WatchItem[] = [
  { symbol: "BTC/USD", price: "—", change: 0, sub: "Bitcoin",  binanceKey: "BTCUSDT" },
  { symbol: "ETH/USD", price: "—", change: 0, sub: "Ethereum", binanceKey: "ETHUSDT" },
  { symbol: "SOL/USD", price: "—", change: 0, sub: "Solana",   binanceKey: "SOLUSDT" },
  { symbol: "BNB/USD", price: "—", change: 0, sub: "BNB",      binanceKey: "BNBUSDT" },
  { symbol: "XRP/USD", price: "—", change: 0, sub: "Ripple",   binanceKey: "XRPUSDT" },
  { symbol: "ADA/USD", price: "—", change: 0, sub: "Cardano",  binanceKey: "ADAUSDT" },
];

function fmtLivePrice(p: number): string {
  if (p >= 1000) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1)    return p.toFixed(4);
  return p.toFixed(6);
}

function WatchRow({ item, last, livePrice }: {
  item: WatchItem; last: boolean;
  livePrice?: { price: number; changePct24h: number };
}) {
  const displayPrice  = livePrice ? fmtLivePrice(livePrice.price)   : item.price;
  const displayChange = livePrice ? livePrice.changePct24h           : item.change;
  const up = displayChange >= 0;
  return (
    <div
      className="flex items-center justify-between py-2.5"
      style={last ? {} : { borderBottom: "1px solid hsl(var(--border))" }}
    >
      <div>
        <p className="text-sm font-mono font-semibold" style={{ color: C.text }}>{item.symbol}</p>
        <p className="text-[10px] font-mono" style={{ color: C.muted }}>{item.sub}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-mono font-bold" style={{ color: C.text }}>{displayPrice}</p>
        <p className="text-[11px] font-mono font-semibold" style={{ color: up ? C.positive : C.negative }}>
          {up ? "+" : ""}{displayChange.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}

/* ── Trading sessions ─────────────────────────────────────────────── */
interface Session { name: string; hours: string; tz: string; utcStart: number; utcEnd: number }
const SESSIONS: Session[] = [
  { name: "Sydney",   hours: "22:00–07:00", tz: "AEST", utcStart: 22, utcEnd: 7  },
  { name: "Tokyo",    hours: "23:00–09:00", tz: "JST",  utcStart: 23, utcEnd: 9  },
  { name: "London",   hours: "08:00–17:00", tz: "GMT",  utcStart: 8,  utcEnd: 17 },
  { name: "New York", hours: "13:00–22:00", tz: "EST",  utcStart: 13, utcEnd: 22 },
];
const SCOL: Record<string, string> = { open: "#16a34a", closed: "#888", overlap: "#d97706" };
const SLBL: Record<string, string> = { open: "Open", closed: "Closed", overlap: "Overlap" };

function computeSessionStatuses(): ("open" | "closed" | "overlap")[] {
  const now = new Date();
  const h = now.getUTCHours() + now.getUTCMinutes() / 60;
  const opens = SESSIONS.map(s =>
    s.utcStart > s.utcEnd
      ? h >= s.utcStart || h < s.utcEnd
      : h >= s.utcStart && h < s.utcEnd
  );
  return opens.map((open, i): "open" | "closed" | "overlap" => {
    if (!open) return "closed";
    return opens.some((o, j) => j !== i && o) ? "overlap" : "open";
  });
}

function SessionRow({ s, status, last }: { s: Session; status: "open" | "closed" | "overlap"; last: boolean }) {
  const color = SCOL[status];
  return (
    <div
      className="flex items-center justify-between py-2.5"
      style={last ? {} : { borderBottom: "1px solid hsl(var(--border))" }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
          style={{ background: color, boxShadow: status !== "closed" ? `0 0 4px ${color}` : "none" }}
        />
        <div>
          <p className="text-xs font-mono font-semibold" style={{ color: C.text }}>{s.name}</p>
          <p className="text-[10px] font-mono" style={{ color: C.muted }}>{s.hours} {s.tz}</p>
        </div>
      </div>
      <span
        className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
        style={{ color, background: `${color}12`, border: `1px solid ${color}30` }}
      >
        {SLBL[status]}
      </span>
    </div>
  );
}

/* ── Demo summary ─────────────────────────────────────────────────── */
function DemoSummary() {
  const [balance, setBalance] = useState(10000);
  const [trades, setTrades] = useState<{ pnl?: number }[]>([]);

  useEffect(() => {
    try {
      const acc = JSON.parse(localStorage.getItem("pt_account") || "null") as { capital?: number } | null;
      if (acc?.capital) setBalance(acc.capital);
    } catch {}
    try {
      const tr = JSON.parse(localStorage.getItem("pt_trades") || "[]") as { pnl?: number }[];
      if (Array.isArray(tr)) setTrades(tr);
    } catch {}
  }, []);

  const totalPnL = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const winCount = trades.filter(t => (t.pnl ?? 0) > 0).length;
  const winRate  = trades.length ? (winCount / trades.length) * 100 : 0;
  const fmt$  = (v: number) => `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const items = [
    { label: "Balance",   value: fmt$(balance),                                                          color: C.text },
    { label: "Total P&L", value: `${totalPnL >= 0 ? "+" : "-"}${fmt$(totalPnL)}`,                       color: totalPnL >= 0 ? C.positive : C.negative },
    { label: "Win Rate",  value: trades.length ? `${winRate.toFixed(0)}%` : "—",                        color: C.text },
    { label: "# Trades",  value: `${trades.length}`,                                                    color: C.text },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(it => (
        <div
          key={it.label}
          className="rounded-xl px-3 py-2.5"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
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

/* ── AI insight cards ─────────────────────────────────────────────── */
interface Insight { icon: React.ElementType; title: string; body: string; tag: string; tagColor: string }

function InsightCard({ item }: { item: Insight }) {
  const Icon = item.icon;
  return (
    <Link href="/ai">
      <div
        className="rounded-2xl p-4 cursor-pointer transition-colors duration-150"
        style={CARD}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.16)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <span
            className="h-7 w-7 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: "rgba(128,128,128,0.10)", border: "1px solid rgba(0,0,0,0.08)" }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: "#555" }} />
          </span>
          <p className="text-xs font-mono font-semibold" style={{ color: C.text }}>{item.title}</p>
          <span
            className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-full"
            style={{ color: item.tagColor, background: `${item.tagColor}12`, border: `1px solid ${item.tagColor}30` }}
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
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.surfaceHov; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
      >
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: isPos ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
            border: `1px solid ${isPos ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)"}`,
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
        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-30 transition-opacity flex-shrink-0"
          style={{ color: C.sub }} />
      </div>
    </Link>
  );
}

/* ── Paper Trading Section ────────────────────────────────────────── */
type PtTrade = {
  id: number; entryPrice: number; exitPrice: number;
  pnl: number; pnlPct: number;
  side?: "long" | "short"; symbol?: string;
};
type PtAccount = { initialCapital: number; balance: number; createdAt: string };

function PaperTradingSection() {
  const [ptAccount, setPtAccount] = useState<PtAccount | null>(null);
  const [ptTrades, setPtTrades] = useState<PtTrade[]>([]);

  const load = async () => {
    const token = localStorage.getItem("tt_token");
    if (token) {
      try {
        const resp = await fetch(`${API_BASE}/api/paper/trades`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (resp.ok) {
          const apiTrades = await resp.json() as PtTrade[];
          if (apiTrades.length > 0) {
            const totalPnl = apiTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
            const firstDate = (apiTrades[0] as { openedAt?: string }).openedAt
              ?? new Date().toISOString();
            setPtTrades(apiTrades);
            setPtAccount({ initialCapital: 10_000, balance: 10_000 + totalPnl, createdAt: firstDate });
            return;
          }
        }
      } catch {}
    }
    // Fall back to localStorage
    try {
      const acc = JSON.parse(localStorage.getItem("pt_account") || "null") as PtAccount | null;
      const trades = JSON.parse(localStorage.getItem("pt_trades") || "[]") as PtTrade[];
      setPtAccount(acc);
      setPtTrades(trades);
    } catch {}
  };

  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);

  if (!ptAccount) return null;

  const totalPnl = ptTrades.reduce((s, t) => s + t.pnl, 0);
  const wins = ptTrades.filter(t => t.pnl > 0).length;
  const losses = ptTrades.length - wins;
  const winRate = ptTrades.length > 0 ? (wins / ptTrades.length) * 100 : 0;
  const balance = ptAccount.initialCapital + totalPnl;
  const pnlPct = (totalPnl / ptAccount.initialCapital) * 100;
  const avgWin = wins > 0
    ? ptTrades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / wins
    : 0;

  return (
    <Panel>
      <div className="flex items-center justify-between mb-4">
        <div>
          <SectionLabel>Paper Trading Account</SectionLabel>
          <p className="text-xs font-mono -mt-2" style={{ color: C.muted }}>
            Started {new Date(ptAccount.createdAt).toLocaleDateString()} · ${ptAccount.initialCapital.toLocaleString()} initial capital
          </p>
        </div>
        <Link href="/chart">
          <span className="text-[10px] font-mono flex items-center gap-1 cursor-pointer hover:opacity-70"
            style={{ color: C.sub }}>
            <CandlestickChart className="h-3 w-3" /> Open Charts →
          </span>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { label: "Balance", value: `$${balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: C.text, sub: null },
          { label: "Total P&L", value: `${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toFixed(2)}`, color: totalPnl >= 0 ? C.positive : C.negative, sub: `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%` },
          { label: "Trades", value: `${ptTrades.length}`, color: C.text, sub: `${wins}W · ${losses}L` },
          { label: "Win Rate", value: ptTrades.length > 0 ? `${winRate.toFixed(0)}%` : "—", color: ptTrades.length > 0 ? (winRate >= 50 ? C.positive : C.negative) : C.text, sub: avgWin > 0 ? `avg win $${avgWin.toFixed(0)}` : null },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl px-3 py-2.5"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: C.muted }}>{stat.label}</p>
            <p className="text-sm font-mono font-bold" style={{ color: stat.color }}>{stat.value}</p>
            {stat.sub && <p className="text-[10px] font-mono" style={{ color: stat.color === C.text ? C.muted : stat.color }}>{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Trade history */}
      {ptTrades.length === 0 ? (
        <div className="text-center py-5">
          <CandlestickChart className="h-7 w-7 mx-auto mb-2 opacity-15" style={{ color: C.sub }} />
          <p className="text-xs font-mono" style={{ color: C.muted }}>No trades yet — head to Charts to start trading</p>
          <Link href="/chart">
            <Button variant="outline" size="sm" className="mt-3">Open Charts</Button>
          </Link>
        </div>
      ) : (
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: C.muted }}>Recent Trades</p>
          <div className="flex flex-col gap-1.5 max-h-[240px] overflow-y-auto">
            {[...ptTrades].reverse().slice(0, 15).map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{
                  background: t.pnl >= 0 ? "rgba(22,163,74,0.05)" : "rgba(220,38,38,0.05)",
                  border: `1px solid ${t.pnl >= 0 ? "rgba(22,163,74,0.12)" : "rgba(220,38,38,0.1)"}`,
                }}>
                <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: t.pnl >= 0 ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)" }}>
                  {t.pnl >= 0
                    ? <TrendingUp className="h-3 w-3" style={{ color: C.positive }} />
                    : <TrendingDown className="h-3 w-3" style={{ color: C.negative }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono" style={{ color: C.muted }}>#{ptTrades.length - i}</span>
                    {t.symbol && (
                      <span className="text-[10px] font-mono font-semibold" style={{ color: C.sub }}>
                        {t.symbol.replace("USDT", "/USDT").replace("PERP", " Perp")}
                      </span>
                    )}
                    {t.side && (
                      <span className="text-[9px] font-mono px-1 rounded"
                        style={{ color: t.side === "short" ? C.negative : C.positive, background: t.side === "short" ? "rgba(220,38,38,0.1)" : "rgba(22,163,74,0.1)" }}>
                        {t.side.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono" style={{ color: C.muted }}>
                    ${t.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })} → ${t.exitPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-mono font-bold" style={{ color: t.pnl >= 0 ? C.positive : C.negative }}>
                    {t.pnl >= 0 ? "+" : ""}${Math.abs(t.pnl).toFixed(2)}
                  </p>
                  <p className="text-[10px] font-mono" style={{ color: C.muted }}>
                    {t.pnlPct >= 0 ? "+" : ""}{t.pnlPct.toFixed(2)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetBacktestSummary();
  const { data: backtests, isLoading: loadingBacktests } = useListBacktests();
  const isLoading = loadingSummary || loadingBacktests;

  const livePrices = useBinancePrices(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT"]);
  const [sessionStatuses, setSessionStatuses] = useState<("open" | "closed" | "overlap")[]>(computeSessionStatuses);
  useEffect(() => {
    const id = setInterval(() => setSessionStatuses(computeSessionStatuses()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const sendMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || isChatLoading) return;
    setChatInput("");
    const newMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    setIsChatLoading(true);
    try {
      const token = localStorage.getItem("tt_token");
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json() as { message?: string; error?: string };
      setMessages(prev => [...prev, { role: "assistant" as const, content: data.message ?? data.error ?? "Error." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant" as const, content: "Network error. Please try again." }]);
    } finally {
      setIsChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [chatInput, messages, isChatLoading]);

  const analytics = useMemo(() => {
    if (!backtests?.length) return null;
    const completed = backtests.filter((b: any) => b.status === "complete");
    if (!completed.length) return null;
    const avg = (arr: number[]) => arr.length ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : 0;
    return {
      avgWR:     avg(completed.map((b: any) => b.winRate ?? 0).filter((v: number) => v > 0)),
      avgPF:     avg(completed.map((b: any) => b.profitFactor ?? 0).filter((v: number) => v > 0)),
      avgSharpe: avg(completed.map((b: any) => b.sharpeRatio ?? 0)),
      avgDD:     avg(completed.map((b: any) => b.maxDrawdown ?? 0)),
      bestReturn: Math.max(...completed.map((b: any) => b.totalReturn ?? 0)),
    };
  }, [backtests]);

  const portfolioInsights = useMemo<Insight[]>(() => {
    if (!backtests?.length) return [
      { icon: TrendingUp, title: "Get Started", body: "Run your first backtest to see personalized performance insights here.", tag: "New", tagColor: C.positive },
    ];
    const completed = (backtests as any[]).filter((b: any) => b.status === "complete");
    if (!completed.length) return [];
    const best = [...completed].sort((a: any, b: any) => Number(b.totalReturn ?? 0) - Number(a.totalReturn ?? 0))[0];
    const avgReturn = completed.reduce((s: number, b: any) => s + Number(b.totalReturn ?? 0), 0) / completed.length;
    const avgSharpe = completed.reduce((s: number, b: any) => s + Number(b.sharpeRatio ?? 0), 0) / completed.length;
    const items: Insight[] = [];
    if (best) {
      const ret = Number(best.totalReturn ?? 0);
      items.push({
        icon: TrendingUp,
        title: "Top Strategy",
        body: `${best.symbol} returned ${ret >= 0 ? "+" : ""}${ret.toFixed(1)}% — your best backtest result to date.`,
        tag: ret >= 5 ? "Profitable" : ret >= 0 ? "Neutral" : "Loss",
        tagColor: ret >= 5 ? C.positive : ret >= 0 ? C.amber : C.negative,
      });
    }
    items.push({
      icon: BarChart2,
      title: "Portfolio",
      body: `${completed.length} completed backtest${completed.length > 1 ? "s" : ""}. Average return: ${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(1)}%.`,
      tag: avgReturn >= 5 ? "Bullish" : avgReturn >= 0 ? "Neutral" : "Review",
      tagColor: avgReturn >= 5 ? C.positive : avgReturn >= 0 ? C.amber : C.negative,
    });
    if (!isNaN(avgSharpe)) {
      items.push({
        icon: Shield,
        title: "Risk Profile",
        body: `Avg Sharpe: ${avgSharpe.toFixed(2)}. ${avgSharpe >= 1 ? "Solid risk-adjusted returns." : avgSharpe >= 0 ? "Moderate efficiency." : "High volatility relative to returns."}`,
        tag: avgSharpe >= 1 ? "Good" : avgSharpe >= 0 ? "Watch" : "Risk",
        tagColor: avgSharpe >= 1 ? C.positive : avgSharpe >= 0 ? C.amber : C.negative,
      });
    }
    return items;
  }, [backtests]);

  const recentBacktests = useMemo(
    () => (backtests ?? []).filter((b: any) => b.status === "complete").slice(0, 6),
    [backtests],
  );

  return (
    <div className="flex flex-col gap-4 pb-4 page-enter">

      {/* Alert Engine Card */}
      <AlertEngineCard />

      {/* Daily Coach Card */}
      <DailyCoachCard />

      {/* AI Coach Section */}
      <AiCoachSection />

      {/* AI Market Pulse Hero */}
      <AiMarketPulse />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mt-1">
        <div>
          <h1 className="text-3xl sm:text-[36px] font-bold" style={{ color: C.text, letterSpacing: "-0.032em" }}>Dashboard</h1>
          <p className="text-[10px] mt-1 font-mono" style={{ color: C.muted, letterSpacing: "0.02em" }}>
            Market overview &amp; performance summary
          </p>
        </div>
        <Button variant="cyan" size="sm" asChild className="flex-shrink-0">
          <Link href="/backtests/new">
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Run Backtest
          </Link>
        </Button>
      </div>

      {/* AI Chat Panel */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
          style={{ borderBottom: chatOpen ? "1px solid var(--glass-border)" : "none" }}
          onClick={() => setChatOpen(v => !v)}
        >
          <span className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)" }}>
            <Bot className="h-4 w-4" style={{ color: "rgba(255,255,255,0.8)" }} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-none mb-0.5" style={{ color: C.text }}>Trading AI</p>
            <p className="text-[10px] font-mono" style={{ color: C.muted }}>
              {chatOpen ? "Powered by LLM · Ask about strategies, indicators, risk" : "Ready to chat · ask about strategies, indicators, risk"}
            </p>
          </div>
          {!chatOpen && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {["What is RSI?", "Bollinger Bands", "Stop loss tips"].map(q => (
                <button
                  key={q}
                  onClick={e => { e.stopPropagation(); setChatInput(q); setChatOpen(true); }}
                  className="hidden sm:block text-[10px] font-mono px-2 py-1 rounded-lg hover:opacity-80"
                  style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: C.sub }}
                >{q}</button>
              ))}
            </div>
          )}
          {chatOpen
            ? <X className="h-4 w-4 flex-shrink-0 opacity-40" style={{ color: C.text }} />
            : <MessageCircle className="h-4 w-4 flex-shrink-0" style={{ color: C.muted }} />}
        </div>
        {chatOpen && (
          <div>
            <div className="overflow-y-auto px-4 py-3 flex flex-col gap-3" style={{ minHeight: 160, maxHeight: "45vh" }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-3">
                  <p className="text-xs font-mono text-center" style={{ color: C.muted }}>
                    Ask me anything about trading strategies, indicators, or risk management.
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {["What is RSI?", "Explain Bollinger Bands", "How to use stop loss?", "Best EMA settings?"].map(q => (
                      <button key={q} onClick={() => setChatInput(q)}
                        className="text-[11px] font-mono px-3 py-1.5 rounded-xl hover:opacity-80"
                        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: C.sub }}
                      >{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[80%] px-3 py-2 rounded-2xl text-xs font-mono leading-relaxed whitespace-pre-wrap"
                    style={m.role === "user"
                      ? { background: "rgba(255,255,255,0.10)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.16)", borderBottomRightRadius: 4, fontWeight: 600 }
                      : { background: "var(--glass-bg)", color: C.text, border: "1px solid var(--glass-border)", borderBottomLeftRadius: 4 }}
                  >{m.content}</div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-mono"
                    style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: C.muted }}>
                    <span className="h-1 w-1 rounded-full live-pulse" style={{ background: "rgba(255,255,255,0.7)" }} />
                    Thinking…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="px-4 pb-4 pt-2" style={{ borderTop: "1px solid var(--glass-border)" }}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
                  placeholder="Ask about trading…"
                  className="flex-1 text-xs font-mono bg-transparent outline-none"
                  style={{ color: C.text }}
                />
                <button onClick={() => void sendMessage()} disabled={!chatInput.trim() || isChatLoading}
                  className="h-6 w-6 rounded-lg flex items-center justify-center disabled:opacity-30"
                  style={{ background: "rgba(255,255,255,0.12)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.18)" }}
                ><Send className="h-3 w-3" /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Market overview bar */}
      <Panel>
        <SectionLabel>Market Overview</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {WATCHLIST.map(w => {
            const live = w.binanceKey ? livePrices[w.binanceKey] : undefined;
            const displayPrice  = live ? fmtLivePrice(live.price)   : w.price;
            const displayChange = live ? live.changePct24h           : w.change;
            const up = displayChange >= 0;
            return (
              <div
                key={w.symbol}
                className="rounded-xl px-3 py-2 text-center glass-shine"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
              >
                <p className="text-[10px] font-mono mb-1" style={{ color: C.muted }}>{w.symbol}</p>
                <p className="text-sm font-mono font-bold" style={{ color: C.text }}>{displayPrice}</p>
                <p className="text-[11px] font-mono font-semibold"
                  style={{ color: up ? C.positive : C.negative }}>
                  {up ? "+" : ""}{displayChange.toFixed(2)}%
                </p>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Paper Trading Section */}
      <PaperTradingSection />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <StatCard icon={TrendingUp}  label="Best Return"    accent={C.positive} value={isLoading ? null : fmtPct(summary?.bestReturn)} isLoading={isLoading} />
        <StatCard icon={Percent}     label="Avg Win Rate"   value={isLoading ? null : analytics ? `${analytics.avgWR.toFixed(1)}%` : "—"} isLoading={isLoading} />
        <StatCard icon={Target}      label="Profit Factor"  value={isLoading ? null : analytics ? fmtNum(analytics.avgPF) : "—"} isLoading={isLoading} />
        <StatCard icon={Zap}         label="Avg Sharpe"     value={isLoading ? null : analytics ? fmtNum(analytics.avgSharpe) : "—"} isLoading={isLoading} />
        <StatCard icon={Clock}       label="Total Backtests" value={isLoading ? null : (summary?.totalBacktests ?? 0)} isLoading={isLoading} />
        <StatCard icon={Shield}      label="Avg Drawdown"   accent={C.negative} value={isLoading ? null : analytics ? `-${Math.abs(analytics.avgDD).toFixed(1)}%` : "—"} isLoading={isLoading} />
        <StatCard icon={DollarSign}  label="Best Trade"     accent={C.positive} value={isLoading ? null : analytics ? fmtPct(analytics.bestReturn) : "—"} isLoading={isLoading} />
        <StatCard icon={Activity}    label="Total Trades"   value={isLoading ? null : (summary?.totalTrades ?? 0)} isLoading={isLoading} />
      </div>

      {/* Trader DNA Command Center */}
      <TraderDNACommandCenter />

      {/* Middle row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Watchlist */}
        <Panel>
          <div className="flex items-center justify-between mb-1">
            <SectionLabel>Watchlist</SectionLabel>
            <Link href="/chart">
              <span className="text-[10px] font-mono flex items-center gap-1 cursor-pointer hover:opacity-70 mb-3"
                style={{ color: C.sub }}>
                <CandlestickChart className="h-3 w-3" /> View Charts
              </span>
            </Link>
          </div>
          {WATCHLIST.map((w, i) => (
            <WatchRow
              key={w.symbol}
              item={w}
              last={i === WATCHLIST.length - 1}
              livePrice={w.binanceKey ? livePrices[w.binanceKey] : undefined}
            />
          ))}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <SectionLabel>Trading Sessions</SectionLabel>
            {SESSIONS.map((s, i) => (
              <SessionRow key={s.name} s={s} status={sessionStatuses[i] ?? "closed"} last={i === SESSIONS.length - 1} />
            ))}
          </Panel>

          <Panel>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Demo Account</SectionLabel>
              <Link href="/chart">
                <span className="text-[10px] font-mono cursor-pointer hover:opacity-70" style={{ color: C.sub }}>
                  Open Chart →
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
            <Brain className="h-3.5 w-3.5" style={{ color: C.muted }} />
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.muted }}>Portfolio Insights</p>
          </div>
          <Link href="/ai">
            <span className="text-[10px] font-mono flex items-center gap-1 cursor-pointer hover:opacity-70"
              style={{ color: C.sub }}>
              Full Analysis <ArrowUpRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {portfolioInsights.map(item => <InsightCard key={item.title} item={item} />)}
        </div>
      </div>

      {/* Recent backtests */}
      <Panel>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Recent Backtests</SectionLabel>
          <Link href="/backtests">
            <span className="text-[10px] font-mono flex items-center gap-1 cursor-pointer hover:opacity-70"
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
          <div>{recentBacktests.map((bt: any) => <RecentRow key={bt.id} bt={bt} />)}</div>
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
