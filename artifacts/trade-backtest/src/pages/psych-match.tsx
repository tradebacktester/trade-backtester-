import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Brain, Sparkles, Loader2, AlertCircle,
  Target, TrendingUp, BarChart2, Shield, ChevronRight,
  AlertTriangle, Lightbulb, Activity, Flame, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { API } from "@/lib/api-config";


// ── Accent palette (kept as constants — used as chart/indicator colours only) ──
const A = {
  purple: "#a78bfa",
  blue:   "#38bdf8",
  green:  "#22c55e",
  amber:  "#f59e0b",
  red:    "#ef4444",
  indigo: "#6366f1",
  pink:   "#ec4899",
};

const STRATEGY_ICONS: Record<string, React.ElementType> = {
  sma_crossover: TrendingUp,
  ema_crossover: TrendingUp,
  rsi: Activity,
  macd: BarChart2,
  bollinger_bands: Target,
};

const STRATEGY_COLORS: Record<string, string> = {
  sma_crossover: A.blue,
  ema_crossover: A.green,
  rsi: A.purple,
  macd: "#38bdf8",
  bollinger_bands: "#fb923c",
};

const STRATEGY_LABELS: Record<string, string> = {
  sma_crossover: "SMA Crossover",
  ema_crossover: "EMA Crossover",
  rsi: "RSI Reversal",
  macd: "MACD Momentum",
  bollinger_bands: "Bollinger Bands",
};

const PERSONALITY_COLORS: Record<string, string> = {
  "Trend Rider":        A.blue,
  "Momentum Hunter":    A.amber,
  "Patient Contrarian": A.purple,
  "Disciplined Ranger": A.green,
  "Reactive Scalper":   A.red,
};

type PsychResult = {
  personalityType: string;
  personalityDescription: string;
  dominantTraits: string[];
  recommendations: Array<{
    strategyType: string;
    fitScore: number;
    fitLabel: string;
    reason: string;
    suggestedParams: Record<string, unknown>;
    warning: string;
  }>;
  redFlags: string[];
  coachingTip: string;
};

type TradeProfile = {
  totalTrades: number;
  winRate: number;
  avgHoldingDays: number;
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
  maxConsecutiveLosses: number;
  avgTradesPerBacktest: number;
  preferredSymbols: string[];
  lossToleranceRatio: number;
  backtestCount: number;
};

// ── Score Ring SVG ──────────────────────────────────────────────────
function ScoreRing({ score, color, size = 72 }: { score: number; color: string; size?: number }) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="hsl(var(--border))" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={13} fontWeight="bold">
        {score}
      </text>
    </svg>
  );
}

// ── Stat chip ──────────────────────────────────────────────────────
function StatChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl px-4 py-3 flex flex-col gap-1"
      style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}>
      <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
        {label}
      </span>
      <span className="text-sm font-bold font-mono" style={{ color: color ?? "hsl(var(--foreground))" }}>
        {value}
      </span>
    </div>
  );
}

