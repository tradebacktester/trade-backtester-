import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { Link } from "wouter";
import { Lock } from "lucide-react";
import {
  Brain, TrendingUp, TrendingDown, Minus, Globe, Bitcoin, BarChart2, DollarSign,
  Clock, AlertTriangle, Target, Layers, RefreshCw, Newspaper, Shield, Eye, Crosshair,
  Activity, ChevronDown, ChevronUp, MessageCircle, Send, Bot, User,
  BookOpen, Zap, ArrowUp, ArrowDown, Info, ChevronRight, Compass,
} from "lucide-react";
import { API_BASE } from "@/lib/api-config";

type Sentiment = "bullish" | "bearish" | "neutral";
type Tab = "overview" | "news" | "ict" | "calendar" | "chat" | "bias" | "coach";
type Impact = "high" | "medium" | "low";
type IctCategory = "all" | "structure" | "liquidity" | "smart_money" | "concepts";

interface MarketCard {
  id: string; icon: React.ElementType; label: string;
  score: number; sentiment: Sentiment; headline: string; detail: string; change: number;
}
interface NewsItem {
  title: string; source: string; time: string; sentiment: Sentiment; category: string;
}
interface IctConcept {
  id: string;
  concept: string;
  short: string;
  category: IctCategory;
  direction: Sentiment;
  icon: React.ElementType;
  level: string;
  timeframe: string;
  description: string;
  detail: string;
  keyRule: string;
}
interface EconEvent {
  time: string; flag: string; country: string; event: string; impact: Impact; forecast: string; previous: string;
}
interface ChatMsg { role: "user" | "assistant"; content: string; }

const BLUE = "#FFFFFF";
const BLUE_BG = "var(--glass-bg)";
const BLUE_BD = "var(--glass-border)";

const SENT: Record<Sentiment, { color: string; label: string; Icon: React.ElementType }> = {
  bullish: { color: "#4ade80", label: "Bullish", Icon: TrendingUp },
  bearish: { color: "#f87171", label: "Bearish", Icon: TrendingDown },
  neutral: { color: "#facc15", label: "Neutral",  Icon: Minus },
};

const ICT_CATEGORIES: { id: IctCategory; label: string; color: string }[] = [
  { id: "all",         label: "All Concepts",    color: "#D4D4D8" },
  { id: "structure",   label: "Market Structure", color: "#a855f7" },
  { id: "liquidity",   label: "Liquidity",        color: "#f59e0b" },
  { id: "smart_money", label: "Smart Money",      color: "#10b981" },
  { id: "concepts",    label: "Price Action",     color: "#ec4899" },
];

