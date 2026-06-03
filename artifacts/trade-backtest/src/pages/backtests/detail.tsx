import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
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
  Share2, Globe, Check, TrendingDown, Activity, Layers, Loader2, CalendarDays,
  Brain, Sparkles, Waves, MonitorDot, Plus, Trash, Users2, Medal, Info,
} from "lucide-react";
import { computeOverfittingScore, overfitRating } from "@/lib/overfitting";
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
  label, value, sub, valueClass = "font-mono", accent, tooltip
}: {
  label: string; value: React.ReactNode; sub?: string; valueClass?: string; accent?: string; tooltip?: string;
}) {
  return (
    <div
      className="neon-hover-subtle relative p-4 rounded-xl border border-border flex flex-col gap-1 bg-card"
      style={accent ? { borderColor: `${accent}30`, background: `${accent}08` } : {}}
    >
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-[1px] rounded-t-xl" style={{ background: `linear-gradient(90deg, transparent, ${accent}60, transparent)` }} />
      )}
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        {label}
        {tooltip && (
          <span className="relative group/tip inline-flex items-center">
            <Info style={{ height: "10px", width: "10px", opacity: 0.5, cursor: "help", flexShrink: 0 }} />
            <span
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg px-2.5 py-2 text-[11px] leading-snug opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50 normal-case tracking-normal"
              style={{ background: "#1e1e1e", color: "#e5e5e5", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}
            >
              {tooltip}
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent" style={{ borderTopColor: "#1e1e1e" }} />
            </span>
          </span>
        )}
      </span>
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("tt_token");
    if (!token) return;
    fetch(`/api/backtests/${backtestId}/journal/${tradeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { note?: string; tags?: string[]; session?: string; emotionPre?: string; emotionPost?: string; confidence?: number; mistakes?: string[] } | null) => {
        if (!data) return;
        if (data.note !== undefined) { setNote(data.note); localStorage.setItem(key, data.note); }
        if (data.tags !== undefined) { setTags(data.tags); localStorage.setItem(key + "_tags", JSON.stringify(data.tags)); }
        if (data.session !== undefined) { setSession(data.session); localStorage.setItem(key + "_session", data.session); }
        if (data.emotionPre !== undefined) { setEmotionPre(data.emotionPre); localStorage.setItem(key + "_emotion_pre", data.emotionPre); }
        if (data.emotionPost !== undefined) { setEmotionPost(data.emotionPost); localStorage.setItem(key + "_emotion_post", data.emotionPost); }
        if (data.confidence !== undefined) { setConfidence(data.confidence); localStorage.setItem(key + "_confidence", String(data.confidence)); }
        if (data.mistakes !== undefined) { setMistakes(data.mistakes); localStorage.setItem(key + "_mistakes", JSON.stringify(data.mistakes)); }
      })
      .catch(() => {});
  }, [backtestId, tradeId, key]);

  function persist<T>(suffix: string, value: T) {
    localStorage.setItem(key + suffix, typeof value === "string" ? value : JSON.stringify(value));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const token = localStorage.getItem("tt_token");
      if (!token) return;
      fetch(`/api/backtests/${backtestId}/journal/${tradeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          note: localStorage.getItem(key) ?? "",
          tags: (() => { try { return JSON.parse(localStorage.getItem(key + "_tags") ?? "[]"); } catch { return []; } })(),
          session: localStorage.getItem(key + "_session") ?? "",
          emotionPre: localStorage.getItem(key + "_emotion_pre") ?? "",
          emotionPost: localStorage.getItem(key + "_emotion_post") ?? "",
          confidence: parseInt(localStorage.getItem(key + "_confidence") ?? "0"),
          mistakes: (() => { try { return JSON.parse(localStorage.getItem(key + "_mistakes") ?? "[]"); } catch { return []; } })(),
        }),
      }).catch(() => {});
    }, 1500);
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

// ─── Peer Ranking Tab ────────────────────────────────────────────────────────

type PercentileData = {
  backtestId: number;
  symbol: string;
  strategyType: string;
  peerCount: number;
  metrics: {
    sharpe:   { yours: number | null; peerAvg: number; percentile: number | null };
    drawdown: { yours: number | null; peerAvg: number; percentile: number | null };
    winRate:  { yours: number | null; peerAvg: number; percentile: number | null };
    return:   { yours: number | null; peerAvg: number; percentile: number | null };
  };
  overallPercentile: number | null;
};

