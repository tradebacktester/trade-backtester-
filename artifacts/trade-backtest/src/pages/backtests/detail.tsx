import React from "react";
import { useRoute, Link, useLocation } from "wouter";
import { 
  useGetBacktest, 
  useDeleteBacktest,
  getListBacktestsQueryKey,
  useGetBacktestTrades,
  useGetEquityCurve
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Trash2, TrendingUp, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ComposedChart,
  Line
} from "recharts";

export default function BacktestDetail() {
  const [, params] = useRoute("/backtests/:id");
  const id = parseInt(params?.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: backtest, isLoading } = useGetBacktest(id, { query: { enabled: !!id, refetchInterval: (data) => (data?.state?.data?.status === 'running' || data?.state?.data?.status === 'pending' ? 1000 : false) } });
  const { data: trades, isLoading: isLoadingTrades } = useGetBacktestTrades(id, { query: { enabled: !!id && backtest?.status === 'complete' } });
  const { data: equityCurve, isLoading: isLoadingEquity } = useGetEquityCurve(id, { query: { enabled: !!id && backtest?.status === 'complete' } });
  
  const deleteBacktest = useDeleteBacktest();

  function handleDelete() {
    deleteBacktest.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBacktestsQueryKey() });
          toast({
            title: "Backtest Deleted",
            description: "The backtest result has been removed.",
          });
          setLocation("/backtests");
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.error || "Failed to delete backtest",
            variant: "destructive",
          });
        },
      }
    );
  }

  if (isLoading) {
    return <div className="space-y-6">
      <Skeleton className="h-10 w-[300px]" />
      <Skeleton className="h-40 w-full" />
    </div>;
  }

  if (!backtest) {
    return <div>Backtest not found.</div>;
  }

  const isRunning = backtest.status === 'pending' || backtest.status === 'running';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/backtests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {backtest.symbol} Backtest
            </h1>
            <Badge variant={backtest.status === 'complete' ? 'default' : backtest.status === 'failed' ? 'destructive' : 'secondary'} className="uppercase">
              {backtest.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Using <Link href={`/strategies/${backtest.strategyId}`} className="hover:underline text-primary">{backtest.strategyName || `Strategy #${backtest.strategyId}`}</Link> ({backtest.startDate} to {backtest.endDate})
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="icon">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete backtest?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the backtest results.
              </AlertDialogDescription>
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
            <p className="text-sm text-muted-foreground">This may take a few moments depending on the date range.</p>
          </CardContent>
        </Card>
      ) : backtest.status === 'failed' ? (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-12 flex flex-col items-center justify-center space-y-4 text-destructive">
            <AlertTriangle className="h-12 w-12" />
            <h3 className="text-lg font-medium">Simulation Failed</h3>
            <p className="text-sm">There was an error running this backtest. Please check your strategy parameters and try again.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <StatBox label="Initial Capital" value={`$${backtest.initialCapital.toLocaleString()}`} />
            <StatBox label="Final Capital" value={`$${backtest.finalCapital?.toLocaleString() || '-'}`} valueClass={backtest.finalCapital && backtest.finalCapital > backtest.initialCapital ? "profit" : "loss"} />
            <StatBox label="Total Return" value={backtest.totalReturn != null ? `${backtest.totalReturn.toFixed(2)}%` : '-'} valueClass={backtest.totalReturn && backtest.totalReturn >= 0 ? "profit" : "loss"} />
            <StatBox label="Ann. Return" value={backtest.annualizedReturn != null ? `${backtest.annualizedReturn.toFixed(2)}%` : '-'} valueClass={backtest.annualizedReturn && backtest.annualizedReturn >= 0 ? "profit" : "loss"} />
            <StatBox label="Max Drawdown" value={backtest.maxDrawdown != null ? `${backtest.maxDrawdown.toFixed(2)}%` : '-'} valueClass="text-destructive font-mono" />
            <StatBox label="Sharpe Ratio" value={backtest.sharpeRatio != null ? backtest.sharpeRatio.toFixed(2) : '-'} />
            <StatBox label="Win Rate" value={backtest.winRate != null ? `${(backtest.winRate * 100).toFixed(1)}%` : '-'} />
            <StatBox label="Total Trades" value={backtest.totalTrades ?? '-'} />
            <StatBox label="Profit Factor" value={backtest.profitFactor != null ? backtest.profitFactor.toFixed(2) : '-'} />
          </div>

          <Card className="border-border">
            <CardHeader>
              <CardTitle>Equity Curve</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingEquity ? (
                <Skeleton className="h-[400px] w-full" />
              ) : equityCurve && equityCurve.length > 0 ? (
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={equityCurve} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                        tickFormatter={(val) => format(new Date(val), "MMM d")}
                        minTickGap={50}
                      />
                      <YAxis 
                        yAxisId="left"
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                        tickFormatter={(val) => `$${val.toLocaleString()}`}
                        domain={['auto', 'auto']}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        stroke="hsl(var(--destructive))" 
                        fontSize={12}
                        tickFormatter={(val) => `${val}%`}
                      />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem' }}
                        labelFormatter={(val) => format(new Date(val), "MMM d, yyyy")}
                        formatter={(value: number, name: string) => [
                          name === 'value' ? `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : `${value.toFixed(2)}%`, 
                          name === 'value' ? 'Equity' : 'Drawdown'
                        ]}
                      />
                      <Area yAxisId="left" type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorValue)" />
                      <Line yAxisId="right" type="monotone" dataKey="drawdown" stroke="hsl(var(--destructive))" dot={false} strokeWidth={1} opacity={0.5} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground border border-dashed rounded-md">
                  No equity data available.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle>Trade List</CardTitle>
              <CardDescription>All simulated trades executed during the backtest.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTrades ? (
                <Skeleton className="h-[400px] w-full" />
              ) : trades && trades.length > 0 ? (
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Side</TableHead>
                        <TableHead>Entry Date</TableHead>
                        <TableHead className="text-right">Entry Price</TableHead>
                        <TableHead>Exit Date</TableHead>
                        <TableHead className="text-right">Exit Price</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">P&L</TableHead>
                        <TableHead className="text-right">P&L %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trades.map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell>
                            <Badge variant={trade.side === 'long' ? 'default' : 'secondary'} className={trade.side === 'long' ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30 border-green-500/50' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30 border-red-500/50'}>
                              {trade.side.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{format(new Date(trade.entryDate), "MMM d, yyyy HH:mm")}</TableCell>
                          <TableCell className="text-right font-mono">${trade.entryPrice.toFixed(2)}</TableCell>
                          <TableCell className="font-mono text-xs">{format(new Date(trade.exitDate), "MMM d, yyyy HH:mm")}</TableCell>
                          <TableCell className="text-right font-mono">${trade.exitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">{trade.quantity}</TableCell>
                          <TableCell className={`text-right font-mono ${trade.pnl >= 0 ? 'profit' : 'loss'}`}>
                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                          </TableCell>
                          <TableCell className={`text-right font-mono ${trade.pnlPercent >= 0 ? 'profit' : 'loss'}`}>
                            {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-md">
                  No trades executed during this period.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value, valueClass = "font-mono" }: { label: string, value: React.ReactNode, valueClass?: string }) {
  return (
    <div className="bg-card border border-border p-4 rounded-lg flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}