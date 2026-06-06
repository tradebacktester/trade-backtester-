import React, { useState, useMemo } from "react";
import { Calculator, TrendingUp, TrendingDown, DollarSign, BarChart2, RefreshCw, ChevronRight } from "lucide-react";

const C = {
  text:    "hsl(var(--foreground))",
  muted:   "hsl(var(--muted-foreground))",
  card:    "var(--card-bg)",
  glass:   "var(--glass-bg)",
  border:  "var(--glass-border)",
  positive:"hsl(150,90%,58%)",
  negative:"hsl(0,85%,62%)",
  amber:   "hsl(38,95%,65%)",
};

type Tab = "position" | "pnl" | "rr" | "compound";

function fmt(n: number, decimals = 2) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtDollar(n: number) {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "+";
  return `${n >= 0 ? "+" : "-"}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/* ── Re-usable input ── */
function Field({
  label, value, onChange, prefix, suffix, step = "any", min, placeholder = "0",
}: {
  label: string; value: string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; step?: string; min?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-mono uppercase tracking-widest mb-1.5" style={{ color: C.muted }}>{label}</label>
      <div className="flex items-center rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}`, background: C.glass }}>
        {prefix && (
          <span className="px-3 py-2.5 text-sm font-mono font-bold border-r" style={{ color: C.muted, borderColor: C.border }}>{prefix}</span>
        )}
        <input
          type="number"
          step={step}
          min={min}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          className="flex-1 px-3 py-2.5 text-sm font-mono bg-transparent outline-none"
          style={{ color: C.text }}
        />
        {suffix && (
          <span className="px-3 py-2.5 text-sm font-mono border-l" style={{ color: C.muted, borderColor: C.border }}>{suffix}</span>
        )}
      </div>
    </div>
  );
}

/* ── Result card ── */
function ResultRow({ label, value, color, large }: { label: string; value: string; color?: string; large?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <span className="text-[11px] font-mono" style={{ color: C.muted }}>{label}</span>
      <span className={`font-mono font-bold ${large ? "text-base" : "text-sm"}`} style={{ color: color ?? C.text }}>{value}</span>
    </div>
  );
}

/* ── Tabs ── */
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "position", label: "Position Size", icon: DollarSign },
  { id: "pnl",      label: "P&L",          icon: TrendingUp },
  { id: "rr",       label: "Risk / Reward", icon: BarChart2 },
  { id: "compound", label: "Compound",      icon: RefreshCw },
];

/* ── Position Size Calculator ── */
function PositionCalc() {
  const [account, setAccount]   = useState("10000");
  const [riskPct, setRiskPct]   = useState("1");
  const [entry,   setEntry]     = useState("");
  const [stop,    setStop]      = useState("");
  const [contract, setContract] = useState("1"); // contract/lot size

  const result = useMemo(() => {
    const acc  = parseFloat(account);
    const rp   = parseFloat(riskPct);
    const ent  = parseFloat(entry);
    const stp  = parseFloat(stop);
    const lot  = parseFloat(contract) || 1;
    if (!acc || !rp || !ent || !stp || ent === stp) return null;
    const riskDollar  = acc * (rp / 100);
    const stopDist    = Math.abs(ent - stp);
    const stopPct     = (stopDist / ent) * 100;
    const units       = riskDollar / stopDist;
    const lots        = units / lot;
    const posValue    = units * ent;
    return { riskDollar, stopDist, stopPct, units, lots, posValue };
  }, [account, riskPct, entry, stop, contract]);

  const reset = () => { setAccount("10000"); setRiskPct("1"); setEntry(""); setStop(""); setContract("1"); };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account Size" prefix="$" value={account} onChange={setAccount} />
        <Field label="Risk %" suffix="%" value={riskPct} onChange={setRiskPct} step="0.1" min="0" />
        <Field label="Entry Price" prefix="$" value={entry} onChange={setEntry} />
        <Field label="Stop Loss"   prefix="$" value={stop}  onChange={setStop} />
        <Field label="Contract / Lot Size" value={contract} onChange={setContract} suffix="units" />
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <div className="px-4 py-2.5 text-[9px] font-mono uppercase tracking-widest" style={{ background: C.glass, borderBottom: `1px solid ${C.border}`, color: C.muted }}>
          Result
        </div>
        <div className="px-4">
          {result ? (
            <>
              <ResultRow label="Dollar Risk"    value={`$${fmt(result.riskDollar)}`} color={C.negative} large />
              <ResultRow label="Stop Distance"  value={`$${fmt(result.stopDist)} (${fmt(result.stopPct, 2)}%)`} />
              <ResultRow label="Position Size (units)" value={fmt(result.units, 0)} color={C.positive} large />
              <ResultRow label="Position Size (lots)"  value={fmt(result.lots, 2)} color={C.positive} />
              <ResultRow label="Position Value" value={`$${fmt(result.posValue)}`} />
            </>
          ) : (
            <div className="py-6 text-center text-[11px] font-mono" style={{ color: C.muted }}>
              Enter account, risk %, entry and stop loss
            </div>
          )}
        </div>
      </div>
      <button onClick={reset} className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: C.muted }}>
        <RefreshCw className="h-3 w-3" /> Reset
      </button>
    </div>
  );
}

