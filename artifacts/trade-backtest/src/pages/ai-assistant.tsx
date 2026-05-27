import { useState, useEffect } from "react";
import {
  Brain, TrendingUp, TrendingDown, Minus,
  Globe, Bitcoin, BarChart2, DollarSign,
  Clock, AlertTriangle, Target, Layers,
  RefreshCw, Newspaper, Shield, Eye, Crosshair,
  Activity, ChevronDown, ChevronUp,
} from "lucide-react";

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
type Sentiment  = "bullish" | "bearish" | "neutral";
type Tab        = "overview" | "news" | "ict" | "calendar";
type Impact     = "high" | "medium" | "low";

interface MarketCard {
  id: string; icon: React.ElementType; label: string;
  score: number; sentiment: Sentiment; headline: string;
  detail: string; change: number;
}
interface NewsItem {
  title: string; source: string; time: string;
  sentiment: Sentiment; category: string;
}
interface IctZone {
  concept: string; description: string; level: string;
  direction: Sentiment; icon: React.ElementType;
}
interface EconEvent {
  time: string; flag: string; country: string;
  event: string; impact: Impact; forecast: string; previous: string;
}

/* ─────────────────────────────────────────────
   COLOUR TOKENS  — blue accent system
───────────────────────────────────────────── */
const BLUE   = "#2563eb";
const BLUE_L = "#3b82f6";
const BLUE_BG = "rgba(37,99,235,0.07)";
const BLUE_BD = "rgba(37,99,235,0.18)";

const C = {
  bg:       "#ffffff",
  surface:  "#f4f6fb",       // slightly blue-tinted grey card
  surfaceB: "#eef1f8",       // deeper tinted surface
  border:   "rgba(0,0,0,0.09)",
  borderB:  BLUE_BD,
  text:     "#0f1117",
  sub:      "#4b5563",
  muted:    "#9ca3af",
  blue:     BLUE,
  blueL:    BLUE_L,
  blueBg:   BLUE_BG,
  blueBd:   BLUE_BD,
  pos:      "#16a34a",
  neg:      "#dc2626",
  amb:      "#d97706",
};

const CARD: React.CSSProperties = {
  background: C.surface,
  border:    `1px solid ${C.border}`,
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};

/* ─────────────────────────────────────────────
   STATIC DATA
───────────────────────────────────────────── */
const MARKETS: MarketCard[] = [
  {
    id: "crypto", icon: Bitcoin, label: "Crypto", score: 72,
    sentiment: "bullish", change: 2.34,
    headline: "Bitcoin breaks above key $76K resistance",
    detail: "BTC has broken through the $76,000 resistance zone with strong volume confirmation. ETH follows with higher lows, suggesting a sustained trend shift. Altcoins are rotating bullishly with SOL and INJ leading gains.",
  },
  {
    id: "forex", icon: Globe, label: "Forex", score: 38,
    sentiment: "bearish", change: -0.45,
    headline: "USD strengthens on hawkish Fed rhetoric",
    detail: "The US Dollar Index (DXY) continues higher after Fed officials signaled fewer rate cuts in 2025. EUR/USD approached 1.0450 support, GBP/USD rejected from 1.2700. Risk-off sentiment is dominating FX flows.",
  },
  {
    id: "equities", icon: BarChart2, label: "Equities", score: 51,
    sentiment: "neutral", change: 0.12,
    headline: "S&P 500 consolidates near all-time highs",
    detail: "Major US indices are in a tight consolidation range. Tech (QQQ) showing relative strength while energy lags. Earnings season beats broadly priced in. Watch for breakout above SPX 5,300.",
  },
  {
    id: "commodities", icon: DollarSign, label: "Commodities", score: 64,
    sentiment: "bullish", change: 0.87,
    headline: "Gold holds $2,300 amid geopolitical risk",
    detail: "XAU/USD maintaining strong bids above the $2,300 psychological level as geopolitical tensions keep safe-haven demand elevated. Oil (WTI) consolidates near $82 after OPEC+ supply cuts.",
  },
];

