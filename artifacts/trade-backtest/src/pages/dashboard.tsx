import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useGetBacktestSummary, useListBacktests } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useBinancePrices } from "@/lib/use-binance-ws";
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
interface WatchItem { symbol: string; price: string; change: number; sub: string; binanceKey?: string }
const WATCHLIST: WatchItem[] = [
  { symbol: "BTC/USD", price: "—",      change: 0,     sub: "Bitcoin",   binanceKey: "BTCUSDT" },
  { symbol: "ETH/USD", price: "—",      change: 0,     sub: "Ethereum",  binanceKey: "ETHUSDT" },
  { symbol: "EUR/USD", price: "1.0842", change: -0.31, sub: "Forex" },
  { symbol: "GBP/USD", price: "1.2671", change: -0.18, sub: "Forex" },
  { symbol: "SPX500",  price: "5,284",  change:  0.42, sub: "Equities" },
  { symbol: "GOLD",    price: "2,318",  change:  0.74, sub: "Commodity" },
];

function fmtLivePrice(p: number): string {
  if (p >= 1000) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1)    return p.toFixed(4);
  return p.toFixed(6);
}

function WatchRow({ item, last, livePrice }: {
  item: WatchItem; last: boolean;
  livePrice?: { price: number; changePct24h: number };
}) {
  const displayPrice  = livePrice ? fmtLivePrice(livePrice.price)   : item.price;
  const displayChange = livePrice ? livePrice.changePct24h           : item.change;
  const up = displayChange >= 0;
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
        <p className="text-sm font-mono font-bold" style={{ color: C.text }}>{displayPrice}</p>
        <p className="text-[11px] font-mono font-semibold" style={{ color: up ? C.positive : C.negative }}>
          {up ? "+" : ""}{displayChange.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}

/* ── Trading sessions ─────────────────────────────────────────────── */
interface Session { name: string; hours: string; tz: string; utcStart: number; utcEnd: number }
const SESSIONS: Session[] = [
  { name: "Sydney",   hours: "22:00–07:00", tz: "AEST", utcStart: 22, utcEnd: 7  },
  { name: "Tokyo",    hours: "23:00–09:00", tz: "JST",  utcStart: 23, utcEnd: 9  },
  { name: "London",   hours: "08:00–17:00", tz: "GMT",  utcStart: 8,  utcEnd: 17 },
  { name: "New York", hours: "13:00–22:00", tz: "EST",  utcStart: 13, utcEnd: 22 },
];
const SCOL: Record<string, string> = { open: "#16a34a", closed: "#888", overlap: "#d97706" };
const SLBL: Record<string, string> = { open: "Open", closed: "Closed", overlap: "Overlap" };

function computeSessionStatuses(): ("open" | "closed" | "overlap")[] {
  const now = new Date();
  const h = now.getUTCHours() + now.getUTCMinutes() / 60;
  const opens = SESSIONS.map(s =>
    s.utcStart > s.utcEnd
      ? h >= s.utcStart || h < s.utcEnd
      : h >= s.utcStart && h < s.utcEnd
  );
  return opens.map((open, i): "open" | "closed" | "overlap" => {
    if (!open) return "closed";
    return opens.some((o, j) => j !== i && o) ? "overlap" : "open";
  });
}

function SessionRow({ s, status, last }: { s: Session; status: "open" | "closed" | "overlap"; last: boolean }) {
  const color = SCOL[status];
  return (
    <div
      className="flex items-center justify-between py-2.5"
      style={last ? {} : { borderBottom: "1px solid rgba(0,0,0,0.07)" }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
          style={{ background: color, boxShadow: status !== "closed" ? `0 0 4px ${color}` : "none" }}
        />
        <div>
          <p className="text-xs font-mono font-semibold" style={{ color: C.text }}>{s.name}</p>
          <p className="text-[10px] font-mono" style={{ color: C.muted }}>{s.hours} {s.tz}</p>
        </div>
      </div>
      <span
        className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
        style={{ color, background: `${color}12`, border: `1px solid ${color}30` }}
      >
        {SLBL[status]}
      </span>
    </div>
  );
}

/* ── Demo summary ─────────────────────────────────────────────────── */
function DemoSummary() {
  const [balance, setBalance] = useState(10000);
  const [trades, setTrades] = useState<{ pnl?: number }[]>([]);

  useEffect(() => {
    try {
      const acc = JSON.parse(localStorage.getItem("pt_account") || "null") as { capital?: number } | null;
      if (acc?.capital) setBalance(acc.capital);
    } catch {}
    try {
      const tr = JSON.parse(localStorage.getItem("pt_trades") || "[]") as { pnl?: number }[];
      if (Array.isArray(tr)) setTrades(tr);
    } catch {}
  }, []);

  const totalPnL = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const winCount = trades.filter(t => (t.pnl ?? 0) > 0).length;
  const winRate  = trades.length ? (winCount / trades.length) * 100 : 0;
  const fmt$  = (v: number) => `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const items = [
    { label: "Balance",   value: fmt$(balance),                                                          color: C.text },
    { label: "Total P&L", value: `${totalPnL >= 0 ? "+" : "-"}${fmt$(totalPnL)}`,                       color: totalPnL >= 0 ? C.positive : C.negative },
    { label: "Win Rate",  value: trades.length ? `${winRate.toFixed(0)}%` : "—",                        color: C.text },
    { label: "# Trades",  value: `${trades.length}`,                                                    color: C.text },
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

/* ── Paper Trading Section ────────────────────────────────────────── */
type PtTrade = {
  id: number; entryPrice: number; exitPrice: number;
  pnl: number; pnlPct: number;
  side?: "long" | "short"; symbol?: string;
};
type PtAccount = { initialCapital: number; balance: number; createdAt: string };

function PaperTradingSection() {
  const [ptAccount, setPtAccount] = useState<PtAccount | null>(null);
  const [ptTrades, setPtTrades] = useState<PtTrade[]>([]);

  const load = () => {
    try {
      const acc = JSON.parse(localStorage.getItem("pt_account") || "null") as PtAccount | null;
      const trades = JSON.parse(localStorage.getItem("pt_trades") || "[]") as PtTrade[];
      setPtAccount(acc);
      setPtTrades(trades);
    } catch {}
  };

  useEffect(() => {
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);

  if (!ptAccount) return null;

  const totalPnl = ptTrades.reduce((s, t) => s + t.pnl, 0);
  const wins = ptTrades.filter(t => t.pnl > 0).length;
  const losses = ptTrades.length - wins;
  const winRate = ptTrades.length > 0 ? (wins / ptTrades.length) * 100 : 0;
  const balance = ptAccount.initialCapital + totalPnl;
  const pnlPct = (totalPnl / ptAccount.initialCapital) * 100;
  const avgWin = wins > 0
    ? ptTrades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / wins
    : 0;

  return (
    <Panel>
      <div className="flex items-center justify-between mb-4">
        <div>
          <SectionLabel>Paper Trading Account</SectionLabel>
          <p className="text-xs font-mono -mt-2" style={{ color: C.muted }}>
            Started {new Date(ptAccount.createdAt).toLocaleDateString()} · ${ptAccount.initialCapital.toLocaleString()} initial capital
          </p>
        </div>
        <Link href="/chart">
          <span className="text-[10px] font-mono flex items-center gap-1 cursor-pointer hover:opacity-70"
            style={{ color: C.sub }}>
            <CandlestickChart className="h-3 w-3" /> Open Charts →
          </span>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="rounded-xl px-3 py-2.5" style={{ background: "#f0f0f0", border: "1px solid rgba(0,0,0,0.07)" }}>
          <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: C.muted }}>Balance</p>
          <p className="text-sm font-mono font-bold" style={{ color: C.text }}>
            ${balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-xl px-3 py-2.5" style={{ background: "#f0f0f0", border: "1px solid rgba(0,0,0,0.07)" }}>
          <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: C.muted }}>Total P&amp;L</p>
          <p className="text-sm font-mono font-bold" style={{ color: totalPnl >= 0 ? C.positive : C.negative }}>
            {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toFixed(2)}
          </p>
          <p className="text-[10px] font-mono" style={{ color: pnlPct >= 0 ? C.positive : C.negative }}>
            {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
          </p>
        </div>
        <div className="rounded-xl px-3 py-2.5" style={{ background: "#f0f0f0", border: "1px solid rgba(0,0,0,0.07)" }}>
          <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: C.muted }}>Trades</p>
          <p className="text-sm font-mono font-bold" style={{ color: C.text }}>{ptTrades.length}</p>
          <p className="text-[10px] font-mono" style={{ color: C.muted }}>{wins}W · {losses}L</p>
        </div>
        <div className="rounded-xl px-3 py-2.5" style={{ background: "#f0f0f0", border: "1px solid rgba(0,0,0,0.07)" }}>
          <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: C.muted }}>Win Rate</p>
          <p className="text-sm font-mono font-bold"
            style={{ color: ptTrades.length > 0 ? (winRate >= 50 ? C.positive : C.negative) : C.text }}>
            {ptTrades.length > 0 ? `${winRate.toFixed(0)}%` : "—"}
          </p>
          {avgWin > 0 && <p className="text-[10px] font-mono" style={{ color: C.muted }}>avg win ${avgWin.toFixed(0)}</p>}
        </div>
      </div>

      {/* Trade history */}
      {ptTrades.length === 0 ? (
        <div className="text-center py-5">
          <CandlestickChart className="h-7 w-7 mx-auto mb-2 opacity-15" style={{ color: C.sub }} />
          <p className="text-xs font-mono" style={{ color: C.muted }}>No trades yet — head to Charts to start trading</p>
          <Link href="/chart">
            <Button variant="outline" size="sm" className="mt-3">Open Charts</Button>
          </Link>
        </div>
      ) : (
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: C.muted }}>Recent Trades</p>
          <div className="flex flex-col gap-1.5 max-h-[240px] overflow-y-auto">
            {[...ptTrades].reverse().slice(0, 15).map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{
                  background: t.pnl >= 0 ? "rgba(22,163,74,0.05)" : "rgba(220,38,38,0.05)",
                  border: `1px solid ${t.pnl >= 0 ? "rgba(22,163,74,0.12)" : "rgba(220,38,38,0.1)"}`,
                }}>
                <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: t.pnl >= 0 ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)" }}>
                  {t.pnl >= 0
                    ? <TrendingUp className="h-3 w-3" style={{ color: C.positive }} />
                    : <TrendingDown className="h-3 w-3" style={{ color: C.negative }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono" style={{ color: C.muted }}>#{ptTrades.length - i}</span>
                    {t.symbol && (
                      <span className="text-[10px] font-mono font-semibold" style={{ color: C.sub }}>
                        {t.symbol.replace("USDT", "/USDT").replace("PERP", " Perp")}
                      </span>
                    )}
                    {t.side && (
                      <span className="text-[9px] font-mono px-1 rounded"
                        style={{ color: t.side === "short" ? C.negative : C.positive, background: t.side === "short" ? "rgba(220,38,38,0.1)" : "rgba(22,163,74,0.1)" }}>
                        {t.side.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono" style={{ color: C.muted }}>
                    ${t.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })} → ${t.exitPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-mono font-bold" style={{ color: t.pnl >= 0 ? C.positive : C.negative }}>
                    {t.pnl >= 0 ? "+" : ""}${Math.abs(t.pnl).toFixed(2)}
                  </p>
                  <p className="text-[10px] font-mono" style={{ color: C.muted }}>
                    {t.pnlPct >= 0 ? "+" : ""}{t.pnlPct.toFixed(2)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetBacktestSummary();
  const { data: backtests, isLoading: loadingBacktests } = useListBacktests();
  const isLoading = loadingSummary || loadingBacktests;

  const livePrices = useBinancePrices(["BTCUSDT", "ETHUSDT"]);
  const [sessionStatuses, setSessionStatuses] = useState<("open" | "closed" | "overlap")[]>(computeSessionStatuses);
  useEffect(() => {
    const id = setInterval(() => setSessionStatuses(computeSessionStatuses()), 30_000);
    return () => clearInterval(id);
  }, []);

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
      const token = localStorage.getItem("tt_token");
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
          {WATCHLIST.map(w => {
            const live = w.binanceKey ? livePrices[w.binanceKey] : undefined;
            const displayPrice  = live ? fmtLivePrice(live.price)   : w.price;
            const displayChange = live ? live.changePct24h           : w.change;
            const up = displayChange >= 0;
            return (
              <div
                key={w.symbol}
                className="rounded-xl px-3 py-2 text-center"
                style={{ background: "#f0f0f0", border: "1px solid rgba(0,0,0,0.07)" }}
              >
                <p className="text-[10px] font-mono mb-1" style={{ color: C.muted }}>{w.symbol}</p>
                <p className="text-sm font-mono font-bold" style={{ color: C.text }}>{displayPrice}</p>
                <p className="text-[11px] font-mono font-semibold"
                  style={{ color: up ? C.positive : C.negative }}>
                  {up ? "+" : ""}{displayChange.toFixed(2)}%
                </p>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Paper Trading Section */}
      <PaperTradingSection />

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
          {WATCHLIST.map((w, i) => (
            <WatchRow
              key={w.symbol}
              item={w}
              last={i === WATCHLIST.length - 1}
              livePrice={w.binanceKey ? livePrices[w.binanceKey] : undefined}
            />
          ))}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <SectionLabel>Trading Sessions</SectionLabel>
            {SESSIONS.map((s, i) => (
              <SessionRow key={s.name} s={s} status={sessionStatuses[i] ?? "closed"} last={i === SESSIONS.length - 1} />
            ))}
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
