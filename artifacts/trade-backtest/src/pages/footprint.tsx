import React, { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Activity, BarChart2, Layers, TrendingUp, Zap, RefreshCw,
  ChevronDown, Wifi, WifiOff, Globe, Clock, Filter,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSubscription } from "@/lib/subscription-context";
import { useFootprintData } from "@/hooks/useFootprintData";
import { FootprintGrid, type ChartMode } from "@/components/footprint/FootprintGrid";
import { CVDChart } from "@/components/footprint/CVDChart";
import { AIOrderFlowPanel } from "@/components/footprint/AIOrderFlowPanel";
import { TraderDNAFootprintPanel } from "@/components/footprint/TraderDNAFootprintPanel";
import { MarketScanner } from "@/components/footprint/MarketScanner";
import { FootprintAlerts } from "@/components/footprint/FootprintAlerts";
import { SessionAnalytics } from "@/components/footprint/SessionAnalytics";
import { PremiumGate, PremiumBanner } from "@/components/premium-gate";
import { AuthModal } from "@/components/auth-modal";
import { CandleLoader } from "@/components/candle-loader";

const ASSET_GROUPS = [
  {
    label: "Crypto",
    items: [
      { symbol: "BTCUSDT",  label: "BTC/USDT",  exchange: "Binance" },
      { symbol: "ETHUSDT",  label: "ETH/USDT",  exchange: "Binance" },
      { symbol: "SOLUSDT",  label: "SOL/USDT",  exchange: "Binance" },
      { symbol: "BNBUSDT",  label: "BNB/USDT",  exchange: "Binance" },
      { symbol: "XRPUSDT",  label: "XRP/USDT",  exchange: "Binance" },
      { symbol: "LINKUSDT", label: "LINK/USDT", exchange: "Binance" },
      { symbol: "AVAXUSDT", label: "AVAX/USDT", exchange: "Binance" },
      { symbol: "ADAUSDT",  label: "ADA/USDT",  exchange: "Binance" },
      { symbol: "DOTUSDT",  label: "DOT/USDT",  exchange: "Binance" },
      { symbol: "LTCUSDT",  label: "LTC/USDT",  exchange: "Binance" },
    ],
  },
];

const TIMEFRAMES = [
  { value: "1m",  label: "1m",  proOnly: true },
  { value: "5m",  label: "5m",  proOnly: true },
  { value: "15m", label: "15m", proOnly: true },
  { value: "1h",  label: "1H",  proOnly: false },
  { value: "4h",  label: "4H",  proOnly: false },
  { value: "1d",  label: "1D",  proOnly: false },
];

const SESSIONS = [
  { value: "all",      label: "All Sessions" },
  { value: "london",   label: "London" },
  { value: "new_york", label: "New York" },
  { value: "tokyo",    label: "Tokyo" },
  { value: "sydney",   label: "Sydney" },
];

const CHART_MODES: { value: ChartMode; label: string; icon: React.ElementType; pro?: boolean; elite?: boolean }[] = [
  { value: "bidask",    label: "Bid×Ask",  icon: BarChart2,   pro: false },
  { value: "delta",     label: "Delta",    icon: TrendingUp,  pro: true  },
  { value: "volume",    label: "Volume",   icon: Layers,      pro: false },
  { value: "imbalance", label: "Imbalance",icon: Zap,         elite: true },
  { value: "cvd",       label: "CVD",      icon: Activity,    pro: true  },
];

function getSymbolLabel(symbol: string): string {
  for (const g of ASSET_GROUPS) {
    const item = g.items.find(i => i.symbol === symbol);
    if (item) return item.label;
  }
  return symbol;
}

function getExchange(symbol: string): string {
  for (const g of ASSET_GROUPS) {
    const item = g.items.find(i => i.symbol === symbol);
    if (item) return item.exchange;
  }
  return "Simulated";
}

function fmtPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

