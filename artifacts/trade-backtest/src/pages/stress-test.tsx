import React, { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useListStrategies } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis, ReferenceLine,
} from "recharts";
import {
  Zap, TrendingUp, TrendingDown, AlertTriangle, Search, Loader2,
  BarChart2, Globe, ChevronUp, ChevronDown,
} from "lucide-react";

type StressResult = {
  symbol: string; name: string; sector: string;
  totalReturn: number; sharpeRatio: number; maxDrawdown: number;
  winRate: number; totalTrades: number; profitFactor: number;
  finalCapital: number; annualizedReturn: number;
  edgeVerdict: "edge" | "noise";
};

type SectorSummary = {
  sector: string; count: number;
  avgReturn: number; avgSharpe: number; avgDrawdown: number; best: string;
};

type StressResponse = {
  strategyName: string; strategyType: string;
  startDate: string; endDate: string; initialCapital: number;
  totalSymbols: number; results: StressResult[];
  sectorSummary: SectorSummary[];
  stats: {
    avgReturn: number; avgSharpe: number;
    profitable: number; edgeCount: number;
    topSymbol: string; worstSymbol: string;
  };
};

const ALL_SECTORS = ["All", "Crypto", "Tech", "Auto", "Media", "Fintech", "Index", "Forex", "Commodity", "Energy", "Metal", "Bond", "Vol"];

