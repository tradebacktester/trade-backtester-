import React, { useState, useMemo } from "react";
import { Search, BookOpen, Clock, Filter, X } from "lucide-react";
import type { AcademyCourse } from "./types";
import { PATH_META } from "./types";

const C = { purple: "#a855f7", cyan: "#06b6d4", green: "#22c55e", amber: "#f59e0b" };

const DIFFICULTIES = ["beginner", "intermediate", "advanced", "professional"];
const DIFF_COLORS: Record<string, string> = {
  beginner: C.green, intermediate: C.cyan, advanced: C.purple, professional: C.amber,
};

function CourseCard({ course, onSelect }: { course: AcademyCourse; onSelect: (c: AcademyCourse) => void }) {
  const meta = PATH_META[course.pathId];
  const pct = course.lessonCount! > 0 ? Math.round(((course.completedLessons ?? 0) / course.lessonCount!) * 100) : 0;
  const diffColor = DIFF_COLORS[course.difficulty] ?? C.purple;

  return (
    <div
      onClick={() => onSelect(course)}
      style={{
        background: "var(--card-bg)", border: "1px solid hsl(var(--border))",
        borderRadius: "14px", padding: "18px", cursor: "pointer",
        transition: "all 0.15s ease", display: "flex", flexDirection: "column", gap: "12px",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = diffColor + "50";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${diffColor}15`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div style={{
          width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px", background: `${diffColor}18`, border: `1px solid ${diffColor}30`,
        }}>
          {course.thumbnailEmoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: "4px", lineHeight: "1.3" }}>
            {course.title}
          </div>
          <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", lineHeight: "1.4" }}>
            {course.description.length > 80 ? course.description.slice(0, 80) + "..." : course.description}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
        <span style={{
          fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "10px",
          background: `${diffColor}18`, color: diffColor, border: `1px solid ${diffColor}30`,
        }}>
          {course.difficulty.charAt(0).toUpperCase() + course.difficulty.slice(1)}
        </span>
        <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", padding: "2px 8px", borderRadius: "10px", background: "hsl(var(--muted))" }}>
          {course.category}
        </span>
        <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", gap: "3px" }}>
          <Clock style={{ height: "9px", width: "9px" }} />{course.estimatedMinutes}m
        </span>
        <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", gap: "3px" }}>
          <BookOpen style={{ height: "9px", width: "9px" }} />{course.lessonCount} lessons
        </span>
      </div>

      {pct > 0 && (
        <div>
          <div style={{ height: "3px", borderRadius: "2px", background: "hsl(var(--muted))", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: "2px", width: `${pct}%`,
              background: pct === 100 ? C.green : meta.color,
            }} />
          </div>
          <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "4px" }}>
            {pct === 100 ? "✓ Complete" : `${pct}% complete`}
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
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const categories = useMemo(() => {
    const s = new Set(courses.map(c => c.category));
    return [...s].sort();
  }, [courses]);

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
    if (selectedPath) result = result.filter(c => c.pathId === selectedPath);
    return result;
  }, [courses, query, selectedDiff, selectedPath]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Search */}
      <div style={{ position: "relative" }}>
        <Search style={{
          position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
          height: "14px", width: "14px", color: "hsl(var(--muted-foreground))",
        }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search topics — RSI, Order Block, MACD, Liquidity..."
          style={{
            width: "100%", padding: "11px 14px 11px 38px", borderRadius: "12px",
            background: "var(--card-bg)", border: "1px solid hsl(var(--border))",
            color: "hsl(var(--foreground))", fontSize: "13px", outline: "none", boxSizing: "border-box",
          }}
        />
        {query && (
          <button onClick={() => setQuery("")} style={{
            position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))",
            display: "flex", padding: "2px",
          }}>
            <X style={{ height: "13px", width: "13px" }} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
        <Filter style={{ height: "12px", width: "12px", color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
        {DIFFICULTIES.map(d => {
          const active = selectedDiff === d;
          const col = DIFF_COLORS[d];
          return (
            <button
              key={d}
              onClick={() => setSelectedDiff(active ? null : d)}
              style={{
                padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                cursor: "pointer", border: `1px solid ${active ? col : "hsl(var(--border))"}`,
                background: active ? `${col}18` : "var(--card-bg)",
                color: active ? col : "hsl(var(--muted-foreground))",
                transition: "all 0.12s ease",
              }}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          );
        })}
        {(selectedDiff || selectedPath || query) && (
          <button
            onClick={() => { setSelectedDiff(null); setSelectedPath(null); setQuery(""); }}
            style={{
              padding: "3px 10px", borderRadius: "20px", fontSize: "11px",
              cursor: "pointer", border: "1px solid hsl(var(--border))",
              background: "none", color: "hsl(var(--muted-foreground))",
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Results count */}
      <div style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>
        {filtered.length} topic{filtered.length !== 1 ? "s" : ""} found
      </div>

      {/* Course grid */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          color: "hsl(var(--muted-foreground))", fontSize: "14px",
        }}>
          <Search style={{ height: "36px", width: "36px", margin: "0 auto 12px", opacity: 0.3 }} />
          <div>No topics found for "{query}"</div>
          <div style={{ fontSize: "12px", marginTop: "6px" }}>Try a different keyword like "RSI", "candle", or "trend"</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {filtered.map(c => (
            <CourseCard key={c.id} course={c} onSelect={onSelectCourse} />
          ))}
        </div>
      )}
    </div>
  );
}