const ICT_CONCEPTS: IctConcept[] = [
  {
    id: "ob",
    concept: "Order Block",
    short: "OB",
    category: "smart_money",
    direction: "bullish",
    icon: Shield,
    level: "BTC $72,400 – $73,200",
    timeframe: "4H",
    description: "The last down-candle before a strong institutional impulse move higher. Represents a zone where smart money placed large buy orders.",
    detail: "An Order Block forms when institutional traders place a large concentration of orders in a specific zone. Price often returns to these areas to 'fill' remaining orders before continuing. A bullish OB is the last bearish candle before a significant bullish move.",
    keyRule: "Enter longs when price returns to the OB zone, with stop below the OB low."
  },
  {
    id: "fvg",
    concept: "Fair Value Gap",
    short: "FVG",
    category: "concepts",
    direction: "bullish",
    icon: Layers,
    level: "BTC $74,800 – $75,600",
    timeframe: "1H",
    description: "A 3-candle imbalance where candle 1's high and candle 3's low don't overlap, leaving an unfilled inefficiency in price.",
    detail: "Fair Value Gaps represent price inefficiencies created by rapid moves. The market tends to revisit these zones as institutions seek to transact at more balanced prices. Bullish FVGs (below current price) act as support; bearish FVGs (above) act as resistance.",
    keyRule: "Price typically returns to fill 50% or more of the FVG before resuming the trend."
  },
  {
    id: "bsl",
    concept: "Buy-Side Liquidity",
    short: "BSL",
    category: "liquidity",
    direction: "neutral",
    icon: Eye,
    level: "BTC $77,500",
    timeframe: "Daily",
    description: "Clusters of buy-stop orders resting above swing highs. Smart money drives price up to trigger these stops and sell into the buying.",
    detail: "Retail traders place stop-losses above swing highs on short positions. This creates a pool of buy orders (BSL) that institutions target to fill large sell orders. When price sweeps BSL, expect a reversal after the sweep — the 'stop hunt' is complete.",
    keyRule: "After a BSL sweep, look for a Market Structure Shift (MSS) to enter short."
  },
  {
    id: "ssl",
    concept: "Sell-Side Liquidity",
    short: "SSL",
    category: "liquidity",
    direction: "neutral",
    icon: Target,
    level: "BTC $71,200",
    timeframe: "Daily",
    description: "Clusters of sell-stop orders resting below swing lows. Smart money drives price down to trigger these stops and buy into the selling.",
    detail: "Long positions with stops below swing lows create sell-side liquidity pools (SSL). Institutions target these areas to accumulate positions cheaply. A SSL sweep followed by a bullish reversal is one of the highest-probability ICT setups.",
    keyRule: "After a SSL sweep and MSS confirmation, enter long with target at the next BSL pool."
  },
  {
    id: "bos",
    concept: "Break of Structure",
    short: "BOS",
    category: "structure",
    direction: "bullish",
    icon: Crosshair,
    level: "BTC $76,000",
    timeframe: "4H",
    description: "A confirmed break of a prior swing high (bullish) or swing low (bearish), confirming the current trend direction.",
    detail: "A BOS occurs when price makes a decisive close beyond the previous swing point, confirming that the market has changed its direction or is continuing the prevailing trend. In an uptrend, each BOS creates a new 'last low' that serves as support. BOS is different from MSS — BOS confirms trend continuation, MSS signals reversal.",
    keyRule: "Trade in the direction of BOS. After a bullish BOS, only look for buy setups until a bearish MSS forms."
  },
  {
    id: "mss",
    concept: "Market Structure Shift",
    short: "MSS",
    category: "structure",
    direction: "bearish",
    icon: Activity,
    level: "Watch $75,400",
    timeframe: "1H",
    description: "A lower-timeframe candle close that breaks the opposite side of structure, signaling a potential trend reversal.",
    detail: "An MSS is a key reversal signal in ICT methodology. It occurs when price, after sweeping liquidity, makes a decisive break in the opposite direction. A bearish MSS after a BSL sweep (price takes out swing highs then drops) is a high-probability short setup. Confirmation comes with a close below the previous swing low.",
    keyRule: "MSS must follow a liquidity sweep. Without a prior sweep, it is just a normal pullback."
  },
  {
    id: "pd",
    concept: "Premium / Discount",
    short: "P/D",
    category: "concepts",
    direction: "neutral",
    icon: Compass,
    level: "Equilibrium ~$74,600",
    timeframe: "All TFs",
    description: "The 50% level of any price range divides premium (above) from discount (below). Buy in discount, sell in premium.",
    detail: "ICT teaches traders to only buy when price is in the discount zone (below 50% of the range) and sell in premium (above 50%). This aligns with how institutions accumulate at value and distribute at high prices. The Fibonacci 0.5 level is the equilibrium. Optimal entry zones are 0.62–0.79 (discount) or -0.27 to -0.62 (premium for shorts).",
    keyRule: "Never buy in premium or sell in discount. Wait for price to retrace to the opposing side of the range."
  },
  {
    id: "mmt",
    concept: "Optimal Trade Entry",
    short: "OTE",
    category: "smart_money",
    direction: "bullish",
    icon: Zap,
    level: "Fib 0.62–0.79 zone",
    timeframe: "All TFs",
    description: "The 62–79% retracement zone of a previous swing, used by ICT traders as the highest-probability entry area.",
    detail: "The OTE is based on the Fibonacci retracement drawn from a swing low to a swing high (for longs). Price retracing into the 0.62–0.79 Fibonacci zone, combined with a Fair Value Gap, Order Block, or Breaker Block within that zone, creates the highest-probability entry in ICT trading. The OTE rejects the notion of entering on breakouts.",
    keyRule: "Draw fib from recent swing low to swing high. Enter longs only when price returns to the 0.62–0.79 zone."
  },
  {
    id: "bb",
    concept: "Breaker Block",
    short: "BB",
    category: "smart_money",
    direction: "bearish",
    icon: Shield,
    level: "BTC $76,800 – $77,200",
    timeframe: "4H",
    description: "A failed Order Block that price has traded through, converting from support to resistance (or vice versa).",
    detail: "When an Order Block fails to hold and price runs through it to take out liquidity on the other side, that OB becomes a Breaker Block. A bearish Breaker Block (former bullish OB that failed) will act as resistance when price returns to it. These are high-probability reversal zones because institutions are now on the other side.",
    keyRule: "Enter on the return to the Breaker Block zone with confirmation of rejection (bearish engulfing / MSS)."
  },
  {
    id: "pd_arr",
    concept: "Power of 3 (AMD)",
    short: "PO3",
    category: "concepts",
    direction: "neutral",
    icon: BookOpen,
    level: "Intraday — Asian / London / NY",
    timeframe: "Intraday",
    description: "Accumulation → Manipulation → Distribution. The three-phase model that describes intraday price behavior.",
    detail: "ICT's Power of 3 (PO3) describes how price moves in three stages daily: Accumulation (ranging in Asia session), Manipulation (false breakout in London open, sweeping retail stops), and Distribution (the real move in New York session). Understanding PO3 helps traders avoid the London manipulation trap and trade the NY distribution with the smart money.",
    keyRule: "Wait for the London session manipulation sweep before entering in the direction of the true NY move."
  },
];

const KEY_LEVELS = [
  { label: "Major Resistance", value: "$78,400", type: "resist" },
  { label: "BSL Pool",         value: "$77,500", type: "resist" },
  { label: "Current Price",    value: "$76,100", type: "current" },
  { label: "FVG Midpoint",     value: "$75,200", type: "support" },
  { label: "OB (4H)",          value: "$73,000", type: "support" },
  { label: "Major Support",    value: "$71,200", type: "support" },
];

