import React, { useMemo, useRef, useCallback, useState } from "react";
import { type FootprintCandle } from "@/hooks/useFootprintData";

export type ChartMode = "bidask" | "delta" | "volume" | "imbalance" | "cvd";

const MIN_ROW_HEIGHT = 14;
const MAX_ROW_HEIGHT = 36;
const DEFAULT_ROW_HEIGHT = 19;

interface FootprintGridProps {
  candles: FootprintCandle[];
  mode: ChartMode;
  selectedCandleIdx: number;
  onSelectCandle: (idx: number) => void;
  /** If false, absorption visuals are hidden (Elite-only feature) */
  isElite?: boolean;
}

function fmtVol(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function fmtPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

function fmtDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  } catch { return ""; }
}

function heatColor(normalizedVol: number, isDark: boolean): string {
  const v = Math.max(0, Math.min(1, normalizedVol));
  if (v < 0.5) {
    const t = v * 2;
    const r = Math.round(isDark ? 20 + t * 30 : 220 - t * 80);
    const g = Math.round(isDark ? 40 + t * 80 : 220 - t * 20);
    const b = Math.round(isDark ? 80 + t * 40 : 255 - t * 100);
    return `rgba(${r},${g},${b},${0.15 + v * 0.35})`;
  }
  const t = (v - 0.5) * 2;
  const r = Math.round(isDark ? 50 + t * 200 : 140 + t * 115);
  const g = Math.round(isDark ? 120 + t * 77 : 60 - t * 20);
  const b = Math.round(isDark ? 120 - t * 100 : 20);
  return `rgba(${r},${g},${b},${0.3 + v * 0.5})`;
}

interface LiquidityZoneData {
  hvnPrices: Set<string>;
  lvnPrices: Set<string>;
  /** HVN prices that have been tested 2+ times within ±0.1% — acceptance zones */
  acceptancePrices: Set<string>;
  /** HVN prices that were touched once but price rebounded — rejection zones */
  rejectionPrices: Set<string>;
}

function computeLiquidityZones(candles: FootprintCandle[]): LiquidityZoneData {
  const volByPrice = new Map<string, number>();
  const touchCountByPrice = new Map<string, number>();

  for (const c of candles) {
    const pricesThisCandle = new Set<string>();
    for (const l of c.levels) {
      const key = l.price.toFixed(4);
      volByPrice.set(key, (volByPrice.get(key) ?? 0) + l.totalVol);
      pricesThisCandle.add(key);
    }
    // Count candles that "touched" each price level (i.e., price was within the candle's range)
    for (const key of pricesThisCandle) {
      const p = parseFloat(key);
      if (p >= c.low && p <= c.high) {
        touchCountByPrice.set(key, (touchCountByPrice.get(key) ?? 0) + 1);
      }
    }
  }

  const vols = Array.from(volByPrice.values()).sort((a, b) => a - b);
  const p10 = vols[Math.floor(vols.length * 0.10)] ?? 0;
  const p90 = vols[Math.floor(vols.length * 0.90)] ?? Infinity;

  const hvnPrices = new Set<string>();
  const lvnPrices = new Set<string>();
  const acceptancePrices = new Set<string>();
  const rejectionPrices = new Set<string>();

  for (const [key, v] of volByPrice.entries()) {
    if (v >= p90) hvnPrices.add(key);
    if (v <= p10) lvnPrices.add(key);
  }

  // Acceptance/Rejection zone logic:
  // For each HVN, look at grouped keys within ±0.1% of each other.
  // If a cluster of HVN prices was touched 2+ times across candles → acceptance zone (price accepted value there).
  // If touched only once and price quickly left → rejection zone.
  for (const key of hvnPrices) {
    const p = parseFloat(key);
    const threshold = p * 0.001; // 0.1%
    let clusterTouches = 0;

    // Count touches for all HVN prices within ±0.1% of this price
    for (const [k2, touches] of touchCountByPrice.entries()) {
      const p2 = parseFloat(k2);
      if (Math.abs(p2 - p) <= threshold && hvnPrices.has(k2)) {
        clusterTouches += touches;
      }
    }

    if (clusterTouches >= 2) {
      acceptancePrices.add(key);
    } else {
      rejectionPrices.add(key);
    }
  }

  return { hvnPrices, lvnPrices, acceptancePrices, rejectionPrices };
}

