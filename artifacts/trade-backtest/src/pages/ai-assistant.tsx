import { useState } from "react";
import {
  Brain, TrendingUp, TrendingDown, Minus,
  Zap, Globe, DollarSign, Bitcoin, BarChart2,
  Clock, AlertTriangle, Target, Layers, ChevronDown,
  ChevronUp, RefreshCw, Newspaper, Activity,
  Shield, Eye, Crosshair,
} from "lucide-react";

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

const MARKET_SUMMARIES: MarketSummary[] = [
  { market: "Crypto",      sentiment: "bullish", score: 72, headline: "Bitcoin breaks above key $76K resistance", detail: "BTC has broken through the $76,000 resistance zone with strong volume confirmation. ETH follows with higher lows, suggesting a sustained trend shift. Altcoins are rotating bullishly with SOL and INJ leading gains.", change: 2.34 },
  { market: "Forex",       sentiment: "bearish", score: 38, headline: "USD strengthens on hawkish Fed rhetoric",   detail: "The US Dollar Index (DXY) continues higher after Fed officials signaled fewer rate cuts in 2025. EUR/USD approached 1.0450 support, GBP/USD rejected from 1.2700. Risk-off sentiment is dominating FX flows.", change: -0.45 },
  { market: "Equities",    sentiment: "neutral", score: 51, headline: "S&P 500 consolidates near all-time highs",  detail: "Major US indices are in a tight consolidation range. Tech (QQQ) is showing relative strength while energy stocks are lagging. Earnings season beats are broadly priced in. Watch for a breakout above SPX 5300.", change: 0.12 },
  { market: "Commodities", sentiment: "bullish", score: 64, headline: "Gold holds $2,300 amid geopolitical risk",  detail: "XAU/USD is maintaining strong bids above the $2,300 psychological level as geopolitical tensions keep safe-haven demand elevated. Oil (WTI) consolidates near $82 after recent OPEC+ supply cuts.", change: 0.87 },
];

const NEWS_ITEMS: NewsItem[] = [
  { title: "Federal Reserve signals potential rate cuts could be delayed until Q3 2025",          source: "Reuters",     time: "2h ago", sentiment: "bearish", category: "Macro" },
  { title: "Bitcoin ETF inflows hit new weekly record of $1.2B as institutional demand surges",   source: "CoinDesk",    time: "3h ago", sentiment: "bullish", category: "Crypto" },
  { title: "OPEC+ reaffirms production cut agreement through end of 2025",                        source: "Bloomberg",   time: "4h ago", sentiment: "bullish", category: "Commodities" },
  { title: "European Central Bank holds rates steady, signals June cut still on the table",        source: "FT",          time: "5h ago", sentiment: "neutral", category: "Forex" },
  { title: "NVIDIA reports record Q1 earnings, AI chip demand shows no signs of slowing",         source: "CNBC",        time: "6h ago", sentiment: "bullish", category: "Equities" },
  { title: "China's manufacturing PMI contracts for second consecutive month",                     source: "WSJ",         time: "7h ago", sentiment: "bearish", category: "Macro" },
  { title: "Ethereum staking rewards hit 4.2% APY as network utilization rises",                  source: "Decrypt",     time: "8h ago", sentiment: "bullish", category: "Crypto" },
  { title: "US CPI data comes in slightly above expectations at 3.5% YoY",                        source: "MarketWatch", time: "9h ago", sentiment: "bearish", category: "Macro" },
];

const ICT_ZONES: IctZone[] = [
  { concept: "Order Block (Bullish)",    description: "A strong institutional buying zone at previous resistance turned support. Price has respected this area 3 times, indicating significant buy-side liquidity.", level: "BTC ~$72,400–$73,200", direction: "bullish", icon: <Shield className="h-4 w-4" /> },
  { concept: "Fair Value Gap (FVG)",     description: "An unfilled price inefficiency gap left by rapid buying momentum. Price typically returns to fill these gaps before continuing the trend.",                  level: "BTC ~$74,800–$75,600", direction: "bullish", icon: <Layers className="h-4 w-4" /> },
  { concept: "Liquidity Pool (BSL)",     description: "Buy-side liquidity resting above recent swing highs at $77,500. Smart money likely targets this level to offload positions before reversal.",              level: "BTC ~$77,500",         direction: "neutral", icon: <Eye className="h-4 w-4" /> },
  { concept: "Break of Structure (BOS)", description: "Price has made a confirmed break of structure to the upside on the 4H timeframe, indicating a shift from distribution to accumulation phase.",            level: "BTC ~$76,000",         direction: "bullish", icon: <Crosshair className="h-4 w-4" /> },
  { concept: "Premium/Discount Zone",   description: "Current price sits in the premium zone (above 50% of the recent swing range). Optimal long entries are in the discount zone around $73,800–$74,500.",    level: "50% = ~$74,600",       direction: "neutral", icon: <Target className="h-4 w-4" /> },
  { concept: "Market Structure Shift",  description: "A lower timeframe (1H) market structure shift occurred, suggesting a potential short-term pullback before continuation of the higher timeframe trend.",   level: "Watch $75,400 support", direction: "bearish", icon: <Activity className="h-4 w-4" /> },
];

