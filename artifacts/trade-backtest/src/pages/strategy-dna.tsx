import React, { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Dna, AlertTriangle, TrendingUp, Shield, Target, Zap, BarChart2, Star } from "lucide-react";

type StratEntry = {
  id: number; name: string; type: string;
  dna: { momentum: number; meanReversion: number; riskControl: number;
         consistency: number; adaptability: number; profitability: number; };
  hasBacktest: boolean; grade: string; overallScore: number;
};

type DnaResponse = {
  strategies: StratEntry[];
  matrix: { i: number; j: number; similarity: number }[];
  duplicates: { a: string; b: string; similarity: number }[];
};

const DNA_DIMS = [
  { key: "momentum",      label: "Momentum",      icon: TrendingUp, color: "#6366f1" },
  { key: "meanReversion", label: "Mean Rev.",      icon: Target,     color: "#0ea5e9" },
  { key: "riskControl",   label: "Risk Ctrl",      icon: Shield,     color: "#22c55e" },
  { key: "consistency",   label: "Consistency",    icon: BarChart2,  color: "#f59e0b" },
  { key: "adaptability",  label: "Adaptability",   icon: Zap,        color: "#ec4899" },
  { key: "profitability", label: "Profitability",  icon: Star,       color: "#14b8a6" },
] as const;

const GRADE_META: Record<string, { color: string; bg: string; label: string }> = {
  S: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "Elite" },
  A: { color: "#22c55e", bg: "rgba(34,197,94,0.12)",   label: "Strong" },
  B: { color: "#6366f1", bg: "rgba(99,102,241,0.12)",  label: "Solid" },
  C: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "Average" },
  D: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Weak" },
};

function similarityColor(sim: number) {
  if (sim >= 90) return "#ef4444";
  if (sim >= 75) return "#f59e0b";
  if (sim >= 50) return "#6366f1";
  return "#6b7280";
}

function getSimilarity(matrix: DnaResponse["matrix"], i: number, j: number) {
  if (i === j) return 100;
  const entry = matrix.find((m) => (m.i === i && m.j === j) || (m.i === j && m.j === i));
  return entry?.similarity ?? 0;
}

