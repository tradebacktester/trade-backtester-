import { useState, useEffect } from "react";
import {
  Brain, TrendingUp, TrendingDown, Minus,
  Zap, Globe, DollarSign, Bitcoin, BarChart2,
  Clock, AlertTriangle, Target, Layers, ChevronDown,
  ChevronUp, RefreshCw, Newspaper, Activity,
  Shield, Eye, Crosshair,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────

type Sentiment = "bullish" | "bearish" | "neutral";

interface MarketSummary {
  market: string;
  sentiment: Sentiment;
  score: number;
  headline: string;
  detail: string;
  change: number;
}

interface NewsItem {
  title: string;
  source: string;
  time: string;
  sentiment: Sentiment;
  category: string;
}

interface IctZone {
  concept: string;
  description: string;
  level?: string;
  direction: Sentiment;
  icon: React.ReactNode;
}

interface EconEvent {
  time: string;
  country: string;
  flag: string;
  event: string;
  impact: "high" | "medium" | "low";
  forecast: string;
  previous: string;
}

// ── Static mock data (in real app, this would come from AI API) ────

const MARKET_SUMMARIES: MarketSummary[] = [
  {
    market: "Crypto",
    sentiment: "bullish",
    score: 72,
    headline: "Bitcoin breaks above key $76K resistance",
    detail: "BTC has broken through the $76,000 resistance zone with strong volume confirmation. ETH follows with higher lows, suggesting a sustained trend shift. Altcoins are rotating bullishly with SOL and INJ leading gains.",
    change: 2.34,
  },
  {
    market: "Forex",
    sentiment: "bearish",
    score: 38,
    headline: "USD strengthens on hawkish Fed rhetoric",
    detail: "The US Dollar Index (DXY) continues higher after Fed officials signaled fewer rate cuts in 2025. EUR/USD approached 1.0450 support, GBP/USD rejected from 1.2700. Risk-off sentiment is dominating FX flows.",
    change: -0.45,
  },
  {
    market: "Equities",
    sentiment: "neutral",
    score: 51,
    headline: "S&P 500 consolidates near all-time highs",
    detail: "Major US indices are in a tight consolidation range. Tech (QQQ) is showing relative strength while energy stocks are lagging. Earnings season beats are broadly priced in. Watch for a breakout above SPX 5300.",
    change: 0.12,
  },
  {
    market: "Commodities",
    sentiment: "bullish",
    score: 64,
    headline: "Gold holds $2,300 amid geopolitical risk",
    detail: "XAU/USD is maintaining strong bids above the $2,300 psychological level as geopolitical tensions in the Middle East keep safe-haven demand elevated. Oil (WTI) is consolidating near $82 after recent supply cuts by OPEC+.",
    change: 0.87,
  },
];

const NEWS_ITEMS: NewsItem[] = [
  { title: "Federal Reserve signals potential rate cuts could be delayed until Q3 2025", source: "Reuters", time: "2h ago", sentiment: "bearish", category: "Macro" },
  { title: "Bitcoin ETF inflows hit new weekly record of $1.2B as institutional demand surges", source: "CoinDesk", time: "3h ago", sentiment: "bullish", category: "Crypto" },
  { title: "OPEC+ reaffirms production cut agreement through end of 2025", source: "Bloomberg", time: "4h ago", sentiment: "bullish", category: "Commodities" },
  { title: "European Central Bank holds rates steady, signals June cut still on the table", source: "FT", time: "5h ago", sentiment: "neutral", category: "Forex" },
  { title: "NVIDIA reports record Q1 earnings, AI chip demand shows no signs of slowing", source: "CNBC", time: "6h ago", sentiment: "bullish", category: "Equities" },
  { title: "China's manufacturing PMI contracts for second consecutive month", source: "WSJ", time: "7h ago", sentiment: "bearish", category: "Macro" },
  { title: "Ethereum staking rewards hit 4.2% APY as network utilization rises", source: "Decrypt", time: "8h ago", sentiment: "bullish", category: "Crypto" },
  { title: "US CPI data comes in slightly above expectations at 3.5% YoY", source: "MarketWatch", time: "9h ago", sentiment: "bearish", category: "Macro" },
];

const ICT_ZONES: IctZone[] = [
  {
    concept: "Order Block (Bullish)",
    description: "A strong institutional buying zone at previous resistance turned support. Price has respected this area 3 times, indicating significant buy-side liquidity.",
    level: "BTC ~$72,400–$73,200",
    direction: "bullish",
    icon: <Shield className="h-4 w-4" />,
  },
  {
    concept: "Fair Value Gap (FVG)",
    description: "An unfilled price inefficiency gap left by rapid buying momentum. Price typically returns to fill these gaps before continuing the trend.",
    level: "BTC ~$74,800–$75,600",
    direction: "bullish",
    icon: <Layers className="h-4 w-4" />,
  },
  {
    concept: "Liquidity Pool (BSL)",
    description: "Buy-side liquidity resting above recent swing highs at $77,500. Smart money likely targets this level to offload positions before reversal.",
    level: "BTC ~$77,500",
    direction: "neutral",
    icon: <Eye className="h-4 w-4" />,
  },
  {
    concept: "Break of Structure (BOS)",
    description: "Price has made a confirmed break of structure to the upside on the 4H timeframe, indicating a shift from distribution to accumulation phase.",
    level: "BTC ~$76,000",
    direction: "bullish",
    icon: <Crosshair className="h-4 w-4" />,
  },
  {
    concept: "Premium/Discount Zone",
    description: "Current price sits in the premium zone (above 50% of the recent swing range). Optimal long entries are in the discount zone around $73,800–$74,500.",
    level: "50% = ~$74,600",
    direction: "neutral",
    icon: <Target className="h-4 w-4" />,
  },
  {
    concept: "Market Structure Shift (MSS)",
    description: "A lower timeframe (1H) market structure shift occurred, suggesting a potential short-term pullback before continuation of the higher timeframe trend.",
    level: "Watch $75,400 support",
    direction: "bearish",
    icon: <Activity className="h-4 w-4" />,
  },
];

const ECON_EVENTS: EconEvent[] = [
  { time: "08:30", country: "USD", flag: "🇺🇸", event: "Core CPI (MoM)", impact: "high", forecast: "0.3%", previous: "0.4%" },
  { time: "10:00", country: "USD", flag: "🇺🇸", event: "Fed Chair Powell Speech", impact: "high", forecast: "—", previous: "—" },
  { time: "12:30", country: "EUR", flag: "🇪🇺", event: "ECB President Lagarde Speech", impact: "medium", forecast: "—", previous: "—" },
  { time: "14:00", country: "GBP", flag: "🇬🇧", event: "UK CPI (YoY)", impact: "high", forecast: "2.1%", previous: "2.3%" },
  { time: "15:00", country: "USD", flag: "🇺🇸", event: "JOLTS Job Openings", impact: "medium", forecast: "8.75M", previous: "8.76M" },
  { time: "23:00", country: "JPY", flag: "🇯🇵", event: "Bank of Japan Meeting Minutes", impact: "medium", forecast: "—", previous: "—" },
];

// ── Helpers ───────────────────────────────────────────────────────

function SentimentBadge({ sentiment, score }: { sentiment: Sentiment; score?: number }) {
  const config = {
    bullish: { color: "hsl(150,90%,58%)", bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.2)", icon: <TrendingUp className="h-3 w-3" />, label: "Bullish" },
    bearish: { color: "hsl(0,85%,62%)",   bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.2)",   icon: <TrendingDown className="h-3 w-3" />, label: "Bearish" },
    neutral: { color: "hsl(38,100%,60%)", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.2)",  icon: <Minus className="h-3 w-3" />,        label: "Neutral" },
  }[sentiment];
  return (
    <span className="flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full" style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}` }}>
      {config.icon}
      {config.label}
      {score !== undefined && <span className="opacity-70">· {score}</span>}
    </span>
  );
}

function ImpactDot({ impact }: { impact: "high" | "medium" | "low" }) {
  const colors = { high: "hsl(0,85%,62%)", medium: "hsl(38,100%,60%)", low: "hsl(150,90%,58%)" };
  return (
    <div className="flex gap-0.5">
      {["low","medium","high"].map((l, i) => (
        <div key={l} className="h-1.5 w-1.5 rounded-full" style={{ background: ["low","medium","high"].indexOf(impact) >= i ? colors[impact] : "rgba(255,255,255,0.1)" }} />
      ))}
    </div>
  );
}

// ── Sentiment Gauge ───────────────────────────────────────────────

function SentimentGauge({ score }: { score: number }) {
  const color = score >= 60 ? "hsl(150,90%,55%)" : score >= 40 ? "hsl(38,100%,55%)" : "hsl(0,85%,60%)";
  const label = score >= 60 ? "Bullish" : score >= 40 ? "Neutral" : "Bearish";
  const pct = score;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${2 * Math.PI * 40 * pct / 100} ${2 * Math.PI * 40 * (1 - pct / 100)}`}
            strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold font-mono" style={{ color }}>{score}</span>
          <span className="text-[9px] font-mono" style={{ color: "hsl(220,14%,45%)" }}>/100</span>
        </div>
      </div>
      <span className="text-xs font-mono font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

// ── Market Card ───────────────────────────────────────────────────

function MarketCard({ summary }: { summary: MarketSummary }) {
  const [expanded, setExpanded] = useState(false);
  const isUp = summary.change >= 0;
  const icons: Record<string, React.ReactNode> = {
    Crypto: <Bitcoin className="h-4 w-4" />,
    Forex: <Globe className="h-4 w-4" />,
    Equities: <BarChart2 className="h-4 w-4" />,
    Commodities: <DollarSign className="h-4 w-4" />,
  };

  const sentColor = summary.sentiment === "bullish" ? "hsl(150,90%,55%)" : summary.sentiment === "bearish" ? "hsl(0,85%,62%)" : "hsl(38,100%,55%)";

  return (
    <div
      className="rounded-2xl border p-4 flex flex-col gap-3 cursor-pointer transition-all"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderColor: expanded ? `${sentColor}40` : "rgba(255,255,255,0.07)",
        boxShadow: expanded ? `0 0 24px ${sentColor}10` : "none",
      }}
      onClick={() => setExpanded(v => !v)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${sentColor}15`, border: `1px solid ${sentColor}30`, color: sentColor }}>
            {icons[summary.market]}
          </div>
          <div>
            <p className="text-xs font-mono font-semibold" style={{ color: "hsl(220,14%,80%)" }}>{summary.market}</p>
            <p className="text-[10px] font-mono mt-0.5" style={{ color: "hsl(220,14%,42%)" }}>{summary.headline}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <SentimentBadge sentiment={summary.sentiment} score={summary.score} />
          <span className="text-[11px] font-mono font-bold" style={{ color: isUp ? "hsl(150,90%,58%)" : "hsl(0,85%,62%)" }}>
            {isUp ? "+" : ""}{summary.change.toFixed(2)}%
          </span>
        </div>
      </div>

      {expanded && (
        <div className="text-xs font-mono leading-relaxed rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.03)", color: "hsl(220,14%,58%)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {summary.detail}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${summary.score}%`, background: `linear-gradient(90deg, ${sentColor}60, ${sentColor})` }} />
        </div>
        <button className="ml-3 flex-shrink-0" style={{ color: "hsl(220,14%,38%)" }}>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────

