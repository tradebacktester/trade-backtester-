import React, { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useDeleteBacktest, getListBacktestsQueryKey } from "@workspace/api-client-react";
import type { Backtest } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Play, Cpu, TrendingUp, TrendingDown, Activity,
  Trash2, ChevronRight, Search, MoreVertical, BookOpen,
  PenLine, Bell, Loader2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

function formatSymbol(s: string): string {
  const QUOTES = ["USDT", "USDC", "BUSD", "BTC", "ETH", "BNB", "USD"];
  for (const q of QUOTES) {
    if (s.endsWith(q) && s.length > q.length) return `${s.slice(0, s.length - q.length)}/${q}`;
  }
  return s;
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="rounded-2xl p-4 border flex flex-col gap-1.5"
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.042), rgba(255,255,255,0.014))",
        borderColor: "rgba(255,255,255,0.075)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "hsl(218,12%,36%)" }}>{label}</p>
      <p className="text-xl sm:text-2xl font-bold font-mono" style={{ color: color ?? "hsl(218,14%,84%)" }}>{value}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-4 border"
      style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="flex items-start justify-between mb-3">
        <div className="skeleton-shimmer h-4 w-32 rounded-lg" />
        <div className="skeleton-shimmer h-5 w-16 rounded-full" />
      </div>
      <div className="skeleton-shimmer h-7 w-24 rounded-lg mb-2" />
      <div className="flex gap-3 mt-3">
        {[60, 48, 48].map((w, i) => <div key={i} className="skeleton-shimmer h-3 rounded-lg" style={{ width: w }} />)}
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

