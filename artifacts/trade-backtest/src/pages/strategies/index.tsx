import React, { useState } from "react";
import { Link } from "wouter";
import { useListStrategies } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Plus, ArrowRight, TrendingUp, BarChart2,
  Zap, Activity, Target, Layers,
} from "lucide-react";

const SAMPLE_STRATEGIES = [
  {
    id: "sample-ema",
    name: "EMA Crossover",
    description: "Buy when the 20 EMA crosses above the 50 EMA; sell when it crosses back below. A classic trend-following system suited to strong trending markets.",
    type: "trend",
    timeframe: "1H",
    symbol: "BTC/USDT",
    winRate: 61,
    sharpe: 1.82,
    sample: true,
    icon: TrendingUp,
    color: "hsl(150,80%,50%)",
    colorBg: "rgba(52,211,153,0.1)",
    colorBorder: "rgba(52,211,153,0.2)",
  },
  {
    id: "sample-rsi",
    name: "RSI Reversal",
    description: "Enter long when RSI(14) dips below 30 (oversold) and exit when it reclaims 70. Works best in ranging, mean-reverting markets.",
    type: "reversal",
    timeframe: "4H",
    symbol: "ETH/USDT",
    winRate: 55,
    sharpe: 1.41,
    sample: true,
    icon: Activity,
    color: "hsl(260,80%,65%)",
    colorBg: "rgba(139,92,246,0.1)",
    colorBorder: "rgba(139,92,246,0.2)",
  },
  {
    id: "sample-vol",
    name: "Volume Breakout",
    description: "Enter on a close above the 20-period high accompanied by volume ≥ 2× the 20-period average. Captures high-conviction momentum moves.",
    type: "breakout",
    timeframe: "1D",
    symbol: "BTC/USDT",
    winRate: 48,
    sharpe: 1.65,
    sample: true,
    icon: Zap,
    color: "hsl(38,100%,55%)",
    colorBg: "rgba(245,158,11,0.1)",
    colorBorder: "rgba(245,158,11,0.2)",
  },
  {
    id: "sample-sr",
    name: "S/R Breakout",
    description: "Identify 20-period swing highs/lows as support and resistance. Enter on confirmed breakout candle with at least 1% follow-through.",
    type: "breakout",
    timeframe: "1H",
    symbol: "SOL/USDT",
    winRate: 52,
    sharpe: 1.58,
    sample: true,
    icon: Target,
    color: "hsl(190,90%,55%)",
    colorBg: "rgba(0,229,255,0.1)",
    colorBorder: "rgba(0,229,255,0.2)",
  },
];

function fmtType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  trend:    { bg: "rgba(52,211,153,0.08)",   text: "hsl(150,80%,55%)",   border: "rgba(52,211,153,0.2)" },
  reversal: { bg: "rgba(139,92,246,0.08)",   text: "hsl(260,80%,70%)",   border: "rgba(139,92,246,0.2)" },
  breakout: { bg: "rgba(245,158,11,0.08)",   text: "hsl(38,100%,60%)",   border: "rgba(245,158,11,0.2)" },
  default:  { bg: "rgba(100,180,255,0.08)",  text: "hsl(200,80%,65%)",   border: "rgba(100,180,255,0.2)" },
};

function typeStyle(type: string) {
  return TYPE_COLORS[type] ?? TYPE_COLORS.default;
}

interface StrategyCardProps {
  name: string;
  description: string;
  type: string;
  timeframe: string;
  symbol: string;
  winRate?: number;
  sharpe?: number;
  id: string | number;
  sample?: boolean;
  icon?: React.ElementType;
  color?: string;
  colorBg?: string;
  colorBorder?: string;
}

