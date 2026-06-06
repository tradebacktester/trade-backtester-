import React, { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Dna, AlertTriangle, TrendingUp, Shield, Target, Zap, BarChart2, Star, Brain, ChevronRight, CheckCircle2, XCircle, Lightbulb } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

// ─── Types ────────────────────────────────────────────────────────────────────

type StratEntry = {
  id: number; name: string; type: string;
  dna: { momentum: number; meanReversion: number; riskControl: number;
         consistency: number; adaptability: number; profitability: number; };
  hasBacktest: boolean; grade: string; overallScore: number;
};

type Correlation = {
  strategyIdA: number; strategyIdB: number;
  correlation: number;  // raw Pearson: –1 to +1
  isDuplicate: boolean; // correlation > 0.85
};

type DnaResponse = {
  strategies: StratEntry[];
  matrix: { i: number; j: number; similarity: number }[];
  duplicates: { a: string; b: string; similarity: number }[];
  correlations: Correlation[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DNA_DIMS = [
  { key: "momentum"      as const, label: "Momentum",     icon: TrendingUp, color: "#6366f1" },
  { key: "meanReversion" as const, label: "Mean Rev.",     icon: Target,     color: "#0ea5e9" },
  { key: "riskControl"   as const, label: "Risk Ctrl",     icon: Shield,     color: "#22c55e" },
  { key: "consistency"   as const, label: "Consistency",   icon: BarChart2,  color: "#f59e0b" },
  { key: "adaptability"  as const, label: "Adaptability",  icon: Zap,        color: "#ec4899" },
  { key: "profitability" as const, label: "Profitability", icon: Star,       color: "#14b8a6" },
];

const GRADE_META: Record<string, { color: string; bg: string; label: string }> = {
  S: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "Elite" },
  A: { color: "#22c55e", bg: "rgba(34,197,94,0.12)",   label: "Strong" },
  B: { color: "#6366f1", bg: "rgba(99,102,241,0.12)",  label: "Solid" },
  C: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "Average" },
  D: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Weak" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Signed Pearson heatmap color:
 *   -1 → red (#ef4444)
 *    0 → neutral gray (#374151)
 *   +1 → green (#22c55e)
 */
function pearsonColor(corr: number): string {
  if (corr >= 0) {
    // 0 → gray, 1 → green
    const g = Math.round(corr * 0xff);
    const r = Math.round((1 - corr) * 0x37);
    const b = Math.round((1 - corr) * 0x41);
    return `rgba(${r},${g + 0x37},${b + 0x21},${0.15 + corr * 0.65})`;
  } else {
    // 0 → gray, -1 → red
    const abs = Math.abs(corr);
    const r = Math.round(0x37 + abs * (0xef - 0x37));
    const g = Math.round(0x41 * (1 - abs) + 0x44 * abs);
    const b = Math.round(0x51 * (1 - abs) + 0x44 * abs);
    return `rgba(${r},${g},${b},${0.15 + abs * 0.65})`;
  }
}

function pearsonTextColor(corr: number): string {
  return Math.abs(corr) > 0.45 ? "white" : "hsl(var(--muted-foreground))";
}

function getPearson(
  correlations: Correlation[],
  strats: StratEntry[],
  i: number,
  j: number
): number {
  if (i === j) return 1;
  const sA = strats[i]?.id;
  const sB = strats[j]?.id;
  if (sA == null || sB == null) return 0;
  const entry = correlations.find(
    (c) => (c.strategyIdA === sA && c.strategyIdB === sB) ||
            (c.strategyIdA === sB && c.strategyIdB === sA)
  );
  return entry?.correlation ?? 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

type NarrativeResult = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  bestMarkets: string[];
  worstMarkets: string[];
  improvementTip: string;
};

export default function StrategyDnaPage() {
  const { token } = useAuth();
  const isLoggedIn = Boolean(token);
  const [data, setData] = useState<DnaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [narrative, setNarrative] = useState<NarrativeResult | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);

  useEffect(() => {
    setNarrative(null);
    setNarrativeError(null);
  }, [selectedIdx]);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true); setError(null); setData(null); setSelectedIdx(null);
    try {
      const t = token ?? "";
      const resp = await fetch(`${API_BASE}/api/strategies/dna`, {
        headers: { "Authorization": `Bearer ${t}` },
      });
      if (!resp.ok) throw new Error((await resp.json()).error ?? "Request failed");
      const result: DnaResponse = await resp.json();
      setData(result);
      if (result.strategies.length > 0) setSelectedIdx(0);
    } catch (e: any) {
      setError(e.message || "Failed to generate DNA comparison");
    } finally { setIsLoading(false); }
  }, [token]);

  const handleGetNarrative = useCallback(async (s: StratEntry) => {
    if (!token) return;
    setNarrativeLoading(true);
    setNarrativeError(null);
    setNarrative(null);
    try {
      const resp = await fetch(`${API_BASE}/api/ai/dna-narrative`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          strategyName: s.name,
          strategyType: s.type,
          dna: s.dna,
          grade: s.grade,
          overallScore: s.overallScore,
          metrics: {},
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "AI analysis failed");
      setNarrative(data as NarrativeResult);
    } catch (e: any) {
      setNarrativeError(e.message || "Failed to generate AI analysis");
    } finally {
      setNarrativeLoading(false);
    }
  }, [token]);

  const selected = selectedIdx != null && data ? data.strategies[selectedIdx] : null;
  const duplicatePairs = data?.correlations.filter((c) => c.isDuplicate) ?? [];

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <Dna className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Strategy DNA Fingerprint</h1>
            <p className="text-muted-foreground">Equity-curve Pearson correlation heatmap + behavioral fingerprints</p>
          </div>
        </div>
        <Button onClick={handleAnalyze} disabled={isLoading} className="gap-2">
          {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</> : <><Dna className="h-4 w-4" /> Decode All Strategies</>}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">Computing Pearson correlations across equity curves…</p>
        </div>
      )}

      {!isLoading && !data && !error && (
        <div className="py-20 text-center border border-dashed rounded-xl">
          <Dna className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          {isLoggedIn ? (
            <>
              <p className="text-sm font-medium">Click "Decode All Strategies" to generate DNA fingerprints</p>
              <p className="text-xs text-muted-foreground mt-1">
                Only strategies with a completed backtest are included. Correlation &gt;0.85 = near-duplicate pair.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Sign in to analyze your Strategy DNA</p>
              <p className="text-xs text-muted-foreground mt-1">
                Log in, create strategies and backtests, then click "Decode All Strategies" to see correlation fingerprints.
              </p>
            </>
          )}
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* Duplicate warnings — based on isDuplicate from correlations */}
          {duplicatePairs.length > 0 && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/8 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-500">
                  {duplicatePairs.length} Near-Duplicate Pair{duplicatePairs.length > 1 ? "s" : ""} Detected (Pearson &gt; 0.85)
                </span>
              </div>
              {duplicatePairs.map((c, i) => {
                const nameA = data.strategies.find((s) => s.id === c.strategyIdA)?.name ?? `#${c.strategyIdA}`;
                const nameB = data.strategies.find((s) => s.id === c.strategyIdB)?.name ?? `#${c.strategyIdB}`;
                return (
                  <p key={i} className="text-xs text-muted-foreground pl-6">
                    <span className="font-mono text-foreground">{nameA}</span> and{" "}
                    <span className="font-mono text-foreground">{nameB}</span> share Pearson{" "}
                    <span className="text-yellow-400 font-bold">{c.correlation.toFixed(2)}</span> — may be redundant.
                  </p>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Strategy list + grades */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Strategies ({data.strategies.length})
              </h3>
              {data.strategies.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No strategies with completed backtests found. Run a backtest first.
                </p>
              ) : (
                data.strategies.map((s, i) => {
                  const grade = GRADE_META[s.grade] ?? GRADE_META["D"]!;
                  const isSelected = selectedIdx === i;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedIdx(i)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/20"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">
                            {s.type.replace(/_/g, " ")}
                          </p>
                        </div>
                        <div
                          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border"
                          style={{ background: grade.bg, borderColor: `${grade.color}40`, color: grade.color }}
                        >
                          {s.grade}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Selected strategy DNA fingerprint */}
            <div className="lg:col-span-2 space-y-4">
              {selected ? (
                <>
                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{selected.name}</CardTitle>
                          <CardDescription className="capitalize">
                            {selected.type.replace(/_/g, " ")} · Score: {selected.overallScore}/100
                          </CardDescription>
                        </div>
                        <div style={{ color: (GRADE_META[selected.grade] ?? GRADE_META["D"]!).color }}>
                          <span className="text-4xl font-bold">{selected.grade}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {DNA_DIMS.map((d) => {
                        const val = selected.dna[d.key];
                        return (
                          <div key={d.key} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <d.icon className="h-3.5 w-3.5" style={{ color: d.color }} />
                                <span className="text-xs font-medium">{d.label}</span>
                              </div>
                              <span className="text-xs font-mono font-bold" style={{ color: d.color }}>{val}/100</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: d.color }}
                                initial={{ width: 0 }}
                                animate={{ width: `${val}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  {/* Pearson correlation with other strategies */}
                  {data.strategies.length > 1 && (
                    <Card className="border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Equity-Curve Correlation</CardTitle>
                        <CardDescription>
                          Raw Pearson r of daily equity returns — signed scale: –1 (inverse) → 0 (uncorrelated) → +1 (clone)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {data.strategies
                            .map((s, j) => ({
                              s, j,
                              corr: getPearson(data.correlations, data.strategies, selectedIdx!, j),
                            }))
                            .filter(({ j }) => j !== selectedIdx)
                            .sort((a, b) => b.corr - a.corr)
                            .map(({ s, j, corr }) => (
                              <div key={j} className="flex items-center gap-3">
                                <button
                                  onClick={() => setSelectedIdx(j)}
                                  className="flex-1 text-left text-xs font-medium hover:text-primary transition-colors truncate"
                                >{s.name}</button>
                                <div className="flex items-center gap-2">
                                  {/* Signed bar: left half = negative, right half = positive */}
                                  <div className="relative h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                                    {corr >= 0 ? (
                                      <div className="absolute left-1/2 top-0 h-full rounded-r-full bg-green-500"
                                        style={{ width: `${corr * 50}%` }} />
                                    ) : (
                                      <div className="absolute top-0 h-full rounded-l-full bg-red-500"
                                        style={{ right: "50%", width: `${Math.abs(corr) * 50}%` }} />
                                    )}
                                    <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                                  </div>
                                  <span className={`text-xs font-mono font-bold w-12 text-right ${corr >= 0.85 ? "text-yellow-400" : corr >= 0 ? "text-green-400" : "text-red-400"}`}>
                                    {corr >= 0 ? "+" : ""}{corr.toFixed(2)}
                                  </span>
                                  {corr > 0.85 && (
                                    <Badge className="text-[9px] bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Duplicate!</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* ── AI Behavioral Analysis ── */}
                  <Card className="border-border">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-primary" />
                          <CardTitle className="text-base">AI Behavioral Analysis</CardTitle>
                        </div>
                        {!narrative && !narrativeLoading && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs"
                            onClick={() => handleGetNarrative(selected!)}
                            disabled={narrativeLoading}
                          >
                            <Brain className="h-3.5 w-3.5" />
                            Analyze DNA
                          </Button>
                        )}
                      </div>
                      <CardDescription>AI-powered behavioral narrative and market fit analysis</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!narrative && !narrativeLoading && !narrativeError && (
                        <div className="py-6 text-center border border-dashed rounded-xl">
                          <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                          <p className="text-xs text-muted-foreground">Click "Analyze DNA" to get AI insights about this strategy's behavior</p>
                        </div>
                      )}

                      {narrativeLoading && (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <p className="text-xs text-muted-foreground">Analyzing behavioral DNA…</p>
                        </div>
                      )}

                      {narrativeError && (
                        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-destructive">{narrativeError}</p>
                        </div>
                      )}

                      {narrative && !narrativeLoading && (
                        <div className="space-y-4">
                          {/* Summary */}
                          <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3">
                            <p className="text-xs text-muted-foreground leading-relaxed">{narrative.summary}</p>
                          </div>

                          {/* Strengths + Weaknesses */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-mono uppercase tracking-wider font-semibold text-green-500">Strengths</p>
                              {(narrative.strengths ?? []).map((s, i) => (
                                <div key={i} className="flex items-start gap-1.5">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                                  <span className="text-xs text-muted-foreground">{s}</span>
                                </div>
                              ))}
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-mono uppercase tracking-wider font-semibold text-red-400">Weaknesses</p>
                              {(narrative.weaknesses ?? []).map((w, i) => (
                                <div key={i} className="flex items-start gap-1.5">
                                  <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                                  <span className="text-xs text-muted-foreground">{w}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Best / Worst Markets */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5 space-y-1.5">
                              <p className="text-[10px] font-mono uppercase tracking-wider font-semibold text-blue-400">Best In</p>
                              {(narrative.bestMarkets ?? []).map((m, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <ChevronRight className="h-3 w-3 text-blue-400 flex-shrink-0" />
                                  <span className="text-xs text-muted-foreground">{m}</span>
                                </div>
                              ))}
                            </div>
                            <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5 space-y-1.5">
                              <p className="text-[10px] font-mono uppercase tracking-wider font-semibold text-orange-400">Avoid In</p>
                              {(narrative.worstMarkets ?? []).map((m, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <ChevronRight className="h-3 w-3 text-orange-400 flex-shrink-0" />
                                  <span className="text-xs text-muted-foreground">{m}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Improvement Tip */}
                          {narrative.improvementTip && (
                            <div className="flex items-start gap-2.5 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
                              <Lightbulb className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[10px] font-mono uppercase tracking-wider font-semibold text-yellow-400 mb-0.5">Improvement Tip</p>
                                <p className="text-xs text-muted-foreground">{narrative.improvementTip}</p>
                              </div>
                            </div>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 text-xs text-muted-foreground"
                            onClick={() => handleGetNarrative(selected!)}
                            disabled={narrativeLoading}
                          >
                            <Brain className="h-3 w-3" />
                            Regenerate Analysis
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl">
                  Select a strategy on the left to view its DNA fingerprint
                </div>
              )}
            </div>
          </div>

          {/* Full Pearson correlation heatmap — signed color scale */}
          {data.strategies.length >= 2 && (
            <Card className="border-border overflow-x-auto">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pairwise Correlation Heatmap</CardTitle>
                <CardDescription>
                  Equity-curve Pearson r — red = inverse correlation, gray = uncorrelated, green = highly correlated
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="inline-block min-w-full">
                  <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `120px repeat(${data.strategies.length}, minmax(0, 1fr))` }}
                  >
                    {/* Header row */}
                    <div />
                    {data.strategies.map((s, j) => (
                      <div key={j} className="text-center">
                        <span
                          className="text-[9px] text-muted-foreground font-mono truncate block"
                          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 60, paddingBottom: 4 }}
                        >{s.name}</span>
                      </div>
                    ))}

                    {/* Data rows */}
                    {data.strategies.map((rowS, i) => (
                      <React.Fragment key={i}>
                        <div className="flex items-center">
                          <span className="text-[10px] text-muted-foreground font-mono truncate">{rowS.name}</span>
                        </div>
                        {data.strategies.map((_, j) => {
                          const isDiag = i === j;
                          const corr = isDiag ? 1 : getPearson(data.correlations, data.strategies, i, j);
                          return (
                            <button
                              key={j}
                              onClick={() => setSelectedIdx(i)}
                              className="aspect-square rounded-md flex items-center justify-center text-[9px] font-mono font-bold transition-all hover:scale-110"
                              style={{
                                background: isDiag ? "rgba(99,102,241,0.4)" : pearsonColor(corr),
                                color: isDiag ? "white" : pearsonTextColor(corr),
                                border: "1px solid rgba(255,255,255,0.06)",
                                minHeight: 32,
                              }}
                            >
                              {isDiag ? "—" : corr.toFixed(2)}
                            </button>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-6 mt-4 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm" style={{ background: pearsonColor(-1) }} />
                    –1.0 Inverse
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm" style={{ background: pearsonColor(0) }} />
                    0.0 Uncorrelated
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm" style={{ background: pearsonColor(0.85) }} />
                    +0.85 Near-duplicate
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm" style={{ background: "rgba(99,102,241,0.4)" }} />
                    Self (diagonal)
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </motion.div>
  );
}