const MARKETS: MarketCard[] = [
  { id: "crypto",      icon: Bitcoin,   label: "Crypto",      score: 72, sentiment: "bullish", change: 2.34,  headline: "Bitcoin breaks above key $76K resistance",      detail: "BTC has broken through the $76,000 resistance zone with strong volume confirmation. ETH follows with higher lows. Altcoins are rotating bullishly with SOL and INJ leading gains." },
  { id: "forex",       icon: Globe,     label: "Forex",       score: 38, sentiment: "bearish", change: -0.45, headline: "USD strengthens on hawkish Fed rhetoric",         detail: "The US Dollar Index (DXY) continues higher after Fed officials signaled fewer rate cuts in 2025. EUR/USD approached 1.0450 support, GBP/USD rejected from 1.2700." },
  { id: "equities",    icon: BarChart2, label: "Equities",    score: 51, sentiment: "neutral", change: 0.12,  headline: "S&P 500 consolidates near all-time highs",        detail: "Major US indices are in a tight consolidation range. Tech (QQQ) showing relative strength while energy lags. Watch for breakout above SPX 5,300." },
  { id: "commodities", icon: DollarSign,label: "Commodities", score: 64, sentiment: "bullish", change: 0.87,  headline: "Gold holds $2,300 amid geopolitical risk",        detail: "XAU/USD maintaining strong bids above the $2,300 psychological level as geopolitical tensions keep safe-haven demand elevated. Oil (WTI) consolidates near $82." },
];

const NEWS: NewsItem[] = [
  { title: "Federal Reserve signals rate cuts could be delayed until Q3 2025",        source: "Reuters",      time: "2h ago",  sentiment: "bearish", category: "Macro" },
  { title: "Bitcoin ETF inflows hit new weekly record of $1.2B as demand surges",     source: "CoinDesk",     time: "3h ago",  sentiment: "bullish", category: "Crypto" },
  { title: "OPEC+ reaffirms production cut agreement through end of 2025",            source: "Bloomberg",    time: "4h ago",  sentiment: "bullish", category: "Commodities" },
  { title: "ECB holds rates steady, signals June cut still on the table",             source: "FT",           time: "5h ago",  sentiment: "neutral", category: "Forex" },
  { title: "NVIDIA reports record Q1 earnings, AI chip demand shows no sign of slowing", source: "CNBC",     time: "6h ago",  sentiment: "bullish", category: "Equities" },
  { title: "China's manufacturing PMI contracts for second consecutive month",        source: "WSJ",          time: "7h ago",  sentiment: "bearish", category: "Macro" },
  { title: "Ethereum staking rewards hit 4.2% APY as network utilization rises",     source: "Decrypt",      time: "8h ago",  sentiment: "bullish", category: "Crypto" },
  { title: "US CPI data comes in slightly above expectations at 3.5% YoY",           source: "MarketWatch",  time: "9h ago",  sentiment: "bearish", category: "Macro" },
];

const ECON_EVENTS: EconEvent[] = [
  { time: "08:30", flag: "🇺🇸", country: "USD", event: "Core CPI (MoM)",         impact: "high",   forecast: "0.3%",  previous: "0.4%" },
  { time: "10:00", flag: "🇺🇸", country: "USD", event: "Fed Chair Powell Speech", impact: "high",   forecast: "—",     previous: "—"    },
  { time: "12:30", flag: "🇪🇺", country: "EUR", event: "ECB Lagarde Speech",      impact: "medium", forecast: "—",     previous: "—"    },
  { time: "14:00", flag: "🇬🇧", country: "GBP", event: "UK CPI (YoY)",           impact: "high",   forecast: "2.1%",  previous: "2.3%" },
  { time: "15:00", flag: "🇺🇸", country: "USD", event: "JOLTS Job Openings",      impact: "medium", forecast: "8.75M", previous: "8.76M" },
  { time: "23:00", flag: "🇯🇵", country: "JPY", event: "Bank of Japan Minutes",   impact: "medium", forecast: "—",     previous: "—"    },
];

const SUGGESTED_QUESTIONS = [
  "What is a moving average crossover strategy?",
  "Explain risk/reward ratio in trading",
  "What are Bollinger Bands and how do I use them?",
  "How does RSI divergence work?",
  "What is the difference between SMA and EMA?",
];

/* ─── Reusable UI ─────────────────────────────────────────── */
function SentBadge({ s, score }: { s: Sentiment; score?: number }) {
  const { color, label, Icon } = SENT[s];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
      style={{ color, background: `${color}12`, border: `1px solid ${color}30` }}>
      <Icon className="h-2.5 w-2.5 flex-shrink-0" />
      {label}{score !== undefined && <span className="opacity-50 ml-0.5">· {score}</span>}
    </span>
  );
}

