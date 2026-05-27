import { useState } from "react";
import {
  Brain, TrendingUp, TrendingDown, Minus,
  Globe, Bitcoin, BarChart2, DollarSign,
  Clock, AlertTriangle, Target, Layers,
  RefreshCw, Newspaper, Shield, Eye, Crosshair,
  Activity, ChevronDown, ChevronUp,
} from "lucide-react";

/* ── Types ───────────────────────────────────────────────────────── */
type Sentiment = "bullish" | "bearish" | "neutral";

interface MarketCard { id: string; icon: React.ElementType; label: string; score: number; sentiment: Sentiment; headline: string; detail: string; change: number }
interface NewsItem { title: string; source: string; time: string; sentiment: Sentiment; category: string }
interface IctZone { concept: string; description: string; level: string; direction: Sentiment; icon: React.ElementType }
interface EconEvent { time: string; flag: string; country: string; event: string; impact: "high" | "medium" | "low"; forecast: string; previous: string }

/* ── Static data ─────────────────────────────────────────────────── */
const MARKETS: MarketCard[] = [
  {
    id: "crypto", icon: Bitcoin, label: "Crypto",
    score: 72, sentiment: "bullish",
    headline: "Bitcoin breaks above key $76K resistance",
    detail: "BTC has broken through the $76,000 resistance zone with strong volume confirmation. ETH follows with higher lows, suggesting a sustained trend shift. Altcoins are rotating bullishly with SOL and INJ leading gains.",
    change: 2.34,
  },
  {
    id: "forex", icon: Globe, label: "Forex",
    score: 38, sentiment: "bearish",
    headline: "USD strengthens on hawkish Fed rhetoric",
    detail: "The US Dollar Index (DXY) continues higher after Fed officials signaled fewer rate cuts in 2025. EUR/USD approached 1.0450 support, GBP/USD rejected from 1.2700. Risk-off sentiment is dominating FX flows.",
    change: -0.45,
  },
  {
    id: "equities", icon: BarChart2, label: "Equities",
    score: 51, sentiment: "neutral",
    headline: "S&P 500 consolidates near all-time highs",
    detail: "Major US indices are in a tight consolidation range. Tech (QQQ) is showing relative strength while energy stocks are lagging. Earnings season beats are broadly priced in. Watch for a breakout above SPX 5,300.",
    change: 0.12,
  },
  {
    id: "commodities", icon: DollarSign, label: "Commodities",
    score: 64, sentiment: "bullish",
    headline: "Gold holds $2,300 amid geopolitical risk",
    detail: "XAU/USD is maintaining strong bids above the $2,300 psychological level as geopolitical tensions keep safe-haven demand elevated. Oil (WTI) consolidates near $82 after recent OPEC+ supply cuts.",
    change: 0.87,
  },
];

const NEWS: NewsItem[] = [
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
  { concept: "Order Block (Bullish)", description: "A strong institutional buying zone at previous resistance turned support. Price has respected this area 3 times, indicating significant buy-side liquidity.", level: "BTC ~$72,400–$73,200", direction: "bullish", icon: Shield },
  { concept: "Fair Value Gap (FVG)", description: "An unfilled price inefficiency gap left by rapid buying momentum. Price typically returns to fill these gaps before continuing the trend.", level: "BTC ~$74,800–$75,600", direction: "bullish", icon: Layers },
  { concept: "Liquidity Pool (BSL)", description: "Buy-side liquidity resting above recent swing highs at $77,500. Smart money likely targets this level to offload positions before reversal.", level: "BTC ~$77,500", direction: "neutral", icon: Eye },
  { concept: "Break of Structure (BOS)", description: "Price has made a confirmed break of structure to the upside on the 4H timeframe, indicating a shift from distribution to accumulation phase.", level: "BTC ~$76,000", direction: "bullish", icon: Crosshair },
  { concept: "Premium / Discount Zone", description: "Current price sits in the premium zone (above 50% of the recent swing range). Optimal long entries are in the discount zone around $73,800–$74,500.", level: "50% = ~$74,600", direction: "neutral", icon: Target },
  { concept: "Market Structure Shift", description: "A lower timeframe (1H) market structure shift occurred, suggesting a potential short-term pullback before continuation of the higher timeframe trend.", level: "Watch $75,400 support", direction: "bearish", icon: Activity },
];

