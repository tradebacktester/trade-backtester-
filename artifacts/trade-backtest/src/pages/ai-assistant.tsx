import { useState, useEffect, useRef } from "react";
import {
  Brain, TrendingUp, TrendingDown, Minus, Globe, Bitcoin, BarChart2, DollarSign,
  Clock, AlertTriangle, Target, Layers, RefreshCw, Newspaper, Shield, Eye, Crosshair,
  Activity, ChevronDown, ChevronUp, MessageCircle, Send, Bot, User,
} from "lucide-react";

type Sentiment = "bullish" | "bearish" | "neutral";
type Tab = "overview" | "news" | "ict" | "calendar" | "chat" | "bias";
type Impact = "high" | "medium" | "low";

interface MarketCard {
  id: string; icon: React.ElementType; label: string;
  score: number; sentiment: Sentiment; headline: string; detail: string; change: number;
}
interface NewsItem {
  title: string; source: string; time: string; sentiment: Sentiment; category: string;
}
interface IctZone {
  concept: string; description: string; level: string; direction: Sentiment; icon: React.ElementType;
}
interface EconEvent {
  time: string; flag: string; country: string; event: string; impact: Impact; forecast: string; previous: string;
}
interface ChatMsg { role: "user" | "assistant"; content: string; }

const BLUE = "#4DA3FF";
const BLUE_BG = "var(--accent-cyan-dim)";
const BLUE_BD = "var(--accent-cyan-border)";

const SENT: Record<Sentiment, { color: string; label: string; Icon: React.ElementType }> = {
  bullish: { color: "#4ade80", label: "Bullish", Icon: TrendingUp },
  bearish: { color: "#f87171", label: "Bearish", Icon: TrendingDown },
  neutral: { color: "#facc15", label: "Neutral",  Icon: Minus },
};

const MARKETS: MarketCard[] = [
  { id: "crypto", icon: Bitcoin, label: "Crypto", score: 72, sentiment: "bullish", change: 2.34, headline: "Bitcoin breaks above key $76K resistance", detail: "BTC has broken through the $76,000 resistance zone with strong volume confirmation. ETH follows with higher lows, suggesting a sustained trend shift. Altcoins are rotating bullishly with SOL and INJ leading gains." },
  { id: "forex", icon: Globe, label: "Forex", score: 38, sentiment: "bearish", change: -0.45, headline: "USD strengthens on hawkish Fed rhetoric", detail: "The US Dollar Index (DXY) continues higher after Fed officials signaled fewer rate cuts in 2025. EUR/USD approached 1.0450 support, GBP/USD rejected from 1.2700. Risk-off sentiment is dominating FX flows." },
  { id: "equities", icon: BarChart2, label: "Equities", score: 51, sentiment: "neutral", change: 0.12, headline: "S&P 500 consolidates near all-time highs", detail: "Major US indices are in a tight consolidation range. Tech (QQQ) showing relative strength while energy lags. Earnings season beats broadly priced in. Watch for breakout above SPX 5,300." },
  { id: "commodities", icon: DollarSign, label: "Commodities", score: 64, sentiment: "bullish", change: 0.87, headline: "Gold holds $2,300 amid geopolitical risk", detail: "XAU/USD maintaining strong bids above the $2,300 psychological level as geopolitical tensions keep safe-haven demand elevated. Oil (WTI) consolidates near $82 after OPEC+ supply cuts." },
];

const NEWS: NewsItem[] = [
  { title: "Federal Reserve signals rate cuts could be delayed until Q3 2025", source: "Reuters", time: "2h ago", sentiment: "bearish", category: "Macro" },
  { title: "Bitcoin ETF inflows hit new weekly record of $1.2B as demand surges", source: "CoinDesk", time: "3h ago", sentiment: "bullish", category: "Crypto" },
  { title: "OPEC+ reaffirms production cut agreement through end of 2025", source: "Bloomberg", time: "4h ago", sentiment: "bullish", category: "Commodities" },
  { title: "ECB holds rates steady, signals June cut still on the table", source: "FT", time: "5h ago", sentiment: "neutral", category: "Forex" },
  { title: "NVIDIA reports record Q1 earnings, AI chip demand shows no sign of slowing", source: "CNBC", time: "6h ago", sentiment: "bullish", category: "Equities" },
  { title: "China's manufacturing PMI contracts for second consecutive month", source: "WSJ", time: "7h ago", sentiment: "bearish", category: "Macro" },
  { title: "Ethereum staking rewards hit 4.2% APY as network utilization rises", source: "Decrypt", time: "8h ago", sentiment: "bullish", category: "Crypto" },
  { title: "US CPI data comes in slightly above expectations at 3.5% YoY", source: "MarketWatch", time: "9h ago", sentiment: "bearish", category: "Macro" },
];