function Card({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl ${className}`}
      style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)", ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))" }}>{children}</p>;
}

/* ─── Overview components ─────────────────────────────────── */
function MarketCardComp({ card }: { card: MarketCard }) {
  const [open, setOpen] = useState(false);
  const { color } = SENT[card.sentiment];
  const up = card.change >= 0;
  return (
    <Card>
      <div className="p-4 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <card.icon className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{card.label}</p>
              <p className="text-[11px] truncate mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{card.headline}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <SentBadge s={card.sentiment} score={card.score} />
            <span className="text-[11px] font-mono font-bold" style={{ color: up ? "#4ade80" : "#f87171" }}>
              {up ? "+" : ""}{card.change.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="h-1 w-full rounded-full mt-3" style={{ background: "var(--glass-border)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${card.score}%`, background: color, boxShadow: `0 0 6px ${color}80` }} />
        </div>
        {open && (
          <p className="text-[12px] leading-relaxed mt-3 rounded-xl px-3 py-2.5"
            style={{ background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", borderLeft: `3px solid ${color}` }}>
            {card.detail}
          </p>
        )}
        <div className="flex justify-end mt-2">
          {open ? <ChevronUp className="h-3.5 w-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
                : <ChevronDown className="h-3.5 w-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />}
        </div>
      </div>
    </Card>
  );
}

function NewsCardComp({ item }: { item: NewsItem }) {
  return (
    <Card>
      <div className="p-4">
        <div className="flex items-start gap-3 mb-2.5">
          <p className="text-[13px] leading-relaxed flex-1" style={{ color: "hsl(var(--foreground))" }}>{item.title}</p>
          <SentBadge s={item.sentiment} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
            style={{ background: BLUE_BG, border: `1px solid ${BLUE_BD}`, color: BLUE }}>{item.category}</span>
          <span className="text-[10px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{item.source} · {item.time}</span>
        </div>
      </div>
    </Card>
  );
}

function EconRow({ ev }: { ev: EconEvent }) {
  const ICOL: Record<Impact, string> = { high: "#f87171", medium: "#facc15", low: "#4ade80" };
  const color = ICOL[ev.impact];
  return (
    <Card>
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-shrink-0 w-12 text-center">
          <p className="text-[13px] font-mono font-bold" style={{ color: "hsl(var(--foreground))" }}>{ev.time}</p>
          <p className="text-[10px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{ev.country}</p>
        </div>
        <span className="text-base flex-shrink-0">{ev.flag}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] truncate" style={{ color: "hsl(var(--foreground))" }}>{ev.event}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex gap-0.5">
              {(["low", "medium", "high"] as Impact[]).map((l, i) => (
                <div key={l} className="h-1.5 w-1.5 rounded-full"
                  style={{ background: (["low", "medium", "high"] as Impact[]).indexOf(ev.impact) >= i ? color : "var(--glass-border)" }} />
              ))}
            </div>
            <span className="text-[10px] font-mono capitalize" style={{ color }}>{ev.impact}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-[11px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}><span className="opacity-40">F </span>{ev.forecast}</p>
          <p className="text-[11px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}><span className="opacity-40">P </span>{ev.previous}</p>
        </div>
      </div>
    </Card>
  );
}

/* ─── ICT Components ──────────────────────────────────────── */
function IctConceptCard({ concept }: { concept: IctConcept }) {
  const [expanded, setExpanded] = useState(false);
  const { color: dirColor } = SENT[concept.direction];
  const cat = ICT_CATEGORIES.find(c => c.id === concept.category) ?? ICT_CATEGORIES[0]!;

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>

      {/* Header */}
      <button className="w-full text-left p-4" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${cat.color}12`, border: `1px solid ${cat.color}25` }}>
            <concept.icon className="h-4.5 w-4.5" style={{ color: cat.color, height: 18, width: 18 }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[14px] font-bold" style={{ color: "hsl(var(--foreground))" }}>{concept.concept}</span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: `${cat.color}15`, color: cat.color }}>{concept.short}</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md"
                style={{ background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
                {concept.timeframe}
              </span>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>{concept.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-2">
            <SentBadge s={concept.direction} />
            {expanded
              ? <ChevronUp className="h-3.5 w-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
              : <ChevronDown className="h-3.5 w-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />}
          </div>
        </div>

        {/* Level bar */}
        <div className="mt-3 flex items-center gap-2.5">
          {concept.direction === "bullish"
            ? <ArrowUp className="h-3 w-3 flex-shrink-0" style={{ color: dirColor }} />
            : concept.direction === "bearish"
              ? <ArrowDown className="h-3 w-3 flex-shrink-0" style={{ color: dirColor }} />
              : <Minus className="h-3 w-3 flex-shrink-0" style={{ color: dirColor }} />}
          <span className="text-[11px] font-mono font-semibold" style={{ color: dirColor }}>{concept.level}</span>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--glass-border)" }}>
          <div className="p-4 space-y-3">
            <p className="text-[12px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>{concept.detail}</p>
            <div className="rounded-xl px-3.5 py-3 flex items-start gap-2.5"
              style={{ background: `${cat.color}08`, border: `1px solid ${cat.color}20` }}>
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: cat.color }} />
              <div>
                <p className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: cat.color }}>Key Rule</p>
                <p className="text-[12px] leading-relaxed font-medium" style={{ color: "hsl(var(--foreground))" }}>{concept.keyRule}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IctTab() {
  const [activeCategory, setActiveCategory] = useState<IctCategory>("all");

  const filtered = activeCategory === "all"
    ? ICT_CONCEPTS
    : ICT_CONCEPTS.filter(c => c.category === activeCategory);

  const htfBias = "bullish" as Sentiment;
  const htfColor = SENT[htfBias].color;

  return (
    <div className="flex flex-col gap-4">

      {/* Disclaimer */}
      <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
        style={{ background: "rgba(217,119,6,0.07)", border: "1px solid rgba(217,119,6,0.2)" }}>
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#facc15" }} />
        <p className="text-[12px] leading-relaxed" style={{ color: "#facc15" }}>
          ICT analysis below is <strong>educational only</strong> and AI-generated. Levels are illustrative, not live data. Not financial advice.
        </p>
      </div>

      {/* HTF Bias Summary */}
      <Card>
        <div className="p-5 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(ellipse 80% 60% at 0% 100%, ${htfColor}08 0%, transparent 60%)` }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4" style={{ color: BLUE }} />
              <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Higher-Timeframe Bias</span>
              <SentBadge s={htfBias} />
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: "hsl(var(--foreground))" }}>
              Price trading <strong style={{ color: htfColor }}>above the weekly equilibrium</strong> at $74,600. The macro range shows a clear BOS on the daily timeframe. Smart money bias is long until price sweeps BSL at $77,500 and forms a bearish MSS.
            </p>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: "Weekly Bias",  value: "Bullish",   color: "#4ade80" },
                { label: "Daily Bias",   value: "Bullish",   color: "#4ade80" },
                { label: "4H Structure", value: "Pullback",  color: "#facc15" },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-3 text-center"
                  style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                  <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>{item.label}</p>
                  <p className="text-[14px] font-bold" style={{ color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Key Levels */}
      <div>
        <SectionLabel>Key Levels — BTC/USD</SectionLabel>
        <div className="mt-2 rounded-2xl overflow-hidden"
          style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>
          {KEY_LEVELS.map((level, i) => {
            const isResist  = level.type === "resist";
            const isSupport = level.type === "support";
            const isCurrent = level.type === "current";
            const color = isCurrent ? BLUE : isResist ? "#f87171" : "#4ade80";
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5"
                style={{ borderBottom: i < KEY_LEVELS.length - 1 ? "1px solid var(--glass-border)" : "none", background: isCurrent ? `${BLUE}07` : "transparent" }}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
                <span className="text-[12px] flex-1" style={{ color: "hsl(var(--muted-foreground))" }}>{level.label}</span>
                <span className="text-[13px] font-mono font-bold" style={{ color }}>{level.value}</span>
                {isResist  && <ArrowUp className="h-3 w-3 flex-shrink-0" style={{ color: "#f87171" }} />}
                {isSupport && <ArrowDown className="h-3 w-3 flex-shrink-0" style={{ color: "#4ade80" }} />}
                {isCurrent && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: `${BLUE}15`, color: BLUE, border: `1px solid ${BLUE}25` }}>NOW</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Category filter */}
      <div>
        <SectionLabel>ICT Concepts Library</SectionLabel>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-wrap">
          {ICT_CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
              style={activeCategory === cat.id
                ? { background: cat.color, color: "#050505", boxShadow: `0 0 12px ${cat.color}40` }
                : { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
              {cat.label}
              <span className="ml-1.5 text-[10px] opacity-70">
                {cat.id === "all" ? ICT_CONCEPTS.length : ICT_CONCEPTS.filter(c => c.category === cat.id).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Concept cards */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
            <BookOpen className="h-8 w-8 mx-auto mb-3" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.3 }} />
            <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>No concepts in this category yet.</p>
          </div>
        ) : (
          filtered.map(c => <IctConceptCard key={c.id} concept={c} />)
        )}
      </div>

      {/* Learn more note */}
      <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: BLUE }} />
        <p className="text-[12px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
          ICT (Inner Circle Trader) concepts were popularized by Michael J. Huddleston. These concepts describe how institutional order flow creates liquidity, imbalances, and structure in the market. All levels shown are AI-generated examples for education.
        </p>
      </div>
    </div>
  );
}

