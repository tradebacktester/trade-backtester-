import React from "react";
import { useRoute, Link } from "wouter";
import { useGetStrategy, useGetStrategyPerformance, useListBacktests } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Play, Settings2, Activity } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function StrategyDetail() {
  const [, params] = useRoute("/strategies/:id");
  const id = parseInt(params?.id || "0", 10);

  const { data: strategy, isLoading: isLoadingStrategy } = useGetStrategy(id, { query: { enabled: !!id } as any });
  const { data: performance, isLoading: isLoadingPerf } = useGetStrategyPerformance(id, { query: { enabled: !!id } as any });
  const { data: backtests, isLoading: isLoadingBacktests } = useListBacktests({ strategyId: id }, { query: { enabled: !!id } as any });

  if (isLoadingStrategy) {
    return <div className="space-y-6"><Skeleton className="h-10 w-[200px]" /><Skeleton className="h-40 w-full" /></div>;
  }

  if (!strategy) {
    return <div>Strategy not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/strategies">
            <ArrowLeft className="h-4 w-4" />
          </Link>
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
                  <div className="text-lg font-mono font-bold">{(performance.avgWinRate * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Avg Sharpe</div>
                  <div className="text-lg font-mono font-bold">{performance.avgSharpe.toFixed(2)}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No performance data available.</div>
            )}
          </CardContent>
        </Card>
      </div>

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
                      <TableCell className="text-xs">{bt.startDate} - {bt.endDate}</TableCell>
                      <TableCell className={`text-right font-mono ${bt.totalReturn && bt.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {bt.totalReturn != null ? `${bt.totalReturn.toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {bt.winRate != null ? `${(bt.winRate * 100).toFixed(1)}%` : '-'}
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
    </div>
  );
}