function LiquidityBadge({ type }: { type: "HVN" | "LVN" | "ACC" | "REJ" }) {
  const cfg: Record<string, { color: string; bg: string; border: string; label: string }> = {
    HVN: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)",  label: "HVN" },
    LVN: { color: "#6366f1", bg: "rgba(99,102,241,0.10)", border: "rgba(99,102,241,0.25)", label: "LVN" },
    ACC: { color: "#22c55e", bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.3)",   label: "ACC" },
    REJ: { color: "#ef4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.25)",  label: "REJ" },
  };
  const c = cfg[type]!;
  return (
    <span style={{
      fontSize: "7px", padding: "1px 3px", borderRadius: "3px",
      fontWeight: 700, letterSpacing: "0.04em",
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      marginLeft: "3px", flexShrink: 0,
    }}>{c.label}</span>
  );
}

function CandleColumn({
  candle, isSelected, mode, rowHeight, onSelect,
  lzData, maxVol, isDark, isElite,
}: {
  candle: FootprintCandle;
  isSelected: boolean;
  mode: ChartMode;
  rowHeight: number;
  onSelect: () => void;
  lzData: LiquidityZoneData;
  maxVol: number;
  isDark: boolean;
  isElite?: boolean;
}) {
  const bullish = candle.close >= candle.open;
  const candleMaxVol = Math.max(...candle.levels.map(l => l.totalVol), 1);
  const fontSize = Math.max(7, Math.min(10, rowHeight - 6));

  return (
    <div
      onClick={onSelect}
      style={{
        display: "flex", flexDirection: "column", gap: "1px",
        cursor: "pointer", minWidth: "120px", flexShrink: 0,
        borderLeft: `2px solid ${isSelected ? "hsl(var(--foreground))" : "transparent"}`,
        background: isSelected ? "hsl(var(--muted)/0.5)" : "transparent",
        padding: "2px",
        borderRadius: "4px",
      }}
    >
      {/* Candle header — time + signals */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px", borderRadius: "3px", background: bullish ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", minHeight: `${rowHeight}px` }}>
        <span style={{ fontSize: "9px", fontWeight: 700, color: bullish ? "#22c55e" : "#ef4444", fontFamily: "var(--app-font-mono)" }}>
          {fmtDate(candle.date)}
        </span>
        <div style={{ display: "flex", gap: "3px" }}>
          {candle.isExhaustion && (
            <span style={{ fontSize: "7px", padding: "1px 3px", borderRadius: "3px", background: "rgba(239,68,68,0.15)", color: "#ef4444", fontWeight: 700, letterSpacing: "0.04em" }}>EX</span>
          )}
          {candle.isDivergence && (
            <span style={{ fontSize: "7px", padding: "1px 3px", borderRadius: "3px", background: "rgba(168,85,247,0.15)", color: "#a855f7", fontWeight: 700, letterSpacing: "0.04em" }}>DIV</span>
          )}
        </div>
      </div>

      {/* Price levels — sorted high to low (matching price axis) */}
      {[...candle.levels].reverse().map((level, i) => {
        const priceKey = level.price.toFixed(4);
        const isHvn = lzData.hvnPrices.has(priceKey);
        const isLvn = lzData.lvnPrices.has(priceKey);
        const isAcc = lzData.acceptancePrices.has(priceKey);
        const isRej = lzData.rejectionPrices.has(priceKey);
        const normalizedVol = level.totalVol / candleMaxVol;

        let bg = "transparent";
        let borderLeft = "none";

        if (mode === "volume") {
          bg = heatColor(normalizedVol, isDark);
        } else if (mode === "imbalance" && level.isImbalance) {
          bg = level.askVol > level.bidVol ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)";
          borderLeft = `2px solid ${level.askVol > level.bidVol ? "#22c55e" : "#ef4444"}`;
        }

        // Absorption border stripes — Elite-only
        if (isElite && level.isBuyAbsorption) borderLeft = "2px solid #22c55e";
        if (isElite && level.isSellAbsorption) borderLeft = "2px solid #ef4444";

        // Acceptance zone: subtle green left stripe + highlight
        if (isAcc) { bg = "rgba(34,197,94,0.05)"; borderLeft = "2px solid rgba(34,197,94,0.4)"; }
        // Rejection zone: subtle red left stripe
        if (isRej) borderLeft = "2px solid rgba(239,68,68,0.35)";
        // LVN gets a dotted border
        if (isLvn && !isAcc && !isRej) borderLeft = "2px dotted rgba(99,102,241,0.4)";
        // HVN that's neither ACC nor REJ: amber
        if (isHvn && !isAcc && !isRej) bg = "rgba(245,158,11,0.04)";

        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: "2px",
            padding: `0 4px`,
            fontSize: `${fontSize}px`,
            background: bg,
            borderLeft,
            borderRadius: "2px",
            minHeight: `${rowHeight}px`,
            transition: "background 0.1s",
            fontFamily: "var(--app-font-mono)",
          }}>
            {mode === "bidask" && (
              <>
                <span style={{ color: "#ef4444", minWidth: "28px", textAlign: "right" }}>{fmtVol(level.bidVol)}</span>
                <span style={{ color: "hsl(var(--border))" }}>×</span>
                <span style={{ color: "#22c55e", minWidth: "28px" }}>{fmtVol(level.askVol)}</span>
              </>
            )}
            {mode === "delta" && (
              <span style={{ color: level.delta >= 0 ? "#22c55e" : "#ef4444", minWidth: "56px", textAlign: "center" }}>
                {level.delta >= 0 ? "+" : ""}{fmtVol(level.delta)}
              </span>
            )}
            {mode === "volume" && (
              <span style={{ color: "hsl(var(--foreground))", minWidth: "56px", textAlign: "center" }}>
                {fmtVol(level.totalVol)}
              </span>
            )}
            {mode === "imbalance" && (
              <>
                <span style={{ color: "#ef4444", minWidth: "24px", textAlign: "right" }}>{fmtVol(level.bidVol)}</span>
                <span style={{ color: "hsl(var(--border))" }}>×</span>
                <span style={{ color: "#22c55e", minWidth: "24px" }}>{fmtVol(level.askVol)}</span>
                {level.isImbalance && <span style={{ fontSize: "7px", color: "#f59e0b", fontWeight: 700, marginLeft: "2px" }}>!</span>}
              </>
            )}
            {mode === "cvd" && (
              <span style={{ color: candle.cvd >= 0 ? "#22c55e" : "#ef4444", minWidth: "56px", textAlign: "center" }}>
                {fmtVol(level.totalVol)}
              </span>
            )}
            {isAcc && <LiquidityBadge type="ACC" />}
            {isRej && <LiquidityBadge type="REJ" />}
            {isHvn && !isAcc && !isRej && <LiquidityBadge type="HVN" />}
            {isLvn && <LiquidityBadge type="LVN" />}
          </div>
        );
      })}

      {/* Absorption badges — Elite-only */}
      {isElite && candle.levels.some(l => l.isBuyAbsorption) && (
        <div style={{ padding: "1px 4px", borderRadius: "3px", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", fontSize: "7px", color: "#22c55e", fontWeight: 700, textAlign: "center", letterSpacing: "0.04em", minHeight: `${rowHeight * 0.7}px`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          BUY ABSORPTION
        </div>
      )}
      {isElite && candle.levels.some(l => l.isSellAbsorption) && (
        <div style={{ padding: "1px 4px", borderRadius: "3px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", fontSize: "7px", color: "#ef4444", fontWeight: 700, textAlign: "center", letterSpacing: "0.04em", minHeight: `${rowHeight * 0.7}px`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          SELL ABSORPTION
        </div>
      )}

      {/* Candle footer — OHLC + delta */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", padding: "2px 3px", borderTop: "1px solid hsl(var(--border))" }}>
        <span style={{ fontSize: "7.5px", color: "hsl(var(--muted-foreground))", fontFamily: "var(--app-font-mono)" }}>O:{fmtPrice(candle.open)}</span>
        <span style={{ fontSize: "7.5px", color: "hsl(var(--muted-foreground))", fontFamily: "var(--app-font-mono)" }}>C:{fmtPrice(candle.close)}</span>
        <span style={{ fontSize: "7.5px", color: "#22c55e", fontFamily: "var(--app-font-mono)" }}>H:{fmtPrice(candle.high)}</span>
        <span style={{ fontSize: "7.5px", color: "#ef4444", fontFamily: "var(--app-font-mono)" }}>L:{fmtPrice(candle.low)}</span>
      </div>
      <div style={{ textAlign: "center", fontSize: "7.5px", fontFamily: "var(--app-font-mono)", fontWeight: 700, color: candle.delta >= 0 ? "#22c55e" : "#ef4444", padding: "1px 0 2px" }}>
        Δ{candle.delta >= 0 ? "+" : ""}{fmtVol(candle.delta)}
      </div>
    </div>
  );
}

/* ── Price Axis (sticky left column) ─────────────────────────────── */
function PriceAxis({
  levels, rowHeight, lzData, selectedCandle,
}: {
  levels: number[];
  rowHeight: number;
  lzData: LiquidityZoneData;
  selectedCandle: FootprintCandle | undefined;
}) {
  const close = selectedCandle?.close ?? 0;
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "1px",
      minWidth: "64px", flexShrink: 0,
      position: "sticky", left: 0, zIndex: 10,
      background: "var(--card-bg)",
      borderRight: "1px solid hsl(var(--border))",
      paddingTop: `${rowHeight + 3}px`, // skip header row
    }}>
      {/* Levels are sorted high→low in the candle column, mirror that here */}
      {[...levels].reverse().map((price, i) => {
        const priceKey = price.toFixed(4);
        const isClose = Math.abs(price - close) / Math.max(close, 0.001) < 0.002;
        const isAcc = lzData.acceptancePrices.has(priceKey);
        const isRej = lzData.rejectionPrices.has(priceKey);
        const isHvn = lzData.hvnPrices.has(priceKey);
        const isLvn = lzData.lvnPrices.has(priceKey);

        let color = "hsl(var(--muted-foreground))";
        let bg = "transparent";
        if (isClose) { color = "#f59e0b"; bg = "rgba(245,158,11,0.08)"; }
        else if (isAcc) { color = "#22c55e"; }
        else if (isRej) { color = "#ef4444"; }
        else if (isHvn) { color = "#f59e0b"; }
        else if (isLvn) { color = "#6366f1"; }

        return (
          <div key={i} style={{
            minHeight: `${rowHeight}px`, display: "flex", alignItems: "center",
            paddingLeft: "4px", paddingRight: "6px",
            fontSize: "8px", fontFamily: "var(--app-font-mono)", fontWeight: isClose ? 700 : 500,
            color, background: bg, borderRadius: "2px",
            letterSpacing: "0.02em",
          }}>
            {isClose && <span style={{ fontSize: "6px", marginRight: "2px" }}>▶</span>}
            {fmtPrice(price)}
          </div>
        );
      })}
    </div>
  );
}

