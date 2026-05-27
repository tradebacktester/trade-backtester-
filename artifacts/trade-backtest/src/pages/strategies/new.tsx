import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Save, CheckCircle, Sparkles } from "lucide-react";

const STRATEGY_TYPES = [
  { value: "sma_crossover",   label: "SMA Crossover",          desc: "Fast/slow SMA crossover signals" },
  { value: "ema_crossover",   label: "EMA Crossover",          desc: "Fast/slow EMA crossover signals" },
  { value: "rsi",             label: "RSI Mean Reversion",     desc: "Oversold/overbought RSI entries" },
  { value: "macd",            label: "MACD Trend",             desc: "MACD histogram trend following" },
  { value: "bollinger_bands", label: "Bollinger Bands",        desc: "Breakout on band expansion" },
  { value: "ict_ob",          label: "ICT Order Block",        desc: "Institutional order block entries" },
];

const SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "SPX500", "EUR/USD", "GBP/USD"];

const TIMEFRAMES = [
  { value: "1m", label: "1 Minute" },
  { value: "5m", label: "5 Minutes" },
  { value: "15m", label: "15 Minutes" },
  { value: "1h", label: "1 Hour" },
  { value: "4h", label: "4 Hours" },
  { value: "1d", label: "Daily" },
  { value: "1w", label: "Weekly" },
];

