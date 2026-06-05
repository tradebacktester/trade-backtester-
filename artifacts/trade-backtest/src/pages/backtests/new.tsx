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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Play, TrendingUp, Activity, BarChart3, Zap, Target,
  Layers, ChevronDown, ChevronUp, Info, Sparkles, Loader2,
  CheckCircle2, Settings2,
} from "lucide-react";
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
  { message: "Date range must be at least 3 months", path: ["endDate"] }
);

type FormValues = z.infer<typeof formSchema>;

export const SYMBOLS: { value: string; label: string; realData: boolean }[] = [
  { value: "BTCUSDT",  label: "BTC/USDT",          realData: false },
  { value: "ETHUSDT",  label: "ETH/USDT",          realData: false },
  { value: "SOLUSDT",  label: "SOL/USDT",          realData: false },
  { value: "BNBUSDT",  label: "BNB/USDT",          realData: false },
  { value: "XRPUSDT",  label: "XRP/USDT",          realData: false },
  { value: "ADAUSDT",  label: "ADA/USDT",          realData: false },
  { value: "DOGEUSDT", label: "DOGE/USDT",         realData: false },
  { value: "AVAXUSDT", label: "AVAX/USDT",         realData: false },
  { value: "LINKUSDT", label: "LINK/USDT",         realData: false },
  { value: "LTCUSDT",  label: "LTC/USDT",          realData: false },
  { value: "DOTUSDT",  label: "DOT/USDT",          realData: false },
  { value: "AAPL",     label: "Apple (AAPL)",      realData: false },
  { value: "MSFT",     label: "Microsoft (MSFT)",  realData: false },
  { value: "TSLA",     label: "Tesla (TSLA)",      realData: false },
  { value: "NVDA",     label: "Nvidia (NVDA)",     realData: false },
  { value: "AMZN",     label: "Amazon (AMZN)",     realData: false },
  { value: "GOOGL",    label: "Alphabet (GOOGL)",  realData: false },
  { value: "SPY",      label: "S&P 500 ETF (SPY)", realData: false },
  { value: "QQQ",      label: "Nasdaq ETF (QQQ)",  realData: false },
];