export default function Journal() {
  const { token } = useAuth();
  const { mutate: deleteBacktest } = useDeleteBacktest();
  const queryClient = useQueryClient();

  const [allItems, setAllItems] = useState<Backtest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [serverHasMore, setServerHasMore] = useState(false);
  const [serverPage, setServerPage] = useState(0);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "wins" | "losses">("all");
  const [sort, setSort] = useState<"date" | "return" | "sharpe" | "winrate">("date");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);

  const fetchPage = useCallback(async (page: number, append: boolean) => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    const r = await fetch(`${API_BASE}/api/backtests?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) return;
    const data = await r.json() as Backtest[];
    if (append) {
      setAllItems(prev => [...prev, ...data]);
    } else {
      setAllItems(data);
    }
    setServerHasMore(data.length === PAGE_SIZE);
    setServerPage(page);
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    fetchPage(0, false).finally(() => setIsLoading(false));
  }, [fetchPage]);

  async function handleLoadMore() {
    setIsLoadingMore(true);
    await fetchPage(serverPage + 1, true);
    setIsLoadingMore(false);
  }

  const completed = allItems.filter(b => b.status === "complete");
  const avgReturn  = completed.length ? completed.reduce((a, b) => a + (b.totalReturn ?? 0), 0) / completed.length : null;
  const bestReturn = completed.length ? Math.max(...completed.map(b => b.totalReturn ?? -Infinity)) : null;

  const filtered = allItems.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q || (b.strategyName ?? "").toLowerCase().includes(q) || (b.symbol ?? "").toLowerCase().includes(q);
    const matchFilter = filter === "all" || (filter === "wins" && (b.totalReturn ?? 0) >= 0) || (filter === "losses" && (b.totalReturn ?? 0) < 0);
    return matchSearch && matchFilter;
  }).sort((a, b) => {
    if (sort === "return") return (b.totalReturn ?? -Infinity) - (a.totalReturn ?? -Infinity);
    if (sort === "sharpe") return (b.sharpeRatio ?? -Infinity) - (a.sharpeRatio ?? -Infinity);
    if (sort === "winrate") return (b.winRate ?? -Infinity) - (a.winRate ?? -Infinity);
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });

  const winCount  = completed.filter(b => (b.totalReturn ?? 0) >= 0).length;
  const lossCount = completed.filter(b => (b.totalReturn ?? 0) < 0).length;

  function handleDelete(id: number) {
    setDeletingId(id);
    deleteBacktest({ id }, {
      onSuccess: () => {
        setAllItems(prev => prev.filter(b => b.id !== id));
        queryClient.invalidateQueries({ queryKey: getListBacktestsQueryKey() });
        setDeletingId(null);
        setMenuId(null);
      },
      onError: () => setDeletingId(null),
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 pb-24 sm:pb-8">

      {/* Header */}
      <div
        className="float-up rounded-2xl px-4 sm:px-5 py-4 border relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.038) 0%, rgba(255,255,255,0.012) 100%)",
          borderColor: "rgba(255,255,255,0.075)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(210,90%,58%), transparent)", opacity: 0.07 }} />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.22)" }}>
              <BookOpen className="h-5 w-5" style={{ color: "hsl(210,90%,65%)" }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: "hsl(218,16%,90%)" }}>
                Trading Journal
              </h1>
              <p className="text-xs sm:text-sm mt-0.5" style={{ color: "hsl(218,12%,40%)" }}>
                All historical backtest runs
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" asChild className="hidden sm:flex">
              <Link href="/backtests/builder">
                <Cpu className="mr-1.5 h-3.5 w-3.5" />
                Builder
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/backtests/new">
                <Play className="mr-1.5 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Run Backtest</span>
                <span className="sm:hidden">Run</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Summary stat cards */}
      {(isLoading || completed.length > 0) && (
        <div className="float-up-1 grid grid-cols-3 gap-2 sm:gap-3">
          {isLoading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl p-4 border"
                style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="skeleton-shimmer h-2.5 w-12 rounded-lg mb-2" />
                <div className="skeleton-shimmer h-7 w-16 rounded-lg" />
              </div>
            ))
          ) : (
            <>
              <StatCard label="Total Runs" value={String(allItems.length)} />
              <StatCard label="Avg Return"
                value={avgReturn != null ? `${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(1)}%` : "—"}
                color={avgReturn != null && avgReturn >= 0 ? "hsl(150,80%,52%)" : "hsl(0,78%,60%)"} />
              <StatCard label="Best" value={bestReturn != null ? `+${bestReturn.toFixed(1)}%` : "—"}
                color="hsl(150,80%,52%)" />
            </>
          )}
        </div>
      )}

      {/* Search + filter */}
      <div className="float-up-2 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
            style={{ color: "hsl(218,12%,38%)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search strategy, symbol…"
            className="w-full h-10 pl-9 pr-3 text-xs sm:text-sm rounded-xl outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "hsl(218,14%,78%)",
            }}
          />
        </div>
        <div className="flex items-center gap-0.5 p-0.5 rounded-xl self-start sm:self-auto"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {(["all", "wins", "losses"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 text-xs font-mono rounded-lg transition-all capitalize"
              style={filter === f
                ? { background: "rgba(59,130,246,0.14)", color: "hsl(210,90%,65%)" }
                : { color: "hsl(218,12%,43%)" }}>
              {f === "all" ? `All ${allItems.length}` : f === "wins" ? `Wins ${winCount}` : `Losses ${lossCount}`}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as typeof sort)}
          className="h-9 px-3 rounded-xl text-xs outline-none self-start sm:self-auto"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "hsl(218,14%,68%)" }}>
          <option value="date">Latest</option>
          <option value="return">Best return</option>
          <option value="sharpe">Best Sharpe</option>
          <option value="winrate">Best win rate</option>
        </select>
      </div>

      {/* Journal cards */}
      <div className="float-up-2 flex flex-col gap-2.5">
        {isLoading ? (
          [1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} />)
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border p-10 flex flex-col items-center gap-4 text-center"
            style={{ borderColor: "rgba(255,255,255,0.06)", borderStyle: "dashed" }}>
            <PenLine className="h-10 w-10 opacity-15" />
            <div>
              <h3 className="text-base font-medium mb-1" style={{ color: "hsl(218,14%,68%)" }}>
                {search || filter !== "all" ? "No matching entries" : "No backtests yet"}
              </h3>
              <p className="text-xs" style={{ color: "hsl(218,12%,36%)" }}>
                {search || filter !== "all"
                  ? "Try adjusting your search or filter"
                  : "Run your first backtest to start building your journal"}
              </p>
            </div>
            {!search && filter === "all" && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/backtests/builder"><Cpu className="mr-1.5 h-3.5 w-3.5" />Builder</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/backtests/new">Run Backtest</Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          filtered.map((bt, i) => {
            const isPos = (bt.totalReturn ?? 0) >= 0;
            const isDeleting = deletingId === bt.id;
            return (
              <div key={bt.id} className="relative rounded-2xl border transition-all duration-200"
                style={{
                  background: "linear-gradient(145deg, rgba(255,255,255,0.038), rgba(255,255,255,0.012))",
                  borderColor: "rgba(255,255,255,0.075)",
                  boxShadow: "0 4px 18px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
                  opacity: isDeleting ? 0.45 : 1,
                  transition: "opacity 0.2s ease, box-shadow 0.2s ease",
                }}>
                <div className="flex items-start gap-3 p-3 sm:p-4">

                  {/* Left color strip */}
                  <div className="hidden sm:block w-[3px] self-stretch rounded-full flex-shrink-0"
                    style={{ background: `linear-gradient(180deg, ${isPos ? "rgba(52,211,153,0.7)" : "rgba(239,68,68,0.7)"}, transparent)` }} />

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <Link href={`/strategies/${bt.strategyId}`}
                        className="text-sm sm:text-base font-semibold truncate"
                        style={{ color: "hsl(210,90%,65%)" }}>
                        {bt.strategyName || `Strategy #${bt.strategyId}`}
                      </Link>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isPos
                          ? <TrendingUp className="h-3.5 w-3.5" style={{ color: "hsl(150,80%,55%)" }} />
                          : <TrendingDown className="h-3.5 w-3.5" style={{ color: "hsl(0,78%,60%)" }} />}
                        <span className="text-base sm:text-lg font-bold font-mono"
                          style={{ color: isPos ? "hsl(150,80%,55%)" : "hsl(0,78%,60%)" }}>
                          {isPos ? "+" : ""}{(bt.totalReturn ?? 0).toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-3">
                      <span className="text-xs font-mono px-2 py-0.5 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.05)", color: "hsl(218,12%,52%)" }}>
                        {formatSymbol(bt.symbol ?? "")}
                      </span>
                      <span className="text-[11px]" style={{ color: "hsl(218,12%,36%)" }}>
                        {bt.startDate} → {bt.endDate}
                      </span>
                      {(bt as any).dataSource === "simulated" && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border"
                          style={{ background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.22)", color: "hsl(38,95%,60%)" }}>
                          SIM
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border"
                        style={bt.status === "complete"
                          ? { background: "rgba(34,197,94,0.07)", borderColor: "rgba(34,197,94,0.18)", color: "hsl(150,76%,52%)" }
                          : bt.status === "failed"
                          ? { background: "rgba(239,68,68,0.07)", borderColor: "rgba(239,68,68,0.18)", color: "hsl(0,78%,58%)" }
                          : { background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.18)", color: "hsl(38,95%,58%)" }}>
                        {bt.status}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Max DD",   value: bt.maxDrawdown  != null ? `-${Math.abs(bt.maxDrawdown).toFixed(1)}%`    : "—", color: "hsl(0,78%,60%)" },
                        { label: "Sharpe",   value: bt.sharpeRatio  != null ? bt.sharpeRatio.toFixed(2)                     : "—", color: "hsl(218,14%,68%)" },
                        { label: "Win Rate", value: bt.winRate      != null ? `${bt.winRate.toFixed(1)}%`                   : "—", color: "hsl(218,14%,68%)" },
                      ].map(stat => (
                        <div key={stat.label} className="rounded-xl px-2 py-1.5"
                          style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.055)" }}>
                          <p className="text-[9px] font-mono uppercase tracking-widest mb-0.5"
                            style={{ color: "hsl(218,12%,33%)" }}>{stat.label}</p>
                          <p className="text-xs sm:text-sm font-mono font-semibold" style={{ color: stat.color }}>
                            {stat.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <Link href={`/backtests/${bt.id}`}
                      className="h-8 w-8 flex items-center justify-center rounded-xl transition-all"
                      style={{
                        background: "rgba(59,130,246,0.08)",
                        border: "1px solid rgba(59,130,246,0.18)",
                        color: "hsl(210,90%,65%)",
                      }}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                    <div className="relative">
                      <button
                        onClick={e => { e.stopPropagation(); setMenuId(menuId === bt.id ? null : bt.id); }}
                        className="h-8 w-8 flex items-center justify-center rounded-xl transition-all"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.07)",
                          color: "hsl(218,12%,43%)",
                        }}>
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>

                      {menuId === bt.id && (
                        <div className="absolute right-0 top-10 z-30 rounded-2xl p-1.5 w-36 shadow-2xl"
                          style={{
                            background: "hsl(222, 22%, 11%)",
                            border: "1px solid rgba(255,255,255,0.09)",
                            boxShadow: "0 20px 48px rgba(0,0,0,0.6)",
                          }}>
                          <Link href={`/backtests/${bt.id}`}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-all hover:bg-white/5"
                            style={{ color: "hsl(218,14%,68%)" }}
                            onClick={() => setMenuId(null)}>
                            <ChevronRight className="h-3.5 w-3.5" />
                            View results
                          </Link>
                          <Link href={`/alerts?from=backtest&id=${bt.id}&symbol=${encodeURIComponent(bt.symbol ?? "")}`}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-all hover:bg-white/5"
                            style={{ color: "hsl(265,89%,65%)" }}
                            onClick={() => setMenuId(null)}>
                            <Bell className="h-3.5 w-3.5" />
                            Create Alert
                          </Link>
                          <button
                            onClick={() => handleDelete(bt.id)}
                            disabled={isDeleting}
                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-all hover:bg-red-500/10"
                            style={{ color: "hsl(0,78%,60%)" }}>
                            <Trash2 className="h-3.5 w-3.5" />
                            {isDeleting ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Mobile builder FAB */}
      <div className="sm:hidden fixed bottom-24 right-4 z-20">
        <Button variant="outline" size="sm" asChild className="shadow-xl rounded-2xl">
          <Link href="/backtests/builder">
            <Cpu className="mr-1.5 h-3.5 w-3.5" />
            Builder
          </Link>
        </Button>
      </div>

      {serverHasMore && (
        <button
          onClick={handleLoadMore}
          disabled={isLoadingMore}
          className="w-full py-3 rounded-2xl text-[13px] font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            color: "hsl(218,12%,50%)",
          }}
        >
          {isLoadingMore ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
          ) : (
            `Load more backtests (page ${serverPage + 2})`
          )}
        </button>
      )}
      {!serverHasMore && allItems.length >= PAGE_SIZE && (
        <p className="text-center text-[11px] py-2" style={{ color: "hsl(218,12%,36%)" }}>
          All {allItems.length} backtests loaded
        </p>
      )}

      {menuId !== null && (
        <div className="fixed inset-0 z-20" onClick={() => setMenuId(null)} />
      )}
    </div>
  );
}