const ECON_EVENTS: EconEvent[] = [
  { time: "08:30", country: "USD", flag: "🇺🇸", event: "Core CPI (MoM)",         impact: "high",   forecast: "0.3%",   previous: "0.4%" },
  { time: "10:00", country: "USD", flag: "🇺🇸", event: "Fed Chair Powell Speech", impact: "high",   forecast: "—",      previous: "—" },
  { time: "12:30", country: "EUR", flag: "🇪🇺", event: "ECB Lagarde Speech",      impact: "medium", forecast: "—",      previous: "—" },
  { time: "14:00", country: "GBP", flag: "🇬🇧", event: "UK CPI (YoY)",            impact: "high",   forecast: "2.1%",   previous: "2.3%" },
  { time: "15:00", country: "USD", flag: "🇺🇸", event: "JOLTS Job Openings",      impact: "medium", forecast: "8.75M",  previous: "8.76M" },
  { time: "23:00", country: "JPY", flag: "🇯🇵", event: "Bank of Japan Minutes",   impact: "medium", forecast: "—",      previous: "—" },
];

/* ── micro components ─────────────────────────────────────────────── */
const SENT_CFG = {
  bullish: { color: "hsl(150,80%,55%)", bg: "rgba(52,211,153,0.09)",  border: "rgba(52,211,153,0.18)", icon: <TrendingUp className="h-3 w-3" />,  label: "Bullish" },
  bearish: { color: "hsl(0,78%,60%)",   bg: "rgba(239,68,68,0.09)",   border: "rgba(239,68,68,0.18)",  icon: <TrendingDown className="h-3 w-3" />, label: "Bearish" },
  neutral: { color: "hsl(38,95%,58%)",  bg: "rgba(245,158,11,0.09)",  border: "rgba(245,158,11,0.18)", icon: <Minus className="h-3 w-3" />,        label: "Neutral" },
};

function SentimentBadge({ sentiment, score }: { sentiment: Sentiment; score?: number }) {
  const c = SENT_CFG[sentiment];
  return (
    <span className="flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}>
      {c.icon}
      {c.label}
      {score !== undefined && <span className="opacity-65">· {score}</span>}
    </span>
  );
}

