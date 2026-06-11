// ── Drawing Toolbar — Premium Glassmorphism ────────────────────────────────────
import { useState } from "react";
import type { DrawingLayerHandle } from "./drawing-layer";

interface Props {
  activeTool:   string;
  onToolChange: (t: string) => void;
  layerHandle:  DrawingLayerHandle | null;
}

const TOOLS = [
  {
    id: "cursor", label: "Select / Move", group: 0,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 2l10 5.5-5.5 1.5L6 15z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "trendline", label: "Trend Line", group: 1,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <line x1="2" y1="13" x2="14" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="2" cy="13" r="1.5" fill="currentColor"/>
        <circle cx="14" cy="3" r="1.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: "ray", label: "Ray", group: 1,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="3" cy="13" r="1.5" fill="currentColor"/>
        <line x1="3" y1="13" x2="14" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M11.5 2.5l3 0.5-0.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "hline", label: "Horizontal Line", group: 1,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="1"  cy="8" r="1.3" fill="currentColor"/>
        <circle cx="15" cy="8" r="1.3" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: "vline", label: "Vertical Line", group: 1,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="8" cy="1"  r="1.3" fill="currentColor"/>
        <circle cx="8" cy="15" r="1.3" fill="currentColor"/>
      </svg>
    ),
  },
  {
    id: "rect", label: "Rectangle", group: 2,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="4" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" fill="rgba(41,98,255,0.15)"/>
      </svg>
    ),
  },
  {
    id: "fib", label: "Fibonacci Retracement", group: 2,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <line x1="1" y1="3"  x2="15" y2="3"  stroke="#ef5350" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="1" y1="6"  x2="15" y2="6"  stroke="#26a69a" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="1" y1="8"  x2="15" y2="8"  stroke="#2962ff" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="1" y1="10" x2="15" y2="10" stroke="#ff9800" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="1" y1="13" x2="15" y2="13" stroke="#ef5350" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="3" y1="3"  x2="13" y2="13" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="2 2"/>
      </svg>
    ),
  },
  {
    id: "pitchfork", label: "Pitchfork (3 clicks)", group: 2,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 14 L13 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M4 14 L13 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.7"/>
        <path d="M4 14 L13 13" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
        <line x1="13" y1="5" x2="13" y2="13" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2 2" opacity="0.4"/>
      </svg>
    ),
  },
  {
    id: "text", label: "Text Label", group: 3,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <text x="2" y="13" fontFamily="Georgia,serif" fontSize="13" fill="currentColor" fontWeight="700">T</text>
        <line x1="2" y1="14.5" x2="14" y2="14.5" stroke="currentColor" strokeWidth="1" opacity="0.35"/>
      </svg>
    ),
  },
  {
    id: "long", label: "Long Position", group: 4,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="7" width="14" height="6" rx="1" fill="rgba(38,166,154,0.2)" stroke="#26a69a" strokeWidth="1.2"/>
        <rect x="1" y="2" width="14" height="5" rx="1" fill="rgba(239,83,80,0.18)" stroke="#ef5350" strokeWidth="1"/>
        <path d="M8 1L5 3.5h6z" fill="#26a69a"/>
      </svg>
    ),
  },
  {
    id: "short", label: "Short Position", group: 4,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3" width="14" height="6" rx="1" fill="rgba(239,83,80,0.2)" stroke="#ef5350" strokeWidth="1.2"/>
        <rect x="1" y="9" width="14" height="5" rx="1" fill="rgba(38,166,154,0.18)" stroke="#26a69a" strokeWidth="1"/>
        <path d="M8 15l3-2.5H5z" fill="#ef5350"/>
      </svg>
    ),
  },
  {
    id: "eraser", label: "Eraser — click drawing to delete", group: 5,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M9.5 2.5L13.5 6.5L6.5 13.5L2 13.5L2 9L9.5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="rgba(239,83,80,0.15)"/>
        <path d="M6 13.5L13.5 6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.5"/>
        <line x1="2" y1="13.5" x2="14" y2="13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
  },
] as const;

