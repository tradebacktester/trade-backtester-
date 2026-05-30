import React, { useMemo, useState, useRef, useCallback } from "react";
import { useGetBacktestSummary, useListBacktests } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Target, Shield,
  Clock, BarChart2, Zap, Activity, ArrowUpRight, Play,
  Globe, Bitcoin, Brain, CandlestickChart,
  MessageCircle, Send, X, Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── Helpers ──────────────────────────────────────────────────────── */
function fmtPct(v: number | null | undefined, sign = true) {
  if (v == null) return "—";
  return `${sign && v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtNum(v: number | null | undefined, d = 2) {
  if (v == null) return "—";
  return v.toFixed(d);
}

/* ── Design tokens — pure white theme ────────────────────────────── */
const C = {
  text:        "#111111",
  sub:         "#666666",
  muted:       "#999999",
  border:      "rgba(0,0,0,0.09)",
  surface:     "#f7f7f7",
  surfaceHov:  "rgba(0,0,0,0.03)",
  positive:    "#16a34a",
  negative:    "#dc2626",
  amber:       "#d97706",
};

const CARD: React.CSSProperties = {
  background:  "#f7f7f7",
  border:      "1px solid rgba(0,0,0,0.09)",
  boxShadow:   "0 1px 4px rgba(0,0,0,0.06)",
};

/* ── Skeleton ─────────────────────────────────────────────────────── */
function Skel({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ background: "rgba(0,0,0,0.06)" }}
    />
  );
}

/* ── Section label ────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: C.muted }}>
      {children}
    </p>
  );
}

/* ── Panel ────────────────────────────────────────────────────────── */
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${className}`} style={CARD}>
      {children}
    </div>
  );
}

