import React from "react";
import { Link } from "wouter";
import { useListBacktests } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Activity, Cpu, TrendingUp, TrendingDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex gap-4 px-4 py-2.5">
        {[140, 60, 120, 70, 70, 60, 60, 60].map((w, i) => (
          <div key={i} className="skeleton-shimmer h-3 rounded" style={{ width: w }} />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: 5 }).map((_, ri) => (
        <div
          key={ri}
          className="flex gap-4 items-center px-4 py-3.5 rounded-xl border border-white/[0.05]"
          style={{ animationDelay: `${ri * 0.06}s` }}
        >
          {[140, 60, 120, 70, 70, 60, 60, 80].map((w, ci) => (
            <div
              key={ci}
              className="skeleton-shimmer h-3.5 rounded"
              style={{ width: w }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Backtests() {
  const { data: backtests, isLoading } = useListBacktests();

  const completed = backtests?.filter((b) => b.status === "complete") ?? [];
  const avgReturn = completed.length
    ? completed.reduce((a, b) => a + (b.totalReturn ?? 0), 0) / completed.length
    : null;
  const bestReturn = completed.length ? Math.max(...completed.map((b) => b.totalReturn ?? -Infinity)) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="float-up flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Backtests</h1>
          <p className="text-muted-foreground">All historical backtest runs across your strategies.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/backtests/builder">
              <Cpu className="mr-2 h-4 w-4" />
              Strategy Builder
            </Link>
          </Button>
          <Button asChild>
            <Link href="/backtests/new">
              <Play className="mr-2 h-4 w-4" />
              Run Backtest
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      {(isLoading || completed.length > 0) && (
        <div className="float-up-1 grid grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card rounded-xl p-4">
                <div className="skeleton-shimmer h-3 w-20 rounded mb-3" />
                <div className="skeleton-shimmer h-7 w-24 rounded" />
              </div>
            ))
          ) : (
            <>
              <div className="glass-card neon-hover-subtle rounded-xl p-4 border border-white/[0.07]">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Runs</div>
                <div className="text-2xl font-bold font-mono glow-text">{backtests?.length ?? 0}</div>
              </div>
              <div className="glass-card neon-hover-subtle rounded-xl p-4 border border-white/[0.07]">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Return</div>
                <div className={`text-2xl font-bold font-mono ${avgReturn != null && avgReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {avgReturn != null ? `${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(2)}%` : "—"}
                </div>
              </div>
              <div className="glass-card neon-hover-subtle rounded-xl p-4 border border-white/[0.07]">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Best Return</div>
                <div className="text-2xl font-bold font-mono text-green-500">
                  {bestReturn != null ? `+${bestReturn.toFixed(2)}%` : "—"}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Main table card */}
      <Card className="float-up-2 glass-card border-0">
        <CardContent className="pt-6">
          {isLoading ? (
            <TableSkeleton />
          ) : backtests && backtests.length > 0 ? (
            <div className="rounded-xl border border-white/[0.07] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-white/[0.07]">
                    <TableHead>Strategy</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                    <TableHead className="text-right">Max DD</TableHead>
                    <TableHead className="text-right">Sharpe</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backtests.map((bt, i) => {
                    const isPositive = bt.totalReturn != null && bt.totalReturn >= 0;
                    return (
                      <TableRow
                        key={bt.id}
                        className="cursor-pointer hover:bg-white/[0.03] border-white/[0.05] transition-colors duration-150"
                        style={{ animationDelay: `${i * 0.04}s` }}
                      >
                        <TableCell className="font-medium">
                          <Link href={`/strategies/${bt.strategyId}`} className="hover:underline text-primary">
                            {bt.strategyName || `Strategy #${bt.strategyId}`}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{bt.symbol}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{bt.startDate} → {bt.endDate}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono font-semibold flex items-center justify-end gap-1 ${isPositive ? "text-green-500" : "text-red-500"}`}>
                            {isPositive
                              ? <TrendingUp className="h-3.5 w-3.5" />
                              : <TrendingDown className="h-3.5 w-3.5" />}
                            {bt.totalReturn != null ? `${bt.totalReturn.toFixed(2)}%` : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-400">
                          {bt.maxDrawdown != null ? `−${bt.maxDrawdown.toFixed(2)}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {bt.sharpeRatio != null ? bt.sharpeRatio.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {bt.winRate != null ? `${bt.winRate.toFixed(1)}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={bt.status === "complete" ? "default" : bt.status === "failed" ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {bt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/backtests/${bt.id}`}>Results →</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground border border-dashed border-white/[0.07] rounded-xl flex flex-col items-center gap-4">
              <Activity className="h-10 w-10 opacity-20" />
              <div>
                <h3 className="text-lg font-medium text-foreground">No backtests yet</h3>
                <p className="text-sm">Run your first backtest or use the Strategy Builder to get started.</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" asChild>
                  <Link href="/backtests/builder">
                    <Cpu className="mr-2 h-4 w-4" />
                    Strategy Builder
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/backtests/new">Run Backtest</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
