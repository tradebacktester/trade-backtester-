// Compact drawing toolbar — floats on the left edge of the chart container
import type { ReactNode } from "react";
import type { DrawingLayerHandle } from "./drawing-layer";

interface Props {
  activeTool: string;
  onToolChange: (tool: string) => void;
  layerHandle: DrawingLayerHandle | null;
}

const TOOLS = [
  { name: "cursor",    label: "Cursor (V)",           svg: <svg viewBox="0 0 20 20" fill="none"><path d="M5 2.5L15.5 9.5L10.5 10.5L8 16L5 2.5Z" fill="currentColor"/></svg> },
  { name: "trendline", label: "Trend Line (T)",        svg: <svg viewBox="0 0 20 20" fill="none"><line x1="3" y1="16" x2="17" y2="4" stroke="currentColor" strokeWidth="1.5"/><circle cx="3" cy="16" r="2" fill="currentColor"/><circle cx="17" cy="4" r="2" fill="currentColor"/></svg> },
  { name: "ray",       label: "Ray",                   svg: <svg viewBox="0 0 20 20" fill="none"><line x1="3" y1="16" x2="17" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1 2"/><circle cx="3" cy="16" r="2" fill="currentColor"/></svg> },
  { name: "hline",     label: "Horizontal Line (H)",   svg: <svg viewBox="0 0 20 20" fill="none"><line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.5"/><circle cx="2" cy="10" r="1.8" fill="currentColor"/><circle cx="18" cy="10" r="1.8" fill="currentColor"/></svg> },
  { name: "vline",     label: "Vertical Line",         svg: <svg viewBox="0 0 20 20" fill="none"><line x1="10" y1="2" x2="10" y2="18" stroke="currentColor" strokeWidth="1.5"/><circle cx="10" cy="2" r="1.8" fill="currentColor"/><circle cx="10" cy="18" r="1.8" fill="currentColor"/></svg> },
  { name: "rect",      label: "Rectangle (R)",         svg: <svg viewBox="0 0 20 20" fill="none"><rect x="3" y="5" width="14" height="10" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { name: "text",      label: "Text",                  svg: <svg viewBox="0 0 20 20" fill="none"><text x="10" y="15" textAnchor="middle" fontSize="15" fontWeight="bold" fill="currentColor" fontFamily="Georgia,serif">T</text></svg> },
  { name: "fib",       label: "Fibonacci (F)",         svg: <svg viewBox="0 0 20 20" fill="none"><line x1="2" y1="4" x2="18" y2="4" stroke="currentColor" strokeWidth="1"/><line x1="2" y1="8" x2="18" y2="8" stroke="#26a69a" strokeWidth="1"/><line x1="2" y1="11" x2="18" y2="11" stroke="#2962ff" strokeWidth="1"/><line x1="2" y1="14" x2="18" y2="14" stroke="#ff9800" strokeWidth="1"/><line x1="2" y1="17" x2="18" y2="17" stroke="currentColor" strokeWidth="1"/><line x1="4" y1="2" x2="4" y2="19" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { name: "pitchfork", label: "Pitchfork",             svg: <svg viewBox="0 0 20 20" fill="none"><path d="M4 16 L10 4 L16 16" stroke="currentColor" strokeWidth="1.5" fill="none"/><line x1="4" y1="16" x2="2" y2="19" stroke="currentColor" strokeWidth="1.5"/><line x1="16" y1="16" x2="18" y2="19" stroke="currentColor" strokeWidth="1.5"/></svg> },
];

const GROUPS = [
  [TOOLS[0]],
  TOOLS.slice(1, 5),
  TOOLS.slice(5, 7),
  TOOLS.slice(7),
];

export function DrawingToolbar({ activeTool, onToolChange, layerHandle }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 36,
        background: "rgba(19,23,34,0.92)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "6px 0",
        zIndex: 20,
        backdropFilter: "blur(6px)",
        gap: 0,
      }}
    >
      {GROUPS.map((group, gi) => (
        <div key={gi} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          {gi > 0 && (
            <div style={{ width: 24, height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
          )}
          {group.map(tool => (
            <ToolBtn
              key={tool.name}
              tool={tool}
              active={activeTool === tool.name}
              onClick={() => onToolChange(tool.name)}
            />
          ))}
        </div>
      ))}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Undo / Redo / Clear */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, paddingBottom: 4 }}>
        <div style={{ width: 24, height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 4 }} />
        <IconBtn title="Undo (Ctrl+Z)" onClick={() => layerHandle?.undo()}>
          <svg viewBox="0 0 20 20" fill="none"><path d="M4 9H13a4 4 0 010 8H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M7 6L4 9l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </IconBtn>
        <IconBtn title="Redo (Ctrl+Y)" onClick={() => layerHandle?.redo()}>
          <svg viewBox="0 0 20 20" fill="none"><path d="M16 9H7a4 4 0 000 8h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M13 6l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </IconBtn>
        <IconBtn title="Clear all drawings" onClick={() => layerHandle?.clear()}>
          <svg viewBox="0 0 20 20" fill="none"><rect x="6" y="5" width="8" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/><line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="8" y1="3" x2="12" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </IconBtn>
      </div>
    </div>
  );
}

function ToolBtn({ tool, active, onClick }: { tool: typeof TOOLS[0]; active: boolean; onClick: () => void }) {
  return (
    <button
      title={tool.label}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        margin: "1px 0",
        background: active ? "rgba(41,98,255,0.18)" : "transparent",
        border: active ? "1px solid rgba(41,98,255,0.35)" : "1px solid transparent",
        color: active ? "#2962FF" : "#787B86",
        cursor: "pointer",
        transition: "background 120ms, color 120ms, border-color 120ms",
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "#D9D9D9"; } }}
      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#787B86"; } }}
    >
      <span style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {tool.svg}
      </span>
    </button>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 4, background: "transparent", border: "1px solid transparent",
        color: "#505570", cursor: "pointer", transition: "color 120ms, background 120ms",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "#D9D9D9"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#505570"; }}
    >
      <span style={{ width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</span>
    </button>
  );
}