const ECON_EVENTS: EconEvent[] = [
  { time: "08:30", flag: "🇺🇸", country: "USD", event: "Core CPI (MoM)", impact: "high", forecast: "0.3%", previous: "0.4%" },
  { time: "10:00", flag: "🇺🇸", country: "USD", event: "Fed Chair Powell Speech", impact: "high", forecast: "—", previous: "—" },
  { time: "12:30", flag: "🇪🇺", country: "EUR", event: "ECB Lagarde Speech", impact: "medium", forecast: "—", previous: "—" },
  { time: "14:00", flag: "🇬🇧", country: "GBP", event: "UK CPI (YoY)", impact: "high", forecast: "2.1%", previous: "2.3%" },
  { time: "15:00", flag: "🇺🇸", country: "USD", event: "JOLTS Job Openings", impact: "medium", forecast: "8.75M", previous: "8.76M" },
  { time: "23:00", flag: "🇯🇵", country: "JPY", event: "Bank of Japan Minutes", impact: "medium", forecast: "—", previous: "—" },
];

/* ── Sentiment config ────────────────────────────────────────────── */
const SENT: Record<Sentiment, { color: string; bg: string; border: string; label: string; Icon: React.ElementType }> = {
  bullish: { color: "hsl(150,80%,55%)", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)", label: "Bullish", Icon: TrendingUp },
  bearish: { color: "hsl(0,78%,60%)",   bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)",  label: "Bearish", Icon: TrendingDown },
  neutral: { color: "hsl(38,95%,58%)",  bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)", label: "Neutral", Icon: Minus },
};

/* ── Card base style ─────────────────────────────────────────────── */
const CARD: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.014) 100%)",
  border: "1px solid rgba(255,255,255,0.07)",
  boxShadow: "0 4px 18px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
};

/* ── Sentiment badge ─────────────────────────────────────────────── */
function SentBadge({ s, score }: { s: Sentiment; score?: number }) {
  const cfg = SENT[s];
  const Icon = cfg.Icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <Icon className="h-2.5 w-2.5 flex-shrink-0" />
      {cfg.label}
      {score !== undefined && <span className="opacity-60">· {score}</span>}
    </span>
  );
}

/* ── Score bar ───────────────────────────────────────────────────── */
function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${score}%`, background: `linear-gradient(90deg,${color}55,${color})` }}
      />
    </div>
  );
}

/* ── Market analysis card ────────────────────────────────────────── */
function MarketAnalysisCard({ card }: { card: MarketCard }) {
  const [open, setOpen] = useState(false);
  const Icon = card.icon;
  const cfg = SENT[card.sentiment];
  const up = card.change >= 0;

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 cursor-pointer"
      style={{ ...CARD, borderColor: open ? `${cfg.color}35` : "rgba(255,255,255,0.07)" }}
      onClick={() => setOpen(v => !v)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}28`, color: cfg.color }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-mono font-semibold" style={{ color: "hsl(218,14%,80%)" }}>
              {card.label}
            </p>
            <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: "hsl(218,12%,42%)" }}>
              {card.headline}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <SentBadge s={card.sentiment} score={card.score} />
          <span className="text-[11px] font-mono font-bold"
            style={{ color: up ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>
            {up ? "+" : ""}{card.change.toFixed(2)}%
          </span>
        </div>
      </div>

      <ScoreBar score={card.score} color={cfg.color} />

      {open && (
        <p
          className="text-[11px] font-mono leading-relaxed rounded-xl px-3 py-3"
          style={{ background: "rgba(255,255,255,0.025)", color: "hsl(218,12%,55%)" }}
        >
          {card.detail}
        </p>
      )}

      <div className="flex justify-end">
        {open
          ? <ChevronUp className="h-3.5 w-3.5" style={{ color: "hsl(218,12%,36%)" }} />
          : <ChevronDown className="h-3.5 w-3.5" style={{ color: "hsl(218,12%,36%)" }} />
        }
      </div>
    </div>
  );
}

/* ── News card ───────────────────────────────────────────────────── */
function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2" style={CARD}>
      <div className="flex items-start gap-3">
        <p className="text-xs font-mono leading-relaxed flex-1" style={{ color: "hsl(218,14%,72%)" }}>
          {item.title}
        </p>
        <SentBadge s={item.sentiment} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "hsl(218,12%,44%)" }}
        >
          {item.category}
        </span>
        <span className="text-[10px] font-mono" style={{ color: "hsl(218,12%,34%)" }}>
          {item.source} · {item.time}
        </span>
      </div>
    </div>
  );
}

