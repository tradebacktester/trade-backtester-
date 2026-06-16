import React, { useState, useEffect } from "react";
import { Dna, TrendingUp, Target, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";
import { PremiumGate } from "@/components/premium-gate";

interface BacktestRow {
  symbol: string;
  winRate: number | null;
  totalTrades: number;
  totalReturn: number | null;
}

interface DNAFootprintResult {
  compatibilityScore: number;
  personalWinRate: number;
  matchedBacktests: number;
  note: string;
}

interface TraderDNAFootprintPanelProps {
  symbol: string;
}

function TraderDNAContent({ symbol }: TraderDNAFootprintPanelProps) {
  const { token } = useAuth();
  const [result, setResult] = useState<DNAFootprintResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);

    fetch(`${API_BASE}/api/backtests`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() as Promise<BacktestRow[]> : Promise.resolve([]))
      .then((backtests) => {
        const normalizedSymbol = symbol.replace("/", "").toUpperCase();
        const matched = backtests.filter(b =>
          b.symbol?.toUpperCase().replace("/", "") === normalizedSymbol && b.totalTrades > 0
        );
        if (matched.length === 0) {
          setResult({ compatibilityScore: 0, personalWinRate: 0, matchedBacktests: 0, note: `No backtest history for ${symbol} yet.` });
          return;
        }
        const avgWinRate = matched.reduce((a, b) => a + (b.winRate ?? 0), 0) / matched.length;
        const avgReturn = matched.reduce((a, b) => a + (b.totalReturn ?? 0), 0) / matched.length;
        const compatibilityScore = Math.min(100, Math.round(
          avgWinRate * 0.5 +
          Math.max(0, avgReturn) * 0.3 +
          Math.min(matched.length * 10, 20)
        ));
        setResult({
          compatibilityScore,
          personalWinRate: parseFloat(avgWinRate.toFixed(1)),
          matchedBacktests: matched.length,
          note: `Based on ${matched.length} backtest${matched.length > 1 ? "s" : ""} on ${symbol}`,
        });
      })
      .catch(() => setResult({ compatibilityScore: 0, personalWinRate: 0, matchedBacktests: 0, note: "Unable to load history." }))
      .finally(() => setLoading(false));
  }, [token, symbol]);

  const scoreColor = !result ? "#888"
    : result.compatibilityScore >= 70 ? "#22c55e"
    : result.compatibilityScore >= 40 ? "#f59e0b"
    : "#ef4444";

  return (
    <div style={{
      background: "var(--card-bg)", border: "1px solid hsl(var(--border))",
      borderRadius: "14px", padding: "16px", marginBottom: "12px",
    }}>
      <div className="flex items-center gap-2 mb-3">
        <div style={{ background: "rgba(6,182,212,0.1)", borderRadius: "8px", padding: "5px", border: "1px solid rgba(6,182,212,0.2)" }}>
          <Dna style={{ height: "13px", width: "13px", color: "#06b6d4" }} />
        </div>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "hsl(var(--foreground))" }}>Trader DNA Match</span>
        <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", background: "rgba(6,182,212,0.1)", color: "#06b6d4", fontWeight: 600, letterSpacing: "0.06em" }}>ELITE</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4 gap-2" style={{ color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>
          <Loader2 style={{ height: "13px", width: "13px" }} className="animate-spin" />
          Scanning history…
        </div>
      )}

      {result && !loading && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: "Compat. Score", value: `${result.compatibilityScore}%`, color: scoreColor, icon: Target },
              { label: "Personal Win Rate", value: result.matchedBacktests > 0 ? `${result.personalWinRate}%` : "—", color: "#a0a0a0", icon: TrendingUp },
              { label: "Backtests", value: String(result.matchedBacktests), color: "#06b6d4", icon: Dna },
            ].map((stat) => (
              <div key={stat.label} style={{ background: "hsl(var(--muted)/0.3)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
                <stat.icon style={{ height: "12px", width: "12px", color: stat.color, margin: "0 auto 3px" }} />
                <div style={{ fontSize: "15px", fontWeight: 700, color: stat.color, fontFamily: "var(--app-font-mono)" }}>{stat.value}</div>
                <div style={{ fontSize: "9px", color: "hsl(var(--muted-foreground))", letterSpacing: "0.04em" }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {result.compatibilityScore > 0 && (
            <div style={{ height: "4px", background: "hsl(var(--muted))", borderRadius: "2px", marginBottom: "8px", overflow: "hidden" }}>
              <div style={{ width: `${result.compatibilityScore}%`, height: "100%", background: `linear-gradient(90deg, ${scoreColor}66, ${scoreColor})`, borderRadius: "2px", transition: "width 0.6s ease" }} />
            </div>
          )}

          <p style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", textAlign: "center" }}>{result.note}</p>
        </>
      )}
    </div>
  );
}

export function TraderDNAFootprintPanel(props: TraderDNAFootprintPanelProps) {
  return (
    <PremiumGate feature="dataExport" requiredPlan="elite">
      <TraderDNAContent {...props} />
    </PremiumGate>
  );
}
