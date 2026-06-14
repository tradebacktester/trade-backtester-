import { useState, useEffect } from "react";
import { T } from "./styles";

interface StatsFloatingCardProps {
  trades: { pnl: number }[];
  wins: number;
  winRate: number;
  hasPosition: boolean;
  equityGainPct: number;
}

export function StatsFloatingCard({
  trades, wins, winRate, hasPosition, equityGainPct,
}: StatsFloatingCardProps) {
  const [visible, setVisible] = useState(true);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    setVisible(true);
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => setVisible(false), 5000);
    setTimer(t);
  }

  useEffect(() => {
    show();
    return () => { if (timer) clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades.length, hasPosition]);

  const today = equityGainPct;

  return (
    <div
      onClick={show}
      style={{
        position: "absolute", top: 56, right: 12, zIndex: 35,
        width: 120,
        background: "rgba(28,28,30,0.85)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: 10, padding: "10px 12px",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: "opacity 0.4s ease",
        cursor: "pointer",
      }}
    >
      {[
        { label: "Win Rate", value: trades.length > 0 ? `${winRate.toFixed(0)}%` : "—", color: trades.length > 0 && winRate >= 50 ? T.green : T.red },
        { label: "Today",    value: `${today >= 0 ? "+" : ""}${today.toFixed(1)}%`, color: today >= 0 ? T.green : T.red },
        { label: "Open",     value: hasPosition ? "1" : "0", color: hasPosition ? T.green : T.sub },
      ].map(row => (
        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
          <span style={{ fontSize: 10, fontFamily: "'Space Grotesk', sans-serif", color: T.sub }}>{row.label}</span>
          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", color: row.color }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
