import { useState, useCallback, useEffect, useRef } from "react";
import {
  TrendingUp, TrendingDown, RotateCcw, Zap, Activity,
  Target, DollarSign, BarChart2, Layers, AlertCircle, Clock,
  ChevronDown,
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

/* helpers */
function fmtUSD(n: number) {
  return `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtPrice(p: number) {
  return p < 1 ? p.toFixed(4) : p < 100 ? p.toFixed(2) : p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* simulated price hook */
function useSimPrice(base: number) {
  const [price, setPrice] = useState(base);
  const baseRef = useRef(base);
  baseRef.current = base;
  useEffect(() => {
    setPrice(baseRef.current);
    const tick = () => setPrice(p => Math.max(0.0001, p + (Math.random() - 0.5) * 0.0018 * p));
    const id = setInterval(tick, 900);
    return () => clearInterval(id);
  }, []);
  return price;
}

/* card wrapper */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border ${className}`}
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.014))",
        borderColor: "rgba(255,255,255,0.075)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </div>
  );
}

/* ── Setup Screen ─────────────────────────────────────────────────── */
function SetupScreen({ onStart }: { onStart: (balance: number) => void }) {
  const [selected, setSelected] = useState(10_000);

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto py-2">
      {/* Hero card */}
      <div
        className="rounded-2xl px-5 py-6 border relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.09) 0%, rgba(255,255,255,0.015) 100%)",
          borderColor: "rgba(59,130,246,0.22)",
          boxShadow: "0 8px 36px rgba(0,0,0,0.35), 0 0 50px rgba(59,130,246,0.06), inset 0 1px 0 rgba(59,130,246,0.1)",
        }}
      >
        <div className="absolute -top-8 -right-8 h-36 w-36 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.14), transparent)" }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(59,130,246,0.14)", border: "1px solid rgba(59,130,246,0.28)" }}>
              <Zap className="h-6 w-6" style={{ color: "hsl(210,90%,65%)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: "hsl(218,16%,90%)" }}>Paper Trading</h1>
              <p className="text-sm" style={{ color: "hsl(218,12%,42%)" }}>Practice without risking real money</p>
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
                <span style={{ color: "hsl(210,90%,62%)" }}>{f.icon}</span>
                <span style={{ color: "hsl(218,12%,52%)" }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Balance picker */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest mb-3 px-1" style={{ color: "hsl(218,12%,38%)" }}>
          Choose Starting Balance
        </p>
        <div className="grid grid-cols-2 gap-2">
          {BALANCE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className="flex flex-col gap-1 p-4 rounded-2xl border transition-all text-left"
              style={selected === opt.value ? {
                background: "rgba(59,130,246,0.1)",
                borderColor: "rgba(59,130,246,0.35)",
                boxShadow: "0 0 20px rgba(59,130,246,0.1), inset 0 1px 0 rgba(59,130,246,0.1)",
              } : {
                background: "rgba(255,255,255,0.024)",
                borderColor: "rgba(255,255,255,0.07)",
              }}
            >
              <span className="text-xl font-bold font-mono"
                style={{ color: selected === opt.value ? "hsl(210,90%,65%)" : "hsl(218,14%,72%)" }}>
                {opt.label}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full self-start"
                style={{
                  background: selected === opt.value ? "rgba(59,130,246,0.14)" : "rgba(255,255,255,0.05)",
                  color: selected === opt.value ? "hsl(210,90%,65%)" : "hsl(218,12%,42%)",
                }}>
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
          background: "linear-gradient(135deg, hsl(210,85%,44%), hsl(215,80%,54%))",
          color: "#fff",
          boxShadow: "0 8px 28px rgba(59,130,246,0.3), 0 0 0 1px rgba(59,130,246,0.2)",
        }}
      >
        Start Paper Trading
      </button>
    </div>
  );
}