const NEWS: NewsItem[] = [
  { title: "Federal Reserve signals rate cuts could be delayed until Q3 2025",    source: "Reuters",     time: "2h ago",  sentiment: "bearish", category: "Macro" },
  { title: "Bitcoin ETF inflows hit new weekly record of $1.2B as demand surges", source: "CoinDesk",   time: "3h ago",  sentiment: "bullish", category: "Crypto" },
  { title: "OPEC+ reaffirms production cut agreement through end of 2025",        source: "Bloomberg",  time: "4h ago",  sentiment: "bullish", category: "Commodities" },
  { title: "ECB holds rates steady, signals June cut still on the table",          source: "FT",         time: "5h ago",  sentiment: "neutral", category: "Forex" },
  { title: "NVIDIA reports record Q1 earnings, AI chip demand shows no sign of slowing", source: "CNBC", time: "6h ago",  sentiment: "bullish", category: "Equities" },
  { title: "China's manufacturing PMI contracts for second consecutive month",    source: "WSJ",        time: "7h ago",  sentiment: "bearish", category: "Macro" },
  { title: "Ethereum staking rewards hit 4.2% APY as network utilization rises",  source: "Decrypt",    time: "8h ago",  sentiment: "bullish", category: "Crypto" },
  { title: "US CPI data comes in slightly above expectations at 3.5% YoY",        source: "MarketWatch",time: "9h ago",  sentiment: "bearish", category: "Macro" },
];

const ICT_ZONES: IctZone[] = [
  { concept: "Order Block (Bullish)",    icon: Shield,    direction: "bullish", level: "BTC ~$72,400–$73,200", description: "A strong institutional buying zone at previous resistance turned support. Price has respected this area 3 times, indicating significant buy-side liquidity." },
  { concept: "Fair Value Gap (FVG)",     icon: Layers,    direction: "bullish", level: "BTC ~$74,800–$75,600", description: "An unfilled price inefficiency left by rapid buying momentum. Price typically returns to fill these gaps before continuing the prevailing trend." },
  { concept: "Liquidity Pool (BSL)",     icon: Eye,       direction: "neutral", level: "BTC ~$77,500",         description: "Buy-side liquidity resting above recent swing highs at $77,500. Smart money likely targets this level to offload positions before a reversal." },
  { concept: "Break of Structure (BOS)", icon: Crosshair, direction: "bullish", level: "BTC ~$76,000",         description: "Confirmed break of structure to the upside on the 4H timeframe, indicating a shift from distribution to accumulation phase." },
  { concept: "Premium / Discount Zone", icon: Target,    direction: "neutral", level: "50% = ~$74,600",       description: "Current price sits in the premium zone (above 50% of the recent swing range). Optimal long entries are in the discount zone around $73,800–$74,500." },
  { concept: "Market Structure Shift",  icon: Activity,  direction: "bearish", level: "Watch $75,400 support", description: "A 1H market structure shift occurred, suggesting a short-term pullback before continuation of the higher-timeframe bullish trend." },
];

const ECON_EVENTS: EconEvent[] = [
  { time: "08:30", flag: "🇺🇸", country: "USD", event: "Core CPI (MoM)",         impact: "high",   forecast: "0.3%",  previous: "0.4%" },
  { time: "10:00", flag: "🇺🇸", country: "USD", event: "Fed Chair Powell Speech", impact: "high",   forecast: "—",     previous: "—" },
  { time: "12:30", flag: "🇪🇺", country: "EUR", event: "ECB Lagarde Speech",      impact: "medium", forecast: "—",     previous: "—" },
  { time: "14:00", flag: "🇬🇧", country: "GBP", event: "UK CPI (YoY)",            impact: "high",   forecast: "2.1%",  previous: "2.3%" },
  { time: "15:00", flag: "🇺🇸", country: "USD", event: "JOLTS Job Openings",      impact: "medium", forecast: "8.75M", previous: "8.76M" },
  { time: "23:00", flag: "🇯🇵", country: "JPY", event: "Bank of Japan Minutes",   impact: "medium", forecast: "—",     previous: "—" },
];

