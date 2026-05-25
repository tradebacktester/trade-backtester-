import React from "react";
import { Link } from "wouter";
import { useListBacktests } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Activity, Cpu, TrendingUp, TrendingDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function Backtests() {
  const { data: backtests, isLoading } = useListBacktests();

  const completed = backtests?.filter((b) => b.status === "complete") ?? [];
  const avgReturn = completed.length
    ? completed.reduce((a, b) => a + (b.totalReturn ?? 0), 0) / completed.length
    : null;
  const bestReturn = completed.length ? Math.max(...completed.map((b) => b.totalReturn ?? -Infinity)) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
      {completed.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Runs</div>
            <div className="text-2xl font-bold font-mono">{backtests?.length ?? 0}</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Return</div>
            <div className={`text-2xl font-bold font-mono ${avgReturn != null && avgReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
              {avgReturn != null ? `${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(2)}%` : "—"}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Best Return</div>
            <div className="text-2xl font-bold font-mono text-green-500">
              {bestReturn != null ? `+${bestReturn.toFixed(2)}%` : "—"}
            </div>
          </div>
        </div>
      )}

      <Card className="border-border">
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : backtests && backtests.length > 0 ? (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
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
                  {backtests.map((bt) => {
                    const isPositive = bt.totalReturn != null && bt.totalReturn >= 0;
                    return (
                      <TableRow key={bt.id} className="cursor-pointer hover:bg-muted/30">
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
            <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl flex flex-col items-center gap-4">
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
