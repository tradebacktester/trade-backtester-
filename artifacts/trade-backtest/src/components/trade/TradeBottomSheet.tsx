import { useState, useRef, useCallback, useMemo } from "react";
import { TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import { T, SPRING } from "./styles";

type SheetState = "collapsed" | "half" | "full";
type OrderType  = "market" | "limit" | "stop";

interface SimTrade { id: number; pnl: number; pnlPct: number; entryPrice: number; exitPrice: number; entryTime: number; exitTime: number; }
interface Position { price: number; time: number; units: number; capitalAtEntry: number; side: "long" | "short"; }

interface TradeBottomSheetProps {
  equity: number;
  totalPnl: number;
  trades: SimTrade[];
  wins: number;
  winRate: number;
  ptCapital: number;
  equityGain: number;
  equityGainPct: number;
  position: Position | null;
  symbol: string;
  displayLabel: string;
  chartLeverage: number;
  onLeverageChange: (lev: number) => void;
  orderType: OrderType;
  onOrderTypeChange: (t: OrderType) => void;
  limitPrice: string;
  onLimitPriceChange: (v: string) => void;
  stopPrice: string;
  onStopPriceChange: (v: string) => void;
  currentPrice: number | null;
  onBuy: () => void;
  onSell: () => void;
  onReset: () => void;
  onOpenAccountModal: () => void;
  hasAccount: boolean;
  replayMode: boolean;
  sheetState: SheetState;
  onSheetStateChange: (s: SheetState) => void;
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 });
}
function fmtPnl(n: number) {
  return `${n >= 0 ? "+" : ""}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`; }
