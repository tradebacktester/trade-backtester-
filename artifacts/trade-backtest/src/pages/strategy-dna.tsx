import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useListBacktests } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip as RechartsTooltip,
} from "recharts";
import {
  Dna, Loader2, TrendingUp, Shield, Target, Zap, BarChart2, Star,
} from "lucide-react";

type DnaData = {
  backtestId: number;
  strategyName: string;
  strategyType: string;
  symbol: string;
  dna: {
    momentum: number; meanReversion: number; riskControl: number;
    consistency: number; adaptability: number; profitability: number;
  };
  overallScore: number;
  grade: "S" | "A" | "B" | "C" | "D";
  archetypes: string[];
  strengths: string[];
  weaknesses: string[];
  metrics: {
    totalReturn: number; sharpeRatio: number; maxDrawdown: number;
    winRate: number; profitFactor: number; annualizedReturn: number;
  };
};

const DNA_DIMS = [
  { key: "momentum",     label: "Momentum",      icon: TrendingUp, color: "#6366f1" },
  { key: "meanReversion",label: "Mean Rev.",      icon: Target,     color: "#0ea5e9" },
  { key: "riskControl",  label: "Risk Control",   icon: Shield,     color: "#22c55e" },
  { key: "consistency",  label: "Consistency",    icon: BarChart2,  color: "#f59e0b" },
  { key: "adaptability", label: "Adaptability",   icon: Zap,        color: "#ec4899" },
  { key: "profitability",label: "Profitability",  icon: Star,       color: "#14b8a6" },
] as const;

const GRADE_META = {
  S: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Elite" },
  A: { color: "#22c55e", bg: "rgba(34,197,94,0.12)",  label: "Strong" },
  B: { color: "#6366f1", bg: "rgba(99,102,241,0.12)", label: "Solid" },
  C: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Average" },
  D: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",  label: "Weak" },
};

