import React, { useState, useMemo } from "react";
import { Search, BookOpen, Clock, Filter, X, CheckCircle2 } from "lucide-react";
import type { AcademyCourse } from "./types";
import { PATH_META } from "./types";

const ACCENT = "#22D3EE";
const SUCCESS = "#84CC16";
const BORDER = "#262626";
const CARD = "#171717";
const TEXT = "#A1A1AA";

const DIFFICULTIES = ["beginner", "intermediate", "advanced", "professional"];
const DIFF_COLORS: Record<string, string> = {
  beginner: SUCCESS,
  intermediate: ACCENT,
  advanced: "#A78BFA",
  professional: "#F59E0B",
};

function CourseCard({ course, onSelect }: { course: AcademyCourse; onSelect: (c: AcademyCourse) => void }) {
  const pct = (course.lessonCount ?? 0) > 0
    ? Math.round(((course.completedLessons ?? 0) / course.lessonCount!) * 100)
    : 0;
  const diffColor = DIFF_COLORS[course.difficulty] ?? TEXT;

  return (
    <div
      onClick={() => onSelect(course)}
      style={{
        background: CARD, border: `1px solid ${BORDER}`,
        borderRadius: "10px", padding: "16px", cursor: "pointer",
        transition: "border-color 0.15s", display: "flex", flexDirection: "column", gap: "12px",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#3a3a3a"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF", marginBottom: "5px", lineHeight: "1.3" }}>
          {course.title}
        </div>
        <div style={{ fontSize: "11px", color: TEXT, lineHeight: "1.5" }}>
          {course.description.length > 90 ? course.description.slice(0, 90) + "…" : course.description}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
        <span style={{
          fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px",
          background: "#111111", color: diffColor, border: `1px solid ${BORDER}`,
        }}>
          {course.difficulty.charAt(0).toUpperCase() + course.difficulty.slice(1)}
        </span>
        <span style={{ fontSize: "10px", color: TEXT, padding: "2px 8px", borderRadius: "4px", background: "#111111", border: `1px solid ${BORDER}` }}>
          {course.category}
        </span>
        <span style={{ fontSize: "10px", color: TEXT, display: "flex", alignItems: "center", gap: "3px" }}>
          <Clock style={{ height: "9px", width: "9px" }} />{course.estimatedMinutes}m
        </span>
        <span style={{ fontSize: "10px", color: TEXT, display: "flex", alignItems: "center", gap: "3px" }}>
          <BookOpen style={{ height: "9px", width: "9px" }} />{course.lessonCount}
        </span>
      </div>

      {pct > 0 && (
        <div>
          <div style={{ height: "2px", borderRadius: "1px", background: "#262626", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: "1px", width: `${pct}%`,
              background: pct === 100 ? SUCCESS : ACCENT, transition: "width 0.4s",
            }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "10px", color: pct === 100 ? SUCCESS : TEXT, marginTop: "5px" }}>
            {pct === 100 && <CheckCircle2 style={{ height: "10px", width: "10px" }} />}
            {pct === 100 ? "Complete" : `${pct}%`}
          </div>
        </div>
      )}
    </div>
  );
}

export function LibraryTab({
  courses,
  onSelectCourse,
}: {
  courses: AcademyCourse[];
  onSelectCourse: (c: AcademyCourse) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = courses;
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    }
    if (selectedDiff) result = result.filter(c => c.difficulty === selectedDiff);
    return result;
  }, [courses, query, selectedDiff]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Search */}
      <div style={{ position: "relative" }}>
        <Search style={{
          position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)",
          height: "13px", width: "13px", color: TEXT, pointerEvents: "none",
        }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search — RSI, Order Block, MACD, Liquidity…"
          style={{
            width: "100%", padding: "10px 36px 10px 36px", borderRadius: "8px",
            background: CARD, border: `1px solid ${BORDER}`,
            color: "#FFFFFF", fontSize: "13px", outline: "none", boxSizing: "border-box",
          }}
        />
        {query && (
          <button onClick={() => setQuery("")} style={{
            position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: TEXT,
            display: "flex", padding: "2px",
          }}>
            <X style={{ height: "12px", width: "12px" }} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
        <Filter style={{ height: "11px", width: "11px", color: TEXT, flexShrink: 0 }} />
        {DIFFICULTIES.map(d => {
          const active = selectedDiff === d;
          return (
            <button
              key={d}
              onClick={() => setSelectedDiff(active ? null : d)}
              style={{
                padding: "4px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 500,
                cursor: "pointer",
                border: `1px solid ${active ? DIFF_COLORS[d] + "60" : BORDER}`,
                background: active ? "#111111" : "transparent",
                color: active ? DIFF_COLORS[d] : TEXT,
                transition: "all 0.12s",
              }}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          );
        })}
        {(selectedDiff || query) && (
          <button
            onClick={() => { setSelectedDiff(null); setQuery(""); }}
            style={{
              padding: "4px 10px", borderRadius: "6px", fontSize: "11px",
              cursor: "pointer", border: `1px solid ${BORDER}`,
              background: "transparent", color: TEXT,
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Count */}
      <div style={{ fontSize: "11px", color: TEXT }}>
        {filtered.length} module{filtered.length !== 1 ? "s" : ""}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: TEXT }}>
          <Search style={{ height: "28px", width: "28px", margin: "0 auto 10px", opacity: 0.3 }} />
          <div style={{ fontSize: "13px" }}>No results for "{query}"</div>
          <div style={{ fontSize: "11px", marginTop: "4px", opacity: 0.7 }}>Try "RSI", "candle", or "trend"</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
          {filtered.map(c => <CourseCard key={c.id} course={c} onSelect={onSelectCourse} />)}
        </div>
      )}
    </div>
  );
}
