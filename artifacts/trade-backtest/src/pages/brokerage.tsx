import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Link } from "wouter";
import {
  RefreshCw, ExternalLink, Wallet, TrendingUp, TrendingDown,
  ShoppingCart, AlertCircle, CheckCircle2, Loader2, X, Plus,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────

interface BrokerageStatus {
  configured: boolean;
  provider: string;
  dataFeed: string;
  signupUrl: string;
  hint: string | null;
}

interface Account {
  equity: number;
  cash: number;
  buyingPower: number;
  portfolioValue: number;
  daytradeCount: number;
  status: string;
  currency: string;
  provider: string;
}

interface Position {
  symbol: string;
  qty: number;
  side: "long" | "short";
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPct: number;
  costBasis: number;
}

interface Order {
  id: string;
  symbol: string;
  qty: number;
  filledQty: number;
  side: string;
  type: string;
  status: string;
  limitPrice: number | null;
  stopPrice: number | null;
  filledAvgPrice: number | null;
  submittedAt: string;
  filledAt: string | null;
}

// ── API helpers ───────────────────────────────────────────────────

function useApiFetch<T>(
  path: string,
  token: string | null,
  deps: unknown[] = [],
): { data: T | null; loading: boolean; error: string | null; refetch: () => void } {
  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tick,    setTick]    = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) return r.json().then((e: { error?: string }) => Promise.reject(new Error(e.error ?? `Request failed (${r.status})`)));
        return r.json();
      })
      .then((d: T) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e: Error) => { if (!cancelled) { setError(e.message); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, token, tick, ...deps]);

  return { data, loading, error, refetch };
}

// ── Sub-components ────────────────────────────────────────────────

function StatCard({ label, value, sub, positive }: {
  label: string; value: string; sub?: string; positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-white/40 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-mono font-semibold ${
        positive === true ? "text-emerald-400" : positive === false ? "text-red-400" : "text-white"
      }`}>{value}</p>
      {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
}

function OrderRow({ order, onCancel }: { order: Order; onCancel: (id: string) => void }) {
  const isPending = order.status === "new" || order.status === "pending_new" || order.status === "accepted";
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02]">
      <td className="py-2.5 pr-3 font-mono text-sm text-white">{order.symbol}</td>
      <td className="py-2.5 pr-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
          order.side === "buy" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
        }`}>{order.side.toUpperCase()}</span>
      </td>
      <td className="py-2.5 pr-3 text-sm text-white/70">{order.qty}</td>
      <td className="py-2.5 pr-3 text-sm text-white/70 capitalize">{order.type}</td>
      <td className="py-2.5 pr-3 text-sm">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${
          order.status === "filled"        ? "border-emerald-500/40 text-emerald-400" :
          order.status === "canceled"      ? "border-white/20 text-white/30" :
          isPending                        ? "border-amber-500/40 text-amber-400" :
                                             "border-white/20 text-white/50"
        }`}>{order.status}</span>
      </td>
      <td className="py-2.5 pr-3 font-mono text-sm text-white/50">
        {order.filledAvgPrice ? `$${order.filledAvgPrice.toFixed(2)}` : "—"}
      </td>
      <td className="py-2.5 text-right">
        {isPending && (
          <button
            onClick={() => onCancel(order.id)}
            className="text-white/30 hover:text-red-400 transition-colors"
            title="Cancel order"
          >
            <X size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Order Form ────────────────────────────────────────────────────

function OrderForm({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const [symbol,  setSymbol]  = useState("AAPL");
  const [qty,     setQty]     = useState("1");
  const [side,    setSide]    = useState<"buy" | "sell">("buy");
  const [type,    setType]    = useState<"market" | "limit">("market");
  const [limitPx, setLimitPx] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        symbol: symbol.toUpperCase(),
        qty: parseFloat(qty),
        side,
        type,
        time_in_force: "day",
      };
      if (type === "limit" && limitPx) body["limit_price"] = parseFloat(limitPx);
      const r = await fetch("/api/brokerage/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const d = await r.json() as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Order failed");
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onSuccess(); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Symbol</label>
          <input
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white/30"
            placeholder="AAPL"
            maxLength={10}
          />
        </div>
        <div>
          <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Quantity</label>
          <input
            value={qty}
            onChange={e => setQty(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white/30"
            placeholder="1"
            type="number"
            min="0.001"
            step="any"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide("buy")}
          className={`py-2 rounded-lg text-sm font-semibold border transition-all ${
            side === "buy"
              ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-400"
              : "border-white/10 text-white/40 hover:border-white/20"
          }`}
        >
          BUY / LONG
        </button>
        <button
          type="button"
          onClick={() => setSide("sell")}
          className={`py-2 rounded-lg text-sm font-semibold border transition-all ${
            side === "sell"
              ? "bg-red-500/20 border-red-500/60 text-red-400"
              : "border-white/10 text-white/40 hover:border-white/20"
          }`}
        >
          SELL / SHORT
        </button>
      </div>

      <div className="flex gap-2">
        {(["market", "limit"] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${
              type === t
                ? "bg-white/10 border-white/30 text-white"
                : "border-white/10 text-white/30 hover:border-white/20"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {type === "limit" && (
        <div>
          <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Limit Price</label>
          <input
            value={limitPx}
            onChange={e => setLimitPx(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white/30"
            placeholder="0.00"
            type="number"
            step="any"
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || success}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
          success
            ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
            : side === "buy"
            ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30"
            : "bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30"
        }`}
      >
        {loading ? (
          <Loader2 size={14} className="inline animate-spin mr-1.5" />
        ) : success ? (
          <CheckCircle2 size={14} className="inline mr-1.5" />
        ) : null}
        {success ? "Order Placed!" : loading ? "Placing…" : `Place ${type} ${side} order`}
      </button>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────