/* ── P&L Calculator ── */
function PnlCalc() {
  const [entry,    setEntry]    = useState("");
  const [exit,     setExit]     = useState("");
  const [size,     setSize]     = useState("");
  const [capital,  setCapital]  = useState("10000");
  const [direction, setDir]     = useState<"long" | "short">("long");
  const [leverage, setLeverage] = useState("1");

  const result = useMemo(() => {
    const ent = parseFloat(entry);
    const ext = parseFloat(exit);
    const sz  = parseFloat(size);
    const cap = parseFloat(capital) || 10000;
    const lev = parseFloat(leverage) || 1;
    if (!ent || !ext || !sz) return null;
    const priceDiff = direction === "long" ? ext - ent : ent - ext;
    const pnl       = priceDiff * sz;
    const pnlPct    = (priceDiff / ent) * 100 * lev;
    const capitalUsed = (sz * ent) / lev;
    const roi       = (pnl / capitalUsed) * 100;
    return { pnl, pnlPct, capitalUsed, roi };
  }, [entry, exit, size, direction, capital, leverage]);

  const reset = () => { setEntry(""); setExit(""); setSize(""); setCapital("10000"); setLeverage("1"); };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: C.glass, border: `1px solid ${C.border}` }}>
        {(["long", "short"] as const).map(d => (
          <button key={d} onClick={() => setDir(d)}
            className="flex-1 py-2 rounded-lg text-[12px] font-mono font-bold transition-all capitalize"
            style={direction === d
              ? { background: d === "long" ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.12)", color: d === "long" ? C.positive : C.negative, border: `1px solid ${d === "long" ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.25)"}` }
              : { color: C.muted, border: "1px solid transparent" }}>
            {d === "long" ? "▲ Long" : "▼ Short"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Entry Price"  prefix="$" value={entry}   onChange={setEntry} />
        <Field label="Exit Price"   prefix="$" value={exit}    onChange={setExit} />
        <Field label="Position Size (units)"   value={size}    onChange={setSize} suffix="units" />
        <Field label="Account Capital" prefix="$" value={capital} onChange={setCapital} />
        <Field label="Leverage"     value={leverage} onChange={setLeverage} suffix="x" step="1" min="1" />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <div className="px-4 py-2.5 text-[9px] font-mono uppercase tracking-widest" style={{ background: C.glass, borderBottom: `1px solid ${C.border}`, color: C.muted }}>
          Result
        </div>
        <div className="px-4">
          {result ? (
            <>
              <ResultRow label="Gross P&L"     value={fmtDollar(result.pnl)} color={result.pnl >= 0 ? C.positive : C.negative} large />
              <ResultRow label="P&L %"         value={`${result.pnlPct >= 0 ? "+" : ""}${fmt(result.pnlPct)}%`} color={result.pnl >= 0 ? C.positive : C.negative} />
              <ResultRow label="Capital Used"  value={`$${fmt(result.capitalUsed)}`} />
              <ResultRow label="ROI on Capital" value={`${result.roi >= 0 ? "+" : ""}${fmt(result.roi)}%`} color={result.roi >= 0 ? C.positive : C.negative} />
            </>
          ) : (
            <div className="py-6 text-center text-[11px] font-mono" style={{ color: C.muted }}>
              Enter entry, exit and position size
            </div>
          )}
        </div>
      </div>
      <button onClick={reset} className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: C.muted }}>
        <RefreshCw className="h-3 w-3" /> Reset
      </button>
    </div>
  );
}

/* ── Risk/Reward Calculator ── */
function RRCalc() {
  const [entry,  setEntry]  = useState("");
  const [stop,   setStop]   = useState("");
  const [target, setTarget] = useState("");
  const [winRate, setWinRate] = useState("50");

  const result = useMemo(() => {
    const ent = parseFloat(entry);
    const stp = parseFloat(stop);
    const tgt = parseFloat(target);
    const wr  = parseFloat(winRate) / 100;
    if (!ent || !stp || !tgt || ent === stp) return null;
    const reward = Math.abs(tgt - ent);
    const risk   = Math.abs(ent - stp);
    const rr     = reward / risk;
    const rewardPct = (reward / ent) * 100;
    const riskPct   = (risk   / ent) * 100;
    const breakEven = 1 / (1 + rr);
    const expectancy = (wr * reward) - ((1 - wr) * risk);
    const direction  = tgt > ent ? "Long" : "Short";
    return { rr, rewardPct, riskPct, breakEven, expectancy, direction };
  }, [entry, stop, target, winRate]);

  const rrColor = result ? (result.rr >= 2 ? C.positive : result.rr >= 1 ? C.amber : C.negative) : C.text;
  const reset = () => { setEntry(""); setStop(""); setTarget(""); setWinRate("50"); };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Entry Price" prefix="$" value={entry}  onChange={setEntry} />
        <Field label="Stop Loss"   prefix="$" value={stop}   onChange={setStop} />
        <Field label="Take Profit" prefix="$" value={target} onChange={setTarget} />
        <Field label="Win Rate"    suffix="%" value={winRate} onChange={setWinRate} step="1" min="0" />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <div className="px-4 py-2.5 text-[9px] font-mono uppercase tracking-widest" style={{ background: C.glass, borderBottom: `1px solid ${C.border}`, color: C.muted }}>
          Result
        </div>
        <div className="px-4">
          {result ? (
            <>
              <ResultRow label="Direction"        value={result.direction} />
              <ResultRow label="Risk / Reward"    value={`1 : ${fmt(result.rr)}`} color={rrColor} large />
              <ResultRow label="Reward %"         value={`+${fmt(result.rewardPct)}%`} color={C.positive} />
              <ResultRow label="Risk %"           value={`-${fmt(result.riskPct)}%`}  color={C.negative} />
              <ResultRow label="Break-even Win %"  value={`${fmt(result.breakEven * 100)}%`} />
              <ResultRow label="Expected Value (per unit)" value={result.expectancy >= 0 ? `+${fmt(result.expectancy)}` : fmt(result.expectancy)} color={result.expectancy >= 0 ? C.positive : C.negative} />
            </>
          ) : (
            <div className="py-6 text-center text-[11px] font-mono" style={{ color: C.muted }}>
              Enter entry, stop loss and take profit
            </div>
          )}
        </div>
      </div>
      <button onClick={reset} className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: C.muted }}>
        <RefreshCw className="h-3 w-3" /> Reset
      </button>
    </div>
  );
}

/* ── Compound Returns Calculator ── */
function CompoundCalc() {
  const [capital,  setCapital]  = useState("10000");
  const [monthly,  setMonthly]  = useState("5");
  const [months,   setMonths]   = useState("12");
  const [withdraw, setWithdraw] = useState("0");

  const rows = useMemo(() => {
    const cap = parseFloat(capital);
    const rate = parseFloat(monthly) / 100;
    const n    = Math.min(Math.max(parseInt(months) || 12, 1), 120);
    const wd   = parseFloat(withdraw) || 0;
    if (!cap || !rate) return [];
    const result = [];
    let bal = cap;
    for (let i = 1; i <= n; i++) {
      const gain = bal * rate;
      const end  = bal + gain - wd;
      result.push({ month: i, gain, end: Math.max(end, 0) });
      bal = Math.max(end, 0);
    }
    return result;
  }, [capital, monthly, months, withdraw]);

  const final = rows[rows.length - 1]?.end ?? 0;
  const totalGain = final - parseFloat(capital || "0");
  const totalReturn = parseFloat(capital) > 0 ? (totalGain / parseFloat(capital)) * 100 : 0;
  const reset = () => { setCapital("10000"); setMonthly("5"); setMonths("12"); setWithdraw("0"); };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starting Capital" prefix="$" value={capital}  onChange={setCapital} />
        <Field label="Monthly Return"   suffix="%" value={monthly}  onChange={setMonthly} step="0.5" />
        <Field label="Months"           value={months}   onChange={setMonths} step="1" min="1" suffix="mo" />
        <Field label="Monthly Withdrawal" prefix="$" value={withdraw} onChange={setWithdraw} />
      </div>

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Final Value",    value: `$${fmt(final)}`,          color: C.positive },
              { label: "Total Gain",     value: fmtDollar(totalGain),      color: totalGain >= 0 ? C.positive : C.negative },
              { label: "Total Return",   value: `${totalReturn >= 0 ? "+" : ""}${fmt(totalReturn)}%`, color: totalGain >= 0 ? C.positive : C.negative },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl p-3 text-center" style={{ background: C.glass, border: `1px solid ${C.border}` }}>
                <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: C.muted }}>{stat.label}</p>
                <p className="text-sm font-mono font-bold" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
            <div className="px-4 py-2.5 text-[9px] font-mono uppercase tracking-widest flex items-center justify-between" style={{ background: C.glass, borderBottom: `1px solid ${C.border}`, color: C.muted }}>
              <span>Month-by-Month</span>
              <span>{rows.length} periods</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "200px" }}>
              {rows.map(r => (
                <div key={r.month} className="flex items-center justify-between px-4 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <span className="text-[10px] font-mono" style={{ color: C.muted }}>Month {r.month}</span>
                  <span className="text-[10px] font-mono" style={{ color: C.positive }}>+${fmt(r.gain)}</span>
                  <span className="text-[11px] font-mono font-bold" style={{ color: C.text }}>${fmt(r.end)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <button onClick={reset} className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: C.muted }}>
        <RefreshCw className="h-3 w-3" /> Reset
      </button>
    </div>
  );
}

/* ── Main Page ── */
export default function CalculatorPage() {
  const [tab, setTab] = useState<Tab>("position");

  return (
    <div className="flex flex-col gap-5 pb-6 page-enter max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: C.text, letterSpacing: "-0.032em" }}>Trading Calculator</h1>
        <p className="text-[11px] mt-1 font-mono" style={{ color: C.muted }}>
          Position sizing · P&L · Risk/Reward · Compounding
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-2xl overflow-x-auto" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-medium whitespace-nowrap transition-all flex-1 justify-center"
            style={tab === t.id
              ? { background: "var(--nav-active-bg)", color: "var(--nav-active-color)", border: "1px solid var(--nav-active-border)" }
              : { color: C.muted, border: "1px solid transparent" }}
          >
            <t.icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Calculator panel */}
      <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-5">
          {(() => {
            const t = TABS.find(t => t.id === tab)!;
            return (
              <>
                <span className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: C.glass, border: `1px solid ${C.border}` }}>
                  <t.icon className="h-4 w-4" style={{ color: C.muted }} />
                </span>
                <div>
                  <p className="text-[14px] font-bold" style={{ color: C.text }}>{t.label}</p>
                  <p className="text-[10px] font-mono" style={{ color: C.muted }}>
                    {tab === "position" ? "How many units to trade given your risk tolerance" :
                     tab === "pnl"      ? "Estimate profit or loss for a trade" :
                     tab === "rr"       ? "Evaluate a trade's risk-to-reward ratio" :
                                          "Project capital growth with monthly compounding"}
                  </p>
                </div>
              </>
            );
          })()}
        </div>

        {tab === "position" && <PositionCalc />}
        {tab === "pnl"      && <PnlCalc />}
        {tab === "rr"       && <RRCalc />}
        {tab === "compound" && <CompoundCalc />}
      </div>
    </div>
  );
}