/* ── Stat card ────────────────────────────────────────────────────── */
function StatCard({
  icon: Icon, label, value, accent, isLoading = false,
}: {
  icon: React.ElementType; label: string; value: React.ReactNode;
  accent?: string; isLoading?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 flex flex-col gap-3" style={CARD}>
      {accent && (
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg,transparent,${accent}60,transparent)` }}
        />
      )}
      <span
        className="h-8 w-8 flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ background: "#efefef", border: "1px solid rgba(0,0,0,0.08)" }}
      >
        <Icon className="h-[14px] w-[14px]" style={{ color: accent ?? "#888" }} />
      </span>
      <div>
        <p className="text-[10px] uppercase tracking-wider mb-1.5 font-mono" style={{ color: C.muted }}>
          {label}
        </p>
        {isLoading
          ? <Skel className="h-6 w-16" />
          : <p className="text-[20px] font-bold font-mono leading-none"
              style={{ color: accent ?? C.text }}>
              {value}
            </p>
        }
      </div>
    </div>
  );
}

/* ── Watchlist ────────────────────────────────────────────────────── */
interface WatchItem { symbol: string; price: string; change: number; sub: string }
const WATCHLIST: WatchItem[] = [
  { symbol: "BTC/USD", price: "67,420", change: 2.14,  sub: "Bitcoin" },
  { symbol: "ETH/USD", price: "3,512",  change: 1.87,  sub: "Ethereum" },
  { symbol: "EUR/USD", price: "1.0842", change: -0.31, sub: "Forex" },
  { symbol: "GBP/USD", price: "1.2671", change: -0.18, sub: "Forex" },
  { symbol: "SPX500",  price: "5,284",  change: 0.42,  sub: "Equities" },
  { symbol: "GOLD",    price: "2,318",  change: 0.74,  sub: "Commodity" },
];

function WatchRow({ item, last }: { item: WatchItem; last: boolean }) {
  const up = item.change >= 0;
  return (
    <div
      className="flex items-center justify-between py-2.5"
      style={last ? {} : { borderBottom: "1px solid rgba(0,0,0,0.07)" }}
    >
      <div>
        <p className="text-sm font-mono font-semibold" style={{ color: C.text }}>{item.symbol}</p>
        <p className="text-[10px] font-mono" style={{ color: C.muted }}>{item.sub}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-mono font-bold" style={{ color: C.text }}>{item.price}</p>
        <p className="text-[11px] font-mono font-semibold" style={{ color: up ? C.positive : C.negative }}>
          {up ? "+" : ""}{item.change.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}

/* ── Trading sessions ─────────────────────────────────────────────── */
interface Session { name: string; hours: string; status: "open" | "closed" | "overlap"; tz: string }
const SESSIONS: Session[] = [
  { name: "Sydney",   hours: "22:00–07:00", status: "closed",  tz: "AEST" },
  { name: "Tokyo",    hours: "00:00–09:00", status: "closed",  tz: "JST" },
  { name: "London",   hours: "08:00–17:00", status: "open",    tz: "BST" },
  { name: "New York", hours: "13:00–22:00", status: "overlap", tz: "EST" },
];
const SCOL: Record<string, string> = { open: "#16a34a", closed: "#ccc", overlap: "#d97706" };
const SLBL: Record<string, string> = { open: "Open", closed: "Closed", overlap: "Active" };

function SessionRow({ s, last }: { s: Session; last: boolean }) {
  const color = SCOL[s.status];
  return (
    <div
      className="flex items-center justify-between py-2.5"
      style={last ? {} : { borderBottom: "1px solid rgba(0,0,0,0.07)" }}
    >
      <div className="flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
        <div>
          <p className="text-xs font-mono font-semibold" style={{ color: C.text }}>{s.name}</p>
          <p className="text-[10px] font-mono" style={{ color: C.muted }}>{s.hours} {s.tz}</p>
        </div>
      </div>
      <span
        className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
        style={{ color, background: `${color}12`, border: `1px solid ${color}30` }}
      >
        {SLBL[s.status]}
      </span>
    </div>
  );
}

/* ── Demo summary ─────────────────────────────────────────────────── */
function DemoSummary() {
  const items = [
    { label: "Balance",     value: "$10,000.00", color: C.text },
    { label: "Equity",      value: "$10,284.50", color: C.positive },
    { label: "Open P&L",    value: "+$284.50",   color: C.positive },
    { label: "Margin Used", value: "$1,200.00",  color: C.amber },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(it => (
        <div
          key={it.label}
          className="rounded-xl px-3 py-2.5"
          style={{ background: "#f0f0f0", border: "1px solid rgba(0,0,0,0.07)" }}
        >
          <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: C.muted }}>
            {it.label}
          </p>
          <p className="text-sm font-mono font-bold" style={{ color: it.color }}>{it.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ── AI insight cards ─────────────────────────────────────────────── */
interface Insight { icon: React.ElementType; title: string; body: string; tag: string; tagColor: string }
const AI_INSIGHTS: Insight[] = [
  { icon: Bitcoin,   title: "Crypto",   body: "BTC holding $65K support with bullish structure. ETH showing relative strength.",  tag: "Bullish", tagColor: C.positive },
  { icon: Globe,     title: "Forex",    body: "DXY strength pressuring EUR/USD near 1.0820. GBP remains range-bound.",              tag: "Neutral", tagColor: C.amber },
  { icon: BarChart2, title: "Equities", body: "SPX consolidating near ATH. Tech leading. Watch for breakout above 5,300.",          tag: "Watch",   tagColor: C.muted },
];

function InsightCard({ item }: { item: Insight }) {
  const Icon = item.icon;
  return (
    <Link href="/ai">
      <div
        className="rounded-2xl p-4 cursor-pointer transition-colors duration-150"
        style={CARD}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.16)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <span
            className="h-7 w-7 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: "#efefef", border: "1px solid rgba(0,0,0,0.08)" }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: "#555" }} />
          </span>
          <p className="text-xs font-mono font-semibold" style={{ color: C.text }}>{item.title}</p>
          <span
            className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-full"
            style={{ color: item.tagColor, background: `${item.tagColor}12`, border: `1px solid ${item.tagColor}30` }}
          >
            {item.tag}
          </span>
        </div>
        <p className="text-[11px] font-mono leading-relaxed" style={{ color: C.sub }}>{item.body}</p>
      </div>
    </Link>
  );
}

/* ── Recent backtest row ──────────────────────────────────────────── */
function RecentRow({ bt }: { bt: any }) {
  const isPos = (bt.totalReturn ?? 0) >= 0;
  return (
    <Link href={`/backtests/${bt.id}`}>
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 cursor-pointer group"
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.surfaceHov; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
      >
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: isPos ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)",
            border: `1px solid ${isPos ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)"}`,
          }}
        >
          {isPos
            ? <TrendingUp className="h-3.5 w-3.5" style={{ color: C.positive }} />
            : <TrendingDown className="h-3.5 w-3.5" style={{ color: C.negative }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: C.text }}>
            {bt.strategyName || `Strategy #${bt.strategyId}`}
          </p>
          <p className="text-[11px] font-mono" style={{ color: C.muted }}>
            {bt.symbol} · {bt.startDate?.slice(0, 7)}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold font-mono" style={{ color: isPos ? C.positive : C.negative }}>
            {fmtPct(bt.totalReturn)}
          </p>
          <p className="text-[10px] font-mono" style={{ color: C.muted }}>
            WR: {bt.winRate != null ? `${bt.winRate.toFixed(0)}%` : "—"}
          </p>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-30 transition-opacity flex-shrink-0"
          style={{ color: C.sub }} />
      </div>
    </Link>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetBacktestSummary();
  const { data: backtests, isLoading: loadingBacktests } = useListBacktests();
  const isLoading = loadingSummary || loadingBacktests;

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const sendMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || isChatLoading) return;
    setChatInput("");
    const newMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    setIsChatLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json() as { message?: string; error?: string };
      setMessages(prev => [...prev, { role: "assistant" as const, content: data.message ?? data.error ?? "Error." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant" as const, content: "Network error. Please try again." }]);
    } finally {
      setIsChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [chatInput, messages, isChatLoading]);

  const analytics = useMemo(() => {
    if (!backtests?.length) return null;
    const completed = backtests.filter((b: any) => b.status === "complete");
    if (!completed.length) return null;
    const avg = (arr: number[]) => arr.length ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : 0;
    return {
      avgWR:     avg(completed.map((b: any) => b.winRate ?? 0).filter((v: number) => v > 0)),
      avgPF:     avg(completed.map((b: any) => b.profitFactor ?? 0).filter((v: number) => v > 0)),
      avgSharpe: avg(completed.map((b: any) => b.sharpeRatio ?? 0)),
      avgDD:     avg(completed.map((b: any) => b.maxDrawdown ?? 0)),
      bestReturn: Math.max(...completed.map((b: any) => b.totalReturn ?? 0)),
    };
  }, [backtests]);

  const recentBacktests = useMemo(
    () => (backtests ?? []).filter((b: any) => b.status === "complete").slice(0, 6),
    [backtests],
  );

  return (
    <div className="flex flex-col gap-4 pb-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: C.text }}>Dashboard</h1>
          <p className="text-xs mt-0.5 font-mono" style={{ color: C.muted }}>
            Market overview &amp; performance summary
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="flex-shrink-0">
          <Link href="/backtests/new">
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Run Backtest
          </Link>
        </Button>
      </div>

      {/* AI Chat Panel — top of page, always visible */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.1)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
          style={{ background: chatOpen ? "#ffffff" : "#f7f7f7", borderBottom: chatOpen ? "1px solid rgba(0,0,0,0.07)" : "none" }}
          onClick={() => setChatOpen(v => !v)}
        >
          <span className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#111" }}>
            <Bot className="h-4 w-4 text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-none mb-0.5" style={{ color: C.text }}>Trading AI</p>
            <p className="text-[10px] font-mono" style={{ color: C.muted }}>
              {chatOpen ? "Powered by GPT-4o" : "Ready to chat · ask about strategies, indicators, risk"}
            </p>
          </div>
          {!chatOpen && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {["What is RSI?", "Bollinger Bands", "Stop loss tips"].map(q => (
                <button
                  key={q}
                  onClick={e => { e.stopPropagation(); setChatInput(q); setChatOpen(true); }}
                  className="hidden sm:block text-[10px] font-mono px-2 py-1 rounded-lg border transition-all hover:opacity-80"
                  style={{ background: "#fff", border: `1px solid ${C.border}`, color: C.sub }}
                >{q}</button>
              ))}
            </div>
          )}
          {chatOpen
            ? <X className="h-4 w-4 flex-shrink-0 opacity-40" style={{ color: C.text }} />
            : <MessageCircle className="h-4 w-4 flex-shrink-0" style={{ color: C.muted }} />}
        </div>
        {chatOpen && (
          <div style={{ background: "#ffffff" }}>
            <div className="overflow-y-auto px-4 py-3 flex flex-col gap-3" style={{ minHeight: 160, maxHeight: "45vh" }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-3">
                  <p className="text-xs font-mono text-center" style={{ color: C.muted }}>
                    Ask me anything about trading strategies, indicators, or risk management.
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {["What is RSI?", "Explain Bollinger Bands", "How to use stop loss?", "Best EMA settings?"].map(q => (
                      <button key={q} onClick={() => setChatInput(q)}
                        className="text-[11px] font-mono px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
                        style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.sub }}
                      >{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[80%] px-3 py-2 rounded-2xl text-xs font-mono leading-relaxed whitespace-pre-wrap"
                    style={m.role === "user"
                      ? { background: "#111", color: "#fff", borderBottomRightRadius: 4 }
                      : { background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderBottomLeftRadius: 4 }}
                  >{m.content}</div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-2xl text-xs font-mono" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}>Thinking…</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="px-4 pb-4 pt-2 border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ background: C.surface, borderColor: C.border }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
                  placeholder="Ask about trading…"
                  className="flex-1 text-xs font-mono bg-transparent outline-none"
                  style={{ color: C.text }}
                />
                <button onClick={() => void sendMessage()} disabled={!chatInput.trim() || isChatLoading}
                  className="h-6 w-6 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                  style={{ background: "#111", color: "#fff" }}
                ><Send className="h-3 w-3" /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Market overview bar */}
      <Panel>
        <SectionLabel>Market Overview</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {WATCHLIST.map(w => (
            <div
              key={w.symbol}
              className="rounded-xl px-3 py-2 text-center"
              style={{ background: "#f0f0f0", border: "1px solid rgba(0,0,0,0.07)" }}
            >
              <p className="text-[10px] font-mono mb-1" style={{ color: C.muted }}>{w.symbol}</p>
              <p className="text-sm font-mono font-bold" style={{ color: C.text }}>{w.price}</p>
              <p className="text-[11px] font-mono font-semibold"
                style={{ color: w.change >= 0 ? C.positive : C.negative }}>
                {w.change >= 0 ? "+" : ""}{w.change.toFixed(2)}%
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <StatCard icon={TrendingUp}  label="Best Return"    accent={C.positive} value={isLoading ? null : fmtPct(summary?.bestReturn)} isLoading={isLoading} />
        <StatCard icon={Percent}     label="Avg Win Rate"   value={isLoading ? null : analytics ? `${analytics.avgWR.toFixed(1)}%` : "—"} isLoading={isLoading} />
        <StatCard icon={Target}      label="Profit Factor"  value={isLoading ? null : analytics ? fmtNum(analytics.avgPF) : "—"} isLoading={isLoading} />
        <StatCard icon={Zap}         label="Avg Sharpe"     value={isLoading ? null : analytics ? fmtNum(analytics.avgSharpe) : "—"} isLoading={isLoading} />
        <StatCard icon={Clock}       label="Total Backtests" value={isLoading ? null : (summary?.totalBacktests ?? 0)} isLoading={isLoading} />
        <StatCard icon={Shield}      label="Avg Drawdown"   accent={C.negative} value={isLoading ? null : analytics ? `-${Math.abs(analytics.avgDD).toFixed(1)}%` : "—"} isLoading={isLoading} />
        <StatCard icon={DollarSign}  label="Best Trade"     accent={C.positive} value={isLoading ? null : analytics ? fmtPct(analytics.bestReturn) : "—"} isLoading={isLoading} />
        <StatCard icon={Activity}    label="Total Trades"   value={isLoading ? null : (summary?.totalTrades ?? 0)} isLoading={isLoading} />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Watchlist */}
        <Panel>
          <div className="flex items-center justify-between mb-1">
            <SectionLabel>Watchlist</SectionLabel>
            <Link href="/chart">
              <span className="text-[10px] font-mono flex items-center gap-1 cursor-pointer hover:opacity-70 mb-3"
                style={{ color: C.sub }}>
                <CandlestickChart className="h-3 w-3" /> View Charts
              </span>
            </Link>
          </div>
          {WATCHLIST.map((w, i) => <WatchRow key={w.symbol} item={w} last={i === WATCHLIST.length - 1} />)}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <SectionLabel>Trading Sessions</SectionLabel>
            {SESSIONS.map((s, i) => <SessionRow key={s.name} s={s} last={i === SESSIONS.length - 1} />)}
          </Panel>

          <Panel>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Demo Account</SectionLabel>
              <Link href="/demo">
                <span className="text-[10px] font-mono cursor-pointer hover:opacity-70" style={{ color: C.sub }}>
                  Open Demo →
                </span>
              </Link>
            </div>
            <DemoSummary />
          </Panel>
        </div>
      </div>

      {/* AI Insights */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5" style={{ color: C.muted }} />
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.muted }}>AI Insights</p>
          </div>
          <Link href="/ai">
            <span className="text-[10px] font-mono flex items-center gap-1 cursor-pointer hover:opacity-70"
              style={{ color: C.sub }}>
              Full Analysis <ArrowUpRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {AI_INSIGHTS.map(item => <InsightCard key={item.title} item={item} />)}
        </div>
      </div>

      {/* Recent backtests */}
      <Panel>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Recent Backtests</SectionLabel>
          <Link href="/backtests">
            <span className="text-[10px] font-mono flex items-center gap-1 cursor-pointer hover:opacity-70"
              style={{ color: C.sub }}>
              View All <ArrowUpRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => <Skel key={i} className="h-11" />)}
          </div>
        ) : recentBacktests.length ? (
          <div>{recentBacktests.map((bt: any) => <RecentRow key={bt.id} bt={bt} />)}</div>
        ) : (
          <div className="py-10 text-center">
            <BarChart2 className="h-8 w-8 mx-auto mb-3 opacity-15" style={{ color: C.sub }} />
            <p className="text-sm font-mono" style={{ color: C.muted }}>No backtests yet</p>
            <Link href="/backtests/new">
              <Button variant="outline" size="sm" className="mt-3">Run your first backtest</Button>
            </Link>
          </div>
        )}
      </Panel>


    </div>
  );
}
