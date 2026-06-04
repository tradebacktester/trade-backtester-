import React, { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import {
  Brain, Sparkles, Loader2, AlertCircle, ArrowLeft,
  Target, TrendingUp, BarChart2, Shield, Star, ChevronRight,
  AlertTriangle, Lightbulb, Users, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

const API = "/api";

const STRATEGY_ICONS: Record<string, React.ElementType> = {
  sma_crossover: TrendingUp,
  ema_crossover: TrendingUp,
  rsi: Activity,
  macd: BarChart2,
  bollinger_bands: Target,
};

const STRATEGY_COLORS: Record<string, string> = {
  sma_crossover: "#60a5fa",
  ema_crossover: "#34d399",
  rsi: "#a78bfa",
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
  "Trend Rider": "#60a5fa",
  "Momentum Hunter": "#f59e0b",
  "Patient Contrarian": "#a78bfa",
  "Disciplined Ranger": "#34d399",
  "Reactive Scalper": "#ef4444",
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

function FitScoreRing({ score, color }: { score: number; color: string }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={80} height={80} viewBox="0 0 80 80">
      <circle cx={40} cy={40} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
      <circle
        cx={40} cy={40} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
      />
      <text x={40} y={40} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={14} fontWeight="bold">
        {score}
      </text>
    </svg>
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
          setLoadingProfile(false);
          return;
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
        const losers = allTrades.filter((t: any) => Number(t.pnl) <= 0);

        function holdDays(t: any): number {
          return Math.max(1, Math.round((new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime()) / 86400000));
        }

        const avgHoldingDays = allTrades.reduce((s: number, t: any) => s + holdDays(t), 0) / allTrades.length;
        const avgWinPct = winners.length ? winners.reduce((s: number, t: any) => s + Math.abs(Number(t.pnlPercent)), 0) / winners.length : 0;
        const avgLossPct = losers.length ? losers.reduce((s: number, t: any) => s + Math.abs(Number(t.pnlPercent)), 0) / losers.length : 0;
        const winRate = (winners.length / allTrades.length) * 100;
        const profitFactor = losers.length > 0 && winners.length > 0
          ? (winners.reduce((s: number, t: any) => s + Math.abs(Number(t.pnl)), 0) / losers.reduce((s: number, t: any) => s + Math.abs(Number(t.pnl)), 0))
          : winners.length > 0 ? 99 : 0;

        let maxConsec = 0; let curConsec = 0;
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

        const p: TradeProfile = {
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
        };
        setProfile(p);
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

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)" }}>
          <Brain className="h-8 w-8" style={{ color: "#a78bfa" }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "hsl(220,14%,88%)" }}>Sign In to Get Your Psychology Match</h2>
        <p className="text-sm text-center max-w-sm leading-relaxed" style={{ color: "hsl(220,14%,60%)" }}>
          We analyze your backtest patterns — hold time, loss tolerance, trade frequency — to recommend
          the strategy that fits your personality best.
        </p>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs" style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)", color: "#c4b5fd" }}>
          <Sparkles className="h-3.5 w-3.5" /> Powered by Llama 3.3 70B · Your data stays private
        </div>
      </div>
    );
  }

  const personalityColor = result ? (PERSONALITY_COLORS[result.personalityType] ?? "#6366f1") : "#6366f1";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Brain className="h-5 w-5" style={{ color: "#a78bfa" }} />
          <h1 className="text-xl font-bold" style={{ color: "hsl(220,14%,88%)" }}>Psychology Match</h1>
        </div>
        <p className="text-sm" style={{ color: "hsl(220,14%,50%)" }}>
          AI analyzes your paper trading patterns — holding time, loss tolerance, trade frequency — to identify the strategies that fit your personality.
        </p>
      </div>

      {/* Profile summary */}
      {loadingProfile ? (
        <Card style={{ background: "hsl(222,20%,10%)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <CardContent className="py-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#a78bfa" }} />
          </CardContent>
        </Card>
      ) : !profile ? (
        <Card style={{ background: "hsl(222,20%,10%)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <CardContent className="py-12 flex flex-col items-center justify-center space-y-3">
            <AlertCircle className="h-8 w-8" style={{ color: "hsl(220,14%,35%)" }} />
            <p className="text-sm font-medium" style={{ color: "hsl(220,14%,55%)" }}>No completed backtests yet</p>
            <p className="text-xs text-center max-w-sm" style={{ color: "hsl(220,14%,38%)" }}>
              Run at least one complete backtest with trades to generate your psychology profile.
            </p>
            <Link href="/backtests/new">
              <Button size="sm" style={{ background: "var(--accent-indigo)", color: "#fff" }}>Run a Backtest</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card style={{ background: "hsl(222,20%,10%)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium" style={{ color: "hsl(220,14%,60%)" }}>Your Trading Fingerprint</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Trades Analyzed", value: profile.totalTrades.toString() },
              { label: "Win Rate", value: `${profile.winRate.toFixed(1)}%` },
              { label: "Avg Hold Time", value: `${profile.avgHoldingDays.toFixed(1)}d` },
              { label: "Backtests", value: profile.backtestCount.toString() },
              { label: "Profit Factor", value: profile.profitFactor >= 50 ? "∞" : profile.profitFactor.toFixed(2) },
              { label: "Avg Win", value: `+${profile.avgWinPct.toFixed(1)}%` },
              { label: "Avg Loss", value: `-${profile.avgLossPct.toFixed(1)}%` },
              { label: "Max Consec. Losses", value: profile.maxConsecutiveLosses.toString() },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "hsl(220,14%,38%)" }}>{label}</p>
                <p className="text-sm font-semibold" style={{ color: "hsl(220,14%,80%)" }}>{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* CTA */}
      {profile && !result && (
        <div className="flex flex-col items-center gap-3 py-4">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm w-full" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}
          <Button onClick={handleAnalyze} disabled={loading} className="px-8 py-3 text-base" style={{ background: "var(--accent-indigo)", color: "#fff" }}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyzing your patterns…</> : <><Brain className="h-4 w-4 mr-2" />Discover My Strategy Match</>}
          </Button>
          <p className="text-xs" style={{ color: "hsl(220,14%,35%)" }}>Powered by Llama 3.3 70B · Your data stays private</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Personality header */}
          <Card style={{ background: `linear-gradient(135deg, hsl(222,20%,11%), hsl(222,20%,9%))`, border: `1px solid ${personalityColor}30` }}>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="h-20 w-20 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${personalityColor}15`, border: `1px solid ${personalityColor}30` }}>
                  <Brain className="h-9 w-9" style={{ color: personalityColor }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: `${personalityColor}20`, color: personalityColor }}>
                      Your Type
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold mb-2" style={{ color: personalityColor }}>{result.personalityType}</h2>
                  <p className="text-sm leading-relaxed" style={{ color: "hsl(220,14%,60%)" }}>{result.personalityDescription}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {result.dominantTraits.map(t => (
                      <span key={t} className="text-[11px] px-2.5 py-1 rounded-full"
                        style={{ background: `${personalityColor}15`, color: personalityColor, border: `1px solid ${personalityColor}30` }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Strategy recommendations */}
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest mb-3" style={{ color: "hsl(220,14%,38%)" }}>Strategy Recommendations</p>
            <div className="space-y-3">
              {result.recommendations.map((rec, i) => {
                const Icon = STRATEGY_ICONS[rec.strategyType] ?? BarChart2;
                const color = STRATEGY_COLORS[rec.strategyType] ?? "#6366f1";
                const label = STRATEGY_LABELS[rec.strategyType] ?? rec.strategyType;
                return (
                  <Card key={i} style={{ background: "hsl(222,20%,11%)", border: `1px solid ${i === 0 ? color + "40" : "rgba(255,255,255,0.07)"}` }}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <FitScoreRing score={rec.fitScore} color={color} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold"
                              style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
                              {label}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(255,255,255,0.05)", color: "hsl(220,14%,55%)" }}>
                              {rec.fitLabel}
                            </span>
                            {i === 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                                style={{ background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b40" }}>
                                ⭐ Best Match
                              </span>
                            )}
                          </div>
                          <p className="text-sm leading-relaxed mb-3" style={{ color: "hsl(220,14%,65%)" }}>{rec.reason}</p>
                          {Object.keys(rec.suggestedParams ?? {}).length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {Object.entries(rec.suggestedParams).map(([k, v]) => (
                                <span key={k} className="text-[10px] font-mono px-2 py-1 rounded-lg"
                                  style={{ background: `${color}10`, color, border: `1px solid ${color}20` }}>
                                  {k}: {String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-start gap-2 px-3 py-2 rounded-xl"
                            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#fca5a5" }} />
                            <p className="text-[11px] leading-relaxed" style={{ color: "#fca5a5" }}>{rec.warning}</p>
                          </div>
                        </div>
                      </div>
                      {i === 0 && (
                        <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          <Link href={`/strategies/new?type=${rec.strategyType}`}>
                            <Button size="sm" className="gap-2" style={{ background: color, color: "#fff" }}>
                              <Sparkles className="h-3.5 w-3.5" />
                              Try This Strategy
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Red flags & coaching */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {result.redFlags?.length > 0 && (
              <Card style={{ background: "hsl(222,20%,11%)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2" style={{ color: "#fca5a5" }}>
                    <AlertTriangle className="h-4 w-4" /> Habits to Avoid
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.redFlags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-[11px] mt-0.5" style={{ color: "#ef4444" }}>✕</span>
                      <p className="text-[12px] leading-relaxed" style={{ color: "hsl(220,14%,60%)" }}>{f}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {result.coachingTip && (
              <Card style={{ background: "hsl(222,20%,11%)", border: "1px solid rgba(167,139,250,0.2)" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2" style={{ color: "#a78bfa" }}>
                    <Lightbulb className="h-4 w-4" /> Coaching Tip
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[12px] leading-relaxed" style={{ color: "hsl(220,14%,60%)" }}>{result.coachingTip}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Regenerate */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={loading} className="gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Re-analyze
            </Button>
            <p className="text-[11px]" style={{ color: "hsl(220,14%,35%)" }}>Powered by Llama 3.3 70B · Not financial advice</p>
          </div>
        </div>
      )}
    </div>
  );
}
