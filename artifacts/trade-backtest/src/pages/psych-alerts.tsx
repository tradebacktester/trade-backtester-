import React, { useState, useEffect, useCallback } from "react";
import {
  Brain, AlertTriangle, TrendingDown, Zap, BarChart2,
  Activity, Target, Shield, Eye, RefreshCw, Trash2,
  CheckCheck, ChevronDown, ChevronUp, Clock, Info, ExternalLink,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { API } from "@/lib/api-config";

// ── Types ────────────────────────────────────────────────────────────────────

type PsychAlertType =
  | "fomo" | "revenge" | "overtrading" | "aggressive"
  | "emotional" | "tilt" | "discipline" | "confirmation_bias";

type Severity = "low" | "medium" | "high" | "critical";
type CoachStatus = "green" | "yellow" | "orange" | "red";

interface PsychEvent {
  id: number;
  type: PsychAlertType;
  severity: Severity;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  detectedAt: string;
}

interface CoachAssessment {
  status: CoachStatus;
  statusLabel: string;
  headline: string;
  detail: string;
  recommendation: string;
  confidence?: number;
  sampleSize?: number;
}

interface Stats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  unreadCount: number;
}

interface TrendDataPoint {
  date: string;
  total: number;
  fomo?: number;
  revenge?: number;
  overtrading?: number;
  aggressive?: number;
}

interface PsychData {
  events: PsychEvent[];
  detectedNow: { type: PsychAlertType; severity: Severity; title: string; message: string }[];
  coach: CoachAssessment;
  stats: Stats;
  trendData?: TrendDataPoint[];
}

// ── Alert metadata ────────────────────────────────────────────────────────────

const ALERT_META: Record<PsychAlertType, { icon: React.ElementType; color: string; label: string; emoji: string }> = {
  fomo:               { icon: Zap,           color: "#f59e0b", label: "FOMO",              emoji: "🚨" },
  revenge:            { icon: TrendingDown,   color: "#ef4444", label: "Revenge Trading",   emoji: "🚨" },
  overtrading:        { icon: BarChart2,      color: "#f97316", label: "Overtrading",        emoji: "🚨" },
  aggressive:         { icon: AlertTriangle,  color: "#dc2626", label: "Aggressive Risk",    emoji: "🚨" },
  emotional:          { icon: Activity,       color: "#a78bfa", label: "Emotional Trading",  emoji: "🚨" },
  tilt:               { icon: Brain,          color: "#f43f5e", label: "Tilt",               emoji: "🚨" },
  discipline:         { icon: Shield,         color: "#6366f1", label: "Fading Discipline",  emoji: "🚨" },
  confirmation_bias:  { icon: Eye,            color: "#22d3ee", label: "Confirmation Bias",  emoji: "🚨" },
};

const SEVERITY_STYLE: Record<Severity, { bg: string; border: string; badge: string; text: string }> = {
  low:      { bg: "rgba(34,211,238,0.04)",  border: "rgba(34,211,238,0.15)",  badge: "#22d3ee", text: "Low"      },
  medium:   { bg: "rgba(245,158,11,0.05)",  border: "rgba(245,158,11,0.2)",   badge: "#f59e0b", text: "Medium"   },
  high:     { bg: "rgba(239,68,68,0.06)",   border: "rgba(239,68,68,0.2)",    badge: "#ef4444", text: "High"     },
  critical: { bg: "rgba(244,63,94,0.08)",   border: "rgba(244,63,94,0.3)",    badge: "#f43f5e", text: "Critical" },
};

