import { useState, useRef, useEffect } from "react";
import { ChevronDown, Settings } from "lucide-react";
import { T } from "./styles";

type SymbolDef = {
  value: string;
  label: string;
  category: string;
  sim: boolean;
  basePrice: number;
};

interface ChartHeaderProps {
  symbols: readonly SymbolDef[];
  symbol: string;
  displayLabel: string;
  displayCategory: string;
  currentPrice: number | null;
  changePercent: string;
  isUp: boolean;
  isSim: boolean;
  interval: string;
  replayMode: boolean;
  onSymbolChange: (val: string) => void;
  onSettingsClick: () => void;
}

const CATEGORIES = ["Crypto", "Futures", "Forex", "Indices", "Commodities", "Stocks"] as const;

export function ChartHeader({
  symbols, symbol, displayLabel, displayCategory,
  currentPrice, changePercent, isUp, isSim,
  interval, replayMode, onSymbolChange, onSettingsClick,
}: ChartHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery]           = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 60);
  }, [searchOpen]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? symbols.filter(s =>
        s.label.toLowerCase().includes(query.toLowerCase()) ||
        s.value.toLowerCase().includes(query.toLowerCase())
      )
    : symbols;

  const grouped = CATEGORIES.map(cat => ({
    cat,
    items: filtered.filter(s => s.category === cat),
  })).filter(g => g.items.length > 0);

  function selectSymbol(val: string) {
    onSymbolChange(val);
    setSearchOpen(false);
    setQuery("");
  }

  const pxColor = currentPrice === null ? T.sub : isUp ? T.green : T.red;
  const exchange = isSim ? "Simulated" : displayCategory === "Crypto" ? "Binance" : "Yahoo Finance";
  const status   = replayMode ? "REPLAY" : isSim ? "Sim" : "Live";

  return (
    <div style={{
      height: 64, minHeight: 64,
      background: T.surface,
      borderBottom: `1px solid ${T.border}`,
      display: "flex", alignItems: "center",
      paddingInline: 16, gap: 12,
      position: "relative", zIndex: 80,
      flexShrink: 0,
    }}>
      {/* Pair selector */}
      <div ref={containerRef} style={{ position: "relative" }}>
        <button
          onClick={() => setSearchOpen(v => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "transparent", border: "none",
            cursor: "pointer", padding: 0,
          }}
        >
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 18, fontWeight: 600,
            color: T.text, letterSpacing: "-0.01em",
          }}>{displayLabel}</span>
          <ChevronDown size={12} color={T.sub} />
        </button>

        {searchOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0,
            width: 280, maxHeight: 380,
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 12,
            boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
            zIndex: 200, overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search symbol…"
                style={{
                  width: "100%", background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${T.border}`, borderRadius: 8,
                  padding: "7px 10px", fontSize: 13, fontFamily: "monospace",
                  color: T.text, outline: "none",
                }}
              />
            </div>
            <div style={{ overflowY: "auto", maxHeight: 320 }}>
              {grouped.map(({ cat, items }) => (
                <div key={cat}>
                  <div style={{
                    padding: "6px 12px 2px",
                    fontSize: 10, fontFamily: "monospace",
                    color: T.muted, letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>{cat}</div>
                  {items.map(s => (
                    <button
                      key={s.value}
                      onClick={() => selectSymbol(s.value)}
                      style={{
                        width: "100%", textAlign: "left",
                        padding: "9px 12px", background: s.value === symbol ? "rgba(0,122,255,0.12)" : "transparent",
                        border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 8,
                        color: s.value === symbol ? T.blue : T.text,
                        fontSize: 13, fontFamily: "monospace",
                      }}
                    >
                      <span style={{ flex: 1 }}>{s.label}</span>
                      {s.sim && <span style={{ fontSize: 9, color: T.muted }}>SIM</span>}
                    </button>
                  ))}
                </div>
              ))}
              {grouped.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: T.muted, fontFamily: "monospace" }}>
                  No results
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Price block */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1, marginLeft: 4 }}>
        {currentPrice !== null ? (
          <>
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 24, fontWeight: 700,
              color: pxColor, letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums", lineHeight: 1,
            }}>
              {currentPrice.toLocaleString(undefined, {
                minimumFractionDigits: currentPrice < 1 ? 4 : 2,
                maximumFractionDigits: currentPrice < 1 ? 6 : 2,
              })}
            </span>
            <span style={{
              fontSize: 12, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500,
              color: isUp ? T.green : T.red,
            }}>
              {isUp ? "+" : ""}{changePercent}% Today
            </span>
          </>
        ) : (
          <span style={{ fontSize: 14, color: T.muted, fontFamily: "monospace" }}>Loading…</span>
        )}
      </div>

      {/* Meta line */}
      <span style={{
        marginLeft: "auto",
        fontSize: 11, fontFamily: "'Space Grotesk', sans-serif",
        color: T.sub, letterSpacing: "0.01em",
        whiteSpace: "nowrap",
      }}>
        {exchange} · {status} · {interval.toUpperCase()}
      </span>

      {/* Settings */}
      <button
        onClick={onSettingsClick}
        title="Settings"
        style={{
          width: 32, height: 32, borderRadius: 8,
          background: "rgba(255,255,255,0.06)",
          border: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0,
        }}
      >
        <Settings size={15} color={T.sub} />
      </button>
    </div>
  );
}
