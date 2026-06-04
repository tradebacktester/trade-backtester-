import React, { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  BarChart2, Brain, Loader2, AlertCircle, ArrowLeft,
  TrendingUp, TrendingDown, ChevronDown, Sparkles, RefreshCw,
  CheckCircle2, XCircle, Clock, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

const API = "/api";

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

const C = {
  green:  "#22c55e",
  red:    "#ef4444",
  blue:   "#38bdf8",
  amber:  "#f59e0b",
  purple: "#a78bfa",
  muted:  "hsl(220,14%,48%)",
  sub:    "hsl(220,14%,68%)",
  text:   "hsl(220,14%,88%)",
  border: "rgba(255,255,255,0.08)",
  card:   "rgba(255,255,255,0.03)",
  bg:     "rgba(10,12,20,0.8)",
};

function PnlBadge({ pnl, pct }: { pnl: number; pct: number }) {
  const pos = pnl >= 0;
  const color = pos ? C.green : C.red;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2 py-0.5 rounded-lg"
      style={{ background: `${color}18`, color, border: `1px solid ${color}28` }}>
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="h-10 w-10" style={{ color: C.amber }} />
        <p className="text-base font-medium" style={{ color: C.text }}>Sign in to access Trade Analytics</p>
        <Link href="/dashboard"><Button variant="outline" size="sm">Go Home</Button></Link>
      </div>
    );
  }

  const STAT = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>{label}</span>
      <span className="text-sm font-bold font-mono" style={{ color: color ?? C.text }}>{value}</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <button className="h-8 w-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white/8"
            style={{ border: "1px solid rgba(255,255,255,0.09)", color: C.muted }}>
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5" style={{ color: C.blue }} />
          <h1 className="text-xl font-bold" style={{ color: C.text }}>Trade Analytics</h1>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: `${C.blue}18`, color: C.blue, border: `1px solid ${C.blue}28` }}>
          AI-powered
        </span>
      </div>

      <p className="text-sm" style={{ color: C.muted }}>
        Select a backtest and get AI analysis of each individual trade — why it succeeded or failed,
        the market condition it encountered, and what you can learn from it.
      </p>

      {/* Backtest selector */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <label className="text-[11px] uppercase tracking-widest font-medium" style={{ color: C.muted }}>
          Select Backtest
        </label>
        {loadingBacktests ? (
          <div className="flex items-center gap-2" style={{ color: C.muted }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading backtests…</span>
          </div>
        ) : backtests.length === 0 ? (
          <div className="flex items-center gap-2" style={{ color: C.amber }}>
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">No backtests yet — run one first from the <Link href="/backtests/new"><span className="underline cursor-pointer">Backtests</span></Link> page.</span>
          </div>
        ) : (
          <div className="relative">
            <select
              value={selectedId ?? ""}
              onChange={e => setSelectedId(Number(e.target.value))}
              className="w-full text-sm rounded-xl px-3 py-2 pr-8 appearance-none"
              style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, color: C.text, outline: "none" }}
            >
              {backtests.map(b => (
                <option key={b.id} value={b.id} style={{ background: "#0d0f1a" }}>
                  #{b.id} — {b.name || b.symbol} | {Number(b.totalReturn) >= 0 ? "+" : ""}{Number(b.totalReturn).toFixed(1)}% | {b.totalTrades} trades
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 pointer-events-none" style={{ color: C.muted }} />
          </div>
        )}

        {/* Selected backtest stats */}
        {selected && (
          <div className="flex flex-wrap gap-5 pt-1 border-t" style={{ borderColor: C.border }}>
            <STAT label="Symbol" value={selected.symbol} />
            <STAT label="Return" value={`${Number(selected.totalReturn) >= 0 ? "+" : ""}${Number(selected.totalReturn).toFixed(2)}%`}
              color={Number(selected.totalReturn) >= 0 ? C.green : C.red} />
            <STAT label="Win Rate" value={`${Number(selected.winRate).toFixed(1)}%`}
              color={Number(selected.winRate) >= 50 ? C.green : C.amber} />
            <STAT label="Trades" value={String(selected.totalTrades)} />
            <STAT label="Strategy" value={selected.strategy?.name ?? selected.name ?? "—"} />
          </div>
        )}
      </div>

      {/* Action bar */}
      {trades.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: C.muted }}>
            {trades.length} trade{trades.length !== 1 ? "s" : ""} ·{" "}
            {Object.values(analyses).filter(a => a.text).length} analyzed
          </span>
          <Button
            size="sm" onClick={analyzeAll} disabled={analyzingAll}
            className="gap-1.5 text-xs font-medium"
            style={{ background: `${C.blue}20`, color: C.blue, border: `1px solid ${C.blue}30` }}>
            {analyzingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Analyze All Trades
          </Button>
        </div>
      )}

      {/* Trades */}
      {loadingTrades && (
        <div className="flex items-center gap-2 py-4" style={{ color: C.muted }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading trades…</span>
        </div>
      )}

      {!loadingTrades && trades.length === 0 && selectedId && (
        <div className="text-center py-10" style={{ color: C.muted }}>
          <Target className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No trades found for this backtest.</p>
        </div>
      )}

      <div className="space-y-3">
        {trades.map((trade, idx) => {
          const pos = Number(trade.pnl) >= 0;
          const analysis = analyses[trade.id];
          const durationDays = Math.max(1, Math.round(
            (new Date(trade.exitDate).getTime() - new Date(trade.entryDate).getTime()) / 86400000
          ));

          return (
            <div key={trade.id} className="rounded-2xl overflow-hidden transition-all"
              style={{ background: C.card, border: `1px solid ${pos ? C.green + "22" : C.red + "22"}` }}>
              {/* Trade header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-[11px] font-mono w-6 text-center flex-shrink-0" style={{ color: C.muted }}>
                  #{idx + 1}
                </span>
                <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-md"
                  style={{ background: trade.side === "long" ? `${C.green}18` : `${C.red}18`, color: trade.side === "long" ? C.green : C.red }}>
                  {trade.side}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[12px] font-mono" style={{ color: C.sub }}>
                      {trade.entryDate} → {trade.exitDate}
                    </span>
                    <span className="text-[11px]" style={{ color: C.muted }}>
                      <Clock className="h-3 w-3 inline mr-0.5" />{durationDays}d
                    </span>
                    <span className="text-[12px] font-mono" style={{ color: C.muted }}>
                      ${Number(trade.entryPrice).toFixed(2)} → ${Number(trade.exitPrice).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <PnlBadge pnl={Number(trade.pnl)} pct={Number(trade.pnlPercent)} />
                  <span className="text-[11px] font-mono" style={{ color: pos ? C.green : C.red }}>
                    {pos ? "+" : ""}${Math.abs(Number(trade.pnl)).toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => analyzeOneTrade(trade)}
                  disabled={analysis?.loading}
                  className="h-7 px-2.5 rounded-lg flex items-center gap-1 text-[11px] font-medium transition-all flex-shrink-0"
                  style={{
                    background: analysis?.text ? `${C.purple}18` : `${C.blue}14`,
                    color: analysis?.text ? C.purple : C.blue,
                    border: `1px solid ${analysis?.text ? C.purple + "30" : C.blue + "25"}`,
                    opacity: analysis?.loading ? 0.6 : 1,
                  }}>
                  {analysis?.loading
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing…</>
                    : analysis?.text
                    ? <><RefreshCw className="h-3 w-3" /> Re-analyze</>
                    : <><Brain className="h-3 w-3" /> Analyze</>}
                </button>
              </div>

              {/* Analysis block */}
              {analysis?.text && (
                <div className="px-4 pb-3 pt-0">
                  <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
                    style={{ background: `${C.purple}10`, border: `1px solid ${C.purple}20` }}>
                    <Sparkles className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: C.purple }} />
                    <p className="text-[13px] leading-relaxed" style={{ color: C.sub }}>
                      {analysis.text}
                    </p>
                  </div>
                </div>
              )}
              {analysis?.error && (
                <div className="px-4 pb-3">
                  <div className="rounded-xl px-3 py-2 flex items-center gap-2"
                    style={{ background: `${C.red}10`, border: `1px solid ${C.red}20` }}>
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: C.red }} />
                    <p className="text-[12px]" style={{ color: C.red }}>{analysis.error}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary card if all analyzed */}
      {trades.length > 0 && Object.values(analyses).filter(a => a.text).length === trades.length && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: `${C.green}10`, border: `1px solid ${C.green}22` }}>
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: C.green }} />
          <div>
            <p className="text-sm font-medium" style={{ color: C.green }}>All {trades.length} trades analyzed</p>
            <p className="text-[12px] mt-0.5" style={{ color: C.muted }}>
              Review each trade's AI analysis above. Select a different backtest to analyze more trades.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