const ICT_ZONES: IctZone[] = [
  { concept: "Order Block (Bullish)", icon: Shield, direction: "bullish", level: "BTC ~$72,400–$73,200", description: "A strong institutional buying zone at previous resistance turned support. Price has respected this area 3 times, indicating significant buy-side liquidity." },
  { concept: "Fair Value Gap (FVG)", icon: Layers, direction: "bullish", level: "BTC ~$74,800–$75,600", description: "An unfilled price inefficiency left by rapid buying momentum. Price typically returns to fill these gaps before continuing the prevailing trend." },
  { concept: "Liquidity Pool (BSL)", icon: Eye, direction: "neutral", level: "BTC ~$77,500", description: "Buy-side liquidity resting above recent swing highs at $77,500. Smart money likely targets this level to offload positions before a reversal." },
  { concept: "Break of Structure (BOS)", icon: Crosshair, direction: "bullish", level: "BTC ~$76,000", description: "Confirmed break of structure to the upside on the 4H timeframe, indicating a shift from distribution to accumulation phase." },
  { concept: "Premium / Discount Zone", icon: Target, direction: "neutral", level: "50% = ~$74,600", description: "Current price sits in the premium zone (above 50% of the recent swing range). Optimal long entries are in the discount zone around $73,800–$74,500." },
  { concept: "Market Structure Shift", icon: Activity, direction: "bearish", level: "Watch $75,400 support", description: "A 1H market structure shift occurred, suggesting a short-term pullback before continuation of the higher-timeframe bullish trend." },
];

const ECON_EVENTS: EconEvent[] = [
  { time: "08:30", flag: "🇺🇸", country: "USD", event: "Core CPI (MoM)", impact: "high", forecast: "0.3%", previous: "0.4%" },
  { time: "10:00", flag: "🇺🇸", country: "USD", event: "Fed Chair Powell Speech", impact: "high", forecast: "—", previous: "—" },
  { time: "12:30", flag: "🇪🇺", country: "EUR", event: "ECB Lagarde Speech", impact: "medium", forecast: "—", previous: "—" },
  { time: "14:00", flag: "🇬🇧", country: "GBP", event: "UK CPI (YoY)", impact: "high", forecast: "2.1%", previous: "2.3%" },
  { time: "15:00", flag: "🇺🇸", country: "USD", event: "JOLTS Job Openings", impact: "medium", forecast: "8.75M", previous: "8.76M" },
  { time: "23:00", flag: "🇯🇵", country: "JPY", event: "Bank of Japan Minutes", impact: "medium", forecast: "—", previous: "—" },
];

const SUGGESTED_QUESTIONS = [
  "What is a moving average crossover strategy?",
  "Explain risk/reward ratio in trading",
  "What are Bollinger Bands and how do I use them?",
  "How does RSI divergence work?",
  "What is the difference between SMA and EMA?",
];

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

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="rounded-2xl" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)", ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))" }}>{children}</p>;
}

function MarketCardComp({ card }: { card: MarketCard }) {
  const [open, setOpen] = useState(false);
  const { color } = SENT[card.sentiment];
  const up = card.change >= 0;
  return (
    <Card>
      <div className="p-4 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <card.icon className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{card.label}</p>
              <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{card.headline}</p>
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
          <div className="h-full rounded-full" style={{ width: `${card.score}%`, background: color, boxShadow: `0 0 6px ${color}80`, transition: "width 0.6s ease" }} />
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
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: BLUE_BG, border: `1px solid ${BLUE_BD}`, color: BLUE }}>{item.category}</span>
          <span className="text-[10px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{item.source} · {item.time}</span>
        </div>
      </div>
    </Card>
  );
}

function IctCardComp({ zone }: { zone: IctZone }) {
  const { color } = SENT[zone.direction];
  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: BLUE_BG, border: `1px solid ${BLUE_BD}` }}>
              <zone.icon className="h-4 w-4" style={{ color: BLUE }} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>{zone.concept}</p>
              <p className="text-[11px] font-mono" style={{ color }}>{zone.level}</p>
            </div>
          </div>
          <SentBadge s={zone.direction} />
        </div>
        <p className="text-[12px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>{zone.description}</p>
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
          <p className="text-[11px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}><span className="opacity-50">F </span>{ev.forecast}</p>
          <p className="text-[11px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}><span className="opacity-50">P </span>{ev.previous}</p>
        </div>
      </div>
    </Card>
  );
}

function ChatPanel() {
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
      const token = localStorage.getItem("tt_token");
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
            <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(77,163,255,0.07) 0%, transparent 70%)" }} />
            <div className="relative h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(77,163,255,0.1)", border: "1px solid rgba(77,163,255,0.25)" }}>
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
              onMouseEnter={e => { (e.currentTarget).style.borderColor = BLUE_BD; (e.currentTarget).style.color = BLUE; }}
              onMouseLeave={e => { (e.currentTarget).style.borderColor = "var(--glass-border)"; (e.currentTarget).style.color = "hsl(var(--muted-foreground))"; }}>
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
                  ? { background: BLUE, border: "1px solid rgba(77,163,255,0.4)" }
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

