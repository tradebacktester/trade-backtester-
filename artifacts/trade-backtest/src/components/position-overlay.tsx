import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, Sparkles } from "lucide-react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { PositionTool } from "@/lib/chart-utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface Coords { entryY: number; slY: number; tpY: number; }
interface DragState { posId: number; line: "entry" | "sl" | "tp"; }
interface AiState { posId: number; loading: boolean; text: string | null; }

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
  const riskAmt        = side === "long" ? entry - sl : sl - entry;
  const rewAmt         = side === "long" ? tp - entry : entry - tp;
  const riskPctActual  = entry > 0 ? (riskAmt / entry) * 100 : 0;
  const rewPctActual   = entry > 0 ? (rewAmt  / entry) * 100 : 0;
  const rrRatio        = riskAmt > 0 ? rewAmt / riskAmt : 0;
  const capitalAtRisk  = accountSize * (riskPct / 100);
  const positionSize   = riskAmt > 0 ? capitalAtRisk / riskAmt : 0;
  return { riskPctActual, rewPctActual, rrRatio, capitalAtRisk, positionSize };
}

// ── Sub-component: drag-handle line ────────────────────────────────────────

function DragLine({
  y, label, lineColor, labelBg, labelColor, pct, isDragging, onMouseDown,
}: {
  y: number; label: string; lineColor: string; labelBg: string; labelColor: string;
  pct: string | null; isDragging: boolean; onMouseDown: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute", left: 0, right: 0, top: y - 6, height: 12,
        cursor: "ns-resize", pointerEvents: "auto", zIndex: 16, userSelect: "none",
      }}
      onMouseDown={e => { e.stopPropagation(); e.preventDefault(); onMouseDown(); }}
    >
      <div style={{
        position: "absolute", top: 5, left: 0, right: 0, height: 1.5,
        background: lineColor,
        boxShadow: isDragging ? `0 0 8px ${lineColor}` : undefined,
        transition: isDragging ? "none" : "box-shadow 0.15s",
      }} />
      <div style={{
        position: "absolute", right: 4, top: -3,
        padding: "2px 8px", borderRadius: "4px",
        background: labelBg, border: `1px solid ${lineColor}55`,
        display: "flex", alignItems: "center", gap: "6px",
        pointerEvents: "none",
      }}>
        <span style={{
          fontSize: "10px", fontFamily: "monospace", fontWeight: 600,
          color: labelColor, whiteSpace: "nowrap",
        }}>
          {label}
        </span>
        {pct && (
          <span style={{
            fontSize: "9px", fontFamily: "monospace",
            color: labelColor, opacity: 0.7, whiteSpace: "nowrap",
          }}>
            {pct}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main overlay component ──────────────────────────────────────────────────

export function PositionOverlay({
  positions, candleSeries, container,
  selectedId, onSelect, onUpdate, onDelete, onUpdateSizing, token,
}: PositionOverlayProps) {
  const [coords,   setCoords]   = useState<Record<number, Coords>>({});
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [aiState,  setAiState]  = useState<AiState | null>(null);

  const draggingRef   = useRef<DragState | null>(null);
  const prevCoords    = useRef<Record<number, Coords>>({});
  const positionsRef  = useRef(positions);
  positionsRef.current = positions;

  // ── RAF coordinate sync ────────────────────────────────────────────────
  useEffect(() => {
    if (!candleSeries || !positions.length) { setCoords({}); return; }
    let active = true;
    const loop = () => {
      if (!active) return;
      const next: Record<number, Coords> = {};
      let changed = false;
      for (const p of positionsRef.current) {
        const entryY = candleSeries.priceToCoordinate(p.entry)     ?? -9999;
        const slY    = candleSeries.priceToCoordinate(p.stopLoss)   ?? -9999;
        const tpY    = candleSeries.priceToCoordinate(p.takeProfit) ?? -9999;
        next[p.id]   = { entryY, slY, tpY };
        const pr     = prevCoords.current[p.id];
        if (!pr
          || Math.abs(pr.entryY - entryY) > 0.4
          || Math.abs(pr.slY    - slY)    > 0.4
          || Math.abs(pr.tpY    - tpY)    > 0.4) {
          changed = true;
        }
      }
      if (changed) { prevCoords.current = next; setCoords({ ...next }); }
      requestAnimationFrame(loop);
    };
    const frame = requestAnimationFrame(loop);
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [positions, candleSeries]);

  // ── Drag ───────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const drag = draggingRef.current;
    if (!drag || !candleSeries || !container) return;
    const rect     = container.getBoundingClientRect();
    const rawPrice = candleSeries.coordinateToPrice(e.clientY - rect.top);
    if (rawPrice === null) return;
    const newPrice  = Number(rawPrice);
    const pos       = positionsRef.current.find(p => p.id === drag.posId);
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
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup",   handleMouseUp);
  }, [handleMouseMove]);

  const startDrag = useCallback((posId: number, line: "entry" | "sl" | "tp") => {
    const state = { posId, line };
    draggingRef.current = state;
    setDragging(state);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup",   handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  // ── AI analysis ────────────────────────────────────────────────────────
  const runAi = useCallback(async (pos: PositionTool) => {
    if (!token) return;
    setAiState({ posId: pos.id, loading: true, text: null });
    try {
      const { riskPctActual, rewPctActual, rrRatio } = calcMetrics(pos);
      const res = await fetch("/api/ai/analyze-position", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          side: pos.side, entry: pos.entry,
          stopLoss: pos.stopLoss, takeProfit: pos.takeProfit,
          symbol: pos.symbol,
          riskPct: riskPctActual.toFixed(2),
          rewardPct: rewPctActual.toFixed(2),
          rrRatio: rrRatio.toFixed(2),
        }),
      });
      const data = await res.json() as { analysis?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "AI error");
      setAiState({ posId: pos.id, loading: false, text: data.analysis ?? "" });
    } catch (err) {
      setAiState({ posId: pos.id, loading: false, text: `Error: ${(err as Error).message}` });
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
        if (!c) return null;
        const { entryY, slY, tpY } = c;
        const isLong    = pos.side === "long";
        const selected  = selectedId === pos.id;
        const metrics   = calcMetrics(pos);
        const isDragPos = dragging?.posId === pos.id;

        // Zone geometry
        // LONG: tpY < entryY < slY  (smaller Y = higher price)
        // SHORT: slY < entryY < tpY
        const profitTop    = isLong ? tpY : entryY;
        const profitHeight = Math.max(0, isLong ? entryY - tpY : tpY - entryY);
        const lossTop      = isLong ? entryY : slY;
        const lossHeight   = Math.max(0, isLong ? slY - entryY : entryY - slY);

        // Panel positioning
        const hasAiText  = aiState?.posId === pos.id && !aiState.loading && !!aiState.text;
        const panelH     = selected ? (hasAiText ? 350 : 270) : 0;
        const panelTop   = Math.min(Math.max(entryY - panelH / 2, 8), Math.max(8, containerH - panelH - 8));

        return (
          <div key={pos.id}>
            {/* Profit zone */}
            <div style={{
              position: "absolute", left: 0, right: 0,
              top: profitTop, height: profitHeight,
              background: "rgba(52,211,153,0.07)",
              pointerEvents: "none",
            }}>
              <div style={{
                position: "absolute",
                top: isLong ? 0 : "auto", bottom: isLong ? "auto" : 0,
                left: 0, right: 0, height: 0,
                borderTop: isLong ? "1.5px dashed rgba(52,211,153,0.4)" : undefined,
                borderBottom: !isLong ? "1.5px dashed rgba(52,211,153,0.4)" : undefined,
              }} />
            </div>

            {/* Loss zone */}
            <div style={{
              position: "absolute", left: 0, right: 0,
              top: lossTop, height: lossHeight,
              background: "rgba(239,68,68,0.07)",
              pointerEvents: "none",
            }}>
              <div style={{
                position: "absolute",
                top: !isLong ? 0 : "auto", bottom: !isLong ? "auto" : 0,
                left: 0, right: 0, height: 0,
                borderTop: !isLong ? "1.5px dashed rgba(239,68,68,0.4)" : undefined,
                borderBottom: isLong ? "1.5px dashed rgba(239,68,68,0.4)" : undefined,
              }} />
            </div>

            {/* TP drag line */}
            <DragLine
              y={tpY}
              label={`TP  $${fmtPrice(pos.takeProfit)}`}
              lineColor="rgba(52,211,153,0.85)"
              labelBg="rgba(14,32,22,0.95)"
              labelColor="hsl(150,90%,58%)"
              pct={fmtPct(metrics.rewPctActual)}
              isDragging={isDragPos && dragging?.line === "tp"}
              onMouseDown={() => { onSelect(pos.id); startDrag(pos.id, "tp"); }}
            />

            {/* Entry drag line */}
            <DragLine
              y={entryY}
              label={`ENTRY  $${fmtPrice(pos.entry)}`}
              lineColor="rgba(200,210,230,0.8)"
              labelBg="rgba(16,18,28,0.97)"
              labelColor="hsl(220,14%,85%)"
              pct={null}
              isDragging={isDragPos && dragging?.line === "entry"}
              onMouseDown={() => { onSelect(pos.id); startDrag(pos.id, "entry"); }}
            />

            {/* SL drag line */}
            <DragLine
              y={slY}
              label={`SL  $${fmtPrice(pos.stopLoss)}`}
              lineColor="rgba(239,68,68,0.85)"
              labelBg="rgba(32,14,14,0.95)"
              labelColor="hsl(0,85%,65%)"
              pct={fmtPct(-metrics.riskPctActual)}
              isDragging={isDragPos && dragging?.line === "sl"}
              onMouseDown={() => { onSelect(pos.id); startDrag(pos.id, "sl"); }}
            />

            {/* R:R mini badge (when not selected) */}
            {!selected && (
              <div
                style={{
                  position: "absolute", right: 74, top: entryY - 11,
                  pointerEvents: "auto", cursor: "pointer", zIndex: 16,
                }}
                onClick={() => onSelect(pos.id)}
              >
                <span style={{
                  fontSize: "10px", fontFamily: "monospace", fontWeight: 700,
                  padding: "2px 8px", borderRadius: "4px",
                  background: isLong ? "rgba(18,40,28,0.97)" : "rgba(40,18,18,0.97)",
                  border: `1px solid ${isLong ? "rgba(52,211,153,0.4)" : "rgba(239,68,68,0.4)"}`,
                  color: isLong ? "hsl(150,90%,60%)" : "hsl(0,85%,65%)",
                  display: "inline-flex", alignItems: "center", gap: "4px",
                }}>
                  {isLong ? "▲ L" : "▼ S"}
                  <span style={{ opacity: 0.7 }}>1:{metrics.rrRatio.toFixed(1)}</span>
                </span>
              </div>
            )}

            {/* Metrics panel (when selected) */}
            {selected && (
              <div style={{
                position: "absolute", right: 74, top: panelTop, width: 222,
                borderRadius: "12px",
                background: "rgba(8,10,16,0.98)",
                border: `1px solid ${isLong ? "rgba(52,211,153,0.22)" : "rgba(239,68,68,0.22)"}`,
                boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.6)",
                pointerEvents: "auto", zIndex: 18, overflow: "hidden",
              }}>

                {/* Header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 10px 7px",
                  background: isLong ? "rgba(52,211,153,0.06)" : "rgba(239,68,68,0.06)",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}>
                  <span style={{
                    fontSize: "10px", fontFamily: "monospace", fontWeight: 700,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: isLong ? "hsl(150,90%,60%)" : "hsl(0,85%,65%)",
                  }}>
                    {isLong ? "▲ Long Position" : "▼ Short Position"}
                  </span>
                  <button
                    onClick={() => { onDelete(pos.id); onSelect(null); }}
                    title="Delete position"
                    style={{
                      padding: "3px", borderRadius: "5px", cursor: "pointer",
                      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                      color: "hsl(0,78%,60%)", display: "flex", alignItems: "center",
                    }}
                  >
                    <X style={{ width: 11, height: 11 }} />
                  </button>
                </div>

                {/* Prices */}
                <div style={{ padding: "8px 10px 4px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {[
                    { label: "TP",    price: pos.takeProfit, pct: metrics.rewPctActual,   color: "hsl(150,90%,58%)" },
                    { label: "ENTRY", price: pos.entry,      pct: null as number | null,  color: "hsl(220,14%,80%)" },
                    { label: "SL",    price: pos.stopLoss,   pct: -metrics.riskPctActual, color: "hsl(0,85%,65%)"   },
                  ].map(row => (
                    <div key={row.label} style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                      <span style={{
                        fontSize: "9px", fontFamily: "monospace",
                        color: row.color, letterSpacing: "0.04em",
                        minWidth: 34, flexShrink: 0,
                      }}>{row.label}</span>
                      <span style={{
                        flex: 1, fontSize: "11px", fontFamily: "monospace",
                        fontWeight: 600, color: row.color,
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

                <div style={{ margin: "2px 10px", height: "1px", background: "rgba(255,255,255,0.05)" }} />

                {/* Key metrics */}
                <div style={{ padding: "5px 10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                  {[
                    {
                      label: "R:R",
                      value: `1 : ${metrics.rrRatio.toFixed(2)}`,
                      color: metrics.rrRatio >= 2
                        ? "hsl(150,90%,58%)"
                        : metrics.rrRatio >= 1 ? "hsl(38,100%,60%)" : "hsl(0,85%,62%)",
                    },
                    { label: "Risk",   value: `${metrics.riskPctActual.toFixed(2)}%`, color: "hsl(0,85%,62%)"  },
                    { label: "Reward", value: `${metrics.rewPctActual.toFixed(2)}%`,  color: "hsl(150,90%,58%)" },
                    {
                      label: "At Risk",
                      value: `$${metrics.capitalAtRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                      color: "hsl(220,14%,62%)",
                    },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{
                        fontSize: "8px", fontFamily: "monospace", margin: 0,
                        color: "hsl(220,14%,36%)", textTransform: "uppercase", letterSpacing: "0.06em",
                        marginBottom: "1px",
                      }}>{item.label}</p>
                      <p style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 700, color: item.color, margin: 0 }}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div style={{ margin: "2px 10px", height: "1px", background: "rgba(255,255,255,0.05)" }} />

                {/* Position sizer */}
                <div style={{ padding: "5px 10px 4px" }}>
                  <p style={{
                    fontSize: "8px", fontFamily: "monospace", margin: "0 0 5px",
                    color: "hsl(220,14%,36%)", textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>Position Sizer</p>
                  <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                    <input
                      type="number"
                      value={pos.accountSize}
                      onChange={e => onUpdateSizing(pos.id, Math.max(1, Number(e.target.value) || 10000), pos.riskPct)}
                      onMouseDown={e => e.stopPropagation()}
                      style={{
                        flex: 1, minWidth: 0, padding: "3px 7px", borderRadius: "6px",
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                        color: "hsl(220,14%,72%)", fontSize: "10px", fontFamily: "monospace",
                        outline: "none",
                      }}
                      placeholder="Account $"
                    />
                    {[1, 2, 3].map(r => (
                      <button key={r}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={() => onUpdateSizing(pos.id, pos.accountSize, r)}
                        style={{
                          padding: "3px 6px", borderRadius: "6px", cursor: "pointer",
                          fontSize: "9px", fontFamily: "monospace", border: "1px solid",
                          background: pos.riskPct === r
                            ? (isLong ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)")
                            : "rgba(255,255,255,0.04)",
                          borderColor: pos.riskPct === r
                            ? (isLong ? "rgba(52,211,153,0.4)" : "rgba(239,68,68,0.4)")
                            : "rgba(255,255,255,0.08)",
                          color: pos.riskPct === r
                            ? (isLong ? "hsl(150,90%,60%)" : "hsl(0,85%,65%)")
                            : "hsl(220,14%,48%)",
                        }}>
                        {r}%
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: "10px", fontFamily: "monospace", margin: 0, color: "hsl(220,14%,50%)" }}>
                    Size:{" "}
                    <span style={{ color: "hsl(220,14%,75%)", fontWeight: 600 }}>
                      {metrics.positionSize < 1
                        ? metrics.positionSize.toFixed(5)
                        : metrics.positionSize.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    {" "}<span style={{ color: "hsl(220,14%,35%)" }}>units</span>
                  </p>
                </div>

                {/* AI Analyze */}
                <div style={{ padding: "4px 10px 10px" }}>
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => runAi(pos)}
                    disabled={aiState?.posId === pos.id && aiState.loading}
                    style={{
                      width: "100%", padding: "6px 10px", borderRadius: "8px",
                      cursor: "pointer", display: "flex", alignItems: "center",
                      justifyContent: "center", gap: "5px",
                      fontSize: "10px", fontFamily: "monospace", fontWeight: 600, letterSpacing: "0.04em",
                      background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.28)",
                      color: "hsl(260,80%,72%)",
                      opacity: aiState?.posId === pos.id && aiState.loading ? 0.7 : 1,
                      transition: "opacity 0.15s",
                    }}
                  >
                    {aiState?.posId === pos.id && aiState.loading ? (
                      <><Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} /> Analyzing…</>
                    ) : (
                      <><Sparkles style={{ width: 11, height: 11 }} /> Analyze with AI</>
                    )}
                  </button>

                  {/* AI result */}
                  {aiState?.posId === pos.id && !aiState.loading && aiState.text && (
                    <div style={{
                      marginTop: "6px", padding: "8px 10px", borderRadius: "8px",
                      background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.18)",
                      fontSize: "10px", fontFamily: "monospace", lineHeight: "1.65",
                      color: "hsl(260,60%,76%)", whiteSpace: "pre-wrap",
                      maxHeight: "130px", overflowY: "auto",
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

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
