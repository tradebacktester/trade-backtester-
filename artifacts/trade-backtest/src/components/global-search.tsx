import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, X, TrendingUp, ArrowRight } from "lucide-react";
import { API_BASE } from "@/lib/api-config";

interface SearchResult {
  value: string;
  label: string;
  name: string;
  category: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const CAT_COLOR: Record<string, string> = {
  Crypto: "#f59e0b",
  Stocks: "#3b82f6",
  Forex: "#10b981",
  Indices: "#06b6d4",
  Commodities: "#ef4444",
  "Indian Indices": "#8b5cf6",
};

const POPULAR = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "AAPL", "NVDA", "TSLA", "XAUUSD", "EURUSD", "SPX500"];

export function GlobalSearch({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/market/search?q=${encodeURIComponent(q)}`);
        const d = await r.json() as { results: SearchResult[] };
        setResults(d.results ?? []);
        setSelected(0);
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 100);
    return () => clearTimeout(timer);
  }, [query]);

  const goTo = useCallback((sym: string) => {
    navigate(`/chart?symbol=${sym}`);
    onClose();
  }, [navigate, onClose]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(s => {
        const next = Math.min(s + 1, results.length - 1);
        listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(s => {
        const next = Math.max(s - 1, 0);
        listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "Enter" && results[selected]) {
      goTo(results[selected]!.value);
    } else if (e.key === "Escape") {
      onClose();
    }
  }, [results, selected, goTo, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[300]"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 z-[301]"
        style={{ top: "12vh", transform: "translateX(-50%)", width: "min(580px, 95vw)" }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "hsl(222,22%,9%)",
            border: "1px solid rgba(255,255,255,0.13)",
            boxShadow: "0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,229,255,0.06)",
          }}
        >
          {/* Search input row */}
          <div
            className="flex items-center gap-3 px-4 py-3.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <Search className="flex-shrink-0" style={{ width: "16px", height: "16px", color: "hsl(190,90%,60%)" }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search markets — BTC, AAPL, EUR/USD, Gold, Nifty…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{
                color: "hsl(220,14%,90%)",
                fontFamily: "'JetBrains Mono', Menlo, monospace",
                caretColor: "hsl(190,90%,60%)",
              }}
            />
            {loading && (
              <div
                className="flex-shrink-0 h-3.5 w-3.5 rounded-full border-2 animate-spin"
                style={{ borderColor: "rgba(0,229,255,0.3)", borderTopColor: "hsl(190,90%,60%)" }}
              />
            )}
            {query && !loading && (
              <button onClick={() => setQuery("")} className="flex-shrink-0 p-0.5 rounded" style={{ color: "hsl(220,14%,45%)" }}>
                <X style={{ width: "13px", height: "13px" }} />
              </button>
            )}
            <kbd
              className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "rgba(255,255,255,0.05)", color: "hsl(220,14%,40%)", border: "1px solid rgba(255,255,255,0.09)", fontFamily: "inherit" }}
            >
              Esc
            </kbd>
          </div>

          {/* Result list */}
          {results.length > 0 ? (
            <div ref={listRef} className="py-1.5 max-h-80 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {results.map((r, i) => {
                const color = CAT_COLOR[r.category] ?? "#6366f1";
                const active = i === selected;
                return (
                  <button
                    key={r.value}
                    onClick={() => goTo(r.value)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-75"
                    style={{
                      background: active ? "rgba(0,229,255,0.07)" : "transparent",
                      borderLeft: `2px solid ${active ? "hsl(190,90%,60%)" : "transparent"}`,
                    }}
                    onMouseEnter={() => setSelected(i)}
                  >
                    <div
                      className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold"
                      style={{ background: `${color}15`, color, border: `1px solid ${color}28` }}
                    >
                      {r.category.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold" style={{ color: "hsl(220,14%,92%)" }}>{r.label}</span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: `${color}12`, color }}
                        >
                          {r.category}
                        </span>
                      </div>
                      <p className="text-[11px] truncate" style={{ color: "hsl(220,14%,48%)" }}>{r.name}</p>
                    </div>
                    <ArrowRight
                      style={{
                        width: "13px", height: "13px", flexShrink: 0,
                        color: active ? "hsl(190,90%,60%)" : "hsl(220,14%,30%)",
                        transition: "color 0.1s",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          ) : query.trim() && !loading ? (
            <div className="px-4 py-10 text-center">
              <Search style={{ width: "26px", height: "26px", margin: "0 auto 10px", color: "hsl(220,14%,35%)" }} />
              <p className="text-sm" style={{ color: "hsl(220,14%,45%)" }}>No results for "{query}"</p>
              <p className="text-[11px] mt-1" style={{ color: "hsl(220,14%,35%)" }}>Try a ticker symbol like BTCUSDT or AAPL</p>
            </div>
          ) : !query.trim() ? (
            <div className="px-4 py-4">
              <p
                className="text-[10px] font-semibold uppercase tracking-wider mb-2.5"
                style={{ color: "hsl(220,14%,40%)", letterSpacing: "0.1em" }}
              >
                Popular markets
              </p>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR.map(sym => (
                  <button
                    key={sym}
                    onClick={() => goTo(sym)}
                    className="text-[12px] font-mono px-3 py-1.5 rounded-lg transition-all duration-100"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      color: "hsl(220,14%,68%)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(0,229,255,0.09)";
                      (e.currentTarget as HTMLElement).style.color = "hsl(190,90%,65%)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,229,255,0.2)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                      (e.currentTarget as HTMLElement).style.color = "hsl(220,14%,68%)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                    }}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Footer shortcuts */}
          <div
            className="px-4 py-2.5 flex items-center gap-4 text-[10px]"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)", color: "hsl(220,14%,35%)" }}
          >
            <span><kbd className="px-1.5 py-0.5 rounded mr-1" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>↑↓</kbd>navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded mr-1" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>↵</kbd>open chart</span>
            <span><kbd className="px-1.5 py-0.5 rounded mr-1" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>⌘K</kbd>toggle</span>
            <TrendingUp style={{ width: "11px", height: "11px", marginLeft: "auto" }} />
          </div>
        </div>
      </div>
    </>
  );
}
