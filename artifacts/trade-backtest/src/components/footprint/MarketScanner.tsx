import React, { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";
import { PremiumGate } from "@/components/premium-gate";

interface Opportunity {
  symbol: string;
  displayName: string;
  delta: number;
  imbalanceCount: number;
  absorptionScore: number;
  lastPrice: number;
  change24h: number;
  signal: "bullish" | "bearish" | "neutral";
}

interface MarketScannerProps {
  onSelectSymbol?: (symbol: string) => void;
}

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(3);
  return p.toFixed(5);
}

function SignalBadge({ signal }: { signal: string }) {
  const cfg = signal === "bullish"
    ? { color: "#22c55e", bg: "rgba(34,197,94,0.08)", icon: TrendingUp, label: "BULL" }
    : signal === "bearish"
    ? { color: "#ef4444", bg: "rgba(239,68,68,0.08)", icon: TrendingDown, label: "BEAR" }
    : { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", icon: Minus, label: "NEUT" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", padding: "2px 6px", borderRadius: "5px", background: cfg.bg, color: cfg.color, fontSize: "9px", fontWeight: 700, letterSpacing: "0.06em" }}>
      <cfg.icon style={{ height: "9px", width: "9px" }} />
      {cfg.label}
    </span>
  );
}

function ScannerContent({ onSelectSymbol }: MarketScannerProps) {
  const { token } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOpportunities = async (silent = false) => {
    if (!token) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/footprint/scanner`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { opportunities?: Opportunity[]; error?: string };
      if (res.ok) {
        setOpportunities(data.opportunities ?? []);
        setLastUpdated(new Date());
      }
    } catch { /* ignore */ }
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => {
    void fetchOpportunities(false);
    timerRef.current = setInterval(() => { void fetchOpportunities(true); }, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid hsl(var(--border))", borderRadius: "14px", overflow: "hidden" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "hsl(var(--foreground))" }}>Market Scanner</span>
          {lastUpdated && (
            <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginLeft: "8px" }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          onClick={() => void fetchOpportunities(false)}
          disabled={loading}
          style={{ background: "transparent", border: "none", cursor: loading ? "not-allowed" : "pointer", color: "hsl(var(--muted-foreground))", padding: "4px" }}
        >
          {loading ? <Loader2 style={{ height: "13px", width: "13px" }} className="animate-spin" /> : <RefreshCw style={{ height: "13px", width: "13px" }} />}
        </button>
      </div>

      {loading && opportunities.length === 0 && (
        <div className="flex items-center justify-center py-8 gap-2" style={{ color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>
          <Loader2 style={{ height: "14px", width: "14px" }} className="animate-spin" />
          Scanning markets…
        </div>
      )}

      {opportunities.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                {["Symbol", "Price", "24h", "Delta", "Imbal.", "Absorb.", "Signal", ""].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "9px", fontWeight: 600, letterSpacing: "0.08em", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {opportunities.map((op) => (
                <tr
                  key={op.symbol}
                  style={{ borderBottom: "1px solid hsl(var(--border))", cursor: "pointer", transition: "background 0.12s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "hsl(var(--muted)/0.4)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  onClick={() => onSelectSymbol?.(op.symbol)}
                >
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "hsl(var(--foreground))", whiteSpace: "nowrap" }}>
                    {op.displayName}
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "var(--app-font-mono)", fontSize: "11px", color: "hsl(var(--foreground))" }}>
                    {fmtPrice(op.lastPrice)}
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "var(--app-font-mono)", fontSize: "11px", color: op.change24h >= 0 ? "#22c55e" : "#ef4444" }}>
                    {op.change24h >= 0 ? "+" : ""}{op.change24h.toFixed(2)}%
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "var(--app-font-mono)", fontSize: "11px", color: op.delta >= 0 ? "#22c55e" : "#ef4444" }}>
                    {op.delta >= 0 ? "+" : ""}{fmtNum(op.delta)}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, fontFamily: "var(--app-font-mono)", color: op.imbalanceCount > 5 ? "#f59e0b" : "hsl(var(--foreground))" }}>
                      {op.imbalanceCount}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, fontFamily: "var(--app-font-mono)", color: op.absorptionScore > 3 ? "#a855f7" : "hsl(var(--foreground))" }}>
                      {op.absorptionScore}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <SignalBadge signal={op.signal} />
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <ArrowRight style={{ height: "12px", width: "12px", color: "hsl(var(--muted-foreground))" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function MarketScanner(props: MarketScannerProps) {
  return (
    <PremiumGate feature="dataExport" requiredPlan="elite">
      <ScannerContent {...props} />
    </PremiumGate>
  );
}
