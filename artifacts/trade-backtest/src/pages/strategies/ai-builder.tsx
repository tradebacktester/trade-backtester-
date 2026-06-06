import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Wand2, ArrowLeft, Sparkles, RotateCcw, Play, Save,
  ChevronRight, AlertTriangle, CheckCircle2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/lib/api-config";

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
interface BuiltStrategy {
  type: string;
  name: string;
  symbol: string;
  timeframe: string;
  parameters: Record<string, number>;
  reasoning: string;
}

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const STRATEGY_LABELS: Record<string, string> = {
  sma_crossover:   "SMA Crossover",
  ema_crossover:   "EMA Crossover",
  rsi:             "RSI",
  macd:            "MACD",
  bollinger_bands: "Bollinger Bands",
};

const PARAM_LABELS: Record<string, string> = {
  shortPeriod:   "Short Period",
  longPeriod:    "Long Period",
  period:        "Period",
  overbought:    "Overbought",
  oversold:      "Oversold",
  fastPeriod:    "Fast Period",
  slowPeriod:    "Slow Period",
  signalPeriod:  "Signal Period",
  stdDev:        "Std Dev Multiplier",
};

const SUGGESTIONS = [
  "Buy when RSI drops below 30 and sell when it goes above 70 on Bitcoin",
  "EMA crossover strategy — 9 and 21 periods — on Ethereum",
  "MACD bullish crossover on SOL with fast 12, slow 26, signal 9",
  "Bollinger Bands mean reversion — buy the lower band, sell the upper band on BTC",
  "Simple SMA golden cross: 50 and 200 day moving averages on ETH",
];

/* ─────────────────────────────────────────────
   PARAM DISPLAY
───────────────────────────────────────────── */
function ParamRow({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{PARAM_LABELS[k] ?? k}</span>
      <span className="text-sm font-semibold font-mono tabular-nums">{v}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */
export default function AiBuilder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BuiltStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleBuild() {
    if (!description.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch(`${API_BASE}/api/ai/build-strategy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("tt_token") ?? ""}`,
        },
        body: JSON.stringify({ description }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Failed to parse strategy");
      setResult(data as BuiltStrategy);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate strategy");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setIsSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/api/strategies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("tt_token") ?? ""}`,
        },
        body: JSON.stringify({
          name: result.name,
          description: `AI-generated from: "${description}"`,
          type: result.type,
          symbol: result.symbol,
          timeframe: result.timeframe,
          parameters: result.parameters,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Failed to save strategy");
      toast({ title: "Strategy Saved", description: `"${result.name}" saved successfully.` });
      setLocation(`/strategies/${data.id}`);
    } catch (e: unknown) {
      toast({
        title: "Save Failed",
        description: e instanceof Error ? e.message : "Could not save strategy",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleRunBacktest() {
    if (!result) return;
    const params = new URLSearchParams({
      type: result.type,
      name: result.name,
      symbol: result.symbol,
      params: JSON.stringify(result.parameters),
    });
    setLocation(`/backtests/new?${params.toString()}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link href="/strategies">
          <button className="h-9 w-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted/50 transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wand2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI Strategy Builder</h1>
            <p className="text-xs text-muted-foreground">Describe a strategy in plain English — AI converts it to backtestable parameters</p>
          </div>
        </div>
      </div>

      {/* ── Input ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <label className="text-sm font-semibold text-foreground">Describe your strategy</label>
        <Textarea
          className="min-h-[120px] resize-none text-sm font-mono bg-muted/30 focus-visible:ring-primary/40"
          placeholder="e.g. Buy when RSI drops below 30 and sell when it goes above 70 on Bitcoin daily chart…"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleBuild();
          }}
        />

        {/* Suggestions */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide">Try an example</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => setDescription(s)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors text-left"
              >
                {s.length > 52 ? s.slice(0, 49) + "…" : s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            onClick={handleBuild}
            disabled={!description.trim() || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Parsing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Build Strategy
              </>
            )}
          </Button>
          {(description || result) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDescription(""); setResult(null); setError(null); }}
              className="gap-1.5 text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground font-mono">
            ⌘ + Enter to build
          </span>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* ── Loading skeleton ───────────────────────────────────────── */}
      {isLoading && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3 animate-pulse">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-4/5 rounded bg-muted" />
          <div className="h-3 w-3/5 rounded bg-muted" />
        </div>
      )}

      {/* ── Result ─────────────────────────────────────────────────── */}
      {result && !isLoading && (
        <div className="rounded-2xl border border-primary/20 bg-card overflow-hidden shadow-sm">
          {/* Result header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60 bg-primary/5">
            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-foreground truncate">{result.name}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {STRATEGY_LABELS[result.type] ?? result.type} · {result.symbol} · {result.timeframe}
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Parameters */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Parameters</p>
              <div className="rounded-xl bg-muted/30 border border-border/50 px-4 divide-y divide-border/40">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Strategy Type</span>
                  <span className="text-sm font-semibold">{STRATEGY_LABELS[result.type] ?? result.type}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Symbol</span>
                  <span className="text-sm font-semibold font-mono">{result.symbol}</span>
                </div>
                {Object.entries(result.parameters).map(([k, v]) => (
                  <ParamRow key={k} k={k} v={v} />
                ))}
              </div>
            </div>

            {/* AI Reasoning */}
            <div className="rounded-xl bg-muted/20 border border-border/50 px-4 py-3">
              <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground mb-1.5">AI Reasoning</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{result.reasoning}</p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={handleRunBacktest} className="gap-2">
                <Play className="h-4 w-4" />
                Run Backtest
              </Button>
              <Button onClick={handleSave} variant="outline" disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Strategy
              </Button>
              <Button variant="ghost" onClick={handleBuild} disabled={isLoading} className="gap-2 text-muted-foreground ml-auto">
                <Sparkles className="h-3.5 w-3.5" />
                Regenerate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── How it works ───────────────────────────────────────────── */}
      {!result && !isLoading && !error && (
        <div className="rounded-2xl border border-border bg-muted/20 p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">How it works</p>
          {[
            ["1", "Describe your strategy", "Write a plain-English description of your trading idea — entry conditions, indicators, and asset."],
            ["2", "AI parses it", "Llama 3.3 70B maps your description to one of 5 supported indicator strategies with appropriate parameters."],
            ["3", "Backtest instantly", "The generated strategy can be run as a backtest immediately or saved to your strategy library."],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {num}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
          <div className="pt-1">
            <Link href="/strategies">
              <button className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                Browse existing strategies <ChevronRight className="h-3 w-3" />
              </button>
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