function fmtDate(unix: number) { return new Date(unix * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }

const SHEET_HEIGHTS: Record<SheetState, number | string> = {
  collapsed: 64,
  half: 360,
  full: typeof window !== "undefined" ? window.innerHeight * 0.88 : 680,
};

const LEVERAGES = [1, 2, 5, 10, 25];
const ORDER_TYPES: OrderType[] = ["market", "limit", "stop"];

export function TradeBottomSheet({
  equity, totalPnl, trades, wins, winRate, ptCapital, equityGain, equityGainPct,
  position, symbol, displayLabel, chartLeverage, onLeverageChange,
  orderType, onOrderTypeChange, limitPrice, onLimitPriceChange,
  stopPrice, onStopPriceChange, currentPrice, onBuy, onSell, onReset,
  onOpenAccountModal, hasAccount, replayMode, sheetState, onSheetStateChange,
}: TradeBottomSheetProps) {
  const [activeTab, setActiveTab] = useState<"order" | "positions" | "history">("order");
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const height = useMemo(() => {
    if (sheetState === "full") return typeof window !== "undefined" ? window.innerHeight * 0.88 : 680;
    return SHEET_HEIGHTS[sheetState] as number;
  }, [sheetState]);

  const onHandlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startHeight: height };
  }, [height]);

  const onHandlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - e.clientY;
    const newH = dragRef.current.startHeight + delta;
    if (newH < 100) { onSheetStateChange("collapsed"); }
    else if (newH < 250) { onSheetStateChange("collapsed"); }
    else if (newH < 500) { onSheetStateChange("half"); }
    else { onSheetStateChange("full"); }
  }, [onSheetStateChange]);

  const onHandlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const TAB_BTN = (id: typeof activeTab, label: string) => (
    <button
      key={id}
      onClick={() => setActiveTab(id)}
      style={{
        flex: 1, height: 32, border: "none", cursor: "pointer",
        borderRadius: 6, fontSize: 12,
        fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500,
        background: activeTab === id ? "rgba(255,255,255,0.1)" : "transparent",
        color: activeTab === id ? T.text : T.sub,
        transition: `all 0.15s ease`,
      }}
    >{label}</button>
  );

  const estLiquidation = position && currentPrice
    ? (position.side === "long"
        ? position.price * (1 - 1 / chartLeverage)
        : position.price * (1 + 1 / chartLeverage))
    : null;

  const unrealizedPnl = position && currentPrice
    ? (position.side === "long"
        ? position.units * (currentPrice - position.price)
        : position.units * (position.price - currentPrice))
    : null;

  return (
    <div
      ref={sheetRef}
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 60,
        height, minHeight: sheetState === "collapsed" ? 64 : undefined,
        background: T.surface,
        borderTop: `1px solid ${T.border}`,
        borderRadius: sheetState === "collapsed" ? 0 : "14px 14px 0 0",
        transition: dragRef.current ? "none" : `height 0.4s ${SPRING}, border-radius 0.3s ease`,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Drag handle */}
      <div
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        style={{
          height: 32, flexShrink: 0, cursor: "ns-resize",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 3,
          userSelect: "none",
        }}
        onClick={() => {
          if (sheetState === "collapsed") onSheetStateChange("half");
          else if (sheetState === "half") onSheetStateChange("full");
          else onSheetStateChange("half");
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: T.muted }} />
        {/* Collapsed summary row */}
        {sheetState === "collapsed" && (
          <div style={{
            position: "absolute", left: 0, right: 0, top: 0, height: 64,
            display: "flex", alignItems: "center", paddingInline: 16, gap: 10,
            pointerEvents: "none",
          }}>
            <TrendingUp size={16} color={T.green} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: "'Space Grotesk', sans-serif" }}>
              Paper Trading
            </span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: T.sub, fontFamily: "'Space Grotesk', sans-serif" }}>
              ${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              {" "}&bull;{" "}
              <span style={{ color: totalPnl >= 0 ? T.green : T.red }}>{fmtPnl(totalPnl)}</span>
              {" "}
              <span style={{ fontSize: 10 }}>▲</span>
            </span>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      {sheetState !== "collapsed" && (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {/* Tabs */}
          <div style={{
            display: "flex", gap: 2, padding: "6px 10px 0",
            background: T.card, borderBottom: `1px solid ${T.border}`, flexShrink: 0,
          }}>
            {TAB_BTN("order", "Order")}
            {TAB_BTN("positions", "Positions")}
            {TAB_BTN("history", "History")}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* ── ORDER TAB ── */}
            {activeTab === "order" && (
              <>
                {/* Balance bar */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", borderRadius: 10,
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.sub, fontFamily: "'Space Grotesk', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>Balance</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: equityGain >= 0 ? T.green : T.red, fontFamily: "'Space Grotesk', sans-serif" }}>
                      ${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: T.sub, fontFamily: "'Space Grotesk', sans-serif" }}>P&amp;L</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: totalPnl >= 0 ? T.green : T.red, fontFamily: "monospace" }}>
                      {fmtPnl(totalPnl)} <span style={{ fontSize: 10, color: T.muted }}>({fmtPct(equityGainPct)})</span>
                    </div>
                  </div>
                  {(trades.length > 0 || position) && (
                    <button onClick={onReset} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: T.muted, padding: 4,
                    }} title="Reset">
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>

                {!hasAccount ? (
                  <button
                    onClick={onOpenAccountModal}
                    style={{
                      width: "100%", padding: "14px 0", borderRadius: 10,
                      background: "rgba(0,200,83,0.12)",
                      border: "1px solid rgba(0,200,83,0.3)",
                      color: T.green, fontSize: 14, fontWeight: 700,
                      fontFamily: "'Space Grotesk', sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    Open Paper Trading Account
                  </button>
                ) : (
                  <>
                    {/* Order Type */}
                    <div>
                      <div style={{ fontSize: 10, color: T.sub, marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>Order Type</div>
                      <div style={{ display: "flex", gap: 2, background: T.card, borderRadius: 10, padding: 3, border: `1px solid ${T.border}` }}>
                        {ORDER_TYPES.map(ot => (
                          <button
                            key={ot}
                            onClick={() => onOrderTypeChange(ot)}
                            style={{
                              flex: 1, height: 34, borderRadius: 8,
                              background: orderType === ot ? T.blue : "transparent",
                              color: orderType === ot ? "#fff" : T.sub,
                              fontSize: 13, fontWeight: orderType === ot ? 600 : 400,
                              fontFamily: "'Space Grotesk', sans-serif",
                              border: "none", cursor: "pointer",
                              textTransform: "capitalize",
                              transition: `all 0.18s ${SPRING}`,
                            }}
                          >{ot.charAt(0).toUpperCase() + ot.slice(1)}</button>
                        ))}
                      </div>
                    </div>

                    {/* Limit/Stop price input */}
                    {orderType !== "market" && (
                      <div>
                        <div style={{ fontSize: 10, color: T.sub, marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {orderType === "limit" ? "Limit Price" : "Stop Price"}
                        </div>
                        <input
                          type="number"
                          value={orderType === "limit" ? limitPrice : stopPrice}
                          onChange={e => orderType === "limit" ? onLimitPriceChange(e.target.value) : onStopPriceChange(e.target.value)}
                          placeholder={currentPrice ? fmt(currentPrice) : "price"}
                          style={{
                            width: "100%", padding: "10px 12px",
                            background: "rgba(255,255,255,0.05)",
                            border: `1px solid ${T.border}`, borderRadius: 10,
                            fontSize: 14, fontFamily: "monospace",
                            color: T.text, outline: "none", boxSizing: "border-box",
                          }}
                        />
                      </div>
                    )}

                    {/* Leverage */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: T.sub, fontFamily: "'Space Grotesk', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>Leverage</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 6,
                          background: "rgba(255,159,10,0.15)", color: T.amber, border: "1px solid rgba(255,159,10,0.25)",
                          fontFamily: "monospace",
                        }}>{chartLeverage}×</span>
                      </div>
                      <div style={{ display: "flex", gap: 5 }}>
                        {LEVERAGES.map(lev => (
                          <button key={lev} onClick={() => onLeverageChange(lev)} style={{
                            flex: 1, height: 32, borderRadius: 8,
                            background: chartLeverage === lev ? "rgba(255,159,10,0.15)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${chartLeverage === lev ? "rgba(255,159,10,0.3)" : T.border}`,
                            color: chartLeverage === lev ? T.amber : T.sub,
                            fontSize: 12, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
                            cursor: "pointer",
                          }}>{lev}×</button>
                        ))}
                      </div>
                    </div>

                    {/* Open position info */}
                    {position && currentPrice && (
                      <div style={{
                        padding: 12, borderRadius: 10,
                        background: position.side === "long" ? "rgba(0,200,83,0.06)" : "rgba(255,59,48,0.06)",
                        border: `1px solid ${position.side === "long" ? "rgba(0,200,83,0.2)" : "rgba(255,59,48,0.2)"}`,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: position.side === "long" ? T.green : T.red, fontFamily: "'Space Grotesk', sans-serif", textTransform: "uppercase" }}>
                            {position.side} Open
                          </span>
                          {unrealizedPnl !== null && (
                            <span style={{ fontSize: 13, fontWeight: 700, color: unrealizedPnl >= 0 ? T.green : T.red, fontFamily: "monospace" }}>
                              {fmtPnl(unrealizedPnl)}
                            </span>
                          )}
                        </div>
                        {[
                          ["Entry", `$${fmt(position.price)}`],
                          ["Current", `$${fmt(currentPrice)}`],
                          ...(estLiquidation !== null ? [["Liq. Est.", `$${fmt(estLiquidation)}`]] : []),
                        ].map(([label, value]) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 10, color: T.sub, fontFamily: "'Space Grotesk', sans-serif" }}>{label}</span>
                            <span style={{ fontSize: 11, color: T.text, fontFamily: "monospace" }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Buy / Sell buttons */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <button
                        onClick={onBuy}
                        disabled={!!position}
                        style={{
                          width: "100%", height: 52, borderRadius: 12,
                          background: position ? "rgba(0,200,83,0.08)" : "rgba(0,200,83,0.18)",
                          border: `1px solid ${position ? "rgba(0,200,83,0.15)" : "rgba(0,200,83,0.4)"}`,
                          color: position ? "rgba(0,200,83,0.4)" : T.green,
                          fontSize: 15, fontWeight: 700,
                          fontFamily: "'Space Grotesk', sans-serif",
                          cursor: position ? "not-allowed" : "pointer",
                          letterSpacing: "-0.01em",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {position?.side === "long" ? "▲ Long Open" : `BUY / LONG ${displayLabel.split("/")[0]}`}
                      </button>
                      <button
                        onClick={onSell}
                        disabled={!!position && position.side !== "long"}
                        style={{
                          width: "100%", height: 52, borderRadius: 12,
                          background: !position ? "rgba(255,59,48,0.18)" : position.side === "long" ? "rgba(255,59,48,0.18)" : "rgba(255,59,48,0.08)",
                          border: `1px solid ${!position ? "rgba(255,59,48,0.4)" : position.side === "long" ? "rgba(255,59,48,0.4)" : "rgba(255,59,48,0.15)"}`,
                          color: (!position || position.side === "long") ? T.red : "rgba(255,59,48,0.4)",
                          fontSize: 15, fontWeight: 700,
                          fontFamily: "'Space Grotesk', sans-serif",
                          cursor: (!!position && position.side !== "long") ? "not-allowed" : "pointer",
                          letterSpacing: "-0.01em",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {position?.side === "long" ? `CLOSE / SELL ${displayLabel.split("/")[0]}` : `SELL / SHORT ${displayLabel.split("/")[0]}`}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── POSITIONS TAB ── */}
            {activeTab === "positions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Stats row */}
                {[
                  { label: "Equity",        value: `$${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: equityGain >= 0 ? T.green : T.red },
                  { label: "Realized P&L",  value: fmtPnl(totalPnl),  color: totalPnl >= 0 ? T.green : T.red },
                  { label: "Win Rate",       value: trades.length > 0 ? `${winRate.toFixed(0)}%` : "—", color: winRate >= 50 ? T.green : T.red },
                  { label: "Starting Cap",   value: `$${ptCapital.toLocaleString()}`, color: T.sub },
                ].map(s => (
                  <div key={s.label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 12px", borderRadius: 10,
                    background: "rgba(255,255,255,0.03)", border: `1px solid ${T.border}`,
                  }}>
                    <span style={{ fontSize: 11, color: T.sub, fontFamily: "'Space Grotesk', sans-serif" }}>{s.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: "monospace" }}>{s.value}</span>
                  </div>
                ))}
                {position && (
                  <div style={{
                    padding: 12, borderRadius: 10,
                    background: position.side === "long" ? "rgba(0,200,83,0.06)" : "rgba(255,59,48,0.06)",
                    border: `1px solid ${position.side === "long" ? "rgba(0,200,83,0.2)" : "rgba(255,59,48,0.2)"}`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: position.side === "long" ? T.green : T.red, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 6 }}>
                      {position.side.toUpperCase()} Position Open
                    </div>
                    <div style={{ fontSize: 11, color: T.sub, fontFamily: "monospace" }}>
                      Entry @ ${fmt(position.price)}
                    </div>
                  </div>
                )}
                {!position && (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <p style={{ fontSize: 12, color: T.muted, fontFamily: "'Space Grotesk', sans-serif" }}>No open position</p>
                    <p style={{ fontSize: 11, color: T.muted, fontFamily: "'Space Grotesk', sans-serif", marginTop: 4 }}>Use the Order tab to place a trade</p>
                  </div>
                )}
              </div>
            )}

            {/* ── HISTORY TAB ── */}
            {activeTab === "history" && (
              trades.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <p style={{ fontSize: 12, color: T.muted, fontFamily: "'Space Grotesk', sans-serif" }}>No closed trades yet.</p>
                  <p style={{ fontSize: 11, color: T.muted, fontFamily: "'Space Grotesk', sans-serif", marginTop: 4 }}>
                    Press B to Buy, S to Sell (keyboard shortcuts)
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 6, marginBottom: 6,
                  }}>
                    {[
                      { label: "Trades", value: trades.length },
                      { label: "Wins",   value: wins },
                      { label: "Win%",   value: `${winRate.toFixed(0)}%` },
                    ].map(s => (
                      <div key={s.label} style={{
                        padding: "8px 10px", borderRadius: 8, textAlign: "center",
                        background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
                      }}>
                        <div style={{ fontSize: 10, color: T.sub, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 2 }}>{s.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "monospace" }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  {[...trades].reverse().map((t, i) => (
                    <div key={t.id} style={{
                      padding: "10px 12px", borderRadius: 10,
                      background: t.pnl >= 0 ? "rgba(0,200,83,0.05)" : "rgba(255,59,48,0.04)",
                      border: `1px solid ${t.pnl >= 0 ? "rgba(0,200,83,0.15)" : "rgba(255,59,48,0.12)"}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: T.muted, fontFamily: "monospace" }}>#{trades.length - i}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.pnl >= 0 ? T.green : T.red, fontFamily: "monospace" }}>
                          {fmtPnl(t.pnl)} <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>({fmtPct(t.pnlPct)})</span>
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, fontSize: 11, fontFamily: "monospace", color: T.sub }}>
                        <span style={{ color: T.green }}>B</span><span>${fmt(t.entryPrice)}</span>
                        <span style={{ color: T.muted }}>→</span>
                        <span style={{ color: T.red }}>S</span><span>${fmt(t.exitPrice)}</span>
                      </div>
                      <div style={{ fontSize: 10, color: T.muted, fontFamily: "monospace", marginTop: 2 }}>
                        {fmtDate(t.entryTime)} → {fmtDate(t.exitTime)}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
