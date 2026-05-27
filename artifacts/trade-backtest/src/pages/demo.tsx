import { useState, useCallback, useEffect, useRef } from "react";
import {
  TrendingUp, TrendingDown, RotateCcw, Zap, Activity,
  Target, DollarSign, BarChart2, Layers, AlertCircle, Clock,
} from "lucide-react";

type OrderSide = "buy" | "sell";

interface DemoTrade {
  id: number;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  exitPrice?: number;
  size: number;
  leverage: number;
  margin: number;
  pnl?: number;
  pnlPct?: number;
  openTime: number;
  closeTime?: number;
  status: "open" | "closed";
}

const BALANCE_OPTIONS = [
  { value: 1_000,   label: "$1,000",   badge: "Micro" },
  { value: 10_000,  label: "$10,000",  badge: "Retail" },
  { value: 100_000, label: "$100,000", badge: "Pro" },
  { value: 500_000, label: "$500,000", badge: "Institutional" },
];

const LEVERAGE_OPTIONS = [1, 2, 5, 10, 25, 50, 100];

const DEMO_SYMBOLS = [
  { value: "BTCUSDT",  label: "BTC/USDT",  price: 76_420.50, change: 2.34  },
  { value: "ETHUSDT",  label: "ETH/USDT",  price: 3_521.80,  change: 1.87  },
  { value: "SOLUSDT",  label: "SOL/USDT",  price: 182.40,    change: -0.92 },
  { value: "BNBUSDT",  label: "BNB/USDT",  price: 608.20,    change: 0.45  },
  { value: "XRPUSDT",  label: "XRP/USDT",  price: 0.6234,    change: -1.23 },
  { value: "ADAUSDT",  label: "ADA/USDT",  price: 0.4567,    change: 3.12  },
  { value: "LINKUSDT", label: "LINK/USDT", price: 18.92,     change: -0.67 },
  { value: "INJUSDT",  label: "INJ/USDT",  price: 28.45,     change: 5.23  },
];

const DEMO_STORAGE_KEY = "tt_demo_v2";

