import React, { useMemo, useState, useCallback } from "react";
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
  ChevronDown, ChevronUp, BookOpen, BarChart3, LayoutDashboard, StickyNote
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
      className="relative overflow-hidden p-4 rounded-xl border border-border flex flex-col gap-1 bg-card"
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

function TradeNote({ tradeId, backtestId }: { tradeId: number; backtestId: number }) {
  const key = `trade_note_${backtestId}_${tradeId}`;
  const [note, setNote] = useState(() => localStorage.getItem(key) ?? "");
  const [tags, setTags] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(key + "_tags") ?? "[]"); } catch { return []; }
  });
  const [newTag, setNewTag] = useState("");

  function saveNote(val: string) {
    setNote(val);
    localStorage.setItem(key, val);
  }
  function addTag() {
    if (!newTag.trim()) return;
    const updated = [...new Set([...tags, newTag.trim()])];
    setTags(updated);
    localStorage.setItem(key + "_tags", JSON.stringify(updated));
    setNewTag("");
  }
  function removeTag(t: string) {
    const updated = tags.filter((x) => x !== t);
    setTags(updated);
    localStorage.setItem(key + "_tags", JSON.stringify(updated));
  }

  const TAG_COLORS: Record<string, string> = {
    "trend": "#6366f1", "breakout": "#0ea5e9", "reversal": "#ec4899",
    "momentum": "#10b981", "fomo": "#f59e0b", "planned": "#22c55e",
  };

  return (
    <div className="p-4 bg-muted/20 rounded-lg border border-border/50 space-y-3">
      <div className="flex items-center gap-2">
        <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trade Journal Note</span>
      </div>
      <textarea
        className="w-full text-sm bg-transparent resize-none outline-none placeholder:text-muted-foreground/50 min-h-[60px] font-mono"
        placeholder="Add notes about this trade setup, execution, or outcome..."
        value={note}
        onChange={(e) => saveNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5 items-center">
        {tags.map((t) => (
          <span
            key={t}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer"
            style={{ background: `${TAG_COLORS[t] ?? "#6366f1"}20`, color: TAG_COLORS[t] ?? "#6366f1", border: `1px solid ${TAG_COLORS[t] ?? "#6366f1"}40` }}
            onClick={() => removeTag(t)}
          >
            #{t} ×
          </span>
        ))}
        <div className="flex items-center gap-1">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            placeholder="+ tag"
            className="text-[11px] bg-transparent outline-none placeholder:text-muted-foreground/40 w-16 font-mono"
          />
        </div>
      </div>
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
      refetchInterval: (data) =>
        data?.state?.data?.status === "running" || data?.state?.data?.status === "pending"
          ? 1000
          : false,
    },
  });
  const { data: trades, isLoading: isLoadingTrades } = useGetBacktestTrades(id, {
    query: { enabled: !!id && backtest?.status === "complete" },
  });
  const { data: equityCurve, isLoading: isLoadingEquity } = useGetEquityCurve(id, {
    query: { enabled: !!id && backtest?.status === "complete" },
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
        onError: (error) => {
          toast({ title: "Error", description: error.error || "Failed to delete backtest", variant: "destructive" });
        },
      }
    );
  }

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
    <div className="space-y-6">
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
          <Tabs.Content value="overview" className="space-y-6">
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
            </div>

            {/* Equity curve */}
            <Card className="border-border">
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
                          formatter={(value: number, name: string) => [
                            name === "value" ? fmtUSD(value) : `${value.toFixed(2)}%`,
                            name === "value" ? "Equity" : "Drawdown",
                          ]}
                        />
                        <Area yAxisId="left" type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorValue)" strokeWidth={1.5} />
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
          <Tabs.Content value="analytics" className="space-y-6">
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
          <Tabs.Content value="journal" className="space-y-4">
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
    </div>
  );
}
