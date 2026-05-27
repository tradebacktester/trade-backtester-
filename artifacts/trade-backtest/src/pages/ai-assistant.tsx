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

/* ── Design tokens ────────────────────────────────────────────────── */
const C = {
  text:    "hsl(0,0%,84%)",
  sub:     "hsl(0,0%,46%)",
  muted:   "hsl(0,0%,34%)",
  border:  "rgba(255,255,255,0.07)",
  surface: "hsl(0,0%,11%)",
  surfaceAlt: "rgba(255,255,255,0.03)",
  positive: "#34d399",
  negative: "#f87171",
  amber:   "#fbbf24",
};

const CARD: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  boxShadow: "0 2px 12px rgba(0,0,0,0.26)",
};

/* ── Static data ─────────────────────────────────────────────────── */
const MARKETS: MarketCard[] = [
  { id: "crypto",      icon: Bitcoin,   label: "Crypto",      score: 72, sentiment: "bullish", headline: "Bitcoin breaks above key $76K resistance",    detail: "BTC has broken through the $76,000 resistance zone with strong volume confirmation. ETH follows with higher lows, suggesting a sustained trend shift. Altcoins are rotating bullishly with SOL and INJ leading gains.", change: 2.34 },
  { id: "forex",       icon: Globe,     label: "Forex",       score: 38, sentiment: "bearish", headline: "USD strengthens on hawkish Fed rhetoric",       detail: "The US Dollar Index (DXY) continues higher after Fed officials signaled fewer rate cuts in 2025. EUR/USD approached 1.0450 support, GBP/USD rejected from 1.2700. Risk-off sentiment is dominating FX flows.", change: -0.45 },
  { id: "equities",    icon: BarChart2, label: "Equities",    score: 51, sentiment: "neutral", headline: "S&P 500 consolidates near all-time highs",      detail: "Major US indices are in a tight consolidation range. Tech (QQQ) is showing relative strength while energy stocks are lagging. Earnings season beats are broadly priced in. Watch for a breakout above SPX 5,300.", change: 0.12 },
  { id: "commodities", icon: DollarSign,label: "Commodities", score: 64, sentiment: "bullish", headline: "Gold holds $2,300 amid geopolitical risk",       detail: "XAU/USD is maintaining strong bids above the $2,300 psychological level as geopolitical tensions keep safe-haven demand elevated. Oil (WTI) consolidates near $82 after recent OPEC+ supply cuts.", change: 0.87 },
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
  { concept: "Order Block (Bullish)",    description: "A strong institutional buying zone at previous resistance turned support. Price has respected this area 3 times, indicating significant buy-side liquidity.", level: "BTC ~$72,400–$73,200", direction: "bullish", icon: Shield },
  { concept: "Fair Value Gap (FVG)",     description: "An unfilled price inefficiency gap left by rapid buying momentum. Price typically returns to fill these gaps before continuing the trend.", level: "BTC ~$74,800–$75,600", direction: "bullish", icon: Layers },
  { concept: "Liquidity Pool (BSL)",     description: "Buy-side liquidity resting above recent swing highs at $77,500. Smart money likely targets this level to offload positions before reversal.", level: "BTC ~$77,500", direction: "neutral", icon: Eye },
  { concept: "Break of Structure (BOS)", description: "Price has made a confirmed break of structure to the upside on the 4H timeframe, indicating a shift from distribution to accumulation phase.", level: "BTC ~$76,000", direction: "bullish", icon: Crosshair },
  { concept: "Premium / Discount Zone", description: "Current price sits in the premium zone (above 50% of the recent swing range). Optimal long entries are in the discount zone around $73,800–$74,500.", level: "50% = ~$74,600", direction: "neutral", icon: Target },
  { concept: "Market Structure Shift",  description: "A lower timeframe (1H) market structure shift occurred, suggesting a potential short-term pullback before continuation of the higher timeframe trend.", level: "Watch $75,400 support", direction: "bearish", icon: Activity },
];

const ECON_EVENTS: EconEvent[] = [
  { time: "08:30", flag: "🇺🇸", country: "USD", event: "Core CPI (MoM)", impact: "high", forecast: "0.3%", previous: "0.4%" },
  { time: "10:00", flag: "🇺🇸", country: "USD", event: "Fed Chair Powell Speech", impact: "high", forecast: "—", previous: "—" },
  { time: "12:30", flag: "🇪🇺", country: "EUR", event: "ECB Lagarde Speech", impact: "medium", forecast: "—", previous: "—" },
  { time: "14:00", flag: "🇬🇧", country: "GBP", event: "UK CPI (YoY)", impact: "high", forecast: "2.1%", previous: "2.3%" },
  { time: "15:00", flag: "🇺🇸", country: "USD", event: "JOLTS Job Openings", impact: "medium", forecast: "8.75M", previous: "8.76M" },
  { time: "23:00", flag: "🇯🇵", country: "JPY", event: "Bank of Japan Minutes", impact: "medium", forecast: "—", previous: "—" },
];

