import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, Sparkles, Lock, Trash2 } from "lucide-react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { PositionTool } from "@/lib/chart-utils";
import { API_BASE } from "@/lib/api-config";

// ── Types ──────────────────────────────────────────────────────────────────

interface Coords { entryY: number; slY: number; tpY: number; valid: boolean; }
interface DragState { posId: number; line: "entry" | "sl" | "tp"; }
interface AiState  { posId: number; loading: boolean; text: string | null; error?: string; }

export interface PositionOverlayProps {
  positions: PositionTool[];
  candleSeries: ISeriesApi<"Candlestick"> | null;
  chart: IChartApi | null;
  container: HTMLDivElement | null;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onUpdate: (id: number, entry: number, sl: number, tp: number) => void;
  onDelete: (id: number) => void;
  onUpdateSizing: (id: number, accountSize: number, riskPct: number) => void;
  token: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtPrice(n: number): string {
  if (n >= 10000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1)     return n.toFixed(4);
  return n.toFixed(6);
}

function fmtPct(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

function calcMetrics(pos: PositionTool) {
  const { entry, stopLoss: sl, takeProfit: tp, side, accountSize, riskPct } = pos;
  const riskAmt       = side === "long" ? entry - sl : sl - entry;
  const rewAmt        = side === "long" ? tp - entry : entry - tp;
  const riskPctActual = entry > 0 ? (riskAmt / entry) * 100 : 0;
  const rewPctActual  = entry > 0 ? (rewAmt  / entry) * 100 : 0;
  const rrRatio       = riskAmt > 0 ? rewAmt / riskAmt : 0;
  const capitalAtRisk = accountSize * (riskPct / 100);
  const positionSize  = riskAmt > 0 ? capitalAtRisk / riskAmt : 0;
  return { riskPctActual, rewPctActual, rrRatio, capitalAtRisk, positionSize };
}

// ── DragLine subcomponent ──────────────────────────────────────────────────
// Increased hit area to 28px; clear grip dots + label badge

function DragLine({
  y, label, lineColor, labelBg, labelColor, pct, isDragging, onMouseDown,
}: {
  y: number; label: string; lineColor: string; labelBg: string; labelColor: string;
  pct?: string; isDragging: boolean; onMouseDown: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute", left: 0, right: 0,
        top: y - 14, height: 28,
        cursor: "ns-resize", pointerEvents: "auto",
        zIndex: 16, userSelect: "none", touchAction: "none",
      }}
      onMouseDown={e => { e.stopPropagation(); e.preventDefault(); onMouseDown(); }}
    >
      {/* The visible line */}
      <div style={{
        position: "absolute", top: 13, left: 0, right: 0,
        height: isDragging ? 2 : 1.5,
        background: lineColor,
        boxShadow: isDragging ? `0 0 10px ${lineColor}` : `0 0 4px ${lineColor}60`,
        transition: isDragging ? "none" : "all 0.1s",
      }} />

      {/* Grip dots on left */}
      <div style={{
        position: "absolute", left: 8, top: 8,
        display: "flex", flexDirection: "column", gap: "3px",
        opacity: isDragging ? 1 : 0.45,
        transition: "opacity 0.15s",
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 3, height: 3, borderRadius: "50%",
            background: lineColor,
          }} />
        ))}
      </div>

      {/* Label badge on right */}
      <div style={{
        position: "absolute", right: 8, top: 3,
        padding: "3px 10px", borderRadius: "5px",
        background: labelBg,
        border: `1px solid ${lineColor}66`,
        display: "flex", alignItems: "center", gap: "6px",
        pointerEvents: "none",
        boxShadow: isDragging ? `0 2px 12px ${lineColor}40` : undefined,
      }}>
        <span style={{
          fontSize: "11px", fontFamily: "monospace", fontWeight: 700,
          color: labelColor, whiteSpace: "nowrap", letterSpacing: "0.02em",
        }}>
          {label}
        </span>
        {pct && (
          <span style={{
            fontSize: "10px", fontFamily: "monospace",
            color: labelColor, opacity: 0.75, whiteSpace: "nowrap",
          }}>
            {pct}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main overlay ────────────────────────────────────────────────────────────

export function PositionOverlay({
  positions, candleSeries, container,
  selectedId, onSelect, onUpdate, onDelete, onUpdateSizing, token,
}: PositionOverlayProps) {
  const [coords,  setCoords]  = useState<Record<number, Coords>>({});
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [aiState,  setAiState]  = useState<AiState | null>(null);

  const draggingRef  = useRef<DragState | null>(null);
  const prevCoords   = useRef<Record<number, Coords>>({});
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  // ── RAF coordinate sync ──────────────────────────────────────────────────
  useEffect(() => {
    if (!candleSeries || !positions.length) { setCoords({}); return; }
    let active = true;
    const loop = () => {
      if (!active) return;
      const next: Record<number, Coords> = {};
      let changed = false;
      for (const p of positionsRef.current) {
        const entryY = candleSeries.priceToCoordinate(p.entry)     ?? null;
        const slY    = candleSeries.priceToCoordinate(p.stopLoss)   ?? null;
        const tpY    = candleSeries.priceToCoordinate(p.takeProfit) ?? null;
        const valid  = entryY !== null && slY !== null && tpY !== null;
        const c: Coords = {
          entryY: entryY ?? 0,
          slY:    slY    ?? 0,
          tpY:    tpY    ?? 0,
          valid,
        };
        next[p.id] = c;
        const pr   = prevCoords.current[p.id];
        if (!pr || !valid !== !pr.valid
          || Math.abs((pr.entryY) - c.entryY) > 0.4
          || Math.abs((pr.slY)    - c.slY)    > 0.4
          || Math.abs((pr.tpY)    - c.tpY)    > 0.4) {
          changed = true;
        }
      }
      if (changed) { prevCoords.current = next; setCoords({ ...next }); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { active = false; };
  }, [positions, candleSeries]);

  // ── Drag ─────────────────────────────────────────────────────────────────
  const onMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const onUpRef   = useRef<(() => void) | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const drag = draggingRef.current;
    if (!drag || !candleSeries || !container) return;
    const rect     = container.getBoundingClientRect();
    const rawPrice = candleSeries.coordinateToPrice(e.clientY - rect.top);
    if (rawPrice === null) return;
    const newPrice = Number(rawPrice);
    const pos      = positionsRef.current.find(p => p.id === drag.posId);
    if (!pos) return;

    const MIN = pos.entry * 0.0005;
    let entry = pos.entry, sl = pos.stopLoss, tp = pos.takeProfit;

    if (drag.line === "entry") {
      const slOff = pos.entry - pos.stopLoss;
      const tpOff = pos.takeProfit - pos.entry;
      entry = newPrice;
      sl    = newPrice - slOff;
      tp    = newPrice + tpOff;
    } else if (drag.line === "sl") {
      sl = pos.side === "long"
        ? Math.min(newPrice, pos.entry - MIN)
        : Math.max(newPrice, pos.entry + MIN);
    } else {
      tp = pos.side === "long"
        ? Math.max(newPrice, pos.entry + MIN)
        : Math.min(newPrice, pos.entry - MIN);
    }
    onUpdate(drag.posId, entry, sl, tp);
  }, [candleSeries, container, onUpdate]);

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
    setDragging(null);
    if (onMoveRef.current) window.removeEventListener("mousemove", onMoveRef.current);
    if (onUpRef.current)   window.removeEventListener("mouseup",   onUpRef.current);
  }, []);

  const startDrag = useCallback((posId: number, line: "entry" | "sl" | "tp") => {
    const state = { posId, line };
    draggingRef.current = state;
    setDragging(state);
    onMoveRef.current = handleMouseMove;
    onUpRef.current   = handleMouseUp;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup",   handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  // ── AI analysis ──────────────────────────────────────────────────────────
  const runAi = useCallback(async (pos: PositionTool) => {
    if (!token) {
      setAiState({ posId: pos.id, loading: false, text: null, error: "sign_in" });
      return;
    }
    setAiState({ posId: pos.id, loading: true, text: null });
    try {
      const { riskPctActual, rewPctActual, rrRatio } = calcMetrics(pos);
      const res = await fetch(`${API_BASE}/api/ai/analyze-position`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          side:      pos.side,
          entry:     pos.entry,
          stopLoss:  pos.stopLoss,
          takeProfit: pos.takeProfit,
          symbol:    pos.symbol,
          riskPct:   riskPctActual.toFixed(2),
          rewardPct: rewPctActual.toFixed(2),
          rrRatio:   rrRatio.toFixed(2),
        }),
      });
      const data = await res.json() as { analysis?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setAiState({ posId: pos.id, loading: false, text: data.analysis ?? "" });
    } catch (err) {
      setAiState({ posId: pos.id, loading: false, text: null, error: (err as Error).message });
    }
  }, [token]);

  if (!positions.length) return null;
  const containerH = container?.clientHeight ?? 600;

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 15, pointerEvents: "none", overflow: "hidden" }}
      onClick={e => { if (e.target === e.currentTarget) onSelect(null); }}
    >
      {positions.map(pos => {
        const c = coords[pos.id];
        if (!c || !c.valid) return null;

        const { entryY, slY, tpY } = c;
        const isLong    = pos.side === "long";
        const selected  = selectedId === pos.id;
        const metrics   = calcMetrics(pos);
        const isDragPos = dragging?.posId === pos.id;

        // Zone geometry — LONG: tpY < entryY < slY (higher price = smaller Y)
        //                SHORT: slY < entryY < tpY
        const profitTop    = isLong ? tpY    : entryY;
        const profitBottom = isLong ? entryY : tpY;
        const profitHeight = Math.max(0, profitBottom - profitTop);

        const lossTop    = isLong ? entryY : slY;
        const lossBottom = isLong ? slY    : entryY;
        const lossHeight = Math.max(0, lossBottom - lossTop);

        // Panel placement
        const aiErr      = aiState?.posId === pos.id && !!aiState.error;
        const hasAiText  = aiState?.posId === pos.id && !aiState.loading && !!aiState.text;
        const panelH     = selected ? (hasAiText ? 380 : aiErr ? 290 : 270) : 0;
        const panelTop   = Math.min(
          Math.max(entryY - panelH / 2, 8),
          Math.max(8, containerH - panelH - 8),
        );

        // Colors
        const GREEN       = "hsl(150,90%,58%)";
        const RED         = "hsl(0,85%,62%)";
        const GREEN_BG    = "rgba(52,211,153,";
        const RED_BG      = "rgba(239,68,68,";

        return (
          <div key={pos.id}>

            {/* ── Profit zone ──────────────────────────────────────────── */}
            <div style={{
              position: "absolute", left: 0, right: 0,
              top: profitTop, height: profitHeight,
              background: `${GREEN_BG}0.13)`,
              borderTop:    isLong ? undefined : `1.5px solid ${GREEN_BG}0.6)`,
              borderBottom: isLong ? `1.5px solid ${GREEN_BG}0.6)` : undefined,
              pointerEvents: "none",
            }}>
              {/* TP label inside zone */}
              {profitHeight > 18 && (
                <div style={{
                  position: "absolute",
                  top:  isLong ? 2 : "auto",
                  bottom: isLong ? "auto" : 2,
                  left: 12,
                  fontSize: "9px", fontFamily: "monospace",
                  color: GREEN, opacity: 0.6, userSelect: "none",
                }}>
                  PROFIT +{metrics.rewPctActual.toFixed(2)}%
                </div>
              )}
            </div>

            {/* ── Loss zone ────────────────────────────────────────────── */}
            <div style={{
              position: "absolute", left: 0, right: 0,
              top: lossTop, height: lossHeight,
              background: `${RED_BG}0.13)`,
              borderTop:    !isLong ? undefined : `1.5px solid ${RED_BG}0.6)`,
              borderBottom: !isLong ? `1.5px solid ${RED_BG}0.6)` : undefined,
              pointerEvents: "none",
            }}>
              {lossHeight > 18 && (
                <div style={{
                  position: "absolute",
                  bottom: isLong ? 2 : "auto",
                  top:    isLong ? "auto" : 2,
                  left: 12,
                  fontSize: "9px", fontFamily: "monospace",
                  color: RED, opacity: 0.6, userSelect: "none",
                }}>
                  LOSS −{metrics.riskPctActual.toFixed(2)}%
                </div>
              )}
            </div>

            {/* ── TP drag line ─────────────────────────────────────────── */}
            <DragLine
              y={tpY}
              label={`TP  $${fmtPrice(pos.takeProfit)}`}
              lineColor={`${GREEN_BG}0.9)`}
              labelBg="rgba(10,26,18,0.97)"
              labelColor={GREEN}
              pct={fmtPct(metrics.rewPctActual)}
              isDragging={isDragPos && dragging?.line === "tp"}
              onMouseDown={() => { onSelect(pos.id); startDrag(pos.id, "tp"); }}
            />

            {/* ── Entry drag line ──────────────────────────────────────── */}
            <DragLine
              y={entryY}
              label={`ENTRY  $${fmtPrice(pos.entry)}`}
              lineColor="rgba(200,215,240,0.85)"
              labelBg="rgba(14,16,26,0.97)"
              labelColor="hsl(220,14%,88%)"
              isDragging={isDragPos && dragging?.line === "entry"}
              onMouseDown={() => { onSelect(pos.id); startDrag(pos.id, "entry"); }}
            />

            {/* ── SL drag line ─────────────────────────────────────────── */}
            <DragLine
              y={slY}
              label={`SL  $${fmtPrice(pos.stopLoss)}`}
              lineColor={`${RED_BG}0.9)`}
              labelBg="rgba(26,10,10,0.97)"
              labelColor={RED}
              pct={fmtPct(-metrics.riskPctActual)}
              isDragging={isDragPos && dragging?.line === "sl"}
              onMouseDown={() => { onSelect(pos.id); startDrag(pos.id, "sl"); }}
            />

            {/* ── Side badge (when collapsed) ──────────────────────────── */}
            {!selected && (
              <div
                style={{
                  position: "absolute", right: 76, top: entryY - 13,
                  pointerEvents: "auto", cursor: "pointer", zIndex: 17,
                }}
                onClick={e => { e.stopPropagation(); onSelect(pos.id); }}
              >
                <span style={{
                  fontSize: "10px", fontFamily: "monospace", fontWeight: 700,
                  padding: "3px 9px", borderRadius: "5px",
                  background: isLong ? "rgba(14,32,22,0.97)" : "rgba(32,12,12,0.97)",
                  border: `1px solid ${isLong ? GREEN_BG + "0.45)" : RED_BG + "0.45)"}`,
                  color: isLong ? GREEN : RED,
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  boxShadow: `0 2px 8px rgba(0,0,0,0.5)`,
                }}>
                  {isLong ? "▲ LONG" : "▼ SHORT"}
                  <span style={{ opacity: 0.65 }}>1:{metrics.rrRatio.toFixed(1)}</span>
                </span>
              </div>
            )}

            {/* ── Metrics panel (selected) ─────────────────────────────── */}
            {selected && (
              <div style={{
                position: "absolute", right: 76, top: panelTop, width: 236,
                borderRadius: "12px",
                background: "rgba(8,10,16,0.98)",
                border: `1px solid ${isLong ? GREEN_BG + "0.25)" : RED_BG + "0.25)"}`,
                boxShadow: "0 20px 60px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.6)",
                pointerEvents: "auto", zIndex: 18, overflow: "hidden",
              }}>

                {/* Header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 12px 8px",
                  background: isLong ? `${GREEN_BG}0.07)` : `${RED_BG}0.07)`,
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <span style={{
                    fontSize: "11px", fontFamily: "monospace", fontWeight: 700,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    color: isLong ? GREEN : RED,
                  }}>
                    {isLong ? "▲ Long Position" : "▼ Short Position"}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {/* Collapse panel — keeps position on chart */}
                    <button
                      onClick={() => onSelect(null)}
                      title="Close panel (position stays on chart)"
                      style={{
                        padding: "4px", borderRadius: "6px", cursor: "pointer",
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                        color: "hsl(220,14%,55%)", display: "flex", alignItems: "center",
                      }}
                    >
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                    {/* Delete position permanently */}
                    <button
                      onClick={() => { onDelete(pos.id); onSelect(null); }}
                      title="Delete position"
                      style={{
                        padding: "4px", borderRadius: "6px", cursor: "pointer",
                        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.22)",
                        color: "hsl(0,78%,60%)", display: "flex", alignItems: "center",
                      }}
                    >
                      <Trash2 style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                </div>

                {/* Price rows */}
                <div style={{ padding: "9px 12px 5px", display: "flex", flexDirection: "column", gap: "5px" }}>
                  {([
                    { label: "TP",    price: pos.takeProfit,  pct:  metrics.rewPctActual,  color: GREEN },
                    { label: "ENTRY", price: pos.entry,        pct:  null as number | null, color: "hsl(220,14%,82%)" },
                    { label: "SL",    price: pos.stopLoss,     pct: -metrics.riskPctActual, color: RED   },
                  ] as const).map(row => (
                    <div key={row.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{
                        fontSize: "9px", fontFamily: "monospace", fontWeight: 700,
                        color: row.color, letterSpacing: "0.05em", minWidth: 36, flexShrink: 0,
                      }}>{row.label}</span>
                      <span style={{
                        flex: 1, fontSize: "12px", fontFamily: "monospace",
                        fontWeight: 700, color: row.color,
                      }}>${fmtPrice(row.price)}</span>
                      {row.pct !== null && (
                        <span style={{
                          fontSize: "10px", fontFamily: "monospace",
                          color: row.color, opacity: 0.7,
                        }}>
                          {row.pct >= 0 ? "+" : ""}{row.pct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ margin: "3px 12px", height: 1, background: "rgba(255,255,255,0.06)" }} />

                {/* Key metrics grid */}
                <div style={{ padding: "6px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" }}>
                  {([
                    {
                      label: "R:R Ratio",
                      value: `1 : ${metrics.rrRatio.toFixed(2)}`,
                      color: metrics.rrRatio >= 2 ? GREEN : metrics.rrRatio >= 1 ? "hsl(38,100%,60%)" : RED,
                    },
                    { label: "Risk",    value: `${metrics.riskPctActual.toFixed(2)}%`, color: RED  },
                    { label: "Reward",  value: `${metrics.rewPctActual.toFixed(2)}%`,  color: GREEN },
                    {
                      label: "$ At Risk",
                      value: `$${metrics.capitalAtRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                      color: "hsl(220,14%,65%)",
                    },
                  ] as const).map(item => (
                    <div key={item.label}>
                      <p style={{
                        fontSize: "8px", fontFamily: "monospace", margin: 0,
                        color: "hsl(220,14%,35%)", textTransform: "uppercase",
                        letterSpacing: "0.05em", marginBottom: "2px",
                      }}>{item.label}</p>
                      <p style={{
                        fontSize: "13px", fontFamily: "monospace",
                        fontWeight: 700, color: item.color, margin: 0,
                      }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div style={{ margin: "3px 12px", height: 1, background: "rgba(255,255,255,0.06)" }} />

                {/* Position sizer */}
                <div style={{ padding: "6px 12px 5px" }}>
                  <p style={{
                    fontSize: "8px", fontFamily: "monospace", margin: "0 0 6px",
                    color: "hsl(220,14%,35%)", textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>Position Sizer</p>
                  <div style={{ display: "flex", gap: "4px", marginBottom: "5px" }}>
                    <input
                      type="number"
                      value={pos.accountSize}
                      onChange={e => onUpdateSizing(pos.id, Math.max(1, Number(e.target.value) || 10000), pos.riskPct)}
                      onMouseDown={e => e.stopPropagation()}
                      style={{
                        flex: 1, minWidth: 0, padding: "4px 8px", borderRadius: "7px",
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                        color: "hsl(220,14%,75%)", fontSize: "10px", fontFamily: "monospace", outline: "none",
                      }}
                      placeholder="Account $"
                    />
                    {[1, 2, 3].map(r => (
                      <button key={r}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={() => onUpdateSizing(pos.id, pos.accountSize, r)}
                        style={{
                          padding: "4px 7px", borderRadius: "7px", cursor: "pointer",
                          fontSize: "9px", fontFamily: "monospace", fontWeight: 700, border: "1px solid",
                          background: pos.riskPct === r
                            ? (isLong ? `${GREEN_BG}0.15)` : `${RED_BG}0.15)`)
                            : "rgba(255,255,255,0.04)",
                          borderColor: pos.riskPct === r
                            ? (isLong ? `${GREEN_BG}0.45)` : `${RED_BG}0.45)`)
                            : "rgba(255,255,255,0.09)",
                          color: pos.riskPct === r
                            ? (isLong ? GREEN : RED)
                            : "hsl(220,14%,45%)",
                        }}>
                        {r}%
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: "10px", fontFamily: "monospace", margin: 0, color: "hsl(220,14%,45%)" }}>
                    Size:{" "}
                    <span style={{ color: "hsl(220,14%,78%)", fontWeight: 700 }}>
                      {metrics.positionSize < 1
                        ? metrics.positionSize.toFixed(5)
                        : metrics.positionSize.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    {" "}<span style={{ color: "hsl(220,14%,30%)" }}>units</span>
                  </p>
                </div>

                <div style={{ margin: "3px 12px", height: 1, background: "rgba(255,255,255,0.06)" }} />

                {/* AI Analyze */}
                <div style={{ padding: "6px 12px 12px" }}>
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => runAi(pos)}
                    disabled={aiState?.posId === pos.id && aiState.loading}
                    style={{
                      width: "100%", padding: "7px 10px", borderRadius: "8px",
                      cursor: aiState?.posId === pos.id && aiState.loading ? "wait" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                      fontSize: "10px", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.04em",
                      background: !token
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(139,92,246,0.14)",
                      border: !token
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "1px solid rgba(139,92,246,0.3)",
                      color: !token ? "hsl(220,14%,38%)" : "hsl(260,80%,74%)",
                      opacity: aiState?.posId === pos.id && aiState.loading ? 0.7 : 1,
                      transition: "opacity 0.15s",
                    }}
                  >
                    {aiState?.posId === pos.id && aiState.loading ? (
                      <><Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> Analyzing…</>
                    ) : !token ? (
                      <><Lock style={{ width: 12, height: 12 }} /> Sign in to Analyze</>
                    ) : (
                      <><Sparkles style={{ width: 12, height: 12 }} /> Analyze with AI</>
                    )}
                  </button>

                  {/* Sign-in nudge */}
                  {aiState?.posId === pos.id && aiState.error === "sign_in" && (
                    <p style={{
                      marginTop: "6px", fontSize: "10px", fontFamily: "monospace",
                      textAlign: "center", color: "hsl(38,100%,55%)",
                    }}>
                      Sign in to use AI analysis
                    </p>
                  )}

                  {/* API error */}
                  {aiState?.posId === pos.id && aiState.error && aiState.error !== "sign_in" && (
                    <div style={{
                      marginTop: "6px", padding: "6px 8px", borderRadius: "7px",
                      background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
                      fontSize: "10px", fontFamily: "monospace", color: RED,
                    }}>
                      {aiState.error}
                    </div>
                  )}

                  {/* AI result */}
                  {aiState?.posId === pos.id && !aiState.loading && aiState.text && (
                    <div style={{
                      marginTop: "7px", padding: "9px 10px", borderRadius: "8px",
                      background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)",
                      fontSize: "10px", fontFamily: "monospace", lineHeight: "1.7",
                      color: "hsl(260,65%,80%)", whiteSpace: "pre-wrap",
                      maxHeight: "140px", overflowY: "auto",
                    }}>
                      {aiState.text}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
