import React from "react";

interface CandleDef {
  bull: boolean;
  bodyTopPct: number;
  bodyHPct: number;
  wickTopPct: number;
  wickHPct: number;
}

const CANDLES: CandleDef[] = [
  { bull: true,  wickTopPct: 4,  wickHPct: 84, bodyTopPct: 22, bodyHPct: 46 },
  { bull: false, wickTopPct: 10, wickHPct: 76, bodyTopPct: 10, bodyHPct: 38 },
  { bull: true,  wickTopPct: 2,  wickHPct: 90, bodyTopPct: 18, bodyHPct: 56 },
  { bull: false, wickTopPct: 8,  wickHPct: 70, bodyTopPct: 30, bodyHPct: 32 },
  { bull: true,  wickTopPct: 6,  wickHPct: 80, bodyTopPct: 20, bodyHPct: 48 },
  { bull: false, wickTopPct: 14, wickHPct: 66, bodyTopPct: 14, bodyHPct: 36 },
  { bull: true,  wickTopPct: 4,  wickHPct: 86, bodyTopPct: 26, bodyHPct: 44 },
];

const ANIM_DUR = 1.8;
const STAGGER  = 0.22;

export interface CandleLoaderProps {
  size?: "xs" | "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

export function CandleLoader({ size = "md", text, className = "" }: CandleLoaderProps) {
  const heights: Record<string, number> = { xs: 24, sm: 36, md: 52, lg: 72 };
  const widths:  Record<string, number> = { xs: 5,  sm: 7,  md: 10, lg: 14 };
  const gaps:    Record<string, number> = { xs: 2,  sm: 3,  md: 4,  lg: 6  };
  const h   = heights[size];
  const w   = widths[size];
  const gap = gaps[size];

  return (
    <div className={`flex flex-col items-center ${className}`} style={{ gap: size === "xs" ? 4 : 8 }}>
      <div className="flex items-center" style={{ gap, height: h }}>
        {CANDLES.map((c, i) => {
          const delay   = `${i * STAGGER}s`;
          const dur     = `${ANIM_DUR}s`;
          const color   = c.bull ? "#22c55e" : "#ef4444";
          const dimClr  = c.bull ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)";

          return (
            <div key={i} style={{ position: "relative", width: w, height: h, flexShrink: 0 }}>
              {/* Wick */}
              <div
                style={{
                  position:        "absolute",
                  left:            "50%",
                  transform:       "translateX(-50%) scaleY(0)",
                  transformOrigin: "50% 0%",
                  width:           1.5,
                  top:             `${c.wickTopPct}%`,
                  height:          `${c.wickHPct}%`,
                  background:      color,
                  opacity:         0.65,
                  borderRadius:    1,
                  animation:       `cl-wick ${dur} ease-in-out ${delay} infinite`,
                }}
              />
              {/* Body */}
              <div
                style={{
                  position:        "absolute",
                  left:            0,
                  width:           "100%",
                  top:             `${c.bodyTopPct}%`,
                  height:          `${c.bodyHPct}%`,
                  background:      color,
                  boxShadow:       `0 0 6px 1px ${dimClr}`,
                  borderRadius:    2,
                  transform:       "scaleY(0)",
                  transformOrigin: "50% 0%",
                  animation:       `cl-body ${dur} ease-in-out ${delay} infinite`,
                }}
              />
            </div>
          );
        })}
      </div>

      {text && (
        <p
          className="font-mono tracking-wide"
          style={{
            fontSize:    size === "xs" ? 9 : size === "sm" ? 10 : size === "lg" ? 13 : 11,
            color:       "hsl(var(--muted-foreground))",
            letterSpacing: "0.08em",
          }}
        >
          {text}
        </p>
      )}
    </div>
  );
}