export function FootprintGrid({ candles, mode, selectedCandleIdx, onSelectCandle, isElite }: FootprintGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDark = document.documentElement.classList.contains("dark");

  // ── Row height state (driven by pinch-zoom gesture) ───────────────
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);
  const lastPinchDistRef = useRef<number | null>(null);
  const lastRowHeightRef = useRef(DEFAULT_ROW_HEIGHT);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
      lastRowHeightRef.current = rowHeight;
    }
  }, [rowHeight]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2 || lastPinchDistRef.current === null) return;
    e.preventDefault();
    const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
    const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const scale = dist / lastPinchDistRef.current;
    const newHeight = Math.round(Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, lastRowHeightRef.current * scale)));
    setRowHeight(newHeight);
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastPinchDistRef.current = null;
  }, []);

  // ── Mouse-wheel zoom (Ctrl+Scroll) ────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setRowHeight(prev => Math.round(Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, prev - e.deltaY * 0.1))));
  }, []);

  const lzData = useMemo(() => computeLiquidityZones(candles), [candles]);
  const maxVol = useMemo(() => Math.max(...candles.flatMap(c => c.levels.map(l => l.totalVol)), 1), [candles]);

  // Collect all unique price levels (sorted) from the selected candle for the axis
  const selectedCandle = candles[selectedCandleIdx] ?? candles[candles.length - 1];
  const axisLevels = useMemo(() => {
    if (!selectedCandle) return [];
    return selectedCandle.levels.map(l => l.price).sort((a, b) => a - b);
  }, [selectedCandle]);

  const scrollRight = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, []);

  React.useEffect(() => { scrollRight(); }, [candles.length, scrollRight]);

  if (candles.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "hsl(var(--muted-foreground))", fontSize: "13px" }}>
        No footprint data
      </div>
    );
  }

  return (
    <div style={{ position: "relative", overflow: "hidden", background: "var(--card-bg)", borderRadius: "0 0 12px 12px" }}>
      {/* Zoom hint */}
      <div style={{ position: "absolute", top: "4px", right: "8px", zIndex: 20, fontSize: "9px", color: "hsl(var(--muted-foreground))", pointerEvents: "none" }}>
        Ctrl+Scroll or pinch to zoom
      </div>

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        style={{
          overflowX: "auto", overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          display: "flex",
          gap: "2px",
          padding: "4px 8px 8px",
          minHeight: "200px",
          maxHeight: "520px",
          scrollBehavior: "smooth",
        }}
      >
        {/* Sticky price axis — aligned to currently selected candle levels */}
        <PriceAxis
          levels={axisLevels}
          rowHeight={rowHeight}
          lzData={lzData}
          selectedCandle={selectedCandle}
        />

        {/* Candle columns */}
        {candles.map((candle, idx) => (
          <CandleColumn
            key={candle.date}
            candle={candle}
            isSelected={idx === selectedCandleIdx}
            mode={mode}
            rowHeight={rowHeight}
            onSelect={() => onSelectCandle(idx)}
            lzData={lzData}
            maxVol={maxVol}
            isDark={isDark}
            isElite={isElite}
          />
        ))}
      </div>
    </div>
  );
}
