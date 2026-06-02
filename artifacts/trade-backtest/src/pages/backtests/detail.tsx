import React, { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetBacktest,
  useDeleteBacktest,
  getListBacktestsQueryKey,
  useGetBacktestTrades,
  useGetEquityCurve,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Trash2, TrendingUp, AlertTriangle, Search, Download,
  ChevronDown, ChevronUp, BookOpen, BarChart3, LayoutDashboard, StickyNote,
  Share2, Globe, Check, TrendingDown, Activity, Layers, Loader2,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ComposedChart, Line, BarChart, Bar, Cell, ReferenceLine, PieChart, Pie
} from "recharts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtUSD(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(v: number, decimals = 2) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}
function fmtNum(v: number, decimals = 2) {
  return v.toFixed(decimals);
}

// ─── Win Rate Gauge (SVG arc) ────────────────────────────────────────────────

function WinRateGauge({ pct }: { pct: number }) {
  const r = 54;
  const cx = 70;
  const cy = 70;
  const startAngle = 220;
  const endAngle = -40;
  const totalArc = 360 - (startAngle - endAngle); // going clockwise
  const arcPct = (pct / 100) * 240;
  const filled = arcPct;

  function polar(angle: number, radius = r) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }
  function describeArc(startDeg: number, sweepDeg: number, radius = r) {
    const s = polar(startDeg, radius);
    const eDeg = startDeg + sweepDeg;
    const e = polar(eDeg, radius);
    const lg = sweepDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${lg} 1 ${e.x} ${e.y}`;
  }
  const bgPath = describeArc(startAngle, 240);
  const fgPath = describeArc(startAngle, filled);
  const color = pct >= 60 ? "#22c55e" : pct >= 45 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={140} height={100} viewBox="0 0 140 100">
      <path d={bgPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} strokeLinecap="round" />
      {filled > 0 && (
        <path d={fgPath} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color}80)` }} />
      )}
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={20} fontWeight="700" fill={color} fontFamily="monospace">
        {pct.toFixed(1)}%
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.4)" letterSpacing="1">
        WIN RATE
      </text>
      <text x={15} y={95} fontSize={8} fill="rgba(255,255,255,0.3)">0%</text>
      <text x={105} y={95} fontSize={8} fill="rgba(255,255,255,0.3)">100%</text>
    </svg>
  );
}

// ─── Stat Box ────────────────────────────────────────────────────────────────

function StatBox({
  label, value, sub, valueClass = "font-mono", accent
}: {
  label: string; value: React.ReactNode; sub?: string; valueClass?: string; accent?: string;
}) {
  return (
    <div
      className="neon-hover-subtle relative overflow-hidden p-4 rounded-xl border border-border flex flex-col gap-1 bg-card"
      style={accent ? { borderColor: `${accent}30`, background: `${accent}08` } : {}}
    >
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}60, transparent)` }} />
      )}
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-bold leading-tight ${valueClass}`} style={accent ? { color: accent } : {}}>{value}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── Trade Journal Note ───────────────────────────────────────────────────────

const SESSIONS = [
  { id: "london", label: "London", color: "#6366f1" },
  { id: "ny", label: "New York", color: "#0ea5e9" },
  { id: "asia", label: "Asia", color: "#f59e0b" },
  { id: "overlap", label: "Overlap", color: "#10b981" },
];

const EMOTIONS_PRE = ["😤 Fearful", "😌 Calm", "🎯 Focused", "🤑 Greedy", "😴 Tired", "⚡ Excited"];
const EMOTIONS_POST = ["😤 Regret", "😌 Satisfied", "🎯 Disciplined", "😔 Disappointed", "🤗 Proud", "😮 Surprised"];
const MISTAKES = ["Oversize", "Chased entry", "No stop loss", "FOMO", "Moved SL", "Early exit", "Revenge trade"];

const STRATEGY_TAGS: { label: string; color: string }[] = [
  { label: "trend", color: "#6366f1" },
  { label: "breakout", color: "#0ea5e9" },
  { label: "reversal", color: "#ec4899" },
  { label: "momentum", color: "#10b981" },
  { label: "fomo", color: "#f59e0b" },
  { label: "planned", color: "#22c55e" },
  { label: "scalp", color: "#a78bfa" },
  { label: "swing", color: "#38bdf8" },
];