/* ─── Chat Panel ──────────────────────────────────────────── */
function ChatPanel({ token }: { token: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput(""); setError("");
    const newMessages: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Failed to get a response.");
      else setMessages(m => [...m, { role: "assistant", content: data.message }]);
    } catch { setError("Network error. Please check your connection."); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.length === 0 && (
        <Card>
          <div className="p-6 flex flex-col items-center gap-4 text-center relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 70%)" }} />
            <div className="relative h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <Brain className="h-7 w-7" style={{ color: BLUE }} />
            </div>
            <div className="relative">
              <p className="text-[14px] font-bold" style={{ color: "hsl(var(--foreground))" }}>AI Trading Assistant</p>
              <p className="text-[12px] mt-1 max-w-xs mx-auto leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                Ask anything about trading strategies, technical analysis, risk management, or market concepts.
              </p>
            </div>
          </div>
        </Card>
      )}

      {messages.length === 0 && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Suggested Questions</SectionLabel>
          {SUGGESTED_QUESTIONS.map(q => (
            <button key={q} onClick={() => sendMessage(q)}
              className="text-left px-4 py-2.5 rounded-xl text-[13px] transition-all"
              style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--muted-foreground))" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = BLUE_BD; e.currentTarget.style.color = BLUE; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--glass-border)"; e.currentTarget.style.color = "hsl(var(--muted-foreground))"; }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                style={msg.role === "user"
                  ? { background: BLUE, border: "1px solid rgba(255,255,255,0.18)" }
                  : { background: BLUE_BG, border: `1px solid ${BLUE_BD}` }}>
                {msg.role === "user"
                  ? <User className="h-3.5 w-3.5" style={{ color: "#050505" }} />
                  : <Bot className="h-3.5 w-3.5" style={{ color: BLUE }} />}
              </div>
              <div className="rounded-2xl px-4 py-3 max-w-[85%] text-[13px] leading-relaxed"
                style={msg.role === "user"
                  ? { background: BLUE, color: "#050505", fontWeight: 600, borderBottomRightRadius: 4 }
                  : { background: "var(--card-bg)", color: "hsl(var(--foreground))", border: "1px solid var(--glass-border)", borderBottomLeftRadius: 4 }}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                style={{ background: BLUE_BG, border: `1px solid ${BLUE_BD}` }}>
                <Bot className="h-3.5 w-3.5" style={{ color: BLUE }} />
              </div>
              <div className="rounded-2xl px-4 py-3 flex items-center gap-1.5"
                style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
                <span className="h-1.5 w-1.5 rounded-full live-pulse" style={{ background: BLUE }} />
                <span className="text-[11px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>Thinking…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-[12px]"
          style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", color: "#f87171" }}>
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      <Card>
        <div className="p-2 flex items-end gap-2">
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask about trading, strategies, or market concepts… (Enter to send)"
            rows={1} disabled={loading}
            className="flex-1 resize-none px-3 py-2 text-[13px] outline-none rounded-xl bg-transparent"
            style={{ color: "hsl(var(--foreground))", minHeight: 40, maxHeight: 120 }}
            onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }} />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
            className="h-9 w-9 flex items-center justify-center rounded-xl flex-shrink-0 disabled:opacity-30 transition-all"
            style={{ background: BLUE, color: "#050505" }}>
            <Send className="h-4 w-4" />
          </button>
        </div>
      </Card>
      <p className="text-[10px] text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
        AI responses are for educational purposes only. Not financial advice.
      </p>
    </div>
  );
}