function SentimentGauge({ score }: { score: number }) {
  const color = score >= 60 ? "hsl(150,80%,52%)" : score >= 40 ? "hsl(38,95%,55%)" : "hsl(0,78%,58%)";
  const label = score >= 60 ? "Bullish" : score >= 40 ? "Neutral" : "Bearish";
  return (
    <div className="flex flex-col items-center gap-2 flex-shrink-0">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${2 * Math.PI * 40 * score / 100} ${2 * Math.PI * 40 * (1 - score / 100)}`}
            strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold font-mono" style={{ color }}>{score}</span>
          <span className="text-[8px] font-mono" style={{ color: "hsl(218,12%,42%)" }}>/100</span>
        </div>
      </div>
      <span className="text-xs font-mono font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

function MarketCard({ summary }: { summary: MarketSummary }) {
  const [expanded, setExpanded] = useState(false);
  const isUp = summary.change >= 0;
  const ICONS: Record<string, React.ReactNode> = {
    Crypto: <Bitcoin className="h-4 w-4" />, Forex: <Globe className="h-4 w-4" />,
    Equities: <BarChart2 className="h-4 w-4" />, Commodities: <DollarSign className="h-4 w-4" />,
  };
  const sentColor = SENT_CFG[summary.sentiment].color;

  return (
    <div
      className="rounded-2xl border p-4 flex flex-col gap-3 cursor-pointer transition-all duration-200"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.038), rgba(255,255,255,0.012))",
        borderColor: expanded ? `${sentColor}38` : "rgba(255,255,255,0.07)",
        boxShadow: expanded ? `0 0 20px ${sentColor}08` : "none",
      }}
      onClick={() => setExpanded(v => !v)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${sentColor}12`, border: `1px solid ${sentColor}28`, color: sentColor }}>
            {ICONS[summary.market]}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-mono font-semibold" style={{ color: "hsl(218,14%,78%)" }}>{summary.market}</p>
            <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: "hsl(218,12%,40%)" }}>{summary.headline}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <SentimentBadge sentiment={summary.sentiment} score={summary.score} />
          <span className="text-[11px] font-mono font-bold"
            style={{ color: isUp ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>
            {isUp ? "+" : ""}{summary.change.toFixed(2)}%
          </span>
        </div>
      </div>

      {expanded && (
        <div className="text-xs font-mono leading-relaxed rounded-xl px-3 py-3"
          style={{ background: "rgba(255,255,255,0.028)", color: "hsl(218,12%,55%)" }}>
          {summary.detail}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${summary.score}%`, background: `linear-gradient(90deg, ${sentColor}55, ${sentColor})` }} />
        </div>
        <span className="flex-shrink-0" style={{ color: "hsl(218,12%,36%)" }}>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function AiAssistant() {
  const [tab, setTab] = useState<"overview" | "news" | "ict" | "calendar">("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("Just now");

  const overallScore = Math.round(MARKET_SUMMARIES.reduce((s, m) => s + m.score, 0) / MARKET_SUMMARIES.length);

  function handleRefresh() {
    setIsRefreshing(true);
    setTimeout(() => { setIsRefreshing(false); setLastUpdate("Just now"); }, 1400);
  }

  const TABS = [
    { id: "overview" as const, label: "Overview",    icon: <Brain className="h-3.5 w-3.5 flex-shrink-0" /> },
    { id: "news"     as const, label: "News",         icon: <Newspaper className="h-3.5 w-3.5 flex-shrink-0" /> },
    { id: "ict"      as const, label: "ICT",          icon: <Target className="h-3.5 w-3.5 flex-shrink-0" /> },
    { id: "calendar" as const, label: "Calendar",     icon: <Clock className="h-3.5 w-3.5 flex-shrink-0" /> },
  ];

  const cardStyle = {
    background: "linear-gradient(145deg, rgba(255,255,255,0.038), rgba(255,255,255,0.012))",
    border: "1px solid rgba(255,255,255,0.07)",
    boxShadow: "0 4px 18px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
  };

  return (
    <div className="flex flex-col gap-4 pb-6">

      {/* Header */}
      <div
        className="rounded-2xl px-4 sm:px-5 py-4 border relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.09) 0%, rgba(59,130,246,0.04) 100%)",
          borderColor: "rgba(139,92,246,0.2)",
          boxShadow: "0 8px 36px rgba(0,0,0,0.3), 0 0 50px rgba(139,92,246,0.04)",
        }}
      >
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.1), transparent)" }} />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.28)" }}>
              <Brain className="h-5 w-5" style={{ color: "hsl(270,75%,72%)" }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: "hsl(218,16%,90%)" }}>
                AI Market Assistant
              </h1>
              <p className="text-xs font-mono" style={{ color: "hsl(218,12%,40%)" }}>
                Last updated: {lastUpdate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full"
              style={{ background: "rgba(34,197,94,0.09)", border: "1px solid rgba(34,197,94,0.18)", color: "hsl(150,75%,52%)" }}>
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "hsl(150,85%,50%)" }} />
              Live
            </span>
            <button
              onClick={handleRefresh}
              className="h-9 w-9 flex items-center justify-center rounded-xl transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <RefreshCw className={`h-4 w-4 transition-all ${isRefreshing ? "animate-spin" : ""}`}
                style={{ color: "hsl(218,12%,52%)" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 p-0.5 rounded-2xl"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.065)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] sm:text-xs font-mono rounded-xl transition-all"
            style={tab === t.id ? {
              background: "rgba(139,92,246,0.15)",
              color: "hsl(270,75%,72%)",
              border: "1px solid rgba(139,92,246,0.24)",
            } : { color: "hsl(218,12%,43%)", border: "1px solid transparent" }}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          {/* Sentiment gauge panel */}
          <div className="rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-5"
            style={cardStyle}>
            <SentimentGauge score={overallScore} />
            <div className="flex-1 text-center sm:text-left">
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "hsl(218,12%,36%)" }}>
                Overall Market Sentiment
              </p>
              <p className="text-sm font-mono leading-relaxed" style={{ color: "hsl(218,12%,58%)" }}>
                Markets are showing a{" "}
                <span style={{ color: "hsl(150,80%,55%)", fontWeight: 700 }}>moderately bullish</span>{" "}
                tone driven by crypto strength and commodity demand. USD strength is creating headwinds for risk assets.
              </p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                {["Risk-On", "BTC Dominant", "USD Strong", "Gold Bid"].map(tag => (
                  <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "hsl(218,12%,52%)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {MARKET_SUMMARIES.map(s => <MarketCard key={s.market} summary={s} />)}
          </div>
        </div>
      )}

      {/* ── News ── */}
      {tab === "news" && (
        <div className="flex flex-col gap-2">
          {NEWS_ITEMS.map((item, i) => (
            <div key={i} className="rounded-2xl border p-4 flex flex-col gap-2 transition-all" style={cardStyle}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-mono leading-relaxed flex-1" style={{ color: "hsl(218,14%,72%)" }}>
                  {item.title}
                </p>
                <SentimentBadge sentiment={item.sentiment} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "hsl(218,12%,43%)" }}>
                  {item.category}
                </span>
                <span className="text-[10px] font-mono" style={{ color: "hsl(218,12%,34%)" }}>
                  {item.source} · {item.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ICT Analysis ── */}
      {tab === "ict" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-xl px-4 py-3"
            style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "hsl(38,95%,58%)" }} />
            <p className="text-[11px] font-mono leading-relaxed" style={{ color: "hsl(38,95%,58%)" }}>
              AI-generated ICT analysis for educational purposes only. Not financial advice.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {ICT_ZONES.map((zone, i) => {
              const sentColor = SENT_CFG[zone.direction].color;
              return (
                <div key={i} className="rounded-2xl border p-4 flex flex-col gap-3" style={cardStyle}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${sentColor}12`, border: `1px solid ${sentColor}28`, color: sentColor }}>
                        {zone.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-semibold" style={{ color: "hsl(218,14%,78%)" }}>{zone.concept}</p>
                        {zone.level && <p className="text-[10px] font-mono" style={{ color: sentColor }}>{zone.level}</p>}
                      </div>
                    </div>
                    <SentimentBadge sentiment={zone.direction} />
                  </div>
                  <p className="text-[11px] font-mono leading-relaxed" style={{ color: "hsl(218,12%,50%)" }}>
                    {zone.description}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="rounded-2xl border p-5"
            style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.06), rgba(59,130,246,0.03))", borderColor: "rgba(52,211,153,0.18)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4" style={{ color: "hsl(150,80%,58%)" }} />
              <p className="text-xs font-mono font-bold" style={{ color: "hsl(150,80%,62%)" }}>AI Directional Bias</p>
            </div>
            <p className="text-xs font-mono leading-relaxed" style={{ color: "hsl(218,12%,60%)" }}>
              Based on ICT concepts, the higher-timeframe bias remains{" "}
              <span style={{ color: "hsl(150,80%,58%)", fontWeight: 700 }}>bullish</span>.
              Price is trading above equilibrium of the recent macro range. Key decision point: a sweep of the $75,400 MSS level would offer a high-probability long entry targeting the $77,500 BSL zone.
            </p>
          </div>
        </div>
      )}

      {/* ── Economic Calendar ── */}
      {tab === "calendar" && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-mono uppercase tracking-widest px-1" style={{ color: "hsl(218,12%,36%)" }}>
            Today's High-Impact Events
          </p>
          <div className="flex flex-col gap-2">
            {ECON_EVENTS.map((ev, i) => {
              const impactColor = ev.impact === "high" ? "hsl(0,78%,60%)" : ev.impact === "medium" ? "hsl(38,95%,58%)" : "hsl(150,80%,55%)";
              return (
                <div key={i} className="rounded-2xl border px-4 py-3 flex items-center gap-3" style={cardStyle}>
                  <div className="flex-shrink-0 text-center" style={{ minWidth: "42px" }}>
                    <p className="text-xs font-mono font-bold" style={{ color: "hsl(210,90%,65%)" }}>{ev.time}</p>
                    <p className="text-[10px] font-mono" style={{ color: "hsl(218,12%,36%)" }}>{ev.country}</p>
                  </div>
                  <span className="text-base flex-shrink-0">{ev.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono truncate" style={{ color: "hsl(218,14%,75%)" }}>{ev.event}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex gap-0.5">
                        {["low", "medium", "high"].map((l, idx) => (
                          <div key={l} className="h-1.5 w-1.5 rounded-full"
                            style={{ background: ["low", "medium", "high"].indexOf(ev.impact) >= idx ? impactColor : "rgba(255,255,255,0.1)" }} />
                        ))}
                      </div>
                      <span className="text-[10px] font-mono capitalize"
                        style={{ color: impactColor }}>{ev.impact}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] font-mono" style={{ color: "hsl(218,12%,36%)" }}>Forecast</p>
                    <p className="text-xs font-mono font-bold" style={{ color: "hsl(210,90%,65%)" }}>{ev.forecast}</p>
                    <p className="text-[10px] font-mono" style={{ color: "hsl(218,12%,34%)" }}>Prev: {ev.previous}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