function PercentileBar({ label, yours, peerAvg, percentile, format, higherIsBetter, color }: {
  label: string;
  yours: number | null;
  peerAvg: number;
  percentile: number | null;
  format: (v: number) => string;
  higherIsBetter: boolean;
  color?: string;
}) {
  const pct = percentile ?? 0;
  const barColor = percentile === null ? "#555"
    : higherIsBetter
      ? pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444"
      : pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

  const badge = percentile === null ? "—"
    : pct >= 90 ? "Top 10%" : pct >= 75 ? "Top 25%" : pct >= 50 ? "Above Avg" : pct >= 25 ? "Below Avg" : "Bottom 25%";

  return (
    <div className="p-4 rounded-2xl space-y-3" style={{ background: "hsl(222,20%,11%)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "hsl(220,14%,70%)" }}>{label}</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full font-mono"
          style={{ background: `${barColor}20`, color: barColor, border: `1px solid ${barColor}40` }}>
          {badge}
        </span>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,14%,38%)" }}>Yours</p>
          <p className="text-xl font-bold" style={{ color: barColor }}>{yours !== null ? format(yours) : "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,14%,38%)" }}>Peer Avg</p>
          <p className="text-sm font-medium" style={{ color: "hsl(220,14%,55%)" }}>{format(peerAvg)}</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] font-mono mb-1.5" style={{ color: "hsl(220,14%,35%)" }}>
          <span>0th</span>
          <span className="font-semibold" style={{ color: barColor }}>{percentile !== null ? `${percentile}th` : "—"}</span>
          <span>100th</span>
        </div>
        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${barColor}80, ${barColor})` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 transition-all duration-700"
            style={{ left: `calc(${pct}% - 5px)`, background: "#fff", borderColor: barColor }}
          />
        </div>
      </div>
    </div>
  );
}

function PeerRankingTab({ backtestId }: { backtestId: number }) {
  const [data, setData] = React.useState<PercentileData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/backtests/${backtestId}/percentile`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError("Failed to load peer data."))
      .finally(() => setLoading(false));
  }, [backtestId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#6366f1" }} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="py-16 text-center" style={{ color: "hsl(220,14%,45%)" }}>
        <Users2 className="h-10 w-10 mx-auto mb-3" style={{ color: "hsl(220,14%,25%)" }} />
        <p>{error ?? "No peer data available."}</p>
      </div>
    );
  }

  const overallColor = data.overallPercentile === null ? "#888"
    : data.overallPercentile >= 75 ? "#22c55e"
    : data.overallPercentile >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-6">
      {/* Hero percentile */}
      <Card style={{ background: "hsl(222,20%,10%)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                className="h-28 w-28 rounded-full flex flex-col items-center justify-center"
                style={{
                  background: `conic-gradient(${overallColor} ${(data.overallPercentile ?? 0) * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
                  boxShadow: `0 0 32px ${overallColor}40`,
                }}
              >
                <div className="h-20 w-20 rounded-full flex flex-col items-center justify-center" style={{ background: "hsl(222,20%,10%)" }}>
                  <Medal className="h-5 w-5 mb-0.5" style={{ color: overallColor }} />
                  <span className="text-2xl font-bold" style={{ color: overallColor }}>
                    {data.overallPercentile !== null ? `${data.overallPercentile}` : "—"}
                  </span>
                  <span className="text-[9px] font-mono uppercase" style={{ color: "hsl(220,14%,40%)" }}>th pct</span>
                </div>
              </div>
              <p className="text-xs font-medium" style={{ color: "hsl(220,14%,55%)" }}>Overall Rank</p>
            </div>

            <div className="flex-1 space-y-2">
              <h3 className="text-base font-semibold" style={{ color: "hsl(220,14%,85%)" }}>
                {data.overallPercentile !== null && data.overallPercentile >= 75
                  ? "🏆 Outperforming the crowd"
                  : data.overallPercentile !== null && data.overallPercentile >= 50
                  ? "📈 Above average performance"
                  : "📊 Room to improve"}
              </h3>
              <p className="text-sm" style={{ color: "hsl(220,14%,50%)" }}>
                Compared against <strong style={{ color: "hsl(220,14%,70%)" }}>{data.peerCount}</strong> backtests
                running <strong style={{ color: "hsl(220,14%,70%)" }}>{data.strategyType.replace(/_/g, " ").toUpperCase()}</strong> strategies
                on <strong style={{ color: "hsl(220,14%,70%)" }}>{data.symbol}</strong>.
                Metrics are anonymized aggregates — no individual data is exposed.
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <Users2 className="h-3.5 w-3.5" style={{ color: "hsl(220,14%,40%)" }} />
                <span className="text-[11px]" style={{ color: "hsl(220,14%,40%)" }}>{data.peerCount} peers in cohort</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PercentileBar
          label="Sharpe Ratio"
          yours={data.metrics.sharpe.yours}
          peerAvg={data.metrics.sharpe.peerAvg}
          percentile={data.metrics.sharpe.percentile}
          format={v => v.toFixed(2)}
          higherIsBetter={true}
        />
        <PercentileBar
          label="Win Rate"
          yours={data.metrics.winRate.yours}
          peerAvg={data.metrics.winRate.peerAvg}
          percentile={data.metrics.winRate.percentile}
          format={v => `${v.toFixed(1)}%`}
          higherIsBetter={true}
        />
        <PercentileBar
          label="Max Drawdown (lower = better)"
          yours={data.metrics.drawdown.yours}
          peerAvg={data.metrics.drawdown.peerAvg}
          percentile={data.metrics.drawdown.percentile}
          format={v => `-${v.toFixed(2)}%`}
          higherIsBetter={false}
        />
        <PercentileBar
          label="Total Return"
          yours={data.metrics.return.yours}
          peerAvg={data.metrics.return.peerAvg}
          percentile={data.metrics.return.percentile}
          format={v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
          higherIsBetter={true}
        />
      </div>

      <p className="text-[11px] text-center" style={{ color: "hsl(220,14%,30%)" }}>
        Percentile ranks are updated live. The cohort grows as more users run similar strategies.
      </p>
    </div>
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
  const [autopsyText, setAutopsyText] = useState<string | null>(null);
  const [autopsyError, setAutopsyError] = useState<string | null>(null);
  const [isLoadingAutopsy, setIsLoadingAutopsy] = useState(false);

  const [narrativeText, setNarrativeText] = useState<string | null>(null);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const [isLoadingNarrative, setIsLoadingNarrative] = useState(false);

  type EventImpact = {
    id: string; name: string; type: string; date: string;
    windowDays: number; description: string;
    tradesInWindow: number; winsInWindow: number;
    winRateInWindow: number | null; avgPnlInWindow: number | null;
    trades: Array<{ entryDate: string; exitDate: string; side: string; pnlPercent: number; pnl: number }>;
  };
  type EventSummary = { totalEvents: number; activeEvents: number; tradesInEvents: number; tradesOutEvents: number; winRateInEvents: number | null; winRateOutEvents: number | null };
  const [eventData, setEventData] = useState<{ events: EventImpact[]; summary: EventSummary } | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

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

  const overfittingScore = useMemo(() => {
    if (!trades || trades.length < 5) return null;
    return computeOverfittingScore(trades.map(t => ({ pnl: t.pnl, pnlPercent: t.pnlPercent })));
  }, [trades]);

  async function handleGenerateAutopsy() {
    if (!backtest || !trades?.length) return;
    setIsLoadingAutopsy(true);
    setAutopsyError(null);
    setAutopsyText(null);
    try {
      const resp = await fetch("/api/ai/autopsy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("tt_token") ?? ""}`,
        },
        body: JSON.stringify({
          symbol: backtest.symbol,
          strategyName: (backtest as any).strategyName ?? "Unknown Strategy",
          metrics: {
            totalReturn: backtest.totalReturn ?? 0,
            maxDrawdown: backtest.maxDrawdown ?? 0,
            sharpeRatio: backtest.sharpeRatio ?? 0,
            winRate: backtest.winRate ?? 0,
            totalTrades: backtest.totalTrades ?? 0,
            bestTrade: (backtest as any).bestTrade ?? 0,
            worstTrade: (backtest as any).worstTrade ?? 0,
            profitFactor: backtest.profitFactor ?? 0,
            avgTradeDuration: (backtest as any).avgTradeDuration ?? 0,
          },
          trades: trades.slice(0, 50).map(t => ({
            side: t.side,
            entryDate: t.entryDate,
            exitDate: t.exitDate,
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            pnl: t.pnl,
            pnlPercent: t.pnlPercent,
          })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Failed to generate autopsy");
      setAutopsyText(data.narrative);
    } catch (e: unknown) {
      setAutopsyError(e instanceof Error ? e.message : "Failed to generate autopsy");
    } finally {
      setIsLoadingAutopsy(false);
    }
  }

  async function handleGenerateNarrative() {
    if (!backtest || !trades?.length) return;
    setIsLoadingNarrative(true);
    setNarrativeError(null);
    setNarrativeText(null);
    try {
      // Detect drawdown periods from equity curve
      const equityPeaks: Array<{ peakDate: string; troughDate: string; drawdownPct: number; recoveryDays: number | null }> = [];
      if (equityCurve?.length) {
        let peakVal = equityCurve[0]?.value ?? 0;
        let peakDate = equityCurve[0]?.date ?? "";
        let troughVal = peakVal;
        let troughDate = peakDate;
        for (const pt of equityCurve) {
          const eq = pt.value;
          if (eq > peakVal) {
            if (peakVal > 0 && troughVal < peakVal) {
              const dd = ((peakVal - troughVal) / peakVal) * 100;
              if (dd > 5) {
                const recoveryDays = null;
                equityPeaks.push({ peakDate, troughDate, drawdownPct: dd, recoveryDays });
              }
            }
            peakVal = eq; peakDate = pt.date as string; troughVal = eq; troughDate = pt.date as string;
          } else if (eq < troughVal) {
            troughVal = eq; troughDate = pt.date as string;
          }
        }
      }

      const resp = await fetch("/api/ai/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("tt_token") ?? ""}` },
        body: JSON.stringify({
          symbol: backtest.symbol,
          strategyName: (backtest as any).strategyName ?? "Unknown Strategy",
          strategyType: (backtest as any).strategyType ?? "unknown",
          startDate: backtest.startDate,
          endDate: backtest.endDate,
          metrics: {
            totalReturn: backtest.totalReturn ?? 0,
            annualizedReturn: (backtest as any).annualizedReturn ?? 0,
            maxDrawdown: backtest.maxDrawdown ?? 0,
            sharpeRatio: backtest.sharpeRatio ?? 0,
            winRate: backtest.winRate ?? 0,
            totalTrades: backtest.totalTrades ?? 0,
            profitFactor: backtest.profitFactor ?? 0,
            initialCapital: (backtest as any).initialCapital ?? 10000,
            finalCapital: ((backtest as any).initialCapital ?? 10000) * (1 + (backtest.totalReturn ?? 0) / 100),
          },
          trades: trades.slice(0, 60).map(t => ({
            side: t.side, entryDate: t.entryDate, exitDate: t.exitDate,
            entryPrice: t.entryPrice, exitPrice: t.exitPrice, pnl: t.pnl, pnlPercent: t.pnlPercent,
            holdingDays: Math.max(1, differenceInDays(new Date(t.exitDate), new Date(t.entryDate))),
          })),
          equityPeaks: equityPeaks.slice(0, 4),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Failed to generate narrative");
      setNarrativeText(data.story);
    } catch (e: unknown) {
      setNarrativeError(e instanceof Error ? e.message : "Failed to generate narrative");
    } finally {
      setIsLoadingNarrative(false);
    }
  }

  async function handleLoadEventImpact() {
    if (!id) return;
    setIsLoadingEvents(true);
    setEventError(null);
    try {
      const resp = await fetch(`/api/backtests/${id}/event-impact`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Failed to load event data");
      setEventData(data);
    } catch (e: unknown) {
      setEventError(e instanceof Error ? e.message : "Failed to load event data");
    } finally {
      setIsLoadingEvents(false);
    }
  }

  // ─── Compute Analytics ─────────────────────────────────────────────────────

  const analytics = useMemo(() => {
    if (!trades || !trades.length || !backtest) return null;

    const winners = trades.filter((t) => t.pnl > 0);
    const losers = trades.filter((t) => t.pnl <= 0);
    const winRate = (winners.length / trades.length) * 100;
    const avgWin = winners.length ? winners.reduce((a, t) => a + t.pnlPercent, 0) / winners.length : 0;
    const avgLoss = losers.length ? Math.abs(losers.reduce((a, t) => a + t.pnlPercent, 0) / losers.length) : 0;
    const avgRR = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

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
    // Use running capital as denominator (HIGH-009 fix): correct compounding math
    let runningCap = backtest.initialCapital;
    const monthlyReturns = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, pnl]) => {
        const pct = runningCap > 0 ? (pnl / runningCap) * 100 : 0;
        runningCap += pnl;
        return {
          month,
          label: format(new Date(month + "-01"), "MMM yy"),
          pnl,
          pct,
        };
      });

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
          <Tabs.List className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border mb-6 overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: "touch" }}>
            {[
              { value: "overview", label: "Overview", Icon: LayoutDashboard },
              { value: "analytics", label: "Analytics", Icon: BarChart3 },
              { value: "peers",    label: "Peer Ranking", Icon: Users2 },
              { value: "journal",  label: "Trade Journal", Icon: BookOpen },
              { value: "calendar", label: "P&L Calendar", Icon: CalendarDays },
              { value: "autopsy",  label: "AI Autopsy",     Icon: Brain },
              { value: "narrative",label: "Story Mode",      Icon: Sparkles },
              { value: "events",   label: "Event Impact",    Icon: Activity },
              { value: "regime",   label: "Regime Analysis", Icon: Waves },
              { value: "live",     label: "Live Monitor",    Icon: MonitorDot },
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
            {/* Simulated data warning */}
            {(backtest as any).dataSource === "simulated" && /USDT$/i.test(backtest.symbol) && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
                style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.25)" }}>
                <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: "hsl(38,95%,58%)" }} />
                <p className="text-xs" style={{ color: "hsl(38,95%,70%)" }}>
                  Could not fetch live market data for <strong>{backtest.symbol}</strong> — results are based on <strong>simulated price data</strong> and may not reflect actual market conditions.
                </p>
              </div>
            )}
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
                tooltip="Excess return above a 4% risk-free rate per unit of total volatility (sample std). Computed over all calendar days including days out of market. Figures reflect simulated price data — not real market conditions."
              />
              <StatBox
                label="Sortino Ratio"
                value={(backtest as any).sortinoRatio != null ? fmtNum((backtest as any).sortinoRatio) : "—"}
                accent={(backtest as any).sortinoRatio != null && (backtest as any).sortinoRatio > 1 ? "#22c55e" : (backtest as any).sortinoRatio != null && (backtest as any).sortinoRatio > 0 ? "#f59e0b" : "#ef4444"}
                tooltip="Like the Sharpe Ratio, but only penalises downside volatility (losses). A higher Sortino than Sharpe means your losses are smoother than your gains."
              />
              <StatBox
                label="Calmar Ratio"
                value={(backtest as any).calmarRatio != null ? ((backtest as any).calmarRatio >= 999 ? "∞" : fmtNum((backtest as any).calmarRatio)) : "—"}
                accent={(backtest as any).calmarRatio != null && (backtest as any).calmarRatio > 1 ? "#22c55e" : (backtest as any).calmarRatio != null && (backtest as any).calmarRatio > 0 ? "#f59e0b" : "#ef4444"}
                tooltip="Annualised return divided by maximum drawdown. Measures how much return you get per unit of peak-to-trough loss. Above 1.0 is solid."
              />
              <StatBox
                label={(backtest as any).dataSource === "simulated" ? "Benchmark B&H (sim.)" : "Benchmark (B&H)"}
                value={(backtest as any).benchmarkReturn != null ? fmtPct((backtest as any).benchmarkReturn) : "—"}
                accent={(backtest as any).benchmarkReturn != null && (backtest as any).benchmarkReturn >= 0 ? "#6366f1" : "#ef4444"}
                tooltip={(backtest as any).dataSource === "simulated"
                  ? "Buy-and-hold return over the same period using simulated price data. Compare with caution — both strategy and benchmark use generated prices."
                  : "What a simple buy-and-hold of this asset would have returned over the same period using real market data."}
              />
              {(backtest as any).benchmarkReturn != null && backtest.totalReturn != null && (
                <StatBox
                  label="Alpha vs B&H"
                  value={fmtPct(backtest.totalReturn - (backtest as any).benchmarkReturn)}
                  accent={backtest.totalReturn - (backtest as any).benchmarkReturn >= 0 ? "#22c55e" : "#ef4444"}
                  tooltip="Your strategy's total return minus the buy-and-hold benchmark. Positive alpha means your strategy outperformed simply holding the asset."
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
                value={backtest.profitFactor != null ? (backtest.profitFactor >= 999 ? "∞" : fmtNum(backtest.profitFactor)) : "—"}
                accent={backtest.profitFactor != null && backtest.profitFactor > 1 ? "#22c55e" : "#ef4444"}
                tooltip="Total gross profit divided by total gross loss. Above 1.0 means you made more than you lost overall. Above 1.5 is considered strong."
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
              {overfittingScore !== null && (() => {
                const rating = overfitRating(overfittingScore);
                return (
                  <div
                    className="rounded-xl p-4 flex flex-col gap-1"
                    style={{ background: rating.bg, border: `1px solid ${rating.color}44` }}
                  >
                    <p className="text-[11px] font-mono uppercase tracking-wide" style={{ color: rating.color, opacity: 0.85 }}>Overfit Risk</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold tabular-nums" style={{ color: rating.color }}>{overfittingScore}</span>
                      <span className="text-xs" style={{ color: rating.color, opacity: 0.65 }}>/100</span>
                    </div>
                    <p className="text-[11px] font-semibold leading-tight" style={{ color: rating.color }}>{rating.label}</p>
                    <p className="text-[10px] leading-snug text-muted-foreground mt-0.5">{rating.description}</p>
                  </div>
                );
              })()}
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
                          <div className="text-2xl font-bold font-mono text-primary">{isFinite(analytics.avgRR) ? fmtNum(analytics.avgRR) : "∞"}</div>
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

          {/* ── TAB: Peer Ranking ────────────────────────────────────── */}
          <Tabs.Content value="peers" className="tab-transition">
            <PeerRankingTab backtestId={backtest.id} />
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

          {/* ── TAB 4: P&L Calendar ──────────────────────────────────── */}
          <Tabs.Content value="calendar" className="space-y-6 tab-transition">
            <PnLCalendar trades={trades ?? []} />
          </Tabs.Content>

          {/* ── TAB 5: AI Autopsy ────────────────────────────────────── */}
          <Tabs.Content value="autopsy" className="space-y-6 tab-transition">
            <Card className="glass-card border-0">
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      AI Trade Autopsy
                    </CardTitle>
                    <CardDescription className="mt-1">
                      AI narrates why trades were taken, what market conditions drove results, and whether this strategy has a real edge.
                    </CardDescription>
                  </div>
                  {!autopsyText && (
                    <Button
                      onClick={handleGenerateAutopsy}
                      disabled={isLoadingAutopsy || !trades?.length}
                      className="gap-2 flex-shrink-0"
                    >
                      {isLoadingAutopsy ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Analyzing…</>
                      ) : (
                        <><Sparkles className="h-4 w-4" />Generate Autopsy</>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!trades?.length && (
                  <p className="text-sm text-muted-foreground">Run the backtest to completion before generating an autopsy.</p>
                )}
                {autopsyError && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{autopsyError}</p>
                  </div>
                )}
                {isLoadingAutopsy && (
                  <div className="space-y-3 animate-pulse py-2">
                    {[1, 0.92, 0.78, 0, 1, 0.85, 0.65].map((w, i) => (
                      w === 0 ? <div key={i} className="h-3" /> :
                      <div key={i} className="h-4 rounded bg-muted" style={{ width: `${w * 100}%` }} />
                    ))}
                  </div>
                )}
                {autopsyText && (
                  <>
                    <div className="space-y-4">
                      {autopsyText.split("\n\n").filter(p => p.trim()).map((para, i) => (
                        <p key={i} className="text-sm leading-relaxed text-foreground/90">
                          {para.trim()}
                        </p>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-border/40 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateAutopsy}
                        disabled={isLoadingAutopsy}
                        className="gap-2"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Regenerate
                      </Button>
                      <p className="text-[11px] text-muted-foreground">Powered by Llama 3.3 70B · Not financial advice</p>
                    </div>
                  </>
                )}
                {!autopsyText && !isLoadingAutopsy && !autopsyError && trades && trades.length > 0 && (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Brain className="h-8 w-8 text-primary/60" />
                    </div>
                    <div className="text-center max-w-sm">
                      <p className="text-sm font-medium text-foreground">Your autopsy awaits</p>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        Click "Generate Autopsy" for an AI-written narrative — what worked, what didn't, and whether this strategy has a genuine edge.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </Tabs.Content>

          {/* ── TAB: Story Mode (Narrative) ───────────────────────────── */}
          <Tabs.Content value="narrative" className="space-y-6 tab-transition">
            <Card className="glass-card border-0">
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Story Mode
                    </CardTitle>
                    <CardDescription className="mt-1">
                      AI converts your backtest into a compelling narrative — vivid chapters covering the campaign, turning points, and a sharp verdict on your strategy's edge.
                    </CardDescription>
                  </div>
                  {!narrativeText && (
                    <Button
                      onClick={handleGenerateNarrative}
                      disabled={isLoadingNarrative || !trades?.length}
                      className="gap-2 flex-shrink-0"
                    >
                      {isLoadingNarrative ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Crafting story…</>
                      ) : (
                        <><Sparkles className="h-4 w-4" />Generate Story</>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!trades?.length && (
                  <p className="text-sm text-muted-foreground">Complete the backtest before generating a story.</p>
                )}
                {narrativeError && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{narrativeError}</p>
                  </div>
                )}
                {isLoadingNarrative && (
                  <div className="space-y-3 animate-pulse py-2">
                    {[1, 0.95, 0.82, 0, 1, 0.88, 0.72, 0, 1, 0.91, 0.65, 0, 1, 0.79].map((w, i) => (
                      w === 0 ? <div key={i} className="h-3" /> :
                      <div key={i} className="h-4 rounded bg-muted" style={{ width: `${w * 100}%` }} />
                    ))}
                  </div>
                )}
                {narrativeText && (
                  <>
                    {/* Chapter-by-chapter rendering */}
                    <div className="space-y-5">
                      {narrativeText.split("\n\n").filter(p => p.trim()).map((para, i) => {
                        const chapterMatch = para.match(/^Chapter\s+\d+\s*[—–-]\s*[""]?(.+?)[""]?:/i);
                        if (chapterMatch) {
                          return (
                            <div key={i} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold"
                                  style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>
                                  {i + 1}
                                </span>
                                <span className="text-xs font-semibold tracking-wide" style={{ color: "#818cf8" }}>
                                  {para.split(":")[0].replace(/^Chapter\s*\d+\s*[—–-]\s*/i, "").replace(/["""]/g, "")}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed text-foreground/90 pl-7">
                                {para.split(":").slice(1).join(":").trim()}
                              </p>
                            </div>
                          );
                        }
                        return (
                          <p key={i} className="text-sm leading-relaxed text-foreground/90">{para.trim()}</p>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-border/40 flex-wrap">
                      <Button variant="outline" size="sm" onClick={handleGenerateNarrative} disabled={isLoadingNarrative} className="gap-2">
                        <Sparkles className="h-3.5 w-3.5" />Regenerate
                      </Button>
                      <p className="text-[11px] text-muted-foreground">Powered by Llama 3.3 70B · Not financial advice</p>
                    </div>
                  </>
                )}
                {!narrativeText && !isLoadingNarrative && !narrativeError && trades && trades.length > 0 && (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-8 w-8 text-primary/60" />
                    </div>
                    <div className="text-center max-w-sm">
                      <p className="text-sm font-medium text-foreground">Your strategy has a story</p>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        Click "Generate Story" — the AI will narrate your campaign in vivid chapters, from first entry through the final trade.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </Tabs.Content>

          {/* ── TAB: Economic Event Impact ───────────────────────────── */}
          <Tabs.Content value="events" className="space-y-6 tab-transition">
            <Card className="glass-card border-0">
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Economic Event Impact
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Shows how your trades performed during major economic events — Fed meetings, CPI prints, and market shocks — vs. ordinary market conditions.
                    </CardDescription>
                  </div>
                  {!eventData && (
                    <Button onClick={handleLoadEventImpact} disabled={isLoadingEvents} className="gap-2 flex-shrink-0">
                      {isLoadingEvents ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Loading…</>
                      ) : (
                        <><Activity className="h-4 w-4" />Analyze Events</>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {eventError && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{eventError}</p>
                  </div>
                )}
                {isLoadingEvents && (
                  <div className="space-y-2 animate-pulse py-2">
                    {[1, 0.7, 0.85, 0.6, 0.9, 0.75].map((w, i) => (
                      <div key={i} className="h-12 rounded-xl bg-muted" style={{ width: `${w * 100}%` }} />
                    ))}
                  </div>
                )}
                {eventData && (
                  <>
                    {/* Summary comparison bars */}
                    {eventData.summary.winRateInEvents !== null && eventData.summary.winRateOutEvents !== null && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { label: "During Events", value: eventData.summary.winRateInEvents, trades: eventData.summary.tradesInEvents, color: "#f59e0b" },
                          { label: "Outside Events", value: eventData.summary.winRateOutEvents, trades: eventData.summary.tradesOutEvents, color: "#34d399" },
                          { label: "Events Covered", value: null, count: eventData.summary.activeEvents, total: eventData.summary.totalEvents, color: "#818cf8" },
                        ].map(item => (
                          <div key={item.label} className="p-4 rounded-xl"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                            <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "hsl(220,14%,40%)" }}>{item.label}</p>
                            {item.value !== undefined && item.value !== null ? (
                              <>
                                <p className="text-2xl font-bold mb-1" style={{ color: item.color }}>{item.value.toFixed(1)}%</p>
                                <p className="text-[11px]" style={{ color: "hsl(220,14%,45%)" }}>win rate · {item.trades} trades</p>
                                <div className="mt-2 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                                  <div className="h-1.5 rounded-full" style={{ width: `${Math.min(item.value, 100)}%`, background: item.color }} />
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-2xl font-bold mb-1" style={{ color: item.color }}>{item.count} <span className="text-sm font-normal" style={{ color: "hsl(220,14%,45%)" }}>of {item.total}</span></p>
                                <p className="text-[11px]" style={{ color: "hsl(220,14%,45%)" }}>events had active trades</p>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Event list */}
                    {eventData.events.filter(e => e.tradesInWindow > 0).length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <Activity className="h-8 w-8" style={{ color: "hsl(220,14%,30%)" }} />
                        <p className="text-sm font-medium" style={{ color: "hsl(220,14%,50%)" }}>No event overlaps found</p>
                        <p className="text-xs text-center max-w-sm" style={{ color: "hsl(220,14%,38%)" }}>
                          None of your {(trades?.length ?? 0)} trades were open during the {eventData.summary.totalEvents} economic events in our catalog for this date range.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,38%)" }}>
                          Events with active trades ({eventData.events.filter(e => e.tradesInWindow > 0).length})
                        </p>
                        {eventData.events.filter(e => e.tradesInWindow > 0).map(ev => {
                          const typeColor: Record<string, string> = { fed: "#60a5fa", cpi: "#f59e0b", macro: "#ef4444", election: "#a78bfa" };
                          const col = typeColor[ev.type] ?? "#6366f1";
                          const wr = ev.winRateInWindow;
                          const wrColor = wr !== null ? (wr >= 60 ? "#34d399" : wr >= 40 ? "#f59e0b" : "#ef4444") : "#6b7280";
                          return (
                            <div key={ev.id} className="p-4 rounded-xl space-y-2"
                              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex items-start gap-3">
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0"
                                    style={{ background: `${col}20`, color: col, border: `1px solid ${col}40` }}>
                                    {ev.type.toUpperCase()}
                                  </span>
                                  <div>
                                    <p className="text-sm font-medium" style={{ color: "hsl(220,14%,80%)" }}>{ev.name}</p>
                                    <p className="text-[11px]" style={{ color: "hsl(220,14%,42%)" }}>{ev.date} · ±{ev.windowDays}d window</p>
                                    <p className="text-[11px] mt-0.5" style={{ color: "hsl(220,14%,38%)" }}>{ev.description}</p>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  {wr !== null ? (
                                    <>
                                      <p className="text-lg font-bold" style={{ color: wrColor }}>{wr.toFixed(0)}%</p>
                                      <p className="text-[10px]" style={{ color: "hsl(220,14%,42%)" }}>win rate</p>
                                    </>
                                  ) : (
                                    <p className="text-sm" style={{ color: "hsl(220,14%,42%)" }}>—</p>
                                  )}
                                </div>
                              </div>
                              {/* Micro trade chips */}
                              {ev.trades.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {ev.trades.map((t, ti) => (
                                    <span key={ti} className="text-[10px] font-mono px-2 py-0.5 rounded-lg"
                                      style={{
                                        background: t.pnl > 0 ? "rgba(52,211,153,0.1)" : "rgba(239,68,68,0.1)",
                                        color: t.pnl > 0 ? "#34d399" : "#ef4444",
                                        border: `1px solid ${t.pnl > 0 ? "rgba(52,211,153,0.25)" : "rgba(239,68,68,0.25)"}`,
                                      }}>
                                      {t.pnlPercent >= 0 ? "+" : ""}{t.pnlPercent.toFixed(2)}%
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Events with no trades — collapsed list */}
                    {eventData.events.filter(e => e.tradesInWindow === 0).length > 0 && (
                      <details className="text-[11px]" style={{ color: "hsl(220,14%,38%)" }}>
                        <summary className="cursor-pointer font-mono uppercase tracking-widest hover:opacity-80">
                          {eventData.events.filter(e => e.tradesInWindow === 0).length} events with no active trades
                        </summary>
                        <div className="mt-2 space-y-1 pl-2">
                          {eventData.events.filter(e => e.tradesInWindow === 0).map(ev => (
                            <p key={ev.id}>{ev.date} — {ev.name}</p>
                          ))}
                        </div>
                      </details>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                      <Button variant="outline" size="sm" onClick={handleLoadEventImpact} disabled={isLoadingEvents} className="gap-2">
                        <Activity className="h-3.5 w-3.5" />Refresh
                      </Button>
                      <p className="text-[11px] text-muted-foreground">Catalog: {eventData.summary.totalEvents} events · 2020–2024</p>
                    </div>
                  </>
                )}
                {!eventData && !isLoadingEvents && !eventError && (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Activity className="h-8 w-8 text-primary/60" />
                    </div>
                    <div className="text-center max-w-sm">
                      <p className="text-sm font-medium text-foreground">See your strategy through major events</p>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        Click "Analyze Events" to overlay your trades against Fed meetings, CPI prints, market crashes, and elections.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </Tabs.Content>

          {/* ── TAB 6: Regime Analysis ───────────────────────────────── */}
          <Tabs.Content value="regime" className="space-y-6 tab-transition">
            <RegimeAnalysisTab backtestId={id} />
          </Tabs.Content>

          {/* ── TAB 7: Live Monitor ──────────────────────────────────── */}
          <Tabs.Content value="live" className="space-y-6 tab-transition">
            <LiveMonitorTab backtestId={id} symbol={backtest.symbol} />
          </Tabs.Content>

        </Tabs.Root>
      )}
    </motion.div>
  );
}

// ─── Regime Analysis Tab ─────────────────────────────────────────────────────

const REGIME_META = {
  trending_bull:  { color: "#22c55e", bg: "rgba(34,197,94,0.12)",   label: "Trending Bull",   icon: "📈" },
  trending_bear:  { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Trending Bear",   icon: "📉" },
  highvol_bull:   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "High-Vol Bull",   icon: "⚡📈" },
  highvol_bear:   { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", label: "High-Vol Bear",   icon: "⚡📉" },
} as const;

type RegimeKey = keyof typeof REGIME_META;

type RegimePeriod = {
  startDate: string; endDate: string;
  regime: RegimeKey;
  avgReturn: number; volatility: number;
  tradeCount: number; winRate: number; totalPnl: number;
};

type RegimeSummaryItem = { count: number; totalTrades: number; avgWinRate: number; avgReturn: number; totalPnl: number } | null;

const REGIME_ORDER: RegimeKey[] = ["trending_bull", "trending_bear", "highvol_bull", "highvol_bear"];

function RegimeAnalysisTab({ backtestId }: { backtestId: number }) {
  const [regimes, setRegimes] = React.useState<RegimePeriod[]>([]);
  const [summary, setSummary] = React.useState<Record<string, RegimeSummaryItem>>({});
  const [regimeEquity, setRegimeEquity] = React.useState<Record<string, { date: string; value: number }[]>>({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [regimeFilter, setRegimeFilter] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const token = localStorage.getItem("tt_token") ?? "";
      const resp = await fetch(`/api/backtests/${backtestId}/regime-analysis`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to load regime data");
      const data = await resp.json();
      setRegimes(data.regimes ?? []);
      setSummary(data.summary ?? {});
      setRegimeEquity(data.regimeEquity ?? {});
      setLoaded(true);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [backtestId]);

  React.useEffect(() => { load(); }, [load]);

  const barData = React.useMemo(() =>
    REGIME_ORDER.map((k) => {
      const s = summary[k];
      const meta = REGIME_META[k];
      return {
        regime: meta.label,
        winRate: s ? Number(s.avgWinRate.toFixed(1)) : 0,
        avgReturn: s ? Number(s.avgReturn.toFixed(1)) : 0,
        fill: meta.color,
        hasPeriods: !!s,
      };
    }), [summary]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Classifying market regimes (SMA50 + volatility)…</p>
      </div>
    );
  }
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!loaded || regimes.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground border border-dashed rounded-xl">
        No regime data available. This backtest requires at least 60 bars of price data.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards — clickable regime filter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {REGIME_ORDER.map((k) => {
          const meta = REGIME_META[k];
          const s = summary[k];
          const isActive = regimeFilter === k;
          return (
            <div key={k}
              onClick={() => setRegimeFilter((f) => f === k ? null : k)}
              className="p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02]"
              style={{ background: meta.bg, borderColor: `${meta.color}30`, outline: isActive ? `2px solid ${meta.color}` : "none", outlineOffset: "2px" }}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">{meta.icon}</span>
                <span className="text-[11px] font-medium leading-tight" style={{ color: meta.color }}>{meta.label}</span>
              </div>
              {s ? (
                <>
                  <p className="text-2xl font-bold font-mono" style={{ color: meta.color }}>{s.count}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">periods</p>
                  <div className="mt-2 space-y-0.5">
                    <p className="text-[11px]"><span className="text-muted-foreground">Trades: </span><span className="font-mono">{s.totalTrades}</span></p>
                    <p className="text-[11px]"><span className="text-muted-foreground">Win rate: </span><span className="font-mono">{s.avgWinRate.toFixed(1)}%</span></p>
                    <p className="text-[11px]"><span className="text-muted-foreground">Avg return: </span><span className={`font-mono font-semibold ${s.avgReturn >= 0 ? "text-green-400" : "text-red-400"}`}>{s.avgReturn >= 0 ? "+" : ""}{s.avgReturn.toFixed(1)}%</span></p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">No periods</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Regime equity sub-chart — shown when a regime is active */}
      {regimeFilter && (regimeEquity[regimeFilter]?.length ?? 0) > 0 && (
        <Card className="border-border" style={{ borderColor: `${REGIME_META[regimeFilter as RegimeKey]?.color}30` }}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <span>{REGIME_META[regimeFilter as RegimeKey]?.icon}</span>
              <CardTitle className="text-base" style={{ color: REGIME_META[regimeFilter as RegimeKey]?.color }}>
                Equity Curve — {REGIME_META[regimeFilter as RegimeKey]?.label} Periods
              </CardTitle>
              <span className="text-xs text-muted-foreground ml-auto">
                {regimeEquity[regimeFilter]!.length} data points
              </span>
            </div>
            <CardDescription>Equity curve filtered to {REGIME_META[regimeFilter as RegimeKey]?.label.toLowerCase()} regime windows only</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={regimeEquity[regimeFilter]!.map((p) => ({ date: p.date, value: p.value }))}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="regimeEquityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={REGIME_META[regimeFilter as RegimeKey]?.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={REGIME_META[regimeFilter as RegimeKey]?.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--muted-foreground))" tickFormatter={(d) => d.slice(2, 7)} tick={{ dy: 4 }} />
                  <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} width={52} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.5rem" }}
                    formatter={(v: number) => [`$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, "Equity"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={REGIME_META[regimeFilter as RegimeKey]?.color}
                    strokeWidth={2}
                    fill="url(#regimeEquityGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grouped bar chart: Win Rate + Avg Return by regime */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Performance by Regime</CardTitle>
          <CardDescription>Win rate and annualized return grouped by SMA50 + volatility classification</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="regime" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="left" tickFormatter={(v) => `${v}%`} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.5rem" }}
                  formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name === "winRate" ? "Win Rate" : "Avg Ann. Return"]}
                />
                <Bar yAxisId="left" dataKey="winRate" name="winRate" radius={[3, 3, 0, 0]} maxBarSize={40}>
                  {barData.map((d, i) => (
                    <Cell key={i} fill={d.fill} fillOpacity={0.7} />
                  ))}
                </Bar>
                <Bar yAxisId="right" dataKey="avgReturn" name="avgReturn" radius={[3, 3, 0, 0]} maxBarSize={40}>
                  {barData.map((d, i) => (
                    <Cell key={i} fill={d.fill} fillOpacity={0.35} />
                  ))}
                </Bar>
                <ReferenceLine yAxisId="left" y={50} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground justify-center">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-current opacity-70" />Win Rate (left axis)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-current opacity-35" />Ann. Return (right axis)</span>
            <span className="text-yellow-500">— 50% win threshold</span>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Regime Timeline</CardTitle>
              <CardDescription>30-day rolling classification — SMA50 position × volatility → 4 regime types</CardDescription>
            </div>
            {regimeFilter && (
              <button onClick={() => setRegimeFilter(null)}
                className="text-[11px] text-primary underline underline-offset-2 hover:opacity-70 transition-opacity">
                Clear filter ({REGIME_META[regimeFilter as RegimeKey]?.label})
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {(regimeFilter ? regimes.filter((r) => r.regime === regimeFilter) : regimes).map((r, i) => {
              const meta = REGIME_META[r.regime];
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl border transition-all hover:bg-muted/10"
                  style={{ borderColor: `${meta.color}25`, background: `${meta.color}05` }}>
                  <span className="text-base leading-none mt-0.5">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{r.startDate} → {r.endDate}</span>
                      <Badge className="text-[10px]" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase">Ann. Return</p>
                        <p className={`text-xs font-mono font-medium ${r.avgReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {r.avgReturn >= 0 ? "+" : ""}{r.avgReturn.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase">Volatility</p>
                        <p className="text-xs font-mono font-medium">{r.volatility.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase">Trades</p>
                        <p className="text-xs font-mono font-medium">{r.tradeCount}</p>
                      </div>
                      {r.tradeCount > 0 && (
                        <div>
                          <p className="text-[9px] text-muted-foreground uppercase">Win Rate</p>
                          <p className={`text-xs font-mono font-medium ${r.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
                            {r.winRate.toFixed(0)}%
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Live Monitor Tab ────────────────────────────────────────────────────────

type LiveTradeRow = {
  id: number; backtestId: number; tradeDate: string; symbol: string;
  side: string; entryPrice: number; exitPrice: number | null;
  pnlAmount: number | null; note: string | null; createdAt: string;
};

type DivergenceData = {
  expected: { date: string; value: number }[];
  actual: { date: string; value: number }[];
  liveTotal: number; expectedTotal: number;
  divergenceScore: number | null; initialCapital: number;
};

function LiveMonitorTab({ backtestId, symbol }: { backtestId: number; symbol: string }) {
  const [liveTrades, setLiveTrades] = React.useState<LiveTradeRow[]>([]);
  const [divergence, setDivergence] = React.useState<DivergenceData | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({ tradeDate: new Date().toISOString().split("T")[0]!, pnlAmount: "", note: "" });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Divergence threshold: 10-50%, default 20%, persisted per backtestId
  const THRESHOLD_KEY = `div_threshold_${backtestId}`;
  const [threshold, setThreshold] = React.useState<number>(() => {
    const stored = localStorage.getItem(THRESHOLD_KEY);
    return stored ? Number(stored) : 20;
  });
  const handleThresholdChange = (v: number) => {
    setThreshold(v);
    localStorage.setItem(THRESHOLD_KEY, String(v));
  };

  const { toast } = useToast();
  const token = () => localStorage.getItem("tt_token") ?? "";

  const loadAll = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [tradesResp, divResp] = await Promise.all([
        fetch(`/api/backtests/${backtestId}/live-trades`, { headers: { "Authorization": `Bearer ${token()}` } }),
        fetch(`/api/backtests/${backtestId}/divergence`,  { headers: { "Authorization": `Bearer ${token()}` } }),
      ]);
      if (tradesResp.ok) setLiveTrades(await tradesResp.json());
      if (divResp.ok) setDivergence(await divResp.json());
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [backtestId]);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  async function handleAdd() {
    if (!form.tradeDate) { toast({ title: "Trade date required", variant: "destructive" }); return; }
    setIsSubmitting(true);
    try {
      const resp = await fetch(`/api/backtests/${backtestId}/live-trades`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token()}` },
        body: JSON.stringify({
          tradeDate: form.tradeDate,
          pnlAmount: form.pnlAmount ? Number(form.pnlAmount) : null,
          note: form.note || null,
        }),
      });
      if (!resp.ok) throw new Error("Failed to add trade");
      await loadAll();
      setShowForm(false);
      setForm({ tradeDate: new Date().toISOString().split("T")[0]!, pnlAmount: "", note: "" });
      toast({ title: "Live trade logged" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setIsSubmitting(false); }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/backtests/${backtestId}/live-trades/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token()}` } });
    await loadAll();
    toast({ title: "Trade removed" });
  }

  const liveTotal = liveTrades.reduce((a, t) => a + (t.pnlAmount ?? 0), 0);
  const liveWinRate = liveTrades.length > 0
    ? (liveTrades.filter((t) => (t.pnlAmount ?? 0) > 0).length / liveTrades.length) * 100 : 0;

  const dualChartData = React.useMemo(() => {
    if (!divergence?.expected?.length) return [];
    const actualMap = new Map((divergence.actual ?? []).map((p) => [p.date, p.value]));
    return divergence.expected.slice(0, 200).map((p) => ({
      date: p.date,
      expected: p.value,
      actual: actualMap.has(p.date) ? actualMap.get(p.date)! : null,
    }));
  }, [divergence]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm">Live vs. Backtest Divergence Monitor</h3>
          <p className="text-xs text-muted-foreground">Log real trades to compare actual performance against backtest expectations</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} className="gap-2">
          <Plus className="h-3.5 w-3.5" /> Log Live Trade
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Trade Date</label>
                <Input type="date" value={form.tradeDate} onChange={(e) => setForm((f) => ({ ...f, tradeDate: e.target.value }))} className="text-xs" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">P&L Amount (opt)</label>
                <Input type="number" placeholder="e.g. 120.50 or -45.00" value={form.pnlAmount} onChange={(e) => setForm((f) => ({ ...f, pnlAmount: e.target.value }))} className="text-xs" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Note (opt)</label>
                <Input placeholder="Optional note…" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="text-xs" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dual-line divergence chart */}
      {divergence && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-base">Expected vs. Live Cumulative P&L</CardTitle>
                <CardDescription>Blue = backtest expectation · Green = your logged live trades</CardDescription>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Threshold slider */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground whitespace-nowrap">Alert at</span>
                  <input type="range" min={10} max={50} step={5} value={threshold}
                    onChange={(e) => handleThresholdChange(Number(e.target.value))}
                    className="w-20 accent-primary" />
                  <span className="font-mono font-bold text-primary w-8">{threshold}%</span>
                </div>
                {divergence.divergenceScore != null && (
                  <div className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold ${
                    divergence.divergenceScore <= threshold * 0.5 ? "border-green-500/30 bg-green-500/10 text-green-400"
                    : divergence.divergenceScore <= threshold ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
                  }`}>
                    {divergence.divergenceScore}% divergence
                    {divergence.divergenceScore > threshold && " ⚠️"}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dualChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--muted-foreground))" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 9 }} />
                  <YAxis tickFormatter={(v) => `$${v >= 0 ? "+" : ""}${v.toFixed(0)}`} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.5rem" }}
                    formatter={(v: number, name: string) => [`$${v >= 0 ? "+" : ""}${v.toFixed(2)}`, name === "expected" ? "Expected P&L" : "Live P&L"]}
                  />
                  <Line type="monotone" dataKey="expected" stroke="#6366f1" strokeWidth={2} dot={false} name="expected" />
                  <Line type="monotone" dataKey="actual" stroke="#22c55e" strokeWidth={2} dot={{ r: 4, fill: "#22c55e" }} connectNulls={false} name="actual" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-1 justify-center text-[10px] font-mono text-muted-foreground">
              <span><span className="text-[#6366f1]">━</span> Expected (backtest): {divergence.expectedTotal >= 0 ? "+" : ""}${divergence.expectedTotal.toFixed(2)}</span>
              {liveTrades.length > 0 && <span><span className="text-[#22c55e]">━</span> Live actual: {divergence.liveTotal >= 0 ? "+" : ""}${divergence.liveTotal.toFixed(2)}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Divergence stats */}
      {liveTrades.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl border border-border bg-card">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Live Trades</p>
            <p className="text-2xl font-bold font-mono mt-1">{liveTrades.length}</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Live P&L</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${liveTotal >= 0 ? "text-green-400" : "text-red-400"}`}>
              {liveTotal >= 0 ? "+" : ""}${liveTotal.toFixed(2)}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Live Win Rate</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${liveWinRate >= 50 ? "text-green-400" : "text-red-400"}`}>
              {liveWinRate.toFixed(0)}%
            </p>
          </div>
        </div>
      )}

      {/* Trade list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map((i) => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : liveTrades.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-xl">
          <MonitorDot className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No live trades logged yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Log real trades to compare against backtest expectations.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-[11px] font-medium text-muted-foreground text-left">Date</th>
                <th className="px-3 py-2 text-[11px] font-medium text-muted-foreground text-right">P&L</th>
                <th className="px-3 py-2 text-[11px] font-medium text-muted-foreground text-left">Note</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {liveTrades.map((t) => {
                const isWin = (t.pnlAmount ?? 0) > 0;
                return (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/10">
                    <td className="px-3 py-2.5 font-mono text-xs">{t.tradeDate}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-bold">
                      {t.pnlAmount != null ? (
                        <span className={isWin ? "text-green-400" : "text-red-400"}>
                          {isWin ? "+" : ""}${t.pnlAmount.toFixed(2)}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">{t.note ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── P&L Calendar component ─────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

interface TradeRow { exitDate?: string | null; pnl?: number | string | null }

function PnLCalendar({ trades }: { trades: TradeRow[] }) {
  const [viewYear, setViewYear] = useState<number>(() => new Date().getFullYear());

  const dailyPnl = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of trades) {
      if (!t.exitDate) continue;
      const day = t.exitDate.slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + Number(t.pnl ?? 0));
    }
    return map;
  }, [trades]);

  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const k of dailyPnl.keys()) ys.add(Number(k.slice(0, 4)));
    if (!ys.size) ys.add(new Date().getFullYear());
    return Array.from(ys).sort((a, b) => b - a);
  }, [dailyPnl]);

  const annualPnl = useMemo(() => {
    let total = 0;
    for (const [k, v] of dailyPnl) if (Number(k.slice(0, 4)) === viewYear) total += v;
    return total;
  }, [dailyPnl, viewYear]);

  const tradingDays  = useMemo(() => [...dailyPnl.keys()].filter(k => k.startsWith(String(viewYear))).length, [dailyPnl, viewYear]);
  const winDays      = useMemo(() => [...dailyPnl.entries()].filter(([k, v]) => k.startsWith(String(viewYear)) && v > 0).length, [dailyPnl, viewYear]);

  return (
    <div className="space-y-4">
      {/* Year selector + annual summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {years.map(y => (
            <button key={y} onClick={() => setViewYear(y)}
              className="px-3 py-1 rounded-lg text-xs font-mono font-medium border transition-all"
              style={y === viewYear ? { background: "rgba(0,229,255,0.12)", borderColor: "rgba(0,229,255,0.3)", color: "hsl(190,90%,65%)" } : { background: "transparent", borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
              {y}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-muted-foreground">{tradingDays} trading days</span>
          <span className="text-muted-foreground">{tradingDays > 0 ? Math.round((winDays / tradingDays) * 100) : 0}% win days</span>
          <span className={`font-semibold ${annualPnl >= 0 ? "text-green-500" : "text-red-500"}`}>{annualPnl >= 0 ? "+" : ""}${annualPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {viewYear}</span>
        </div>
      </div>

      {/* Month grids */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MONTH_NAMES.map((month, mi) => {
          const firstDay = new Date(viewYear, mi, 1).getDay();
          const daysInMonth = new Date(viewYear, mi + 1, 0).getDate();
          const cells: (null | { day: number; pnl: number | null })[] = [
            ...Array(firstDay).fill(null),
            ...Array.from({ length: daysInMonth }, (_, d) => {
              const key = `${viewYear}-${String(mi + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
              return { day: d + 1, pnl: dailyPnl.has(key) ? dailyPnl.get(key)! : null };
            }),
          ];
          const monthTotal = cells.filter(Boolean).reduce((s, c) => s + (c?.pnl ?? 0), 0);
          const hasTrades  = cells.some(c => c?.pnl !== null);

          return (
            <div key={mi} className="rounded-xl border border-border p-3" style={{ background: "rgba(255,255,255,0.015)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-semibold" style={{ color: "hsl(220,14%,70%)" }}>{month}</span>
                {hasTrades && (
                  <span className={`text-[10px] font-mono font-bold ${monthTotal >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {monthTotal >= 0 ? "+" : ""}${Math.abs(monthTotal).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                {DAY_LABELS.map(d => <div key={d} className="text-center text-[8px] font-mono" style={{ color: "hsl(220,14%,35%)" }}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((cell, ci) => {
                  if (!cell) return <div key={ci} />;
                  const { day, pnl } = cell;
                  const hasData = pnl !== null;
                  const isWin   = hasData && pnl > 0;
                  const isLoss  = hasData && pnl < 0;
                  return (
                    <div key={ci}
                      title={hasData ? `${month} ${day}: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` : `${month} ${day}`}
                      className="aspect-square rounded-sm flex items-center justify-center text-[9px] font-mono cursor-default transition-transform hover:scale-110"
                      style={{
                        background: isWin  ? `rgba(52,211,153,${Math.min(0.85, 0.18 + Math.abs(pnl!) / 500)})` :
                                    isLoss ? `rgba(239,68,68,${Math.min(0.85, 0.18 + Math.abs(pnl!) / 500)})` :
                                             "rgba(255,255,255,0.03)",
                        color: hasData ? "rgba(255,255,255,0.85)" : "hsl(220,14%,35%)",
                        border: hasData ? "none" : "1px solid rgba(255,255,255,0.04)",
                      }}>
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] font-mono" style={{ color: "hsl(220,14%,42%)" }}>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm" style={{ background: "rgba(52,211,153,0.5)" }} /> Profitable day</div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm" style={{ background: "rgba(239,68,68,0.5)" }} /> Loss day</div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }} /> No trades</div>
      </div>
    </div>
  );
}
