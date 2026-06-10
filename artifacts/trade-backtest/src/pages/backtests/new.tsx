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
  Layers, ChevronDown, ChevronUp, Info, Sparkles, Loader2, CheckCircle2,
  Settings, FlaskConical, Cpu, ChevronRight, Eye,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { format, subYears } from "date-fns";
import { API_BASE } from "@/lib/api-config";

/* ─── Zod Schema ──────────────────────────────────────────── */
const formSchema = z.object({
  strategyId: z.coerce.number().min(1, "Select a strategy to continue"),
  symbol: z.string().min(1, "Symbol is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  initialCapital: z.coerce.number().min(100, "Minimum capital is $100"),
  commission: z.coerce.number().min(0).max(10).optional(),
  slippage: z.coerce.number().min(0).max(5).optional(),
  positionSizingMode: z.enum(["pct_capital", "fixed_amount"]).default("pct_capital"),
  positionSizingValue: z.coerce.number().positive().optional(),
})
  .refine((d) => d.startDate < d.endDate, { message: "End date must be after start date", path: ["endDate"] })
  .refine((d) => (new Date(d.endDate).getTime() - new Date(d.startDate).getTime()) / 86_400_000 >= 90, {
    message: "Range must be at least 3 months", path: ["endDate"],
  });

type FormValues = z.infer<typeof formSchema>;

/* ─── Data ────────────────────────────────────────────────── */
export const SYMBOLS: { value: string; label: string; group: string; realData: boolean }[] = [
  { value: "BTCUSDT",  label: "BTC/USDT",         group: "Crypto", realData: false },
  { value: "ETHUSDT",  label: "ETH/USDT",         group: "Crypto", realData: false },
  { value: "SOLUSDT",  label: "SOL/USDT",         group: "Crypto", realData: false },
  { value: "BNBUSDT",  label: "BNB/USDT",         group: "Crypto", realData: false },
  { value: "XRPUSDT",  label: "XRP/USDT",         group: "Crypto", realData: false },
  { value: "ADAUSDT",  label: "ADA/USDT",         group: "Crypto", realData: false },
  { value: "DOGEUSDT", label: "DOGE/USDT",        group: "Crypto", realData: false },
  { value: "AVAXUSDT", label: "AVAX/USDT",        group: "Crypto", realData: false },
  { value: "LINKUSDT", label: "LINK/USDT",        group: "Crypto", realData: false },
  { value: "LTCUSDT",  label: "LTC/USDT",         group: "Crypto", realData: false },
  { value: "DOTUSDT",  label: "DOT/USDT",         group: "Crypto", realData: false },
  { value: "AAPL",     label: "Apple (AAPL)",     group: "Stocks", realData: false },
  { value: "MSFT",     label: "Microsoft (MSFT)", group: "Stocks", realData: false },
  { value: "TSLA",     label: "Tesla (TSLA)",     group: "Stocks", realData: false },
  { value: "NVDA",     label: "Nvidia (NVDA)",    group: "Stocks", realData: false },
  { value: "AMZN",     label: "Amazon (AMZN)",    group: "Stocks", realData: false },
  { value: "GOOGL",    label: "Alphabet (GOOGL)", group: "Stocks", realData: false },
  { value: "SPY",      label: "S&P 500 (SPY)",    group: "ETFs",   realData: false },
  { value: "QQQ",      label: "Nasdaq (QQQ)",     group: "ETFs",   realData: false },
];

export const STRATEGY_TYPES = [
  { type: "sma_crossover",      name: "SMA Crossover",          short: "SMA",  icon: TrendingUp,  color: "#3b82f6", params: { fastPeriod: 10, slowPeriod: 50 },                                                           description: "Buy when fast MA crosses above slow MA" },
  { type: "ema_crossover",      name: "EMA Crossover",          short: "EMA",  icon: Activity,    color: "#8b5cf6", params: { fastPeriod: 9, slowPeriod: 21 },                                                            description: "Exponential MA crossover for trend following" },
  { type: "rsi",                name: "RSI Reversal",           short: "RSI",  icon: BarChart3,   color: "#f59e0b", params: { period: 14, overbought: 70, oversold: 30 },                                                 description: "Mean reversion at overbought/oversold extremes" },
  { type: "macd",               name: "MACD",                   short: "MACD", icon: Zap,         color: "#10b981", params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },                                          description: "Trend momentum via signal line crossover" },
  { type: "bollinger_bands",    name: "Bollinger Bands",        short: "BB",   icon: Target,      color: "#ec4899", params: { period: 20, stdDev: 2 },                                                                    description: "Buy at lower band, sell at upper band" },
  { type: "super_trend",        name: "Super Trend",            short: "ST",   icon: TrendingUp,  color: "#f97316", params: { period: 10, multiplier: 3 },                                                                description: "ATR-based dynamic trend channel" },
  { type: "breakout",           name: "Breakout",               short: "BRK",  icon: Zap,         color: "#14b8a6", params: { entryPeriod: 20, exitPeriod: 10 },                                                          description: "N-bar high breakout, exit on channel low" },
  { type: "vwap",               name: "VWAP",                   short: "VWAP", icon: Activity,    color: "#6366f1", params: { rsiPeriod: 14, oversold: 40 },                                                              description: "Trade crossovers above/below VWAP" },
  { type: "macd_rsi",           name: "MACD + RSI",             short: "M+R",  icon: BarChart3,   color: "#a855f7", params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, rsiPeriod: 14, rsiOverbought: 70 },       description: "MACD entries filtered by RSI momentum" },
  { type: "donchian_breakout",  name: "Donchian Breakout",      short: "DON",  icon: Target,      color: "#84cc16", params: { entryPeriod: 20, exitPeriod: 10 },                                                          description: "Donchian channel high/low breakout entries" },
  { type: "bollinger_reversal", name: "Bollinger Reversal",     short: "BBR",  icon: TrendingUp,  color: "#f43f5e", params: { period: 20, stdDev: 2 },                                                                    description: "Mean reversion from lower band to midline" },
  { type: "orb",                name: "Opening Range Break",    short: "ORB",  icon: Zap,         color: "#0ea5e9", params: { rangePeriod: 5, holdDays: 10 },                                                             description: "Trade breakouts from N-bar opening range" },
  { type: "trend_following",    name: "Trend Following",        short: "TF",   icon: TrendingUp,  color: "#22c55e", params: { fastEma: 50, slowEma: 200, rsiPeriod: 14 },                                                 description: "EMA 50/200 golden cross with RSI filter" },
  { type: "golden_cross",       name: "Golden Cross",           short: "GC",   icon: Activity,    color: "#eab308", params: { fastPeriod: 50, slowPeriod: 200 },                                                           description: "Classic 50/200 SMA golden cross" },
  { type: "turtle_trading",     name: "Turtle Trading",         short: "TTL",  icon: BarChart3,   color: "#64748b", params: { entryPeriod: 20, exitPeriod: 10 },                                                          description: "20-day Donchian breakout, 10-day exit" },
];