const DEFAULT_PARAMS: Record<string, Record<string, number>> = {
  sma_crossover:   { fastPeriod: 10, slowPeriod: 50 },
  ema_crossover:   { fastPeriod: 9,  slowPeriod: 21 },
  rsi:             { period: 14, oversold: 30, overbought: 70 },
  macd:            { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  bollinger_bands: { period: 20, stdDev: 2 },
  ict_ob:          { lookback: 20, minSize: 3, confirmCandles: 2 },
};

const LS_KEY = "tt_local_strategies";

export interface LocalStrategy {
  id: string;
  name: string;
  description: string;
  type: string;
  symbol: string;
  timeframe: string;
  parameters: Record<string, number>;
  createdAt: string;
  local: true;
}

export function loadLocalStrategies(): LocalStrategy[] {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}

function saveLocalStrategy(s: LocalStrategy) {
  try {
    const existing = loadLocalStrategies();
    localStorage.setItem(LS_KEY, JSON.stringify([s, ...existing]));
  } catch {}
}

export default function NewStrategy() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("ema_crossover");
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [timeframe, setTimeframe] = useState("1h");
  const [params, setParams] = useState<Record<string, number>>(DEFAULT_PARAMS.ema_crossover);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleTypeChange(newType: string) {
    setType(newType);
    setParams(DEFAULT_PARAMS[newType] ?? {});
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Strategy name is required";
    if (!symbol) e.symbol = "Please select a symbol";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setTimeout(() => {
      const strategy: LocalStrategy = {
        id: `local_${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        type,
        symbol,
        timeframe,
        parameters: params,
        createdAt: new Date().toISOString(),
        local: true,
      };
      saveLocalStrategy(strategy);
      setSaving(false);
      setSaved(true);
      setTimeout(() => setLocation("/strategies"), 1000);
    }, 600);
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    color: "hsl(220,14%,82%)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "13px",
    width: "100%",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.2s",
  };

  const labelStyle = {
    fontSize: "11px",
    fontWeight: 600,
    fontFamily: "monospace",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "hsl(220,14%,45%)",
    marginBottom: "6px",
    display: "block",
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <div className="h-16 w-16 rounded-full flex items-center justify-center"
          style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)" }}>
          <CheckCircle className="h-8 w-8" style={{ color: "hsl(150,90%,58%)" }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "hsl(220,14%,90%)" }}>Strategy Created!</h2>
        <p className="text-sm font-mono" style={{ color: "hsl(220,14%,45%)" }}>Redirecting to Analytics…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto pb-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/strategies">
          <span className="h-9 w-9 flex items-center justify-center rounded-xl cursor-pointer transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "hsl(220,14%,55%)" }}>
            <ArrowLeft className="h-4 w-4" />
          </span>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "hsl(220,14%,92%)" }}>New Strategy</h1>
          <p className="text-xs font-mono" style={{ color: "hsl(220,14%,42%)" }}>Configure a systematic trading strategy</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Name */}
        <div className="rounded-2xl border p-4 flex flex-col gap-4"
          style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.07)" }}>
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,38%)" }}>Basic Info</p>

          <div>
            <label style={labelStyle}>Strategy Name *</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setErrors(v => ({ ...v, name: "" })); }}
              placeholder="e.g. BTC EMA Crossover 4H"
              style={{ ...inputStyle, borderColor: errors.name ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.09)" }}
            />
            {errors.name && <p className="text-[11px] font-mono mt-1.5" style={{ color: "hsl(0,85%,62%)" }}>{errors.name}</p>}
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the rationale behind this strategy…"
              rows={3}
              style={{ ...inputStyle, resize: "none" }}
            />
          </div>
        </div>

        {/* Strategy type */}
        <div className="rounded-2xl border p-4 flex flex-col gap-3"
          style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.07)" }}>
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,38%)" }}>Strategy Type</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STRATEGY_TYPES.map(st => (
              <button
                key={st.value}
                type="button"
                onClick={() => handleTypeChange(st.value)}
                className="flex flex-col gap-0.5 p-3 rounded-xl border text-left transition-all"
                style={type === st.value ? {
                  background: "rgba(0,229,255,0.08)",
                  borderColor: "rgba(0,229,255,0.3)",
                  boxShadow: "0 0 16px rgba(0,229,255,0.06)",
                } : {
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "rgba(255,255,255,0.07)",
                }}
              >
                <span className="text-xs font-semibold font-mono"
                  style={{ color: type === st.value ? "hsl(190,90%,65%)" : "hsl(220,14%,72%)" }}>
                  {st.label}
                </span>
                <span className="text-[10px] font-mono" style={{ color: "hsl(220,14%,40%)" }}>{st.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Symbol + Timeframe */}
        <div className="rounded-2xl border p-4 flex flex-col gap-4"
          style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.07)" }}>
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,38%)" }}>Market Settings</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Symbol *</label>
              <select
                value={symbol}
                onChange={e => { setSymbol(e.target.value); setErrors(v => ({ ...v, symbol: "" })); }}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.symbol && <p className="text-[11px] font-mono mt-1.5" style={{ color: "hsl(0,85%,62%)" }}>{errors.symbol}</p>}
            </div>
            <div>
              <label style={labelStyle}>Timeframe</label>
              <select value={timeframe} onChange={e => setTimeframe(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                {TIMEFRAMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Parameters */}
        {Object.keys(params).length > 0 && (
          <div className="rounded-2xl border p-4 flex flex-col gap-4"
            style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.07)" }}>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,38%)" }}>
              Strategy Parameters
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(params).map(([key, value]) => (
                <div key={key}>
                  <label style={labelStyle}>
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </label>
                  <input
                    type="number"
                    value={value}
                    onChange={e => setParams(p => ({ ...p, [key]: Number(e.target.value) }))}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
          style={{
            background: saving
              ? "rgba(0,229,255,0.1)"
              : "linear-gradient(135deg, hsl(190,90%,40%), hsl(210,80%,50%))",
            color: "#fff",
            border: "1px solid rgba(0,229,255,0.2)",
            boxShadow: saving ? "none" : "0 8px 32px rgba(0,229,255,0.25)",
          }}
        >
          {saving ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Create Strategy
            </>
          )}
        </button>

        <p className="text-center text-[11px] font-mono" style={{ color: "hsl(220,14%,35%)" }}>
          Strategies are saved locally on this device
        </p>
      </form>
    </div>
  );
}