interface BiasItem { name: string; severity: "low" | "medium" | "high"; description: string; evidence: string; tip: string; }
interface BiasReport { score: number; summary: string; biases: BiasItem[]; }

const SEV_COLOR = { low: "#16a34a", medium: "#d97706", high: "#dc2626" };
const SEV_BG    = { low: "rgba(22,163,74,0.09)", medium: "rgba(217,119,6,0.09)", high: "rgba(220,38,38,0.09)" };

function BiasPanel() {
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
      const resp = await fetch("/api/ai/bias-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("tt_token") ?? ""}` },
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
            style={{ background: loading ? "var(--glass-bg)" : BLUE, color: loading ? "hsl(var(--muted-foreground))" : "#050505", border: `1px solid ${loading ? "var(--glass-border)" : "rgba(77,163,255,0.4)"}`, boxShadow: loading ? "none" : "0 0 20px rgba(77,163,255,0.2)" }}>
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
            const bg = SEV_BG[bias.severity];
            return (
              <Card key={i}>
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-[14px]" style={{ color: "hsl(var(--foreground))" }}>{bias.name}</p>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: bg, color: col, border: `1px solid ${col}44` }}>
                      {bias.severity} severity
                    </span>
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
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: BLUE_BG, border: `1px solid ${BLUE_BD}` }}>
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

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "overview",  label: "Overview",    Icon: Brain },
  { id: "news",      label: "News",        Icon: Newspaper },
  { id: "ict",       label: "ICT",         Icon: Target },
  { id: "calendar",  label: "Calendar",    Icon: Clock },
  { id: "chat",      label: "Chat",        Icon: MessageCircle },
  { id: "bias",      label: "Psychology",  Icon: Activity },
];

export default function AiAssistant() {
  const [tab, setTab] = useState<Tab>("overview");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    document.querySelector(".tt-main")?.scrollTo({ top: 0, behavior: "instant" });
  }, [tab]);

  const overallScore = Math.round(MARKETS.reduce((a, m) => a + m.score, 0) / MARKETS.length);
  const overallSent: Sentiment = overallScore >= 60 ? "bullish" : overallScore >= 40 ? "neutral" : "bearish";
  const overallColor = SENT[overallSent].color;

  const show = (id: Tab): React.CSSProperties =>
    tab === id ? { display: "flex", flexDirection: "column", gap: 12 } : { display: "none" };

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* Header */}
      <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 100% at 0% 50%, rgba(77,163,255,0.07) 0%, transparent 60%)" }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 80% at 100% 50%, rgba(79,70,229,0.06) 0%, transparent 60%)" }} />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(77,163,255,0.1)", border: "1px solid rgba(77,163,255,0.25)" }}>
              <Brain className="h-6 w-6" style={{ color: BLUE }} />
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
            <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 80% at 0% 100%, rgba(77,163,255,0.05) 0%, transparent 60%)" }} />
            <div className="relative">
              <SectionLabel>Overall Market Sentiment</SectionLabel>
              <div className="flex items-center gap-4 mt-3">
                <div className="h-16 w-16 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(77,163,255,0.08)", border: "1px solid rgba(77,163,255,0.2)" }}>
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

      {/* ICT */}
      <div style={show("ict")}>
        <div className="flex items-start gap-2 rounded-xl px-4 py-3"
          style={{ background: "rgba(217,119,6,0.07)", border: "1px solid rgba(217,119,6,0.2)" }}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#facc15" }} />
          <p className="text-[12px] leading-relaxed" style={{ color: "#facc15" }}>
            AI-generated ICT analysis for educational purposes only. Not financial advice.
          </p>
        </div>
        <SectionLabel>ICT Concept Analysis</SectionLabel>
        {ICT_ZONES.map((zone, i) => <IctCardComp key={i} zone={zone} />)}
        <Card>
          <div className="p-5" style={{ borderLeft: "3px solid #4ade80" }}>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4" style={{ color: "#4ade80" }} />
              <p className="text-[13px] font-semibold" style={{ color: "#4ade80" }}>AI Directional Bias</p>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
              Based on ICT concepts, the higher-timeframe bias remains <strong style={{ color: "#4ade80" }}>bullish</strong>. Price is trading above equilibrium of the recent macro range. A sweep of the $75,400 MSS level would offer a high-probability long entry targeting the $77,500 BSL zone.
            </p>
          </div>
        </Card>
      </div>

      {/* Calendar */}
      <div style={show("calendar")}>
        <div className="flex items-center gap-2">
          <SectionLabel>Today's Economic Events</SectionLabel>
          <div className="flex items-center gap-4 ml-4">
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
        <ChatPanel />
      </div>

      {/* Bias */}
      <div style={show("bias")}>
        <BiasPanel />
      </div>
    </div>
  );
}