function StrategyCard({
  name, description, type, timeframe, symbol,
  winRate, sharpe, id, sample,
  icon: Icon = Layers,
  color = "hsl(190,90%,60%)",
  colorBg = "rgba(0,229,255,0.1)",
  colorBorder = "rgba(0,229,255,0.2)",
}: StrategyCardProps) {
  const ts = typeStyle(type);
  return (
    <div
      className="rounded-2xl border flex flex-col transition-all duration-200 hover:translate-y-[-2px]"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))",
        borderColor: "rgba(255,255,255,0.07)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Card header */}
      <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 flex items-start gap-3">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: colorBg, border: `1px solid ${colorBorder}` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm sm:text-base font-bold leading-tight" style={{ color: "hsl(220,14%,88%)" }}>
              {name}
            </h3>
            {sample && (
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.06)", color: "hsl(220,14%,40%)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                SAMPLE
              </span>
            )}
          </div>
          <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: "hsl(220,14%,42%)" }}>
            {description}
          </p>
        </div>
      </div>

      {/* Tags */}
      <div className="px-4 sm:px-5 flex flex-wrap gap-1.5 mb-3">
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
          style={{ background: ts.bg, color: ts.text, borderColor: ts.border }}
        >
          {fmtType(type)}
        </span>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.05)", color: "hsl(220,14%,50%)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {timeframe}
        </span>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.05)", color: "hsl(220,14%,50%)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {symbol}
        </span>
      </div>

      {/* Stats row */}
      {(winRate !== undefined || sharpe !== undefined) && (
        <div
          className="mx-4 sm:mx-5 mb-3 grid grid-cols-2 gap-2 rounded-xl p-2.5"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          {winRate !== undefined && (
            <div>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,14%,35%)" }}>Win Rate</p>
              <p className="text-sm font-mono font-bold" style={{ color: winRate >= 50 ? "hsl(150,80%,55%)" : "hsl(0,85%,62%)" }}>{winRate}%</p>
            </div>
          )}
          {sharpe !== undefined && (
            <div>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-0.5" style={{ color: "hsl(220,14%,35%)" }}>Sharpe</p>
              <p className="text-sm font-mono font-bold" style={{ color: "hsl(220,14%,75%)" }}>{sharpe.toFixed(2)}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex gap-2 mt-auto">
        {sample ? (
          <>
            <button
              className="flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all"
              style={{
                background: "rgba(0,229,255,0.08)",
                border: "1px solid rgba(0,229,255,0.15)",
                color: "hsl(190,90%,65%)",
              }}
              onClick={() => {}}
            >
              Learn More
            </button>
            <Button size="sm" asChild className="flex-1">
              <Link href="/backtests/new">
                Run Backtest
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" className="flex-1" asChild>
              <Link href={`/strategies/${id}`}>
                View Details
              </Link>
            </Button>
            <button
              className="h-9 w-9 flex items-center justify-center rounded-xl transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "hsl(220,14%,55%)",
              }}
            >
              <Link href={`/strategies/${id}`}>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Strategies() {
  const { data: strategies, isLoading } = useListStrategies();
  const [tab, setTab] = useState<"mine" | "sample">("mine");

  const hasOwn = (strategies?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-24 sm:pb-8">

      {/* Header */}
      <div
        className="float-up rounded-2xl px-4 sm:px-6 py-4 sm:py-5 border relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
          borderColor: "rgba(255,255,255,0.07)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div
          className="absolute -top-8 -right-8 h-28 w-28 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent)", opacity: 0.08 }}
        />
        <div className="relative flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(0,229,255,0.12)", border: "1px solid rgba(0,229,255,0.2)" }}
            >
              <BarChart2 className="h-5 w-5" style={{ color: "hsl(190,90%,65%)" }} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: "hsl(220,14%,92%)" }}>
                Analytics
              </h1>
              <p className="text-xs sm:text-sm mt-0.5" style={{ color: "hsl(220,14%,42%)" }}>
                Manage strategies, run backtests
              </p>
            </div>
          </div>
          <Button size="sm" asChild>
            <Link href="/strategies/new">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Strategy</span>
              <span className="sm:hidden">New</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="float-up-1 flex items-center gap-0.5 p-0.5 rounded-xl self-start"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        {([["mine", `My Strategies ${isLoading ? "" : `(${strategies?.length ?? 0})`}`], ["sample", "Sample (4)"]] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 text-xs font-mono rounded-lg transition-all"
            style={tab === t
              ? { background: "rgba(0,229,255,0.12)", color: "hsl(190,90%,65%)", boxShadow: "0 0 12px rgba(0,229,255,0.08)" }
              : { color: "hsl(220,14%,45%)" }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="float-up-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {tab === "sample" ? (
          SAMPLE_STRATEGIES.map((s) => (
            <StrategyCard
              key={s.id}
              {...s}
            />
          ))
        ) : isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border p-5 animate-pulse"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="skeleton-shimmer h-10 w-10 rounded-xl" />
                <div className="flex-1">
                  <div className="skeleton-shimmer h-4 w-32 rounded mb-2" />
                  <div className="skeleton-shimmer h-3 w-48 rounded" />
                </div>
              </div>
              <div className="flex gap-2 mb-3">
                <div className="skeleton-shimmer h-5 w-16 rounded-full" />
                <div className="skeleton-shimmer h-5 w-12 rounded-full" />
              </div>
              <div className="skeleton-shimmer h-10 w-full rounded-xl" />
            </div>
          ))
        ) : strategies && strategies.length > 0 ? (
          strategies.map((s) => (
            <StrategyCard
              key={s.id}
              id={s.id}
              name={s.name}
              description={s.description ?? "No description provided."}
              type={s.type ?? "default"}
              timeframe={s.timeframe ?? "—"}
              symbol={s.symbol ?? "—"}
            />
          ))
        ) : (
          <div className="col-span-full rounded-2xl border p-10 flex flex-col items-center gap-4 text-center"
            style={{ borderColor: "rgba(255,255,255,0.06)", borderStyle: "dashed" }}
          >
            <TrendingUp className="h-10 w-10 opacity-15" />
            <div>
              <h3 className="text-base font-medium mb-1" style={{ color: "hsl(220,14%,70%)" }}>No strategies yet</h3>
              <p className="text-xs" style={{ color: "hsl(220,14%,38%)" }}>
                Create your first strategy or explore sample strategies to get started.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => setTab("sample")}>
                Browse Samples
              </Button>
              <Button size="sm" asChild>
                <Link href="/strategies/new">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create Strategy
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
