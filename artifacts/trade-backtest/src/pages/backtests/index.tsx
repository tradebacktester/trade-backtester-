import React from "react";
import { Link } from "wouter";
import { useListBacktests } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Activity } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function Backtests() {
  const { data: backtests, isLoading } = useListBacktests();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Backtests</h1>
          <p className="text-muted-foreground">All historical backtest runs across your strategies.</p>
        </div>
        <Button asChild>
          <Link href="/backtests/new">
            <Play className="mr-2 h-4 w-4" />
            Run Backtest
          </Link>
        </Button>
      </div>

      <Card className="border-border">
        <CardContent className="pt-6">
          {isLoading ? <Skeleton className="h-[400px] w-full" /> : backtests && backtests.length > 0 ? (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                    <TableHead className="text-right">Sharpe</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backtests.map((bt) => (
                    <TableRow key={bt.id}>
                      <TableCell className="font-medium">
                        <Link href={`/strategies/${bt.strategyId}`} className="hover:underline text-primary">
                          {bt.strategyName || `Strategy #${bt.strategyId}`}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{bt.symbol}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{bt.startDate} to {bt.endDate}</TableCell>
                      <TableCell className={`text-right font-mono font-medium ${bt.totalReturn && bt.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {bt.totalReturn != null ? `${bt.totalReturn.toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {bt.sharpeRatio != null ? bt.sharpeRatio.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={bt.status === 'complete' ? 'default' : bt.status === 'failed' ? 'destructive' : 'secondary'}>
                          {bt.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/backtests/${bt.id}`}>Results</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-md flex flex-col items-center gap-4">
              <Activity className="h-10 w-10 opacity-20" />
              <div>
                <h3 className="text-lg font-medium text-foreground">No backtests yet</h3>
                <p className="text-sm">Run your first backtest to see results here.</p>
              </div>
              <Button asChild variant="outline">
                <Link href="/backtests/new">Run Backtest</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}