function fmtUSD(n: number) {
  return `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function useSimPrice(base: number) {
  const [price, setPrice] = useState(base);
  const baseRef = useRef(base);
  baseRef.current = base;
  useEffect(() => {
    setPrice(baseRef.current);
    const tick = () => {
      setPrice(p => Math.max(0.0001, p + (Math.random() - 0.5) * 0.0018 * p));
    };
    const id = setInterval(tick, 900);
    return () => clearInterval(id);
  }, []);
  return price;
}

function SetupScreen({ onStart }: { onStart: (balance: number) => void }) {
  const [selected, setSelected] = useState(10_000);

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto py-2">
      <div
        className="rounded-2xl px-5 py-6 border relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(0,229,255,0.07) 0%, rgba(255,255,255,0.01) 100%)",
          borderColor: "rgba(0,229,255,0.2)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.4), 0 0 60px rgba(0,229,255,0.06), inset 0 1px 0 rgba(0,229,255,0.1)",
        }}
      >
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(0,229,255,0.14), transparent)" }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(0,229,255,0.12)", border: "1px solid rgba(0,229,255,0.25)" }}>
              <Zap className="h-6 w-6" style={{ color: "hsl(190,90%,65%)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "hsl(220,14%,92%)" }}>Paper Trading</h1>
              <p className="text-sm" style={{ color: "hsl(220,14%,42%)" }}>Practice without risking real money</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            {[
              { icon: <Activity className="h-3.5 w-3.5" />, label: "Live simulated prices" },
              { icon: <Target className="h-3.5 w-3.5" />, label: "Real P&L tracking" },
              { icon: <BarChart2 className="h-3.5 w-3.5" />, label: "Performance analytics" },
              { icon: <Layers className="h-3.5 w-3.5" />, label: "Up to 100x leverage" },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ color: "hsl(190,90%,60%)" }}>{f.icon}</span>
                <span style={{ color: "hsl(220,14%,55%)" }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest mb-3 px-1" style={{ color: "hsl(220,14%,40%)" }}>
          Choose Starting Balance
        </p>
        <div className="grid grid-cols-2 gap-2">
          {BALANCE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className="flex flex-col gap-1 p-4 rounded-2xl border transition-all text-left"
              style={selected === opt.value ? {
                background: "rgba(0,229,255,0.1)",
                borderColor: "rgba(0,229,255,0.35)",
                boxShadow: "0 0 24px rgba(0,229,255,0.1), inset 0 1px 0 rgba(0,229,255,0.1)",
              } : {
                background: "rgba(255,255,255,0.02)",
                borderColor: "rgba(255,255,255,0.07)",
              }}
            >
              <span className="text-xl sm:text-2xl font-bold font-mono"
                style={{ color: selected === opt.value ? "hsl(190,90%,65%)" : "hsl(220,14%,75%)" }}>
                {opt.label}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full self-start"
                style={{ background: selected === opt.value ? "rgba(0,229,255,0.15)" : "rgba(255,255,255,0.05)", color: selected === opt.value ? "hsl(190,90%,65%)" : "hsl(220,14%,45%)" }}>
                {opt.badge}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onStart(selected)}
        className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, hsl(190,90%,40%), hsl(210,80%,50%))",
          color: "#fff",
          boxShadow: "0 8px 32px rgba(0,229,255,0.3), 0 0 0 1px rgba(0,229,255,0.2)",
        }}
      >
        Start Paper Trading
      </button>
    </div>
  );
}

function MarketRow({ sym, isSelected, onClick }: {
  sym: typeof DEMO_SYMBOLS[0];
  isSelected: boolean;
  onClick: () => void;
}) {
  const price = useSimPrice(sym.price);
  const isUp = sym.change >= 0;
  const fmt = (p: number) => p < 1 ? p.toFixed(4) : p < 100 ? p.toFixed(2) : p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-all w-full text-left"
      style={isSelected ? {
        background: "rgba(0,229,255,0.1)",
        border: "1px solid rgba(0,229,255,0.25)",
      } : {
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <p className="text-xs font-mono font-semibold" style={{ color: isSelected ? "hsl(190,90%,65%)" : "hsl(220,14%,75%)" }}>
        {sym.label}
      </p>
      <div className="text-right">
        <p className="text-xs font-mono font-bold" style={{ color: isUp ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>{fmt(price)}</p>
        <p className="text-[10px] font-mono" style={{ color: isUp ? "hsl(150,90%,55%)" : "hsl(0,85%,60%)" }}>{isUp ? "+" : ""}{sym.change.toFixed(2)}%</p>
      </div>
    </button>
  );
}

function TradingInterface({ initialBalance, onReset }: { initialBalance: number; onReset: () => void }) {
  const [balance, setBalance] = useState(initialBalance);
  const [trades, setTrades] = useState<DemoTrade[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState(DEMO_SYMBOLS[0]);
  const [leverage, setLeverage] = useState(10);
  const [riskPct, setRiskPct] = useState(5);
  const [tab, setTab] = useState<"trade" | "positions" | "history" | "analytics">("trade");
  const [showConfirm, setShowConfirm] = useState<OrderSide | null>(null);
  const livePrice = useSimPrice(selectedSymbol.price);

  const openPositions = trades.filter(t => t.status === "open");
  const closedTrades = trades.filter(t => t.status === "closed");

  const totalOpenPnl = openPositions.reduce((acc, t) => {
    const diff = livePrice - t.entryPrice;
    return acc + (t.side === "buy" ? diff : -diff) * t.size * t.leverage / t.entryPrice;
  }, 0);

  const equity = balance + totalOpenPnl;
  const usedMargin = openPositions.reduce((acc, t) => acc + t.margin, 0);
  const freeMargin = equity - usedMargin;
  const totalRealizedPnl = closedTrades.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
  const wins = closedTrades.filter(t => (t.pnl ?? 0) > 0).length;
  const losses = closedTrades.filter(t => (t.pnl ?? 0) <= 0).length;
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
  const riskAmount = (balance * riskPct) / 100;
  const positionSize = (riskAmount * leverage) / livePrice;
  const margin = riskAmount;

  function placeOrder(side: OrderSide) {
    if (margin > freeMargin) return;
    const trade: DemoTrade = {
      id: Date.now(),
      symbol: selectedSymbol.value,
      side,
      entryPrice: livePrice,
      size: positionSize,
      leverage,
      margin,
      openTime: Date.now(),
      status: "open",
    };
    setTrades(prev => [trade, ...prev]);
    setBalance(b => b - margin);
    setShowConfirm(null);
  }

  function closePosition(tradeId: number, closePrice: number) {
    let pnlAmount = 0;
    let marginBack = 0;
    setTrades(prev => prev.map(t => {
      if (t.id !== tradeId || t.status !== "open") return t;
      const diff = closePrice - t.entryPrice;
      const pnl = (t.side === "buy" ? diff : -diff) * t.size * t.leverage / t.entryPrice;
      const pnlPct = (pnl / t.margin) * 100;
      pnlAmount = pnl;
      marginBack = t.margin;
      return { ...t, exitPrice: closePrice, pnl, pnlPct, closeTime: Date.now(), status: "closed" };
    }));
    setBalance(b => b + marginBack + pnlAmount);
  }

  const statCards = [
    { label: "Equity",      value: fmtUSD(equity), color: equity >= initialBalance ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)", sub: fmtPct(((equity - initialBalance) / initialBalance) * 100) },
    { label: "Free Margin", value: fmtUSD(freeMargin), color: "hsl(220,14%,75%)", sub: usedMargin > 0 ? `${fmtUSD(usedMargin)} used` : "No positions" },
    { label: "Realized P&L", value: (totalRealizedPnl >= 0 ? "+" : "") + fmtUSD(totalRealizedPnl), color: totalRealizedPnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)", sub: `${closedTrades.length} closed` },
    { label: "Win Rate",    value: closedTrades.length > 0 ? `${winRate.toFixed(0)}%` : "—", color: winRate >= 50 ? "hsl(150,90%,58%)" : winRate > 0 ? "hsl(0,85%,62%)" : "hsl(220,14%,55%)", sub: `${wins}W / ${losses}L` },
  ];

  const fmtPrice = (p: number) => p < 1 ? p.toFixed(4) : p < 100 ? p.toFixed(2) : p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col gap-3 pb-6">

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {statCards.map(s => (
          <div key={s.label} className="rounded-xl px-3 py-3 border flex flex-col gap-0.5"
            style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.07)" }}>
            <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,35%)" }}>{s.label}</p>
            <p className="text-base sm:text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] font-mono" style={{ color: "hsl(220,14%,40%)" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Market list */}
        <div className="rounded-2xl border p-3 flex flex-col gap-2"
          style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.07)" }}>
          <p className="text-[10px] font-mono uppercase tracking-widest px-1" style={{ color: "hsl(220,14%,38%)" }}>Markets</p>
          <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: "260px" }}>
            {DEMO_SYMBOLS.map(sym => (
              <MarketRow
                key={sym.value}
                sym={sym}
                isSelected={sym.value === selectedSymbol.value}
                onClick={() => setSelectedSymbol(sym)}
              />
            ))}
          </div>
        </div>

        {/* Order panel */}
        <div className="rounded-2xl border p-4 flex flex-col gap-3.5"
          style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold font-mono" style={{ color: "hsl(190,90%,65%)" }}>{selectedSymbol.label}</p>
              <p className="text-xl font-bold font-mono" style={{ color: selectedSymbol.change >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>
                {fmtPrice(livePrice)}
              </p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-xl"
              style={selectedSymbol.change >= 0
                ? { background: "rgba(52,211,153,0.1)", color: "hsl(150,90%,58%)", border: "1px solid rgba(52,211,153,0.2)" }
                : { background: "rgba(239,68,68,0.1)", color: "hsl(0,85%,62%)", border: "1px solid rgba(239,68,68,0.2)" }}>
              {selectedSymbol.change >= 0 ? "+" : ""}{selectedSymbol.change.toFixed(2)}%
            </span>
          </div>

          {/* Leverage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,38%)" }}>Leverage</p>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                style={{ background: "rgba(245,158,11,0.1)", color: "hsl(38,100%,65%)", border: "1px solid rgba(245,158,11,0.2)" }}>
                {leverage}x
              </span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {LEVERAGE_OPTIONS.map(lev => (
                <button
                  key={lev}
                  onClick={() => setLeverage(lev)}
                  className="px-2 py-1 text-[11px] font-mono rounded-lg transition-all"
                  style={leverage === lev
                    ? { background: "rgba(245,158,11,0.15)", color: "hsl(38,100%,65%)", border: "1px solid rgba(245,158,11,0.3)" }
                    : { background: "rgba(255,255,255,0.04)", color: "hsl(220,14%,50%)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {lev}x
                </button>
              ))}
            </div>
          </div>

          {/* Risk */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,38%)" }}>Risk</p>
              <span className="text-xs font-mono font-bold" style={{ color: "hsl(220,14%,65%)" }}>
                {riskPct}% · {fmtUSD(riskAmount)} margin
              </span>
            </div>
            <input
              type="range" min={1} max={50} value={riskPct}
              onChange={e => setRiskPct(Number(e.target.value))}
              className="w-full h-1.5 rounded-full cursor-pointer"
              style={{ accentColor: "hsl(190,90%,55%)" }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] font-mono" style={{ color: "hsl(220,14%,35%)" }}>1%</span>
              <span className="text-[9px] font-mono" style={{ color: "hsl(220,14%,35%)" }}>50%</span>
            </div>
          </div>

          {/* Order summary */}
          <div className="rounded-xl p-3 flex flex-col gap-1.5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {[
              { label: "Position Size", value: `${positionSize.toFixed(4)} ${selectedSymbol.label.split("/")[0]}` },
              { label: "Notional Value", value: fmtUSD(positionSize * livePrice) },
              { label: "Required Margin", value: fmtUSD(margin) },
              { label: "Available", value: fmtUSD(freeMargin), warn: margin > freeMargin },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between text-xs font-mono">
                <span style={{ color: "hsl(220,14%,42%)" }}>{r.label}</span>
                <span style={{ color: r.warn ? "hsl(0,85%,62%)" : "hsl(220,14%,75%)" }}>{r.value}</span>
              </div>
            ))}
          </div>

          {margin > freeMargin && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "hsl(0,85%,65%)" }}>
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              Insufficient margin — reduce risk or close positions
            </div>
          )}

          {/* Buy / Sell */}
          <div className="grid grid-cols-2 gap-2">
            {(["buy", "sell"] as OrderSide[]).map(side => (
              <button
                key={side}
                disabled={margin > freeMargin}
                onClick={() => setShowConfirm(side)}
                className="py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-30 active:scale-[0.97]"
                style={side === "buy" ? {
                  background: "linear-gradient(135deg, hsl(150,80%,26%), hsl(150,80%,20%))",
                  color: "hsl(150,90%,65%)",
                  border: "1px solid rgba(52,211,153,0.3)",
                  boxShadow: "0 4px 20px rgba(52,211,153,0.15)",
                } : {
                  background: "linear-gradient(135deg, hsl(0,70%,26%), hsl(0,70%,20%))",
                  color: "hsl(0,85%,70%)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  boxShadow: "0 4px 20px rgba(239,68,68,0.15)",
                }}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {side === "buy" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {side.toUpperCase()}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Positions / History / Analytics */}
        <div className="rounded-2xl border flex flex-col" style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.07)", minHeight: "360px" }}>
          <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {(["positions", "history", "analytics"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2.5 text-[11px] font-mono capitalize transition-all"
                style={tab === t
                  ? { color: "hsl(190,90%,65%)", borderBottom: "2px solid hsl(190,90%,65%)" }
                  : { color: "hsl(220,14%,45%)" }}
              >
                {t === "positions" ? `Positions (${openPositions.length})` : t === "history" ? `History (${closedTrades.length})` : "Analytics"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {tab === "positions" && (
              openPositions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
                  <Activity className="h-8 w-8 opacity-15" />
                  <p className="text-xs font-mono" style={{ color: "hsl(220,14%,38%)" }}>No open positions</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {openPositions.map(t => {
                    const diff = livePrice - t.entryPrice;
                    const pnl = (t.side === "buy" ? diff : -diff) * t.size * t.leverage / t.entryPrice;
                    const pnlPct = (pnl / t.margin) * 100;
                    return (
                      <div key={t.id} className="rounded-xl p-3 border"
                        style={pnl >= 0 ? { background: "rgba(52,211,153,0.04)", borderColor: "rgba(52,211,153,0.15)" } : { background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.15)" }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold"
                              style={t.side === "buy" ? { background: "rgba(52,211,153,0.15)", color: "hsl(150,90%,65%)" } : { background: "rgba(239,68,68,0.15)", color: "hsl(0,85%,65%)" }}>
                              {t.side.toUpperCase()}
                            </span>
                            <span className="text-xs font-mono font-semibold" style={{ color: "hsl(220,14%,75%)" }}>
                              {DEMO_SYMBOLS.find(s => s.value === t.symbol)?.label}
                            </span>
                            <span className="text-[10px] font-mono" style={{ color: "hsl(38,100%,60%)" }}>{t.leverage}x</span>
                          </div>
                          <button
                            onClick={() => closePosition(t.id, livePrice)}
                            className="text-[10px] font-mono px-2 py-1 rounded-lg transition-all"
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "hsl(220,14%,55%)" }}
                          >
                            Close
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
                          <div className="flex justify-between"><span style={{ color: "hsl(220,14%,42%)" }}>Entry</span><span style={{ color: "hsl(220,14%,70%)" }}>${fmtPrice(t.entryPrice)}</span></div>
                          <div className="flex justify-between"><span style={{ color: "hsl(220,14%,42%)" }}>Current</span><span style={{ color: "hsl(220,14%,70%)" }}>${fmtPrice(livePrice)}</span></div>
                          <div className="flex justify-between col-span-2 pt-1 mt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                            <span style={{ color: "hsl(220,14%,42%)" }}>Unrealized P&L</span>
                            <span className="font-bold" style={{ color: pnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>
                              {pnl >= 0 ? "+" : ""}{fmtUSD(pnl)} ({fmtPct(pnlPct)})
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {tab === "history" && (
              closedTrades.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
                  <Clock className="h-8 w-8 opacity-15" />
                  <p className="text-xs font-mono" style={{ color: "hsl(220,14%,38%)" }}>No closed trades yet</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {[...closedTrades].reverse().map(t => (
                    <div key={t.id} className="rounded-xl p-3 border"
                      style={(t.pnl ?? 0) >= 0 ? { background: "rgba(52,211,153,0.04)", borderColor: "rgba(52,211,153,0.12)" } : { background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.12)" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold"
                            style={t.side === "buy" ? { background: "rgba(52,211,153,0.15)", color: "hsl(150,90%,65%)" } : { background: "rgba(239,68,68,0.15)", color: "hsl(0,85%,65%)" }}>
                            {t.side.toUpperCase()}
                          </span>
                          <span className="text-xs font-mono" style={{ color: "hsl(220,14%,65%)" }}>
                            {DEMO_SYMBOLS.find(s => s.value === t.symbol)?.label}
                          </span>
                        </div>
                        <span className="text-sm font-mono font-bold"
                          style={{ color: (t.pnl ?? 0) >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>
                          {(t.pnl ?? 0) >= 0 ? "+" : ""}{fmtUSD(t.pnl ?? 0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono" style={{ color: "hsl(220,14%,40%)" }}>
                        <span>${fmtPrice(t.entryPrice)} → ${fmtPrice(t.exitPrice ?? 0)}</span>
                        <span>{fmtPct(t.pnlPct ?? 0)} ({t.leverage}x)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === "analytics" && (
              <div className="flex flex-col gap-3 py-2">
                {[
                  { label: "Total Trades",   value: String(closedTrades.length), color: "hsl(220,14%,75%)" },
                  { label: "Win Rate",       value: closedTrades.length > 0 ? `${winRate.toFixed(1)}%` : "—", color: winRate >= 50 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" },
                  { label: "Total P&L",      value: (totalRealizedPnl >= 0 ? "+" : "") + fmtUSD(totalRealizedPnl), color: totalRealizedPnl >= 0 ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" },
                  { label: "Return",         value: fmtPct(((equity - initialBalance) / initialBalance) * 100), color: equity >= initialBalance ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" },
                  { label: "Best Win",       value: closedTrades.length > 0 ? "+" + fmtUSD(Math.max(0, ...closedTrades.map(t => t.pnl ?? 0))) : "—", color: "hsl(150,90%,58%)" },
                  { label: "Worst Loss",     value: closedTrades.length > 0 ? fmtUSD(Math.min(0, ...closedTrades.map(t => t.pnl ?? 0))) : "—", color: "hsl(0,85%,62%)" },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="text-xs font-mono" style={{ color: "hsl(220,14%,45%)" }}>{s.label}</span>
                    <span className="text-sm font-mono font-bold" style={{ color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono transition-all"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "hsl(220,14%,40%)" }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Account
        </button>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)" }}>
          <div
            className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
            style={{
              background: "hsl(222,28%,10%)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.75)",
              animation: "tt-slide-up 0.18s ease-out",
            }}
          >
            <h3 className="text-base font-bold font-mono" style={{ color: "hsl(220,14%,88%)" }}>
              Confirm {showConfirm === "buy" ? "Buy" : "Sell"} Order
            </h3>
            <div className="flex flex-col gap-2 text-xs font-mono">
              {[
                { l: "Symbol",   v: selectedSymbol.label },
                { l: "Side",     v: showConfirm.toUpperCase() },
                { l: "Price",    v: `$${fmtPrice(livePrice)}` },
                { l: "Leverage", v: `${leverage}x` },
                { l: "Margin",   v: fmtUSD(margin) },
              ].map(r => (
                <div key={r.l} className="flex justify-between items-center py-1.5 border-b"
                  style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "hsl(220,14%,42%)" }}>{r.l}</span>
                  <span style={{ color: "hsl(220,14%,75%)" }}>{r.v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-mono transition-all active:scale-[0.97]"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "hsl(220,14%,55%)" }}>
                Cancel
              </button>
              <button
                onClick={() => placeOrder(showConfirm)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold font-mono transition-all active:scale-[0.97]"
                style={showConfirm === "buy"
                  ? { background: "hsl(150,80%,26%)", color: "hsl(150,90%,65%)", border: "1px solid rgba(52,211,153,0.3)" }
                  : { background: "hsl(0,70%,26%)", color: "hsl(0,85%,70%)", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                Confirm {showConfirm === "buy" ? "Buy" : "Sell"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DemoPage() {
  const [startBalance, setStartBalance] = useState<number | null>(() => {
    try {
      const v = sessionStorage.getItem(DEMO_STORAGE_KEY);
      return v ? Number(v) : null;
    } catch { return null; }
  });

  function handleStart(balance: number) {
    try { sessionStorage.setItem(DEMO_STORAGE_KEY, String(balance)); } catch {}
    setStartBalance(balance);
  }

  function handleReset() {
    try { sessionStorage.removeItem(DEMO_STORAGE_KEY); } catch {}
    setStartBalance(null);
  }

  const header = (sub: string) => (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(0,229,255,0.12)", border: "1px solid rgba(0,229,255,0.2)" }}>
          <Zap className="h-5 w-5" style={{ color: "hsl(190,90%,65%)" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "hsl(220,14%,92%)" }}>Demo Account</h1>
          <p className="text-xs" style={{ color: "hsl(220,14%,42%)" }}>{sub}</p>
        </div>
      </div>
      {startBalance && (
        <span className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full"
          style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "hsl(150,80%,55%)" }}>
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "hsl(150,90%,52%)" }} />
          Live Sim
        </span>
      )}
    </div>
  );

  if (!startBalance) {
    return (
      <div>
        {header("Risk-free paper trading simulator")}
        <SetupScreen onStart={handleStart} />
      </div>
    );
  }

  return (
    <div>
      {header("Paper trading · Simulated prices")}
      <TradingInterface initialBalance={startBalance} onReset={handleReset} />
    </div>
  );
}
