import React, { useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useCreateBacktest, useListStrategies, getListBacktestsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Play, CheckCircle2, XCircle, Loader2, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { format, subYears } from "date-fns";
import { SYMBOLS } from "./new";

interface BatchResult {
  symbol: string;
  status: "pending" | "running" | "complete" | "failed";
  backtestId?: number;
  totalReturn?: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
  calmarRatio?: number;
  maxDrawdown?: number;
  winRate?: number;
  totalTrades?: number;
  benchmarkReturn?: number;
  error?: string;
}

function fmtPct(v: number | undefined) {
  if (v == null) return "—";
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(2)}%`;
}
function fmtNum(v: number | undefined) {
  if (v == null) return "—";
  return v.toFixed(2);
}

export default function BatchBacktest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: strategies, isLoading: isLoadingStrategies } = useListStrategies();
  const createBacktest = useCreateBacktest();

  const [strategyId, setStrategyId] = useState<number>(0);
  const [startDate, setStartDate] = useState(format(subYears(new Date(), 2), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [initialCapital, setInitialCapital] = useState(100000);
  const [commission, setCommission] = useState(0.1);
  const [slippage, setSlippage] = useState(0.05);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(["AAPL", "MSFT", "TSLA"]);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  function toggleSymbol(sym: string) {
    setSelectedSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  }

  const runBatch = useCallback(async () => {
    if (!strategyId || selectedSymbols.length === 0) {
      toast({ title: "Missing setup", description: "Pick a strategy and at least one symbol.", variant: "destructive" });
      return;
    }

    setIsRunning(true);
    const initialResults: BatchResult[] = selectedSymbols.map((sym) => ({
      symbol: sym,
      status: "pending",
    }));
    setResults(initialResults);

    for (let i = 0; i < selectedSymbols.length; i++) {
      const sym = selectedSymbols[i];
      setResults((prev) => prev.map((r) => r.symbol === sym ? { ...r, status: "running" } : r));

      await new Promise<void>((resolve) => {
        createBacktest.mutate(
          {
            data: {
              strategyId,
              symbol: sym,
              startDate,
              endDate,
              initialCapital,
              commission,
              slippage,
            },
          },
          {
            onSuccess: (bt) => {
              queryClient.invalidateQueries({ queryKey: getListBacktestsQueryKey() });
              setResults((prev) =>
                prev.map((r) =>
                  r.symbol === sym
                    ? {
                        ...r,
                        status: "complete",
                        backtestId: bt.id,
                        totalReturn: bt.totalReturn ?? undefined,
                        sharpeRatio: bt.sharpeRatio ?? undefined,
                        sortinoRatio: (bt as any).sortinoRatio ?? undefined,
                        calmarRatio: (bt as any).calmarRatio ?? undefined,
                        maxDrawdown: bt.maxDrawdown ?? undefined,
                        winRate: bt.winRate ?? undefined,
                        totalTrades: bt.totalTrades ?? undefined,
                        benchmarkReturn: (bt as any).benchmarkReturn ?? undefined,
                      }
                    : r
                )
              );
              resolve();
            },
            onError: (err: any) => {
              setResults((prev) =>
                prev.map((r) =>
                  r.symbol === sym ? { ...r, status: "failed", error: err?.data?.error || "Failed" } : r
                )
              );
              resolve();
            },
          }
        );
      });
    }

    setIsRunning(false);
    toast({ title: "Batch complete!", description: `Ran ${selectedSymbols.length} backtests.` });
  }, [strategyId, selectedSymbols, startDate, endDate, initialCapital, commission, slippage, createBacktest, queryClient, toast]);

  const completed = results.filter((r) => r.status === "complete");
  const bestReturn = completed.length > 0 ? Math.max(...completed.map((r) => r.totalReturn ?? -Infinity)) : null;
  const worstReturn = completed.length > 0 ? Math.min(...completed.map((r) => r.totalReturn ?? Infinity)) : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/backtests/new">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Multi-Symbol Batch Test</h1>
          <p className="text-muted-foreground">Run the same strategy across multiple symbols simultaneously.</p>
        </div>
      </div>

      {/* Setup */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Strategy & Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Strategy</label>
              <Select
                value={strategyId ? strategyId.toString() : ""}
                onValueChange={(v) => setStrategyId(parseInt(v, 10))}
                disabled={isLoadingStrategies}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingStrategies ? "Loading..." : "Select a strategy"} />
                </SelectTrigger>
                <SelectContent>
                  {strategies?.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Start Date</label>
                <Input type="date" className="font-mono" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">End Date</label>
                <Input type="date" className="font-mono" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Initial Capital ($)</label>
              <Input
                type="number"
                className="font-mono"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Commission (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  className="font-mono"
                  value={commission}
                  onChange={(e) => setCommission(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Slippage (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  className="font-mono"
                  value={slippage}
                  onChange={(e) => setSlippage(Number(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Symbols</CardTitle>
            <CardDescription>Select which symbols to test ({selectedSymbols.length} selected)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {SYMBOLS.map((sym) => {
                const active = selectedSymbols.includes(sym.value);
                return (
                  <button
                    key={sym.value}
                    type="button"
                    onClick={() => toggleSymbol(sym.value)}
                    disabled={isRunning}
                    className={`px-3 py-1.5 rounded-lg text-sm font-mono font-medium border transition-all ${
                      active
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "text-muted-foreground border-border hover:border-muted-foreground"
                    }`}
                  >
                    {sym.value}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedSymbols(SYMBOLS.map(s => s.value))}
                disabled={isRunning}
                className="text-xs"
              >
                All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedSymbols([])}
                disabled={isRunning}
                className="text-xs"
              >
                None
              </Button>
            </div>

            <Button
              className="w-full mt-4"
              onClick={runBatch}
              disabled={isRunning || !strategyId || selectedSymbols.length === 0}
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run {selectedSymbols.length} Backtest{selectedSymbols.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results table */}
      {results.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Batch Results</CardTitle>
                <CardDescription>
                  {completed.length} / {results.length} completed
                </CardDescription>
              </div>
              {completed.length > 1 && (
                <div className="flex gap-3 text-xs">
                  <span className="text-green-500 font-mono font-medium">Best: {fmtPct(bestReturn ?? undefined)}</span>
                  <span className="text-red-500 font-mono font-medium">Worst: {fmtPct(worstReturn ?? undefined)}</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left pb-2 pr-4">Symbol</th>
                    <th className="text-left pb-2 pr-4">Status</th>
                    <th className="text-right pb-2 pr-4">Return</th>
                    <th className="text-right pb-2 pr-4">vs Buy&Hold</th>
                    <th className="text-right pb-2 pr-4">Max DD</th>
                    <th className="text-right pb-2 pr-4">Sharpe</th>
                    <th className="text-right pb-2 pr-4">Sortino</th>
                    <th className="text-right pb-2 pr-4">Calmar</th>
                    <th className="text-right pb-2 pr-4">Win%</th>
                    <th className="text-right pb-2">Trades</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const isTop = r.status === "complete" && r.totalReturn === bestReturn && (completed.length > 1);
                    const alpha = r.totalReturn != null && r.benchmarkReturn != null
                      ? r.totalReturn - r.benchmarkReturn
                      : undefined;
                    return (
                      <tr
                        key={r.symbol}
                        className={`border-b border-border/50 last:border-0 ${isTop ? "bg-green-500/5" : ""}`}
                      >
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            {r.backtestId ? (
                              <Link
                                href={`/backtests/${r.backtestId}`}
                                className="font-mono font-semibold text-primary hover:underline"
                              >
                                {r.symbol}
                              </Link>
                            ) : (
                              <span className="font-mono font-semibold">{r.symbol}</span>
                            )}
                            {isTop && <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px] px-1.5">best</Badge>}
                          </div>
                        </td>
                        <td className="py-2.5 pr-4">
                          {r.status === "pending" && <span className="text-muted-foreground text-xs">Pending</span>}
                          {r.status === "running" && (
                            <span className="flex items-center gap-1 text-yellow-500 text-xs">
                              <Loader2 className="h-3 w-3 animate-spin" />Running
                            </span>
                          )}
                          {r.status === "complete" && (
                            <span className="flex items-center gap-1 text-green-500 text-xs">
                              <CheckCircle2 className="h-3 w-3" />Done
                            </span>
                          )}
                          {r.status === "failed" && (
                            <span className="flex items-center gap-1 text-red-500 text-xs">
                              <XCircle className="h-3 w-3" />Failed
                            </span>
                          )}
                        </td>
                        <td className={`py-2.5 pr-4 text-right font-mono text-xs font-medium ${(r.totalReturn ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {fmtPct(r.totalReturn)}
                        </td>
                        <td className={`py-2.5 pr-4 text-right font-mono text-xs ${alpha == null ? "text-muted-foreground" : alpha >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {alpha != null ? (
                            <span className="flex items-center justify-end gap-0.5">
                              {alpha >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {fmtPct(alpha)}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs text-red-400">
                          {r.maxDrawdown != null ? `-${r.maxDrawdown.toFixed(2)}%` : "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs text-muted-foreground">
                          {fmtNum(r.sharpeRatio)}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs text-muted-foreground">
                          {fmtNum(r.sortinoRatio)}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs text-muted-foreground">
                          {fmtNum(r.calmarRatio)}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs text-muted-foreground">
                          {r.winRate != null ? `${r.winRate.toFixed(1)}%` : "—"}
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">
                          {r.totalTrades ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