/* ── Market ticker row ───────────────────────────────────────────── */
function MarketRow({ sym, isSelected, onClick }: {
  sym: typeof DEMO_SYMBOLS[0]; isSelected: boolean; onClick: () => void;
}) {
  const price = useSimPrice(sym.price);
  const isUp = sym.change >= 0;
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between px-3 py-2 rounded-xl transition-all w-full text-left"
      style={isSelected ? {
        background: "rgba(59,130,246,0.1)",
        border: "1px solid rgba(59,130,246,0.25)",
      } : {
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <p className="text-xs font-mono font-semibold"
        style={{ color: isSelected ? "hsl(210,90%,65%)" : "hsl(218,14%,72%)" }}>
        {sym.label}
      </p>
      <div className="text-right">
        <p className="text-xs font-mono font-bold"
          style={{ color: isUp ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>
          {fmtPrice(price)}
        </p>
        <p className="text-[10px] font-mono"
          style={{ color: isUp ? "hsl(150,78%,52%)" : "hsl(0,76%,58%)" }}>
          {isUp ? "+" : ""}{sym.change.toFixed(2)}%
        </p>
      </div>
    </button>
  );
}

/* ── Trading interface ───────────────────────────────────────────── */
function TradingInterface({ initialBalance, onReset }: { initialBalance: number; onReset: () => void }) {
  const [balance, setBalance] = useState(initialBalance);
  const [trades, setTrades] = useState<DemoTrade[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState(DEMO_SYMBOLS[0]);
  const [leverage, setLeverage] = useState(10);
  const [riskPct, setRiskPct] = useState(5);
  const [tab, setTab] = useState<"trade" | "positions" | "history" | "analytics">("trade");
  const [showConfirm, setShowConfirm] = useState<OrderSide | null>(null);
  const [showMarkets, setShowMarkets] = useState(false);
  const livePrice = useSimPrice(selectedSymbol.price);

  const openPositions = trades.filter(t => t.status === "open");
  const closedTrades  = trades.filter(t => t.status === "closed");

  const totalOpenPnl = openPositions.reduce((acc, t) => {
    const diff = livePrice - t.entryPrice;
    return acc + (t.side === "buy" ? diff : -diff) * t.size * t.leverage / t.entryPrice;
  }, 0);

  const equity        = balance + totalOpenPnl;
  const usedMargin    = openPositions.reduce((acc, t) => acc + t.margin, 0);
  const freeMargin    = equity - usedMargin;
  const totalRealizedPnl = closedTrades.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
  const wins          = closedTrades.filter(t => (t.pnl ?? 0) > 0).length;
  const losses_       = closedTrades.filter(t => (t.pnl ?? 0) <= 0).length;
  const winRate       = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
  const riskAmount    = (balance * riskPct) / 100;
  const positionSize  = (riskAmount * leverage) / livePrice;
  const margin        = riskAmount;

  function placeOrder(side: OrderSide) {
    if (margin > freeMargin) return;
    const trade: DemoTrade = {
      id: Date.now(), symbol: selectedSymbol.value, side,
      entryPrice: livePrice, size: positionSize, leverage, margin,
      openTime: Date.now(), status: "open",
    };
    setTrades(prev => [trade, ...prev]);
    setBalance(b => b - margin);
    setShowConfirm(null);
  }

  function closePosition(tradeId: number, closePrice: number) {
    let pnlAmount = 0; let marginBack = 0;
    setTrades(prev => prev.map(t => {
      if (t.id !== tradeId || t.status !== "open") return t;
      const diff = closePrice - t.entryPrice;
      const pnl = (t.side === "buy" ? diff : -diff) * t.size * t.leverage / t.entryPrice;
      const pnlPct = (pnl / t.margin) * 100;
      pnlAmount = pnl; marginBack = t.margin;
      return { ...t, exitPrice: closePrice, pnl, pnlPct, closeTime: Date.now(), status: "closed" };
    }));
    setBalance(b => b + marginBack + pnlAmount);
  }

  const ACCENT = "hsl(210,90%,62%)";

  const statCards = [
    { label: "Equity",      value: fmtUSD(equity),        color: equity >= initialBalance ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)", sub: fmtPct(((equity - initialBalance) / initialBalance) * 100) },
    { label: "Free Margin", value: fmtUSD(freeMargin),    color: "hsl(218,14%,72%)", sub: usedMargin > 0 ? `${fmtUSD(usedMargin)} used` : "No positions" },
    { label: "Realized P&L", value: (totalRealizedPnl >= 0 ? "+" : "") + fmtUSD(totalRealizedPnl), color: totalRealizedPnl >= 0 ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)", sub: `${closedTrades.length} closed` },
    { label: "Win Rate",    value: closedTrades.length > 0 ? `${winRate.toFixed(0)}%` : "—", color: winRate >= 50 ? "hsl(150,80%,55%)" : winRate > 0 ? "hsl(0,78%,60%)" : "hsl(218,12%,50%)", sub: `${wins}W / ${losses_}L` },
  ];

  const TABS = [
    { id: "trade" as const,     label: "Trade" },
    { id: "positions" as const, label: `Positions (${openPositions.length})` },
    { id: "history" as const,   label: `History (${closedTrades.length})` },
    { id: "analytics" as const, label: "Analytics" },
  ];

  return (
    <div className="flex flex-col gap-3 pb-6">

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {statCards.map(s => (
          <div key={s.label} className="rounded-xl px-3 py-3 border flex flex-col gap-0.5"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.038), rgba(255,255,255,0.012))",
              borderColor: "rgba(255,255,255,0.07)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
            }}>
            <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(218,12%,34%)" }}>{s.label}</p>
            <p className="text-base sm:text-lg font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] font-mono" style={{ color: "hsl(218,12%,38%)" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Header bar with symbol selector */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowMarkets(v => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all"
          style={{
            background: "rgba(59,130,246,0.08)",
            borderColor: "rgba(59,130,246,0.2)",
            color: ACCENT,
          }}
        >
          <span className="text-sm font-mono font-bold">{selectedSymbol.label}</span>
          <span className="text-base font-bold font-mono" style={{ color: selectedSymbol.change >= 0 ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>
            {fmtPrice(livePrice)}
          </span>
          <ChevronDown className="h-3.5 w-3.5" style={{ color: ACCENT, transform: showMarkets ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono transition-all"
          style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "hsl(218,12%,45%)" }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {/* Markets dropdown */}
      {showMarkets && (
        <Card className="p-3">
          <p className="text-[9px] font-mono uppercase tracking-widest px-1 mb-2" style={{ color: "hsl(218,12%,36%)" }}>Select Market</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {DEMO_SYMBOLS.map(sym => (
              <MarketRow key={sym.value} sym={sym}
                isSelected={sym.value === selectedSymbol.value}
                onClick={() => { setSelectedSymbol(sym); setShowMarkets(false); }} />
            ))}
          </div>
        </Card>
      )}

      {/* Tab bar */}
      <div className="flex gap-0.5 p-0.5 rounded-2xl"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.065)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2 text-[10px] sm:text-xs font-mono rounded-xl transition-all"
            style={tab === t.id ? {
              background: "rgba(59,130,246,0.14)",
              color: ACCENT,
              border: "1px solid rgba(59,130,246,0.22)",
            } : { color: "hsl(218,12%,44%)", border: "1px solid transparent" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Trade ── */}
      {tab === "trade" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          {/* Order panel */}
          <Card className="p-4 flex flex-col gap-4">
            {/* Leverage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(218,12%,36%)" }}>Leverage</p>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg"
                  style={{ background: "rgba(245,158,11,0.1)", color: "hsl(38,95%,65%)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  {leverage}x
                </span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {LEVERAGE_OPTIONS.map(lev => (
                  <button key={lev} onClick={() => setLeverage(lev)}
                    className="px-2 py-1 text-[11px] font-mono rounded-lg transition-all"
                    style={leverage === lev
                      ? { background: "rgba(245,158,11,0.14)", color: "hsl(38,95%,65%)", border: "1px solid rgba(245,158,11,0.28)" }
                      : { background: "rgba(255,255,255,0.04)", color: "hsl(218,12%,48%)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    {lev}x
                  </button>
                ))}
              </div>
            </div>

            {/* Risk slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(218,12%,36%)" }}>Risk</p>
                <span className="text-xs font-mono font-bold" style={{ color: "hsl(218,14%,62%)" }}>
                  {riskPct}% · {fmtUSD(riskAmount)} margin
                </span>
              </div>
              <input type="range" min={1} max={50} value={riskPct}
                onChange={e => setRiskPct(Number(e.target.value))}
                className="w-full h-1.5 rounded-full cursor-pointer"
                style={{ accentColor: ACCENT }} />
              <div className="flex justify-between mt-1">
                <span className="text-[9px] font-mono" style={{ color: "hsl(218,12%,33%)" }}>1%</span>
                <span className="text-[9px] font-mono" style={{ color: "hsl(218,12%,33%)" }}>50%</span>
              </div>
            </div>

            {/* Order summary */}
            <div className="rounded-xl p-3 flex flex-col gap-1.5"
              style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {[
                { label: "Position Size", value: `${positionSize.toFixed(4)} ${selectedSymbol.label.split("/")[0]}` },
                { label: "Notional Value", value: fmtUSD(positionSize * livePrice) },
                { label: "Required Margin", value: fmtUSD(margin) },
                { label: "Available", value: fmtUSD(freeMargin), warn: margin > freeMargin },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between text-xs font-mono">
                  <span style={{ color: "hsl(218,12%,40%)" }}>{r.label}</span>
                  <span style={{ color: r.warn ? "hsl(0,78%,60%)" : "hsl(218,14%,72%)" }}>{r.value}</span>
                </div>
              ))}
            </div>

            {margin > freeMargin && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono"
                style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", color: "hsl(0,78%,62%)" }}>
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                Insufficient margin — reduce risk or close positions
              </div>
            )}

            {/* Buy / Sell buttons */}
            <div className="grid grid-cols-2 gap-2">
              {(["buy", "sell"] as OrderSide[]).map(side => (
                <button key={side}
                  disabled={margin > freeMargin}
                  onClick={() => placeOrder(side)}
                  className="py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-30 active:scale-[0.97]"
                  style={side === "buy" ? {
                    background: "linear-gradient(135deg, hsl(150,72%,22%), hsl(150,72%,17%))",
                    color: "hsl(150,80%,62%)",
                    border: "1px solid rgba(52,211,153,0.28)",
                    boxShadow: "0 4px 18px rgba(52,211,153,0.12)",
                  } : {
                    background: "linear-gradient(135deg, hsl(0,62%,24%), hsl(0,62%,18%))",
                    color: "hsl(0,78%,68%)",
                    border: "1px solid rgba(239,68,68,0.28)",
                    boxShadow: "0 4px 18px rgba(239,68,68,0.12)",
                  }}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    {side === "buy" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {side.toUpperCase()}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Quick market list */}
          <Card className="p-3 flex flex-col gap-2">
            <p className="text-[9px] font-mono uppercase tracking-widest px-1" style={{ color: "hsl(218,12%,36%)" }}>Markets</p>
            <div className="flex flex-col gap-1.5">
              {DEMO_SYMBOLS.map(sym => (
                <MarketRow key={sym.value} sym={sym}
                  isSelected={sym.value === selectedSymbol.value}
                  onClick={() => setSelectedSymbol(sym)} />
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Tab: Positions ── */}
      {tab === "positions" && (
        <Card className="p-3">
          {openPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10">
              <Activity className="h-8 w-8 opacity-15" />
              <p className="text-xs font-mono" style={{ color: "hsl(218,12%,36%)" }}>No open positions</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {openPositions.map(t => {
                const diff = livePrice - t.entryPrice;
                const pnl = (t.side === "buy" ? diff : -diff) * t.size * t.leverage / t.entryPrice;
                const pnlPct = (pnl / t.margin) * 100;
                return (
                  <div key={t.id} className="rounded-xl p-3 border"
                    style={pnl >= 0
                      ? { background: "rgba(52,211,153,0.04)", borderColor: "rgba(52,211,153,0.14)" }
                      : { background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.14)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold"
                          style={t.side === "buy"
                            ? { background: "rgba(52,211,153,0.14)", color: "hsl(150,80%,62%)" }
                            : { background: "rgba(239,68,68,0.14)", color: "hsl(0,78%,65%)" }}>
                          {t.side.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono font-semibold" style={{ color: "hsl(218,14%,72%)" }}>
                          {DEMO_SYMBOLS.find(s => s.value === t.symbol)?.label}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: "hsl(38,95%,60%)" }}>{t.leverage}x</span>
                      </div>
                      <button onClick={() => closePosition(t.id, livePrice)}
                        className="text-[10px] font-mono px-2 py-1 rounded-lg transition-all"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "hsl(218,12%,52%)" }}>
                        Close
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
                      <div className="flex justify-between"><span style={{ color: "hsl(218,12%,40%)" }}>Entry</span><span style={{ color: "hsl(218,14%,68%)" }}>${fmtPrice(t.entryPrice)}</span></div>
                      <div className="flex justify-between"><span style={{ color: "hsl(218,12%,40%)" }}>Current</span><span style={{ color: "hsl(218,14%,68%)" }}>${fmtPrice(livePrice)}</span></div>
                      <div className="flex justify-between col-span-2 pt-1 mt-1"
                        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <span style={{ color: "hsl(218,12%,40%)" }}>Unrealized P&L</span>
                        <span className="font-bold" style={{ color: pnl >= 0 ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>
                          {pnl >= 0 ? "+" : ""}{fmtUSD(pnl)} ({fmtPct(pnlPct)})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── Tab: History ── */}
      {tab === "history" && (
        <Card className="p-3">
          {closedTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10">
              <Clock className="h-8 w-8 opacity-15" />
              <p className="text-xs font-mono" style={{ color: "hsl(218,12%,36%)" }}>No closed trades yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {closedTrades.map(t => {
                const isProfit = (t.pnl ?? 0) > 0;
                return (
                  <div key={t.id} className="rounded-xl p-3 border"
                    style={{ background: "rgba(255,255,255,0.022)", borderColor: "rgba(255,255,255,0.065)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold"
                          style={t.side === "buy"
                            ? { background: "rgba(52,211,153,0.1)", color: "hsl(150,80%,60%)" }
                            : { background: "rgba(239,68,68,0.1)", color: "hsl(0,78,62%)" }}>
                          {t.side.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono font-semibold" style={{ color: "hsl(218,14%,70%)" }}>
                          {DEMO_SYMBOLS.find(s => s.value === t.symbol)?.label}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: "hsl(38,95%,58%)" }}>{t.leverage}x</span>
                      </div>
                      <span className="text-sm font-bold font-mono"
                        style={{ color: isProfit ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>
                        {isProfit ? "+" : ""}{fmtUSD(t.pnl ?? 0)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                      <div className="flex flex-col gap-0.5">
                        <span style={{ color: "hsl(218,12%,38%)" }}>Entry</span>
                        <span style={{ color: "hsl(218,14%,65%)" }}>${fmtPrice(t.entryPrice)}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span style={{ color: "hsl(218,12%,38%)" }}>Exit</span>
                        <span style={{ color: "hsl(218,14%,65%)" }}>${fmtPrice(t.exitPrice ?? 0)}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span style={{ color: "hsl(218,12%,38%)" }}>P&L %</span>
                        <span style={{ color: isProfit ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>
                          {fmtPct(t.pnlPct ?? 0)}
                        </span>
                      </div>
                    </div>
                    <p className="text-[9px] font-mono mt-2" style={{ color: "hsl(218,12%,32%)" }}>
                      {fmtTime(t.openTime)} → {t.closeTime ? fmtTime(t.closeTime) : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── Tab: Analytics ── */}
      {tab === "analytics" && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Total Trades",    value: String(closedTrades.length), color: "hsl(218,14%,80%)" },
            { label: "Win Rate",        value: closedTrades.length ? `${winRate.toFixed(0)}%` : "—", color: winRate >= 50 ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" },
            { label: "Profitable",      value: String(wins), color: "hsl(150,80%,55%)" },
            { label: "Losses",          value: String(losses_), color: "hsl(0,78%,60%)" },
            { label: "Realized P&L",    value: (totalRealizedPnl >= 0 ? "+" : "") + fmtUSD(totalRealizedPnl), color: totalRealizedPnl >= 0 ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" },
            { label: "Open Equity PnL", value: (totalOpenPnl >= 0 ? "+" : "") + fmtUSD(totalOpenPnl), color: totalOpenPnl >= 0 ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" },
          ].map(s => (
            <Card key={s.label} className="p-3 flex flex-col gap-0.5">
              <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(218,12%,34%)" }}>{s.label}</p>
              <p className="text-base font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────── */
export default function DemoPage() {
  const [startBalance, setStartBalance] = useState<number | null>(null);

  if (!startBalance) {
    return <SetupScreen onStart={setStartBalance} />;
  }

  return <TradingInterface initialBalance={startBalance} onReset={() => setStartBalance(null)} />;
}
