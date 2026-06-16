import React, { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot,
} from "recharts";
import { type FootprintCandle } from "@/hooks/useFootprintData";

interface CVDChartProps {
  candles: FootprintCandle[];
  height?: number;
}

interface DivergencePoint {
  index: number;
  date: string;
  cvd: number;
  type: "bullish" | "bearish";
}

function detectDivergences(candles: FootprintCandle[]): DivergencePoint[] {
  const points: DivergencePoint[] = [];
  if (candles.length < 6) return points;

  for (let i = 4; i < candles.length; i++) {
    const prev = candles[i - 4]!;
    const curr = candles[i]!;

    const priceMadeHigher = curr.high > prev.high;
    const cvdMadeLower = curr.cvd < prev.cvd;
    if (priceMadeHigher && cvdMadeLower && curr.isDivergence) {
      points.push({ index: i, date: curr.date, cvd: curr.cvd, type: "bearish" });
    }

    const priceMadeLower = curr.low < prev.low;
    const cvdMadeHigher = curr.cvd > prev.cvd;
    if (priceMadeLower && cvdMadeHigher && curr.isDivergence) {
      points.push({ index: i, date: curr.date, cvd: curr.cvd, type: "bullish" });
    }
  }
  return points;
}

function fmtDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  } catch { return ""; }
}

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export function CVDChart({ candles, height = 140 }: CVDChartProps) {
  const divergences = useMemo(() => detectDivergences(candles), [candles]);

  const chartData = useMemo(() => candles.map((c) => ({
    date: fmtDate(c.date),
    cvd: c.cvd,
    positive: c.cvd >= 0 ? c.cvd : null,
    negative: c.cvd < 0 ? c.cvd : null,
    rawDate: c.date,
  })), [candles]);

  if (candles.length === 0) return null;

  const minCvd = Math.min(...candles.map(c => c.cvd));
  const maxCvd = Math.max(...candles.map(c => c.cvd));
  const lastCvd = candles[candles.length - 1]?.cvd ?? 0;

  return (
    <div style={{ background: "var(--card-bg)", borderTop: "1px solid hsl(var(--border))", padding: "8px 4px 4px" }}>
      <div className="flex items-center justify-between px-3 pb-1">
        <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>
          CVD — Cumulative Volume Delta
        </span>
        <span style={{
          fontSize: "11px", fontWeight: 700,
          color: lastCvd >= 0 ? "#22c55e" : "#ef4444",
          fontFamily: "var(--app-font-mono)",
        }}>
          {lastCvd >= 0 ? "+" : ""}{fmtNum(lastCvd)}
        </span>
      </div>

      {divergences.length > 0 && (
        <div className="flex gap-2 px-3 pb-1">
          {divergences.slice(-2).map((d, i) => (
            <span key={i} style={{
              fontSize: "9px", padding: "1px 6px", borderRadius: "4px",
              background: d.type === "bullish" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              color: d.type === "bullish" ? "#22c55e" : "#ef4444",
              border: `1px solid ${d.type === "bullish" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
              fontWeight: 600, letterSpacing: "0.06em",
            }}>
              {d.type === "bullish" ? "▲ BULL DIV" : "▼ BEAR DIV"}
            </span>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cvdGreenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="cvdRedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.02} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "var(--app-font-mono)" }}
            tickFormatter={fmtNum}
            domain={[minCvd * 1.05, maxCvd * 1.05]}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card-bg)", border: "1px solid hsl(var(--border))",
              borderRadius: "8px", fontSize: "11px",
            }}
            formatter={(value: number) => [fmtNum(value), "CVD"]}
            labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: "10px" }}
          />
          <Area type="monotone" dataKey="positive" stroke="#22c55e" strokeWidth={1.5} fill="url(#cvdGreenGrad)" dot={false} connectNulls />
          <Area type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={1.5} fill="url(#cvdRedGrad)" dot={false} connectNulls />

          {divergences.map((d, i) => (
            <ReferenceDot
              key={i}
              x={fmtDate(d.date)}
              y={d.cvd}
              r={4}
              fill={d.type === "bullish" ? "#22c55e" : "#ef4444"}
              stroke="var(--card-bg)"
              strokeWidth={1.5}
              label={{
                value: d.type === "bullish" ? "▲" : "▼",
                fontSize: 8,
                fill: d.type === "bullish" ? "#22c55e" : "#ef4444",
                position: d.type === "bullish" ? "bottom" : "top",
              }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
