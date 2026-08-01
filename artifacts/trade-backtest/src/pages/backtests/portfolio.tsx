import React, { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useListStrategies } from "@workspace/api-client-react";
import { API_BASE } from "@/lib/api-config";
import {
  ArrowLeft, Play, Layers, TrendingUp, TrendingDown, BarChart3,
  CheckCircle2, X, Loader2, Trophy, AlertTriangle,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AuthModal } from "@/components/auth-modal";
import { format, subYears } from "date-fns";

const ALL_SYMBOLS = [
  { value: "AAPL",    label: "Apple (AAPL)",        group: "Stocks" },
  { value: "MSFT",    label: "Microsoft (MSFT)",    group: "Stocks" },
  { value: "NVDA",    label: "Nvidia (NVDA)",       group: "Stocks" },
  { value: "TSLA",    label: "Tesla (TSLA)",        group: "Stocks" },
  { value: "AMZN",    label: "Amazon (AMZN)",       group: "Stocks" },
  { value: "GOOGL",   label: "Alphabet (GOOGL)",    group: "Stocks" },
  { value: "META",    label: "Meta (META)",         group: "Stocks" },
  { value: "SPY",     label: "S&P 500 (SPY)",       group: "ETFs"   },
  { value: "QQQ",     label: "Nasdaq (QQQ)",        group: "ETFs"   },
  { value: "GLD",     label: "Gold (GLD)",          group: "ETFs"   },
  { value: "BTCUSDT", label: "BTC/USDT",            group: "Crypto" },
  { value: "ETHUSDT", label: "ETH/USDT",            group: "Crypto" },
  { value: "SOLUSDT", label: "SOL/USDT",            group: "Crypto" },
  { value: "EURUSD",  label: "EUR/USD",             group: "Forex"  },
  { value: "GBPUSD",  label: "GBP/USD",             group: "Forex"  },
  { value: "USDJPY",  label: "USD/JPY",             group: "Forex"  },
  { value: "ES1!",    label: "E-mini S&P (ES)",     group: "Futures"},
  { value: "NQ1!",    label: "E-mini Nasdaq (NQ)",  group: "Futures"},
  { value: "GC1!",    label: "Gold Futures (GC)",   group: "Futures"},
  { value: "CL1!",    label: "Crude Oil (CL)",      group: "Futures"},
];

const COLOR_POOL = [
  "#ffffff", "#22c55e", "#3b82f6", "#f59e0b", "#ec4899",
  "#C0C0C0", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
];

interface SymbolResult {
  symbol: string;
  dataSource: string;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  finalCapital: number;
  equityCurve: { date: string; value: number; drawdown: number }[];
}

interface PortfolioResult {
  symbols: string[];
  results: SymbolResult[];
  portfolio: {
    totalReturn: number;
    annualizedReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    totalTrades: number;
    finalCapital: number;
    initialCapital: number;
    bestSymbol: string;
    worstSymbol: string;
    equityCurve: { date: string; value: number; drawdown: number }[];
    allocationPct: number;
  };
}

