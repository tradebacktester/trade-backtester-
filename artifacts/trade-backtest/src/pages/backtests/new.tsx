import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useCreateBacktest, 
  useCreateStrategy,
  useListStrategies,
  getListBacktestsQueryKey,
  getListStrategiesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Play, TrendingUp, Activity, BarChart3, Zap, Target, Layers, ChevronDown, ChevronUp, Info } from "lucide-react";
import { format, subYears } from "date-fns";

const formSchema = z.object({
  strategyId: z.coerce.number().min(1, "Strategy is required"),
  symbol: z.string().min(1, "Symbol is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  initialCapital: z.coerce.number().min(100, "Minimum capital is 100"),
  commission: z.coerce.number().min(0).max(10).optional(),
  slippage: z.coerce.number().min(0).max(5).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export const SYMBOLS: { value: string; label: string; realData: boolean }[] = [
  // Crypto — real Binance historical OHLCV data
  { value: "BTCUSDT",  label: "BTC/USDT  ★ Real Data", realData: true },
  { value: "ETHUSDT",  label: "ETH/USDT  ★ Real Data", realData: true },
  { value: "SOLUSDT",  label: "SOL/USDT  ★ Real Data", realData: true },
  { value: "BNBUSDT",  label: "BNB/USDT  ★ Real Data", realData: true },
  { value: "XRPUSDT",  label: "XRP/USDT  ★ Real Data", realData: true },
  { value: "ADAUSDT",  label: "ADA/USDT  ★ Real Data", realData: true },
  { value: "DOGEUSDT", label: "DOGE/USDT ★ Real Data", realData: true },
  { value: "AVAXUSDT", label: "AVAX/USDT ★ Real Data", realData: true },
  { value: "LINKUSDT", label: "LINK/USDT ★ Real Data", realData: true },
  { value: "LTCUSDT",  label: "LTC/USDT  ★ Real Data", realData: true },
  { value: "DOTUSDT",  label: "DOT/USDT  ★ Real Data", realData: true },
  // Stocks & Indices — simulated data
  { value: "AAPL",  label: "Apple (AAPL)",     realData: false },
  { value: "MSFT",  label: "Microsoft (MSFT)", realData: false },
  { value: "TSLA",  label: "Tesla (TSLA)",     realData: false },
  { value: "NVDA",  label: "Nvidia (NVDA)",    realData: false },
  { value: "AMZN",  label: "Amazon (AMZN)",    realData: false },
  { value: "GOOGL", label: "Alphabet (GOOGL)", realData: false },
  { value: "SPY",   label: "S&P 500 ETF (SPY)",realData: false },
  { value: "QQQ",   label: "Nasdaq ETF (QQQ)", realData: false },
];

export const STRATEGY_TYPES = [
  {
    type: "sma_crossover",
    name: "SMA Crossover",
    description: "Buy when fast SMA crosses above slow SMA",
    icon: TrendingUp,
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.2)",
    params: { shortPeriod: 10, longPeriod: 50 },
  },
  {
    type: "ema_crossover",
    name: "EMA Crossover",
    description: "Exponential MA crossover for trend following",
    icon: Activity,
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.08)",
    border: "rgba(139,92,246,0.2)",
    params: { shortPeriod: 9, longPeriod: 21 },
  },
  {
    type: "rsi",
    name: "RSI Strategy",
    description: "Mean reversion using RSI overbought/oversold",
    icon: BarChart3,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.2)",
    params: { period: 14, overbought: 70, oversold: 30 },
  },
  {
    type: "macd",
    name: "MACD Strategy",
    description: "Trend momentum with MACD signal line crossover",
    icon: Zap,
    color: "#10b981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.2)",
    params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  },
  {
    type: "bollinger_bands",
    name: "Bollinger Bands",
    description: "Buy at lower band, sell at upper band",
    icon: Target,
    color: "#ec4899",
    bg: "rgba(236,72,153,0.08)",
    border: "rgba(236,72,153,0.2)",
    params: { period: 20, stdDev: 2 },
  },
] as const;