/* ── ICT zone card ───────────────────────────────────────────────── */
function IctCard({ zone }: { zone: IctZone }) {
  const Icon = zone.icon;
  const cfg = SENT[zone.direction];
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={CARD}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}28`, color: cfg.color }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-mono font-semibold truncate" style={{ color: "hsl(218,14%,78%)" }}>
              {zone.concept}
            </p>
            <p className="text-[10px] font-mono" style={{ color: cfg.color }}>{zone.level}</p>
          </div>
        </div>
        <SentBadge s={zone.direction} />
      </div>
      <p className="text-[11px] font-mono leading-relaxed" style={{ color: "hsl(218,12%,50%)" }}>
        {zone.description}
      </p>
    </div>
  );
}

/* ── Economic event row ──────────────────────────────────────────── */
function EconRow({ ev }: { ev: EconEvent }) {
  const IMPACT_COLOR = { high: "hsl(0,78%,60%)", medium: "hsl(38,95%,58%)", low: "hsl(150,80%,55%)" };
  const color = IMPACT_COLOR[ev.impact];
  const levels = ["low", "medium", "high"];

  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center gap-3"
      style={CARD}
    >
      <div className="flex-shrink-0 text-center" style={{ minWidth: "42px" }}>
        <p className="text-xs font-mono font-bold" style={{ color: "hsl(210,90%,65%)" }}>{ev.time}</p>
        <p className="text-[10px] font-mono" style={{ color: "hsl(218,12%,36%)" }}>{ev.country}</p>
      </div>
      <span className="text-base flex-shrink-0">{ev.flag}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono truncate" style={{ color: "hsl(218,14%,75%)" }}>{ev.event}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex gap-0.5">
            {levels.map((l, idx) => (
              <div
                key={l}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: levels.indexOf(ev.impact) >= idx ? color : "rgba(255,255,255,0.1)" }}
              />
            ))}
          </div>
          <span className="text-[10px] font-mono capitalize" style={{ color }}>{ev.impact}</span>
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-[10px] font-mono" style={{ color: "hsl(218,12%,44%)" }}>
          <span style={{ color: "hsl(218,12%,30%)" }}>F </span>{ev.forecast}
        </p>
        <p className="text-[10px] font-mono" style={{ color: "hsl(218,12%,44%)" }}>
          <span style={{ color: "hsl(218,12%,30%)" }}>P </span>{ev.previous}
        </p>
      </div>
    </div>
  );
}

/* ── Tab type ────────────────────────────────────────────────────── */
type Tab = "overview" | "news" | "ict" | "calendar";

/* ── Main page ───────────────────────────────────────────────────── */
export default function AiAssistant() {
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("Just now");

  const overallScore = Math.round(MARKETS.reduce((s, m) => s + m.score, 0) / MARKETS.length);
  const overallSentiment: Sentiment = overallScore >= 60 ? "bullish" : overallScore >= 40 ? "neutral" : "bearish";
  const overallCfg = SENT[overallSentiment];

  function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); setLastUpdate("Just now"); }, 1200);
  }

  const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: "overview",  label: "Overview",  Icon: Brain },
    { id: "news",      label: "News",      Icon: Newspaper },
    { id: "ict",       label: "ICT",       Icon: Target },
    { id: "calendar",  label: "Calendar",  Icon: Clock },
  ];

  return (
    <div className="flex flex-col gap-4 pb-6" style={{ maxWidth: "100%", overflow: "hidden" }}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-4 py-4"
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.09) 0%, rgba(59,130,246,0.04) 100%)",
          border: "1px solid rgba(139,92,246,0.2)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.28)" }}
            >
              <Brain className="h-5 w-5" style={{ color: "hsl(270,75%,72%)" }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: "hsl(218,16%,90%)" }}>
                AI Market Assistant
              </h1>
              <p className="text-[11px] font-mono" style={{ color: "hsl(218,12%,40%)" }}>
                Updated: {lastUpdate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)", color: "hsl(150,75%,52%)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "hsl(150,85%,50%)" }} />
              Live
            </span>
            <button
              onClick={handleRefresh}
              aria-label="Refresh"
              className="h-9 w-9 flex items-center justify-center rounded-xl transition-opacity active:opacity-60"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                style={{ color: "hsl(218,12%,52%)" }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────── */}
      <div
        className="flex gap-0.5 p-0.5 rounded-2xl"
        style={{ background: "rgba(255,255,255,0.024)", border: "1px solid rgba(255,255,255,0.065)" }}
      >
        {TABS.map(t => {
          const active = tab === t.id;
          const Icon = t.Icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] sm:text-xs font-mono rounded-xl transition-colors duration-150"
              style={active ? {
                background: "rgba(139,92,246,0.15)",
                color: "hsl(270,75%,72%)",
                border: "1px solid rgba(139,92,246,0.24)",
              } : {
                color: "hsl(218,12%,43%)",
                border: "1px solid transparent",
              }}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Overview ─────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="flex flex-col gap-3">
          {/* Overall sentiment */}
          <div
            className="rounded-2xl p-4 sm:p-5"
            style={{
              ...{
                background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.014) 100%)",
                border: `1px solid ${overallCfg.color}30`,
                boxShadow: "0 4px 18px rgba(0,0,0,0.2)",
              }
            }}
          >
            <p className="text-[10px] font-mono uppercase tracking-widest mb-3"
              style={{ color: "hsl(218,12%,36%)" }}>Overall Market Sentiment</p>
            <div className="flex items-center gap-4">
              <div
                className="flex-shrink-0 h-16 w-16 rounded-2xl flex flex-col items-center justify-center"
                style={{ background: `${overallCfg.color}12`, border: `1px solid ${overallCfg.color}30` }}
              >
                <span className="text-xl font-bold font-mono" style={{ color: overallCfg.color }}>{overallScore}</span>
                <span className="text-[9px] font-mono" style={{ color: "hsl(218,12%,40%)" }}>/100</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-semibold mb-1" style={{ color: overallCfg.color }}>
                  {overallCfg.label}
                </p>
                <p className="text-[11px] font-mono leading-relaxed" style={{ color: "hsl(218,12%,52%)" }}>
                  Markets showing a {overallCfg.label.toLowerCase()} tone driven by crypto strength and commodity demand. USD strength creating headwinds for risk assets.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["Risk-On", "BTC Dominant", "USD Strong", "Gold Bid"].map(tag => (
                    <span key={tag}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "hsl(218,12%,48%)" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Daily market summary header */}
          <p className="text-[10px] font-mono uppercase tracking-widest px-1"
            style={{ color: "hsl(218,12%,36%)" }}>Daily Market Analysis</p>

          {/* Market cards */}
          <div className="flex flex-col gap-3">
            {MARKETS.map(m => <MarketAnalysisCard key={m.id} card={m} />)}
          </div>
        </div>
      )}

      {/* ── News ─────────────────────────────────────────────────── */}
      {tab === "news" && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-mono uppercase tracking-widest px-1"
            style={{ color: "hsl(218,12%,36%)" }}>Market News</p>
          {NEWS.map((item, i) => <NewsCard key={i} item={item} />)}
        </div>
      )}

      {/* ── ICT Analysis ─────────────────────────────────────────── */}
      {tab === "ict" && (
        <div className="flex flex-col gap-3">
          {/* Disclaimer */}
          <div
            className="flex items-start gap-2 rounded-xl px-4 py-3"
            style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "hsl(38,95%,58%)" }} />
            <p className="text-[11px] font-mono leading-relaxed" style={{ color: "hsl(38,95%,58%)" }}>
              AI-generated ICT analysis for educational purposes only. Not financial advice.
            </p>
          </div>

          <p className="text-[10px] font-mono uppercase tracking-widest px-1"
            style={{ color: "hsl(218,12%,36%)" }}>ICT Concept Analysis</p>

          <div className="flex flex-col gap-3">
            {ICT_ZONES.map((zone, i) => <IctCard key={i} zone={zone} />)}
          </div>

          {/* AI directional bias */}
          <div
            className="rounded-2xl p-4 sm:p-5"
            style={{
              background: "linear-gradient(135deg, rgba(52,211,153,0.06), rgba(59,130,246,0.03))",
              border: "1px solid rgba(52,211,153,0.18)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4" style={{ color: "hsl(150,80%,58%)" }} />
              <p className="text-xs font-mono font-bold" style={{ color: "hsl(150,80%,62%)" }}>
                AI Directional Bias
              </p>
            </div>
            <p className="text-[11px] font-mono leading-relaxed" style={{ color: "hsl(218,12%,58%)" }}>
              Based on ICT concepts, the higher-timeframe bias remains{" "}
              <span style={{ color: "hsl(150,80%,58%)", fontWeight: 700 }}>bullish</span>.
              {" "}Price is trading above equilibrium of the recent macro range. Key decision point: a sweep of the $75,400 MSS level would offer a high-probability long entry targeting the $77,500 BSL zone.
            </p>
          </div>
        </div>
      )}

      {/* ── Economic Calendar ─────────────────────────────────────── */}
      {tab === "calendar" && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-mono uppercase tracking-widest px-1"
            style={{ color: "hsl(218,12%,36%)" }}>Today's High-Impact Events</p>

          {/* Impact legend */}
          <div className="flex items-center gap-4 px-1">
            {(["high", "medium", "low"] as const).map(level => {
              const c = { high: "hsl(0,78%,60%)", medium: "hsl(38,95%,58%)", low: "hsl(150,80%,55%)" }[level];
              return (
                <div key={level} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: c }} />
                  <span className="text-[10px] font-mono capitalize" style={{ color: "hsl(218,12%,40%)" }}>{level}</span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            {ECON_EVENTS.map((ev, i) => <EconRow key={i} ev={ev} />)}
          </div>
        </div>
      )}

    </div>
  );
}
