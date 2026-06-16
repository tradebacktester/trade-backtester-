import React, { useState, useEffect } from "react";
import { Sparkles, TrendingUp, TrendingDown, Minus, RefreshCw, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";
import { PremiumGate } from "@/components/premium-gate";
import { type FootprintCandle } from "@/hooks/useFootprintData";

interface AIInsight {
  insight: string;
  probability: number;
  recommendation: string;
  bias: "bullish" | "bearish" | "neutral";
}

interface AIOrderFlowPanelProps {
  candles: FootprintCandle[];
  symbol: string;
  timeframe: string;
}

function ProbabilityMeter({ value, bias }: { value: number; bias: string }) {
  const color = bias === "bullish" ? "#22c55e" : bias === "bearish" ? "#ef4444" : "#f59e0b";
  const width = Math.max(2, Math.min(100, value));
  return (
    <div style={{ margin: "8px 0" }}>
      <div className="flex justify-between items-center mb-1">
        <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Continuation Probability
        </span>
        <span style={{ fontSize: "14px", fontWeight: 700, color, fontFamily: "var(--app-font-mono)" }}>
          {value}%
        </span>
      </div>
      <div style={{ height: "5px", background: "hsl(var(--muted))", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{
          width: `${width}%`, height: "100%", borderRadius: "3px",
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

function AIOrderFlowContent({ candles, symbol, timeframe }: AIOrderFlowPanelProps) {
  const { token } = useAuth();
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchInsight() {
    if (!token || candles.length === 0) return;
    setLoading(true);
    setError(null);

    const recent = candles.slice(-5);
    const totalDelta = recent.reduce((a, c) => a + c.delta, 0);
    const lastCvd = candles[candles.length - 1]?.cvd ?? 0;
    const imbalanceCount = recent.reduce((a, c) => a + c.levels.filter(l => l.isImbalance).length, 0);
    const absorptionCount = recent.reduce((a, c) => a + c.levels.filter(l => l.isBuyAbsorption || l.isSellAbsorption).length, 0);
    const isExhaustion = recent.some(c => c.isExhaustion);
    const lastPrice = candles[candles.length - 1]?.close ?? 0;

    try {
      const res = await fetch(`${API_BASE}/api/ai/footprint`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbol, timeframe, delta: totalDelta, cvd: lastCvd, imbalanceCount, absorptionCount, isExhaustion, lastPrice }),
      });
      const data = await res.json() as AIInsight & { error?: string };
      if (!res.ok) { setError(data.error ?? "AI analysis failed"); return; }
      setInsight(data);
    } catch {
      setError("Failed to load AI analysis");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (candles.length > 0 && !insight && !loading) {
      void fetchInsight();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe, candles.length]);

  const BiasIcon = insight?.bias === "bullish" ? TrendingUp : insight?.bias === "bearish" ? TrendingDown : Minus;
  const biasColor = insight?.bias === "bullish" ? "#22c55e" : insight?.bias === "bearish" ? "#ef4444" : "#f59e0b";

  return (
    <div style={{
      background: "var(--card-bg)", border: "1px solid hsl(var(--border))",
      borderRadius: "14px", padding: "16px", marginBottom: "12px",
    }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div style={{ background: "rgba(160,160,160,0.1)", borderRadius: "8px", padding: "5px", border: "1px solid rgba(160,160,160,0.2)" }}>
            <Sparkles style={{ height: "13px", width: "13px", color: "#a0a0a0" }} />
          </div>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "hsl(var(--foreground))" }}>AI Order Flow</span>
          <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "4px", background: "rgba(160,160,160,0.1)", color: "#a0a0a0", fontWeight: 600, letterSpacing: "0.06em" }}>ELITE</span>
        </div>
        <button
          onClick={() => { void fetchInsight(); }}
          disabled={loading}
          style={{ background: "transparent", border: "none", cursor: loading ? "not-allowed" : "pointer", color: "hsl(var(--muted-foreground))", padding: "4px" }}
        >
          {loading ? <Loader2 style={{ height: "13px", width: "13px" }} className="animate-spin" /> : <RefreshCw style={{ height: "13px", width: "13px" }} />}
        </button>
      </div>

      {loading && !insight && (
        <div className="flex items-center justify-center py-6 gap-2" style={{ color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>
          <Loader2 style={{ height: "14px", width: "14px" }} className="animate-spin" />
          Analyzing order flow…
        </div>
      )}

      {error && !loading && (
        <p style={{ fontSize: "12px", color: "#ef4444", textAlign: "center", padding: "8px 0" }}>{error}</p>
      )}

      {insight && !loading && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <BiasIcon style={{ height: "13px", width: "13px", color: biasColor }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: biasColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {insight.bias} Bias
            </span>
          </div>

          <ProbabilityMeter value={insight.probability} bias={insight.bias} />

          <p style={{ fontSize: "12px", lineHeight: 1.55, color: "hsl(var(--muted-foreground))", margin: "10px 0 8px" }}>
            {insight.insight}
          </p>

          <div style={{
            background: "rgba(160,160,160,0.06)", border: "1px solid rgba(160,160,160,0.15)",
            borderRadius: "8px", padding: "8px 10px",
          }}>
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#a0a0a0", marginBottom: "3px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Recommendation
            </p>
            <p style={{ fontSize: "12px", color: "hsl(var(--foreground))", lineHeight: 1.5 }}>
              {insight.recommendation}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export function AIOrderFlowPanel(props: AIOrderFlowPanelProps) {
  return (
    <PremiumGate feature="dataExport" requiredPlan="elite">
      <AIOrderFlowContent {...props} />
    </PremiumGate>
  );
}