/* ─── Bias Panel ──────────────────────────────────────────── */
interface BiasItem { name: string; severity: "low" | "medium" | "high"; description: string; evidence: string; tip: string; }
interface BiasReport { score: number; summary: string; biases: BiasItem[]; }

const SEV_COLOR = { low: "#16a34a", medium: "#d97706", high: "#dc2626" };
const SEV_BG    = { low: "rgba(22,163,74,0.09)", medium: "rgba(217,119,6,0.09)", high: "rgba(220,38,38,0.09)" };

function BiasPanel({ token }: { token: string }) {
  const [report, setReport] = useState<BiasReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [bpError, setBpError] = useState<string | null>(null);

  function readPaperTrades() {
    try {
      const raw = localStorage.getItem("pt_trades");
      if (!raw) return [];
      const allTrades = JSON.parse(raw) as Array<{ status: string; pnl?: number | null; exitPrice?: number | null; entryPrice: number; openedAt: string; closedAt?: string | null; side: string; }>;
      return allTrades.filter(t => t.status === "closed" && t.pnl != null).map(t => {
        const pnl = Number(t.pnl ?? 0);
        const pnlPct = t.entryPrice > 0 ? ((Number(t.exitPrice ?? t.entryPrice) - t.entryPrice) / t.entryPrice) * 100 * (t.side === "short" ? -1 : 1) : 0;
        const openMs = new Date(t.openedAt).getTime();
        const closeMs = t.closedAt ? new Date(t.closedAt).getTime() : openMs;
        return { isWin: pnl > 0, pnlPct, holdingHours: (closeMs - openMs) / 3600000, side: t.side };
      });
    } catch { return []; }
  }

  async function handleAnalyze() {
    const trades = readPaperTrades();
    if (trades.length < 3) { setBpError("You need at least 3 closed paper trades. Head to the Demo page and make some trades first."); return; }
    setLoading(true); setBpError(null); setReport(null);
    try {
      const resp = await fetch(`${API_BASE}/api/ai/bias-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ trades }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Failed to generate report");
      setReport(data as BiasReport);
    } catch (e: unknown) {
      setBpError(e instanceof Error ? e.message : "Analysis failed");
    } finally { setLoading(false); }
  }

  const tradeCount = readPaperTrades().length;
  const scoreColor = report ? (report.score >= 75 ? "#4ade80" : report.score >= 50 ? "#facc15" : "#f87171") : "hsl(var(--muted-foreground))";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="p-5 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4" style={{ color: BLUE }} />
              <p className="font-bold text-[15px]" style={{ color: "hsl(var(--foreground))" }}>Behavioral Bias Detector</p>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
              AI analyzes your paper trading history to detect cognitive biases — revenge trading, FOMO, cutting winners early.
            </p>
            <p className="text-[11px] font-mono mt-2" style={{ color: "hsl(var(--muted-foreground))" }}>
              {tradeCount} closed paper trade{tradeCount !== 1 ? "s" : ""} available
            </p>
          </div>
          <button onClick={handleAnalyze} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold flex-shrink-0 disabled:opacity-60 transition-all"
            style={{ background: loading ? "var(--glass-bg)" : BLUE, color: loading ? "hsl(var(--muted-foreground))" : "#050505", border: `1px solid ${loading ? "var(--glass-border)" : "rgba(255,255,255,0.18)"}`, boxShadow: loading ? "none" : "0 0 20px rgba(255,255,255,0.08)" }}>
            {loading ? <><RefreshCw className="h-4 w-4 animate-spin" />Analyzing…</> : <><Shield className="h-4 w-4" />{report ? "Re-analyze" : "Analyze My Trading"}</>}
          </button>
        </div>
      </Card>

      {bpError && (
        <div className="flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)" }}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#f87171" }} />
          <p className="text-[13px]" style={{ color: "#f87171" }}>{bpError}</p>
        </div>
      )}

      {loading && (
        <Card>
          <div className="p-5 space-y-3 animate-pulse">
            <div className="h-4 w-24 rounded-lg" style={{ background: "var(--glass-bg)" }} />
            <div className="h-3 w-full rounded-lg" style={{ background: "var(--glass-bg)" }} />
            <div className="h-3 w-4/5 rounded-lg" style={{ background: "var(--glass-bg)" }} />
          </div>
        </Card>
      )}

      {report && !loading && (
        <>
          <Card>
            <div className="p-5 flex items-center gap-5">
              <div className="h-20 w-20 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
                style={{ background: `${scoreColor}18`, border: `2px solid ${scoreColor}55` }}>
                <span className="text-2xl font-bold font-mono" style={{ color: scoreColor }}>{report.score}</span>
                <span className="text-[9px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>/100</span>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold mb-1" style={{ color: scoreColor }}>
                  {report.score >= 75 ? "Disciplined Trader" : report.score >= 50 ? "Some Biases Detected" : "Significant Biases Found"}
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>{report.summary}</p>
              </div>
            </div>
          </Card>
          {report.biases.map((bias, i) => {
            const col = SEV_COLOR[bias.severity];
            const bg  = SEV_BG[bias.severity];
            return (
              <Card key={i}>
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-[14px]" style={{ color: "hsl(var(--foreground))" }}>{bias.name}</p>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: bg, color: col, border: `1px solid ${col}44` }}>{bias.severity} severity</span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>{bias.description}</p>
                  <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                    <p className="text-[10px] font-mono uppercase tracking-wide mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Evidence from your trades</p>
                    <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>{bias.evidence}</p>
                  </div>
                  <div className="flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: bg, border: `1px solid ${col}33` }}>
                    <Target className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: col }} />
                    <p className="text-[12px]" style={{ color: col }}>{bias.tip}</p>
                  </div>
                </div>
              </Card>
            );
          })}
          <p className="text-[11px] font-mono text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
            Analysis by Llama 3.3 70B · Based on paper trading history · Not financial advice
          </p>
        </>
      )}

      {!report && !loading && !bpError && (
        <Card>
          <div className="p-10 flex flex-col items-center justify-center gap-4 text-center">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ background: BLUE_BG, border: `1px solid ${BLUE_BD}` }}>
              <Activity className="h-7 w-7" style={{ color: BLUE }} />
            </div>
            <div className="max-w-xs">
              <p className="font-semibold text-[14px]" style={{ color: "hsl(var(--foreground))" }}>Discover your trading psychology</p>
              <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                Make paper trades in the Demo section, then click "Analyze My Trading" to get your personalized bias report.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ─── Tab Config ──────────────────────────────────────────── */
const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "overview",  label: "Overview",   Icon: Brain },
  { id: "news",      label: "News",       Icon: Newspaper },
  { id: "ict",       label: "ICT",        Icon: BookOpen },
  { id: "calendar",  label: "Calendar",   Icon: Clock },
  { id: "chat",      label: "Chat",       Icon: MessageCircle },
  { id: "bias",      label: "Psychology", Icon: Activity },
  { id: "coach",     label: "Daily Coach",Icon: Zap },
];

/* ─── Page ────────────────────────────────────────────────── */
export default function AiAssistant() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    document.querySelector(".tt-main")?.scrollTo({ top: 0, behavior: "instant" });
  }, [tab]);

  const [showAuthModal, setShowAuthModal] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Lock className="h-7 w-7" style={{ color: "hsl(var(--muted-foreground))" }} />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "hsl(var(--foreground))" }}>
              Sign in to access AI
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
              The AI Market Assistant requires an account. Sign in or create a free account to get started.
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <button className="flex-1 h-10 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              onClick={() => setShowAuthModal(true)}>
              Sign In
            </button>
            <button className="flex-1 h-10 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "hsl(var(--foreground))" }}
              onClick={() => setShowAuthModal(true)}>
              Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const overallScore = Math.round(MARKETS.reduce((a, m) => a + m.score, 0) / MARKETS.length);
  const overallSent: Sentiment = overallScore >= 60 ? "bullish" : overallScore >= 40 ? "neutral" : "bearish";
  const overallColor = SENT[overallSent].color;

  const show = (id: Tab): React.CSSProperties =>
    tab === id ? { display: "flex", flexDirection: "column", gap: 12 } : { display: "none" };

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* Header */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 100% at 0% 50%, rgba(255,255,255,0.03) 0%, transparent 60%)" }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 80% at 100% 50%, rgba(79,70,229,0.06) 0%, transparent 60%)" }} />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Animated AI Orb */}
            <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
              {/* Pulsing outer glow ring */}
              <div className="absolute inset-0 rounded-full orb-pulse"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
              {/* Subtle rotating accent */}
              <div className="absolute inset-[-1px] rounded-full spin-slow"
                style={{ background: "conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.05) 25%, transparent 50%)" }} />
              {/* Core sphere */}
              <div className="absolute inset-[3px] rounded-full flex items-center justify-center"
                style={{
                  background: "radial-gradient(circle at 38% 32%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 55%, transparent 100%)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 0 20px rgba(255,255,255,0.04)",
                }}>
                <Brain className="h-5 w-5 breathe" style={{ color: "rgba(255,255,255,0.80)" }} />
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="text-[20px] font-bold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>AI Market Assistant</h1>
              <p className="text-[11px] font-mono mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Live market intelligence · Powered by AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full"
              style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.22)", color: "#4ade80" }}>
              <span className="h-1.5 w-1.5 rounded-full live-pulse" style={{ background: "#4ade80" }} />Live
            </span>
            <button
              onClick={() => { if (refreshing) return; setRefreshing(true); setTimeout(() => setRefreshing(false), 1100); }}
              className="h-9 w-9 flex items-center justify-center rounded-xl"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} style={{ color: "hsl(var(--muted-foreground))" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex p-1 rounded-2xl gap-1 overflow-x-auto scrollbar-none"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap px-2 min-w-0 transition-all"
              style={active
                ? { background: "var(--card-bg)", color: BLUE, border: `1px solid ${BLUE_BD}`, boxShadow: "var(--shadow-tab-active)" }
                : { color: "hsl(var(--muted-foreground))", border: "1px solid transparent" }}>
              <t.Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Overview */}
      <div style={show("overview")}>
        <Card>
          <div className="p-5 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 80% at 0% 100%, rgba(255,255,255,0.03) 0%, transparent 60%)" }} />
            <div className="relative">
              <SectionLabel>Overall Market Sentiment</SectionLabel>
              <div className="flex items-center gap-4 mt-3">
                <div className="h-16 w-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="text-xl font-bold font-mono" style={{ color: overallColor }}>{overallScore}</span>
                  <span className="text-[9px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>/100</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold mb-1" style={{ color: overallColor }}>{SENT[overallSent].label}</p>
                  <p className="text-[12px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Markets showing {SENT[overallSent].label.toLowerCase()} tone driven by crypto strength and commodity demand. USD strength creating headwinds for risk assets.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {["Risk-On", "BTC Dominant", "USD Strong", "Gold Bid"].map(tag => (
                      <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                        style={{ background: BLUE_BG, border: `1px solid ${BLUE_BD}`, color: BLUE }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
        <SectionLabel>Daily Market Analysis</SectionLabel>
        {MARKETS.map(m => <MarketCardComp key={m.id} card={m} />)}
      </div>

      {/* News */}
      <div style={show("news")}>
        <SectionLabel>Latest Market News</SectionLabel>
        {NEWS.map((item, i) => <NewsCardComp key={i} item={item} />)}
      </div>

      {/* ICT — fully redesigned */}
      <div style={show("ict")}>
        <IctTab />
      </div>

      {/* Calendar */}
      <div style={show("calendar")}>
        <div className="flex items-center gap-3 flex-wrap">
          <SectionLabel>Today's Economic Events</SectionLabel>
          <div className="flex items-center gap-4">
            {(["high", "medium", "low"] as Impact[]).map(level => {
              const c = { high: "#f87171", medium: "#facc15", low: "#4ade80" }[level];
              return (
                <div key={level} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                  <span className="text-[10px] font-mono capitalize" style={{ color: "hsl(var(--muted-foreground))" }}>{level}</span>
                </div>
              );
            })}
          </div>
        </div>
        {ECON_EVENTS.map((ev, i) => <EconRow key={i} ev={ev} />)}
      </div>

      {/* Chat */}
      <div style={show("chat")}>
        <ChatPanel token={token} />
      </div>

      {/* Bias */}
      <div style={show("bias")}>
        <BiasPanel token={token} />
      </div>

      {/* Daily Coach */}
      <div style={show("coach")}>
        <DailyCoachTab token={token} />
      </div>
    </div>
  );
}

/* ─── Daily Coach Tab ─────────────────────────────────────── */
function DailyCoachTab({ token }: { token: string | null }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!token || fetched) return;
    setFetched(true);
    setLoading(true);
    fetch(`${API_BASE}/api/ai/daily-coach`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setData(d as Record<string, unknown>))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, fetched]);

  const PURPLE = "#a855f7";

  if (!token) {
    return (
      <Card>
        <div className="p-6 text-center">
          <Zap className="h-8 w-8 mx-auto mb-3 opacity-20" style={{ color: BLUE }} />
          <p className="text-sm font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>Sign in to get your personalized daily coaching briefing</p>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <div className="p-6 flex flex-col gap-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-xl animate-pulse" style={{ background: "hsl(var(--muted))" }} />
            <div className="h-5 w-40 rounded animate-pulse" style={{ background: "hsl(var(--muted))" }} />
          </div>
          {[1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "hsl(var(--muted))" }} />)}
        </div>
      </Card>
    );
  }

  if (!data?.hasData) {
    return (
      <Card>
        <div className="p-6 text-center flex flex-col items-center gap-3">
          <Zap className="h-8 w-8 opacity-15" style={{ color: PURPLE }} />
          <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>No coaching data yet</p>
          <p className="text-[12px] font-mono text-center max-w-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            {(data?.todayGoal as string) ?? "Run backtests to unlock your personalized daily AI coaching briefing."}
          </p>
        </div>
      </Card>
    );
  }

  const sections = [
    { icon: Brain,       label: "Win Rate Trend",      value: data.winRateTrend as string,      color: "#22c55e" },
    { icon: AlertTriangle, label: "Recent Loss Pattern", value: data.recentLossPattern as string, color: "#ef4444" },
    { icon: TrendingUp,  label: "Best Session",         value: data.bestSession as string,        color: "#4ade80" },
    { icon: TrendingDown,label: "Worst Session",         value: data.worstSession as string,       color: "#f87171" },
    { icon: Target,      label: "Today's Goal",         value: data.todayGoal as string,          color: PURPLE },
    { icon: Zap,         label: "Top Recommendation",   value: data.recommendation as string,     color: "#facc15" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Greeting card */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>
        <div className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 70% 100% at 0% 50%, rgba(168,85,247,0.07) 0%, transparent 65%)" }} />
        <div className="relative flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" }}>
            <Zap className="h-5 w-5" style={{ color: PURPLE }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>Daily Coach Briefing</p>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.2)", color: PURPLE }}>
                {data.traderStyle as string ?? "Trader"}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
              {data.greeting as string}
            </p>
          </div>
        </div>
      </div>

      {/* Insight sections */}
      {sections.map(sec => (
        <div key={sec.label} className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>
          <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: `${sec.color}12`, border: `1px solid ${sec.color}25` }}>
            <sec.icon className="h-3.5 w-3.5" style={{ color: sec.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>
              {sec.label}
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: "hsl(var(--foreground))" }}>
              {sec.value ?? "—"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