export default function NewBacktest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchParams = new URLSearchParams(window.location.search);
  const initialStrategyId = searchParams.get("strategyId");
  const [creatingStrategyType, setCreatingStrategyType] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: strategies, isLoading: isLoadingStrategies } = useListStrategies();
  const createBacktest = useCreateBacktest();
  const createStrategy = useCreateStrategy();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      strategyId: initialStrategyId ? parseInt(initialStrategyId, 10) : 0,
      symbol: "BTCUSDT",
      startDate: format(subYears(new Date(), 2), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
      initialCapital: 100000,
      commission: 0.1,
      slippage: 0.05,
    },
  });

  function normalizeToSymbolValue(sym: string): string {
    const direct = SYMBOLS.find(s => s.value === sym);
    if (direct) return direct.value;
    const stripped = sym.replace("/", "");
    const stripMatch = SYMBOLS.find(s => s.value === stripped);
    if (stripMatch) return stripMatch.value;
    return "BTCUSDT";
  }

  React.useEffect(() => {
    const sub = form.watch((value, { name }) => {
      if (name === "strategyId" && strategies) {
        const strategy = strategies.find(s => s.id === value.strategyId);
        if (strategy) form.setValue("symbol", normalizeToSymbolValue(strategy.symbol));
      }
    });
    return () => sub.unsubscribe();
  }, [form, strategies]);

  function handleQuickCreate(typeDef: typeof STRATEGY_TYPES[number]) {
    const symbol = form.getValues("symbol") || "AAPL";
    setCreatingStrategyType(typeDef.type);
    createStrategy.mutate(
      {
        data: {
          name: `${typeDef.name} (${symbol})`,
          description: typeDef.description,
          type: typeDef.type,
          symbol,
          timeframe: "1d",
          parameters: typeDef.params as Record<string, number>,
        },
      },
      {
        onSuccess: (strategy) => {
          queryClient.invalidateQueries({ queryKey: getListStrategiesQueryKey() });
          form.setValue("strategyId", strategy.id);
          toast({ title: "Strategy created", description: `${typeDef.name} strategy is ready.` });
          setCreatingStrategyType(null);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create strategy", variant: "destructive" });
          setCreatingStrategyType(null);
        },
      }
    );
  }

  function onSubmit(data: FormValues) {
    createBacktest.mutate(
      { data: {
        strategyId: data.strategyId,
        symbol: data.symbol,
        startDate: data.startDate,
        endDate: data.endDate,
        initialCapital: data.initialCapital,
        commission: data.commission ?? 0,
        slippage: data.slippage ?? 0,
      }},
      {
        onSuccess: (backtest) => {
          queryClient.invalidateQueries({ queryKey: getListBacktestsQueryKey() });
          toast({ title: "Backtest Started", description: "Your backtest is now running." });
          setLocation(`/backtests/${backtest.id}`);
        },
        onError: (error: { data?: { error?: string } | null }) => {
          toast({
            title: "Error",
            description: error.data?.error || "Failed to start backtest",
            variant: "destructive",
          });
        },
      }
    );
  }

  const hasStrategies = !isLoadingStrategies && strategies && strategies.length > 0;
  const noStrategies = !isLoadingStrategies && (!strategies || strategies.length === 0);
  const commissionVal = form.watch("commission") ?? 0;
  const slippageVal = form.watch("slippage") ?? 0;
  const totalCostEstimate = (commissionVal * 2 + slippageVal * 2).toFixed(3);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/backtests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Run Backtest</h1>
          <p className="text-muted-foreground">Test a strategy against historical data.</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/backtests/batch">
            <Layers className="mr-2 h-4 w-4" />
            Batch Test
          </Link>
        </Button>
      </div>

      {/* Strategy quick-create cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">
            {noStrategies ? "Choose a strategy type to get started:" : "Quick-add a new strategy:"}
          </p>
          {hasStrategies && (
            <span className="text-xs text-muted-foreground">{strategies!.length} existing</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STRATEGY_TYPES.map((typeDef) => {
            const Icon = typeDef.icon;
            const isCreating = creatingStrategyType === typeDef.type;
            return (
              <button
                key={typeDef.type}
                type="button"
                disabled={createStrategy.isPending}
                onClick={() => handleQuickCreate(typeDef)}
                className="flex items-start gap-3 p-3 rounded-xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: typeDef.bg, borderColor: typeDef.border }}
              >
                <span
                  className="mt-0.5 h-7 w-7 flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ background: `${typeDef.color}20`, color: typeDef.color }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{typeDef.name}</p>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">{typeDef.description}</p>
                </div>
                <span
                  className="mt-1 flex-shrink-0 h-5 w-5 flex items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: typeDef.color, color: "#fff" }}
                >
                  {isCreating ? "…" : "+"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="strategyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Strategy</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(parseInt(val, 10))} 
                      value={field.value ? field.value.toString() : ""}
                      disabled={isLoadingStrategies}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingStrategies ? "Loading..." : "Select a strategy"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {noStrategies ? (
                          <div className="px-3 py-4 text-center space-y-1">
                            <p className="text-xs text-muted-foreground">No strategies yet — use the cards above to create one.</p>
                          </div>
                        ) : (
                          strategies?.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {s.name} ({s.timeframe})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Symbol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="font-mono">
                          <SelectValue placeholder="Select symbol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SYMBOLS.map((s) => (
                          <SelectItem key={s.value} value={s.value} className="font-mono">
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="initialCapital"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Capital ($)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} className="font-mono" />
                    </FormControl>
                    <FormDescription>Starting balance for the simulation</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Advanced settings toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Advanced Settings (Commission & Slippage)
                </button>

                {showAdvanced && (
                  <div className="mt-4 p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                    <div className="flex items-start gap-2 text-xs text-muted-foreground p-2 rounded-lg bg-muted/30">
                      <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>
                        Commission and slippage are applied on every trade entry and exit.
                        Estimated round-trip cost per trade: <span className="font-mono text-foreground">~{totalCostEstimate}%</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="commission"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Commission (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="10"
                                {...field}
                                className="font-mono"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">Per-side fee (e.g. 0.1 = 0.1%)</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="slippage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Slippage (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="5"
                                {...field}
                                className="font-mono"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">Price impact per side (e.g. 0.05 = 0.05%)</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={createBacktest.isPending || !form.watch("strategyId")}>
                  {createBacktest.isPending ? "Starting..." : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Simulation
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