/* ── Sentiment config ─────────────────────────────────────────────── */
const SENT: Record<Sentiment, { color: string; label: string; Icon: React.ElementType }> = {
  bullish: { color: C.positive, label: "Bullish", Icon: TrendingUp },
  bearish: { color: C.negative, label: "Bearish", Icon: TrendingDown },
  neutral: { color: C.amber,    label: "Neutral",  Icon: Minus },
};

/* ── Sentiment badge ──────────────────────────────────────────────── */
function SentBadge({ s, score }: { s: Sentiment; score?: number }) {
  const { color, label, Icon } = SENT[s];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
      style={{ color, background: `${color}10`, border: `1px solid ${color}25` }}
    >
      <Icon className="h-2.5 w-2.5 flex-shrink-0" />
      {label}
      {score !== undefined && <span className="opacity-55">· {score}</span>}
    </span>
  );
}

/* ── Score bar ────────────────────────────────────────────────────── */
function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="h-0.5 w-full rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div className="h-full rounded-full" style={{ width: `${score}%`, background: color, opacity: 0.7 }} />
    </div>
  );
}

/* ── Market analysis card ─────────────────────────────────────────── */
function MarketAnalysisCard({ card }: { card: MarketCard }) {
  const [open, setOpen] = useState(false);
  const Icon = card.icon;
  const { color, label } = SENT[card.sentiment];
  const up = card.change >= 0;

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-colors duration-150"
      style={{ ...CARD, borderColor: open ? "rgba(255,255,255,0.12)" : C.border }}
      onClick={() => setOpen(v => !v)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Icon className="h-4 w-4" style={{ color: C.sub }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-mono font-semibold" style={{ color: C.text }}>{card.label}</p>
            <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: C.muted }}>{card.headline}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <SentBadge s={card.sentiment} score={card.score} />
          <span className="text-[11px] font-mono font-bold" style={{ color: up ? C.positive : C.negative }}>
            {up ? "+" : ""}{card.change.toFixed(2)}%
          </span>
        </div>
      </div>

      <ScoreBar score={card.score} color={color} />

      {open && (
        <p
          className="text-[11px] font-mono leading-relaxed rounded-xl px-3 py-3"
          style={{ background: C.surfaceAlt, color: C.sub }}
        >
          {card.detail}
        </p>
      )}

      <div className="flex justify-end">
        {open
          ? <ChevronUp className="h-3.5 w-3.5" style={{ color: C.muted }} />
          : <ChevronDown className="h-3.5 w-3.5" style={{ color: C.muted }} />
        }
      </div>
    </div>
  );
}

/* ── News card ────────────────────────────────────────────────────── */
function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2" style={CARD}>
      <div className="flex items-start gap-3">
        <p className="text-xs font-mono leading-relaxed flex-1" style={{ color: C.text }}>
          {item.title}
        </p>
        <SentBadge s={item.sentiment} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
          style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.sub }}
        >
          {item.category}
        </span>
        <span className="text-[10px] font-mono" style={{ color: C.muted }}>
          {item.source} · {item.time}
        </span>
      </div>
    </div>
  );
}

/* ── ICT card ─────────────────────────────────────────────────────── */
function IctCard({ zone }: { zone: IctZone }) {
  const Icon = zone.icon;
  const { color } = SENT[zone.direction];
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={CARD}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Icon className="h-4 w-4" style={{ color: C.sub }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-mono font-semibold truncate" style={{ color: C.text }}>
              {zone.concept}
            </p>
            <p className="text-[10px] font-mono" style={{ color }}>{zone.level}</p>
          </div>
        </div>
        <SentBadge s={zone.direction} />
      </div>
      <p className="text-[11px] font-mono leading-relaxed" style={{ color: C.sub }}>
        {zone.description}
      </p>
    </div>
  );
}

/* ── Economic event row ───────────────────────────────────────────── */
function EconRow({ ev }: { ev: EconEvent }) {
  const IMPACT_COLOR = { high: C.negative, medium: C.amber, low: C.positive };
  const color = IMPACT_COLOR[ev.impact];
  const levels = ["low", "medium", "high"];

  return (
    <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={CARD}>
      <div className="flex-shrink-0 text-center" style={{ minWidth: "42px" }}>
        <p className="text-xs font-mono font-bold" style={{ color: C.text }}>{ev.time}</p>
        <p className="text-[10px] font-mono" style={{ color: C.muted }}>{ev.country}</p>
      </div>
      <span className="text-base flex-shrink-0">{ev.flag}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono truncate" style={{ color: C.text }}>{ev.event}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex gap-0.5">
            {levels.map((l, idx) => (
              <div
                key={l}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: levels.indexOf(ev.impact) >= idx ? color : "rgba(255,255,255,0.08)" }}
              />
            ))}
          </div>
          <span className="text-[10px] font-mono capitalize" style={{ color }}>{ev.impact}</span>
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-[10px] font-mono" style={{ color: C.sub }}>
          <span style={{ color: C.muted }}>F </span>{ev.forecast}
        </p>
        <p className="text-[10px] font-mono" style={{ color: C.sub }}>
          <span style={{ color: C.muted }}>P </span>{ev.previous}
        </p>
      </div>
    </div>
  );
}