/* ── Asset Selector ────────────────────────────────────────────────── */
function AssetSelector({ symbol, onChange }: { symbol: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const label = getSymbolLabel(symbol);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px",
          borderRadius: "9px", border: "1px solid hsl(var(--border))",
          background: "var(--card-bg)", color: "hsl(var(--foreground))",
          fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
        }}>
        <Globe style={{ height: "11px", width: "11px", color: "hsl(var(--muted-foreground))" }} />
        {label}
        <ChevronDown style={{ height: "10px", width: "10px", color: "hsl(var(--muted-foreground))", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "var(--card-bg)", border: "1px solid hsl(var(--border))",
          borderRadius: "12px", padding: "6px", minWidth: "180px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
        }}>
          {ASSET_GROUPS.map(g => (
            <div key={g.label}>
              <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.1em", color: "hsl(var(--muted-foreground))", padding: "6px 10px 3px", textTransform: "uppercase" }}>{g.label}</div>
              {g.items.map(item => (
                <button
                  key={item.symbol}
                  onClick={() => { onChange(item.symbol); setOpen(false); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "6px 10px", borderRadius: "7px", border: "none",
                    background: item.symbol === symbol ? "hsl(var(--muted)/0.6)" : "transparent",
                    color: "hsl(var(--foreground))", fontSize: "12px", cursor: "pointer",
                    fontWeight: item.symbol === symbol ? 600 : 400,
                  }}>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function FootprintPage() {
  const { token } = useAuth();
  const { isPro, isElite } = useSubscription();
  const [location] = useLocation();
  const [showAuth, setShowAuth] = useState(false);

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("1h");
  const [session, setSession] = useState("all");
  const [chartMode, setChartMode] = useState<ChartMode>("bidask");
  const [selectedCandleIdx, setSelectedCandleIdx] = useState(49);
  const [activeTab, setActiveTab] = useState<string>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("tab") ?? "chart";
  });

  // Sync activeTab whenever the URL search changes (deep-link / back-forward)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const tab = p.get("tab");
    if (tab) setActiveTab(tab);
  }, [location]);

  const { candles, loading, error, isLive, hasLiveData, refresh } = useFootprintData(symbol, timeframe, session, 50);

  const selectedCandle = candles[selectedCandleIdx] ?? candles[candles.length - 1];

  const totalImbalances = useMemo(() => candles.slice(-5).reduce((a, c) => a + c.levels.filter(l => l.isImbalance).length, 0), [candles]);
  const totalAbsorption = useMemo(() => candles.slice(-5).reduce((a, c) => a + c.levels.filter(l => l.isBuyAbsorption || l.isSellAbsorption).length, 0), [candles]);
  const lastPrice = selectedCandle?.close ?? 0;
  const lastDelta = selectedCandle?.delta ?? 0;
  const lastCvd = candles[candles.length - 1]?.cvd ?? 0;

  const exchange = getExchange(symbol);

  if (!token) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", textAlign: "center" }}>
        <div style={{ background: "rgba(160,160,160,0.08)", border: "1px solid rgba(160,160,160,0.2)", borderRadius: "16px", padding: "32px 40px" }}>
          <Activity style={{ height: "36px", width: "36px", color: "#a0a0a0", margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: "8px" }}>Volume Footprint Terminal</h2>
          <p style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))", maxWidth: "320px", lineHeight: 1.6 }}>
            Professional order flow analysis for serious traders. Sign in to access footprint charts, CVD, and AI insights.
          </p>
          <button onClick={() => setShowAuth(true)} style={{ marginTop: "16px", padding: "10px 24px", borderRadius: "10px", background: "linear-gradient(135deg,#555,#333)", color: "#fff", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer" }}>
            Sign In to Continue
          </button>
        </div>
        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
      </div>
    );
  }

  // ── Free-plan gate: show full-page upgrade prompt ─────────────────
  if (!isPro && !isElite) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", textAlign: "center", padding: "32px 16px" }}>
        <div style={{
          background: "rgba(160,160,160,0.06)", border: "1px solid rgba(160,160,160,0.18)",
          borderRadius: "20px", padding: "40px 48px", maxWidth: "480px",
        }}>
          <div style={{ background: "rgba(160,160,160,0.1)", borderRadius: "14px", padding: "12px", width: "56px", height: "56px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "1px solid rgba(160,160,160,0.2)" }}>
            <Activity style={{ height: "28px", width: "28px", color: "#a0a0a0" }} />
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: "8px", letterSpacing: "-0.03em" }}>
            Volume Footprint Terminal
          </h2>
          <p style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))", lineHeight: 1.65, marginBottom: "20px" }}>
            Professional order flow analysis with Bid×Ask footprint charts, Delta, CVD, Imbalance detection, Absorption signals, and AI-powered insights.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-6" style={{ textAlign: "left" }}>
            {[
              "Bid×Ask footprint grid",
              "Delta & CVD analysis",
              "Imbalance detection",
              "Absorption signals",
              "HVN / LVN zones",
              "Session analytics",
              "AI order flow (Elite)",
              "Market scanner (Elite)",
            ].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>
                <span style={{ color: "#a0a0a0", fontWeight: 700 }}>✓</span> {f}
              </div>
            ))}
          </div>
          <button
            onClick={() => void (window.location.href = "/pricing")}
            style={{ width: "100%", padding: "12px", borderRadius: "12px", background: "linear-gradient(135deg,#555,#333)", color: "#fff", fontSize: "14px", fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(160,160,160,0.35)" }}>
            Upgrade to Pro — Unlock Footprint
          </button>
          <p style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginTop: "10px" }}>
            Starting from $29/month · Cancel anytime
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "chart",    label: "Footprint Charts" },
    { id: "scanner",  label: "Market Scanner",   elite: true },
    { id: "alerts",   label: "Smart Alerts",      elite: true },
    { id: "sessions", label: "Session Analytics" },
  ];

  return (
    <div style={{ paddingBottom: "80px" }}>
      {/* ── Data source banner ───────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 14px", borderRadius: "12px", marginBottom: "14px", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.25)" }}>
        <Wifi style={{ height: "13px", width: "13px", flexShrink: 0, marginTop: "1px", color: "#4ade80" }} />
        <p style={{ fontSize: "11px", color: "#86efac", margin: 0, lineHeight: 1.6 }}>
          <strong>Live data:</strong> Footprint charts stream real-time order flow from Binance via the <strong>aggTrade</strong> WebSocket. Each cell shows actual market buy/sell volume aggregated into price buckets — no simulation or synthetic data.
        </p>
      </div>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "16px" }}>
        <div className="flex items-center gap-2 mb-1">
          <div style={{ background: "rgba(160,160,160,0.1)", borderRadius: "9px", padding: "6px", border: "1px solid rgba(160,160,160,0.2)" }}>
            <Activity style={{ height: "15px", width: "15px", color: "#a0a0a0" }} />
          </div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "hsl(var(--foreground))", letterSpacing: "-0.03em", margin: 0 }}>
            Volume Footprint Terminal
          </h1>
          <span style={{ fontSize: "9px", padding: "2px 7px", borderRadius: "4px", background: "rgba(160,160,160,0.1)", color: "#a0a0a0", fontWeight: 700, letterSpacing: "0.08em" }}>BETA</span>
        </div>
        <p style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", margin: 0 }}>
          Professional order flow · Bid×Ask footprint · Delta · CVD · Liquidity zones
        </p>
      </div>

      {/* ── Controls bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <AssetSelector symbol={symbol} onChange={(s) => { setSymbol(s); setSelectedCandleIdx(49); }} />

        <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px", borderRadius: "9px", background: "hsl(var(--muted)/0.4)", border: "1px solid hsl(var(--border))" }}>
          {TIMEFRAMES.map(tf => {
            const locked = tf.proOnly && !isPro && !isElite;
            return (
              <button
                key={tf.value}
                onClick={() => !locked && setTimeframe(tf.value)}
                title={locked ? "Pro+ required" : undefined}
                style={{
                  padding: "4px 9px", borderRadius: "6px", border: "none", cursor: locked ? "not-allowed" : "pointer",
                  fontSize: "11px", fontWeight: 600,
                  background: timeframe === tf.value ? "var(--card-bg)" : "transparent",
                  color: timeframe === tf.value ? "hsl(var(--foreground))" : locked ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground))",
                  opacity: locked ? 0.4 : 1,
                  boxShadow: timeframe === tf.value ? "var(--shadow-tab-active)" : "none",
                }}>
                {tf.label}
              </button>
            );
          })}
        </div>

        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 10px", borderRadius: "9px", border: "1px solid hsl(var(--border))", background: "var(--card-bg)", fontSize: "11px", cursor: "pointer" }}>
            <Filter style={{ height: "10px", width: "10px", color: "hsl(var(--muted-foreground))" }} />
            <select
              value={session}
              onChange={e => setSession(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: "11px", fontWeight: 500, color: "hsl(var(--foreground))", cursor: "pointer", outline: "none" }}>
              {SESSIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: isLive ? "#22c55e" : "hsl(var(--muted-foreground))", fontWeight: 600 }}>
            {isLive ? <Wifi style={{ height: "10px", width: "10px" }} /> : <WifiOff style={{ height: "10px", width: "10px" }} />}
            {isLive ? "LIVE" : "OFFLINE"}
          </span>
          <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", gap: "3px" }}>
            <Clock style={{ height: "10px", width: "10px" }} />
            {exchange}
          </span>
          <button onClick={refresh} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px 10px", borderRadius: "7px", border: "1px solid hsl(var(--border))", background: "var(--card-bg)", color: "hsl(var(--muted-foreground))", fontSize: "11px", fontWeight: 500, cursor: "pointer" }}>
            <RefreshCw style={{ height: "11px", width: "11px" }} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px", overflowX: "auto", paddingBottom: "2px" }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "7px 14px", borderRadius: "9px", border: "none", cursor: "pointer",
              fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap",
              background: activeTab === tab.id ? "rgba(160,160,160,0.12)" : "transparent",
              color: activeTab === tab.id ? "#a0a0a0" : "hsl(var(--muted-foreground))",
              boxShadow: activeTab === tab.id ? "0 0 0 1px rgba(160,160,160,0.3)" : "none",
              transition: "all 0.15s",
            }}>
            {tab.label}
            {tab.elite && <span style={{ fontSize: "8px", marginLeft: "5px", padding: "1px 4px", borderRadius: "3px", background: "rgba(160,160,160,0.15)", color: "#a0a0a0", fontWeight: 700 }}>ELITE</span>}
          </button>
        ))}
      </div>

      {/* ── Chart Tab ────────────────────────────────────────────────── */}
      {activeTab === "chart" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            {/* Stats bar */}
            {!loading && candles.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                {[
                  { label: "Price", value: fmtPrice(lastPrice), color: "hsl(var(--foreground))" },
                  { label: "Delta", value: `${lastDelta >= 0 ? "+" : ""}${fmtNum(lastDelta)}`, color: lastDelta >= 0 ? "#22c55e" : "#ef4444" },
                  { label: "CVD", value: `${lastCvd >= 0 ? "+" : ""}${fmtNum(lastCvd)}`, color: lastCvd >= 0 ? "#22c55e" : "#ef4444" },
                  { label: "Imbalances", value: String(totalImbalances), color: totalImbalances > 5 ? "#f59e0b" : "hsl(var(--foreground))" },
                ].map(stat => (
                  <div key={stat.label} style={{ background: "var(--card-bg)", borderRadius: "10px", padding: "10px 12px", border: "1px solid hsl(var(--border))", textAlign: "center" }}>
                    <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.08em", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: "4px" }}>{stat.label}</div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: stat.color, fontFamily: "var(--app-font-mono)" }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Mode selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "2px", padding: "3px", borderRadius: "10px", background: "hsl(var(--muted)/0.4)", border: "1px solid hsl(var(--border))", marginBottom: "0", borderBottom: "none", borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
              {CHART_MODES.map(m => {
                const locked = (m.elite && !isElite) || (m.pro && !isPro && !isElite);
                const active = chartMode === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => !locked && setChartMode(m.value)}
                    title={locked ? (m.elite ? "Elite required" : "Pro+ required") : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: "5px", padding: "6px 10px",
                      borderRadius: "7px", border: "none", cursor: locked ? "not-allowed" : "pointer",
                      fontSize: "11px", fontWeight: 600,
                      background: active ? "var(--card-bg)" : "transparent",
                      color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                      opacity: locked ? 0.45 : 1,
                      boxShadow: active ? "var(--shadow-tab-active)" : "none",
                      flex: 1, justifyContent: "center",
                    }}>
                    <m.icon style={{ height: "11px", width: "11px" }} />
                    <span>{m.label}</span>
                    {m.elite && !isElite && <span style={{ fontSize: "7px", padding: "1px 3px", borderRadius: "3px", background: "rgba(160,160,160,0.12)", color: "#a0a0a0" }}>E</span>}
                    {m.pro && !isPro && !isElite && <span style={{ fontSize: "7px", padding: "1px 3px", borderRadius: "3px", background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>P</span>}
                  </button>
                );
              })}
            </div>

            {/* Footprint grid */}
            <div style={{ border: "1px solid hsl(var(--border))", borderTop: "none", borderRadius: "0 0 12px 12px" }}>
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "240px" }}>
                  <CandleLoader size="md" />
                </div>
              ) : error ? (
                <div style={{ padding: "32px", textAlign: "center", color: "#ef4444", fontSize: "13px" }}>{error}</div>
              ) : (chartMode === "imbalance" || chartMode === "delta" || chartMode === "cvd") && !isPro && !isElite ? (
                <div style={{ padding: "24px" }}>
                  <PremiumBanner requiredPlan={chartMode === "imbalance" ? "elite" : "pro"} />
                </div>
              ) : (
                <FootprintGrid
                  candles={candles}
                  mode={chartMode}
                  selectedCandleIdx={selectedCandleIdx}
                  onSelectCandle={setSelectedCandleIdx}
                  isElite={isElite}
                />
              )}
            </div>

            {/* CVD sub-chart */}
            {candles.length > 0 && !loading && (
              (isPro || isElite) ? (
                <CVDChart candles={candles} height={130} />
              ) : (
                <div style={{ background: "var(--card-bg)", borderTop: "1px solid hsl(var(--border))", padding: "12px 16px" }}>
                  <p style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", margin: 0 }}>
                    Upgrade to <strong>Pro</strong> to unlock the CVD sub-chart.
                  </p>
                </div>
              )
            )}
          </div>

          {/* ── Right sidebar ────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: "1 1 280px", maxWidth: "320px" }}>
            {/* Selected candle detail */}
            {selectedCandle && (
              <div style={{ background: "var(--card-bg)", border: "1px solid hsl(var(--border))", borderRadius: "12px", padding: "14px" }}>
                <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", marginBottom: "10px" }}>Selected Candle</p>
                <div className="grid grid-cols-2 gap-y-2">
                  {[
                    ["Open",    fmtPrice(selectedCandle.open)],
                    ["Close",   fmtPrice(selectedCandle.close)],
                    ["High",    fmtPrice(selectedCandle.high)],
                    ["Low",     fmtPrice(selectedCandle.low)],
                    ["Volume",  fmtNum(selectedCandle.volume)],
                    ["Delta",   `${selectedCandle.delta >= 0 ? "+" : ""}${fmtNum(selectedCandle.delta)}`],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: "9px", color: "hsl(var(--muted-foreground))", marginBottom: "1px" }}>{label}</div>
                      <div style={{ fontSize: "12px", fontWeight: 600, fontFamily: "var(--app-font-mono)", color: label === "Delta" ? (selectedCandle.delta >= 0 ? "#22c55e" : "#ef4444") : "hsl(var(--foreground))" }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  {selectedCandle.isExhaustion && <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 700 }}>EXHAUSTION</span>}
                  {selectedCandle.isDivergence && <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", background: "rgba(160,160,160,0.1)", color: "#a0a0a0", fontWeight: 700 }}>DIVERGENCE</span>}
                </div>
              </div>
            )}

            {/* Absorption alerts in sidebar */}
            {totalAbsorption > 0 && (
              <div style={{ background: "rgba(160,160,160,0.06)", border: "1px solid rgba(160,160,160,0.2)", borderRadius: "10px", padding: "10px 12px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, color: "#a0a0a0", marginBottom: "4px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Absorption Detected</p>
                <p style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", margin: 0 }}>
                  {totalAbsorption} absorption signal{totalAbsorption > 1 ? "s" : ""} in last 5 candles
                </p>
              </div>
            )}

            {/* AI Panel — Elite */}
            <AIOrderFlowPanel candles={candles} symbol={symbol} timeframe={timeframe} />

            {/* Trader DNA Panel — Elite */}
            <TraderDNAFootprintPanel symbol={symbol} />
          </div>
        </div>
      )}

      {/* ── Scanner Tab ──────────────────────────────────────────────── */}
      {activeTab === "scanner" && (
        <MarketScanner onSelectSymbol={(s) => { setSymbol(s); setActiveTab("chart"); }} />
      )}

      {/* ── Alerts Tab ───────────────────────────────────────────────── */}
      {activeTab === "alerts" && (
        <div style={{ background: "var(--card-bg)", border: "1px solid hsl(var(--border))", borderRadius: "14px", padding: "20px" }}>
          <FootprintAlerts candles={candles} symbol={symbol} />
        </div>
      )}

      {/* ── Session Analytics Tab ────────────────────────────────────── */}
      {activeTab === "sessions" && (
        <div style={{ background: "var(--card-bg)", border: "1px solid hsl(var(--border))", borderRadius: "14px", padding: "20px" }}>
          <SessionAnalytics symbol={symbol} />
        </div>
      )}
    </div>
  );
}