/* ─────────────────────────────────────────────
   SENTIMENT CONFIG
───────────────────────────────────────────── */
const SENT: Record<Sentiment, { color: string; label: string; Icon: React.ElementType }> = {
  bullish: { color: C.pos, label: "Bullish", Icon: TrendingUp },
  bearish: { color: C.neg, label: "Bearish", Icon: TrendingDown },
  neutral: { color: C.amb, label: "Neutral",  Icon: Minus },
};

/* ─────────────────────────────────────────────
   SHARED COMPONENTS
───────────────────────────────────────────── */
function SentBadge({ s, score }: { s: Sentiment; score?: number }) {
  const { color, label, Icon } = SENT[s];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
      style={{ color, background: `${color}12`, border: `1px solid ${color}30` }}
    >
      <Icon className="h-2.5 w-2.5 flex-shrink-0" />
      {label}
      {score !== undefined && <span className="opacity-50 ml-0.5">· {score}</span>}
    </span>
  );
}

function IconBox({ icon: Icon, blue }: { icon: React.ElementType; blue?: boolean }) {
  return (
    <div
      className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={blue
        ? { background: BLUE_BG, border: `1px solid ${BLUE_BD}` }
        : { background: C.surfaceB, border: `1px solid ${C.border}` }}
    >
      <Icon className="h-[17px] w-[17px]" style={{ color: blue ? BLUE : C.sub }} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.muted }}>
      {children}
    </p>
  );
}

/* ─────────────────────────────────────────────
   OVERVIEW — market analysis card
───────────────────────────────────────────── */
function MarketCard({ card }: { card: MarketCard }) {
  const [open, setOpen] = useState(false);
  const { color } = SENT[card.sentiment];
  const up = card.change >= 0;
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 cursor-pointer"
      style={{ ...CARD, borderColor: open ? BLUE_BD : C.border, transition: "border-color 0.15s" }}
      onClick={() => setOpen(v => !v)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <IconBox icon={card.icon} />
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: C.text }}>{card.label}</p>
            <p className="text-[11px] font-mono truncate" style={{ color: C.muted }}>{card.headline}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <SentBadge s={card.sentiment} score={card.score} />
          <span className="text-[11px] font-mono font-bold" style={{ color: up ? C.pos : C.neg }}>
            {up ? "+" : ""}{card.change.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* score bar */}
      <div className="h-0.5 w-full rounded-full" style={{ background: "rgba(0,0,0,0.07)" }}>
        <div className="h-full rounded-full" style={{ width: `${card.score}%`, background: color, opacity: 0.65 }} />
      </div>

      {open && (
        <p className="text-[12px] leading-relaxed rounded-xl px-3 py-3"
          style={{ background: C.surfaceB, color: C.sub, borderLeft: `3px solid ${color}` }}>
          {card.detail}
        </p>
      )}

      <div className="flex justify-end">
        {open
          ? <ChevronUp className="h-3.5 w-3.5" style={{ color: C.muted }} />
          : <ChevronDown className="h-3.5 w-3.5" style={{ color: C.muted }} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   NEWS card
───────────────────────────────────────────── */
function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div className="rounded-2xl p-4" style={CARD}>
      <div className="flex items-start gap-3 mb-2.5">
        <p className="text-[13px] leading-relaxed flex-1" style={{ color: C.text }}>{item.title}</p>
        <SentBadge s={item.sentiment} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
          style={{ background: BLUE_BG, border: `1px solid ${BLUE_BD}`, color: BLUE }}
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

/* ─────────────────────────────────────────────
   ICT card
───────────────────────────────────────────── */
function IctCard({ zone }: { zone: IctZone }) {
  const { color } = SENT[zone.direction];
  return (
    <div className="rounded-2xl p-4" style={CARD}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <IconBox icon={zone.icon} blue />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: C.text }}>{zone.concept}</p>
            <p className="text-[11px] font-mono" style={{ color }}>{zone.level}</p>
          </div>
        </div>
        <SentBadge s={zone.direction} />
      </div>
      <p className="text-[12px] leading-relaxed" style={{ color: C.sub }}>{zone.description}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CALENDAR row
───────────────────────────────────────────── */
function EconRow({ ev }: { ev: EconEvent }) {
  const ICOL: Record<Impact, string> = { high: C.neg, medium: C.amb, low: C.pos };
  const color = ICOL[ev.impact];
  const levels: Impact[] = ["low", "medium", "high"];

  return (
    <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={CARD}>
      <div className="flex-shrink-0 w-10 text-center">
        <p className="text-[13px] font-mono font-bold" style={{ color: C.text }}>{ev.time}</p>
        <p className="text-[10px] font-mono" style={{ color: C.muted }}>{ev.country}</p>
      </div>

      <span className="text-base flex-shrink-0">{ev.flag}</span>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] truncate" style={{ color: C.text }}>{ev.event}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex gap-0.5">
            {levels.map((l, i) => (
              <div
                key={l}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: levels.indexOf(ev.impact) >= i ? color : "rgba(0,0,0,0.1)" }}
              />
            ))}
          </div>
          <span className="text-[10px] font-mono capitalize" style={{ color }}>{ev.impact}</span>
        </div>
      </div>

      <div className="flex-shrink-0 text-right space-y-0.5">
        <p className="text-[11px] font-mono" style={{ color: C.sub }}>
          <span style={{ color: C.muted }}>F </span>{ev.forecast}
        </p>
        <p className="text-[11px] font-mono" style={{ color: C.sub }}>
          <span style={{ color: C.muted }}>P </span>{ev.previous}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TAB CONFIG