export const STRATEGY_TYPES = [
  { type: "sma_crossover",      name: "SMA Crossover",             description: "Buy when fast SMA crosses above slow SMA",            icon: TrendingUp, color: "#3b82f6", params: { fastPeriod: 10, slowPeriod: 50 } },
  { type: "ema_crossover",      name: "EMA Crossover",             description: "Exponential MA crossover for trend following",         icon: Activity,   color: "#8b5cf6", params: { fastPeriod: 9, slowPeriod: 21 } },
  { type: "rsi",                name: "RSI Mean Reversion",        description: "Mean reversion using RSI overbought/oversold",         icon: BarChart3,  color: "#f59e0b", params: { period: 14, overbought: 70, oversold: 30 } },
  { type: "macd",               name: "MACD Strategy",             description: "Trend momentum with MACD signal line crossover",       icon: Zap,        color: "#10b981", params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
  { type: "bollinger_bands",    name: "Bollinger Bands",           description: "Buy at lower band, sell at upper band",                icon: Target,     color: "#ec4899", params: { period: 20, stdDev: 2 } },
  { type: "super_trend",        name: "Super Trend",               description: "ATR-based dynamic support/resistance trend channel",   icon: TrendingUp, color: "#f97316", params: { period: 10, multiplier: 3 } },
  { type: "breakout",           name: "Breakout Strategy",         description: "Enter on N-bar high breakout, exit on channel low",    icon: Zap,        color: "#14b8a6", params: { entryPeriod: 20, exitPeriod: 10 } },
  { type: "vwap",               name: "VWAP Strategy",             description: "Trade price crossovers above/below the VWAP",         icon: Activity,   color: "#6366f1", params: { rsiPeriod: 14, oversold: 40 } },
  { type: "macd_rsi",           name: "MACD + RSI Combo",          description: "MACD crossover entries filtered by RSI momentum",     icon: BarChart3,  color: "#a855f7", params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, rsiPeriod: 14, rsiOverbought: 70 } },
  { type: "donchian_breakout",  name: "Donchian Breakout",         description: "Donchian high/low channel breakout entries",           icon: Target,     color: "#84cc16", params: { entryPeriod: 20, exitPeriod: 10 } },
  { type: "bollinger_reversal", name: "Bollinger Reversal",        description: "Mean reversion from lower band back to midline",       icon: TrendingUp, color: "#f43f5e", params: { period: 20, stdDev: 2 } },
  { type: "orb",                name: "Opening Range Breakout",    description: "Trade breakouts from the N-bar opening range",         icon: Zap,        color: "#0ea5e9", params: { rangePeriod: 5, holdDays: 10 } },
  { type: "trend_following",    name: "Trend Following Bundle",    description: "EMA 50/200 golden cross with RSI momentum filter",    icon: TrendingUp, color: "#22c55e", params: { fastEma: 50, slowEma: 200, rsiPeriod: 14 } },
  { type: "golden_cross",       name: "Golden Cross",              description: "Classic 50/200 SMA golden cross long entry",           icon: Activity,   color: "#eab308", params: { fastPeriod: 50, slowPeriod: 200 } },
  { type: "turtle_trading",     name: "Turtle Trading System",     description: "20-day Donchian breakout entry, 10-day exit",          icon: BarChart3,  color: "#64748b", params: { entryPeriod: 20, exitPeriod: 10 } },
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
    const symbol = form.getValues("symbol") || "BTCUSDT";
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
          toast({ title: "Strategy created", description: `${typeDef.name} is ready.` });
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
      toast({ title: "AI Error", description: err instanceof Error ? err.message : "Could not generate strategy", variant: "destructive" });
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { data: { strategyId: data.strategyId, symbol: data.symbol, startDate: data.startDate, endDate: data.endDate, initialCapital: data.initialCapital, commission: data.commission ?? 0, slippage: data.slippage ?? 0, positionSizing } as any },
      {
        onSuccess: (backtest) => {
          queryClient.invalidateQueries({ queryKey: getListBacktestsQueryKey() });
          toast({ title: "Backtest started!", description: "Redirecting to results…" });
          setLocation(`/backtests/${backtest.id}`);
        },
        onError: (error: { data?: { error?: string } | null }) => {
          toast({ title: "Error", description: error.data?.error || "Failed to start backtest", variant: "destructive" });
        },
      }
    );
  }

  const hasStrategies = !isLoadingStrategies && strategies && strategies.length > 0;
  const noStrategies = !isLoadingStrategies && (!strategies || strategies.length === 0);
  const commissionVal = form.watch("commission") ?? 0;
  const slippageVal = form.watch("slippage") ?? 0;
  const totalCostEstimate = (commissionVal * 2 + slippageVal * 2).toFixed(3);
  const selectedStrategyId = form.watch("strategyId");

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10" style={{ isolation: "isolate" }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/backtests">
          <button className="h-9 w-9 flex items-center justify-center rounded-xl border transition-colors"
            style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }}>
            <ArrowLeft className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>Run Backtest</h1>
          <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>
            Test a strategy against <span className="font-medium text-foreground">simulated</span> historical price data
          </p>
        </div>
        <Link href="/backtests/batch">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-medium transition-colors"
            style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)", color: "hsl(var(--muted-foreground))" }}>
            <Layers className="h-3.5 w-3.5" />
            Batch
          </button>
        </Link>
      </div>

      {/* Strategy Picker — tabs */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>
        {/* Tab header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            {[
              { id: "quick" as const, label: "Quick Create" },
              { id: "ai" as const, label: "AI Describe", icon: Sparkles },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStrategyTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                style={strategyTab === tab.id
                  ? { background: "var(--card-bg)", color: "#4DA3FF", border: "1px solid var(--accent-cyan-border)", boxShadow: "var(--shadow-tab-active)" }
                  : { color: "hsl(var(--muted-foreground))" }}
              >
                {tab.icon && <tab.icon className="h-3 w-3" />}
                {tab.label}
              </button>
            ))}
          </div>
          {hasStrategies && (
            <span className="text-[11px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>
              {strategies!.length} saved
            </span>
          )}
        </div>

        {/* Quick Create grid */}
        {strategyTab === "quick" && (
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
            {STRATEGY_TYPES.map((typeDef) => {
              const Icon = typeDef.icon;
              const isCreating = creatingStrategyType === typeDef.type;
              return (
                <button
                  key={typeDef.type}
                  type="button"
                  disabled={createStrategy.isPending}
                  onClick={() => handleQuickCreate(typeDef)}
                  className="group flex items-start gap-3 p-3 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  style={{ background: `${typeDef.color}08`, border: `1px solid ${typeDef.color}22` }}
                >
                  <span className="h-7 w-7 flex items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
                    style={{ background: `${typeDef.color}18`, color: typeDef.color }}>
                    {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{typeDef.name}</p>
                    <p className="text-[11px] leading-snug mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{typeDef.description}</p>
                  </div>
                  <span className="h-5 w-5 flex items-center justify-center rounded-full text-[11px] font-bold flex-shrink-0 mt-0.5"
                    style={{ background: typeDef.color, color: "#fff" }}>
                    +
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* AI Describe */}
        {strategyTab === "ai" && (
          <div className="p-4 space-y-3">
            <p className="text-[12px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
              Describe your strategy in plain English — AI picks the best matching type and tunes its parameters.
            </p>
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g. A momentum strategy that buys when MACD crosses above its signal and RSI is below 65…"
              rows={4}
              className="w-full resize-none rounded-xl border px-3 py-2.5 text-[13px] outline-none focus:ring-1 focus:ring-blue-500/30 transition-colors"
              style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)", color: "hsl(var(--foreground))" }}
            />
            <button
              type="button"
              disabled={!aiPrompt.trim() || aiLoading || !user}
              onClick={handleAiDescribe}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
              style={{ background: "#4DA3FF", color: "#050505" }}
            >
              {aiLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</> : <><Sparkles className="h-4 w-4" />Generate Strategy</>}
            </button>
            {!user && <p className="text-[11px] text-center" style={{ color: "hsl(var(--muted-foreground))" }}>Sign in to use AI strategy generation</p>}

            {aiResult && (
              <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--glass-bg)", borderColor: "var(--accent-cyan-border)" }}>
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{aiResult.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: "var(--accent-cyan-dim)", color: "#4DA3FF", border: "1px solid var(--accent-cyan-border)" }}>{aiResult.type}</span>
                    <span className="text-[11px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{aiResult.symbol}</span>
                  </div>
                </div>
                {aiResult.reasoning && <p className="text-[12px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>{aiResult.reasoning}</p>}
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(aiResult.parameters).map(([k, v]) => (
                    <div key={k} className="rounded-lg border px-2 py-2 text-center" style={{ background: "var(--card-bg)", borderColor: "var(--glass-border)" }}>
                      <p className="text-[9px] uppercase tracking-wider font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{k.replace(/([A-Z])/g, " $1").trim()}</p>
                      <p className="text-[13px] font-mono font-bold mt-0.5" style={{ color: "hsl(var(--foreground))" }}>{String(v)}</p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={createStrategy.isPending}
                  onClick={handleUseAiStrategy}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
                  style={{ background: "#4DA3FF", color: "#050505" }}
                >
                  <Play className="h-3.5 w-3.5" />
                  Use This Strategy
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Config Form */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>
        <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <Settings2 className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
          <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>Backtest Configuration</span>
        </div>

        <div className="p-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Strategy select */}
              <FormField control={form.control} name="strategyId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>Strategy</FormLabel>
                  <Select onValueChange={(val) => field.onChange(parseInt(val, 10))} value={field.value ? field.value.toString() : ""} disabled={isLoadingStrategies}>
                    <FormControl>
                      <SelectTrigger className="h-10 rounded-xl" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }}>
                        <SelectValue placeholder={isLoadingStrategies ? "Loading…" : "Select a strategy"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {noStrategies ? (
                        <div className="px-3 py-4 text-center text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                          No strategies yet — use Quick Create above.
                        </div>
                      ) : (
                        strategies?.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            <div className="flex items-center gap-2">
                              {selectedStrategyId === s.id && <CheckCircle2 className="h-3 w-3 text-green-400" />}
                              {s.name} <span className="text-[10px] opacity-50">({s.timeframe})</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Symbol */}
              <FormField control={form.control} name="symbol" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>Symbol</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10 rounded-xl font-mono" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }}>
                        <SelectValue placeholder="Select symbol" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SYMBOLS.map((s) => (
                        <SelectItem key={s.value} value={s.value} className="font-mono">{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="h-10 rounded-xl font-mono" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="h-10 rounded-xl font-mono" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Capital */}
              <FormField control={form.control} name="initialCapital" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>Initial Capital ($)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} className="h-10 rounded-xl font-mono" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }} />
                  </FormControl>
                  <FormDescription className="text-[11px]">Starting balance for the simulation</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Advanced toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-2 text-[12px] font-medium transition-colors"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Advanced — Commission, Slippage &amp; Position Size
              </button>

              {showAdvanced && (
                <div className="rounded-xl p-4 space-y-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                  <div className="flex items-start gap-2 rounded-lg p-2.5 text-[11px]" style={{ background: "rgba(77,163,255,0.07)", border: "1px solid rgba(77,163,255,0.2)", color: "#4DA3FF" }}>
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    Commission and slippage applied on every entry and exit. Estimated round-trip: <strong className="font-mono ml-1">~{totalCostEstimate}%</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="commission" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px]">Commission (%)</FormLabel>
                        <FormControl><Input type="number" step="0.01" min="0" max="10" {...field} className="h-9 rounded-xl font-mono text-[12px]" /></FormControl>
                        <FormDescription className="text-[10px]">Per-side fee</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="slippage" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px]">Slippage (%)</FormLabel>
                        <FormControl><Input type="number" step="0.01" min="0" max="5" {...field} className="h-9 rounded-xl font-mono text-[12px]" /></FormControl>
                        <FormDescription className="text-[10px]">Price impact per side</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="pt-2 border-t space-y-3" style={{ borderColor: "var(--glass-border)" }}>
                    <p className="text-[11px] font-medium" style={{ color: "hsl(var(--foreground))" }}>Position Sizing</p>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="positionSizingMode" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[11px]">Mode</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-9 rounded-xl text-[12px]"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="pct_capital">% of Capital</SelectItem>
                              <SelectItem value="fixed_amount">Fixed Amount ($)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="positionSizingValue" render={({ field }) => {
                        const mode = form.watch("positionSizingMode");
                        return (
                          <FormItem>
                            <FormLabel className="text-[11px]">{mode === "fixed_amount" ? "Amount ($)" : "Size (%)"}</FormLabel>
                            <FormControl>
                              <Input type="number" step={mode === "fixed_amount" ? "100" : "1"} min={mode === "fixed_amount" ? "100" : "1"} max={mode === "fixed_amount" ? undefined : "100"} placeholder={mode === "fixed_amount" ? "e.g. 50000" : "e.g. 95"} {...field} className="h-9 rounded-xl font-mono text-[12px]" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={createBacktest.isPending || !form.watch("strategyId")}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-bold transition-all disabled:opacity-40"
                  style={{ background: createBacktest.isPending ? "var(--glass-bg)" : "#4DA3FF", color: createBacktest.isPending ? "hsl(var(--muted-foreground))" : "#050505", boxShadow: createBacktest.isPending ? "none" : "0 0 24px rgba(77,163,255,0.3)" }}
                >
                  {createBacktest.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Running simulation…</>
                    : <><Play className="h-4 w-4" />Run Simulation</>}
                </button>
              </div>
            </form>
          </Form>
        </div>
      </div>

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
