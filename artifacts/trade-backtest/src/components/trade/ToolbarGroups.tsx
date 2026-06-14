import { useState, useRef, useEffect } from "react";
import {
  BarChart2, TrendingUp, Layers, Bell, Play, Save, BookOpen,
  List, SplitSquareVertical, ArrowLeftRight, Moon, Sun, Keyboard, X,
  RefreshCw, Clapperboard,
} from "lucide-react";
import { T, SPRING } from "./styles";

type Group = "analysis" | "trading" | "layout" | null;

interface ToolbarGroupsProps {
  indicators: { id: string; enabled: boolean }[];
  showIndicators: boolean;
  onToggleIndicators: () => void;
  showMultiTf: boolean;
  onToggleMultiTf: () => void;
  showVPVR: boolean;
  onToggleVPVR: () => void;
  showComparePanel: boolean;
  onToggleCompare: () => void;
  showOrderPanel: boolean;
  onToggleOrderPanel: () => void;
  showAlertPanel: boolean;
  onToggleAlertPanel: () => void;
  replayMode: boolean;
  onEnterReplay: () => void;
  onExitReplay: () => void;
  showWatchlist: boolean;
  onToggleWatchlist: () => void;
  showSaveLayout: boolean;
  onToggleSaveLayout: () => void;
  showLoadLayout: boolean;
  onToggleLoadLayout: () => void;
  savedLayouts: { id: string }[];
  chartTheme: "dark" | "light";
  onThemeToggle: () => void;
  showShortcuts: boolean;
  onToggleShortcuts: () => void;
  onRefresh: () => void;
  isFetching: boolean;
  klines: unknown[] | null | undefined;
  isSim: boolean;
}

const PILL: React.CSSProperties = {
  height: 32, padding: "0 12px",
  borderRadius: 16,
  display: "flex", alignItems: "center", gap: 5,
  background: T.card, border: `1px solid ${T.border}`,
  cursor: "pointer", fontSize: 12,
  fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500,
  color: T.sub, whiteSpace: "nowrap",
  transition: `all 0.18s ease`,
};

const TOOL_BTN: React.CSSProperties = {
  height: 36, padding: "0 12px",
  borderRadius: 8,
  display: "flex", alignItems: "center", gap: 6,
  background: "transparent", border: "1px solid transparent",
  cursor: "pointer", fontSize: 12,
  fontFamily: "'Space Grotesk', sans-serif",
  color: T.sub, whiteSpace: "nowrap",
  transition: `all 0.15s ease`,
};

interface Tool {
  id: string;
  label: string;
  icon: React.ElementType;
  active?: boolean;
  badge?: number;
  onClick: () => void;
}