function TradeNote({ tradeId, backtestId }: { tradeId: number; backtestId: number }) {
  const key = `trade_note_${backtestId}_${tradeId}`;

  const [note, setNote] = useState(() => localStorage.getItem(key) ?? "");
  const [tags, setTags] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(key + "_tags") ?? "[]"); } catch { return []; }
  });
  const [newTag, setNewTag] = useState("");
  const [session, setSession] = useState(() => localStorage.getItem(key + "_session") ?? "");
  const [emotionPre, setEmotionPre] = useState(() => localStorage.getItem(key + "_emotion_pre") ?? "");
  const [emotionPost, setEmotionPost] = useState(() => localStorage.getItem(key + "_emotion_post") ?? "");
  const [confidence, setConfidence] = useState(() => parseInt(localStorage.getItem(key + "_confidence") ?? "0"));
  const [mistakes, setMistakes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(key + "_mistakes") ?? "[]"); } catch { return []; }
  });
  const [isExpanded, setIsExpanded] = useState(false);

  function persist<T>(suffix: string, value: T) {
    localStorage.setItem(key + suffix, typeof value === "string" ? value : JSON.stringify(value));
  }

  function addTag() {
    if (!newTag.trim()) return;
    const updated = [...new Set([...tags, newTag.trim()])];
    setTags(updated);
    persist("_tags", updated);
    setNewTag("");
  }
  function removeTag(t: string) {
    const updated = tags.filter((x) => x !== t);
    setTags(updated);
    persist("_tags", updated);
  }
  function toggleMistake(m: string) {
    const updated = mistakes.includes(m) ? mistakes.filter(x => x !== m) : [...mistakes, m];
    setMistakes(updated);
    persist("_mistakes", updated);
  }
  function setAndPersistSession(s: string) {
    const val = session === s ? "" : s;
    setSession(val);
    persist("_session", val);
  }

  const hasContent = note || tags.length > 0 || session || emotionPre || emotionPost || confidence > 0 || mistakes.length > 0;

  return (
    <div
      className="rounded-xl border transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderColor: hasContent ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)",
      }}
    >
      {/* Header – always visible */}
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        onClick={() => setIsExpanded(v => !v)}
      >
        <StickyNote className="h-3.5 w-3.5 shrink-0" style={{ color: hasContent ? "hsl(38,100%,60%)" : "hsl(220,14%,40%)" }} />
        <span className="flex-1 text-xs font-medium uppercase tracking-wider" style={{ color: hasContent ? "hsl(220,14%,75%)" : "hsl(220,14%,42%)" }}>
          Trade Journal
          {hasContent && " ·"}
          {session && <span className="ml-1 text-[10px] font-normal" style={{ color: SESSIONS.find(s => s.id === session)?.color }}>{SESSIONS.find(s => s.id === session)?.label}</span>}
          {emotionPre && <span className="ml-1 text-[10px]">{emotionPre.split(" ")[0]}</span>}
          {confidence > 0 && <span className="ml-1 text-[10px]">{"★".repeat(confidence)}</span>}
        </span>
        {tags.length > 0 && (
          <span className="flex gap-1">
            {tags.slice(0, 3).map(t => {
              const tc = STRATEGY_TAGS.find(s => s.label === t)?.color ?? "#6366f1";
              return <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full font-mono" style={{ background: `${tc}20`, color: tc }}>#{t}</span>;
            })}
            {tags.length > 3 && <span className="text-[9px] font-mono" style={{ color: "hsl(220,14%,40%)" }}>+{tags.length - 3}</span>}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform" style={{ color: "hsl(220,14%,40%)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>

          {/* Session & Confidence */}
          <div className="pt-3 flex flex-wrap gap-4 items-start">
            <div>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "hsl(220,14%,38%)" }}>Session</p>
              <div className="flex gap-1.5 flex-wrap">
                {SESSIONS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setAndPersistSession(s.id)}
                    className="px-2.5 py-1 text-[10px] rounded-lg font-mono transition-all"
                    style={session === s.id
                      ? { background: `${s.color}25`, color: s.color, border: `1px solid ${s.color}50` }
                      : { color: "hsl(220,14%,45%)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "hsl(220,14%,38%)" }}>Confidence</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => { const v = confidence === star ? 0 : star; setConfidence(v); persist("_confidence", v.toString()); }}
                    className="text-lg transition-all"
                    style={{ color: star <= confidence ? "#f59e0b" : "rgba(255,255,255,0.12)", filter: star <= confidence ? "drop-shadow(0 0 6px #f59e0b80)" : "none" }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Emotions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "hsl(220,14%,38%)" }}>Emotion Before</p>
              <div className="flex flex-wrap gap-1.5">
                {EMOTIONS_PRE.map(e => (
                  <button
                    key={e}
                    onClick={() => { const v = emotionPre === e ? "" : e; setEmotionPre(v); persist("_emotion_pre", v); }}
                    className="px-2 py-1 text-[10px] rounded-lg transition-all"
                    style={emotionPre === e
                      ? { background: "rgba(99,102,241,0.2)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.4)" }
                      : { color: "hsl(220,14%,45%)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "hsl(220,14%,38%)" }}>Emotion After</p>
              <div className="flex flex-wrap gap-1.5">
                {EMOTIONS_POST.map(e => (
                  <button
                    key={e}
                    onClick={() => { const v = emotionPost === e ? "" : e; setEmotionPost(v); persist("_emotion_post", v); }}
                    className="px-2 py-1 text-[10px] rounded-lg transition-all"
                    style={emotionPost === e
                      ? { background: "rgba(14,165,233,0.2)", color: "#38bdf8", border: "1px solid rgba(14,165,233,0.4)" }
                      : { color: "hsl(220,14%,45%)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Strategy Tags */}
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "hsl(220,14%,38%)" }}>Strategy Tags</p>
            <div className="flex flex-wrap gap-1.5 items-center">
              {STRATEGY_TAGS.map(({ label, color }) => (
                <button
                  key={label}
                  onClick={() => tags.includes(label) ? removeTag(label) : (() => { const u = [...new Set([...tags, label])]; setTags(u); persist("_tags", u); })()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono transition-all"
                  style={tags.includes(label)
                    ? { background: `${color}25`, color, border: `1px solid ${color}50` }
                    : { color: "hsl(220,14%,45%)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  #{label}
                </button>
              ))}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTag()}
                  placeholder="+ custom"
                  className="text-[10px] bg-transparent outline-none placeholder:opacity-30 w-14 font-mono"
                  style={{ color: "hsl(220,14%,65%)" }}
                />
              </div>
            </div>
          </div>

          {/* Mistakes */}
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "hsl(220,14%,38%)" }}>Mistake Log</p>
            <div className="flex flex-wrap gap-1.5">
              {MISTAKES.map(m => (
                <button
                  key={m}
                  onClick={() => toggleMistake(m)}
                  className="px-2.5 py-1 text-[10px] font-mono rounded-lg transition-all"
                  style={mistakes.includes(m)
                    ? { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.35)" }
                    : { color: "hsl(220,14%,45%)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "hsl(220,14%,38%)" }}>Notes</p>
            <textarea
              className="w-full text-xs bg-transparent resize-none outline-none placeholder:opacity-30 min-h-[64px] font-mono rounded-lg p-3 transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.07)", color: "hsl(220,14%,80%)" }}
              placeholder="Trade setup, execution notes, lessons learned…"
              value={note}
              onChange={(e) => { setNote(e.target.value); persist("", e.target.value); }}
              onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = "rgba(255,255,255,0.15)"; }}
              onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Parameter Optimization Heatmap ─────────────────────────────────────────

const PARAM_RANGE_PRESETS: Record<string, number[]> = {
  fastPeriod: [5, 8, 10, 12, 15, 20],
  slowPeriod: [20, 25, 30, 40, 50, 60],
  period: [10, 14, 20, 25, 30],
  overbought: [65, 70, 75, 80],
  oversold: [20, 25, 30, 35],
  signalPeriod: [7, 9, 11, 14],
  stdDev: [1.5, 2, 2.5, 3],
};

type OptResult = {
  param1Name: string; param2Name: string;
  param1Values: number[]; param2Values: number[];
  results: Array<{ p1: number; p2: number; totalReturn: number; sharpeRatio: number; maxDrawdown: number; winRate: number }>;
};

function ParameterOptHeatmap({
  strategyId, symbol, startDate, endDate, initialCapital,
}: {
  strategyId: number; symbol: string; startDate: string; endDate: string; initialCapital: number;
}) {
  const [param1, setParam1] = useState("fastPeriod");
  const [param2, setParam2] = useState("slowPeriod");
  const [metric, setMetric] = useState<"totalReturn" | "sharpeRatio" | "winRate">("totalReturn");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const runOptimize = useCallback(async () => {
    if (param1 === param2) {
      toast({ title: "Select different parameters", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/backtests/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId, symbol, startDate, endDate, initialCapital,
          param1Name: param1,
          param1Values: PARAM_RANGE_PRESETS[param1] ?? [5, 10, 15, 20, 25, 30],
          param2Name: param2,
          param2Values: PARAM_RANGE_PRESETS[param2] ?? [20, 30, 40, 50, 60, 70],
        }),
      });
      if (!resp.ok) throw new Error("Optimization failed");
      const data = await resp.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Failed to run optimization");
    } finally {
      setIsLoading(false);
    }
  }, [param1, param2, strategyId, symbol, startDate, endDate, initialCapital, toast]);

  const paramNames = Object.keys(PARAM_RANGE_PRESETS);
  const p1Vals = result?.param1Values ?? [];
  const p2Vals = result?.param2Values ?? [];

  let minVal = Infinity, maxVal = -Infinity;
  if (result) {
    for (const r of result.results) {
      const v = r[metric];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base">Parameter Optimization</CardTitle>
            <CardDescription>Grid search return over two parameters</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={param1}
              onChange={(e) => setParam1(e.target.value)}
              className="text-xs bg-muted border border-border rounded-md px-2 py-1.5 text-foreground"
            >
              {paramNames.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <span className="text-xs text-muted-foreground">vs</span>
            <select
              value={param2}
              onChange={(e) => setParam2(e.target.value)}
              className="text-xs bg-muted border border-border rounded-md px-2 py-1.5 text-foreground"
            >
              {paramNames.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as any)}
              className="text-xs bg-muted border border-border rounded-md px-2 py-1.5 text-foreground"
            >
              <option value="totalReturn">Return %</option>
              <option value="sharpeRatio">Sharpe</option>
              <option value="winRate">Win Rate</option>
            </select>
            <Button size="sm" onClick={runOptimize} disabled={isLoading} className="text-xs">
              {isLoading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running…</> : "Run Grid"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        {!result && !isLoading && (
          <div className="h-20 flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-md">
            Select two parameters and click "Run Grid" to see the optimization heatmap.
          </div>
        )}
        {isLoading && (
          <div className="h-20 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Running {PARAM_RANGE_PRESETS[param1]?.length ?? 6} × {PARAM_RANGE_PRESETS[param2]?.length ?? 6} combinations…
          </div>
        )}
        {result && !isLoading && (
          <div className="overflow-x-auto">
            <div className="space-y-1 min-w-[400px]">
              {/* Header row */}
              <div className="flex gap-1 items-center">
                <div className="w-16 text-[10px] text-muted-foreground text-right pr-2 font-mono shrink-0">
                  {result.param1Name}↓ / {result.param2Name}→
                </div>
                {p2Vals.map((v) => (
                  <div key={v} className="flex-1 text-center text-[10px] font-mono text-muted-foreground">{v}</div>
                ))}
              </div>
              {p1Vals.map((p1v) => (
                <div key={p1v} className="flex gap-1 items-center">
                  <div className="w-16 text-right pr-2 text-[10px] font-mono text-muted-foreground shrink-0">{p1v}</div>
                  {p2Vals.map((p2v) => {
                    const cell = result.results.find((r) => r.p1 === p1v && r.p2 === p2v);
                    const val = cell?.[metric];
                    const norm = val != null && maxVal !== minVal ? (val - minVal) / (maxVal - minVal) : null;
                    const bg = norm == null
                      ? "rgba(255,255,255,0.04)"
                      : val! >= 0
                      ? `rgba(34,197,94,${0.1 + norm * 0.75})`
                      : `rgba(239,68,68,${0.1 + (1 - norm) * 0.75})`;
                    const color = val == null ? "rgba(255,255,255,0.2)" : val >= 0 ? "#86efac" : "#fca5a5";
                    return (
                      <div
                        key={p2v}
                        className="flex-1 h-10 rounded flex items-center justify-center"
                        style={{ background: bg }}
                        title={`${result.param1Name}=${p1v}, ${result.param2Name}=${p2v}: ${val != null ? (metric === "totalReturn" ? `${val >= 0 ? "+" : ""}${val.toFixed(1)}%` : val.toFixed(2)) : "N/A"}`}
                      >
                        <span className="text-[9px] font-mono font-medium" style={{ color }}>
                          {val != null
                            ? (metric === "totalReturn" ? `${val >= 0 ? "+" : ""}${val.toFixed(1)}%` : val.toFixed(1))
                            : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="flex items-center justify-end gap-4 pt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: "rgba(34,197,94,0.7)" }} /> high</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: "rgba(239,68,68,0.7)" }} /> low</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BacktestDetail() {
  const [, params] = useRoute("/backtests/:id");
  const id = parseInt(params?.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("overview");
  const [tradeSearch, setTradeSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState<"all" | "wins" | "losses">("all");
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<string>("entryDate");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const { data: backtest, isLoading } = useGetBacktest(id, {
    query: {
      enabled: !!id,
      refetchInterval: (data: any) =>
        data?.state?.data?.status === "running" || data?.state?.data?.status === "pending"
          ? 1000
          : false,
    } as any,
  });
  const { data: trades, isLoading: isLoadingTrades } = useGetBacktestTrades(id, {
    query: { enabled: !!id && backtest?.status === "complete" } as any,
  });
  const { data: equityCurve, isLoading: isLoadingEquity } = useGetEquityCurve(id, {
    query: { enabled: !!id && backtest?.status === "complete" } as any,
  });

  const deleteBacktest = useDeleteBacktest();

  function handleDelete() {
    deleteBacktest.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBacktestsQueryKey() });
          toast({ title: "Backtest Deleted", description: "The backtest result has been removed." });
          setLocation("/backtests");
        },
        onError: (error: { data?: { error?: string } | null }) => {
          toast({ title: "Error", description: error.data?.error || "Failed to delete backtest", variant: "destructive" });
        },
      }
    );
  }

  const [isPublished, setIsPublished] = useState(() =>
    localStorage.getItem(`published_bt_${id}`) === "true"
  );
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      const el = document.createElement("textarea");
      el.value = window.location.href;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setShareCopied(true);
    toast({ title: "Link copied!", description: "Backtest URL is ready to share." });
    setTimeout(() => setShareCopied(false), 2000);
  }, [toast]);

  const handlePublish = useCallback(() => {
    localStorage.setItem(`published_bt_${id}`, "true");
    setIsPublished(true);
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    toast({ title: "Published!", description: "Results are now shareable. Link copied." });
  }, [id, toast]);

  // ─── Compute Analytics ─────────────────────────────────────────────────────

  const analytics = useMemo(() => {
    if (!trades || !trades.length || !backtest) return null;

    const winners = trades.filter((t) => t.pnl > 0);
    const losers = trades.filter((t) => t.pnl <= 0);
    const winRate = (winners.length / trades.length) * 100;
    const avgWin = winners.length ? winners.reduce((a, t) => a + t.pnlPercent, 0) / winners.length : 0;
    const avgLoss = losers.length ? Math.abs(losers.reduce((a, t) => a + t.pnlPercent, 0) / losers.length) : 0;
    const avgRR = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? 99 : 0;

    // Streaks
    let maxWins = 0, maxLosses = 0, curW = 0, curL = 0;
    for (const t of trades) {
      if (t.pnl > 0) { curW++; curL = 0; maxWins = Math.max(maxWins, curW); }
      else { curL++; curW = 0; maxLosses = Math.max(maxLosses, curL); }
    }

    // Avg duration
    const durations = trades.map((t) => differenceInDays(new Date(t.exitDate), new Date(t.entryDate)));
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    // Best/worst
    const pnlPcts = trades.map((t) => t.pnlPercent);
    const bestTrade = Math.max(...pnlPcts);
    const worstTrade = Math.min(...pnlPcts);

    // Monthly returns
    const monthlyMap = new Map<string, number>();
    for (const t of trades) {
      const m = t.exitDate.slice(0, 7);
      monthlyMap.set(m, (monthlyMap.get(m) ?? 0) + t.pnl);
    }
    const monthlyReturns = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, pnl]) => ({
        month,
        label: format(new Date(month + "-01"), "MMM yy"),
        pnl,
        pct: (pnl / backtest.initialCapital) * 100,
      }));

    // Trade distribution (histogram buckets)
    const buckets: Record<string, number> = {};
    for (const pct of pnlPcts) {
      const bucket = Math.floor(pct / 2) * 2;
      const k = `${bucket >= 0 ? "+" : ""}${bucket}%`;
      buckets[k] = (buckets[k] ?? 0) + 1;
    }
    const distribution = Object.entries(buckets)
      .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
      .map(([range, count]) => ({ range, count, positive: parseFloat(range) >= 0 }));

    // Gross profit/loss
    const grossProfit = winners.reduce((a, t) => a + t.pnl, 0);
    const grossLoss = Math.abs(losers.reduce((a, t) => a + t.pnl, 0));

    return {
      winRate, avgWin, avgLoss, avgRR, maxWins, maxLosses,
      avgDuration, bestTrade, worstTrade, monthlyReturns, distribution,
      grossProfit, grossLoss, totalWinners: winners.length, totalLosers: losers.length,
    };
  }, [trades, backtest]);

  // ─── Filtered & sorted trade list ──────────────────────────────────────────

  const filteredTrades = useMemo(() => {
    if (!trades) return [];
    return trades
      .filter((t) => {
        if (tradeFilter === "wins") return t.pnl > 0;
        if (tradeFilter === "losses") return t.pnl <= 0;
        return true;
      })
      .filter((t) => {
        if (!tradeSearch) return true;
        const q = tradeSearch.toLowerCase();
        return (
          t.entryDate.includes(q) ||
          t.exitDate.includes(q) ||
          t.side.includes(q) ||
          t.pnl.toFixed(2).includes(q)
        );
      })
      .sort((a: any, b: any) => {
        const av = a[sortKey], bv = b[sortKey];
        if (typeof av === "string") return sortDir * av.localeCompare(bv);
        return sortDir * (av - bv);
      });
  }, [trades, tradeFilter, tradeSearch, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
  }
  function SortIcon({ k }: { k: string }) {
    if (sortKey !== k) return <ChevronDown className="h-3 w-3 opacity-30 inline ml-1" />;
    return sortDir === 1
      ? <ChevronDown className="h-3 w-3 inline ml-1 text-primary" />
      : <ChevronUp className="h-3 w-3 inline ml-1 text-primary" />;
  }

  function exportCSV() {
    if (!trades) return;
    const rows = [
      ["Side", "Entry Date", "Entry Price", "Exit Date", "Exit Price", "Qty", "PnL", "PnL %", "Duration"],
      ...trades.map((t) => [
        t.side, t.entryDate, t.entryPrice.toFixed(2), t.exitDate, t.exitPrice.toFixed(2),
        t.quantity.toFixed(4), t.pnl.toFixed(2), t.pnlPercent.toFixed(2),
        differenceInDays(new Date(t.exitDate), new Date(t.entryDate)).toString(),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `backtest_${id}_trades.csv`;
    a.click();
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-[300px]" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!backtest) return <div>Backtest not found.</div>;

  const isRunning = backtest.status === "pending" || backtest.status === "running";

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/backtests"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{backtest.symbol} Backtest</h1>
            <Badge
              variant={backtest.status === "complete" ? "default" : backtest.status === "failed" ? "destructive" : "secondary"}
              className="uppercase"
            >
              {backtest.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Using{" "}
            <Link href={`/strategies/${backtest.strategyId}`} className="hover:underline text-primary">
              {backtest.strategyName || `Strategy #${backtest.strategyId}`}
            </Link>{" "}
            ({backtest.startDate} to {backtest.endDate})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="icon"
            onClick={handleShare}
            title="Share backtest link"
            className="neon-hover-subtle"
          >
            {shareCopied
              ? <Check className="h-4 w-4 text-green-500" />
              : <Share2 className="h-4 w-4" />}
          </Button>
          {isPublished ? (
            <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1.5 flex items-center gap-1.5">
              <Globe className="h-3 w-3" />Published
            </Badge>
          ) : (
            <Button variant="outline" size="sm" onClick={handlePublish} className="neon-hover-subtle">
              <Globe className="mr-1.5 h-3.5 w-3.5" />Publish
            </Button>
          )}
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete backtest?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {isRunning ? (
        <Card className="border-border">
          <CardContent className="py-12 flex flex-col items-center justify-center space-y-4">
            <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <h3 className="text-lg font-medium">Running Simulation...</h3>
            <p className="text-sm text-muted-foreground">This may take a few moments.</p>
          </CardContent>
        </Card>
      ) : backtest.status === "failed" ? (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-12 flex flex-col items-center justify-center space-y-4 text-destructive">
            <AlertTriangle className="h-12 w-12" />
            <h3 className="text-lg font-medium">Simulation Failed</h3>
          </CardContent>
        </Card>
      ) : (
        <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
          {/* Tab list */}
          <Tabs.List className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border w-fit mb-6">
            {[
              { value: "overview", label: "Overview", Icon: LayoutDashboard },
              { value: "analytics", label: "Analytics", Icon: BarChart3 },
              { value: "journal", label: "Trade Journal", Icon: BookOpen },
            ].map(({ value, label, Icon }) => (
              <Tabs.Trigger
                key={value}
                value={value}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm cursor-pointer select-none"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* ── TAB 1: Overview ─────────────────────────────────────── */}
          <Tabs.Content value="overview" className="space-y-6 tab-transition">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <StatBox
                label="Initial Capital"
                value={`$${backtest.initialCapital.toLocaleString()}`}
              />
              <StatBox
                label="Final Capital"
                value={backtest.finalCapital != null ? fmtUSD(backtest.finalCapital) : "—"}
                accent={backtest.finalCapital && backtest.finalCapital > backtest.initialCapital ? "#22c55e" : "#ef4444"}
              />
              <StatBox
                label="Total Return"
                value={backtest.totalReturn != null ? fmtPct(backtest.totalReturn) : "—"}
                accent={backtest.totalReturn != null && backtest.totalReturn >= 0 ? "#22c55e" : "#ef4444"}
              />
              <StatBox
                label="Ann. Return"
                value={backtest.annualizedReturn != null ? fmtPct(backtest.annualizedReturn) : "—"}
                accent={backtest.annualizedReturn != null && backtest.annualizedReturn >= 0 ? "#22c55e" : "#ef4444"}
              />
              <StatBox
                label="Max Drawdown"
                value={backtest.maxDrawdown != null ? `-${backtest.maxDrawdown.toFixed(2)}%` : "—"}
                accent="#ef4444"
              />
              <StatBox
                label="Sharpe Ratio"
                value={backtest.sharpeRatio != null ? fmtNum(backtest.sharpeRatio) : "—"}
                accent={backtest.sharpeRatio != null && backtest.sharpeRatio > 1 ? "#22c55e" : backtest.sharpeRatio != null && backtest.sharpeRatio > 0 ? "#f59e0b" : "#ef4444"}
              />
              <StatBox
                label="Sortino Ratio"
                value={(backtest as any).sortinoRatio != null ? fmtNum((backtest as any).sortinoRatio) : "—"}
                accent={(backtest as any).sortinoRatio != null && (backtest as any).sortinoRatio > 1 ? "#22c55e" : (backtest as any).sortinoRatio != null && (backtest as any).sortinoRatio > 0 ? "#f59e0b" : "#ef4444"}
              />
              <StatBox
                label="Calmar Ratio"
                value={(backtest as any).calmarRatio != null ? fmtNum((backtest as any).calmarRatio) : "—"}
                accent={(backtest as any).calmarRatio != null && (backtest as any).calmarRatio > 1 ? "#22c55e" : (backtest as any).calmarRatio != null && (backtest as any).calmarRatio > 0 ? "#f59e0b" : "#ef4444"}
              />
              <StatBox
                label="Benchmark (B&H)"
                value={(backtest as any).benchmarkReturn != null ? fmtPct((backtest as any).benchmarkReturn) : "—"}
                accent={(backtest as any).benchmarkReturn != null && (backtest as any).benchmarkReturn >= 0 ? "#6366f1" : "#ef4444"}
              />
              {(backtest as any).benchmarkReturn != null && backtest.totalReturn != null && (
                <StatBox
                  label="Alpha vs B&H"
                  value={fmtPct(backtest.totalReturn - (backtest as any).benchmarkReturn)}
                  accent={backtest.totalReturn - (backtest as any).benchmarkReturn >= 0 ? "#22c55e" : "#ef4444"}
                />
              )}
              <StatBox
                label="Win Rate"
                value={backtest.winRate != null ? `${backtest.winRate.toFixed(1)}%` : "—"}
                accent={backtest.winRate != null && backtest.winRate >= 50 ? "#22c55e" : "#f59e0b"}
              />
              <StatBox label="Total Trades" value={backtest.totalTrades ?? "—"} />
              <StatBox
                label="Profit Factor"
                value={backtest.profitFactor != null ? fmtNum(backtest.profitFactor) : "—"}
                accent={backtest.profitFactor != null && backtest.profitFactor > 1 ? "#22c55e" : "#ef4444"}
              />
              {((backtest as any).consecutiveWins ?? 0) > 0 && (
                <StatBox label="Max Consec. Wins" value={(backtest as any).consecutiveWins} sub="in a row" accent="#22c55e" />
              )}
              {((backtest as any).consecutiveLosses ?? 0) > 0 && (
                <StatBox label="Max Consec. Losses" value={(backtest as any).consecutiveLosses} sub="in a row" accent="#ef4444" />
              )}
              {((backtest as any).commission ?? 0) > 0 && (
                <StatBox
                  label="Commission"
                  value={`${(backtest as any).commission}%`}
                  sub="per side"
                />
              )}
              {((backtest as any).slippage ?? 0) > 0 && (
                <StatBox
                  label="Slippage"
                  value={`${(backtest as any).slippage}%`}
                  sub="per side"
                />
              )}
            </div>

            {/* Equity curve */}
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle>Equity Curve</CardTitle>
                <CardDescription>Portfolio value over time with drawdown overlay</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingEquity ? (
                  <Skeleton className="h-[380px] w-full" />
                ) : equityCurve && equityCurve.length > 0 ? (
                  <div className="h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={equityCurve} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorDD" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickFormatter={(v) => format(new Date(v), "MMM d")}
                          minTickGap={50}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                          domain={["auto", "auto"]}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#ef4444"
                          fontSize={11}
                          tickFormatter={(v) => `${v.toFixed(0)}%`}
                        />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.5rem" }}
                          labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                          formatter={(value: number, name: string) => {
                            if (name === "Strategy" || name === "value") return [fmtUSD(value), "Equity"];
                            if (name === "Buy & Hold" || name === "benchmark") return [fmtUSD(value), "Buy & Hold"];
                            return [`${value.toFixed(2)}%`, "Drawdown"];
                          }}
                        />
                        <Area yAxisId="left" type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorValue)" strokeWidth={1.5} name="Strategy" />
                        <Line yAxisId="left" type="monotone" dataKey="benchmark" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Buy & Hold" />
                        <Area yAxisId="right" type="monotone" dataKey="drawdown" stroke="#ef4444" fill="url(#colorDD)" fillOpacity={0.5} strokeWidth={1} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[380px] flex items-center justify-center text-muted-foreground border border-dashed rounded-md">
                    No equity data available.
                  </div>
                )}
              </CardContent>
            </Card>
          </Tabs.Content>

          {/* ── TAB 2: Analytics ────────────────────────────────────── */}
          <Tabs.Content value="analytics" className="space-y-6 tab-transition">
            {!analytics ? (
              <div className="py-16 text-center text-muted-foreground">Not enough trade data to compute analytics.</div>
            ) : (
              <>
                {/* Row 1: Win Rate gauge + R/R bars */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Win Rate gauge card */}
                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Win / Loss Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-6">
                        <WinRateGauge pct={analytics.winRate} />
                        <div className="space-y-3 flex-1">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Winners</span>
                            <span className="font-mono font-semibold text-green-500">{analytics.totalWinners}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${analytics.winRate}%` }} />
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Losers</span>
                            <span className="font-mono font-semibold text-red-500">{analytics.totalLosers}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${100 - analytics.winRate}%` }} />
                          </div>
                          <div className="pt-1 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Gross profit</span>
                              <span className="font-mono text-green-500">{fmtUSD(analytics.grossProfit)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Gross loss</span>
                              <span className="font-mono text-red-500">−{fmtUSD(analytics.grossLoss)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* R/R analytics */}
                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Risk / Reward Analytics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 rounded-xl bg-muted/30">
                          <div className="text-2xl font-bold font-mono text-primary">{fmtNum(analytics.avgRR)}</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Avg R/R</div>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-green-500/10">
                          <div className="text-2xl font-bold font-mono text-green-500">+{fmtNum(analytics.avgWin)}%</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Avg Win</div>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-red-500/10">
                          <div className="text-2xl font-bold font-mono text-red-500">−{fmtNum(analytics.avgLoss)}%</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Avg Loss</div>
                        </div>
                      </div>
                      {/* Bar comparison */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="w-16 text-xs text-muted-foreground">Avg Win</span>
                          <div className="flex-1 h-5 rounded overflow-hidden bg-muted">
                            <div
                              className="h-full rounded flex items-center justify-end pr-2"
                              style={{ width: `${Math.min((analytics.avgWin / Math.max(analytics.avgWin, analytics.avgLoss)) * 100, 100)}%`, background: "#22c55e" }}
                            >
                              <span className="text-[9px] font-mono text-white">{fmtNum(analytics.avgWin)}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="w-16 text-xs text-muted-foreground">Avg Loss</span>
                          <div className="flex-1 h-5 rounded overflow-hidden bg-muted">
                            <div
                              className="h-full rounded flex items-center justify-end pr-2"
                              style={{ width: `${Math.min((analytics.avgLoss / Math.max(analytics.avgWin, analytics.avgLoss)) * 100, 100)}%`, background: "#ef4444" }}
                            >
                              <span className="text-[9px] font-mono text-white">{fmtNum(analytics.avgLoss)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="p-2.5 rounded-lg bg-muted/30 text-center">
                          <div className="text-base font-bold font-mono text-green-500">+{fmtNum(analytics.bestTrade)}%</div>
                          <div className="text-[10px] text-muted-foreground">Best Trade</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-muted/30 text-center">
                          <div className="text-base font-bold font-mono text-red-500">{fmtNum(analytics.worstTrade)}%</div>
                          <div className="text-[10px] text-muted-foreground">Worst Trade</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Row 2: Streaks + duration */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatBox
                    label="Max Consec. Wins"
                    value={analytics.maxWins}
                    sub="in a row"
                    accent="#22c55e"
                  />
                  <StatBox
                    label="Max Consec. Losses"
                    value={analytics.maxLosses}
                    sub="in a row"
                    accent="#ef4444"
                  />
                  <StatBox
                    label="Avg Hold Duration"
                    value={`${analytics.avgDuration.toFixed(1)}d`}
                    sub="per trade"
                  />
                  <StatBox
                    label="Total Trades"
                    value={trades?.length ?? 0}
                    sub={`${analytics.totalWinners}W / ${analytics.totalLosers}L`}
                  />
                </div>

                {/* ── Yearly Calendar Heatmap ─────────────────────────── */}
                {(backtest as any).yearlyReturns && (backtest as any).yearlyReturns.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Return Calendar</CardTitle>
                      <CardDescription>Monthly PnL as % of initial capital, grouped by year</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <div className="space-y-3 min-w-[560px]">
                        {/* Month header */}
                        <div className="flex gap-1 items-center">
                          <div className="w-12 flex-shrink-0" />
                          {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m) => (
                            <div key={m} className="flex-1 text-center text-[10px] text-muted-foreground font-medium">{m}</div>
                          ))}
                          <div className="w-16 flex-shrink-0 text-right text-[10px] text-muted-foreground font-medium">Total</div>
                        </div>
                        {((backtest as any).yearlyReturns as Array<{ year: string; pct: number; months: Array<{ month: string; pct: number; label: string }> }>).map((yr) => {
                          const maxAbs = Math.max(...yr.months.map((m) => Math.abs(m.pct)), 0.1);
                          return (
                            <div key={yr.year} className="flex gap-1 items-center">
                              <div className="w-12 flex-shrink-0 text-xs font-mono text-muted-foreground">{yr.year}</div>
                              {yr.months.map((m) => {
                                const intensity = Math.min(Math.abs(m.pct) / maxAbs, 1);
                                const bg = m.pct === 0
                                  ? "rgba(255,255,255,0.04)"
                                  : m.pct > 0
                                  ? `rgba(34,197,94,${0.1 + intensity * 0.7})`
                                  : `rgba(239,68,68,${0.1 + intensity * 0.7})`;
                                const color = m.pct === 0 ? "rgba(255,255,255,0.25)" : m.pct > 0 ? "#86efac" : "#fca5a5";
                                return (
                                  <div
                                    key={m.month}
                                    className="flex-1 h-8 rounded flex items-center justify-center cursor-default transition-transform hover:scale-110 hover:z-10 relative"
                                    style={{ background: bg }}
                                    title={`${m.label} ${yr.year}: ${m.pct >= 0 ? "+" : ""}${m.pct.toFixed(2)}%`}
                                  >
                                    <span className="text-[9px] font-mono font-medium" style={{ color }}>
                                      {m.pct === 0 ? "—" : `${m.pct >= 0 ? "+" : ""}${m.pct.toFixed(1)}%`}
                                    </span>
                                  </div>
                                );
                              })}
                              <div
                                className={`w-16 flex-shrink-0 text-right text-xs font-mono font-bold ${yr.pct >= 0 ? "text-green-400" : "text-red-400"}`}
                              >
                                {yr.pct >= 0 ? "+" : ""}{yr.pct.toFixed(1)}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Monthly returns bar chart */}
                {analytics.monthlyReturns.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Monthly Returns</CardTitle>
                      <CardDescription>PnL as % of initial capital per month</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.monthlyReturns} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                            <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v.toFixed(1)}%`} />
                            <ReferenceLine yAxisId={undefined} y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                            <RechartsTooltip
                              contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.5rem" }}
                              formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, "Return"]}
                            />
                            <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                              {analytics.monthlyReturns.map((entry, i) => (
                                <Cell key={i} fill={entry.pct >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.8} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── Parameter Optimization Heatmap ────────────────── */}
                <ParameterOptHeatmap
                  strategyId={backtest.strategyId}
                  symbol={backtest.symbol}
                  startDate={backtest.startDate}
                  endDate={backtest.endDate}
                  initialCapital={backtest.initialCapital}
                />

                {/* Trade distribution histogram */}
                {analytics.distribution.length > 0 && (
                  <Card className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Return Distribution</CardTitle>
                      <CardDescription>Number of trades per return bucket (2% bins)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.distribution} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="range" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                            <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                            <RechartsTooltip
                              contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.5rem" }}
                              formatter={(v: number) => [v, "Trades"]}
                            />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                              {analytics.distribution.map((entry, i) => (
                                <Cell key={i} fill={entry.positive ? "#22c55e" : "#ef4444"} fillOpacity={0.75} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </Tabs.Content>

          {/* ── TAB 3: Trade Journal ─────────────────────────────────── */}
          <Tabs.Content value="journal" className="space-y-4 tab-transition">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex gap-2 items-center flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-8 text-sm w-52"
                    placeholder="Search trades…"
                    value={tradeSearch}
                    onChange={(e) => setTradeSearch(e.target.value)}
                  />
                </div>
                {(["all", "wins", "losses"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setTradeFilter(f)}
                    className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                    style={
                      tradeFilter === f
                        ? { background: f === "wins" ? "#22c55e20" : f === "losses" ? "#ef444420" : "hsl(var(--primary)/0.15)", color: f === "wins" ? "#22c55e" : f === "losses" ? "#ef4444" : "hsl(var(--primary))", borderColor: f === "wins" ? "#22c55e50" : f === "losses" ? "#ef444450" : "hsl(var(--primary)/0.3)" }
                        : { color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                    }
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {trades && (
                      <span className="ml-1.5 opacity-60">
                        {f === "all" ? trades.length : f === "wins" ? trades.filter((t) => t.pnl > 0).length : trades.filter((t) => t.pnl <= 0).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={!trades?.length}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>

            {isLoadingTrades ? (
              <Skeleton className="h-[400px] w-full" />
            ) : filteredTrades.length > 0 ? (
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8" />
                      <TableHead>Side</TableHead>
                      <TableHead onClick={() => toggleSort("entryDate")} className="cursor-pointer select-none">
                        Entry Date <SortIcon k="entryDate" />
                      </TableHead>
                      <TableHead onClick={() => toggleSort("entryPrice")} className="text-right cursor-pointer select-none">
                        Entry <SortIcon k="entryPrice" />
                      </TableHead>
                      <TableHead onClick={() => toggleSort("exitDate")} className="cursor-pointer select-none">
                        Exit Date <SortIcon k="exitDate" />
                      </TableHead>
                      <TableHead onClick={() => toggleSort("exitPrice")} className="text-right cursor-pointer select-none">
                        Exit <SortIcon k="exitPrice" />
                      </TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                      <TableHead onClick={() => toggleSort("pnl")} className="text-right cursor-pointer select-none">
                        P&L <SortIcon k="pnl" />
                      </TableHead>
                      <TableHead onClick={() => toggleSort("pnlPercent")} className="text-right cursor-pointer select-none">
                        % <SortIcon k="pnlPercent" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTrades.map((trade) => {
                      const dur = differenceInDays(new Date(trade.exitDate), new Date(trade.entryDate));
                      const isWin = trade.pnl > 0;
                      const isExpanded = expandedTrade === trade.id;
                      const noteKey = `trade_note_${id}_${trade.id}`;
                      const hasNote = !!localStorage.getItem(noteKey);

                      return (
                        <React.Fragment key={trade.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/30"
                            onClick={() => setExpandedTrade(isExpanded ? null : trade.id)}
                            style={{ borderLeft: `3px solid ${isWin ? "#22c55e50" : "#ef444450"}` }}
                          >
                            <TableCell className="w-8 text-center">
                              {isExpanded
                                ? <ChevronUp className="h-3 w-3 text-muted-foreground mx-auto" />
                                : <ChevronDown className="h-3 w-3 text-muted-foreground mx-auto" />}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${isWin ? "border-green-500/30 text-green-500 bg-green-500/10" : "border-red-500/30 text-red-500 bg-red-500/10"}`}
                              >
                                {trade.side.toUpperCase()}
                              </Badge>
                              {hasNote && <StickyNote className="inline ml-1.5 h-3 w-3 text-yellow-500" />}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{format(new Date(trade.entryDate), "MMM d, yyyy")}</TableCell>
                            <TableCell className="text-right font-mono text-sm">${trade.entryPrice.toFixed(2)}</TableCell>
                            <TableCell className="font-mono text-xs">{format(new Date(trade.exitDate), "MMM d, yyyy")}</TableCell>
                            <TableCell className="text-right font-mono text-sm">${trade.exitPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{dur}d</TableCell>
                            <TableCell className={`text-right font-mono font-medium ${isWin ? "text-green-500" : "text-red-500"}`}>
                              {isWin ? "+" : ""}${trade.pnl.toFixed(2)}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-medium ${isWin ? "text-green-500" : "text-red-500"}`}>
                              {isWin ? "+" : ""}{trade.pnlPercent.toFixed(2)}%
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={9} className="p-0">
                                <div className="px-4 pb-4 pt-2 bg-muted/20">
                                  <div className="grid grid-cols-3 gap-3 mb-3">
                                    <div className="p-3 rounded-lg bg-background border border-border">
                                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Quantity</div>
                                      <div className="font-mono text-sm font-semibold mt-0.5">{trade.quantity.toFixed(4)}</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-background border border-border">
                                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Hold Time</div>
                                      <div className="font-mono text-sm font-semibold mt-0.5">{dur} days</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-background border border-border">
                                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Price Move</div>
                                      <div className={`font-mono text-sm font-semibold mt-0.5 ${isWin ? "text-green-500" : "text-red-500"}`}>
                                        {isWin ? "+" : ""}{(((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100).toFixed(2)}%
                                      </div>
                                    </div>
                                  </div>
                                  <TradeNote tradeId={trade.id} backtestId={id} />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
                {tradeSearch || tradeFilter !== "all" ? "No trades match the current filter." : "No trades executed during this period."}
              </div>
            )}
          </Tabs.Content>
        </Tabs.Root>
      )}
    </motion.div>
  );
}