/* ─── Helpers ─────────────────────────────────────────────── */
function normalizeToSymbolValue(sym: string): string {
  const direct = SYMBOLS.find(s => s.value === sym);
  if (direct) return direct.value;
  const stripped = sym.replace("/", "");
  return SYMBOLS.find(s => s.value === stripped)?.value ?? "BTCUSDT";
}

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 transition-all"
        style={done
          ? { background: "#22c55e", color: "#fff" }
          : active
            ? { background: "#FFFFFF", color: "#050505", boxShadow: "0 0 12px rgba(255,255,255,0.16)" }
            : { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
      </div>
      <span className="text-[12px] font-semibold hidden sm:block transition-colors"
        style={{ color: active ? "hsl(var(--foreground))" : done ? "#22c55e" : "hsl(var(--muted-foreground))" }}>
        {label}
      </span>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */
export default function NewBacktest() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchParams = new URLSearchParams(window.location.search);
  const initialStrategyId = searchParams.get("strategyId");
  const { user, token } = useAuth();

  const [creatingStrategyType, setCreatingStrategyType] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [strategyTab, setStrategyTab] = useState<"quick" | "ai" | "saved">("quick");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    type: string; name: string; symbol: string; timeframe: string;
    parameters: Record<string, number>; reasoning: string;
  } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [backtestNotes, setBacktestNotes] = useState("");

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
      { data: { name: `${typeDef.name} (${symbol})`, description: typeDef.description, type: typeDef.type as StrategyInputType, symbol, timeframe: "1d" as StrategyInputTimeframe, parameters: typeDef.params as Record<string, unknown> } },
      {
        onSuccess: (strategy) => {
          queryClient.invalidateQueries({ queryKey: getListStrategiesQueryKey() });
          form.setValue("strategyId", strategy.id);
          toast({ title: "Strategy created", description: `${typeDef.name} strategy is ready to test.` });
          setCreatingStrategyType(null);
        },
        onError: (err: { data?: { error?: string } | null; message?: string }) => { toast({ title: "Error", description: err.data?.error ?? err.message ?? "Failed to create strategy", variant: "destructive" }); setCreatingStrategyType(null); },
      }
    );
  }

  async function handleAiDescribe() {
    if (!aiPrompt.trim() || !token) return;
    setAiLoading(true); setAiResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/ai/build-strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: aiPrompt }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "AI failed");
      setAiResult(data);
    } catch (err: unknown) {
      toast({ title: "AI Error", description: err instanceof Error ? err.message : "Could not generate strategy", variant: "destructive" });
    } finally { setAiLoading(false); }
  }

  function handleUseAiStrategy() {
    if (!aiResult || !user) { if (!user) setShowAuthModal(true); return; }
    createStrategy.mutate(
      { data: { name: aiResult.name, description: `AI-generated: ${aiPrompt.slice(0, 120)}`, type: aiResult.type as StrategyInputType, symbol: aiResult.symbol, timeframe: (aiResult.timeframe || "1d") as StrategyInputTimeframe, parameters: aiResult.parameters as Record<string, unknown> } },
      {
        onSuccess: (strategy) => {
          queryClient.invalidateQueries({ queryKey: getListStrategiesQueryKey() });
          form.setValue("strategyId", strategy.id);
          toast({ title: "Strategy created", description: aiResult!.name });
          setAiResult(null); setAiPrompt("");
        },
        onError: (err: { data?: { error?: string } | null; message?: string }) => toast({ title: "Error", description: err.data?.error ?? err.message ?? "Failed to create strategy", variant: "destructive" }),
      }
    );
  }

  function onSubmit(data: FormValues) {
    const positionSizing = data.positionSizingMode === "fixed_amount"
      ? { mode: "fixed_amount" as const, value: data.positionSizingValue ?? data.initialCapital * 0.95 }
      : { mode: "risk_pct" as const, value: data.positionSizingValue ?? 95 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createBacktest.mutate({ data: { strategyId: data.strategyId, symbol: data.symbol, startDate: data.startDate, endDate: data.endDate, initialCapital: data.initialCapital, commission: data.commission ?? 0, slippage: data.slippage ?? 0, positionSizing, notes: backtestNotes || undefined } as any }, {
      onSuccess: (backtest) => {
        queryClient.invalidateQueries({ queryKey: getListBacktestsQueryKey() });
        toast({ title: "Simulation running!", description: "Redirecting to your results…" });
        setLocation(`/backtests/${backtest.id}`);
      },
      onError: (error: { data?: { error?: string; limitReached?: boolean } | null }) => {
        const msg = error.data?.error || "Failed to start backtest";
        const isLimit = error.data?.limitReached === true;
        toast({
          title: isLimit ? "Plan limit reached" : "Error",
          description: isLimit
            ? `${msg} Visit the Pricing page to upgrade.`
            : msg,
          variant: "destructive",
        });
        if (isLimit) setLocation("/pricing");
      },
    });
  }

  const selectedStrategyId = form.watch("strategyId");
  const currentSymbol = form.watch("symbol") || "BTCUSDT";
  const selectedStrategy = strategies?.find(s => s.id === selectedStrategyId);
  const commissionVal = form.watch("commission") ?? 0;
  const slippageVal = form.watch("slippage") ?? 0;
  const totalCostEstimate = (commissionVal * 2 + slippageVal * 2).toFixed(3);
  const step1Done = selectedStrategyId > 0;
  const step2Done = step1Done && !!form.watch("symbol") && !!form.watch("startDate") && !!form.watch("endDate") && (form.watch("initialCapital") ?? 0) >= 100;

  return (
    <div className="max-w-2xl mx-auto pb-12 space-y-0" style={{ isolation: "isolate" }}>

      {/* ── Top Bar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/backtests">
          <button className="h-9 w-9 flex items-center justify-center rounded-xl transition-colors"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <ArrowLeft className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-[22px] font-bold tracking-tight leading-none" style={{ color: "hsl(var(--foreground))" }}>Run Backtest</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Simulate a strategy against historical price data</p>
        </div>
        <Link href="/backtests/batch">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--muted-foreground))" }}>
            <Layers className="h-3.5 w-3.5" />Batch
          </button>
        </Link>
      </div>

      {/* ── Progress Steps ───────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 px-1">
        <Step n={1} label="Choose Strategy" active={!step1Done} done={step1Done} />
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }} />
        <Step n={2} label="Configure" active={step1Done && !step2Done} done={step2Done} />
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }} />
        <Step n={3} label="Run" active={step2Done} done={false} />
      </div>

      {/* ── SECTION 1: Strategy ─────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ border: `1px solid ${step1Done ? "rgba(34,197,94,0.25)" : "var(--glass-border)"}`, boxShadow: "var(--shadow-card)", background: "var(--card-bg)", transition: "border-color 0.3s" }}>

        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--glass-border)", background: step1Done ? "rgba(34,197,94,0.03)" : "transparent" }}>
          <div className="flex items-center gap-2.5">
            <span className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: step1Done ? "rgba(34,197,94,0.12)" : "var(--glass-bg)", border: `1px solid ${step1Done ? "rgba(34,197,94,0.25)" : "var(--glass-border)"}` }}>
              <FlaskConical className="h-3.5 w-3.5" style={{ color: step1Done ? "#22c55e" : "hsl(var(--muted-foreground))" }} />
            </span>
            <span className="text-[13px] font-bold" style={{ color: "hsl(var(--foreground))" }}>Strategy</span>
            {selectedStrategy && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.05)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.08)" }}>
                {selectedStrategy.name}
              </span>
            )}
          </div>

          {/* Subtabs */}
          <div className="flex gap-0.5 p-0.5 rounded-xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            {[
              { id: "quick" as const, label: "Quick", icon: Zap },
              { id: "ai" as const, label: "AI", icon: Sparkles },
              { id: "saved" as const, label: "Saved", icon: Layers },
            ].map(t => (
              <button key={t.id} type="button" onClick={() => setStrategyTab(t.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                style={strategyTab === t.id
                  ? { background: "var(--card-bg)", color: "#FFFFFF", border: "1px solid var(--accent-cyan-border)" }
                  : { color: "hsl(var(--muted-foreground))" }}>
                <t.icon className="h-3 w-3" />{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* QUICK CREATE */}
        {strategyTab === "quick" && (
          <div className="p-3">
            <div className="grid grid-cols-1 gap-2 max-h-[380px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
              {STRATEGY_TYPES.map((typeDef) => {
                const Icon = typeDef.icon;
                const isCreating = creatingStrategyType === typeDef.type;
                const isSelected = selectedStrategy?.type === typeDef.type;
                return (
                  <button key={typeDef.type} type="button" disabled={createStrategy.isPending}
                    onClick={() => handleQuickCreate(typeDef)}
                    className="group flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:scale-[1.005] active:scale-[0.995] disabled:opacity-50"
                    style={{
                      background: isSelected ? `${typeDef.color}12` : `${typeDef.color}05`,
                      border: `1px solid ${isSelected ? `${typeDef.color}40` : `${typeDef.color}18`}`,
                    }}>
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${typeDef.color}15`, border: `1px solid ${typeDef.color}25` }}>
                      {isCreating
                        ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: typeDef.color }} />
                        : <Icon className="h-4 w-4" style={{ color: typeDef.color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{typeDef.name}</p>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                          style={{ background: `${typeDef.color}15`, color: typeDef.color }}>{typeDef.short}</span>
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#22c55e" }} />}
                      </div>
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{typeDef.description}</p>
                    </div>
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: typeDef.color, color: "#fff", fontSize: 14, fontWeight: 700 }}>+</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* AI DESCRIBE */}
        {strategyTab === "ai" && (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <Cpu className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#FFFFFF" }} />
              <p className="text-[12px] leading-relaxed" style={{ color: "#FFFFFF" }}>
                Describe your trading idea in plain English. AI selects the best strategy type and tunes its parameters automatically.
              </p>
            </div>

            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g. A momentum strategy that buys when MACD crosses above signal with RSI below 65, exits on RSI overbought or MACD cross down…"
              rows={4} className="w-full resize-none rounded-xl px-4 py-3 text-[13px] outline-none transition-colors"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))", lineHeight: 1.6 }} />

            <button type="button" disabled={!aiPrompt.trim() || aiLoading || !user}
              onClick={handleAiDescribe}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all disabled:opacity-40"
              style={{ background: "#FFFFFF", color: "#050505", boxShadow: aiLoading ? "none" : "0 0 20px rgba(255,255,255,0.14)" }}>
              {aiLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating strategy…</> : <><Sparkles className="h-4 w-4" />Generate Strategy with AI</>}
            </button>

            {!user && (
              <p className="text-[11px] text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
                <button onClick={() => setShowAuthModal(true)} className="underline" style={{ color: "#FFFFFF" }}>Sign in</button> to use AI strategy generation
              </p>
            )}

            {aiResult && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.02)" }}>
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-bold" style={{ color: "hsl(var(--foreground))" }}>{aiResult.name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(255,255,255,0.06)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.12)" }}>{aiResult.type}</span>
                        <span className="text-[11px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{aiResult.symbol} · {aiResult.timeframe}</span>
                      </div>
                    </div>
                    <Cpu className="h-5 w-5 flex-shrink-0 mt-1" style={{ color: "#FFFFFF" }} />
                  </div>
                  {aiResult.reasoning && (
                    <p className="text-[12px] leading-relaxed mt-3" style={{ color: "hsl(var(--muted-foreground))" }}>{aiResult.reasoning}</p>
                  )}
                </div>
                <div className="px-4 pb-3 grid grid-cols-4 gap-2">
                  {Object.entries(aiResult.parameters).slice(0, 8).map(([k, v]) => (
                    <div key={k} className="rounded-xl px-2 py-2.5 text-center"
                      style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
                      <p className="text-[9px] uppercase tracking-wide font-mono leading-tight" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {k.replace(/([A-Z])/g, " $1").trim().slice(0, 10)}
                      </p>
                      <p className="text-[14px] font-mono font-bold mt-1" style={{ color: "hsl(var(--foreground))" }}>{String(v)}</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4">
                  <button type="button" disabled={createStrategy.isPending} onClick={handleUseAiStrategy}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-all disabled:opacity-40"
                    style={{ background: "#FFFFFF", color: "#050505" }}>
                    <Play className="h-3.5 w-3.5" />Use This Strategy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SAVED STRATEGIES */}
        {strategyTab === "saved" && (
          <div className="p-3">
            {isLoadingStrategies ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "var(--glass-bg)" }} />
                ))}
              </div>
            ) : !strategies || strategies.length === 0 ? (
              <div className="py-12 text-center">
                <FlaskConical className="h-8 w-8 mx-auto mb-3" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }} />
                <p className="text-[13px] font-medium mb-1" style={{ color: "hsl(var(--foreground))" }}>No saved strategies</p>
                <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>Use Quick Create to build one in seconds.</p>
                <button type="button" onClick={() => setStrategyTab("quick")}
                  className="mt-3 px-4 py-2 rounded-xl text-[12px] font-medium"
                  style={{ background: "#FFFFFF", color: "#050505" }}>
                  Quick Create
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[380px] overflow-y-auto">
                {strategies.map(s => {
                  const isSelected = selectedStrategyId === s.id;
                  const typeDef = STRATEGY_TYPES.find(t => t.type === s.type);
                  return (
                    <button key={s.id} type="button" onClick={() => form.setValue("strategyId", s.id)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                      style={{
                        background: isSelected ? "rgba(255,255,255,0.03)" : "var(--glass-bg)",
                        border: `1px solid ${isSelected ? "rgba(255,255,255,0.14)" : "var(--glass-border)"}`,
                      }}>
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: typeDef ? `${typeDef.color}15` : "var(--glass-bg)", border: `1px solid ${typeDef ? `${typeDef.color}20` : "var(--glass-border)"}` }}>
                        {typeDef ? <typeDef.icon className="h-3.5 w-3.5" style={{ color: typeDef.color }} /> : <BarChart3 className="h-3.5 w-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>{s.name}</p>
                        <p className="text-[11px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{s.symbol} · {s.timeframe}</p>
                      </div>
                      {isSelected && <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: "#FFFFFF" }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SECTION 2: Configuration ─────────────────────────── */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)", background: "var(--card-bg)" }}>
        <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <span className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <Settings className="h-3.5 w-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
          </span>
          <span className="text-[13px] font-bold" style={{ color: "hsl(var(--foreground))" }}>Configuration</span>
        </div>

        <div className="p-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Strategy hidden field — shown inline only in Saved tab */}
              {strategyTab !== "saved" && (
                <FormField control={form.control} name="strategyId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>Active Strategy</FormLabel>
                    <Select onValueChange={(val) => field.onChange(parseInt(val, 10))} value={field.value ? field.value.toString() : ""} disabled={isLoadingStrategies}>
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-xl" style={{ background: "var(--glass-bg)", borderColor: selectedStrategyId > 0 ? "rgba(34,197,94,0.35)" : "var(--glass-border)" }}>
                          <SelectValue placeholder={isLoadingStrategies ? "Loading strategies…" : "— select a strategy —"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(!strategies || strategies.length === 0) ? (
                          <div className="px-3 py-4 text-center text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                            No strategies yet — use Quick Create above.
                          </div>
                        ) : strategies.map(s => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            <div className="flex items-center gap-2">
                              {selectedStrategyId === s.id && <CheckCircle2 className="h-3 w-3 text-green-400" />}
                              {s.name} <span className="opacity-40 text-[10px]">· {s.timeframe}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* Symbol + Dates in grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField control={form.control} name="symbol" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>Symbol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-xl font-mono text-[13px]" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[260px] overflow-y-auto">
                        {["Crypto", "Stocks", "ETFs"].map(group => (
                          <React.Fragment key={group}>
                            <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>{group}</div>
                            {SYMBOLS.filter(s => s.group === group).map(s => (
                              <SelectItem key={s.value} value={s.value} className="font-mono pl-4">{s.label}</SelectItem>
                            ))}
                          </React.Fragment>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>Start Date</FormLabel>
                    <FormControl><Input type="date" {...field} className="h-10 rounded-xl font-mono text-[13px]" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>End Date</FormLabel>
                    <FormControl><Input type="date" {...field} className="h-10 rounded-xl font-mono text-[13px]" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Capital */}
              <FormField control={form.control} name="initialCapital" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>Initial Capital (USD)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>$</span>
                      <Input type="number" {...field} className="h-10 rounded-xl font-mono text-[13px] pl-7" style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }} />
                    </div>
                  </FormControl>
                  <FormDescription className="text-[11px]">Starting balance for the simulation run</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Advanced toggle */}
              <button type="button" onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-2 text-[12px] font-medium transition-colors w-full py-1"
                style={{ color: showAdvanced ? "#FFFFFF" : "hsl(var(--muted-foreground))" }}>
                {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showAdvanced ? "Hide" : "Show"} Advanced — Commission, Slippage &amp; Position Sizing
              </button>

              {showAdvanced && (
                <div className="rounded-xl p-4 space-y-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                  <div className="flex items-start gap-2.5 text-[11px] rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#FFFFFF" }}>
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    Commission and slippage applied each entry &amp; exit. Est. round-trip cost: <strong className="font-mono ml-1">~{totalCostEstimate}%</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="commission" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px]">Commission (%)</FormLabel>
                        <FormControl><Input type="number" step="0.01" min="0" max="10" {...field} className="h-9 rounded-xl font-mono text-[12px]" /></FormControl>
                        <FormDescription className="text-[10px]">Per-side fee (e.g. 0.1 = 0.1%)</FormDescription>
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
                  <div className="pt-2 space-y-3" style={{ borderTop: "1px solid var(--glass-border)" }}>
                    <p className="text-[11px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>Position Sizing</p>
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
                              <Input type="number" step={mode === "fixed_amount" ? "100" : "1"} min={mode === "fixed_amount" ? "100" : "1"} max={mode === "fixed_amount" ? undefined : "100"}
                                placeholder={mode === "fixed_amount" ? "50000" : "95"} {...field} className="h-9 rounded-xl font-mono text-[12px]" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="pt-1">
                <label className="text-[11px] uppercase tracking-wider font-semibold mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Notes <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  value={backtestNotes}
                  onChange={e => setBacktestNotes(e.target.value)}
                  placeholder="Hypothesis, market conditions, or what you're testing…"
                  rows={2}
                  maxLength={2000}
                  className="w-full rounded-xl px-3 py-2 text-[13px] resize-none outline-none transition-colors"
                  style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))" }}
                />
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button type="submit" disabled={createBacktest.isPending || !selectedStrategyId}
                  className="relative w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-[15px] font-bold tracking-tight transition-all overflow-hidden disabled:opacity-40"
                  style={{
                    background: createBacktest.isPending || !selectedStrategyId ? "var(--glass-bg)" : "#FFFFFF",
                    color: createBacktest.isPending || !selectedStrategyId ? "hsl(var(--muted-foreground))" : "#050505",
                    border: `1px solid ${createBacktest.isPending || !selectedStrategyId ? "var(--glass-border)" : "rgba(255,255,255,0.22)"}`,
                    boxShadow: createBacktest.isPending || !selectedStrategyId ? "none" : "0 0 30px rgba(255,255,255,0.16), 0 2px 12px rgba(255,255,255,0.08)",
                  }}>
                  {createBacktest.isPending
                    ? <><Loader2 className="h-5 w-5 animate-spin" />Running simulation…</>
                    : <><Play className="h-5 w-5" />Run Simulation</>}
                </button>
                {!selectedStrategyId && (
                  <p className="text-[11px] text-center mt-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Select or create a strategy above to continue
                  </p>
                )}
              </div>
            </form>
          </Form>
        </div>
      </div>

      {/* Ghost Mode Panel */}
      {user && <GhostModePanel symbol={currentSymbol} strategies={strategies} selectedStrategyId={selectedStrategyId} token={token} />}

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}

/* ─── Ghost Mode Panel ────────────────────────────────────── */
function GhostModePanel({
  symbol, strategies, selectedStrategyId, token,
}: {
  symbol: string;
  strategies: { id: number; type: string }[] | undefined;
  selectedStrategyId: number;
  token: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"long" | "short">("long");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    hasHistory: boolean;
    similarityScore: number;
    closestMatch: { symbol: string; side: string; entryDate: string; exitDate: string; pnl: number; pnlPercent: number; durationDays: number; strategyType?: string | null } | null;
    winCount: number;
    lossCount: number;
    winRate: number;
    avgReturn: number;
    avgDrawdown: number;
    similarTrades: number;
    marketContext?: string;
    message?: string;
  } | null>(null);

  const selectedStratType = strategies?.find(s => s.id === selectedStrategyId)?.type;

  async function runGhostMode() {
    if (!token || !symbol) return;
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/ai/ghost-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol, side, strategyType: selectedStratType }),
      });
      const d = await r.json();
      setResult(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  const GHOST_COLOR = "#8b5cf6";

  return (
    <div className="rounded-2xl overflow-hidden mb-4"
      style={{ border: `1px solid ${open ? "rgba(139,92,246,0.3)" : "var(--glass-border)"}`, boxShadow: "var(--shadow-card)", background: "var(--card-bg)", transition: "border-color 0.25s" }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left"
        style={{ borderBottom: open ? "1px solid var(--glass-border)" : "none" }}>
        <span className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: open ? "rgba(139,92,246,0.12)" : "var(--glass-bg)", border: `1px solid ${open ? "rgba(139,92,246,0.25)" : "var(--glass-border)"}` }}>
          <Eye className="h-3.5 w-3.5" style={{ color: open ? GHOST_COLOR : "hsl(var(--muted-foreground))" }} />
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-bold" style={{ color: "hsl(var(--foreground))" }}>Ghost Mode</span>
          <span className="text-[10px] font-mono ml-2" style={{ color: "hsl(var(--muted-foreground))" }}>
            Compare setup against your trade history
          </span>
        </div>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
          style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)", color: GHOST_COLOR }}>
          AI
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
               : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />}
      </button>

      {open && (
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-mono mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>Symbol</p>
              <div className="h-9 rounded-xl px-3 flex items-center font-mono text-[13px]"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))" }}>
                {symbol}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-mono mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>Side</p>
              <div className="flex gap-1.5">
                {(["long","short"] as const).map(s => (
                  <button key={s} type="button" onClick={() => setSide(s)}
                    className="flex-1 h-9 rounded-xl text-[13px] font-mono font-semibold capitalize transition-all"
                    style={side === s
                      ? { background: s === "long" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${s === "long" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, color: s === "long" ? "#22c55e" : "#ef4444" }
                      : { background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--muted-foreground))" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button type="button" onClick={runGhostMode} disabled={loading}
            className="flex items-center justify-center gap-2 h-9 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
            style={{ background: GHOST_COLOR, color: "#fff", border: "none" }}>
            {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Scanning history…</>
                     : <><Eye className="h-3.5 w-3.5" />Run Ghost Mode</>}
          </button>

          {result && (
            result.hasHistory ? (
              <div className="flex flex-col gap-3">
                {/* ── Proposed vs Historical ghost card ── */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Proposed setup */}
                  <div className="rounded-xl p-3 flex flex-col gap-2"
                    style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)" }}>
                    <p className="text-[8px] font-mono uppercase tracking-widest" style={{ color: GHOST_COLOR }}>Proposed</p>
                    <div>
                      <p className="text-[13px] font-bold font-mono" style={{ color: "hsl(var(--foreground))" }}>{symbol}</p>
                      <span className="text-[10px] font-mono font-semibold capitalize"
                        style={{ color: side === "long" ? "#22c55e" : "#ef4444" }}>{side}</span>
                    </div>
                    {selectedStratType && (
                      <p className="text-[9px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {selectedStratType.replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                  {/* Historical ghost */}
                  <div className="rounded-xl p-3 flex flex-col gap-2"
                    style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                    <p className="text-[8px] font-mono uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))" }}>Historical Ghost</p>
                    <div className="flex items-center gap-2">
                      {/* Mini similarity arc */}
                      <div className="relative flex-shrink-0" style={{ width: 34, height: 34 }}>
                        <svg width="34" height="34" viewBox="0 0 34 34" style={{ transform: "rotate(-225deg)" }}>
                          {(() => {
                            const R=13, S=3, C2=2*Math.PI*R, ARC=0.75*C2, OFF=ARC*(1-result.similarityScore/100);
                            return <>
                              <circle cx="17" cy="17" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={S} strokeDasharray={`${ARC} ${C2}`} strokeLinecap="round" />
                              <circle cx="17" cy="17" r={R} fill="none" stroke={GHOST_COLOR} strokeWidth={S} strokeDasharray={`${ARC} ${C2}`} strokeDashoffset={OFF} strokeLinecap="round" />
                            </>;
                          })()}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: 2 }}>
                          <span className="text-[10px] font-bold font-mono" style={{ color: GHOST_COLOR }}>{result.similarityScore}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-mono font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                          {result.similarityScore >= 70 ? "High match" : result.similarityScore >= 40 ? "Moderate" : "Low match"}
                        </p>
                        <p className="text-[9px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {result.similarTrades} similar setups
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Stats bar: Win Rate · Avg Return · Avg Drawdown ── */}
                <div className="rounded-xl px-4 py-3 flex flex-col gap-3"
                  style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                  {[
                    { label: "Win Rate",   value: result.winRate,     display: `${result.winRate}%`,                               color: result.winRate >= 50 ? "#22c55e" : "#ef4444",     max: 100 },
                    { label: "Avg Return", value: Math.max(0, result.avgReturn), display: `${result.avgReturn >= 0 ? "+" : ""}${result.avgReturn}%`, color: result.avgReturn >= 0 ? "#22c55e" : "#ef4444", max: 30  },
                    { label: "Avg Drawdown", value: result.avgDrawdown, display: `-${result.avgDrawdown}%`,                          color: result.avgDrawdown <= 10 ? "#22c55e" : result.avgDrawdown <= 20 ? "#f59e0b" : "#ef4444", max: 50  },
                  ].map(stat => (
                    <div key={stat.label}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] font-mono uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>{stat.label}</p>
                        <p className="text-[11px] font-bold font-mono" style={{ color: stat.color }}>{stat.display}</p>
                      </div>
                      <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, (stat.value / stat.max) * 100)}%`, background: stat.color }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-[9px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Based on {result.winCount + result.lossCount} similar {result.marketContext ?? ""} {side} trades
                  </p>
                </div>

                {/* Closest match */}
                {result.closestMatch && (
                  <div className="rounded-xl px-4 py-3"
                    style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)" }}>
                    <p className="text-[8px] font-mono uppercase tracking-wider mb-2" style={{ color: GHOST_COLOR }}>Closest Historical Match</p>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-mono font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                          {result.closestMatch.symbol} · {result.closestMatch.side.toUpperCase()}
                          {result.closestMatch.strategyType && <span className="ml-1.5 text-[9px] opacity-60">{result.closestMatch.strategyType.replace(/_/g, " ")}</span>}
                        </p>
                        <p className="text-[10px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {result.closestMatch.entryDate} → {result.closestMatch.exitDate} · {result.closestMatch.durationDays}d hold
                        </p>
                      </div>
                      <span className="text-sm font-bold font-mono flex-shrink-0"
                        style={{ color: result.closestMatch.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                        {result.closestMatch.pnlPercent >= 0 ? "+" : ""}{result.closestMatch.pnlPercent}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl px-4 py-3 flex items-center gap-2"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                <Eye className="h-4 w-4 flex-shrink-0 opacity-40" style={{ color: GHOST_COLOR }} />
                <p className="text-[12px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {result.message ?? "No trade history found."}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
