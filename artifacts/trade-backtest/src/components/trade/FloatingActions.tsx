import { Bell, Play, Pause, Save } from "lucide-react";
import { T } from "./styles";

interface FloatingActionsProps {
  onAlertClick: () => void;
  onSaveClick: () => void;
  onPlayPause: () => void;
  hasActiveAlerts: boolean;
  replayMode: boolean;
  isPlaying: boolean;
  onEnterReplay: () => void;
}

const GLASS: React.CSSProperties = {
  width: 36, height: 36, borderRadius: "50%",
  background: "rgba(28,28,30,0.85)",
  border: "1px solid rgba(255,255,255,0.10)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", position: "relative", flexShrink: 0,
};

export function FloatingActions({
  onAlertClick, onSaveClick, onPlayPause,
  hasActiveAlerts, replayMode, isPlaying, onEnterReplay,
}: FloatingActionsProps) {
  return (
    <div style={{
      position: "absolute", top: 12, right: 12, zIndex: 40,
      display: "flex", gap: 8,
    }}>
      {/* Alert */}
      <button style={{ ...GLASS }} onClick={onAlertClick} title="Price Alerts">
        <Bell size={16} color={hasActiveAlerts ? T.amber : T.sub} />
        {hasActiveAlerts && (
          <span style={{
            position: "absolute", top: 4, right: 4,
            width: 7, height: 7, borderRadius: "50%",
            background: T.red, border: "1px solid #000",
          }} />
        )}
      </button>

      {/* Replay / Play-Pause */}
      <button
        style={{ ...GLASS, background: replayMode ? "rgba(245,158,11,0.18)" : GLASS.background }}
        onClick={replayMode ? onPlayPause : onEnterReplay}
        title={replayMode ? (isPlaying ? "Pause replay" : "Play replay") : "Enter Replay Mode"}
      >
        {replayMode && isPlaying
          ? <Pause size={16} color="#FF9F0A" />
          : replayMode
            ? <Play size={16} color="#FF9F0A" style={{ marginLeft: 1 }} />
            : <Play size={16} color={T.sub} style={{ marginLeft: 1 }} />
        }
      </button>

      {/* Save layout */}
      <button style={{ ...GLASS }} onClick={onSaveClick} title="Save Layout">
        <Save size={16} color={T.sub} />
      </button>
    </div>
  );
}