───────────────────────────────────────────── */
const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", Icon: Brain },
  { id: "news",     label: "News",     Icon: Newspaper },
  { id: "ict",      label: "ICT",      Icon: Target },
  { id: "calendar", label: "Calendar", Icon: Clock },
];

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */
export default function AiAssistant() {
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshing, setRefreshing] = useState(false);

  /* Reset scroll position on tab switch — no DOM remount needed */
  useEffect(() => {
    document.querySelector(".tt-main")?.scrollTo({ top: 0, behavior: "instant" });
  }, [tab]);

  /* show / hide panels purely via CSS — zero mount/unmount = zero glitch */
  const show = (id: Tab): React.CSSProperties =>
    tab === id ? { display: "flex", flexDirection: "column", gap: "12px" } : { display: "none" };

  const overallScore = Math.round(MARKETS.reduce((a, m) => a + m.score, 0) / MARKETS.length);
  const overallSent: Sentiment = overallScore >= 60 ? "bullish" : overallScore >= 40 ? "neutral" : "bearish";
  const overallColor = SENT[overallSent].color;

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: `linear-gradient(135deg, ${BLUE_BG} 0%, #ffffff 60%)`,
          border: `1px solid ${BLUE_BD}`,
          boxShadow: "0 1px 6px rgba(37,99,235,0.08)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: BLUE_BG, border: `1px solid ${BLUE_BD}` }}
            >
              <Brain className="h-6 w-6" style={{ color: BLUE }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight" style={{ color: C.text }}>
                AI Market Assistant
              </h1>
              <p className="text-[11px] font-mono mt-0.5" style={{ color: C.muted }}>
                Real-time market intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full"
              style={{ background: "rgba(22,163,74,0.09)", border: "1px solid rgba(22,163,74,0.22)", color: C.pos }}
            >
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: C.pos }} />
              Live
            </span>
            <button
              onClick={() => {
                if (refreshing) return;
                setRefreshing(true);
                setTimeout(() => setRefreshing(false), 1100);
              }}
              className="h-9 w-9 flex items-center justify-center rounded-xl active:opacity-60"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                style={{ color: C.sub }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── TAB BAR ─────────────────────────────────────────────── */}
      <div
        className="flex p-1 rounded-2xl gap-1"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
      >
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-medium"
              style={active ? {
                background: "#ffffff",
                color: BLUE,
                border: `1px solid ${BLUE_BD}`,
                boxShadow: "0 1px 4px rgba(37,99,235,0.10)",
              } : {
                color: C.muted,
                border: "1px solid transparent",
                transition: "color 0.15s",
              }}
            >
              <t.Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════
          OVERVIEW  — always in DOM, hidden via CSS
      ══════════════════════════════════════════════ */}
      <div style={show("overview")}>

        {/* Overall sentiment card */}
        <div
          className="rounded-2xl p-4 sm:p-5"
          style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
        >
          <SectionLabel>Overall Market Sentiment</SectionLabel>
          <div className="flex items-center gap-4 mt-3">
            <div
              className="h-16 w-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
              style={{ background: BLUE_BG, border: `1px solid ${BLUE_BD}` }}
            >
              <span className="text-xl font-bold font-mono" style={{ color: overallColor }}>{overallScore}</span>
              <span className="text-[9px] font-mono" style={{ color: C.muted }}>/100</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold mb-1" style={{ color: overallColor }}>
                {SENT[overallSent].label}
              </p>
              <p className="text-[12px] leading-relaxed" style={{ color: C.sub }}>
                Markets showing a {SENT[overallSent].label.toLowerCase()} tone driven by crypto strength and commodity demand. USD strength creating headwinds for risk assets.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {["Risk-On", "BTC Dominant", "USD Strong", "Gold Bid"].map(tag => (
                  <span key={tag}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                    style={{ background: BLUE_BG, border: `1px solid ${BLUE_BD}`, color: BLUE }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <SectionLabel>Daily Market Analysis</SectionLabel>

        {MARKETS.map(m => <MarketCard key={m.id} card={m} />)}
      </div>

      {/* ══════════════════════════════════════════════
          NEWS — always in DOM
      ══════════════════════════════════════════════ */}
      <div style={show("news")}>
        <SectionLabel>Latest Market News</SectionLabel>
        {NEWS.map((item, i) => <NewsCard key={i} item={item} />)}
      </div>

      {/* ══════════════════════════════════════════════
          ICT — always in DOM
      ══════════════════════════════════════════════ */}
      <div style={show("ict")}>

        {/* Disclaimer */}
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3"
          style={{ background: "rgba(217,119,6,0.07)", border: "1px solid rgba(217,119,6,0.2)" }}
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: C.amb }} />
          <p className="text-[12px] leading-relaxed" style={{ color: C.amb }}>
            AI-generated ICT analysis for educational purposes only. Not financial advice.
          </p>
        </div>

        <SectionLabel>ICT Concept Analysis</SectionLabel>

        {ICT_ZONES.map((zone, i) => <IctCard key={i} zone={zone} />)}

        {/* Directional bias */}
        <div
          className="rounded-2xl p-4 sm:p-5"
          style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.2)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4" style={{ color: C.pos }} />
            <p className="text-[13px] font-semibold" style={{ color: C.pos }}>AI Directional Bias</p>
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: C.sub }}>
            Based on ICT concepts, the higher-timeframe bias remains{" "}
            <strong style={{ color: C.pos }}>bullish</strong>.{" "}
            Price is trading above equilibrium of the recent macro range. A sweep of the $75,400 MSS level would offer a high-probability long entry targeting the $77,500 BSL zone.
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          CALENDAR — always in DOM
      ══════════════════════════════════════════════ */}
      <div style={show("calendar")}>

        <SectionLabel>Today's Economic Events</SectionLabel>

        {/* Impact legend */}
        <div className="flex items-center gap-5 px-1">
          {(["high", "medium", "low"] as Impact[]).map(level => {
            const c = { high: C.neg, medium: C.amb, low: C.pos }[level];
            return (
              <div key={level} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                <span className="text-[11px] font-mono capitalize" style={{ color: C.muted }}>{level}</span>
              </div>
            );
          })}
        </div>

        {ECON_EVENTS.map((ev, i) => <EconRow key={i} ev={ev} />)}
      </div>

    </div>
  );
}