const COACH_STYLE: Record<CoachStatus, { bg: string; border: string; glow: string; dot: string; ringColor: string }> = {
  green:  { bg: "rgba(34,197,94,0.06)",   border: "rgba(34,197,94,0.25)",  glow: "rgba(34,197,94,0.12)",   dot: "#22c55e",  ringColor: "#22c55e" },
  yellow: { bg: "rgba(234,179,8,0.07)",   border: "rgba(234,179,8,0.3)",   glow: "rgba(234,179,8,0.15)",   dot: "#eab308",  ringColor: "#eab308" },
  orange: { bg: "rgba(249,115,22,0.07)",  border: "rgba(249,115,22,0.3)",  glow: "rgba(249,115,22,0.15)",  dot: "#f97316",  ringColor: "#f97316" },
  red:    { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",   glow: "rgba(239,68,68,0.18)",   dot: "#ef4444",  ringColor: "#ef4444" },
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function PsychAlertsPage() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [data, setData] = useState<PsychData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = useCallback(async (showToast = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/psych-alerts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const d = await res.json() as PsychData;
      setData(d);
      if (showToast) toast({ title: "Analysis refreshed", description: `${d.events.length} behavior events found` });
    } catch {
      toast({ title: "Could not load psychology data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => { load(); }, [load]);

  async function markAllRead() {
    if (!token) return;
    await fetch(`${API}/api/psych-alerts/read-all`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setData(prev => prev ? { ...prev, events: prev.events.map(e => ({ ...e, isRead: true })), stats: { ...prev.stats, unreadCount: 0 } } : prev);
    toast({ title: "All alerts marked as read" });
  }

  async function clearAll() {
    if (!token) return;
    await fetch(`${API}/api/psych-alerts`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setData(prev => prev ? { ...prev, events: [], stats: { ...prev.stats, unreadCount: 0 } } : prev);
    toast({ title: "Alert history cleared" });
  }

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Render: no auth ───────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Brain className="h-12 w-12 opacity-20" style={{ color: "var(--text-muted)" }} />
        <p className="font-medium" style={{ color: "var(--text-primary)" }}>Sign in to view Psychology Alerts</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Your behavioral trading patterns will appear here</p>
      </div>
    );
  }

  const coach = data?.coach;
  const events = data?.events ?? [];
  const stats = data?.stats;
  const coachStyle = COACH_STYLE[coach?.status ?? "green"];

  // Group events by type for summary
  const byType = events.reduce<Record<string, PsychEvent[]>>((acc, e) => {
    if (!acc[e.type]) acc[e.type] = [];
    acc[e.type]!.push(e);
    return acc;
  }, {});

  const unread = events.filter(e => !e.isRead).length;
  const critical = events.filter(e => e.severity === "critical").length;
  const high = events.filter(e => e.severity === "high").length;

  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Psychology Alerts</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Behavioral pattern detection & AI coaching from your paper trades
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)", color: "#22d3ee" }}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444" }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
          <Button
            size="sm"
            onClick={() => load(true)}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Analyze
          </Button>
        </div>
      </div>

      {/* ── Loading skeleton ────────────────────────────────────────────── */}
      {loading && !data && (
        <div className="flex items-center justify-center py-20 gap-3" style={{ color: "var(--text-muted)" }}>
          <Brain className="h-5 w-5 animate-pulse" />
          <span className="text-sm">Analyzing trading behavior…</span>
        </div>
      )}

      {data && (
        <>
          {/* ── AI Coach Card ─────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: coachStyle.bg, border: `1px solid ${coachStyle.border}`, boxShadow: `0 0 40px ${coachStyle.glow}` }}
          >
            <div className="flex items-start gap-4">
              {/* Status ring */}
              <div
                className="relative flex-shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center"
                style={{ background: `${coachStyle.dot}18`, border: `2px solid ${coachStyle.dot}40` }}
              >
                <Brain className="h-6 w-6" style={{ color: coachStyle.dot }} />
                <span
                  className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2"
                  style={{ background: coachStyle.dot, borderColor: "var(--bg-primary)" }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-widest font-mono" style={{ color: coachStyle.dot }}>
                    AI Coach · {coach?.statusLabel ?? "Analyzing"}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase"
                    style={{ background: `${coachStyle.dot}20`, color: coachStyle.dot, border: `1px solid ${coachStyle.dot}30` }}
                  >
                    {coach?.status === "green" ? "🟢 Normal" : coach?.status === "yellow" ? "🟡 Watch" : coach?.status === "orange" ? "🟠 Warning" : "🔴 Stop"}
                  </span>
                </div>
                <p className="text-base font-bold mt-1" style={{ color: "var(--text-primary)" }}>
                  {coach?.headline ?? "Analyzing your behavior…"}
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  {coach?.detail}
                </p>
                {coach?.recommendation && (
                  <div
                    className="mt-3 flex items-start gap-2 px-3 py-2 rounded-xl text-xs"
                    style={{ background: `${coachStyle.dot}10`, border: `1px solid ${coachStyle.dot}25`, color: "var(--text-secondary)" }}
                  >
                    <Target className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: coachStyle.dot }} />
                    <span>{coach.recommendation}</span>
                  </div>
                )}
                {/* Confidence indicator */}
                {coach?.confidence !== undefined && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${coach.confidence}%`,
                          background: coach.confidence >= 75 ? "#22c55e" : coach.confidence >= 60 ? "#f59e0b" : "#94a3b8",
                        }}
                      />
                    </div>
                    <span
                      className="text-[10px] font-mono whitespace-nowrap"
                      style={{ color: coach.confidence >= 60 ? coachStyle.dot : "var(--text-muted)" }}
                    >
                      {coach.confidence}% confidence
                      {coach.sampleSize !== undefined && ` · ${coach.sampleSize} trades`}
                    </span>
                  </div>
                )}
                {coach?.confidence !== undefined && coach.confidence < 60 && coach.sampleSize !== undefined && (
                  <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    <Info className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                    Insufficient data for reliable analysis. Run more paper trades to improve accuracy.
                  </p>
                )}
              </div>

              {/* Stats mini */}
              <div className="flex flex-col gap-2 text-right flex-shrink-0 hidden sm:flex">
                <div>
                  <p className="text-[10px] font-mono uppercase" style={{ color: "var(--text-muted)" }}>Win Rate</p>
                  <p className="text-lg font-bold" style={{ color: stats?.winRate && stats.winRate >= 50 ? "#22c55e" : "#ef4444" }}>
                    {stats?.winRate ?? 0}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase" style={{ color: "var(--text-muted)" }}>Total P&L</p>
                  <p className="text-base font-bold" style={{ color: (stats?.totalPnl ?? 0) >= 0 ? "#22c55e" : "#ef4444" }}>
                    {(stats?.totalPnl ?? 0) >= 0 ? "+" : ""}${stats?.totalPnl?.toFixed(2) ?? "0.00"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Behavior resemblance banner (if orange/red) ───────────────── */}
          {(coach?.status === "orange" || coach?.status === "red") && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.25)" }}
            >
              <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: "#f43f5e" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                <strong style={{ color: "#f43f5e" }}>Your behavior currently resembles traders who typically lose money.</strong>
                {" "}Review the alerts below and consider pausing until your patterns stabilize.
              </p>
            </div>
          )}

          {/* ── Stats row ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Paper Trades",   value: stats?.totalTrades ?? 0,  icon: BarChart2,     color: "#38bdf8" },
              { label: "Unread Alerts",  value: unread,                    icon: AlertTriangle, color: "#f59e0b" },
              { label: "Critical",       value: critical,                  icon: Zap,           color: "#f43f5e" },
              { label: "High Risk",      value: high,                      icon: TrendingDown,  color: "#f97316" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-3 flex items-center gap-3"
                style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${s.color}18`, border: `1px solid ${s.color}30` }}>
                  <s.icon className="h-3.5 w-3.5" style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                  <p className="text-lg font-bold leading-none mt-0.5" style={{ color: "var(--text-primary)" }}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Alert type legend ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.entries(ALERT_META) as [PsychAlertType, typeof ALERT_META[PsychAlertType]][]).map(([type, meta]) => {
              const count = (byType[type] ?? []).length;
              const Icon = meta.icon;
              return (
                <div
                  key={type}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{
                    background: count > 0 ? `${meta.color}08` : "var(--card-bg)",
                    border: `1px solid ${count > 0 ? meta.color + "30" : "var(--border)"}`,
                    opacity: count > 0 ? 1 : 0.5,
                  }}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: meta.color }} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono uppercase truncate" style={{ color: "var(--text-muted)" }}>{meta.label}</p>
                    <p className="text-sm font-bold leading-none mt-0.5" style={{ color: count > 0 ? meta.color : "var(--text-muted)" }}>
                      {count} event{count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 30-day Alert Trend ────────────────────────────────────────── */}
          {data?.trendData && data.trendData.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                30-Day Alert Trend
              </p>
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={data.trendData} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickFormatter={d => (d as string).slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: "var(--text-primary)" }}
                  />
                  {(["fomo", "revenge", "overtrading", "aggressive"] as PsychAlertType[]).map((type, i) => (
                    <Bar key={type} dataKey={type} stackId="a"
                      fill={ALERT_META[type]?.color ?? "#a78bfa"}
                      name={ALERT_META[type]?.label ?? type}
                      radius={i === 3 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Event list ────────────────────────────────────────────────── */}
          {events.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 py-16 rounded-2xl"
              style={{ background: "var(--card-bg)", border: "1px dashed var(--border)" }}
            >
              <Shield className="h-10 w-10 opacity-20" style={{ color: "var(--text-muted)" }} />
              <div className="text-center">
                <p className="font-medium" style={{ color: "var(--text-primary)" }}>No behavioral alerts detected</p>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  Run paper trades to generate behavioral analysis. Alerts appear automatically.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => load(true)}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Refresh analysis
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Sort: unread first, then by severity */}
              {[...events]
                .sort((a, b) => {
                  if (!a.isRead && b.isRead) return -1;
                  if (a.isRead && !b.isRead) return 1;
                  const sev = { critical: 4, high: 3, medium: 2, low: 1 };
                  return (sev[b.severity] ?? 0) - (sev[a.severity] ?? 0);
                })
                .map(event => {
                  const meta = ALERT_META[event.type as PsychAlertType] ?? ALERT_META.fomo;
                  const sev = SEVERITY_STYLE[event.severity as Severity] ?? SEVERITY_STYLE.medium;
                  const Icon = meta.icon;
                  const isExp = expanded.has(event.id);

                  return (
                    <div
                      key={event.id}
                      className="rounded-2xl overflow-hidden transition-all"
                      style={{
                        background: event.isRead ? "var(--card-bg)" : sev.bg,
                        border: `1px solid ${event.isRead ? "var(--border)" : sev.border}`,
                        opacity: event.isRead ? 0.75 : 1,
                      }}
                    >
                      {/* Main row */}
                      <button
                        className="w-full flex items-start gap-3 p-4 text-left"
                        onClick={() => toggleExpand(event.id)}
                      >
                        {/* Icon */}
                        <div
                          className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}30` }}
                        >
                          <Icon className="h-4 w-4" style={{ color: meta.color }} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                              {meta.emoji} {event.title}
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase"
                              style={{ background: `${sev.badge}20`, color: sev.badge, border: `1px solid ${sev.badge}30` }}
                            >
                              {sev.text}
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded-md text-[10px] font-mono"
                              style={{ background: `${meta.color}10`, color: meta.color }}
                            >
                              {meta.label}
                            </span>
                            {!event.isRead && (
                              <span
                                className="h-2 w-2 rounded-full flex-shrink-0"
                                style={{ background: sev.badge }}
                              />
                            )}
                          </div>
                          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                            {event.message}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Clock className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
                            <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                              {new Date(event.detectedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Expand chevron */}
                        <div className="flex-shrink-0 mt-1">
                          {isExp
                            ? <ChevronUp className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                            : <ChevronDown className="h-4 w-4" style={{ color: "var(--text-muted)" }} />}
                        </div>
                      </button>

                      {/* Expanded metadata */}
                      {isExp && Object.keys(event.metadata).length > 0 && (
                        <div
                          className="px-4 pb-4 pt-0"
                          style={{ borderTop: `1px solid ${sev.border}` }}
                        >
                          <div className="mt-3 flex items-start gap-2">
                            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(event.metadata).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="px-2 py-1 rounded-lg text-[11px] font-mono"
                                  style={{ background: "var(--card-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                                >
                                  <span style={{ color: "var(--text-muted)" }}>{k}:</span>{" "}
                                  <span style={{ color: meta.color }}>{String(v)}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                          {typeof event.metadata.tradeId === "number" && (
                            <div className="mt-3">
                              <Link href={`/trading-os?tab=paper&highlightTradeId=${event.metadata.tradeId}`}>
                                <span
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer"
                                  style={{ background: `${meta.color}12`, border: `1px solid ${meta.color}30`, color: meta.color }}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View Trade #{event.metadata.tradeId}
                                </span>
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {/* ── Alert type guide ───────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-4"
            style={{ background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.15)" }}
          >
            <h3 className="text-xs font-bold uppercase tracking-widest font-mono mb-3" style={{ color: "#a78bfa" }}>
              How Psychology Alerts Work
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              {[
                { label: "FOMO", desc: "Entry after 3+ wins or chasing price by >3%" },
                { label: "Revenge", desc: "New trade within 15 min of a loss" },
                { label: "Overtrading", desc: "More than 8 trades in 24 hours" },
                { label: "Aggressive", desc: "Position size 2.5× above your average" },
                { label: "Emotional", desc: "Avg hold < 3 min or burst of 3+ in 10 min" },
                { label: "Tilt", desc: "3+ consecutive losses with escalating size" },
                { label: "Confirmation Bias", desc: "5 same-direction trades with <40% win rate" },
                { label: "Fading Discipline", desc: "Recent win rate drops 20%+ below historical" },
              ].map(row => (
                <div key={row.label} className="flex items-start gap-2">
                  <span
                    className="font-bold flex-shrink-0"
                    style={{ color: ALERT_META[row.label.toLowerCase().replace(/ /g, "_") as PsychAlertType]?.color ?? "#a78bfa" }}
                  >
                    {row.label}:
                  </span>
                  <span>{row.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