function fmtPct(v: number) { return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`; }
function fmtNum(v: number) { return v.toFixed(2); }

function DnaRadar({ dna }: { dna: DnaData["dna"] }) {
  const data = DNA_DIMS.map((d) => ({
    subject: d.label,
    value: dna[d.key],
    fullMark: 100,
  }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name="DNA" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
        <RechartsTooltip
          contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.5rem" }}
          formatter={(v: number) => [`${v}/100`]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function DnaBar({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: React.ElementType }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" style={{ color }} />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className="text-xs font-mono font-bold" style={{ color }}>{value}/100</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function StrategyDnaPage() {
  const [selectedBacktestId, setSelectedBacktestId] = useState<number | null>(null);
  const [dna, setDna] = useState<DnaData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: backtests, isLoading: loadingBt } = useListBacktests();

  const completedBacktests = (backtests ?? []).filter((bt: any) => bt.status === "complete");

  const handleAnalyze = useCallback(async () => {
    if (!selectedBacktestId) { setError("Select a backtest first"); return; }
    setIsLoading(true); setError(null); setDna(null);
    try {
      const resp = await fetch(`/api/superpowers/dna/${selectedBacktestId}`);
      if (!resp.ok) throw new Error((await resp.json()).error ?? "Request failed");
      setDna(await resp.json());
    } catch (e: any) {
      setError(e.message || "Failed to generate DNA");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBacktestId]);

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
          <Dna className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Strategy DNA Fingerprint</h1>
          <p className="text-muted-foreground">Decode the genetic makeup of your trading strategy across 6 performance dimensions</p>
        </div>
      </div>

      {/* Selector */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Backtest</CardTitle>
          <CardDescription>Choose a completed backtest to decode its strategy DNA</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              {loadingBt ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <select
                  value={selectedBacktestId ?? ""}
                  onChange={(e) => setSelectedBacktestId(Number(e.target.value) || null)}
                  className="w-full text-sm bg-muted border border-border rounded-md px-2 py-2 text-foreground"
                >
                  <option value="">Select a completed backtest…</option>
                  {completedBacktests.map((bt: any) => (
                    <option key={bt.id} value={bt.id}>
                      #{bt.id} · {bt.symbol} · {bt.strategyName ?? `Strategy #${bt.strategyId}`} ({bt.startDate} to {bt.endDate})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <Button onClick={handleAnalyze} disabled={isLoading || !selectedBacktestId} className="gap-2">
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</> : <><Dna className="h-4 w-4" /> Decode DNA</>}
            </Button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          {completedBacktests.length === 0 && !loadingBt && (
            <p className="text-xs text-muted-foreground mt-2">
              No completed backtests found. <Link href="/backtests/new" className="text-primary hover:underline">Run a backtest</Link> first.
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">Decoding strategy DNA…</p>
        </div>
      )}

      {dna && !isLoading && (() => {
        const grade = GRADE_META[dna.grade];
        return (
          <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Header card */}
            <Card className="border-border overflow-hidden relative">
              <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(ellipse at top left, ${grade.color}, transparent 60%)` }} />
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  {/* Grade badge */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-2">
                    <div
                      className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl font-bold border"
                      style={{ background: grade.bg, borderColor: `${grade.color}40`, color: grade.color }}
                    >
                      {dna.grade}
                    </div>
                    <span className="text-xs font-medium" style={{ color: grade.color }}>{grade.label}</span>
                    <span className="text-[11px] text-muted-foreground">Score: {dna.overallScore}/100</span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h2 className="text-2xl font-bold">{dna.strategyName}</h2>
                      <p className="text-muted-foreground">{dna.symbol} · <span className="capitalize">{dna.strategyType.replace("_", " ")}</span></p>
                    </div>
                    {/* Archetypes */}
                    <div className="flex flex-wrap gap-2">
                      {dna.archetypes.map((a) => (
                        <Badge key={a} className="bg-primary/10 text-primary border-primary/20">{a}</Badge>
                      ))}
                    </div>
                    {/* Strengths / Weaknesses */}
                    <div className="flex flex-wrap gap-4">
                      {dna.strengths.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Strengths</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {dna.strengths.map((s) => (
                              <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 capitalize">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {dna.weaknesses.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Weaknesses</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {dna.weaknesses.map((w) => (
                              <span key={w} className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 capitalize">{w}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Quick metrics */}
                  <div className="grid grid-cols-2 gap-2 flex-shrink-0">
                    {[
                      { label: "Return", value: fmtPct(dna.metrics.totalReturn), pos: dna.metrics.totalReturn >= 0 },
                      { label: "Sharpe", value: fmtNum(dna.metrics.sharpeRatio), pos: dna.metrics.sharpeRatio > 0 },
                      { label: "Max DD", value: `-${fmtNum(dna.metrics.maxDrawdown)}%`, pos: false },
                      { label: "Win Rate", value: `${fmtNum(dna.metrics.winRate)}%`, pos: dna.metrics.winRate >= 50 },
                    ].map(({ label, value, pos }) => (
                      <div key={label} className="p-2.5 rounded-lg bg-muted/30 text-center">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
                        <p className={`text-sm font-bold font-mono ${pos ? "text-green-400" : "text-red-400"}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Radar + Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">DNA Radar</CardTitle>
                  <CardDescription>6-axis performance signature</CardDescription>
                </CardHeader>
                <CardContent>
                  <DnaRadar dna={dna.dna} />
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Dimension Breakdown</CardTitle>
                  <CardDescription>Individual scores (0–100)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  {DNA_DIMS.map((d) => (
                    <DnaBar
                      key={d.key}
                      label={d.label}
                      value={dna.dna[d.key]}
                      color={d.color}
                      icon={d.icon}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Dimension descriptions */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {DNA_DIMS.map((d) => {
                const val = dna.dna[d.key];
                const level = val >= 70 ? "High" : val >= 40 ? "Medium" : "Low";
                const levelColor = val >= 70 ? "#22c55e" : val >= 40 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={d.key} className="p-3 rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-1.5 mb-2">
                      <d.icon className="h-3.5 w-3.5" style={{ color: d.color }} />
                      <span className="text-xs font-medium">{d.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="text-2xl font-bold font-mono" style={{ color: d.color }}>{val}</span>
                      <span className="text-xs" style={{ color: levelColor }}>{level}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      {d.key === "momentum" && "Trend-following ability, entry timing on directional moves."}
                      {d.key === "meanReversion" && "Exploits price reversion to mean; contrarian edge."}
                      {d.key === "riskControl" && "Capital preservation, drawdown management quality."}
                      {d.key === "consistency" && "Stability of returns, win-rate reliability over time."}
                      {d.key === "adaptability" && "Flexibility across market regimes and volatility levels."}
                      {d.key === "profitability" && "Raw return generation and profit factor efficiency."}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })()}
    </motion.div>
  );
}