export default function BrokeragePage() {
  const { token } = useAuth();
  const [orderFilter, setOrderFilter] = useState<"open" | "closed" | "all">("open");
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);

  const { data: status }    = useApiFetch<BrokerageStatus>("/brokerage/status", token, []);
  const { data: account, loading: accountLoading, refetch: refetchAccount } =
    useApiFetch<Account>("/brokerage/account", token, [refreshTick]);
  const { data: positions, loading: posLoading, refetch: refetchPositions } =
    useApiFetch<Position[]>("/brokerage/positions", token, [refreshTick]);
  const { data: orders, loading: ordersLoading, refetch: refetchOrders } =
    useApiFetch<Order[]>(`/brokerage/orders?status=${orderFilter}`, token, [orderFilter, refreshTick]);

  // Auto-refresh when a trade is synced from the chart page (same-tab or cross-tab)
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("tradelab_brokerage");
      bc.onmessage = (e: MessageEvent<{ type: string; ts?: number }>) => {
        if (e.data?.type === "trade_synced") {
          const ts = e.data.ts ? new Date(e.data.ts).toLocaleTimeString() : new Date().toLocaleTimeString();
          setLastSyncTime(ts);
          refetchAccount();
          refetchPositions();
          refetchOrders();
        }
      };
    } catch { /* BroadcastChannel not supported */ }
    return () => { try { bc?.close(); } catch { /* ignore */ } };
  }, [refetchAccount, refetchPositions, refetchOrders]);

  // Auto-refresh every 30s while page is visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        refetchAccount();
        refetchPositions();
        refetchOrders();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [refetchAccount, refetchPositions, refetchOrders]);

  const handleCancel = async (orderId: string) => {
    if (!token) return;
    await fetch(`/api/brokerage/orders/${orderId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    refetchOrders();
  };

  const handleOrderSuccess = () => {
    refetchAccount();
    refetchPositions();
    refetchOrders();
  };

  // ── Not connected ────────────────────────────────────────────────

  if (!token) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-white/40 mb-4">Sign in to access live brokerage</p>
          <Link href="/auth/signin" className="text-white underline">Sign in</Link>
        </div>
      </div>
    );
  }

  // ── Not configured ───────────────────────────────────────────────

  if (status && !status.configured) {
    return (
      <div className="min-h-screen bg-[#080808] p-6 md:p-10">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/dashboard" className="text-white/30 hover:text-white text-sm">← Dashboard</Link>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-5">
              <Loader2 size={24} className="text-blue-400 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Brokerage Initializing</h1>
            <p className="text-white/40 text-sm leading-relaxed mb-4">
              The live brokerage integration is managed by the platform. If this page persists,
              please contact support.
            </p>
            <p className="text-white/20 text-xs">
              Paper trading · Real-time IEX data · Alpaca powered
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main dashboard ────────────────────────────────────────────────

  const plPositive = (account?.portfolioValue ?? 0) >= (account?.equity ?? 0);

  return (
    <div className="min-h-screen bg-[#080808] p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/dashboard" className="text-white/30 hover:text-white text-sm">← Dashboard</Link>
            </div>
            <h1 className="text-2xl font-bold text-white">Live Brokerage</h1>
            <p className="text-white/30 text-sm mt-0.5">
              Alpaca Paper Trading · IEX real-time data
              <span className="ml-2 text-emerald-400 text-xs">● Connected</span>
              {lastSyncTime && (
                <span className="ml-3 text-white/20 text-xs">↺ synced from chart at {lastSyncTime}</span>
              )}
            </p>
          </div>
          <button
            onClick={() => { refresh(); refetchAccount(); refetchPositions(); refetchOrders(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-sm transition-all"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {/* Account stats */}
        {accountLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : account ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Portfolio Value"
              value={`$${account.portfolioValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              sub={account.status}
            />
            <StatCard
              label="Equity"
              value={`$${account.equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              positive={plPositive}
            />
            <StatCard
              label="Cash"
              value={`$${account.cash.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            />
            <StatCard
              label="Buying Power"
              value={`$${account.buyingPower.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              sub={`${account.currency} · ${account.daytradeCount} day trades`}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Positions */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-white">Open Positions</h2>
              <Wallet size={15} className="text-white/30" />
            </div>

            {posLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            ) : !Array.isArray(positions) || positions.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-white/20 text-sm">No open positions</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10">
                      {["Symbol", "Qty", "Entry", "Current", "Mkt Value", "Unreal. P&L"].map(h => (
                        <th key={h} className="pb-2 pr-3 text-xs text-white/30 font-normal uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map(p => (
                      <tr key={p.symbol} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-3 pr-3">
                          <span className="font-mono text-sm text-white">{p.symbol}</span>
                          <span className={`ml-2 text-xs ${p.side === "long" ? "text-emerald-400" : "text-red-400"}`}>
                            {p.side}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-sm text-white/70 font-mono">{p.qty}</td>
                        <td className="py-3 pr-3 text-sm text-white/70 font-mono">${p.avgEntryPrice.toFixed(2)}</td>
                        <td className="py-3 pr-3 text-sm text-white font-mono">${p.currentPrice.toFixed(2)}</td>
                        <td className="py-3 pr-3 text-sm text-white/70 font-mono">${p.marketValue.toFixed(2)}</td>
                        <td className="py-3 pr-3">
                          <div className={`flex items-center gap-1 text-sm font-mono ${p.unrealizedPl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {p.unrealizedPl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {p.unrealizedPl >= 0 ? "+" : ""}${p.unrealizedPl.toFixed(2)}
                            <span className="text-xs opacity-60">({(p.unrealizedPlPct * 100).toFixed(2)}%)</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Order form */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-white">Place Order</h2>
              <Plus size={15} className="text-white/30" />
            </div>
            <OrderForm token={token} onSuccess={handleOrderSuccess} />
            <p className="text-white/20 text-[10px] mt-3 text-center">
              Paper trading only · No real money
            </p>
          </div>
        </div>

        {/* Orders */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-white">Order History</h2>
            <div className="flex gap-1">
              {(["open", "closed", "all"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setOrderFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs capitalize transition-all ${
                    orderFilter === f
                      ? "bg-white/10 text-white"
                      : "text-white/30 hover:text-white/60"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {ordersLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          ) : !Array.isArray(orders) || orders.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-white/20 text-sm">No {orderFilter} orders</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    {["Symbol", "Side", "Qty", "Type", "Status", "Fill Px", ""].map(h => (
                      <th key={h} className="pb-2 pr-3 text-xs text-white/30 font-normal uppercase tracking-widest last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <OrderRow key={o.id} order={o} onCancel={handleCancel} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center gap-2 text-xs text-white/20 justify-center pb-4">
          <ShoppingCart size={12} />
          <span>Alpaca Paper Trading · IEX real-time data feed · No real money at risk</span>
          <a
            href="https://alpaca.markets"
            target="_blank"
            rel="noreferrer"
            className="text-white/30 hover:text-white/60 underline"
          >
            alpaca.markets
          </a>
        </div>
      </div>
    </div>
  );
}