export default function StrategyDnaPage() {
  const [data, setData] = useState<DnaResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true); setError(null); setData(null); setSelectedIdx(null);
    try {
      const token = localStorage.getItem("tt_token") ?? "";
      const resp = await fetch("/api/strategies/dna", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error((await resp.json()).error ?? "Request failed");
      const result: DnaResponse = await resp.json();
      setData(result);
      if (result.strategies.length > 0) setSelectedIdx(0);
    } catch (e: any) {
      setError(e.message || "Failed to generate DNA comparison");
    } finally { setIsLoading(false); }
  }, []);

  const selected = selectedIdx != null && data ? data.strategies[selectedIdx] : null;

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
            <p className="text-muted-foreground">Pairwise similarity matrix + behavioral fingerprints across all your strategies</p>
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
          <p className="text-muted-foreground">Computing DNA fingerprints and pairwise similarities…</p>
        </div>
      )}

      {!isLoading && !data && !error && (
        <div className="py-20 text-center border border-dashed rounded-xl">
          <Dna className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-medium">Click "Decode All Strategies" to generate DNA fingerprints</p>
          <p className="text-xs text-muted-foreground mt-1">Computes 6-dimensional performance signatures and a pairwise similarity matrix across all your strategies</p>
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* Duplicate warnings */}
          {data.duplicates.length > 0 && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/8 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-500">{data.duplicates.length} Near-Duplicate Strategy Pair{data.duplicates.length > 1 ? "s" : ""} Detected</span>
              </div>
              {data.duplicates.map((d, i) => (
                <p key={i} className="text-xs text-muted-foreground pl-6">
                  <span className="font-mono text-foreground">{d.a}</span> and <span className="font-mono text-foreground">{d.b}</span> share <span className="text-yellow-400 font-bold">{d.similarity}%</span> behavioral similarity — they may be redundant.
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Strategy list + grades */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Strategies ({data.strategies.length})</h3>
              {data.strategies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No strategies found. Create at least one strategy first.</p>
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
                          <p className="text-[10px] text-muted-foreground capitalize">{s.type.replace(/_/g, " ")} · {s.hasBacktest ? "Backtest data" : "No backtest yet"}</p>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border"
                            style={{ background: grade.bg, borderColor: `${grade.color}40`, color: grade.color }}
                          >
                            {s.grade}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Selected strategy DNA detail */}
            <div className="lg:col-span-2 space-y-4">
              {selected ? (
                <>
                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{selected.name}</CardTitle>
                          <CardDescription className="capitalize">{selected.type.replace(/_/g, " ")} · Score: {selected.overallScore}/100</CardDescription>
                        </div>
                        <div className="flex-shrink-0" style={{ color: (GRADE_META[selected.grade] ?? GRADE_META["D"]!).color }}>
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

                  {/* Similarity with other strategies */}
                  {data.strategies.length > 1 && (
                    <Card className="border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Similarity to Other Strategies</CardTitle>
                        <CardDescription>Cosine similarity of 6-dimensional DNA vectors (≥92% = near-duplicate warning)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {data.strategies
                            .map((s, j) => ({ s, j, sim: getSimilarity(data.matrix, selectedIdx!, j) }))
                            .filter(({ j }) => j !== selectedIdx)
                            .sort((a, b) => b.sim - a.sim)
                            .map(({ s, j, sim }) => (
                              <div key={j} className="flex items-center gap-3">
                                <button
                                  onClick={() => setSelectedIdx(j)}
                                  className="flex-1 text-left text-xs font-medium hover:text-primary transition-colors truncate"
                                >{s.name}</button>
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${sim}%`, background: similarityColor(sim) }} />
                                  </div>
                                  <span className="text-xs font-mono font-bold w-10 text-right" style={{ color: similarityColor(sim) }}>{sim}%</span>
                                  {sim >= 92 && <Badge className="text-[9px] bg-red-500/10 text-red-400 border-red-500/20">Duplicate!</Badge>}
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl">
                  Select a strategy on the left to view its DNA
                </div>
              )}
            </div>
          </div>

          {/* Full similarity heatmap matrix */}
          {data.strategies.length >= 2 && (
            <Card className="border-border overflow-x-auto">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pairwise Similarity Heatmap</CardTitle>
                <CardDescription>Full N×N similarity matrix — darker red = more similar, click a cell to compare</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="inline-block min-w-full">
                  <div className="grid gap-1" style={{ gridTemplateColumns: `120px repeat(${data.strategies.length}, minmax(0, 1fr))` }}>
                    {/* Header row */}
                    <div />
                    {data.strategies.map((s, j) => (
                      <div key={j} className="text-center">
                        <span className="text-[9px] text-muted-foreground font-mono truncate block" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 60, paddingBottom: 4 }}>{s.name}</span>
                      </div>
                    ))}
                    {/* Data rows */}
                    {data.strategies.map((rowS, i) => (
                      <React.Fragment key={i}>
                        <div className="flex items-center">
                          <span className="text-[10px] text-muted-foreground font-mono truncate">{rowS.name}</span>
                        </div>
                        {data.strategies.map((_, j) => {
                          const sim = getSimilarity(data.matrix, i, j);
                          const isDiag = i === j;
                          return (
                            <button
                              key={j}
                              onClick={() => { setSelectedIdx(i); }}
                              className="aspect-square rounded-md flex items-center justify-center text-[9px] font-mono font-bold transition-all hover:scale-110"
                              style={{
                                background: isDiag
                                  ? "rgba(99,102,241,0.4)"
                                  : `rgba(239,68,68,${(sim / 100) * 0.7})`,
                                color: sim > 60 || isDiag ? "white" : "hsl(var(--muted-foreground))",
                                border: "1px solid rgba(255,255,255,0.06)",
                                minHeight: 32,
                              }}
                            >
                              {isDiag ? "—" : `${sim}%`}
                            </button>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm" style={{ background: "rgba(239,68,68,0.7)" }} />
                    High similarity (potential duplicate)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm" style={{ background: "rgba(239,68,68,0.2)" }} />
                    Low similarity (diverse strategies)
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
