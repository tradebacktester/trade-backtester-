import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronDown, ChevronRight, Lock, CheckCircle2, Circle,
  PlayCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";
import type { AcademyCourse, LearningPath } from "./types";
import { PATH_META, PATH_ICONS } from "./types";

const ACCENT = "#22D3EE";
const SUCCESS = "#84CC16";
const BORDER = "#262626";
const CARD = "#171717";
const TEXT = "#A1A1AA";

const PATH_ORDER = ["beginner", "intermediate", "advanced", "professional"];

function CourseRow({ course, onSelect }: { course: AcademyCourse; onSelect: (c: AcademyCourse) => void }) {
  const total = course.lessonCount ?? 0;
  const done = course.completedLessons ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const completed = pct === 100;

  return (
    <div
      onClick={() => onSelect(course)}
      style={{
        display: "flex", alignItems: "center", gap: "14px",
        padding: "11px 14px", borderRadius: "8px",
        border: `1px solid ${BORDER}`, cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
        background: "transparent",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "#3a3a3a";
        (e.currentTarget as HTMLElement).style.background = "#111111";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = BORDER;
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <div style={{ flexShrink: 0 }}>
        {completed
          ? <CheckCircle2 style={{ height: "15px", width: "15px", color: SUCCESS }} />
          : <Circle style={{ height: "15px", width: "15px", color: BORDER }} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {course.title}
        </div>
        <div style={{ fontSize: "11px", color: TEXT, marginTop: "1px" }}>
          {done}/{total} lessons · {course.estimatedMinutes}m
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        {pct > 0 && pct < 100 && (
          <div style={{ width: "48px", height: "2px", borderRadius: "1px", background: "#262626", overflow: "hidden" }}>
            <div style={{ height: "100%", background: ACCENT, width: `${pct}%`, borderRadius: "1px" }} />
          </div>
        )}
        <span style={{ fontSize: "11px", color: TEXT, minWidth: "26px", textAlign: "right" }}>
          {pct > 0 ? `${pct}%` : ""}
        </span>
        <PlayCircle style={{ height: "13px", width: "13px", color: TEXT }} />
      </div>
    </div>
  );
}

function PathSection({
  path,
  expanded,
  onToggle,
  onSelectCourse,
}: {
  path: LearningPath;
  expanded: boolean;
  onToggle: () => void;
  onSelectCourse: (c: AcademyCourse) => void;
}) {
  const meta = PATH_META[path.id] ?? { title: path.id, description: "", color: TEXT };
  const Icon = PATH_ICONS[path.id];
  const pct = path.totalLessons > 0 ? Math.round((path.completedLessons / path.totalLessons) * 100) : 0;
  const done = pct === 100;

  return (
    <div style={{ borderRadius: "10px", border: `1px solid ${BORDER}`, overflow: "hidden" }}>
      <button
        onClick={path.locked ? undefined : onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "14px",
          padding: "16px 20px", cursor: path.locked ? "default" : "pointer",
          background: CARD, border: "none", transition: "background 0.15s", textAlign: "left",
        }}
        onMouseEnter={e => { if (!path.locked) (e.currentTarget as HTMLElement).style.background = "#1a1a1a"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = CARD; }}
      >
        <div style={{
          width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0,
          background: "#111111", border: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {path.locked
            ? <Lock style={{ height: "14px", width: "14px", color: TEXT }} />
            : Icon && <Icon style={{ height: "14px", width: "14px", color: meta.color }} />
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: path.locked ? TEXT : "#FFFFFF" }}>
              {meta.title}
            </span>
            {done && (
              <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "4px", background: "#111111", border: `1px solid ${SUCCESS}`, color: SUCCESS, fontWeight: 600 }}>
                Complete
              </span>
            )}
            {path.locked && (
              <span style={{ fontSize: "10px", color: TEXT }}>Locked</span>
            )}
          </div>
          <div style={{ fontSize: "11px", color: TEXT, marginBottom: path.locked ? 0 : "8px" }}>{meta.description}</div>
          {!path.locked && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ flex: 1, height: "2px", borderRadius: "1px", background: "#262626", overflow: "hidden", maxWidth: "120px" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: done ? SUCCESS : ACCENT, borderRadius: "1px", transition: "width 0.6s" }} />
              </div>
              <span style={{ fontSize: "11px", color: TEXT }}>
                {path.completedLessons}/{path.totalLessons} · {path.estimatedHours}h
              </span>
            </div>
          )}
        </div>

        {!path.locked && (
          expanded
            ? <ChevronDown style={{ height: "15px", width: "15px", color: TEXT, flexShrink: 0 }} />
            : <ChevronRight style={{ height: "15px", width: "15px", color: TEXT, flexShrink: 0 }} />
        )}
        {path.locked && <Lock style={{ height: "14px", width: "14px", color: TEXT, flexShrink: 0 }} />}
      </button>

      {expanded && !path.locked && (
        <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: "6px", background: "#0f0f0f", borderTop: `1px solid ${BORDER}`, paddingTop: "14px" }}>
          {path.courses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: TEXT, fontSize: "13px" }}>No courses yet</div>
          ) : (
            path.courses.map(c => <CourseRow key={c.id} course={c} onSelect={onSelectCourse} />)
          )}
        </div>
      )}
    </div>
  );
}

export function PathsTab({
  courses,
  onSelectCourse,
}: {
  courses: AcademyCourse[];
  onSelectCourse: (c: AcademyCourse) => void;
}) {
  const { token } = useAuth();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ beginner: true });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/academy/paths`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setPaths(await r.json());
    } catch { }
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ height: "72px", borderRadius: "10px", background: CARD, border: `1px solid ${BORDER}`, opacity: 0.5 }} />
        ))}
      </div>
    );
  }

  const sorted = [...paths].sort((a, b) => PATH_ORDER.indexOf(a.id) - PATH_ORDER.indexOf(b.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {sorted.map(path => (
        <PathSection
          key={path.id}
          path={path}
          expanded={!!expanded[path.id]}
          onToggle={() => setExpanded(prev => ({ ...prev, [path.id]: !prev[path.id] }))}
          onSelectCourse={onSelectCourse}
        />
      ))}
    </div>
  );
}
