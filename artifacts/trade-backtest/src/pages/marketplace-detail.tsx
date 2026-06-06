import React, { useState, useEffect } from "react";
import { Link, useRoute, useLocation } from "wouter";
import {
  ArrowLeft, ThumbsUp, BarChart2, Loader2, Sparkles, AlertCircle,
  Store, Clock, Users, Target, TrendingUp, Shield, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { API } from "@/lib/api-config";


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

function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="p-4 rounded-2xl space-y-1" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5" style={{ color: color ?? "#6366f1" }} />
        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: color ?? "hsl(var(--foreground))" }}>{value}</p>
      {sub && <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{sub}</p>}
    </div>
  );
}

function ParamRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40">
      <span className="text-sm capitalize text-muted-foreground">{label.replace(/_/g, " ")}</span>
      <span className="text-sm font-mono font-medium">{String(value)}</span>
    </div>
  );
}

export default function MarketplaceDetailPage() {
  const [, params] = useRoute("/marketplace/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const token = localStorage.getItem("tt_token");
  const { toast } = useToast();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [cloning, setCloning] = useState(false);

  const id = params?.id ? parseInt(params.id, 10) : null;

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/marketplace/${id}`)
      .then(r => r.json())
      .then(data => setListing(data))
      .catch(() => toast({ title: "Error", description: "Failed to load listing.", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleVote() {
    if (!token || !listing) return;
    setVoting(true);
    try {
      const res = await fetch(`${API}/marketplace/${listing.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setListing(prev => prev ? { ...prev, voted: data.voted, votes: data.votes } : prev);
      toast({ description: data.voted ? "Upvoted!" : "Vote removed." });
    } finally {
      setVoting(false);
    }
  }

  async function handleClone() {
    if (!token || !listing) return;
    setCloning(true);
    try {
      const res = await fetch(`${API}/strategies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: `${listing.title} (from Marketplace)`,
          description: listing.description,
          type: listing.strategyType,
          symbol: listing.symbol,
          timeframe: listing.timeframe,
          parameters: listing.parameters,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      toast({ title: "Strategy cloned!", description: "It's now in your strategies. You can run backtests on your own data." });
      navigate(`/strategies/${data.id}`);
    } finally {
      setCloning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#6366f1" }} />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <AlertCircle className="h-10 w-10 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">Listing not found.</p>
        <Link href="/marketplace"><Button variant="outline">Back to Marketplace</Button></Link>
      </div>
    );
  }

  const color = TYPE_COLORS[listing.strategyType] ?? "#6366f1";
  const typeLabel = TYPE_LABELS[listing.strategyType] ?? listing.strategyType;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back */}
      <Link href="/marketplace">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:opacity-80">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Marketplace
        </button>
      </Link>

      {/* Header card */}
      <Card style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[11px] px-2.5 py-1 rounded-full font-mono font-medium"
                  style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
                  {typeLabel}
                </span>
                <span className="text-[11px] font-mono px-2 py-1 rounded-lg text-muted-foreground" style={{ background: "var(--glass-bg)" }}>
                  {listing.symbol}
                </span>
                <span className="text-[11px] font-mono px-2 py-1 rounded-lg text-muted-foreground" style={{ background: "var(--glass-bg)" }}>
                  {listing.timeframe}
                </span>
              </div>
              <h1 className="text-xl font-bold mb-2">{listing.title}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">{listing.description}</p>
            </div>
            <button
              onClick={handleVote}
              disabled={!token || voting || listing.userId === user?.id}
              className="flex flex-col items-center gap-1 px-4 py-3 rounded-2xl transition-all flex-shrink-0"
              style={{
                background: listing.voted ? "rgba(99,102,241,0.15)" : "var(--glass-bg)",
                border: `1px solid ${listing.voted ? "rgba(99,102,241,0.4)" : "var(--glass-border)"}`,
                cursor: token && listing.userId !== user?.id ? "pointer" : "not-allowed",
                opacity: token && listing.userId !== user?.id ? 1 : 0.5,
              }}
              title={!token ? "Sign in to vote" : listing.userId === user?.id ? "Cannot vote on own listing" : listing.voted ? "Remove vote" : "Upvote"}
            >
              {voting ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#818cf8" }} /> : (
                <ThumbsUp className="h-4 w-4 text-muted-foreground" style={{ color: listing.voted ? "#818cf8" : undefined }} />
              )}
              <span className="text-sm font-semibold" style={{ color: listing.voted ? "#818cf8" : undefined }}>{listing.votes}</span>
              <span className="text-[9px] font-mono uppercase text-muted-foreground">votes</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> by <span className="text-foreground/70">{listing.authorName}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {new Date(listing.createdAt).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1.5">
              <BarChart2 className="h-3.5 w-3.5" /> {listing.totalBacktests} backtests run
            </span>
          </div>

          {user && listing.userId !== user.id && (
            <Button
              onClick={handleClone}
              disabled={cloning}
              className="w-full mt-2"
              style={{ background: "#6366f1", color: "#fff" }}
            >
              {cloning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Clone to My Strategies & Backtest on My Data
            </Button>
          )}

          {!user && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc" }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              Sign in to clone this strategy and run it on your own data.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aggregated stats */}
      <div>
        <p className="text-[11px] font-mono uppercase tracking-widest mb-3 text-muted-foreground">
          Aggregated Backtest Results
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={TrendingUp}
            label="Avg Return"
            value={listing.avgReturn !== null ? `${listing.avgReturn >= 0 ? "+" : ""}${listing.avgReturn.toFixed(1)}%` : "—"}
            color={listing.avgReturn !== null ? (listing.avgReturn >= 0 ? "#22c55e" : "#ef4444") : undefined}
            sub="across all backtests"
          />
          <StatCard
            icon={Activity}
            label="Sharpe Ratio"
            value={listing.avgSharpe !== null ? listing.avgSharpe.toFixed(2) : "—"}
            color={listing.avgSharpe !== null ? (listing.avgSharpe >= 1.5 ? "#22c55e" : listing.avgSharpe >= 0.8 ? "#f59e0b" : "#ef4444") : undefined}
            sub="risk-adjusted return"
          />
          <StatCard
            icon={Target}
            label="Win Rate"
            value={listing.avgWinRate !== null ? `${listing.avgWinRate.toFixed(1)}%` : "—"}
            color={listing.avgWinRate !== null ? (listing.avgWinRate >= 55 ? "#22c55e" : listing.avgWinRate >= 45 ? "#f59e0b" : "#ef4444") : undefined}
            sub="avg winning trades"
          />
          <StatCard
            icon={Shield}
            label="Max Drawdown"
            value={listing.avgMaxDrawdown !== null ? `-${listing.avgMaxDrawdown.toFixed(1)}%` : "—"}
            color="#ef4444"
            sub="avg peak-to-trough"
          />
        </div>
        {listing.totalBacktests === 0 && (
          <p className="text-sm mt-3 text-center text-muted-foreground">
            No backtests recorded yet. Clone and run your own to contribute stats!
          </p>
        )}
      </div>

      {/* Strategy parameters */}
      <Card style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Strategy Parameters</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {Object.keys(listing.parameters).length === 0 ? (
            <p className="text-sm text-muted-foreground">No parameters defined.</p>
          ) : (
            Object.entries(listing.parameters).map(([k, v]) => <ParamRow key={k} label={k} value={v} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
