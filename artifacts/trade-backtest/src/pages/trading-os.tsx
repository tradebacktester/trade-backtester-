import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AuthModal } from "@/components/auth-modal";
import {
  Brain, Zap, Target, Shield, TrendingUp, TrendingDown, AlertTriangle,
  Bot, BarChart2, Activity, Trophy, Heart, BookOpen, Sparkles, ChevronRight,
  RefreshCw, Loader2, CheckCircle2, XCircle, Clock, Star, Award, Flame,
  DollarSign, Eye, Ghost, Swords, FileText, Telescope, ArrowUpRight,
  ArrowDownRight, Minus, AlertCircle, Play, Calculator, Users2, ExternalLink,
  ScanLine, ChevronDown, RotateCcw, Plus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";
import { SkeletonPulse as Skel } from "@/components/ui/skeleton-cards";
import { apiFetch } from "@/lib/api-error";
import { DataErrorBoundary } from "@/components/data-error-boundary";

/* ── Design tokens ─────────────────────────────────────────────────────── */
const C = {
  text:     "hsl(var(--foreground))",
  sub:      "hsl(var(--muted-foreground))",
  border:   "hsl(var(--border))",
  green:    "#22c55e",
  red:      "#ef4444",
  amber:    "#f59e0b",
  purple:   "#a855f7",
  cyan:     "#06b6d4",
  blue:     "#3b82f6",
  pink:     "#ec4899",
};
const CARD: React.CSSProperties  = { background: "var(--card-bg)", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-card)" };
const GLASS: React.CSSProperties = { background: "var(--glass-bg)", border: "1px solid var(--glass-border)" };

/* ── API helper ─────────────────────────────────────────────────────────── */
function useOSFetch<T>(path: string, token: string | null, _deps: unknown[] = []) {
  const { data, isLoading, error, refetch } = useQuery<T, Error>({
    queryKey: ["trading-os", path, token],
    queryFn: () => apiFetch<T>(`${API_BASE}/api/trading-os/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    enabled: !!token,
    staleTime: 60_000,
    retry: (failureCount, err) => {
      if ("status" in err && typeof (err as { status: number }).status === "number") {
        const status = (err as { status: number }).status;
        if ([401, 403, 404].includes(status)) return false;
      }
      return failureCount < 2;
    },
  });
  return {
    data: data ?? null,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
    reload: () => void refetch(),
  };
}

async function postOS<T>(path: string, token: string, body: unknown): Promise<T> {
  return apiFetch<T>(`${API_BASE}/api/trading-os/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* ── Score gauge ────────────────────────────────────────────────────────── */
function ScoreGauge({ score, color, size = 80 }: { score: number; color: string; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={7} strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round" style={{ transition: "stroke-dasharray 0.8s ease" }} />
    </svg>
  );
}

/* ── Tabs ───────────────────────────────────────────────────────────────── */
const TABS = [
  { id: "overview",      label: "Overview",        icon: Brain,       color: C.purple  },
  { id: "coach",         label: "AI Coach",         icon: Sparkles,    color: C.amber   },
  { id: "mirror",        label: "Trade Mirror™",    icon: ScanLine,    color: "#e2e8f0" },
  { id: "fomo",          label: "FOMO Detector",    icon: AlertCircle, color: C.red     },
  { id: "mistakes",      label: "Mistakes $",       icon: DollarSign,  color: "#f97316" },
  { id: "rank",          label: "Trader Rank",      icon: Trophy,      color: C.amber   },
  { id: "report",        label: "Fund Report",      icon: FileText,    color: C.green   },
  { id: "opportunities", label: "Missed Setups",    icon: Telescope,   color: C.pink    },
] as const;
type TabId = typeof TABS[number]["id"];

/* ══════════════════════════════════════════════════════════════════════════
   FEATURE 1 — Overview: Health Score + Rank summary
══════════════════════════════════════════════════════════════════════════ */
function OverviewTab({ token }: { token: string }) {
  const dashboard = useOSFetch<any>("dashboard", token);
  const coach     = useOSFetch<any>("coach-briefing", token);

  const hs = dashboard.data?.healthScore ?? null;
  const rk = dashboard.data?.rank ?? null;
  const co = coach.data;

  return (
    <div className="flex flex-col gap-5">
      {/* Top row: Health + Rank */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Health Score */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={CARD}>
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4" style={{ color: C.red }} />
            <span className="text-xs font-mono uppercase tracking-widest" style={{ color: C.sub }}>Trader Health Score</span>
          </div>
          {dashboard.loading ? (
            <Skel className="h-24" />
          ) : hs ? (
            <>
              <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center" style={{ width: 90, height: 90 }}>
                  <DataErrorBoundary label="health score gauge" compact>
                  <ScoreGauge score={hs.score} color={hs.statusColor} size={90} />
                  </DataErrorBoundary>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-bold" style={{ color: hs.statusColor }}>{hs.score}</span>
                    <span className="text-[9px] font-mono" style={{ color: C.sub }}>/100</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2" style={{ color: C.text }}>{hs.recommendation}</p>
                  <p className="text-xs" style={{ color: C.sub }}>
                    Risk multiplier: <span style={{ color: hs.riskMultiplier >= 1 ? C.green : C.amber }}>{(hs.riskMultiplier * 100).toFixed(0)}%</span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t" style={{ borderColor: C.border }}>
                {Object.entries(hs.breakdown as Record<string, number>).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full" style={{ background: "hsl(var(--muted))" }}>
                      <div className="h-1 rounded-full" style={{ width: `${(v / 30) * 100}%`, background: C.green }} />
                    </div>
                    <span className="text-[10px] w-5 text-right font-mono" style={{ color: C.sub }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm" style={{ color: C.sub }}>No data yet</p>}
        </div>

        {/* Trader Rank */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={CARD}>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4" style={{ color: C.amber }} />
            <span className="text-xs font-mono uppercase tracking-widest" style={{ color: C.sub }}>Trader Rank</span>
          </div>
          {dashboard.loading ? (
            <Skel className="h-24" />
          ) : rk ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{rk.rank.icon}</span>
                <div>
                  <p className="font-bold text-base" style={{ color: rk.rank.color }}>{rk.rank.name}</p>
                  <p className="text-xs" style={{ color: C.sub }}>{rk.rank.description}</p>
                  <p className="text-xs mt-1 font-mono" style={{ color: C.sub }}>Score: <span style={{ color: C.text }}>{rk.score}/100</span></p>
                </div>
              </div>
              {rk.nextRank && (
                <div>
                  <div className="flex justify-between text-[10px] mb-1" style={{ color: C.sub }}>
                    <span>Progress to {rk.nextRank.icon} {rk.nextRank.name}</span>
                    <span className="font-mono">{rk.pctToNext}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "hsl(var(--muted))" }}>
                    <div className="h-2 rounded-full transition-all" style={{ width: `${rk.pctToNext}%`, background: rk.rank.color }} />
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {(rk.achievements as { id: string; icon: string; label: string; earned: boolean }[]).filter(a => a.earned).map((a) => (
                  <span key={a.id} className="text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: "hsl(var(--muted))", color: C.amber }}>{a.icon} {a.label}</span>
                ))}
              </div>
            </>
          ) : <p className="text-sm" style={{ color: C.sub }}>No data yet</p>}
        </div>
      </div>

      {/* Coach Quick Briefing */}
      <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ ...CARD, background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(270 60% 8%) 100%)" }}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: C.amber }} />
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: C.sub }}>Today's Coach Briefing</span>
          {coach.loading && <Loader2 className="h-3 w-3 animate-spin ml-auto" style={{ color: C.sub }} />}
        </div>
        {coach.loading ? (
          <div className="flex flex-col gap-2"><Skel className="h-5 w-3/4" /><Skel className="h-4 w-full" /><Skel className="h-4 w-5/6" /></div>
        ) : co ? (
          <>
            <p className="text-sm font-semibold" style={{ color: C.amber }}>{co.greeting as string}</p>
            <p className="text-sm" style={{ color: C.text }}>{co.keyInsight as string}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="rounded-xl p-3" style={GLASS}>
                <p className="text-[10px] font-mono uppercase mb-1" style={{ color: C.sub }}>Session Advice</p>
                <p className="text-xs" style={{ color: C.text }}>{co.sessionAdvice as string}</p>
              </div>
              <div className="rounded-xl p-3" style={GLASS}>
                <p className="text-[10px] font-mono uppercase mb-1" style={{ color: C.sub }}>Today's Goal</p>
                <p className="text-xs font-medium" style={{ color: C.green }}>{co.todayGoal as string}</p>
              </div>
            </div>
            {co.warning && (
              <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: "hsl(0 60% 10%)", border: "1px solid hsl(0 60% 25%)" }}>
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: C.red }} />
                <p className="text-xs" style={{ color: "#fca5a5" }}>{co.warning as string}</p>
              </div>
            )}
          </>
        ) : <p className="text-sm" style={{ color: C.sub }}>Sign in to get your daily briefing.</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FEATURE 10 — Personal AI Coach
══════════════════════════════════════════════════════════════════════════ */
function CoachTab({ token }: { token: string }) {
  const { data, loading, error, reload } = useOSFetch<any>("coach-briefing", token);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: C.text }}>Personal Trading Coach</h2>
          <p className="text-xs" style={{ color: C.sub }}>AI-generated daily briefing based on your full trading history</p>
        </div>
        <button onClick={reload} className="p-2 rounded-xl transition-colors hover:opacity-70" style={GLASS}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} style={{ color: C.sub }} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3"><Skel className="h-8 w-2/3" /><Skel className="h-20" /><Skel className="h-16" /></div>
      ) : error ? (
        <div className="rounded-2xl p-5 text-center" style={CARD}>
          <p className="text-sm" style={{ color: C.red }}>{error}</p>
          <button onClick={reload} className="mt-3 text-xs px-4 py-2 rounded-xl" style={{ background: C.blue, color: "#fff" }}>Retry</button>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-4">
          {/* Greeting */}
          <div className="rounded-2xl p-6" style={{ ...CARD, background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(270 50% 8%) 100%)" }}>
            <div className="flex items-start gap-3">
              <div className="rounded-xl p-2" style={{ background: "hsl(270 60% 20%)" }}>
                <Sparkles className="h-5 w-5" style={{ color: C.amber }} />
              </div>
              <div>
                <p className="text-lg font-bold mb-2" style={{ color: C.amber }}>{data.greeting as string}</p>
                {data.recentForm && (
                  <p className="text-xs font-mono" style={{ color: C.sub }}>
                    Last {(data.recentForm as { total?: number })?.total ?? 0} trades: <span style={{ color: C.green }}>{(data.recentForm as { wins?: number })?.wins ?? 0}W</span> / <span style={{ color: C.red }}>{(data.recentForm as { losses?: number })?.losses ?? 0}L</span>
                    {" · "} Rank Score: <span style={{ color: C.text }}>{(data.rankScore as number | undefined) ?? 0}/100</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Key Insight */}
          <div className="rounded-2xl p-5" style={CARD}>
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4" style={{ color: C.cyan }} />
              <span className="text-xs font-mono uppercase tracking-widest" style={{ color: C.sub }}>Key Insight</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: C.text }}>{data.keyInsight as string}</p>
          </div>

          {/* Session + Goal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={CARD}>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4" style={{ color: C.blue }} />
                <span className="text-xs font-mono uppercase tracking-widest" style={{ color: C.sub }}>Session Advice</span>
              </div>
              <p className="text-sm" style={{ color: C.text }}>{data.sessionAdvice as string}</p>
              {data.bestSession && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: "hsl(var(--muted))", color: C.green }}>
                    ↑ {(data.bestSession as { label?: string })?.label ?? "—"} {(data.bestSession as { winRate?: number })?.winRate ?? 0}%
                  </span>
                </div>
              )}
            </div>
            <div className="rounded-2xl p-5" style={CARD}>
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4" style={{ color: C.green }} />
                <span className="text-xs font-mono uppercase tracking-widest" style={{ color: C.sub }}>Today's Goal</span>
              </div>
              <p className="text-sm font-medium" style={{ color: C.green }}>{data.todayGoal as string}</p>
            </div>
          </div>

          {/* Warning */}
          {data.warning && (
            <div className="rounded-2xl p-5 flex items-start gap-3" style={{ background: "hsl(0 60% 8%)", border: "1px solid hsl(0 60% 22%)" }}>
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: C.red }} />
              <div>
                <p className="text-xs font-mono uppercase mb-1" style={{ color: C.red }}>Pattern Warning</p>
                <p className="text-sm" style={{ color: "#fca5a5" }}>{data.warning as string}</p>
              </div>
            </div>
          )}

          <p className="text-[10px] text-center font-mono" style={{ color: C.sub }}>
            Generated {data.generatedAt ? new Date(data.generatedAt as string).toLocaleString() : "now"} · AI-powered coaching based on your trading history
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FEATURE 1 — Trade Ghost Mode
══════════════════════════════════════════════════════════════════════════ */
function GhostTab({ token }: { token: string }) {
  const [symbol, setSymbol]  = useState("BTCUSDT");
  const [side, setSide]      = useState("long");
  const [duration, setDuration] = useState(1);
  const [result, setResult]  = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]    = useState<string | null>(null);

  const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "EURUSD", "GBPUSD", "AAPL", "TSLA", "SPY"];

  async function run() {
    setLoading(true); setError(null);
    try {
      const r = await postOS<any>("ghost", token, { symbol, side, durationDays: duration });
      setResult(r);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  const simScore = result?.similarityScore ?? 0;
  const simColor = simScore >= 70 ? C.green : simScore >= 40 ? C.amber : C.sub;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold" style={{ color: C.text }}>Trade Ghost Mode</h2>
        <p className="text-xs" style={{ color: C.sub }}>Compare your current setup against every trade in your history</p>
      </div>

      {/* Input */}
      <div className="rounded-2xl p-5 flex flex-col gap-4" style={CARD}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest mb-1 block" style={{ color: C.sub }}>Symbol</label>
            <select value={symbol} onChange={e => setSymbol(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm" style={{ background: "hsl(var(--muted))", color: C.text, border: "1px solid hsl(var(--border))" }}>
              {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest mb-1 block" style={{ color: C.sub }}>Side</label>
            <select value={side} onChange={e => setSide(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm" style={{ background: "hsl(var(--muted))", color: C.text, border: "1px solid hsl(var(--border))" }}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest mb-1 block" style={{ color: C.sub }}>Est. Duration (days)</label>
            <input type="number" min={1} max={365} value={duration} onChange={e => setDuration(Number(e.target.value))}
              className="w-full rounded-xl px-3 py-2 text-sm" style={{ background: "hsl(var(--muted))", color: C.text, border: "1px solid hsl(var(--border))" }} />
          </div>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: C.cyan, color: "#000" }}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ghost className="h-4 w-4" />}
          Analyze with Trade Ghost
        </button>
      </div>

      {error && <div className="rounded-2xl p-4 text-sm" style={{ background: "hsl(0 60% 10%)", color: C.red }}>{error}</div>}

      {result && (
        <div className="flex flex-col gap-4">
          {/* Similarity score */}
          <div className="rounded-2xl p-6 flex items-center gap-6" style={{ ...CARD, border: `1px solid ${simColor}40` }}>
            <div className="relative" style={{ width: 100, height: 100 }}>
              <DataErrorBoundary label="similarity score gauge" compact>
              <ScoreGauge score={simScore} color={simColor} size={100} />
              </DataErrorBoundary>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold font-mono" style={{ color: simColor }}>{simScore}%</span>
                <span className="text-[9px]" style={{ color: C.sub }}>match</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold mb-1" style={{ color: C.text }}>Current Trade Similarity</p>
              {result.topMatch ? (
                <div>
                  <p className="text-sm" style={{ color: C.sub }}>Closest match: <span style={{ color: C.text }}>{result.topMatch.symbol} {result.topMatch.side}</span></p>
                  <div className="flex items-center gap-2 mt-1">
                    {result.topMatch.won
                      ? <span className="text-xs font-mono" style={{ color: C.green }}>Result: +{result.topMatch.pnlPercent}%</span>
                      : <span className="text-xs font-mono" style={{ color: C.red }}>Result: {result.topMatch.pnlPercent}%</span>}
                    <span className="text-xs" style={{ color: C.sub }}>· {result.topMatch.durationDays}d hold</span>
                  </div>
                </div>
              ) : <p className="text-sm" style={{ color: C.sub }}>{result.message ?? "No close matches found"}</p>}
            </div>
          </div>

          {/* Stats */}
          {result.stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Similar Trades",       value: String(result.stats.similarCount), color: C.text  },
                { label: "Historical Win Rate",  value: `${result.stats.winRate}%`,         color: result.stats.winRate >= 50 ? C.green : C.red },
                { label: "Avg Return",           value: `${result.stats.avgReturn >= 0 ? "+" : ""}${result.stats.avgReturn}%`, color: result.stats.avgReturn >= 0 ? C.green : C.red },
                { label: "Win / Loss",           value: `${result.stats.wins} / ${result.stats.losses}`, color: C.text },
              ].map(m => (
                <div key={m.label} className="rounded-2xl p-4 text-center" style={GLASS}>
                  <p className="text-xl font-bold font-mono mb-1" style={{ color: m.color }}>{m.value}</p>
                  <p className="text-[10px] font-mono uppercase" style={{ color: C.sub }}>{m.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Similar trades */}
          {result.matches?.length > 0 && (
            <div className="rounded-2xl p-5" style={CARD}>
              <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: C.sub }}>Similar Historical Trades</p>
              <div className="flex flex-col gap-2">
                {(result.matches as { score: number; symbol: string; side: string; won: boolean; pnlPercent: number; durationDays: number }[]).map((m, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={GLASS}>
                    <div className="text-xs font-mono w-8 text-center px-1 py-0.5 rounded" style={{ background: "hsl(var(--muted))", color: C.sub }}>{m.score}%</div>
                    <span className="text-sm font-medium flex-1" style={{ color: C.text }}>{m.symbol} {m.side}</span>
                    <span className="text-xs font-mono" style={{ color: m.won ? C.green : C.red }}>
                      {m.won ? "+" : ""}{m.pnlPercent}%
                    </span>
                    <span className="text-[10px]" style={{ color: C.sub }}>{m.durationDays}d</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FEATURE 2 — Future You Simulator
══════════════════════════════════════════════════════════════════════════ */
function SimulatorTab({ token }: { token: string }) {
  const [form, setForm] = useState({ symbol: "BTCUSDT", side: "long", entry: "", stopLoss: "", takeProfit: "", positionSize: "1" });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function run() {
    setLoading(true); setError(null);
    try {
      const r = await postOS<any>("future-sim", token, {
        symbol: form.symbol, side: form.side,
        entry: Number(form.entry), stopLoss: Number(form.stopLoss),
        takeProfit: Number(form.takeProfit), positionSize: Number(form.positionSize),
      });
      setResult(r);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  const SYMBOLS = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","EURUSD","GBPUSD","AAPL","TSLA"];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold" style={{ color: C.text }}>Future You Simulator</h2>
        <p className="text-xs" style={{ color: C.sub }}>Preview every possible outcome before you click Buy or Sell</p>
      </div>

      <div className="rounded-2xl p-5 flex flex-col gap-4" style={CARD}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { k: "symbol", label: "Symbol", type: "select", opts: SYMBOLS },
            { k: "side",   label: "Side",   type: "select", opts: ["long", "short"] },
            { k: "positionSize", label: "Position Size", type: "number", placeholder: "1" },
            { k: "entry",       label: "Entry Price",   type: "number", placeholder: "e.g. 95000" },
            { k: "stopLoss",    label: "Stop Loss",     type: "number", placeholder: "e.g. 93000" },
            { k: "takeProfit",  label: "Take Profit",   type: "number", placeholder: "e.g. 99000" },
          ].map(f => (
            <div key={f.k}>
              <label className="text-[10px] font-mono uppercase tracking-widest mb-1 block" style={{ color: C.sub }}>{f.label}</label>
              {f.type === "select" ? (
                <select value={(form as any)[f.k]} onChange={set(f.k)}
                  className="w-full rounded-xl px-3 py-2 text-sm" style={{ background: "hsl(var(--muted))", color: C.text, border: "1px solid hsl(var(--border))" }}>
                  {f.opts?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type="number" step="any" value={(form as any)[f.k]} onChange={set(f.k)} placeholder={f.placeholder}
                  className="w-full rounded-xl px-3 py-2 text-sm" style={{ background: "hsl(var(--muted))", color: C.text, border: "1px solid hsl(var(--border))" }} />
              )}
            </div>
          ))}
        </div>
        <button onClick={run} disabled={loading || !form.entry || !form.stopLoss || !form.takeProfit}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: C.blue, color: "#fff" }}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Simulate Outcomes
        </button>
      </div>

      {error && <div className="rounded-2xl p-4 text-sm" style={{ background: "hsl(0 60% 10%)", color: C.red }}>{error}</div>}

      {result && (
        <div className="flex flex-col gap-4">
          {/* Scenarios */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { key: "win",   icon: TrendingUp,   bgColor: "hsl(142 60% 8%)", bdColor: "hsl(142 60% 25%)", label: "Scenario A", tagColor: C.green },
              { key: "loss",  icon: TrendingDown,  bgColor: "hsl(0 60% 8%)",   bdColor: "hsl(0 60% 25%)",   label: "Scenario B", tagColor: C.red   },
              { key: "range", icon: Minus,          bgColor: "hsl(220 30% 10%)", bdColor: "hsl(220 30% 25%)", label: "Scenario C", tagColor: C.sub  },
            ].map(s => {
              const sc = result.scenarios[s.key];
              return (
                <div key={s.key} className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: s.bgColor, border: `1px solid ${s.bdColor}` }}>
                  <div className="flex items-center gap-2">
                    <s.icon className="h-4 w-4" style={{ color: s.tagColor }} />
                    <span className="text-xs font-mono uppercase" style={{ color: C.sub }}>{s.label}</span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: C.text }}>{sc.label}</p>
                  <div>
                    <p className="text-2xl font-bold font-mono" style={{ color: s.tagColor }}>
                      {sc.pnl >= 0 ? "+" : ""}${Math.abs(sc.pnl).toFixed(2)}
                    </p>
                    <p className="text-xs font-mono" style={{ color: C.sub }}>
                      {sc.pct >= 0 ? "+" : ""}{sc.pct.toFixed(2)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Risk:Reward",        value: `1 : ${result.rrRatio}`, color: result.rrRatio >= 2 ? C.green : result.rrRatio >= 1 ? C.amber : C.red },
              { label: "Expected Value",     value: `${result.expectedValue >= 0 ? "+" : ""}$${result.expectedValue}`, color: result.expectedValue >= 0 ? C.green : C.red },
              { label: "Historical Win Rate", value: `${result.historicalWinRate}%`, color: result.historicalWinRate >= 50 ? C.green : C.red },
              { label: "Emotional Risk",      value: `${result.emotionalRisk}%`, color: result.emotionalRisk >= 70 ? C.red : result.emotionalRisk >= 40 ? C.amber : C.green },
            ].map(m => (
              <div key={m.label} className="rounded-2xl p-4 text-center" style={GLASS}>
                <p className="text-xl font-bold font-mono mb-1" style={{ color: m.color }}>{m.value}</p>
                <p className="text-[10px] font-mono uppercase" style={{ color: C.sub }}>{m.label}</p>
              </div>
            ))}
          </div>
          {result.symbolTradeCount > 0 && (
            <p className="text-xs text-center" style={{ color: C.sub }}>
              Based on {result.symbolTradeCount} historical {form.symbol} {form.side} trades in your history
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FEATURE 3 — FOMO Detector
══════════════════════════════════════════════════════════════════════════ */
function FomoTab({ token }: { token: string }) {
  const [form, setForm] = useState({ symbol: "BTCUSDT", side: "long", priceMovePercent: "0", recentLossCount: "0", minutesSinceLastTrade: "60" });
  const [result, setResult]       = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);

  // BUG-011: Auto-populate from the most recent paper trade
  useEffect(() => {
    async function prefill() {
      try {
        const r = await fetch(`${API_BASE}/api/paper/trades?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const trades: any[] = await r.json();
        const last = trades.find((t: any) => t.exitTime);
        if (!last) return;
        const exitTimeSec = typeof last.exitTime === "number" ? last.exitTime : Number(last.exitTime);
        const nowSec      = Math.floor(Date.now() / 1000);
        const minsSince   = Math.max(0, Math.round((nowSec - exitTimeSec) / 60));
        setForm(f => ({
          ...f,
          symbol: last.symbol ?? f.symbol,
          side:   last.side   ?? f.side,
          minutesSinceLastTrade: String(Math.min(minsSince, 1440)),
        }));
        setAutoFilled(true);
      } catch { /* prefill is best-effort — ignore errors */ }
    }
    void prefill();
  }, [token]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function run() {
    setLoading(true); setError(null);
    try {
      const r = await postOS<any>("fomo-check", token, {
        symbol: form.symbol, side: form.side,
        priceMovePercent: Number(form.priceMovePercent),
        recentLossCount: Number(form.recentLossCount),
        minutesSinceLastTrade: Number(form.minutesSinceLastTrade),
      });
      setResult(r);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  const levelColor = result?.fomoLevel === "high" ? C.red : result?.fomoLevel === "medium" ? C.amber : result?.fomoLevel === "low" ? "#f97316" : C.green;
  const levelIcon  = result?.fomoLevel === "high" ? "🚨" : result?.fomoLevel === "medium" ? "⚠️" : result?.fomoLevel === "low" ? "🟡" : "✅";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold" style={{ color: C.text }}>FOMO Detector</h2>
        <p className="text-xs" style={{ color: C.sub }}>Detect emotional trading behavior before you enter a position</p>
      </div>

      {autoFilled && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl" style={{ background: `${C.cyan}12`, border: `1px solid ${C.cyan}30`, color: C.cyan }}>
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          Auto-filled from your last paper trade — adjust any field before running
        </div>
      )}

      <div className="rounded-2xl p-5 flex flex-col gap-4" style={CARD}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { k: "symbol", label: "Symbol", type: "select", opts: ["BTCUSDT","ETHUSDT","SOLUSDT","EURUSD","GBPUSD","AAPL","TSLA","XRPUSDT"] },
            { k: "side",   label: "Side",   type: "select", opts: ["long","short"] },
            { k: "priceMovePercent",      label: "Price Moved % (from low)", type: "number", placeholder: "e.g. 6.2" },
            { k: "recentLossCount",       label: "Recent Losses (today)",    type: "number", placeholder: "0–10" },
            { k: "minutesSinceLastTrade", label: "Mins Since Last Trade",    type: "number", placeholder: "60" },
          ].map(f => (
            <div key={f.k}>
              <label className="text-[10px] font-mono uppercase tracking-widest mb-1 block" style={{ color: C.sub }}>{f.label}</label>
              {f.type === "select" ? (
                <select value={(form as any)[f.k]} onChange={set(f.k)}
                  className="w-full rounded-xl px-3 py-2 text-sm" style={{ background: "hsl(var(--muted))", color: C.text, border: "1px solid hsl(var(--border))" }}>
                  {f.opts?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type="number" step="0.1" value={(form as any)[f.k]} onChange={set(f.k)} placeholder={f.placeholder}
                  className="w-full rounded-xl px-3 py-2 text-sm" style={{ background: "hsl(var(--muted))", color: C.text, border: "1px solid hsl(var(--border))" }} />
              )}
            </div>
          ))}
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: C.red, color: "#fff" }}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}
          Run FOMO Check
        </button>
      </div>

      {error && <div className="rounded-2xl p-4 text-sm" style={{ background: "hsl(0 60% 10%)", color: C.red }}>{error}</div>}

      {result && (
        <div className="flex flex-col gap-4">
          {/* Level banner */}
          <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: `${levelColor}15`, border: `1px solid ${levelColor}40` }}>
            <span className="text-4xl">{levelIcon}</span>
            <div className="flex-1">
              <p className="text-lg font-bold uppercase tracking-wide" style={{ color: levelColor }}>
                {result.fomoLevel === "none" ? "No FOMO Detected" : `${result.fomoLevel.toUpperCase()} Risk Detected`}
              </p>
              <p className="text-sm mt-1" style={{ color: C.text }}>{result.recommendation}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold font-mono" style={{ color: levelColor }}>{result.riskScore}</p>
              <p className="text-[10px]" style={{ color: C.sub }}>Risk Score</p>
            </div>
          </div>

          {/* Detected behaviors */}
          {result.behaviors?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(result.behaviors as string[]).map(b => (
                <span key={b} className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: `${C.red}20`, color: C.red, border: `1px solid ${C.red}40` }}>
                  ⚠ {b}
                </span>
              ))}
            </div>
          )}

          {/* Warnings */}
          {result.warnings?.length > 0 && (
            <div className="rounded-2xl p-5 flex flex-col gap-3" style={CARD}>
              <p className="text-xs font-mono uppercase tracking-widest" style={{ color: C.sub }}>Warnings</p>
              {(result.warnings as string[]).map((w, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl p-3" style={GLASS}>
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: C.amber }} />
                  <p className="text-xs" style={{ color: C.text }}>{w}</p>
                </div>
              ))}
            </div>
          )}

          {result.sessionWinRate !== null && (
            <p className="text-xs text-center" style={{ color: C.sub }}>
              Current session: <span style={{ color: C.text }}>{result.currentSession}</span>
              {" · "}Your win rate this session: <span style={{ color: result.sessionWinRate >= 50 ? C.green : C.red }}>{result.sessionWinRate?.toFixed(0)}%</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FEATURE 4 — Million Dollar Mistake Counter
══════════════════════════════════════════════════════════════════════════ */
function MistakesTab({ token }: { token: string }) {
  const { data, loading, error } = useOSFetch<any>("mistake-counter", token);
  const d = data;

  const COLORS = [C.red, C.amber, "#f97316", C.purple, C.blue, C.cyan];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold" style={{ color: C.text }}>Million Dollar Mistake Counter</h2>
        <p className="text-xs" style={{ color: C.sub }}>Total money lost due to recurring behavioral mistakes — for emotional awareness</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3"><Skel className="h-32" /><Skel className="h-48" /></div>
      ) : error ? (
        <div className="rounded-2xl p-5 text-sm" style={{ background: "hsl(0 60% 10%)", color: C.red }}>{error}</div>
      ) : d ? (
        <>
          {/* Total */}
          <div className="rounded-2xl p-6 text-center" style={{ ...CARD, background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(0 40% 8%) 100%)" }}>
            <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: C.sub }}>Total Lost to Mistakes</p>
            <p className="text-5xl font-bold font-mono" style={{ color: d.totalLost > 0 ? C.red : C.green }}>
              {d.totalLost > 0 ? `-$${d.totalLost.toFixed(2)}` : "$0.00"}
            </p>
            <p className="text-sm mt-2" style={{ color: C.sub }}>
              Across {d.tradesAnalyzed} journaled trades
            </p>
            {d.totalLost === 0 && (
              <p className="text-sm mt-3" style={{ color: C.green }}>
                ✓ No mistake-linked losses found. Keep journaling to track patterns.
              </p>
            )}
          </div>

          {/* Breakdown */}
          {d.breakdown?.length > 0 && (
            <div className="rounded-2xl p-5 flex flex-col gap-3" style={CARD}>
              <p className="text-xs font-mono uppercase tracking-widest" style={{ color: C.sub }}>Breakdown by Mistake</p>
              {(d.breakdown as { label: string; count: number; totalLoss: number; pct: number }[]).map((m, i) => (
                <div key={m.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-sm" style={{ color: C.text }}>{m.label}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "hsl(var(--muted))", color: C.sub }}>{m.count}x</span>
                    </div>
                    <span className="text-sm font-mono font-bold" style={{ color: C.red }}>
                      {m.totalLoss > 0 ? `-$${m.totalLoss.toFixed(2)}` : "$0"}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "hsl(var(--muted))" }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${m.pct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {d.tradesAnalyzed === 0 && (
            <div className="rounded-2xl p-5 text-center" style={CARD}>
              <BookOpen className="h-8 w-8 mx-auto mb-3" style={{ color: C.sub }} />
              <p className="text-sm font-medium" style={{ color: C.text }}>No journaled trades yet</p>
              <p className="text-xs mt-1" style={{ color: C.sub }}>Journal your backtest trades to unlock mistake tracking</p>
              <Link href="/backtests" className="inline-flex items-center gap-1 text-xs mt-3 px-4 py-2 rounded-xl" style={{ background: C.blue, color: "#fff" }}>
                Go to Backtests <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FEATURE 6 — Trader Rank System
══════════════════════════════════════════════════════════════════════════ */
function RankTab({ token }: { token: string }) {
  const { data, loading } = useOSFetch<any>("rank", token);
  const d = data;

  const ALL_RANKS = [
    { name: "Rookie Trader",        icon: "🌱", color: "#6b7280", description: "Building your foundation",    min: 0  },
    { name: "Disciplined Trader",   icon: "📋", color: "#3b82f6", description: "Consistent habits forming",   min: 16 },
    { name: "Professional Trader",  icon: "💼", color: "#C9A84C", description: "Executing with precision",    min: 31 },
    { name: "Market Sniper",        icon: "🎯", color: "#06b6d4", description: "High-probability only",       min: 51 },
    { name: "Institutional Mindset",icon: "🏛", color: "#f59e0b", description: "Trading like the pros",       min: 66 },
    { name: "Legendary Trader",     icon: "⭐", color: "#22c55e", description: "Elite performance tier",      min: 81 },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold" style={{ color: C.text }}>Trader Rank System</h2>
        <p className="text-xs" style={{ color: C.sub }}>Your rank is based on consistency, discipline, and risk control — not just profit</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3"><Skel className="h-32" /><Skel className="h-64" /></div>
      ) : d ? (
        <>
          {/* Current rank */}
          <div className="rounded-2xl p-6 flex items-center gap-5" style={{ ...CARD, border: `1px solid ${d.rank.color}40` }}>
            <div className="text-6xl">{d.rank.icon}</div>
            <div className="flex-1">
              <p className="text-2xl font-bold mb-1" style={{ color: d.rank.color }}>{d.rank.name}</p>
              <p className="text-sm" style={{ color: C.sub }}>{d.rank.description}</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="h-2 flex-1 rounded-full" style={{ background: "hsl(var(--muted))" }}>
                  <div className="h-2 rounded-full transition-all" style={{ width: `${d.score}%`, background: d.rank.color }} />
                </div>
                <span className="text-sm font-bold font-mono" style={{ color: d.rank.color }}>{d.score}/100</span>
              </div>
              {d.nextRank && (
                <p className="text-xs mt-1" style={{ color: C.sub }}>
                  {d.pctToNext}% progress to {d.nextRank.icon} {d.nextRank.name}
                </p>
              )}
            </div>
          </div>

          {/* Score breakdown */}
          <div className="rounded-2xl p-5" style={CARD}>
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: C.sub }}>Score Breakdown</p>
            <div className="flex flex-col gap-3">
              {[
                { label: "Win Rate",    key: "winRate",     max: 25, color: C.green  },
                { label: "Consistency", key: "consistency", max: 20, color: C.blue   },
                { label: "Risk Control",key: "risk",        max: 20, color: C.amber  },
                { label: "Discipline",  key: "discipline",  max: 20, color: C.purple },
                { label: "Adherence",   key: "adherence",   max: 15, color: C.cyan   },
              ].map(s => (
                <div key={s.key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: C.text }}>{s.label}</span>
                    <span className="font-mono" style={{ color: C.sub }}>{d.breakdown[s.key]}/{s.max}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "hsl(var(--muted))" }}>
                    <div className="h-2 rounded-full" style={{ width: `${(d.breakdown[s.key] / s.max) * 100}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rank progression */}
          <div className="rounded-2xl p-5" style={CARD}>
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: C.sub }}>Rank Progression</p>
            <div className="flex flex-col gap-2">
              {ALL_RANKS.map(r => {
                const isCurrentOrAbove = d.score >= r.min;
                const isCurrent = d.rank.name === r.name;
                return (
                  <div key={r.name} className="flex items-center gap-3 rounded-xl p-3 transition-all"
                    style={{ ...GLASS, opacity: isCurrentOrAbove ? 1 : 0.4, border: isCurrent ? `1px solid ${r.color}60` : "1px solid var(--glass-border)" }}>
                    <span className="text-xl">{r.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: isCurrent ? r.color : C.text }}>{r.name}</p>
                      <p className="text-[10px]" style={{ color: C.sub }}>{r.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono" style={{ color: C.sub }}>Score {r.min}+</span>
                      {isCurrentOrAbove && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: r.color }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Benchmark comparison — MISSING-008 */}
          {d.benchmarks && (
            <div className="rounded-2xl p-5" style={CARD}>
              <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: C.sub }}>Where You Stand</p>
              <p className="text-[10px] mb-4" style={{ color: C.sub }}>Your score vs. reference trader benchmarks</p>
              <div className="flex flex-col gap-3">
                {(d.benchmarks as { id: string; label: string; description: string; score: number; percentile: number; rank: { color: string; icon: string }; stats: { avgWinRate: number; avgDrawdown: number } }[]).map(b => {
                  const isAhead = d.score > b.score;
                  const isTied  = d.score === b.score;
                  const diff    = Math.abs(d.score - b.score);
                  return (
                    <div key={b.id} className="rounded-xl p-3" style={{ ...GLASS, border: `1px solid ${isAhead ? C.green : isTied ? C.amber : "hsl(var(--border))"}25` }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-medium" style={{ color: C.text }}>{b.rank.icon} {b.label}</p>
                          <p className="text-[10px]" style={{ color: C.sub }}>{b.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold font-mono" style={{ color: b.rank.color }}>{b.score}</p>
                          <p className="text-[10px]" style={{ color: C.sub }}>{b.percentile}th %ile</p>
                        </div>
                      </div>
                      <div className="relative h-2 rounded-full" style={{ background: "hsl(var(--muted))" }}>
                        <div className="h-2 rounded-full transition-all" style={{ width: `${b.score}%`, background: `${b.rank.color}60` }} />
                        <div className="absolute top-0 h-2 w-0.5 rounded-full" style={{ left: `${d.score}%`, background: isAhead ? C.green : C.red }} />
                      </div>
                      <p className="text-[10px] mt-1.5" style={{ color: isAhead ? C.green : isTied ? C.amber : C.sub }}>
                        {isAhead ? `▲ +${diff} pts ahead` : isTied ? "— Tied" : `▼ ${diff} pts behind`}
                        {" · "}WR {b.stats.avgWinRate}% · DD {b.stats.avgDrawdown}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Achievements */}
          <div className="rounded-2xl p-5" style={CARD}>
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: C.sub }}>Achievements</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(d.achievements as { id: string; icon: string; label: string; earned: boolean }[]).map((a) => (
                <div key={a.id} className="rounded-xl p-3 text-center" style={{ ...GLASS, opacity: a.earned ? 1 : 0.35 }}>
                  <p className="text-2xl mb-1">{a.icon}</p>
                  <p className="text-[10px] font-mono" style={{ color: a.earned ? C.amber : C.sub }}>{a.label}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FEATURE 5 — Personal Hedge Fund Report
══════════════════════════════════════════════════════════════════════════ */
function ReportTab({ token }: { token: string }) {
  const { data, loading, error, reload } = useOSFetch<any>("weekly-report", token);
  const d = data;

  const ratingColor = (r: string) =>
    r === "Outperforming" ? C.green :
    r === "Cautiously Optimistic" ? C.amber :
    r === "Neutral" ? C.blue : C.red;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: C.text }}>Personal Hedge Fund Report</h2>
          <p className="text-xs" style={{ color: C.sub }}>Institutional-grade weekly performance analysis</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={reload} className="p-2 rounded-xl hover:opacity-70" style={GLASS}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} style={{ color: C.sub }} />
          </button>
          <Link href="/trading-os/report">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:opacity-80"
              style={{ background: `${C.purple}20`, color: C.purple, border: `1px solid ${C.purple}40` }}>
              <ExternalLink className="h-3.5 w-3.5" />
              Full Page
            </button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3"><Skel className="h-20" /><Skel className="h-40" /><Skel className="h-32" /></div>
      ) : error || (d as any)?.error ? (
        <div className="rounded-2xl p-5 text-center" style={CARD}>
          <FileText className="h-8 w-8 mx-auto mb-3" style={{ color: C.sub }} />
          <p className="text-sm" style={{ color: C.sub }}>{(d as any)?.error ?? error}</p>
        </div>
      ) : d ? (
        <>
          {/* Header */}
          <div className="rounded-2xl p-5" style={{ ...CARD, background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(220 40% 8%) 100%)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: C.sub }}>WEEKLY PERFORMANCE REPORT</p>
                <p className="text-lg font-bold" style={{ color: C.text }}>{d.headline as string}</p>
              </div>
              {d.analystRating && (
                <span className="text-xs px-3 py-1 rounded-full font-medium shrink-0"
                  style={{ background: `${ratingColor(d.analystRating as string)}20`, color: ratingColor(d.analystRating as string), border: `1px solid ${ratingColor(d.analystRating as string)}40` }}>
                  {d.analystRating as string}
                </span>
              )}
            </div>
          </div>

          {/* Metrics grid */}
          {d.metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Win Rate",    value: `${d.metrics.winRate}%`,    color: d.metrics.winRate >= 50 ? C.green : C.red },
                { label: "Sharpe",      value: `${d.metrics.sharpe}`,       color: d.metrics.sharpe >= 1 ? C.green : C.amber },
                { label: "Drawdown",    value: `-${d.metrics.drawdown}%`,   color: d.metrics.drawdown < 15 ? C.green : C.red },
                { label: "Avg Return",  value: `${d.metrics.avgReturn >= 0 ? "+" : ""}${d.metrics.avgReturn}%`, color: d.metrics.avgReturn >= 0 ? C.green : C.red },
              ].map(m => (
                <div key={m.label} className="rounded-2xl p-4 text-center" style={GLASS}>
                  <p className="text-xl font-bold font-mono mb-1" style={{ color: m.color }}>{m.value}</p>
                  <p className="text-[10px] font-mono uppercase" style={{ color: C.sub }}>{m.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Performance summary */}
          <div className="rounded-2xl p-5" style={CARD}>
            <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: C.sub }}>Performance Summary</p>
            <p className="text-sm leading-relaxed" style={{ color: C.text }}>{d.performanceSummary as string}</p>
          </div>

          {/* Strengths + Improvements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={CARD}>
              <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: C.green }}>Strengths Found</p>
              <div className="flex flex-col gap-2">
                {((d.strengthsFound ?? []) as string[]).map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: C.green }} />
                    <p className="text-xs" style={{ color: C.text }}>{s}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl p-5" style={CARD}>
              <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: C.amber }}>Areas for Improvement</p>
              <div className="flex flex-col gap-2">
                {((d.areasForImprovement ?? []) as string[]).map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <ArrowUpRight className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: C.amber }} />
                    <p className="text-xs" style={{ color: C.text }}>{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Psychology + Focus */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl p-4" style={GLASS}>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: C.sub }}>Psychology Note</p>
              <p className="text-xs" style={{ color: C.text }}>{d.psychologyNote as string}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ ...GLASS, border: `1px solid ${C.cyan}40` }}>
              <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: C.cyan }}>Next Week Focus</p>
              <p className="text-xs font-medium" style={{ color: C.text }}>{d.nextWeekFocus as string}</p>
            </div>
          </div>

          <p className="text-[10px] text-center font-mono" style={{ color: C.sub }}>
            Generated {d.generatedAt ? new Date(d.generatedAt as string).toLocaleDateString() : "now"} · Powered by AI analysis of your full trading history
          </p>
        </>
      ) : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FEATURE 8 — Missed Opportunity Tracker
══════════════════════════════════════════════════════════════════════════ */
function OpportunitiesTab({ token }: { token: string }) {
  const { data, loading } = useOSFetch<any>("missed-opportunities", token);
  const d = data;

  const typeIcon = (type: string) =>
    type === "symbol_optimization" ? Target :
    type === "strategy_shift" ? Zap :
    type === "session_focus" ? Activity : Telescope;

  const typeColor = (type: string) =>
    type === "symbol_optimization" ? C.cyan :
    type === "strategy_shift" ? C.purple :
    type === "session_focus" ? C.amber : C.pink;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold" style={{ color: C.text }}>Missed Opportunity Tracker</h2>
        <p className="text-xs" style={{ color: C.sub }}>Most platforms analyze losses. Trade Lab analyzes what you left on the table.</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3"><Skel className="h-24" /><Skel className="h-24" /><Skel className="h-24" /></div>
      ) : d ? (
        <>
          {d.totalPotential > 0 && (
            <div className="rounded-2xl p-5 text-center" style={{ ...CARD, background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(270 40% 8%) 100%)" }}>
              <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: C.sub }}>Total Optimization Potential</p>
              <p className="text-4xl font-bold font-mono" style={{ color: C.purple }}>+{d.totalPotential}%</p>
              <p className="text-xs mt-2" style={{ color: C.sub }}>{d.analysis as string}</p>
            </div>
          )}

          {(d.opportunities as { type: string; title: string; description: string; potentialReturn: number | null; action: string }[])?.length > 0 ? (
            <div className="flex flex-col gap-4">
              {(d.opportunities as { type: string; title: string; description: string; potentialReturn: number | null; action: string }[]).map((opp, i) => {
                const Icon = typeIcon(opp.type);
                const color = typeColor(opp.type);
                return (
                  <div key={i} className="rounded-2xl p-5" style={{ ...CARD, border: `1px solid ${color}30` }}>
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl p-2 shrink-0" style={{ background: `${color}15` }}>
                        <Icon className="h-4 w-4" style={{ color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-sm font-bold" style={{ color: C.text }}>{opp.title}</p>
                          {opp.potentialReturn != null && (
                            <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: `${color}15`, color }}>
                              +{Math.abs(opp.potentialReturn).toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <p className="text-xs mb-3" style={{ color: C.sub }}>{opp.description}</p>
                        <div className="rounded-xl p-2 flex items-start gap-2" style={GLASS}>
                          <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" style={{ color }} />
                          <p className="text-[10px]" style={{ color: C.text }}>{opp.action}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl p-8 text-center" style={CARD}>
              <Telescope className="h-8 w-8 mx-auto mb-3" style={{ color: C.sub }} />
              <p className="text-sm font-medium" style={{ color: C.text }}>Not enough data yet</p>
              <p className="text-xs mt-1" style={{ color: C.sub }}>Run more backtests to uncover optimization opportunities</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   FEATURE 7 — AI Trading Twin
══════════════════════════════════════════════════════════════════════════ */
function TwinTab({ token }: { token: string }) {
  const [symbol, setSymbol]   = useState("BTCUSDT");
  const [side, setSide]       = useState("long");
  const [context, setContext] = useState("");
  const [result, setResult]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const SYMBOLS = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","EURUSD","GBPUSD","AAPL","TSLA","SPY"];

  async function consult() {
    setLoading(true); setError(null);
    try {
      const r = await postOS<any>("ai-twin", token, { symbol, side, context });
      setResult(r);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  const decisionColor =
    result?.decision === "Enter Now" ? C.green :
    result?.decision === "Wait" ? C.amber :
    result?.decision === "Reduce Size" ? "#f97316" : C.red;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold" style={{ color: C.text }}>AI Trading Twin</h2>
        <p className="text-xs" style={{ color: C.sub }}>A digital clone trained on your trading history that gives pre-trade opinions</p>
      </div>

      <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ ...CARD, border: `1px solid ${C.purple}30` }}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest mb-1 block" style={{ color: C.sub }}>Symbol</label>
            <select value={symbol} onChange={e => setSymbol(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm" style={{ background: "hsl(var(--muted))", color: C.text, border: "1px solid hsl(var(--border))" }}>
              {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest mb-1 block" style={{ color: C.sub }}>Side</label>
            <select value={side} onChange={e => setSide(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm" style={{ background: "hsl(var(--muted))", color: C.text, border: "1px solid hsl(var(--border))" }}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest mb-1 block" style={{ color: C.sub }}>Setup Context (optional)</label>
          <textarea value={context} onChange={e => setContext(e.target.value)} rows={2}
            placeholder="Describe your setup: BTC bounced off 200 SMA, RSI at 45, London open..."
            className="w-full rounded-xl px-3 py-2 text-sm resize-none" style={{ background: "hsl(var(--muted))", color: C.text, border: "1px solid hsl(var(--border))" }} />
        </div>
        <button onClick={consult} disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: `linear-gradient(90deg, ${C.purple}, ${C.pink})`, color: "#fff" }}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          Consult My AI Twin
        </button>
      </div>

      {error && <div className="rounded-2xl p-4 text-sm" style={{ background: "hsl(0 60% 10%)", color: C.red }}>{error}</div>}

      {result && (
        <div className="flex flex-col gap-4">
          {/* Decision */}
          <div className="rounded-2xl p-6 flex items-center gap-5" style={{ ...CARD, border: `1px solid ${decisionColor}40` }}>
            <div className="rounded-xl p-4" style={{ background: `${C.purple}15` }}>
              <Bot className="h-8 w-8" style={{ color: C.purple }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-mono uppercase" style={{ color: C.sub }}>AI Twin Decision</p>
                {result.twinPersonality && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono" style={{ background: `${C.purple}20`, color: C.purple }}>
                    {result.twinPersonality as string}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold" style={{ color: decisionColor }}>{result.decision as string}</p>
              {result.confidence != null && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-1.5 flex-1 rounded-full" style={{ background: "hsl(var(--muted))" }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${result.confidence as number}%`, background: decisionColor }} />
                  </div>
                  <span className="text-xs font-mono" style={{ color: C.sub }}>{result.confidence as number}% confidence</span>
                </div>
              )}
            </div>
          </div>

          {/* Reasoning */}
          <div className="rounded-2xl p-5" style={CARD}>
            <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: C.sub }}>Twin's Reasoning</p>
            <p className="text-sm leading-relaxed" style={{ color: C.text }}>{result.reasoning as string}</p>
          </div>

          {result.alternative && (
            <div className="rounded-2xl p-4 flex items-start gap-2" style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}30` }}>
              <Zap className="h-4 w-4 mt-0.5 shrink-0" style={{ color: C.amber }} />
              <div>
                <p className="text-[10px] font-mono uppercase mb-1" style={{ color: C.amber }}>Alternative Action</p>
                <p className="text-xs" style={{ color: C.text }}>{result.alternative as string}</p>
              </div>
            </div>
          )}

          {result.symbolTradeCount > 0 && (
            <p className="text-xs text-center" style={{ color: C.sub }}>
              Twin trained on {result.symbolTradeCount} {symbol} {side} trades
              {" · "}Historical win rate on this pair: <span style={{ color: result.symbolWinRate >= 50 ? C.green : C.red }}>{result.symbolWinRate}%</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TRADE MIRROR™ — Unified pre-trade decision engine
══════════════════════════════════════════════════════════════════════════ */

const TRADE_REASONS = [
  "Breakout", "Reversal", "Trend Continuation", "Liquidity Sweep",
  "Pullback", "Scalping", "Swing Trade", "Custom",
] as const;

const COMMON_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "EURUSD", "GBPUSD", "AAPL", "TSLA", "SPY", "NVDA", "MSFT",
];

/* glass card tokens */
const MG: React.CSSProperties = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "18px",
};

/* confidence arc */
function ConfidenceArc({ score }: { score: number }) {
  const SIZE = 120;
  const R    = 46;
  const CIRC = 2 * Math.PI * R;
  const GAP  = CIRC * 0.25;
  const TRACK = CIRC - GAP;
  const fill  = (score / 100) * TRACK;
  const color = score >= 70 ? "#22c55e" : score >= 50 ? "#a3a3a3" : score >= 35 ? "#f97316" : "#ef4444";
  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} style={{ transform: "rotate(135deg)" }}>
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8}
          strokeDasharray={`${TRACK} ${GAP}`} strokeLinecap="round" />
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${fill} ${CIRC - fill}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease, stroke 0.5s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color }}>{score}</span>
        <span style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>confidence</span>
      </div>
    </div>
  );
}

/* small section score badge */
function SectionScore({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", color }}>{score}</div>
      <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginTop: 2 }}>{label}</div>
    </div>
  );
}

interface MirrorResult {
  twin: {
    score: number; decision: string; confidence: number; reasoning: string;
    alternative: string | null; twinPersonality: string; verdict: string;
    avgWinRate: number; traderStyle: string; symbolWinRate: number;
    symbolTradeCount: number; totalTrades: number;
    tradingDNA?: { bestSetup: string; worstSetup: string; biggestWeakness: string; biggestStrength: string };
  };
  ghost: {
    score: number; similarCount: number; winRate: number; avgReturn: number;
    topWin:  { symbol: string; pnlPercent: number; durationDays: number } | null;
    topLoss: { symbol: string; pnlPercent: number; durationDays: number } | null;
    isArchetypeFallback: boolean;
  };
  future: {
    hasFutureData: boolean; score: number; rrRatio?: number; expectedValue?: number;
    historicalWinRate?: number; symbolTradeCount?: number;
    best?: { pnl: number; pct: number }; worst?: { pnl: number; pct: number };
    expected?: { pnl: number; pct: number };
  };
  report: {
    strengths?: string[]; weaknesses?: string[]; riskAnalysis?: string;
    emotionalAnalysis?: string; historicalComparison?: string; futureProjection?: string;
    overallConfidence: number; finalVerdict: "strong" | "average" | "high_risk" | "avoid";
    verdictLabel: string; twinScore: number; ghostScore: number; futureScore: number;
  };
}

type MirrorPhase = "input" | "loading" | "report";

const VERDICT_CFG = {
  strong:    { emoji: "🟢", color: "#22c55e", bg: "rgba(34,197,94,0.07)",   border: "rgba(34,197,94,0.22)"   },
  average:   { emoji: "🟡", color: "#a3a3a3", bg: "rgba(163,163,163,0.06)", border: "rgba(163,163,163,0.18)" },
  high_risk: { emoji: "🟠", color: "#f97316", bg: "rgba(249,115,22,0.07)",  border: "rgba(249,115,22,0.22)"  },
  avoid:     { emoji: "🔴", color: "#ef4444", bg: "rgba(239,68,68,0.07)",   border: "rgba(239,68,68,0.22)"   },
};

function TradeMirrorTab({ token }: { token: string }) {
  const [phase,        setPhase]        = useState<MirrorPhase>("input");
  const [loadStep,     setLoadStep]     = useState(0);
  const [result,       setResult]       = useState<MirrorResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [symbol,       setSymbol]       = useState("BTCUSDT");
  const [customSymbol, setCustomSymbol] = useState("");
  const [side,         setSide]         = useState<"long" | "short">("long");
  const [tradeReason,  setTradeReason]  = useState("Breakout");
  const [customCtx,    setCustomCtx]    = useState("");
  const [showAdv,      setShowAdv]      = useState(false);
  const [entry,        setEntry]        = useState("");
  const [stopLoss,     setStopLoss]     = useState("");
  const [takeProfit,   setTakeProfit]   = useState("");
  const [posSize,      setPosSize]      = useState("1");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const LOAD_STEPS = [
    "Reading your trading DNA...",
    "Scanning similar historical setups...",
    "Projecting possible futures...",
    "Compiling Trade Mirror report...",
  ];

  async function analyze() {
    setPhase("loading");
    setLoadStep(0);
    setError(null);
    timerRef.current = setInterval(() => {
      setLoadStep(s => (s < LOAD_STEPS.length - 1 ? s + 1 : s));
    }, 1400);
    try {
      const finalSymbol = symbol === "__custom__" ? customSymbol.trim() || "BTCUSDT" : symbol;
      const r = await postOS<MirrorResult>("trade-mirror", token, {
        symbol: finalSymbol, side, tradeReason, customContext: customCtx,
        entry:        entry     ? Number(entry)    : 0,
        stopLoss:     stopLoss  ? Number(stopLoss) : 0,
        takeProfit:   takeProfit? Number(takeProfit):0,
        positionSize: Number(posSize),
        durationDays: 1,
      });
      if (timerRef.current) clearInterval(timerRef.current);
      setResult(r);
      setPhase("report");
    } catch (e: unknown) {
      if (timerRef.current) clearInterval(timerRef.current);
      setError(e instanceof Error ? e.message : "Analysis failed. Please try again.");
      setPhase("input");
    }
  }

  function reset() { setPhase("input"); setResult(null); setError(null); }

  /* ── INPUT phase ──────────────────────────────────────────────────────── */
  if (phase === "input") return (
    <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "32px 0 8px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)", marginBottom: 14 }}>
          <ScanLine style={{ width: 24, height: 24, color: "rgba(255,255,255,0.9)" }} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.3px" }}>
          Trade Mirror™
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginTop: 6, lineHeight: 1.5 }}>
          Your complete pre-trade intelligence report.<br />One analysis. Three perspectives.
        </p>
      </div>

      {error && (
        <div style={{ ...MG, padding: "12px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12 }}>
          <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Input card */}
      <div style={{ ...MG, padding: "24px" }}>

        {/* Symbol + Side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 18 }}>
          <div>
            <label style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 6 }}>Symbol</label>
            {symbol === "__custom__" ? (
              <input value={customSymbol} onChange={e => setCustomSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. AAPL, XAUUSD..." autoFocus
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "9px 12px", fontSize: 14, color: "#fff", outline: "none", boxSizing: "border-box" }} />
            ) : (
              <select value={symbol} onChange={e => setSymbol(e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 12px", fontSize: 14, color: "#fff", appearance: "none", cursor: "pointer" }}>
                {COMMON_SYMBOLS.map(s => <option key={s} value={s} style={{ background: "#1a1a1a" }}>{s}</option>)}
                <option value="__custom__" style={{ background: "#1a1a1a" }}>Other (type symbol)…</option>
              </select>
            )}
          </div>
          <div>
            <label style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 6 }}>Direction</label>
            <div style={{ display: "flex", gap: 6 }}>
              {(["long","short"] as const).map(s => (
                <button key={s} onClick={() => setSide(s)}
                  style={{ padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", border: "1px solid",
                    background: side === s ? (s === "long" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)") : "rgba(255,255,255,0.04)",
                    borderColor: side === s ? (s === "long" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)") : "rgba(255,255,255,0.08)",
                    color: side === s ? (s === "long" ? "#22c55e" : "#ef4444") : "rgba(255,255,255,0.4)" }}>
                  {s === "long" ? "Long ↑" : "Short ↓"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Trade Reason */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 8 }}>
            Why are you taking this trade?
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {TRADE_REASONS.map(r => (
              <button key={r} onClick={() => setTradeReason(r)}
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.12s", border: "1px solid",
                  background: tradeReason === r ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                  borderColor: tradeReason === r ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.07)",
                  color: tradeReason === r ? "#fff" : "rgba(255,255,255,0.42)" }}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Context textarea */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 6 }}>
            Describe your setup <span style={{ opacity: 0.5 }}>(optional)</span>
          </label>
          <textarea value={customCtx} onChange={e => setCustomCtx(e.target.value)} rows={2}
            placeholder="e.g. BTC broke above 200 SMA with RSI at 52, London session open, previous resistance now support..."
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#fff", resize: "none", outline: "none", lineHeight: 1.5, boxSizing: "border-box" }} />
        </div>

        {/* Advanced (Entry / SL / TP) */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setShowAdv(a => !a)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <Plus style={{ width: 12, height: 12, color: "rgba(255,255,255,0.35)", transition: "transform 0.2s", transform: showAdv ? "rotate(45deg)" : "rotate(0)" }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>
              {showAdv ? "Hide" : "Add"} entry / stop-loss / take-profit
            </span>
          </button>

          {showAdv && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 12 }}>
              {[
                { label: "Entry Price", value: entry,     set: setEntry     },
                { label: "Stop Loss",   value: stopLoss,  set: setStopLoss  },
                { label: "Take Profit", value: takeProfit,set: setTakeProfit },
                { label: "Position Size",value: posSize,  set: setPosSize   },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 5 }}>{f.label}</label>
                  <input type="number" step="any" value={f.value} onChange={e => f.set(e.target.value)}
                    style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 9, padding: "8px 10px", fontSize: 13, color: "#fff", outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <button onClick={analyze}
          style={{ width: "100%", padding: "13px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.15s, border-color 0.15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.25)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"; }}>
          <ScanLine style={{ width: 16, height: 16 }} />
          Generate Trade Mirror Report
        </button>
      </div>

      {/* What's inside */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { num: "01", label: "AI Twin",           desc: "Your behavioral DNA vs this trade" },
          { num: "02", label: "Ghost Analysis",     desc: "Similar setups across history"      },
          { num: "03", label: "Future Projection",  desc: "Best / Expected / Worst outcomes"   },
        ].map(s => (
          <div key={s.num} style={{ ...MG, padding: "16px 14px" }}>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.2)", marginBottom: 6 }}>{s.num}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── LOADING phase ────────────────────────────────────────────────────── */
  if (phase === "loading") return (
    <div style={{ minHeight: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)" }}>
        <ScanLine style={{ width: 28, height: 28, color: "rgba(255,255,255,0.7)" }} />
      </div>

      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>Analyzing your trade…</p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", margin: 0, minHeight: 20 }}>{LOAD_STEPS[loadStep]}</p>
      </div>

      {/* Step dots */}
      <div style={{ display: "flex", gap: 8 }}>
        {LOAD_STEPS.map((_, i) => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", transition: "background 0.3s",
            background: i <= loadStep ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.12)" }} />
        ))}
      </div>
    </div>
  );

  /* ── REPORT phase ─────────────────────────────────────────────────────── */
  if (phase === "report" && result) {
    const { twin, ghost, future, report } = result;
    const vc = VERDICT_CFG[report.finalVerdict] ?? VERDICT_CFG.average;
    const twinColor  = twin.score  >= 65 ? "#22c55e" : twin.score  >= 45 ? "#a3a3a3" : "#f97316";
    const ghostColor = ghost.score >= 65 ? "#22c55e" : ghost.score >= 45 ? "#a3a3a3" : "#f97316";
    const futColor   = future.score >= 65 ? "#22c55e" : future.score >= 45 ? "#a3a3a3" : "#f97316";

    return (
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Header: 3 section scores */}
        <div style={{ ...MG, padding: "18px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ScanLine style={{ width: 15, height: 15, color: "rgba(255,255,255,0.5)" }} />
              <span style={{ fontSize: 11, fontFamily: "monospace", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Trade Mirror Report</span>
            </div>
            <button onClick={reset} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
              <RotateCcw style={{ width: 10, height: 10 }} /> New Analysis
            </button>
          </div>
          <div style={{ display: "flex", gap: 0 }}>
            {[
              { label: "AI Twin",          score: twin.score,   color: twinColor  },
              { label: "Ghost Analysis",   score: ghost.score,  color: ghostColor },
              { label: "Future Score",     score: future.score, color: futColor   },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <div style={{ width: 1, background: "rgba(255,255,255,0.07)", margin: "0 20px", flexShrink: 0 }} />}
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "monospace", color: s.color, lineHeight: 1 }}>{s.score}</div>
                  <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginTop: 5 }}>{s.label}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── SECTION 01: AI TWIN ─────────────────────────────────────────── */}
        <div style={{ ...MG, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>SECTION 01</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", letterSpacing: "-0.2px" }}>AI Twin Analysis</span>
          </div>

          {/* Decision banner */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <ScoreGauge score={twin.score} color={twinColor} size={72} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
                Twin Decision {twin.twinPersonality ? `· ${String(twin.twinPersonality)}` : ""}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: twinColor, marginBottom: 6 }}>
                {String(twin.decision || "Analyzing…")}
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.55 }}>
                {String(twin.reasoning || "")}
              </p>
              {twin.alternative && (
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 6, marginBottom: 0, fontStyle: "italic" }}>
                  Alternative: {String(twin.alternative)}
                </p>
              )}
            </div>
          </div>

          {/* Trading DNA */}
          {twin.tradingDNA && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Best Setup",        value: twin.tradingDNA.bestSetup,      icon: "↑" },
                { label: "Worst Setup",       value: twin.tradingDNA.worstSetup,     icon: "↓" },
                { label: "Biggest Strength",  value: twin.tradingDNA.biggestStrength,icon: "◆" },
                { label: "Biggest Weakness",  value: twin.tradingDNA.biggestWeakness,icon: "◇" },
              ].map(d => (
                <div key={d.label} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 4 }}>{d.icon} {d.label}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>{String(d.value || "—")}</div>
                </div>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: "flex", gap: 20, paddingTop: 4 }}>
            {[
              { label: "Overall Win Rate", value: `${twin.avgWinRate}%` },
              { label: "Style",            value: twin.traderStyle || "—" },
              { label: `${twin.symbolTradeCount} trades on symbol`, value: `${twin.symbolWinRate}% WR` },
            ].map(s => (
              <div key={s.label} style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "rgba(255,255,255,0.85)" }}>{s.value}</div>
                <div style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Verdict */}
          {twin.verdict && (
            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "12px 14px", borderLeft: `2px solid ${twinColor}` }}>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>
                "{String(twin.verdict)}"
              </p>
            </div>
          )}
        </div>

        {/* ── SECTION 02: GHOST ANALYSIS ──────────────────────────────────── */}
        <div style={{ ...MG, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>SECTION 02</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", letterSpacing: "-0.2px" }}>Ghost Analysis</span>
            {ghost.isArchetypeFallback && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 6, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>platform data</span>}
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { label: "Similar Setups Found", value: String(ghost.similarCount) },
              { label: "Historical Win Rate",   value: `${ghost.winRate}%`,        color: ghost.winRate >= 55 ? "#22c55e" : ghost.winRate >= 45 ? "#a3a3a3" : "#ef4444" },
              { label: "Avg Return",            value: `${ghost.avgReturn >= 0 ? "+" : ""}${ghost.avgReturn}%`, color: ghost.avgReturn >= 0 ? "#22c55e" : "#ef4444" },
            ].map(s => (
              <div key={s.label} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: (s as {color?: string}).color ?? "rgba(255,255,255,0.85)" }}>{s.value}</div>
                <div style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Top Win + Top Loss */}
          {(ghost.topWin || ghost.topLoss) && (
            <div style={{ display: "grid", gridTemplateColumns: ghost.topWin && ghost.topLoss ? "1fr 1fr" : "1fr", gap: 10 }}>
              {ghost.topWin && (
                <div style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(34,197,94,0.6)", marginBottom: 4 }}>↑ Top Win Example</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#22c55e", fontFamily: "monospace" }}>+{ghost.topWin.pnlPercent}%</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{ghost.topWin.symbol} · {ghost.topWin.durationDays}d hold</div>
                </div>
              )}
              {ghost.topLoss && (
                <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(239,68,68,0.6)", marginBottom: 4 }}>↓ Top Loss Example</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#ef4444", fontFamily: "monospace" }}>{ghost.topLoss.pnlPercent}%</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{ghost.topLoss.symbol} · {ghost.topLoss.durationDays}d hold</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SECTION 03: FUTURE PROJECTION ───────────────────────────────── */}
        <div style={{ ...MG, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>SECTION 03</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", letterSpacing: "-0.2px" }}>Future Projection</span>
          </div>

          {future.hasFutureData ? (
            <>
              {/* 3 scenarios */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { label: "Best Future",     pnl: future.best?.pnl,     pct: future.best?.pct,     color: "#22c55e", dim: "rgba(34,197,94,0.04)",   bd: "rgba(34,197,94,0.15)"   },
                  { label: "Expected",        pnl: future.expected?.pnl, pct: future.expected?.pct, color: "#a3a3a3", dim: "rgba(163,163,163,0.04)", bd: "rgba(163,163,163,0.13)" },
                  { label: "Worst Future",    pnl: future.worst?.pnl,    pct: future.worst?.pct,    color: "#ef4444", dim: "rgba(239,68,68,0.04)",    bd: "rgba(239,68,68,0.15)"   },
                ].map(sc => (
                  <div key={sc.label} style={{ background: sc.dim, border: `1px solid ${sc.bd}`, borderRadius: 10, padding: "14px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: sc.color, opacity: 0.7, marginBottom: 6 }}>{sc.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: sc.color }}>
                      {sc.pct != null ? `${sc.pct >= 0 ? "+" : ""}${sc.pct}%` : "—"}
                    </div>
                    {sc.pnl != null && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 3, fontFamily: "monospace" }}>
                        ${Math.abs(sc.pnl).toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* RR + EV metrics */}
              <div style={{ display: "flex", gap: 16 }}>
                {[
                  { label: "Risk : Reward", value: `1 : ${future.rrRatio}`, color: (future.rrRatio ?? 0) >= 2 ? "#22c55e" : (future.rrRatio ?? 0) >= 1 ? "#a3a3a3" : "#ef4444" },
                  { label: "Expected Value", value: `${(future.expectedValue ?? 0) >= 0 ? "+" : ""}$${future.expectedValue?.toFixed(2)}`, color: (future.expectedValue ?? 0) >= 0 ? "#22c55e" : "#ef4444" },
                  { label: "Symbol Win Rate", value: `${future.historicalWinRate}%`, color: (future.historicalWinRate ?? 0) >= 50 ? "#22c55e" : "#a3a3a3" },
                ].map(m => (
                  <div key={m.label} style={{ flex: 1, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginTop: 4 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.35)" }}>
              <p style={{ fontSize: 13, margin: "0 0 6px" }}>No entry / SL / TP provided.</p>
              <p style={{ fontSize: 11, margin: 0 }}>Add price levels in the input form for a full future projection.</p>
            </div>
          )}
        </div>

        {/* ── FINAL REPORT ────────────────────────────────────────────────── */}
        <div style={{ ...MG, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>FINAL REPORT</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", letterSpacing: "-0.2px" }}>Trade Mirror Summary</span>
          </div>

          {/* Strengths + Weaknesses */}
          {((report.strengths?.length ?? 0) > 0 || (report.weaknesses?.length ?? 0) > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {report.strengths && report.strengths.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(34,197,94,0.6)", marginBottom: 8 }}>◆ Strengths</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {report.strengths.map((s, i) => (
                      <div key={i} style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.4, paddingLeft: 10, borderLeft: "1px solid rgba(34,197,94,0.25)" }}>
                        {String(s)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {report.weaknesses && report.weaknesses.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(239,68,68,0.6)", marginBottom: 8 }}>◇ Weaknesses</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {report.weaknesses.map((w, i) => (
                      <div key={i} style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.4, paddingLeft: 10, borderLeft: "1px solid rgba(239,68,68,0.25)" }}>
                        {String(w)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Analysis blocks */}
          {[
            { label: "Risk Analysis",       text: report.riskAnalysis       },
            { label: "Emotional Analysis",  text: report.emotionalAnalysis  },
            { label: "Historical Comparison",text:report.historicalComparison},
            { label: "Future Projection",   text: report.futureProjection   },
          ].filter(b => b.text).map(b => (
            <div key={b.label}>
              <div style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 5 }}>{b.label}</div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>{String(b.text)}</p>
            </div>
          ))}

          {/* Confidence meter + Verdict */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20, display: "flex", alignItems: "center", gap: 24 }}>
            <ConfidenceArc score={report.overallConfidence} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 10 }}>Final Verdict</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 12, border: `1px solid ${vc.border}`, background: vc.bg }}>
                <span style={{ fontSize: 18 }}>{vc.emoji}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: vc.color }}>{report.verdictLabel}</span>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 14 }}>
                {[
                  { l: "Twin",   v: report.twinScore  },
                  { l: "Ghost",  v: report.ghostScore  },
                  { l: "Future", v: report.futureScore },
                ].map(s => (
                  <div key={s.l} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "rgba(255,255,255,0.7)" }}>{s.v}</div>
                    <div style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 10, textAlign: "center", color: "rgba(255,255,255,0.18)", padding: "4px 0 8px", lineHeight: 1.6 }}>
          Trade Mirror™ analysis is for educational purposes only.<br />Not financial advice. Trade at your own risk.
        </p>
      </div>
    );
  }

  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   Main Page
══════════════════════════════════════════════════════════════════════════ */
export default function TradingOsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { token, user } = useAuth();

  if (!token) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <Brain className="h-12 w-12 mx-auto mb-4" style={{ color: C.purple }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: C.text }}>AI Trader Operating System</h2>
            <p className="text-sm mb-5" style={{ color: C.sub }}>Sign in to access your personal AI trading mentor</p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm"
              style={{ background: C.purple, color: "#fff" }}
            >
              Sign In <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    );
  }

  const activeTabDef = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="min-h-screen" style={{ background: "hsl(var(--background))" }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="rounded-xl p-2" style={{ background: `${C.purple}20` }}>
            <Brain className="h-5 w-5" style={{ color: C.purple }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: C.text }}>AI Trader Operating System</h1>
            <p className="text-xs" style={{ color: C.sub }}>Your personal trading mentor · learns from every trade</p>
          </div>
        </div>
      </div>

      {/* Tab bar — scrollable */}
      <div className="px-4 pb-3 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {TABS.map(tab => {
            const active = tab.id === activeTab;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all"
                style={{
                  background: active ? `${tab.color}20` : "transparent",
                  color: active ? tab.color : C.sub,
                  border: active ? `1px solid ${tab.color}40` : "1px solid transparent",
                }}>
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-24">
        {activeTab === "overview"      && <OverviewTab      token={token} />}
        {activeTab === "coach"         && <CoachTab         token={token} />}
        {activeTab === "mirror"        && <TradeMirrorTab   token={token} />}
        {activeTab === "fomo"          && <FomoTab          token={token} />}
        {activeTab === "mistakes"      && <MistakesTab      token={token} />}
        {activeTab === "rank"          && <RankTab          token={token} />}
        {activeTab === "report"        && <ReportTab        token={token} />}
        {activeTab === "opportunities" && <OpportunitiesTab token={token} />}

        {/* Global AI disclaimer */}
        <p className="text-center text-[10px] mt-8 px-4 pb-4"
          style={{ color: "hsl(var(--muted-foreground))", opacity: 0.45 }}>
          AI Trader OS insights are for educational purposes only and do not constitute financial or investment advice.
          Past performance is not indicative of future results. Trade at your own risk.
        </p>
      </div>
    </div>
  );
}
