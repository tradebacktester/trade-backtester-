import React, { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { AuthModal } from "@/components/auth-modal";
import {
  Brain, Zap, Target, Shield, TrendingUp, TrendingDown, AlertTriangle,
  Bot, BarChart2, Activity, Trophy, Heart, BookOpen, Sparkles, ChevronRight,
  RefreshCw, Loader2, CheckCircle2, XCircle, Clock, Star, Award, Flame,
  DollarSign, Eye, Ghost, Swords, FileText, Telescope, ArrowUpRight,
  ArrowDownRight, Minus, AlertCircle, Play, Calculator, Users2, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

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

function Skel({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg animate-pulse ${className}`} style={{ background: "hsl(var(--muted))" }} />;
}

/* ── API helper ─────────────────────────────────────────────────────────── */
function useOSFetch<T>(path: string, token: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API_BASE}/api/trading-os/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, token, ...deps]);

  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: load };
}

async function postOS<T>(path: string, token: string, body: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}/api/trading-os/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: "Request failed" })) as { error?: string };
    throw new Error(err.error ?? "Request failed");
  }
  return r.json() as Promise<T>;
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
  { id: "overview",      label: "Overview",       icon: Brain,       color: C.purple },
  { id: "coach",         label: "AI Coach",        icon: Sparkles,    color: C.amber  },
  { id: "ghost",         label: "Trade Ghost",     icon: Ghost,       color: C.cyan   },
  { id: "simulator",     label: "Future You",      icon: Calculator,  color: C.blue   },
  { id: "fomo",          label: "FOMO Detector",   icon: AlertCircle, color: C.red    },
  { id: "mistakes",      label: "Mistakes $",      icon: DollarSign,  color: "#f97316" },
  { id: "rank",          label: "Trader Rank",     icon: Trophy,      color: C.amber  },
  { id: "report",        label: "Fund Report",     icon: FileText,    color: C.green  },
  { id: "opportunities", label: "Missed Setups",   icon: Telescope,   color: C.pink   },
  { id: "twin",          label: "AI Twin",         icon: Bot,         color: C.purple },
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
                  <ScoreGauge score={hs.score} color={hs.statusColor} size={90} />
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
                {(rk.achievements as any[]).filter(a => a.earned).map((a: any) => (
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
                    Last {(data.recentForm as any).total} trades: <span style={{ color: C.green }}>{(data.recentForm as any).wins}W</span> / <span style={{ color: C.red }}>{(data.recentForm as any).losses}L</span>
                    {" · "} Rank Score: <span style={{ color: C.text }}>{data.rankScore as number}/100</span>
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
                    ↑ {(data.bestSession as any).label} {(data.bestSession as any).winRate}%
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
              <ScoreGauge score={simScore} color={simColor} size={100} />
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
                {(result.matches as any[]).map((m: any, i: number) => (
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
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]    = useState<string | null>(null);

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
              {(d.breakdown as any[]).map((m: any, i: number) => (
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
    { name: "Professional Trader",  icon: "💼", color: "#8b5cf6", description: "Executing with precision",    min: 31 },
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

          {/* Achievements */}
          <div className="rounded-2xl p-5" style={CARD}>
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: C.sub }}>Achievements</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(d.achievements as any[]).map((a: any) => (
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

          {(d.opportunities as any[])?.length > 0 ? (
            <div className="flex flex-col gap-4">
              {(d.opportunities as any[]).map((opp: any, i: number) => {
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
        {activeTab === "ghost"         && <GhostTab         token={token} />}
        {activeTab === "simulator"     && <SimulatorTab     token={token} />}
        {activeTab === "fomo"          && <FomoTab          token={token} />}
        {activeTab === "mistakes"      && <MistakesTab      token={token} />}
        {activeTab === "rank"          && <RankTab          token={token} />}
        {activeTab === "report"        && <ReportTab        token={token} />}
        {activeTab === "opportunities" && <OpportunitiesTab token={token} />}
        {activeTab === "twin"          && <TwinTab          token={token} />}
      </div>
    </div>
  );
}
