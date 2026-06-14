import { Sparkles, ChevronRight, ChevronDown, Check, AlertTriangle } from "lucide-react";
import { T, SPRING } from "./styles";

type GhostResult = {
  hasHistory: boolean;
  similarityScore: number;
  winRate: number;
  avgReturn: number;
  avgDrawdown: number;
  message?: string;
};

interface AITradeCheckProps {
  symbol: string;
  ghostResult: GhostResult | null;
  ghostLoading: boolean;
  ghostSide: "long" | "short";
  onGhostSideChange: (side: "long" | "short") => void;
  onRunGhost: (side: "long" | "short") => void;
  expanded: boolean;
  onToggle: () => void;
  token: string | null;
}

export function AITradeCheck({
  symbol, ghostResult, ghostLoading, ghostSide,
  onGhostSideChange, onRunGhost, expanded, onToggle, token,
}: AITradeCheckProps) {
  const similarity = ghostResult?.hasHistory ? ghostResult.similarityScore : null;
  const matchPct   = similarity ?? 0;

  return (
    <div style={{
      background: T.card,
      borderTop: `1px solid ${T.border}`,
      overflow: "hidden",
      transition: `max-height 0.35s ${SPRING}`,
      maxHeight: expanded ? 220 : 64,
      flexShrink: 0,
    }}>
      {/* Collapsed row (always visible) */}
      <button
        onClick={onToggle}
        style={{
          width: "100%", height: 64, padding: "0 16px",
          display: "flex", alignItems: "center", gap: 10,
          background: "transparent", border: "none", cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: "rgba(139,92,246,0.18)", border: "1px solid rgba(139,92,246,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Sparkles size={15} color="#8b5cf6" />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
            AI Trade Check
          </div>
          <div style={{ fontSize: 11, color: T.sub, fontFamily: "'Space Grotesk', sans-serif", marginTop: 2 }}>
            {ghostResult?.hasHistory
              ? `Trade Similarity: ${similarity}% Match`
              : "Tap Analyze to check your setup"
            }
          </div>
        </div>

        {!expanded && ghostResult?.hasHistory && (
          <span style={{
            fontSize: 11, color: T.blue, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
            marginRight: 4,
          }}>
            {matchPct}%
          </span>
        )}

        {!expanded && !token && (
          <span style={{ fontSize: 11, color: T.sub, fontFamily: "'Space Grotesk', sans-serif", marginRight: 4 }}>
            Sign in
          </span>
        )}

        {expanded
          ? <ChevronDown size={14} color={T.sub} />
          : <ChevronRight size={14} color={T.sub} />
        }
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: "0 16px 16px" }}>
          {!token ? (
            <p style={{ fontSize: 12, color: T.sub, fontFamily: "'Space Grotesk', sans-serif" }}>
              Sign in to use AI Trade Check — it analyses your trade history to detect patterns.
            </p>
          ) : ghostResult?.hasHistory ? (
            <>
              <p style={{
                fontSize: 12, color: T.sub, fontFamily: "'Space Grotesk', sans-serif",
                marginBottom: 10, lineHeight: 1.5,
              }}>
                Current setup matches <strong style={{ color: T.text }}>{similarity}%</strong> of your winning {symbol} trades.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                {[
                  { label: "Win Rate on similar",    value: `${ghostResult.winRate}%`,          ok: ghostResult.winRate >= 50 },
                  { label: "Avg Return",             value: `${ghostResult.avgReturn >= 0 ? "+" : ""}${ghostResult.avgReturn}%`, ok: ghostResult.avgReturn >= 0 },
                  { label: "Avg Drawdown",           value: `-${ghostResult.avgDrawdown}%`,     ok: ghostResult.avgDrawdown <= 10 },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {row.ok
                        ? <Check size={11} color={T.green} />
                        : <AlertTriangle size={11} color={T.amber} />
                      }
                      <span style={{ fontSize: 11, color: T.sub, fontFamily: "'Space Grotesk', sans-serif" }}>{row.label}</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: row.ok ? T.green : T.amber, fontFamily: "monospace" }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : ghostResult && !ghostResult.hasHistory ? (
            <p style={{ fontSize: 12, color: T.sub, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 10 }}>
              {ghostResult.message ?? "Not enough trade history. Run a few backtests first."}
            </p>
          ) : null}

          {/* Side + Run buttons */}
          {token && (
            <div style={{ display: "flex", gap: 6 }}>
              {(["long", "short"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => onGhostSideChange(s)}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: 8,
                    fontSize: 11, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
                    cursor: "pointer", textTransform: "capitalize",
                    background: ghostSide === s
                      ? (s === "long" ? "rgba(0,200,83,0.15)" : "rgba(255,59,48,0.15)")
                      : "rgba(255,255,255,0.04)",
                    border: `1px solid ${ghostSide === s ? (s === "long" ? "rgba(0,200,83,0.3)" : "rgba(255,59,48,0.3)") : T.border}`,
                    color: ghostSide === s ? (s === "long" ? T.green : T.red) : T.sub,
                  }}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => onRunGhost(ghostSide)}
                disabled={ghostLoading}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 8,
                  fontSize: 11, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
                  cursor: ghostLoading ? "wait" : "pointer",
                  background: "rgba(139,92,246,0.15)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  color: "#8b5cf6",
                  opacity: ghostLoading ? 0.5 : 1,
                }}
              >
                {ghostLoading ? "…" : "Analyze →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