/* ── Tab type ─────────────────────────────────────────────────────── */
type Tab = "overview" | "news" | "ict" | "calendar";

/* ── Main page ────────────────────────────────────────────────────── */
export default function AiAssistant() {
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("Just now");

  const overallScore = Math.round(MARKETS.reduce((s, m) => s + m.score, 0) / MARKETS.length);
  const overallSentiment: Sentiment = overallScore >= 60 ? "bullish" : overallScore >= 40 ? "neutral" : "bearish";
  const overallColor = SENT[overallSentiment].color;
  const overallLabel = SENT[overallSentiment].label;

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

      {/* Header */}
      <div
        className="rounded-2xl px-4 py-4"
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          boxShadow: "0 2px 12px rgba(0,0,0,0.28)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <Brain className="h-5 w-5" style={{ color: "hsl(0,0%,64%)" }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: "hsl(0,0%,88%)" }}>
                AI Market Assistant
              </h1>
              <p className="text-[11px] font-mono" style={{ color: C.muted }}>Updated: {lastUpdate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full"
              style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.16)", color: "#34d399" }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#34d399" }} />
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
                style={{ color: C.sub }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-0.5 p-0.5 rounded-2xl"
        style={{ background: "hsl(0,0%,10%)", border: `1px solid ${C.border}` }}
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
                background: "rgba(255,255,255,0.08)",
                color: "hsl(0,0%,88%)",
                border: "1px solid rgba(255,255,255,0.1)",
              } : {
                color: C.sub,
                border: "1px solid transparent",
              }}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="flex flex-col gap-3">
          {/* Overall sentiment */}
          <div className="rounded-2xl p-4 sm:p-5" style={CARD}>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: C.muted }}>
              Overall Market Sentiment
            </p>
            <div className="flex items-center gap-4">
              <div
                className="flex-shrink-0 h-14 w-14 rounded-2xl flex flex-col items-center justify-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span className="text-lg font-bold font-mono" style={{ color: overallColor }}>{overallScore}</span>
                <span className="text-[9px] font-mono" style={{ color: C.muted }}>/100</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-semibold mb-1" style={{ color: overallColor }}>
                  {overallLabel}
                </p>
                <p className="text-[11px] font-mono leading-relaxed" style={{ color: C.sub }}>
                  Markets showing a {overallLabel.toLowerCase()} tone driven by crypto strength and commodity demand. USD strength creating headwinds for risk assets.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["Risk-On", "BTC Dominant", "USD Strong", "Gold Bid"].map(tag => (
                    <span key={tag}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                      style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.muted }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="text-[10px] font-mono uppercase tracking-widest px-1" style={{ color: C.muted }}>
            Daily Market Analysis
          </p>

          <div className="flex flex-col gap-3">
            {MARKETS.map(m => <MarketAnalysisCard key={m.id} card={m} />)}
          </div>
        </div>
      )}

      {/* News */}
      {tab === "news" && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-mono uppercase tracking-widest px-1" style={{ color: C.muted }}>
            Market News
          </p>
          {NEWS.map((item, i) => <NewsCard key={i} item={item} />)}
        </div>
      )}

      {/* ICT */}
      {tab === "ict" && (
        <div className="flex flex-col gap-3">
          <div
            className="flex items-start gap-2 rounded-xl px-4 py-3"
            style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: C.amber }} />
            <p className="text-[11px] font-mono leading-relaxed" style={{ color: C.amber }}>
              AI-generated ICT analysis for educational purposes only. Not financial advice.
            </p>
          </div>
          <p className="text-[10px] font-mono uppercase tracking-widest px-1" style={{ color: C.muted }}>
            ICT Concept Analysis
          </p>
          <div className="flex flex-col gap-3">
            {ICT_ZONES.map((zone, i) => <IctCard key={i} zone={zone} />)}
          </div>
          <div
            className="rounded-2xl p-4 sm:p-5"
            style={{
              background: "rgba(52,211,153,0.04)",
              border: "1px solid rgba(52,211,153,0.14)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4" style={{ color: C.positive }} />
              <p className="text-xs font-mono font-semibold" style={{ color: C.positive }}>AI Directional Bias</p>
            </div>
            <p className="text-[11px] font-mono leading-relaxed" style={{ color: C.sub }}>
              Based on ICT concepts, the higher-timeframe bias remains{" "}
              <span style={{ color: C.positive, fontWeight: 700 }}>bullish</span>.
              {" "}Price is trading above equilibrium of the recent macro range. Key decision point: a sweep of the $75,400 MSS level would offer a high-probability long entry targeting the $77,500 BSL zone.
            </p>
          </div>
        </div>
      )}

      {/* Calendar */}
      {tab === "calendar" && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-mono uppercase tracking-widest px-1" style={{ color: C.muted }}>
            Today's High-Impact Events
          </p>
          <div className="flex items-center gap-4 px-1">
            {(["high", "medium", "low"] as const).map(level => {
              const c = { high: C.negative, medium: C.amber, low: C.positive }[level];
              return (
                <div key={level} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
                  <span className="text-[10px] font-mono capitalize" style={{ color: C.muted }}>{level}</span>
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