export default function PsychMatchPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<TradeProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [result, setResult] = useState<PsychResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoadingProfile(false); return; }
    async function buildProfile() {
      try {
        const [btRes, stRes] = await Promise.all([
          fetch(`${API}/backtests`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/strategies`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const backtests: any[] = await btRes.json();
        const strategies: any[] = await stRes.json();

        if (!Array.isArray(backtests) || backtests.length === 0) {
          setLoadingProfile(false); return;
        }
        const completed = backtests.filter((b: any) => b.status === "complete");
        if (completed.length === 0) { setLoadingProfile(false); return; }

        const tradesArrays = await Promise.all(
          completed.slice(0, 10).map((b: any) =>
            fetch(`${API}/backtests/${b.id}/trades`, { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.json()).catch(() => [])
          )
        );
        const allTrades = tradesArrays.flat();
        if (allTrades.length === 0) { setLoadingProfile(false); return; }

        const winners = allTrades.filter((t: any) => Number(t.pnl) > 0);
        const losers  = allTrades.filter((t: any) => Number(t.pnl) <= 0);

        const holdDays = (t: any) =>
          Math.max(1, Math.round((new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime()) / 86400000));

        const avgHoldingDays = allTrades.reduce((s: number, t: any) => s + holdDays(t), 0) / allTrades.length;
        const avgWinPct  = winners.length ? winners.reduce((s: number, t: any) => s + Math.abs(Number(t.pnlPercent)), 0) / winners.length : 0;
        const avgLossPct = losers.length  ? losers.reduce((s: number, t: any) => s + Math.abs(Number(t.pnlPercent)), 0)  / losers.length  : 0;
        const winRate = (winners.length / allTrades.length) * 100;
        const profitFactor = losers.length > 0 && winners.length > 0
          ? winners.reduce((s: number, t: any) => s + Math.abs(Number(t.pnl)), 0) /
            losers.reduce((s: number, t: any) => s + Math.abs(Number(t.pnl)), 0)
          : winners.length > 0 ? 99 : 0;

        let maxConsec = 0, curConsec = 0;
        for (const t of allTrades) {
          if (Number(t.pnl) <= 0) { curConsec++; maxConsec = Math.max(maxConsec, curConsec); }
          else curConsec = 0;
        }

        const symbolMap: Record<string, number> = {};
        for (const b of completed) {
          const sym = b.symbol ?? "";
          symbolMap[sym] = (symbolMap[sym] ?? 0) + 1;
        }
        const preferredSymbols = Object.entries(symbolMap).sort((a, b) => b[1] - a[1]).map(([s]) => s);

        setProfile({
          totalTrades: allTrades.length,
          winRate,
          avgHoldingDays,
          avgWinPct,
          avgLossPct,
          profitFactor,
          maxConsecutiveLosses: maxConsec,
          avgTradesPerBacktest: allTrades.length / completed.length,
          preferredSymbols,
          lossToleranceRatio: avgWinPct > 0 ? avgLossPct / avgWinPct : 1,
          backtestCount: completed.length,
        });
      } catch {
        toast({ title: "Error", description: "Failed to load your trading history.", variant: "destructive" });
      } finally {
        setLoadingProfile(false);
      }
    }
    buildProfile();
  }, [token]);

  async function handleAnalyze() {
    if (!profile || !token) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API}/ai/psych-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profile }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Analysis failed"); return; }
      setResult(data);
    } catch {
      setError("Failed to connect to AI service.");
    } finally {
      setLoading(false);
    }
  }

  // ── Not signed in ───────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 max-w-sm mx-auto text-center">
        <div className="h-20 w-20 rounded-3xl flex items-center justify-center"
          style={{ background: `${A.purple}15`, border: `1px solid ${A.purple}30` }}>
          <Brain className="h-10 w-10" style={{ color: A.purple }} />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>
            Sign In to Get Your Psychology Match
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
            We analyze your backtest patterns — hold time, loss tolerance, trade frequency — to recommend
            the strategy that fits your personality best.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs"
          style={{ background: `${A.purple}10`, border: `1px solid ${A.purple}20`, color: A.purple }}>
          <Sparkles className="h-3.5 w-3.5" /> Powered by Llama 3.3 70B · Your data stays private
        </div>
      </div>
    );
  }

  const personalityColor = result ? (PERSONALITY_COLORS[result.personalityType] ?? A.indigo) : A.indigo;

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-24">

      {/* ── Hero Header ─────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden px-6 py-5"
        style={{
          background: `linear-gradient(135deg, var(--glass-bg) 0%, color-mix(in srgb, hsl(var(--background)) 94%, ${A.purple} 6%) 100%)`,
          border: "1px solid var(--glass-border)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}>
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${A.purple}20, transparent)`, transform: "translate(35%,-35%)" }} />
        <div className="relative flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${A.purple}18`, border: `1px solid ${A.purple}30` }}>
            <Brain className="h-5 w-5" style={{ color: A.purple }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>
              Psychology Match
            </h1>
          </div>
          <span className="ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{ background: `${A.purple}15`, color: A.purple, border: `1px solid ${A.purple}25` }}>
            <Sparkles className="h-3 w-3" /> AI
          </span>
        </div>
        <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          AI analyzes your paper trading patterns — holding time, loss tolerance, trade frequency — to identify the strategies that fit your personality.
        </p>
      </div>

      {/* ── Trading Fingerprint ──────────────────────────────────── */}
      {loadingProfile ? (
        <div className="rounded-2xl p-10 flex items-center justify-center"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: A.purple }} />
        </div>
      ) : !profile ? (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-4 text-center"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: "hsl(var(--border))" }}>
            <AlertCircle className="h-7 w-7" style={{ color: "hsl(var(--muted-foreground))" }} />
          </div>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "hsl(var(--foreground))" }}>
              No completed backtests yet
            </p>
            <p className="text-xs max-w-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              Run at least one complete backtest with trades to generate your psychology profile.
            </p>
          </div>
          <Link href="/backtests/new">
            <Button size="sm" style={{ background: A.indigo, color: "#fff" }}>
              Run a Backtest
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <div className="px-5 pt-4 pb-3 flex items-center gap-2"
            style={{ borderBottom: "1px solid hsl(var(--border))" }}>
            <Flame className="h-4 w-4" style={{ color: A.amber }} />
            <span className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              Your Trading Fingerprint
            </span>
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-mono"
              style={{ background: `${A.amber}12`, color: A.amber, border: `1px solid ${A.amber}25` }}>
              {profile.totalTrades} trades · {profile.backtestCount} backtests
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
            <StatChip label="Win Rate" value={`${profile.winRate.toFixed(1)}%`}
              color={profile.winRate >= 50 ? A.green : A.amber} />
            <StatChip label="Avg Hold Time" value={`${profile.avgHoldingDays.toFixed(1)}d`} />
            <StatChip label="Profit Factor"
              value={profile.profitFactor >= 50 ? "∞" : profile.profitFactor.toFixed(2)}
              color={profile.profitFactor >= 1.5 ? A.green : A.red} />
            <StatChip label="Max Consec. Loss" value={String(profile.maxConsecutiveLosses)}
              color={profile.maxConsecutiveLosses >= 5 ? A.red : "hsl(var(--foreground))"} />
            <StatChip label="Avg Win" value={`+${profile.avgWinPct.toFixed(1)}%`} color={A.green} />
            <StatChip label="Avg Loss"  value={`-${profile.avgLossPct.toFixed(1)}%`} color={A.red} />
            <StatChip label="Trades/Test" value={profile.avgTradesPerBacktest.toFixed(1)} />
            <StatChip label="Top Symbol"
              value={profile.preferredSymbols[0] ?? "—"}
              color={A.blue} />
          </div>
        </div>
      )}

      {/* ── CTA ─────────────────────────────────────────────────── */}
      {profile && !result && (
        <div className="flex flex-col items-center gap-4 py-2">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm w-full"
              style={{ background: `${A.red}10`, border: `1px solid ${A.red}28`, color: A.red }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="relative px-8 py-3.5 rounded-2xl text-sm font-bold flex items-center gap-2.5 transition-all hover:scale-105 disabled:opacity-70 disabled:scale-100"
            style={{
              background: `linear-gradient(135deg, ${A.indigo}, ${A.purple})`,
              color: "#fff",
              boxShadow: loading ? "none" : `0 4px 20px ${A.indigo}40`,
            }}>
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing your patterns…</>
              : <><Brain className="h-4 w-4" />Discover My Strategy Match<ChevronRight className="h-4 w-4 ml-1" /></>}
          </button>
          <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
            Powered by Llama 3.3 70B · Your data stays private
          </p>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────── */}
      {result && (
        <div className="space-y-5">

          {/* Personality hero */}
          <div className="relative rounded-2xl overflow-hidden px-6 py-6"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, hsl(var(--background)) 88%, ${personalityColor} 12%), color-mix(in srgb, hsl(var(--background)) 94%, ${personalityColor} 6%))`,
              border: `1px solid ${personalityColor}30`,
              boxShadow: `0 8px 32px ${personalityColor}15`,
            }}>
            <div className="absolute top-0 right-0 h-40 w-40 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, ${personalityColor}25, transparent)`, transform: "translate(30%,-30%)" }} />
            <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, ${personalityColor}12, transparent)`, transform: "translate(-40%,40%)" }} />

            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="h-20 w-20 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${personalityColor}18`,
                  border: `1px solid ${personalityColor}35`,
                  boxShadow: `inset 0 1px 0 ${personalityColor}20`,
                }}>
                <Brain className="h-10 w-10" style={{ color: personalityColor }} />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full mb-2 inline-block"
                  style={{ background: `${personalityColor}20`, color: personalityColor, border: `1px solid ${personalityColor}35` }}>
                  Your Trader Type
                </span>
                <h2 className="text-3xl font-black mb-2 tracking-tight" style={{ color: personalityColor }}>
                  {result.personalityType}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {result.personalityDescription}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {result.dominantTraits.map(t => (
                    <span key={t} className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                      style={{ background: `${personalityColor}14`, color: personalityColor, border: `1px solid ${personalityColor}28` }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Strategy recommendations */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest"
                style={{ color: "hsl(var(--muted-foreground))" }}>Strategy Recommendations</span>
              <div className="flex-1 h-px" style={{ background: "hsl(var(--border))" }} />
            </div>

            {result.recommendations.map((rec, i) => {
              const Icon = STRATEGY_ICONS[rec.strategyType] ?? BarChart2;
              const color = STRATEGY_COLORS[rec.strategyType] ?? A.indigo;
              const label = STRATEGY_LABELS[rec.strategyType] ?? rec.strategyType;
              const isBest = i === 0;
              return (
                <div key={i}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: "var(--glass-bg)",
                    border: `1px solid ${isBest ? color + "40" : "hsl(var(--border))"}`,
                    boxShadow: isBest ? `0 4px 20px ${color}12` : "none",
                  }}>
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Score ring */}
                      <ScoreRing score={rec.fitScore} color={color} size={68} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <div className="h-6 w-6 rounded-lg flex items-center justify-center"
                            style={{ background: `${color}18` }}>
                            <Icon className="h-3.5 w-3.5" style={{ color }} />
                          </div>
                          <span className="text-sm font-bold" style={{ color: "hsl(var(--foreground))" }}>
                            {label}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                            style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}>
                            {rec.fitLabel}
                          </span>
                          {isBest && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                              style={{ background: `${A.amber}15`, color: A.amber, border: `1px solid ${A.amber}30` }}>
                              ⭐ Best Match
                            </span>
                          )}
                        </div>

                        <p className="text-[13px] leading-relaxed mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {rec.reason}
                        </p>

                        {Object.keys(rec.suggestedParams ?? {}).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {Object.entries(rec.suggestedParams).map(([k, v]) => (
                              <span key={k} className="text-[10px] font-mono px-2 py-1 rounded-lg"
                                style={{ background: `${color}10`, color, border: `1px solid ${color}18` }}>
                                {k}: {String(v)}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-start gap-2 px-3 py-2 rounded-xl"
                          style={{ background: `${A.red}08`, border: `1px solid ${A.red}18` }}>
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: A.red, opacity: 0.8 }} />
                          <p className="text-[11px] leading-relaxed" style={{ color: A.red, opacity: 0.9 }}>{rec.warning}</p>
                        </div>
                      </div>
                    </div>

                    {isBest && (
                      <div className="mt-4 pt-4 flex items-center gap-3"
                        style={{ borderTop: "1px solid hsl(var(--border))" }}>
                        <Link href={`/strategies/new?type=${rec.strategyType}`}>
                          <Button size="sm" className="gap-2"
                            style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, color: "#fff", border: "none" }}>
                            <Sparkles className="h-3.5 w-3.5" />
                            Try This Strategy
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                          Opens strategy builder with suggested parameters
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Red flags & coaching */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {result.redFlags?.length > 0 && (
              <div className="rounded-2xl p-5"
                style={{ background: `${A.red}08`, border: `1px solid ${A.red}22` }}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4" style={{ color: A.red }} />
                  <span className="text-sm font-semibold" style={{ color: A.red }}>Habits to Avoid</span>
                </div>
                <div className="space-y-2">
                  {result.redFlags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-xs mt-0.5 font-bold" style={{ color: A.red }}>✕</span>
                      <p className="text-[12px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>{f}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.coachingTip && (
              <div className="rounded-2xl p-5"
                style={{ background: `${A.purple}08`, border: `1px solid ${A.purple}22` }}>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4" style={{ color: A.purple }} />
                  <span className="text-sm font-semibold" style={{ color: A.purple }}>Coaching Tip</span>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {result.coachingTip}
                </p>
              </div>
            )}
          </div>

          {/* Re-analyze */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
              style={{
                background: "var(--glass-bg)",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--muted-foreground))",
              }}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Re-analyze
            </button>
            <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
              Powered by Llama 3.3 70B · Not financial advice
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