function fmt(n: number, dec = 2) { return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function pctColor(n: number) { return n >= 0 ? "#22c55e" : "#ef4444"; }

export default function PortfolioBacktest() {
  const { user, token } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { data: strategies } = useListStrategies({ query: { enabled: !!token } });

  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(["AAPL", "MSFT", "SPY"]);
  const [strategyId, setStrategyId] = useState<number>(0);
  const [startDate, setStartDate] = useState(format(subYears(new Date(), 2), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [initialCapital, setInitialCapital] = useState(100000);
  const [commission, setCommission] = useState(0.1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PortfolioResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleSymbol(sym: string) {
    setSelectedSymbols(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : prev.length < 10 ? [...prev, sym] : prev
    );
  }

  async function runPortfolio() {
    if (!user) { setShowAuthModal(true); return; }
    if (!token) return;
    if (strategyId === 0) { setError("Select a strategy first."); return; }
    if (selectedSymbols.length < 2) { setError("Select at least 2 symbols."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const resp = await fetch(`${API_BASE}/api/backtests/multi-asset`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ strategyId, symbols: selectedSymbols, startDate, endDate, initialCapital, commission }),
      });
      if (!resp.ok) {
        const d = await resp.json() as { error?: string };
        throw new Error(d.error ?? "Request failed");
      }
      const data = await resp.json() as PortfolioResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const groups = Array.from(new Set(ALL_SYMBOLS.map(s => s.group)));

  const chartData = result?.portfolio.equityCurve
    .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 300)) === 0)
    .map(p => ({ date: p.date.slice(0, 10), portfolio: Math.round(p.value) }));

  return (
    <div className="max-w-3xl mx-auto pb-16 space-y-5">
      {showAuthModal && <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />}

      <div className="flex items-center gap-3">
        <Link href="/backtests/new">
          <button className="h-9 w-9 flex items-center justify-center rounded-xl transition-colors"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <ArrowLeft className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-[22px] font-bold tracking-tight leading-none" style={{ color: "hsl(var(--foreground))" }}>Portfolio Backtest</h1>
          <p className="text-[12px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
            Run one strategy across multiple assets — equal-weight allocation
          </p>
        </div>
        <Layers className="h-5 w-5 opacity-40" style={{ color: "hsl(var(--foreground))" }} />
      </div>

      <div className="rounded-2xl p-5 space-y-5" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>
            Strategy
          </p>
          <select
            className="w-full rounded-xl px-3 py-2.5 text-[13px] font-mono outline-none"
            style={{ background: "var(--input)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))" }}
            value={strategyId}
            onChange={e => setStrategyId(Number(e.target.value))}
          >
            <option value={0}>— Select a strategy —</option>
            {(strategies ?? []).map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.type.replace(/_/g, " ")})</option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>
            Symbols <span style={{ color: selectedSymbols.length >= 10 ? "#f59e0b" : "hsl(var(--muted-foreground))" }}>({selectedSymbols.length}/10)</span>
          </p>
          {groups.map(group => (
            <div key={group}>
              <p className="text-[10px] font-mono uppercase tracking-wider mb-1.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_SYMBOLS.filter(s => s.group === group).map(s => {
                  const selected = selectedSymbols.includes(s.value);
                  const idx = selectedSymbols.indexOf(s.value);
                  return (
                    <button key={s.value} onClick={() => toggleSymbol(s.value)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all flex items-center gap-1"
                      style={{
                        background: selected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                        border: selected ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.06)",
                        color: selected ? COLOR_POOL[idx % COLOR_POOL.length] : "hsl(var(--muted-foreground))",
                      }}>
                      {selected && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: COLOR_POOL[idx % COLOR_POOL.length] }} />}
                      {s.value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-[13px] font-mono outline-none"
              style={{ background: "var(--input)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))" }} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-[13px] font-mono outline-none"
              style={{ background: "var(--input)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))" }} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Capital ($)</label>
            <input type="number" value={initialCapital} onChange={e => setInitialCapital(Number(e.target.value))}
              className="w-full rounded-xl px-3 py-2 text-[13px] font-mono outline-none"
              style={{ background: "var(--input)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))" }} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Commission (%)</label>
            <input type="number" step="0.01" value={commission} onChange={e => setCommission(Number(e.target.value))}
              className="w-full rounded-xl px-3 py-2 text-[13px] font-mono outline-none"
              style={{ background: "var(--input)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))" }} />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: "#ef4444" }} />
            <p className="text-[12px] font-mono" style={{ color: "#ef4444" }}>{error}</p>
          </div>
        )}

        <button onClick={runPortfolio} disabled={loading}
          className="w-full py-3 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all"
          style={{
            background: loading ? "rgba(255,255,255,0.05)" : "#ffffff",
            color: loading ? "hsl(var(--muted-foreground))" : "#050505",
          }}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Running…</> : <><Play className="h-4 w-4" />Run Portfolio Backtest</>}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Portfolio Summary ({result.portfolio.allocationPct.toFixed(0)}% per asset)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Return",    value: `${result.portfolio.totalReturn >= 0 ? "+" : ""}${fmt(result.portfolio.totalReturn)}%`, color: pctColor(result.portfolio.totalReturn) },
                { label: "Ann. Return",     value: `${result.portfolio.annualizedReturn >= 0 ? "+" : ""}${fmt(result.portfolio.annualizedReturn)}%`, color: pctColor(result.portfolio.annualizedReturn) },
                { label: "Max Drawdown",    value: `-${fmt(result.portfolio.maxDrawdown)}%`,  color: "#ef4444" },
                { label: "Sharpe Ratio",    value: fmt(result.portfolio.sharpeRatio),          color: result.portfolio.sharpeRatio >= 1 ? "#22c55e" : result.portfolio.sharpeRatio >= 0.5 ? "#f59e0b" : "#ef4444" },
                { label: "Win Rate",        value: `${fmt(result.portfolio.winRate)}%`,         color: result.portfolio.winRate >= 50 ? "#22c55e" : "#ef4444" },
                { label: "Total Trades",    value: String(result.portfolio.totalTrades),        color: "hsl(var(--foreground))" },
                { label: "Final Capital",   value: `$${fmt(result.portfolio.finalCapital, 0)}`, color: pctColor(result.portfolio.totalReturn) },
                { label: "Best Asset",      value: result.portfolio.bestSymbol,                 color: "#22c55e" },
              ].map(m => (
                <div key={m.label} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>{m.label}</p>
                  <p className="text-[14px] font-bold font-mono" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>

            {chartData && chartData.length > 1 && (
              <div className="h-48">
                <p className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>Portfolio Equity Curve</p>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => v.slice(0, 7)} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `$${(v as number / 1000).toFixed(0)}k`} width={48} />
                    <Tooltip formatter={(v: unknown) => [`$${fmt(v as number, 0)}`, "Portfolio"]} labelStyle={{ color: "#fff", fontSize: 10 }} contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
                    <Line type="monotone" dataKey="portfolio" stroke="#ffffff" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider px-1" style={{ color: "hsl(var(--muted-foreground))" }}>Per-Asset Breakdown</p>
            {result.results.map((r, idx) => (
              <div key={r.symbol} className="rounded-2xl px-4 py-3 flex items-center gap-4"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLOR_POOL[idx % COLOR_POOL.length] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold font-mono" style={{ color: "hsl(var(--foreground))" }}>{r.symbol}</p>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "hsl(var(--muted-foreground))" }}>{r.dataSource}</span>
                    {r.symbol === result.portfolio.bestSymbol && <Trophy className="h-3 w-3" style={{ color: "#f59e0b" }} />}
                  </div>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-[11px] font-mono" style={{ color: pctColor(r.totalReturn) }}>{r.totalReturn >= 0 ? "+" : ""}{fmt(r.totalReturn)}%</span>
                    <span className="text-[11px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>DD {fmt(r.maxDrawdown)}%</span>
                    <span className="text-[11px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>WR {fmt(r.winRate)}%</span>
                    <span className="text-[11px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{r.totalTrades}T</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[12px] font-bold font-mono" style={{ color: pctColor(r.totalReturn) }}>
                    ${fmt(r.finalCapital, 0)}
                  </p>
                  <p className="text-[9px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>Sharpe {fmt(r.sharpeRatio)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
