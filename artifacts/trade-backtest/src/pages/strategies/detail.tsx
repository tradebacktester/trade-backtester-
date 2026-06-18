import React, { useState, useRef, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useGetStrategy, useGetStrategyPerformance, useListBacktests } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkeletonPulse as Skeleton } from "@/components/ui/skeleton-cards";
import { ArrowLeft, Play, Settings2, Shuffle, Loader2, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";
import * as Tabs from "@radix-ui/react-tabs";

const PARAM_DEFAULTS: Record<string, { p1Name: string; p1Vals: string; p2Name: string; p2Vals: string }> = {
  "SMA Crossover":     { p1Name: "fast", p1Vals: "5,10,15,20", p2Name: "slow", p2Vals: "30,40,50,60" },
  "EMA Crossover":     { p1Name: "fast", p1Vals: "5,10,15,20", p2Name: "slow", p2Vals: "30,40,50,60" },
  "RSI":               { p1Name: "period", p1Vals: "7,10,14,21", p2Name: "overbought", p2Vals: "65,70,75,80" },
  "MACD":              { p1Name: "fast", p1Vals: "8,10,12,14", p2Name: "slow", p2Vals: "20,24,26,30" },
  "Bollinger Bands":   { p1Name: "period", p1Vals: "10,15,20,25", p2Name: "stdDev", p2Vals: "1.5,2,2.5,3" },
};

function fmtPct(v: number) {
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

type OptResult = {
  p1: number; p2: number;
  totalReturn: number; sharpeRatio: number; maxDrawdown: number; winRate: number;
};

export default function StrategyDetail() {
  const [, params] = useRoute("/strategies/:id");
  const id = parseInt(params?.id || "0", 10);
  const { token } = useAuth();

  const { data: strategy, isLoading: isLoadingStrategy } = useGetStrategy(id, { query: { enabled: !!id } as any });
  const { data: performance, isLoading: isLoadingPerf } = useGetStrategyPerformance(id, { query: { enabled: !!id } as any });
  const { data: backtests, isLoading: isLoadingBacktests } = useListBacktests({ strategyId: id }, { query: { enabled: !!id } as any });

  const [tab, setTab] = useState("backtests");

  const defaults = strategy ? (PARAM_DEFAULTS[strategy.type] ?? { p1Name: "param1", p1Vals: "5,10,15,20", p2Name: "param2", p2Vals: "1,2,3,4" }) : { p1Name: "param1", p1Vals: "5,10,15,20", p2Name: "param2", p2Vals: "1,2,3,4" };

  const [p1Name, setP1Name] = useState("");
  const [p1Vals, setP1Vals] = useState("");
  const [p2Name, setP2Name] = useState("");
  const [p2Vals, setP2Vals] = useState("");
  const [optSymbol, setOptSymbol] = useState("");
  const [optStart, setOptStart] = useState("2023-01-01");
  const [optEnd, setOptEnd] = useState("2024-01-01");
  const [optCapital, setOptCapital] = useState("10000");

  const [optStatus, setOptStatus] = useState<"idle"|"running"|"done"|"error">("idle");
  const [optError, setOptError] = useState<string|null>(null);
  const [optResults, setOptResults] = useState<{
    param1Name: string; param1Values: number[];
    param2Name: string; param2Values: number[];
    results: OptResult[]; warning?: string;
  } | null>(null);

  const sseRef = useRef<EventSource|null>(null);

  useEffect(() => {
    if (strategy && !p1Name) {
      const d = PARAM_DEFAULTS[strategy.type] ?? defaults;
      setP1Name(d.p1Name);
      setP1Vals(d.p1Vals);
      setP2Name(d.p2Name);
      setP2Vals(d.p2Vals);
      setOptSymbol(strategy.symbol ?? "");
    }
  }, [strategy]);

  useEffect(() => () => { sseRef.current?.close(); }, []);

  function parseVals(s: string): number[] {
    return s.split(",").map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
  }

  async function runOptimize() {
    if (!strategy || !token) return;
    setOptStatus("running");
    setOptError(null);
    setOptResults(null);
    try {
      const r = await fetch(`${API_BASE}/api/backtests/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          strategyId: id,
          symbol: optSymbol || strategy.symbol,
          startDate: optStart,
          endDate: optEnd,
          initialCapital: parseFloat(optCapital),
          param1Name: p1Name,
          param1Values: parseVals(p1Vals),
          param2Name: p2Name,
          param2Values: parseVals(p2Vals),
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setOptError(e.error ?? "Optimization failed");
        setOptStatus("error");
        return;
      }
      const { jobId } = await r.json();
      const sse = new EventSource(`${API_BASE}/api/backtests/jobs/${jobId}/stream`, {});
      sseRef.current?.close();
      sseRef.current = sse;
      sse.addEventListener("result", (ev: MessageEvent) => {
        const data = JSON.parse(ev.data);
        setOptResults(data);
        setOptStatus("done");
        sse.close();
      });
      sse.addEventListener("error", (ev: MessageEvent) => {
        const data = JSON.parse((ev as any).data ?? "{}");
        setOptError(data.error ?? "Optimization failed");
        setOptStatus("error");
        sse.close();
      });
    } catch (e: any) {
      setOptError(e?.message ?? "Optimization failed");
      setOptStatus("error");
    }
  }

  if (isLoadingStrategy) {
    return <div className="space-y-6"><Skeleton className="h-10 w-[200px]" /><Skeleton className="h-40 w-full" /></div>;
  }
  if (!strategy) return <div>Strategy not found.</div>;

  const p1ValArr = parseVals(p1Vals);
  const p2ValArr = parseVals(p2Vals);
  const canRun = p1ValArr.length > 0 && p2ValArr.length > 0 && optStart && optEnd && parseFloat(optCapital) > 0;

  const bestResult = optResults ? [...optResults.results].sort((a, b) => b.totalReturn - a.totalReturn)[0] : null;
  const worstResult = optResults ? [...optResults.results].sort((a, b) => a.totalReturn - b.totalReturn)[0] : null;

  function cellColor(v: number, min: number, max: number): string {
    const t = max === min ? 0.5 : (v - min) / (max - min);
    const r = Math.round(239 - t * (239 - 34));
    const g = Math.round(68  + t * (197 - 68));
    const b = Math.round(68  - t * (68 - 94));
    return `rgba(${r},${g},${b},0.18)`;
  }

  const returnMin = optResults ? Math.min(...optResults.results.map(r => r.totalReturn)) : 0;
  const returnMax = optResults ? Math.max(...optResults.results.map(r => r.totalReturn)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/strategies"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{strategy.name}</h1>
          <p className="text-muted-foreground">{strategy.description || "No description."}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/strategies/${id}/edit`}>
              <Settings2 className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/backtests/new?strategyId=${id}`}>
              <Play className="mr-2 h-4 w-4" />
              Run Backtest
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Type</span>
              <span className="font-mono text-sm">{strategy.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Symbol</span>
              <span className="font-mono text-sm font-bold text-primary">{strategy.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-sm">Timeframe</span>
              <span className="font-mono text-sm">{strategy.timeframe}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Overall Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingPerf ? <Skeleton className="h-16 w-full" /> : performance ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Total Backtests</div>
                  <div className="text-lg font-mono font-bold">{performance.totalBacktests}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Avg Return</div>
                  <div className={`text-lg font-mono font-bold ${performance.avgReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {performance.avgReturn.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Avg Win Rate</div>
                  <div className="text-lg font-mono font-bold">{performance.avgWinRate.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Avg Sharpe</div>
                  <div className="text-lg font-mono font-bold">{performance.avgSharpe.toFixed(2)}</div>
                </div>
                {(performance as any).totalTrades > 0 && (
                  <>
                    <div>
                      <div className="text-xs text-muted-foreground">Total Trades</div>
                      <div className="text-lg font-mono font-bold">{(performance as any).totalTrades}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Profitable</div>
                      <div className="text-lg font-mono font-bold text-green-500">
                        {(performance as any).profitTrades} <span className="text-xs text-muted-foreground font-normal">wins</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Losing</div>
                      <div className="text-lg font-mono font-bold text-red-500">
                        {(performance as any).lossTrades} <span className="text-xs text-muted-foreground font-normal">losses</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Avg Drawdown</div>
                      <div className="text-lg font-mono font-bold text-yellow-500">{performance.avgMaxDrawdown.toFixed(1)}%</div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No performance data available.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="flex gap-1 p-1 rounded-xl border border-border bg-muted/30 w-fit mb-4">
          {[
            { value: "backtests", label: "Backtests" },
            { value: "optimize",  label: "Optimize" },
          ].map(({ value, label }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm cursor-pointer select-none"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="backtests">
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Backtests</CardTitle>
              <CardDescription>History of backtests run against this strategy.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingBacktests ? <Skeleton className="h-40 w-full" /> : backtests && backtests.length > 0 ? (
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Return</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backtests.map((bt) => (
                        <TableRow key={bt.id}>
                          <TableCell className="font-mono text-xs">{format(new Date(bt.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                          <TableCell className="font-mono">{bt.symbol}</TableCell>
                          <TableCell className="text-xs">{bt.startDate} – {bt.endDate}</TableCell>
                          <TableCell className={`text-right font-mono ${bt.totalReturn && bt.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {bt.totalReturn != null ? `${bt.totalReturn.toFixed(2)}%` : '–'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {bt.winRate != null ? `${bt.winRate.toFixed(1)}%` : '–'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={bt.status === 'complete' ? 'default' : bt.status === 'failed' ? 'destructive' : 'secondary'}>
                              {bt.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/backtests/${bt.id}`}>View</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-md">
                  No backtests found. Run one to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </Tabs.Content>

        <Tabs.Content value="optimize">
          <div className="space-y-5">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shuffle className="h-4 w-4 text-primary" />
                  Parameter Grid Search
                </CardTitle>
                <CardDescription>
                  Test every combination of two parameter ranges and find the configuration with the best risk-adjusted returns.
                  Values are comma-separated (e.g. <code>5,10,15,20</code>). Max 8 values per parameter.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Parameter 1 name</label>
                    <Input value={p1Name} onChange={e => setP1Name(e.target.value)} placeholder="e.g. fast" className="h-8 font-mono text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Parameter 1 values</label>
                    <Input value={p1Vals} onChange={e => setP1Vals(e.target.value)} placeholder="e.g. 5,10,15,20" className="h-8 font-mono text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Parameter 2 name</label>
                    <Input value={p2Name} onChange={e => setP2Name(e.target.value)} placeholder="e.g. slow" className="h-8 font-mono text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Parameter 2 values</label>
                    <Input value={p2Vals} onChange={e => setP2Vals(e.target.value)} placeholder="e.g. 30,40,50,60" className="h-8 font-mono text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Symbol</label>
                    <Input value={optSymbol} onChange={e => setOptSymbol(e.target.value)} placeholder={strategy.symbol} className="h-8 font-mono text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start date</label>
                    <Input type="date" value={optStart} onChange={e => setOptStart(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">End date</label>
                    <Input type="date" value={optEnd} onChange={e => setOptEnd(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Capital ($)</label>
                    <Input type="number" value={optCapital} onChange={e => setOptCapital(e.target.value)} className="h-8 font-mono text-sm" />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    size="sm"
                    onClick={runOptimize}
                    disabled={!canRun || optStatus === "running"}
                    className="h-8"
                  >
                    {optStatus === "running"
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Running…</>
                      : <><Shuffle className="h-3.5 w-3.5 mr-1.5" />Run Grid Search</>}
                  </Button>
                  {optStatus === "done" && (
                    <button onClick={() => { setOptResults(null); setOptStatus("idle"); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear</button>
                  )}
                  <span className="text-xs text-muted-foreground">{p1ValArr.length * p2ValArr.length} combinations</span>
                </div>
                {optError && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    {optError}
                  </div>
                )}
              </CardContent>
            </Card>

            {optResults && (
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Optimization Results — Return Heatmap</CardTitle>
                  <CardDescription className="text-xs">
                    Cell color = total return (green = best, red = worst). Hover for details.
                    {optResults.warning && <span className="text-yellow-500 ml-1">· {optResults.warning}</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bestResult && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Best Return", value: fmtPct(bestResult.totalReturn), color: "#22c55e" },
                        { label: "Best Sharpe", value: [...optResults.results].sort((a,b)=>b.sharpeRatio-a.sharpeRatio)[0]?.sharpeRatio.toFixed(2) ?? "–", color: "#38bdf8" },
                        { label: "Lowest Drawdown", value: fmtPct(-Math.min(...optResults.results.map(r=>r.maxDrawdown))), color: "#f59e0b" },
                        { label: "Worst Return", value: fmtPct(worstResult?.totalReturn ?? 0), color: "#ef4444" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="p-3 rounded-xl border border-border bg-card">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
                          <div className="text-base font-bold font-mono" style={{ color }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left text-muted-foreground font-normal p-1.5 pr-3">
                            {optResults.param1Name} \ {optResults.param2Name}
                          </th>
                          {optResults.param2Values.map(v2 => (
                            <th key={v2} className="text-center text-muted-foreground font-normal p-1.5 min-w-[64px]">{v2}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {optResults.param1Values.map(v1 => (
                          <tr key={v1}>
                            <td className="text-muted-foreground p-1.5 pr-3 font-medium">{v1}</td>
                            {optResults.param2Values.map(v2 => {
                              const r = optResults.results.find(x => x.p1 === v1 && x.p2 === v2);
                              const isBest = r && bestResult && r.p1 === bestResult.p1 && r.p2 === bestResult.p2;
                              return (
                                <td
                                  key={v2}
                                  className="text-center p-1.5 rounded cursor-default transition-all relative group"
                                  style={{
                                    background: r ? cellColor(r.totalReturn, returnMin, returnMax) : "transparent",
                                    border: isBest ? "1px solid #22c55e80" : "1px solid transparent",
                                    color: r ? (r.totalReturn >= 0 ? "#22c55e" : "#ef4444") : "hsl(var(--muted-foreground))",
                                    fontWeight: isBest ? 700 : 400,
                                  }}
                                  title={r ? `Return: ${fmtPct(r.totalReturn)} | Sharpe: ${r.sharpeRatio.toFixed(2)} | DD: ${r.maxDrawdown.toFixed(1)}% | Win: ${r.winRate.toFixed(1)}%` : "—"}
                                >
                                  {r ? fmtPct(r.totalReturn) : "—"}
                                  {isBest && (
                                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-400" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>{optResults.param1Name}</TableHead>
                          <TableHead>{optResults.param2Name}</TableHead>
                          <TableHead className="text-right">Return</TableHead>
                          <TableHead className="text-right">Sharpe</TableHead>
                          <TableHead className="text-right">Max DD</TableHead>
                          <TableHead className="text-right">Win Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...optResults.results].sort((a, b) => b.totalReturn - a.totalReturn).map((r, i) => (
                          <TableRow key={i} className={i === 0 ? "bg-green-500/5" : ""}>
                            <TableCell className="font-mono">{r.p1}</TableCell>
                            <TableCell className="font-mono">{r.p2}</TableCell>
                            <TableCell className={`text-right font-mono ${r.totalReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {fmtPct(r.totalReturn)}
                            </TableCell>
                            <TableCell className="text-right font-mono">{r.sharpeRatio.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono text-yellow-500">{r.maxDrawdown.toFixed(1)}%</TableCell>
                            <TableCell className="text-right font-mono">{r.winRate.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
