import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  Store, TrendingUp, ChevronRight, Award, Search, Filter,
  ThumbsUp, BarChart2, Users, Loader2, X, ArrowLeft,
  Star, Clock, Sparkles, AlertCircle, Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

const API = "/api";

type Listing = {
  id: number;
  userId: number;
  authorName: string;
  title: string;
  description: string;
  strategyType: string;
  symbol: string;
  timeframe: string;
  parameters: Record<string, unknown>;
  avgSharpe: number | null;
  avgReturn: number | null;
  avgWinRate: number | null;
  avgMaxDrawdown: number | null;
  totalBacktests: number;
  votes: number;
  voted: boolean;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  sma_crossover: "SMA Crossover",
  ema_crossover: "EMA Crossover",
  rsi: "RSI",
  macd: "MACD",
  bollinger_bands: "Bollinger Bands",
};

const TYPE_COLORS: Record<string, string> = {
  sma_crossover: "#6366f1",
  ema_crossover: "#8b5cf6",
  rsi: "#f59e0b",
  macd: "#06b6d4",
  bollinger_bands: "#10b981",
};

function MetricPill({ label, value, color }: { label: string; value: string | null; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,40%)" }}>{label}</span>
      <span className="text-[13px] font-semibold" style={{ color: value !== null ? (color ?? "hsl(220,14%,80%)") : "hsl(220,14%,35%)" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function ListingCard({ listing, token, onVote }: {
  listing: Listing;
  token: string | null;
  onVote: (id: number, currentVoted: boolean) => void;
}) {
  const [, navigate] = useLocation();
  const color = TYPE_COLORS[listing.strategyType] ?? "#6366f1";
  const label = TYPE_LABELS[listing.strategyType] ?? listing.strategyType;

  const sharpeColor = listing.avgSharpe === null ? undefined
    : listing.avgSharpe >= 1.5 ? "#22c55e" : listing.avgSharpe >= 0.8 ? "#f59e0b" : "#ef4444";

  return (
    <Card
      className="cursor-pointer group transition-all duration-200 hover:scale-[1.01]"
      style={{ background: "hsl(222,20%,10%)", border: "1px solid rgba(255,255,255,0.07)" }}
      onClick={() => navigate(`/marketplace/${listing.id}`)}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium"
                style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
                {label}
              </span>
              <span className="text-[10px] font-mono" style={{ color: "hsl(220,14%,40%)" }}>{listing.symbol}</span>
              <span className="text-[10px] font-mono" style={{ color: "hsl(220,14%,35%)" }}>{listing.timeframe}</span>
            </div>
            <h3 className="text-[15px] font-semibold truncate" style={{ color: "hsl(220,14%,88%)" }}>{listing.title}</h3>
            <p className="text-[12px] mt-1 line-clamp-2" style={{ color: "hsl(220,14%,50%)" }}>{listing.description}</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); if (token) onVote(listing.id, listing.voted); }}
            disabled={!token}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all flex-shrink-0"
            style={{
              background: listing.voted ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${listing.voted ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.07)"}`,
              cursor: token ? "pointer" : "not-allowed",
              opacity: token ? 1 : 0.5,
            }}
            title={token ? (listing.voted ? "Remove vote" : "Upvote") : "Sign in to vote"}
          >
            <ThumbsUp className="h-3.5 w-3.5" style={{ color: listing.voted ? "#818cf8" : "hsl(220,14%,50%)" }} />
            <span className="text-[11px] font-semibold" style={{ color: listing.voted ? "#818cf8" : "hsl(220,14%,55%)" }}>{listing.votes}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <MetricPill label="Sharpe" value={listing.avgSharpe !== null ? listing.avgSharpe.toFixed(2) : null} color={sharpeColor} />
          <MetricPill label="Avg Return" value={listing.avgReturn !== null ? `${listing.avgReturn >= 0 ? "+" : ""}${listing.avgReturn.toFixed(1)}%` : null}
            color={listing.avgReturn !== null ? (listing.avgReturn >= 0 ? "#22c55e" : "#ef4444") : undefined} />
          <MetricPill label="Win Rate" value={listing.avgWinRate !== null ? `${listing.avgWinRate.toFixed(1)}%` : null} />
          <MetricPill label="Max DD" value={listing.avgMaxDrawdown !== null ? `-${listing.avgMaxDrawdown.toFixed(1)}%` : null} color="#ef4444" />
          <MetricPill label="Backtests" value={listing.totalBacktests.toString()} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px]" style={{ color: "hsl(220,14%,38%)" }}>
            by <span style={{ color: "hsl(220,14%,55%)" }}>{listing.authorName}</span>
            {" · "}{new Date(listing.createdAt).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1 text-[11px] group-hover:text-indigo-400 transition-colors" style={{ color: "hsl(220,14%,40%)" }}>
            View strategy <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function PublishModal({
  open, onClose, token, userId, onPublished,
}: {
  open: boolean;
  onClose: () => void;
  token: string | null;
  userId: number | null;
  onPublished: () => void;
}) {
  const { toast } = useToast();
  const [strategies, setStrategies] = useState<Array<{ id: number; name: string; type: string; symbol: string; timeframe: string }>>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<number | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    fetch(`${API}/strategies`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setStrategies(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [open, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStrategy || !token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/marketplace`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ strategyId: selectedStrategy, authorName, title, description }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      toast({ title: "Published!", description: "Your strategy is now in the marketplace." });
      onPublished();
      onClose();
      setTitle(""); setDescription(""); setAuthorName(""); setSelectedStrategy(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-5" style={{ background: "hsl(222,20%,10%)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: "hsl(220,14%,88%)" }}>Publish Strategy</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
            <X className="h-4 w-4" style={{ color: "hsl(220,14%,50%)" }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-widest mb-2 block" style={{ color: "hsl(220,14%,45%)" }}>Choose Strategy</label>
            <select
              value={selectedStrategy ?? ""}
              onChange={e => setSelectedStrategy(Number(e.target.value))}
              required
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "hsl(220,14%,80%)" }}
            >
              <option value="">Select a strategy…</option>
              {strategies.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.type} / {s.symbol}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-widest mb-2 block" style={{ color: "hsl(220,14%,45%)" }}>Your Display Name</label>
            <Input
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
              placeholder="e.g. CryptoTrader99"
              required
              minLength={2}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "hsl(220,14%,80%)" }}
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-widest mb-2 block" style={{ color: "hsl(220,14%,45%)" }}>Listing Title</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. RSI Reversal on BTC — High Win Rate"
              required
              minLength={5}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "hsl(220,14%,80%)" }}
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-widest mb-2 block" style={{ color: "hsl(220,14%,45%)" }}>Strategy Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what this strategy does, the market conditions it targets, and why it works…"
              required
              minLength={20}
              rows={4}
              className="w-full px-3 py-2 rounded-xl text-sm resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "hsl(220,14%,80%)" }}
            />
            <p className="text-[10px] mt-1" style={{ color: "hsl(220,14%,35%)" }}>
              Share the logic, not the code. Others will verify results via their own backtests.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={submitting} className="flex-1" style={{ background: "#6366f1", color: "#fff" }}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Publish
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const { user } = useAuth();
  const token = localStorage.getItem("tt_token");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSymbol, setFilterSymbol] = useState("");
  const [showPublish, setShowPublish] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("type", filterType);
      if (filterSymbol) params.set("symbol", filterSymbol);
      const res = await fetch(`${API}/marketplace?${params}`);
      const data = await res.json();
      setListings(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Error", description: "Failed to load marketplace.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filterType, filterSymbol]);

  useEffect(() => { load(); }, [load]);

  async function handleVote(id: number, currentVoted: boolean) {
    if (!token) return;
    try {
      const res = await fetch(`${API}/marketplace/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setListings(prev => prev.map(l => l.id === id ? { ...l, voted: data.voted, votes: data.votes } : l));
    } catch {
      toast({ title: "Error", description: "Vote failed.", variant: "destructive" });
    }
  }

  const filtered = listings.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.title.toLowerCase().includes(q)
      || l.description.toLowerCase().includes(q)
      || l.symbol.toLowerCase().includes(q)
      || l.authorName.toLowerCase().includes(q);
  });

  const allTypes = [...new Set(listings.map(l => l.strategyType))];
  const allSymbols = [...new Set(listings.map(l => l.symbol))].slice(0, 12);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Store className="h-5 w-5" style={{ color: "#6366f1" }} />
            <h1 className="text-xl font-bold" style={{ color: "hsl(220,14%,88%)" }}>Strategy Marketplace</h1>
          </div>
          <p className="text-sm" style={{ color: "hsl(220,14%,50%)" }}>
            Discover strategies rated by real backtest results — not hype.
          </p>
        </div>
        {user ? (
          <Button
            onClick={() => setShowPublish(true)}
            className="flex items-center gap-2 self-start"
            style={{ background: "#6366f1", color: "#fff" }}
          >
            <Sparkles className="h-4 w-4" />
            Publish Strategy
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
            <AlertCircle className="h-4 w-4" />
            Sign in to publish
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 flex-wrap">
        {[
          { icon: Store, label: "Listings", value: listings.length.toString() },
          { icon: Users, label: "Avg Backtests", value: listings.length > 0 ? Math.round(listings.reduce((a, b) => a + b.totalBacktests, 0) / listings.length).toString() : "0" },
          { icon: Award, label: "Most Voted", value: listings.length > 0 ? listings[0]?.votes.toString() ?? "0" : "0" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl" style={{ background: "hsl(222,20%,10%)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Icon className="h-3.5 w-3.5" style={{ color: "#6366f1" }} />
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(220,14%,40%)" }}>{label}</p>
              <p className="text-sm font-semibold" style={{ color: "hsl(220,14%,85%)" }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "hsl(220,14%,45%)" }} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, description, symbol…"
            className="pl-9"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "hsl(220,14%,80%)" }}
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "hsl(220,14%,65%)" }}
        >
          <option value="">All Types</option>
          {allTypes.map(t => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
        </select>
        <select
          value={filterSymbol}
          onChange={e => setFilterSymbol(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "hsl(220,14%,65%)" }}
        >
          <option value="">All Symbols</option>
          {allSymbols.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Listings */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#6366f1" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Store className="h-12 w-12" style={{ color: "hsl(220,14%,25%)" }} />
          <p className="text-base font-medium" style={{ color: "hsl(220,14%,50%)" }}>
            {listings.length === 0 ? "No strategies published yet. Be the first!" : "No results match your search."}
          </p>
          {listings.length === 0 && user && (
            <Button onClick={() => setShowPublish(true)} size="sm" style={{ background: "#6366f1", color: "#fff" }}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Publish First Strategy
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(l => (
            <ListingCard key={l.id} listing={l} token={token} onVote={handleVote} />
          ))}
        </div>
      )}

      <PublishModal
        open={showPublish}
        onClose={() => setShowPublish(false)}
        token={token}
        userId={user?.id ?? null}
        onPublished={load}
      />
    </div>
  );
}