function fmtPct(v: number) { return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`; }
function fmtNum(v: number, d = 2) { return v.toFixed(d); }

function SortIcon({ active, dir }: { active: boolean; dir: 1 | -1 }) {
  if (!active) return <ChevronDown className="h-3 w-3 opacity-20 inline ml-1" />;
  return dir === 1
    ? <ChevronDown className="h-3 w-3 text-primary inline ml-1" />
    : <ChevronUp className="h-3 w-3 text-primary inline ml-1" />;
}

export default function StressTestPage() {
  const [strategyId, setStrategyId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("2022-01-01");
  const [endDate, setEndDate] = useState("2024-01-01");
  const [capital, setCapital] = useState("10000");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<StressResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("All");
  const [sortKey, setSortKey] = useState<keyof StressResult>("totalReturn");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [view, setView] = useState<"table" | "bars" | "scatter">("table");

  const { data: strategies, isLoading: loadingStrats } = useListStrategies();

  function toggleSort(k: keyof StressResult) {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(-1); }
  }

  const handleRun = useCallback(async () => {
    if (!strategyId) { setError("Please select a strategy"); return; }
    const token = localStorage.getItem("tt_token") ?? "";
    if (!token) {
      setError("You must be signed in to run a Stress Test. Please log in and try again.");
      return;
    }
    setIsLoading(true); setError(null); setResult(null);
    try {
      const resp = await fetch("/api/superpowers/stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          strategyId, startDate, endDate,
          initialCapital: Number(capital),
        }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error ?? "Request failed");
      setResult(await resp.json());
    } catch (e: any) {
      setError(e.message || "Failed to run stress test");
    } finally {
      setIsLoading(false);
    }
  }, [strategyId, startDate, endDate, capital]);

  const filtered = useMemo(() => {
    if (!result) return [];
    return result.results
      .filter((r) => {
        if (sectorFilter !== "All" && r.sector !== sectorFilter) return false;
        if (search && !r.symbol.toLowerCase().includes(search.toLowerCase()) && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        const av = a[sortKey] as number, bv = b[sortKey] as number;
        return sortDir * (bv - av);
      });
  }, [result, sectorFilter, search, sortKey, sortDir]);

  const barData = useMemo(() => {
    if (!filtered.length) return [];
    return filtered.slice(0, 30).map((r) => ({
      symbol: r.symbol, value: r.totalReturn,
      positive: r.totalReturn >= 0,
    }));
  }, [filtered]);

  const scatterData = useMemo(() => {
    if (!filtered.length) return [];
    return filtered.map((r) => ({
      x: r.maxDrawdown, y: r.totalReturn, z: r.totalTrades,
      name: r.symbol, positive: r.totalReturn >= 0,
    }));
  }, [filtered]);

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cross-Asset Stress Test</h1>
          <p className="text-muted-foreground">Run your strategy across 55+ symbols — crypto, stocks, forex, commodities, and indices</p>
        </div>
      </div>

      {/* Config panel */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuration</CardTitle>
          <CardDescription>Select a strategy and date range, then fire across all markets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 block">Strategy</label>
              <select
                value={strategyId ?? ""}
                onChange={(e) => setStrategyId(Number(e.target.value) || null)}
                className="w-full text-sm bg-muted border border-border rounded-md px-2 py-2 text-foreground"
              >
                <option value="">Select strategy…</option>
                {(strategies ?? []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 block">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 text-sm" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 block">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 text-sm" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 block">Capital ($)</label>
              <Input type="number" value={capital} onChange={(e) => setCapital(e.target.value)} className="w-28 text-sm" min="100" />
            </div>
            <Button onClick={handleRun} disabled={isLoading || !strategyId} className="gap-2">
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Running…</> : <><Zap className="h-4 w-4" /> Run Stress Test</>}
            </Button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-14 w-14 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground">Running strategy across 55+ symbols…</p>
          <p className="text-xs text-muted-foreground">This may take 10–15 seconds</p>
        </div>
      )}

      {result && !isLoading && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: "Symbols Tested", value: result.totalSymbols.toString(), accent: "#6366f1" },
              { label: "Profitable", value: `${result.stats.profitable} / ${result.totalSymbols}`, accent: "#22c55e" },
              { label: "Real Edge", value: `${result.stats.edgeCount} / ${result.totalSymbols}`, accent: result.stats.edgeCount > result.totalSymbols / 2 ? "#22c55e" : "#f59e0b", note: "Sharpe > 0.5" },
              { label: "Avg Return", value: fmtPct(result.stats.avgReturn), accent: result.stats.avgReturn >= 0 ? "#22c55e" : "#ef4444" },
              { label: "Avg Sharpe", value: fmtNum(result.stats.avgSharpe), accent: result.stats.avgSharpe > 1 ? "#22c55e" : result.stats.avgSharpe > 0 ? "#f59e0b" : "#ef4444" },
              { label: "Best Symbol", value: result.stats.topSymbol, accent: "#22c55e" },
            ].map(({ label, value, accent, note }) => (
              <div key={label} className="p-4 rounded-xl border border-border bg-card relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${accent}60, transparent)` }} />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-xl font-bold font-mono mt-1" style={{ color: accent }}>{value}</p>
                {note && <p className="text-[9px] text-muted-foreground mt-0.5">{note}</p>}
              </div>
            ))}
          </div>

          {/* Sector Summary */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sector Performance</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="flex gap-3 min-w-[500px] flex-wrap">
                {result.sectorSummary.sort((a, b) => b.avgReturn - a.avgReturn).map((sec) => (
                  <div key={sec.sector} className="flex-1 min-w-[110px] p-3 rounded-xl border border-border bg-muted/20">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{sec.sector}</p>
                    <p className={`text-lg font-bold font-mono ${sec.avgReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {fmtPct(sec.avgReturn)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{sec.count} assets · Sharpe {fmtNum(sec.avgSharpe)}</p>
                    <p className="text-[10px] text-muted-foreground">Best: <span className="text-foreground font-mono">{sec.best}</span></p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* View selector + filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1 p-0.5 rounded-lg bg-muted/40 border border-border">
              {([["table", "Table"], ["bars", "Bar Chart"], ["scatter", "Risk/Return"]] as const).map(([v, label]) => (
                <button key={v} onClick={() => setView(v)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  style={view === v ? { background: "hsl(var(--background))", color: "hsl(var(--foreground))", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" } : { color: "hsl(var(--muted-foreground))" }}>
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8 h-8 text-xs w-40" placeholder="Filter symbol…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}
              className="h-8 text-xs px-2 rounded-md bg-muted border border-border text-foreground">
              {ALL_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} results</span>
          </div>

          {/* Table view */}
          {view === "table" && (
            <div className="rounded-xl border border-border overflow-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-muted/30">
                  <tr className="border-b border-border">
                    {([
                      ["symbol", "Symbol"],
                      ["sector", "Sector"],
                      ["totalReturn", "Return"],
                      ["annualizedReturn", "Ann. Return"],
                      ["sharpeRatio", "Sharpe"],
                      ["maxDrawdown", "Max DD"],
                      ["winRate", "Win Rate"],
                      ["totalTrades", "Trades"],
                      ["edgeVerdict", "Edge?"],
                    ] as [keyof StressResult, string][]).map(([k, label]) => (
                      <th key={k} onClick={() => toggleSort(k)}
                        className="px-3 py-2.5 text-[11px] font-medium text-muted-foreground cursor-pointer select-none text-left whitespace-nowrap hover:text-foreground transition-colors">
                        {label} <SortIcon active={sortKey === k} dir={sortDir} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.symbol} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5">
                        <div>
                          <p className="font-mono font-semibold text-sm">{r.symbol}</p>
                          <p className="text-[10px] text-muted-foreground">{r.name}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className="text-[10px]">{r.sector}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`font-mono font-bold text-sm ${r.totalReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {fmtPct(r.totalReturn)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`font-mono text-sm ${r.annualizedReturn >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {fmtPct(r.annualizedReturn)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`font-mono text-sm ${r.sharpeRatio > 1 ? "text-green-400" : r.sharpeRatio > 0 ? "text-yellow-400" : "text-red-400"}`}>
                          {fmtNum(r.sharpeRatio)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-sm text-red-400">-{fmtNum(r.maxDrawdown)}%</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${r.winRate}%`, background: r.winRate >= 50 ? "#22c55e" : "#f59e0b" }} />
                          </div>
                          <span className="font-mono text-xs">{fmtNum(r.winRate)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-sm text-muted-foreground">{r.totalTrades}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className={`text-[10px] font-semibold ${
                          r.edgeVerdict === "edge"
                            ? "border-green-500/30 text-green-400 bg-green-500/10"
                            : "border-muted text-muted-foreground"
                        }`}>
                          {r.edgeVerdict === "edge" ? "✓ Real Edge" : "Noise"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bar chart view */}
          {view === "bars" && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Total Return by Symbol</CardTitle>
                <CardDescription>Top 30 from filtered set</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="symbol" angle={-45} textAnchor="end" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.5rem" }}
                        formatter={(v: number) => [`${v.toFixed(2)}%`, "Return"]}
                      />
                      <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                        {barData.map((d, i) => (
                          <Cell key={i} fill={d.positive ? "#22c55e" : "#ef4444"} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scatter view */}
          {view === "scatter" && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Risk / Return Map</CardTitle>
                <CardDescription>X = Max Drawdown · Y = Total Return · Bubble size = # trades</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" dataKey="x" name="Max DD" fontSize={11} stroke="hsl(var(--muted-foreground))" label={{ value: "Max Drawdown (%)", position: "insideBottom", offset: -20, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis type="number" dataKey="y" name="Return" fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v.toFixed(0)}%`} />
                      <ZAxis type="number" dataKey="z" range={[40, 400]} />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.5rem" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0]?.payload;
                          return (
                            <div className="p-2 text-xs" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
                              <p className="font-bold mb-1">{d?.name}</p>
                              <p>Return: <span className={d?.positive ? "text-green-400" : "text-red-400"}>{fmtPct(d?.y ?? 0)}</span></p>
                              <p>Max DD: <span className="text-red-400">-{fmtNum(d?.x ?? 0)}%</span></p>
                              <p>Trades: {d?.z}</p>
                            </div>
                          );
                        }}
                      />
                      <Scatter
                        data={scatterData}
                        fill="#6366f1"
                        fillOpacity={0.6}
                      >
                        {scatterData.map((d, i) => (
                          <Cell key={i} fill={d.positive ? "#22c55e" : "#ef4444"} fillOpacity={0.65} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </motion.div>
  );
}
