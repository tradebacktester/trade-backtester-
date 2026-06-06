import React, { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  BarChart2, Brain, Loader2, AlertCircle, ArrowLeft,
  TrendingUp, TrendingDown, ChevronDown, Sparkles, RefreshCw,
  CheckCircle2, Clock, Target, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { API } from "@/lib/api-config";


type Backtest = {
  id: number;
  name: string;
  symbol: string;
  startDate: string;
  endDate: string;
  totalReturn: number;
  winRate: number;
  totalTrades: number;
  strategy?: { name: string; type: string };
};

type Trade = {
  id: number;
  side: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  quantity: number;
};

type AnalysisMap = Record<number, { loading: boolean; text: string | null; error: string | null }>;

const ACCENT = {
  green:  "#22c55e",
  red:    "#ef4444",
  blue:   "#38bdf8",
  amber:  "#f59e0b",
  purple: "#a78bfa",
};

function PnlBadge({ pnl, pct }: { pnl: number; pct: number }) {
  const pos = pnl >= 0;
  const color = pos ? ACCENT.green : ACCENT.red;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-lg"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos ? "+" : ""}{pct.toFixed(2)}%
    </span>
  );
}

export default function AnalyticsPage() {
  const { token, user } = useAuth();
  const { toast } = useToast();

  const [backtests, setBacktests] = useState<Backtest[]>([]);
  const [loadingBacktests, setLoadingBacktests] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [analyses, setAnalyses] = useState<AnalysisMap>({});
  const [analyzingAll, setAnalyzingAll] = useState(false);

  const selected = backtests.find(b => b.id === selectedId);

  useEffect(() => {
    if (!token) { setLoadingBacktests(false); return; }
    fetch(`${API}/backtests`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.backtests ?? []);
        setBacktests(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch(() => toast({ title: "Error", description: "Could not load backtests", variant: "destructive" }))
      .finally(() => setLoadingBacktests(false));
  }, [token]);

  useEffect(() => {
    if (!selectedId || !token) { setTrades([]); return; }
    setLoadingTrades(true);
    setAnalyses({});
    fetch(`${API}/backtests/${selectedId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setTrades(data.trades ?? data.backtest?.trades ?? []))
      .catch(() => toast({ title: "Error", description: "Could not load trades", variant: "destructive" }))
      .finally(() => setLoadingTrades(false));
  }, [selectedId, token]);

  const analyzeOneTrade = useCallback(async (trade: Trade) => {
    if (!selected || !token) return;
    setAnalyses(prev => ({ ...prev, [trade.id]: { loading: true, text: null, error: null } }));
    try {
      const r = await fetch(`${API}/ai/analyze-trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          trade: {
            side: trade.side,
            entryDate: trade.entryDate,
            exitDate: trade.exitDate,
            entryPrice: Number(trade.entryPrice),
            exitPrice: Number(trade.exitPrice),
            pnl: Number(trade.pnl),
            pnlPercent: Number(trade.pnlPercent),
          },
          context: {
            symbol: selected.symbol,
            strategyName: selected.strategy?.name ?? selected.name,
            strategyType: selected.strategy?.type ?? "unknown",
            winRate: Number(selected.winRate),
            totalReturn: Number(selected.totalReturn),
          },
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Analysis failed");
      setAnalyses(prev => ({ ...prev, [trade.id]: { loading: false, text: data.analysis, error: null } }));
    } catch (err: any) {
      setAnalyses(prev => ({ ...prev, [trade.id]: { loading: false, text: null, error: err.message ?? "Error" } }));
    }
  }, [selected, token]);

  const analyzeAll = useCallback(async () => {
    if (!trades.length) return;
    setAnalyzingAll(true);
    for (const trade of trades) {
      await analyzeOneTrade(trade);
    }
    setAnalyzingAll(false);
  }, [trades, analyzeOneTrade]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
        <div className="h-20 w-20 rounded-3xl flex items-center justify-center"
          style={{ background: `${ACCENT.blue}15`, border: `1px solid ${ACCENT.blue}30` }}>
          <BarChart2 className="h-9 w-9" style={{ color: ACCENT.blue }} />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-semibold" style={{ color: "hsl(var(--foreground))" }}>Sign in to access Trade Analytics</p>
          <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            Get AI-powered analysis of every trade in your backtests.
          </p>
        </div>
        <Link href="/dashboard"><Button variant="outline" size="sm">Go Home</Button></Link>
      </div>
    );
  }

  const analyzedCount = Object.values(analyses).filter(a => a.text).length;
  const ret = Number(selected?.totalReturn ?? 0);
  const wr = Number(selected?.winRate ?? 0);

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-24">

      {/* ── Hero Header ──────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden px-5 py-5"
        style={{
          background: "linear-gradient(135deg, var(--glass-bg) 0%, color-mix(in srgb, hsl(var(--background)) 96%, #38bdf8 4%) 100%)",
          border: "1px solid var(--glass-border)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}>
        <div className="absolute top-0 right-0 h-32 w-32 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${ACCENT.blue}20, transparent)`, transform: "translate(30%,-30%)" }} />
        <div className="flex items-center gap-3 mb-1">
          <Link href="/dashboard">
            <button className="h-8 w-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--muted-foreground))" }}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          </Link>
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${ACCENT.blue}18`, border: `1px solid ${ACCENT.blue}30` }}>
            <BarChart2 className="h-5 w-5" style={{ color: ACCENT.blue }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>Trade Analytics</h1>
          </div>
          <span className="ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{ background: `${ACCENT.purple}15`, color: ACCENT.purple, border: `1px solid ${ACCENT.purple}25` }}>
            <Zap className="h-3 w-3" /> AI-Powered
          </span>
        </div>
        <p className="text-sm ml-[52px]" style={{ color: "hsl(var(--muted-foreground))" }}>
          Select a backtest to get AI analysis of each trade — what worked, what didn't, and why.
        </p>
      </div>

      {/* ── Backtest Selector ────────────────────────────────────── */}
      <div className="rounded-2xl p-4 space-y-4"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
            Select Backtest
          </label>
          {trades.length > 0 && (
            <Button
              size="sm" onClick={analyzeAll} disabled={analyzingAll}
              className="gap-1.5 text-xs h-7 px-3"
              style={{ background: `${ACCENT.blue}15`, color: ACCENT.blue, border: `1px solid ${ACCENT.blue}25` }}>
              {analyzingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Analyze All
            </Button>
          )}
        </div>

        {loadingBacktests ? (
          <div className="flex items-center gap-2" style={{ color: "hsl(var(--muted-foreground))" }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading backtests…</span>
          </div>
        ) : backtests.length === 0 ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <Target className="h-8 w-8 opacity-30" style={{ color: "hsl(var(--muted-foreground))" }} />
            <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              No backtests yet —{" "}
              <Link href="/backtests/new">
                <span className="underline cursor-pointer" style={{ color: ACCENT.blue }}>run one first</span>
              </Link>
            </p>
          </div>
        ) : (
          <div className="relative">
            <select
              value={selectedId ?? ""}
              onChange={e => setSelectedId(Number(e.target.value))}
              className="w-full text-sm rounded-xl px-3 py-2.5 pr-9 appearance-none font-medium"
              style={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
                outline: "none",
              }}
            >
              {backtests.map(b => (
                <option key={b.id} value={b.id} style={{ background: "hsl(var(--background))" }}>
                  #{b.id} — {b.name || b.symbol} · {Number(b.totalReturn) >= 0 ? "+" : ""}{Number(b.totalReturn).toFixed(1)}% · {b.totalTrades} trades
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3 h-4 w-4 pointer-events-none" style={{ color: "hsl(var(--muted-foreground))" }} />
          </div>
        )}

        {/* Stats strip */}
        {selected && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {[
              { label: "Symbol", value: selected.symbol, color: ACCENT.blue },
              { label: "Total Return", value: `${ret >= 0 ? "+" : ""}${ret.toFixed(2)}%`, color: ret >= 0 ? ACCENT.green : ACCENT.red },
              { label: "Win Rate", value: `${wr.toFixed(1)}%`, color: wr >= 50 ? ACCENT.green : ACCENT.amber },
              { label: "Trades", value: String(selected.totalTrades), color: "hsl(var(--foreground))" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl px-3 py-2.5 text-center"
                style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}>
                <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</p>
                <p className="text-sm font-bold font-mono" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Progress */}
        {trades.length > 0 && analyzedCount > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                {analyzedCount} / {trades.length} trades analyzed
              </span>
              {analyzedCount === trades.length && (
                <span className="text-[11px] flex items-center gap-1" style={{ color: ACCENT.green }}>
                  <CheckCircle2 className="h-3 w-3" /> All done
                </span>
              )}
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--border))" }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(analyzedCount / trades.length) * 100}%`, background: `linear-gradient(90deg, ${ACCENT.blue}, ${ACCENT.purple})` }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Trade List ───────────────────────────────────────────── */}
      {loadingTrades && (
        <div className="flex items-center justify-center py-12 gap-2" style={{ color: "hsl(var(--muted-foreground))" }}>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading trades…</span>
        </div>
      )}

      {!loadingTrades && trades.length === 0 && selectedId && (
        <div className="flex flex-col items-center py-16 gap-3">
          <Target className="h-10 w-10 opacity-25" style={{ color: "hsl(var(--muted-foreground))" }} />
          <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>No trades found for this backtest.</p>
        </div>
      )}

      <div className="space-y-3">
        {trades.map((trade, idx) => {
          const pos = Number(trade.pnl) >= 0;
          const analysis = analyses[trade.id];
          const durationDays = Math.max(1, Math.round(
            (new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime()) / 86400000
          ));
          const sideColor = trade.side === "long" ? ACCENT.green : ACCENT.red;

          return (
            <div key={trade.id}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "var(--glass-bg)",
                border: `1px solid ${pos ? ACCENT.green + "20" : ACCENT.red + "20"}`,
                boxShadow: `0 2px 12px ${pos ? ACCENT.green + "08" : ACCENT.red + "08"}`,
              }}>

              {/* Trade header row */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                {/* Index */}
                <span className="text-[11px] font-mono w-5 text-right flex-shrink-0"
                  style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
                  {idx + 1}
                </span>

                {/* Side badge */}
                <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg tracking-wide flex-shrink-0"
                  style={{ background: `${sideColor}15`, color: sideColor, border: `1px solid ${sideColor}25` }}>
                  {trade.side}
                </span>

                {/* Dates + duration */}
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[11px] font-mono truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {trade.entryDate} → {trade.exitDate}
                  </span>
                  <span className="text-[10px] flex items-center gap-1" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
                    <Clock className="h-2.5 w-2.5" /> {durationDays}d hold · ${Number(trade.entryPrice).toFixed(2)} → ${Number(trade.exitPrice).toFixed(2)}
                  </span>
                </div>

                {/* PnL */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <PnlBadge pnl={Number(trade.pnl)} pct={Number(trade.pnlPercent)} />
                  <span className="text-xs font-mono font-semibold" style={{ color: pos ? ACCENT.green : ACCENT.red }}>
                    {pos ? "+" : "−"}${Math.abs(Number(trade.pnl)).toFixed(2)}
                  </span>
                </div>

                {/* Analyze button */}
                <button
                  onClick={() => analyzeOneTrade(trade)}
                  disabled={analysis?.loading}
                  className="h-8 px-3 rounded-xl flex items-center gap-1.5 text-[11px] font-semibold transition-all flex-shrink-0 hover:scale-105"
                  style={{
                    background: analysis?.text ? `${ACCENT.purple}15` : `${ACCENT.blue}12`,
                    color: analysis?.text ? ACCENT.purple : ACCENT.blue,
                    border: `1px solid ${analysis?.text ? ACCENT.purple + "28" : ACCENT.blue + "22"}`,
                    opacity: analysis?.loading ? 0.6 : 1,
                  }}>
                  {analysis?.loading
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing</>
                    : analysis?.text
                    ? <><RefreshCw className="h-3 w-3" /> Redo</>
                    : <><Brain className="h-3 w-3" /> Analyze</>}
                </button>
              </div>

              {/* AI analysis */}
              {analysis?.text && (
                <div className="px-4 pb-4">
                  <div className="rounded-xl px-4 py-3 flex items-start gap-2.5"
                    style={{ background: `${ACCENT.purple}10`, border: `1px solid ${ACCENT.purple}20` }}>
                    <Sparkles className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: ACCENT.purple }} />
                    <p className="text-[13px] leading-relaxed" style={{ color: "hsl(var(--foreground))", opacity: 0.85 }}>
                      {analysis.text}
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {analysis?.error && (
                <div className="px-4 pb-4">
                  <div className="rounded-xl px-3 py-2 flex items-center gap-2"
                    style={{ background: `${ACCENT.red}10`, border: `1px solid ${ACCENT.red}20` }}>
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: ACCENT.red }} />
                    <p className="text-[12px]" style={{ color: ACCENT.red }}>{analysis.error}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* All analyzed banner */}
      {trades.length > 0 && analyzedCount === trades.length && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: `${ACCENT.green}0c`, border: `1px solid ${ACCENT.green}25` }}>
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: ACCENT.green }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: ACCENT.green }}>All {trades.length} trades analyzed</p>
            <p className="text-[12px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              Review the AI insights above. Select a different backtest to analyze more.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
