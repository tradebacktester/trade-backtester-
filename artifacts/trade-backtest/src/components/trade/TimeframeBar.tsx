import { useState } from "react";
import { T, SPRING } from "./styles";
import { ChevronDown } from "lucide-react";

const PRIMARY_TF = [
  { value: "1m",  label: "1m" },
  { value: "5m",  label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h",  label: "1h" },
  { value: "4h",  label: "4h" },
  { value: "1d",  label: "1D" },
];

const MORE_TF = [
  { value: "1w",  label: "1W" },
];

interface TimeframeBarProps {
  interval: string;
  onChange: (val: string) => void;
}

export function TimeframeBar({ interval, onChange }: TimeframeBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_TF.some(t => t.value === interval);

  return (
    <div style={{
      height: 48, minHeight: 48, flexShrink: 0,
      background: T.surface,
      borderTop: `1px solid ${T.border}`,
      display: "flex", alignItems: "center",
      paddingInline: 12, gap: 2,
      position: "relative",
    }}>
      {/* Primary timeframes — iOS segmented pill style */}
      <div style={{
        display: "flex", alignItems: "center",
        background: T.card,
        borderRadius: 10,
        padding: 3, gap: 1,
        border: `1px solid ${T.border}`,
      }}>
        {PRIMARY_TF.map(tf => {
          const active = interval === tf.value;
          return (
            <button
              key={tf.value}
              onClick={() => onChange(tf.value)}
              style={{
                minWidth: 44, height: 32,
                borderRadius: 8,
                background: active ? T.blue : "transparent",
                color: active ? "#FFFFFF" : T.sub,
                fontSize: 13, fontWeight: active ? 600 : 400,
                fontFamily: "'Space Grotesk', sans-serif",
                border: "none", cursor: "pointer",
                transition: `all 0.2s ${SPRING}`,
                padding: "0 10px",
                letterSpacing: active ? "-0.01em" : "0",
              }}
            >
              {tf.label}
            </button>
          );
        })}
      </div>

      {/* More */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setMoreOpen(v => !v)}
          style={{
            height: 32, padding: "0 10px",
            display: "flex", alignItems: "center", gap: 3,
            borderRadius: 8,
            background: isMoreActive ? T.blue : T.card,
            color: isMoreActive ? "#fff" : T.sub,
            border: `1px solid ${isMoreActive ? "transparent" : T.border}`,
            cursor: "pointer", fontSize: 13,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {isMoreActive ? MORE_TF.find(t => t.value === interval)?.label : "More"}
          <ChevronDown size={11} />
        </button>
        {moreOpen && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 100 }}
              onClick={() => setMoreOpen(false)}
            />
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0,
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: 6,
              zIndex: 101, display: "flex", flexDirection: "column", gap: 1,
              minWidth: 100,
              boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
            }}>
              {MORE_TF.map(tf => (
                <button
                  key={tf.value}
                  onClick={() => { onChange(tf.value); setMoreOpen(false); }}
                  style={{
                    padding: "8px 14px", textAlign: "left",
                    background: interval === tf.value ? "rgba(0,122,255,0.15)" : "transparent",
                    color: interval === tf.value ? T.blue : T.text,
                    fontSize: 13, fontFamily: "'Space Grotesk', sans-serif",
                    border: "none", borderRadius: 7, cursor: "pointer",
                  }}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
