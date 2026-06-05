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
  type StrategyInputType,
  type StrategyInputTimeframe,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Play, TrendingUp, Activity, BarChart3, Zap, Target, Layers, ChevronDown, ChevronUp, Info, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { format, subYears } from "date-fns";

const formSchema = z.object({
  strategyId: z.coerce.number().min(1, "Strategy is required"),
  symbol: z.string().min(1, "Symbol is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  initialCapital: z.coerce.number().min(100, "Minimum capital is 100"),
  commission: z.coerce.number().min(0).max(10).optional(),
  slippage: z.coerce.number().min(0).max(5).optional(),
  positionSizingMode: z.enum(["pct_capital", "fixed_amount"]).default("pct_capital"),
  positionSizingValue: z.coerce.number().positive().optional(),
}).refine(
  (data) => data.startDate < data.endDate,
  { message: "End date must be after start date", path: ["endDate"] }
).refine(
  (data) => {
    const diffDays = (new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / 86_400_000;
    return diffDays >= 90;
  },
  { message: "Date range must be at least 3 months — the engine needs 90+ daily bars to produce meaningful results", path: ["endDate"] }
);

type FormValues = z.infer<typeof formSchema>;

// All backtest data uses deterministic simulated OHLCV prices (generatePriceData).
// Real-time live ticker prices in the chart are streamed from Binance WebSocket,
// but historical data for backtesting is ALWAYS simulated — no real price history.
export const SYMBOLS: { value: string; label: string; realData: boolean }[] = [
  // Crypto
  { value: "BTCUSDT",  label: "BTC/USDT",  realData: false },
  { value: "ETHUSDT",  label: "ETH/USDT",  realData: false },
  { value: "SOLUSDT",  label: "SOL/USDT",  realData: false },
  { value: "BNBUSDT",  label: "BNB/USDT",  realData: false },
  { value: "XRPUSDT",  label: "XRP/USDT",  realData: false },
  { value: "ADAUSDT",  label: "ADA/USDT",  realData: false },
  { value: "DOGEUSDT", label: "DOGE/USDT", realData: false },
  { value: "AVAXUSDT", label: "AVAX/USDT", realData: false },
  { value: "LINKUSDT", label: "LINK/USDT", realData: false },
  { value: "LTCUSDT",  label: "LTC/USDT",  realData: false },
  { value: "DOTUSDT",  label: "DOT/USDT",  realData: false },
  // Stocks & Indices
  { value: "AAPL",  label: "Apple (AAPL)",      realData: false },
  { value: "MSFT",  label: "Microsoft (MSFT)",  realData: false },
  { value: "TSLA",  label: "Tesla (TSLA)",      realData: false },
  { value: "NVDA",  label: "Nvidia (NVDA)",     realData: false },
  { value: "AMZN",  label: "Amazon (AMZN)",     realData: false },
  { value: "GOOGL", label: "Alphabet (GOOGL)",  realData: false },
  { value: "SPY",   label: "S&P 500 ETF (SPY)", realData: false },
  { value: "QQQ",   label: "Nasdaq ETF (QQQ)",  realData: false },
];

export const STRATEGY_TYPES = [
  { type: "sma_crossover",     name: "SMA Crossover",            description: "Buy when fast SMA crosses above slow SMA",          icon: TrendingUp, color: "#3b82f6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.2)",  params: { fastPeriod: 10, slowPeriod: 50 } },
  { type: "ema_crossover",     name: "EMA Crossover",            description: "Exponential MA crossover for trend following",       icon: Activity,   color: "#8b5cf6", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.2)",  params: { fastPeriod: 9, slowPeriod: 21 } },
  { type: "rsi",               name: "RSI Mean Reversion",       description: "Mean reversion using RSI overbought/oversold",      icon: BarChart3,  color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)",  params: { period: 14, overbought: 70, oversold: 30 } },
  { type: "macd",              name: "MACD Strategy",            description: "Trend momentum with MACD signal line crossover",    icon: Zap,        color: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)",  params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
  { type: "bollinger_bands",   name: "Bollinger Bands",          description: "Buy at lower band, sell at upper band",             icon: Target,     color: "#ec4899", bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.2)",  params: { period: 20, stdDev: 2 } },
  { type: "super_trend",       name: "Super Trend",              description: "ATR-based dynamic support/resistance trend channel", icon: TrendingUp, color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)",  params: { period: 10, multiplier: 3 } },
  { type: "breakout",          name: "Breakout Strategy",        description: "Enter on N-bar high breakout, exit on channel low", icon: Zap,        color: "#14b8a6", bg: "rgba(20,184,166,0.08)", border: "rgba(20,184,166,0.2)",  params: { entryPeriod: 20, exitPeriod: 10 } },
  { type: "vwap",              name: "VWAP Strategy",            description: "Trade price crossovers above/below the VWAP",      icon: Activity,   color: "#6366f1", bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.2)",  params: { rsiPeriod: 14, oversold: 40 } },
  { type: "macd_rsi",          name: "MACD + RSI Combo",         description: "MACD crossover entries filtered by RSI momentum",  icon: BarChart3,  color: "#a855f7", bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.2)",  params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, rsiPeriod: 14, rsiOverbought: 70 } },
  { type: "donchian_breakout", name: "Donchian Channel Breakout",description: "Donchian high/low channel breakout entries",       icon: Target,     color: "#84cc16", bg: "rgba(132,204,22,0.08)", border: "rgba(132,204,22,0.2)",  params: { entryPeriod: 20, exitPeriod: 10 } },
  { type: "bollinger_reversal",name: "Bollinger Band Reversal",  description: "Mean reversion from lower band back to midline",   icon: TrendingUp, color: "#f43f5e", bg: "rgba(244,63,94,0.08)",  border: "rgba(244,63,94,0.2)",   params: { period: 20, stdDev: 2 } },
  { type: "orb",               name: "Opening Range Breakout",   description: "Trade breakouts from the N-bar opening range",     icon: Zap,        color: "#0ea5e9", bg: "rgba(14,165,233,0.08)", border: "rgba(14,165,233,0.2)",  params: { rangePeriod: 5, holdDays: 10 } },
  { type: "trend_following",   name: "Trend Following Bundle",   description: "EMA 50/200 golden cross with RSI momentum filter", icon: TrendingUp, color: "#22c55e", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.2)",   params: { fastEma: 50, slowEma: 200, rsiPeriod: 14 } },
  { type: "golden_cross",      name: "Golden Cross Strategy",    description: "Classic 50/200 SMA golden cross long entry",       icon: Activity,   color: "#eab308", bg: "rgba(234,179,8,0.08)",  border: "rgba(234,179,8,0.2)",   params: { fastPeriod: 50, slowPeriod: 200 } },
  { type: "turtle_trading",    name: "Turtle Trading System",    description: "20-day Donchian breakout entry, 10-day exit",      icon: BarChart3,  color: "#64748b", bg: "rgba(100,116,139,0.08)",border: "rgba(100,116,139,0.2)", params: { entryPeriod: 20, exitPeriod: 10 } },
];

export default function NewBacktest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchParams = new URLSearchParams(window.location.search);
  const initialStrategyId = searchParams.get("strategyId");
  const [creatingStrategyType, setCreatingStrategyType] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [strategyTab, setStrategyTab] = useState<"quick" | "ai">("quick");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    type: string; name: string; symbol: string; timeframe: string;
    parameters: Record<string, number>; reasoning: string;
  } | null>(null);
  const { user, token } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

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
      positionSizingMode: "pct_capital" as const,
      positionSizingValue: 95,
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
    if (!user) { setShowAuthModal(true); return; }
    const symbol = form.getValues("symbol") || "AAPL";
    setCreatingStrategyType(typeDef.type);
    createStrategy.mutate(
      {
        data: {
          name: `${typeDef.name} (${symbol})`,
          description: typeDef.description,
          type: typeDef.type as StrategyInputType,
          symbol,
          timeframe: "1d" as StrategyInputTimeframe,
          parameters: typeDef.params as Record<string, unknown>,
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

  async function handleAiDescribe() {
    if (!aiPrompt.trim() || !token) return;
    setAiLoading(true); setAiResult(null);
    try {
      const r = await fetch("/api/ai/build-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: aiPrompt }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "AI failed");
      setAiResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not generate strategy";
      toast({ title: "AI Error", description: msg, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  function handleUseAiStrategy() {
    if (!aiResult) return;
    if (!user) { setShowAuthModal(true); return; }
    createStrategy.mutate(
      {
        data: {
          name: aiResult.name,
          description: `AI-generated: ${aiPrompt.slice(0, 120)}`,
          type: aiResult.type as StrategyInputType,
          symbol: aiResult.symbol,
          timeframe: (aiResult.timeframe || "1d") as StrategyInputTimeframe,
          parameters: aiResult.parameters as Record<string, unknown>,
        },
      },
      {
        onSuccess: (strategy) => {
          queryClient.invalidateQueries({ queryKey: getListStrategiesQueryKey() });
          form.setValue("strategyId", strategy.id);
          toast({ title: "Strategy created", description: aiResult!.name });
          setAiResult(null); setAiPrompt("");
        },
        onError: () => toast({ title: "Error", description: "Failed to create strategy", variant: "destructive" }),
      }
    );
  }

  function onSubmit(data: FormValues) {
    const positionSizing = data.positionSizingMode === "fixed_amount"
      ? { mode: "fixed_amount" as const, value: data.positionSizingValue ?? data.initialCapital * 0.95 }
      : { mode: "risk_pct" as const, value: data.positionSizingValue ?? 95 };

    createBacktest.mutate(
      // positionSizing is an extension beyond the generated type; cast to pass it through
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { data: {
        strategyId: data.strategyId,
        symbol: data.symbol,
        startDate: data.startDate,
        endDate: data.endDate,
        initialCapital: data.initialCapital,
        commission: data.commission ?? 0,
        slippage: data.slippage ?? 0,
        positionSizing,
      } as any },
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
          <p className="text-muted-foreground">Test a strategy against <span className="font-medium">simulated</span> historical price data.</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/backtests/batch">
            <Layers className="mr-2 h-4 w-4" />
            Batch Test
          </Link>
        </Button>
      </div>

      {/* Strategy section — Quick Create or AI Describe tabs */}
      <div className="space-y-3">
        {/* Tab header row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex rounded-xl overflow-hidden border border-border">
            <button
              type="button"
              onClick={() => setStrategyTab("quick")}
              className="px-3 py-1.5 text-xs font-semibold transition-colors"
              style={strategyTab === "quick"
                ? { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                : { background: "transparent", color: "hsl(var(--muted-foreground))" }}
            >
              Quick Create
            </button>
            <button
              type="button"
              onClick={() => setStrategyTab("ai")}
              className="px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5"
              style={strategyTab === "ai"
                ? { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                : { background: "transparent", color: "hsl(var(--muted-foreground))" }}
            >
              <Sparkles className="h-3 w-3" />
              AI Describe
            </button>
          </div>
          {hasStrategies && (
            <span className="text-xs text-muted-foreground">{strategies!.length} existing</span>
          )}
        </div>

        {/* Quick Create tab */}
        {strategyTab === "quick" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-0.5 rounded-xl" style={{ isolation: "isolate", WebkitTransform: "translateZ(0)", transform: "translateZ(0)" }}>
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
        )}

        {/* AI Describe tab */}
        {strategyTab === "ai" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Describe your strategy in plain English — the AI will pick the best matching strategy type and tune its parameters.
              </p>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="e.g. I want a momentum strategy that buys when the MACD crosses above its signal line and the RSI is below 65, selling when momentum reverses…"
                rows={4}
                className="w-full resize-none rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button
                type="button"
                disabled={!aiPrompt.trim() || aiLoading || !user}
                onClick={handleAiDescribe}
                className="w-full gap-2"
              >
                {aiLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
                  : <><Sparkles className="h-4 w-4" />Generate Strategy</>}
              </Button>
              {!user && (
                <p className="text-xs text-center text-muted-foreground">Sign in to use AI strategy generation</p>
              )}
            </div>

            {aiResult && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{aiResult.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {aiResult.type}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{aiResult.symbol}</span>
                    </div>
                  </div>
                </div>
                {aiResult.reasoning && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{aiResult.reasoning}</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(aiResult.parameters).map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-border bg-background/50 px-2 py-1.5 text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-mono">
                        {k.replace(/([A-Z])/g, " $1").trim()}
                      </p>
                      <p className="text-xs font-mono font-semibold text-foreground mt-0.5">{String(v)}</p>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  disabled={createStrategy.isPending}
                  onClick={handleUseAiStrategy}
                  className="w-full gap-2"
                >
                  <Play className="h-3.5 w-3.5" />
                  Use This Strategy
                </Button>
              </div>
            )}
          </div>
        )}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  Advanced Settings (Commission, Slippage &amp; Position Size)
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

                    {/* Position sizing */}
                    <div className="pt-2 border-t border-border space-y-3">
                      <p className="text-xs font-medium text-foreground">Position Sizing</p>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="positionSizingMode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mode</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="pct_capital">% of Capital</SelectItem>
                                  <SelectItem value="fixed_amount">Fixed Amount ($)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="positionSizingValue"
                          render={({ field }) => {
                            const mode = form.watch("positionSizingMode");
                            return (
                              <FormItem>
                                <FormLabel>
                                  {mode === "fixed_amount" ? "Amount ($)" : "Size (%)"}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step={mode === "fixed_amount" ? "100" : "1"}
                                    min={mode === "fixed_amount" ? "100" : "1"}
                                    max={mode === "fixed_amount" ? undefined : "100"}
                                    placeholder={mode === "fixed_amount" ? "e.g. 50000" : "e.g. 95"}
                                    {...field}
                                    className="font-mono"
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  {mode === "fixed_amount"
                                    ? "Fixed $ per trade (capped at 99% of capital)"
                                    : "% of current capital per trade (1–100)"}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      </div>
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
    <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