export default function AiAssistant() {
  const [tab, setTab] = useState<"overview" | "news" | "ict" | "calendar">("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("Just now");

  const overallScore = Math.round(MARKET_SUMMARIES.reduce((s, m) => s + m.score, 0) / MARKET_SUMMARIES.length);

  function handleRefresh() {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastUpdate("Just now");
    }, 1400);
  }

  const tabs = [
    { id: "overview",  label: "Overview",  icon: <Brain className="h-3.5 w-3.5" /> },
    { id: "news",      label: "News",      icon: <Newspaper className="h-3.5 w-3.5" /> },
    { id: "ict",       label: "ICT Analysis", icon: <Target className="h-3.5 w-3.5" /> },
    { id: "calendar",  label: "Calendar",  icon: <Clock className="h-3.5 w-3.5" /> },
  ] as const;

  return (
    <div className="flex flex-col gap-4 pb-24 sm:pb-6">

      {/* Header */}
      <div
        className="rounded-2xl px-4 sm:px-5 py-4 border relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(0,229,255,0.04) 100%)",
          borderColor: "rgba(139,92,246,0.2)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.4), 0 0 60px rgba(139,92,246,0.05)",
        }}
      >
        <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.12), transparent)" }} />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
              <Brain className="h-5 w-5" style={{ color: "hsl(260,80%,72%)" }} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: "hsl(220,14%,92%)" }}>AI Market Assistant</h1>
              <p className="text-xs font-mono" style={{ color: "hsl(220,14%,42%)" }}>
                Last updated: {lastUpdate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "hsl(150,80%,55%)" }}>
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "hsl(150,90%,52%)" }} />
              Live
            </span>
            <button
              onClick={handleRefresh}
              className="h-9 w-9 flex items-center justify-center rounded-xl transition-all"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} style={{ color: "hsl(220,14%,55%)" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] sm:text-xs font-mono rounded-xl transition-all"
            style={tab === t.id ? {
              background: "rgba(139,92,246,0.15)",
              color: "hsl(260,80%,72%)",
              border: "1px solid rgba(139,92,246,0.25)",
              boxShadow: "0 0 16px rgba(139,92,246,0.08)",
            } : {
              color: "hsl(220,14%,45%)",
              border: "1px solid transparent",
            }}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          {/* Sentiment gauge row */}
          <div
            className="rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-5"
            style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.07)" }}
          >
            <SentimentGauge score={overallScore} />
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: "hsl(220,14%,38%)" }}>Overall Market Sentiment</p>
              <p className="text-sm font-mono leading-relaxed" style={{ color: "hsl(220,14%,60%)" }}>
                Markets are showing a <span style={{ color: "hsl(150,90%,58%)", fontWeight: 700 }}>moderately bullish</span> tone driven by crypto strength and commodity demand. USD strength is creating headwinds for risk assets in traditional FX markets. Equity markets are in consolidation mode.
              </p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                {["Risk-On","BTC Dominant","USD Strong","Gold Bid"].map(tag => (
                  <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "hsl(220,14%,55%)" }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Market cards */}
          <div className="grid grid-cols-1 gap-3">
            {MARKET_SUMMARIES.map(s => <MarketCard key={s.market} summary={s} />)}
          </div>
        </div>
      )}

      {/* ── News ── */}
      {tab === "news" && (
        <div className="flex flex-col gap-2">
          {NEWS_ITEMS.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border p-4 flex flex-col gap-2 transition-all"
              style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-mono leading-relaxed flex-1" style={{ color: "hsl(220,14%,75%)" }}>{item.title}</p>
                <SentimentBadge sentiment={item.sentiment} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "hsl(220,14%,45%)" }}>{item.category}</span>
                <span className="text-[10px] font-mono" style={{ color: "hsl(220,14%,35%)" }}>{item.source} · {item.time}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ICT Analysis ── */}
      {tab === "ict" && (
        <div className="flex flex-col gap-3">
          {/* Disclaimer */}
          <div className="flex items-start gap-2 rounded-xl px-4 py-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "hsl(38,100%,60%)" }} />
            <p className="text-[11px] font-mono leading-relaxed" style={{ color: "hsl(38,100%,60%)" }}>
              AI-generated ICT analysis for educational purposes only. Not financial advice. Always do your own analysis.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {ICT_ZONES.map((zone, i) => {
              const sentColor = zone.direction === "bullish" ? "hsl(150,90%,55%)" : zone.direction === "bearish" ? "hsl(0,85%,62%)" : "hsl(38,100%,55%)";
              return (
                <div
                  key={i}
                  className="rounded-2xl border p-4 flex flex-col gap-3"
                  style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.07)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${sentColor}15`, border: `1px solid ${sentColor}30`, color: sentColor }}>
                        {zone.icon}
                      </div>
                      <div>
                        <p className="text-xs font-mono font-semibold" style={{ color: "hsl(220,14%,80%)" }}>{zone.concept}</p>
                        {zone.level && <p className="text-[10px] font-mono" style={{ color: sentColor }}>{zone.level}</p>}
                      </div>
                    </div>
                    <SentimentBadge sentiment={zone.direction} />
                  </div>
                  <p className="text-[11px] font-mono leading-relaxed" style={{ color: "hsl(220,14%,52%)" }}>{zone.description}</p>
                </div>
              );
            })}
          </div>

          {/* AI Directional Bias */}
          <div
            className="rounded-2xl border p-5"
            style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.06), rgba(0,229,255,0.03))", borderColor: "rgba(52,211,153,0.2)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4" style={{ color: "hsl(150,90%,60%)" }} />
              <p className="text-xs font-mono font-bold" style={{ color: "hsl(150,90%,65%)" }}>AI Directional Bias</p>
            </div>
            <p className="text-xs font-mono leading-relaxed" style={{ color: "hsl(220,14%,62%)" }}>
              Based on ICT concepts, the higher-timeframe (HTF) bias remains <span style={{ color: "hsl(150,90%,60%)", fontWeight: 700 }}>bullish</span>. Price is trading above the equilibrium level of the recent macro range, and institutional order flow appears to be expanding. Key decision point: a sweep of the $75,400 MSS level would offer a high-probability long entry targeting the $77,500 BSL zone.
            </p>
          </div>
        </div>
      )}

      {/* ── Economic Calendar ── */}
      {tab === "calendar" && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-mono uppercase tracking-widest px-1" style={{ color: "hsl(220,14%,38%)" }}>Today's High-Impact Events</p>
          <div className="flex flex-col gap-2">
            {ECON_EVENTS.map((ev, i) => (
              <div
                key={i}
                className="rounded-2xl border px-4 py-3 flex items-center gap-3"
                style={{ background: "rgba(255,255,255,0.015)", borderColor: ev.impact === "high" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)" }}
              >
                <span className="text-lg flex-shrink-0">{ev.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-mono font-semibold truncate" style={{ color: "hsl(220,14%,78%)" }}>{ev.event}</p>
                    <ImpactDot impact={ev.impact} />
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono" style={{ color: "hsl(220,14%,40%)" }}>
                    <span>{ev.country}</span>
                    {ev.forecast !== "—" && <span>Forecast: <span style={{ color: "hsl(220,14%,58%)" }}>{ev.forecast}</span></span>}
                    {ev.previous !== "—" && <span>Prev: <span style={{ color: "hsl(220,14%,50%)" }}>{ev.previous}</span></span>}
                  </div>
                </div>
                <span className="text-xs font-mono flex-shrink-0" style={{ color: "hsl(38,100%,55%)" }}>{ev.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