export function ToolbarGroups({
  indicators, showIndicators, onToggleIndicators,
  showMultiTf, onToggleMultiTf,
  showVPVR, onToggleVPVR,
  showComparePanel, onToggleCompare,
  showOrderPanel, onToggleOrderPanel,
  showAlertPanel, onToggleAlertPanel,
  replayMode, onEnterReplay, onExitReplay,
  showWatchlist, onToggleWatchlist,
  showSaveLayout, onToggleSaveLayout,
  showLoadLayout, onToggleLoadLayout,
  savedLayouts,
  chartTheme, onThemeToggle,
  showShortcuts, onToggleShortcuts,
  onRefresh, isFetching, klines, isSim,
}: ToolbarGroupsProps) {
  const [activeGroup, setActiveGroup] = useState<Group>(null);
  const ref = useRef<HTMLDivElement>(null);
  const activeIndicators = indicators.filter(i => i.enabled).length;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setActiveGroup(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggle(g: Exclude<Group, null>) {
    setActiveGroup(prev => prev === g ? null : g);
  }

  const GROUPS: { id: Exclude<Group, null>; label: string; tools: Tool[] }[] = [
    {
      id: "analysis", label: "Analysis",
      tools: [
        { id: "ind",     label: "Indicators",  icon: BarChart2,           active: showIndicators,   badge: activeIndicators || undefined, onClick: () => { onToggleIndicators(); setActiveGroup(null); } },
        { id: "multitf", label: "Multi-TF",    icon: SplitSquareVertical, active: showMultiTf,      onClick: () => { onToggleMultiTf();   setActiveGroup(null); } },
        { id: "vpvr",    label: "VPVR",         icon: Layers,              active: showVPVR,          onClick: () => { onToggleVPVR();      setActiveGroup(null); } },
        { id: "cmp",     label: "Compare",      icon: ArrowLeftRight,      active: showComparePanel,  onClick: () => { onToggleCompare();   setActiveGroup(null); } },
        { id: "wl",      label: "Watchlist",    icon: List,                active: showWatchlist,     onClick: () => { onToggleWatchlist(); setActiveGroup(null); } },
      ],
    },
    {
      id: "trading", label: "Trading",
      tools: [
        { id: "order",  label: "Order Panel", icon: TrendingUp,  active: showOrderPanel,  onClick: () => { onToggleOrderPanel();  setActiveGroup(null); } },
        { id: "alert",  label: "Alerts",       icon: Bell,        active: showAlertPanel,  onClick: () => { onToggleAlertPanel(); setActiveGroup(null); } },
        { id: "replay", label: replayMode ? "Exit Replay" : "Replay", icon: replayMode ? X : Clapperboard,
          onClick: () => { replayMode ? onExitReplay() : onEnterReplay(); setActiveGroup(null); } },
        ...(!replayMode && !isSim ? [{ id: "refresh", label: "Refresh", icon: RefreshCw, onClick: () => { onRefresh(); setActiveGroup(null); } }] : []),
      ] as Tool[],
    },
    {
      id: "layout", label: "Layout",
      tools: [
        { id: "save",      label: "Save Layout",  icon: Save,     active: showSaveLayout, onClick: () => { onToggleSaveLayout(); setActiveGroup(null); } },
        ...(savedLayouts.length > 0 ? [{ id: "load", label: `Layouts (${savedLayouts.length})`, icon: BookOpen, active: showLoadLayout, onClick: () => { onToggleLoadLayout(); setActiveGroup(null); } }] : []),
        { id: "theme",     label: chartTheme === "dark" ? "Light Mode" : "Dark Mode", icon: chartTheme === "dark" ? Sun : Moon, onClick: () => { onThemeToggle(); setActiveGroup(null); } },
        { id: "shortcuts", label: "Shortcuts",    icon: Keyboard, active: showShortcuts,  onClick: () => { onToggleShortcuts(); setActiveGroup(null); } },
      ] as Tool[],
    },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: "absolute", top: 8, left: 8, zIndex: 50,
        display: "flex", flexDirection: "column", gap: 6,
      }}
    >
      {/* Group pills */}
      <div style={{ display: "flex", gap: 6 }}>
        {GROUPS.map(g => {
          const isOpen = activeGroup === g.id;
          return (
            <button
              key={g.id}
              onClick={() => toggle(g.id)}
              style={{
                ...PILL,
                background: isOpen ? "rgba(0,122,255,0.15)" : T.card,
                borderColor: isOpen ? "rgba(0,122,255,0.4)" : T.border,
                color: isOpen ? T.blue : T.sub,
              }}
            >
              {g.label}
              <span style={{
                fontSize: 9, transition: `transform 0.2s ${SPRING}`,
                display: "inline-block",
                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}>▼</span>
            </button>
          );
        })}
      </div>

      {/* Expanded tool row */}
      {activeGroup && (
        <div style={{
          display: "flex", gap: 2,
          background: "rgba(10,10,11,0.90)",
          border: `1px solid ${T.border}`,
          borderRadius: 10, padding: 4,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          animation: `dropdownFade 0.15s ease`,
        }}>
          {GROUPS.find(g => g.id === activeGroup)?.tools.map(tool => (
            <button
              key={tool.id}
              onClick={tool.onClick}
              style={{
                ...TOOL_BTN,
                background: tool.active ? "rgba(0,122,255,0.12)" : "transparent",
                borderColor: tool.active ? "rgba(0,122,255,0.3)" : "transparent",
                color: tool.active ? T.blue : T.sub,
              }}
            >
              <tool.icon size={14} />
              {tool.label}
              {tool.badge ? (
                <span style={{
                  background: "rgba(0,122,255,0.25)", color: T.blue,
                  fontSize: 9, fontWeight: 700,
                  padding: "1px 4px", borderRadius: 6, minWidth: 14, textAlign: "center",
                }}>{tool.badge}</span>
              ) : null}
              {tool.id === "refresh" && isFetching && <RefreshCw size={10} style={{ animation: "spin 1s linear infinite" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