export function DrawingToolbar({ activeTool, onToolChange, layerHandle }: Props) {
  const [tooltip, setTooltip] = useState<string | null>(null);
  const isLocked  = layerHandle?.isLocked  ?? false;
  const isVisible = layerHandle?.isVisible ?? true;

  const glass: React.CSSProperties = {
    background:          "rgba(11,15,26,0.90)",
    backdropFilter:      "blur(18px) saturate(200%)",
    WebkitBackdropFilter:"blur(18px) saturate(200%)",
    border:              "1px solid rgba(255,255,255,0.075)",
    borderRadius:        10,
    boxShadow:           "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
    padding:             "5px",
    display:             "flex",
    flexDirection:       "column",
    gap:                 2,
  };

  const btn = (active = false, accentColor?: string): React.CSSProperties => ({
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    width:          36,
    height:         36,
    borderRadius:   7,
    border:         "none",
    cursor:         "pointer",
    touchAction:    "manipulation",
    flexShrink:     0,
    transition:     "background 0.13s, color 0.13s, box-shadow 0.13s",
    color:  active
      ? (accentColor ?? "#00E5FF")
      : (accentColor ? `${accentColor}cc` : "rgba(165,170,195,0.8)"),
    background: active
      ? (accentColor ? `${accentColor}22` : "rgba(0,229,255,0.12)")
      : "transparent",
    boxShadow: active
      ? `0 0 0 1.5px ${accentColor ? `${accentColor}55` : "rgba(0,229,255,0.35)"}`
      : "none",
  });

  const sep = <div style={{ height: 1, background: "rgba(255,255,255,0.065)", margin: "3px 0" }} />;

  const toolGroups: (typeof TOOLS[number])[][] = [];
  let lastGroup = -1;
  for (const t of TOOLS) {
    if (t.group !== lastGroup) { toolGroups.push([]); lastGroup = t.group; }
    toolGroups[toolGroups.length - 1].push(t);
  }

  return (
    <div
      style={{ position:"absolute", left:8, top:8, bottom:8, zIndex:50, display:"flex", flexDirection:"column", gap:5, pointerEvents:"all", overflowY:"auto", scrollbarWidth:"none" }}
      onTouchStart={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
    >

      {/* Floating tooltip */}
      {tooltip && (
        <div style={{
          position:"absolute", left:44, top:"50%", transform:"translateY(-50%)",
          background:"rgba(11,15,26,0.97)", border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:6, color:"#D9D9D9", fontSize:11, fontFamily:"system-ui,sans-serif",
          padding:"4px 10px", whiteSpace:"nowrap", boxShadow:"0 4px 20px rgba(0,0,0,0.55)",
          pointerEvents:"none", zIndex:100,
        }}>
          {tooltip}
        </div>
      )}

      {/* Tool groups */}
      <div style={glass}>
        {toolGroups.map((grp, gi) => (
          <div key={gi}>
            {gi > 0 && sep}
            {grp.map(tool => {
              const accent = tool.id === "long" ? "#26a69a" : tool.id === "short" ? "#ef5350" : undefined;
              return (
                <button
                  key={tool.id}
                  style={btn(activeTool === tool.id, accent)}
                  onClick={() => onToolChange(tool.id)}
                  onMouseEnter={() => setTooltip(tool.label)}
                  onMouseLeave={() => setTooltip(null)}
                  title={tool.label}
                >
                  {tool.icon}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Undo / Redo / Delete */}
      <div style={glass}>
        <button style={btn()} title="Undo (Ctrl+Z)"
          onClick={() => layerHandle?.undo()}
          onMouseEnter={() => setTooltip("Undo (Ctrl+Z)")} onMouseLeave={() => setTooltip(null)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 5.5H8a3.5 3.5 0 1 1 0 7H5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M2 5.5l2.5-3M2 5.5l2.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button style={btn()} title="Redo (Ctrl+Y)"
          onClick={() => layerHandle?.redo()}
          onMouseEnter={() => setTooltip("Redo (Ctrl+Y)")} onMouseLeave={() => setTooltip(null)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M12 5.5H6a3.5 3.5 0 1 0 0 7H8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M12 5.5l-2.5-3M12 5.5l-2.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {sep}
        <button style={{ ...btn(), color:"rgba(220,100,100,0.8)" }} title="Delete Selected"
          onClick={() => layerHandle?.deleteSelected()}
          onMouseEnter={() => setTooltip("Delete Selected")} onMouseLeave={() => setTooltip(null)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 4h10M5 4V2.5h4V4M3 4l1 8.5h6L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Lock / Show-Hide / Clear */}
      <div style={glass}>
        <button
          style={btn(isLocked, "#F79009")}
          title={isLocked ? "Unlock Drawings" : "Lock Drawings"}
          onClick={() => layerHandle?.toggleLock()}
          onMouseEnter={() => setTooltip(isLocked ? "Unlock Drawings" : "Lock Drawings")}
          onMouseLeave={() => setTooltip(null)}
        >
          {isLocked ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="6.5" width="10" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M4 6.5V5A3 3 0 0 1 10 5v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="7" cy="9.5" r="1" fill="currentColor"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="6.5" width="10" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M4 6.5V5A3 3 0 0 1 10 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          )}
        </button>

        <button
          style={{ ...btn(), color: isVisible ? "rgba(165,170,195,0.8)" : "rgba(100,100,120,0.55)" }}
          title={isVisible ? "Hide Drawings" : "Show Drawings"}
          onClick={() => layerHandle?.toggleVisibility()}
          onMouseEnter={() => setTooltip(isVisible ? "Hide Drawings" : "Show Drawings")}
          onMouseLeave={() => setTooltip(null)}
        >
          {isVisible ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.4"/>
              <circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.4" opacity="0.35"/>
              <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          )}
        </button>

        {sep}

        <button
          style={{ ...btn(), color:"rgba(200,90,90,0.8)" }}
          title="Clear All Drawings"
          onClick={() => layerHandle?.clear()}
          onMouseEnter={() => setTooltip("Clear All Drawings")}
          onMouseLeave={() => setTooltip(null)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 4h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M4.5 4l.5 8.5h4l.5-8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 2h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="1.5" y1="1.5" x2="12.5" y2="12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.45"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
