import React, { useState } from "react";
import { ChevronDown, ChevronRight, Lock, CheckCircle2, BookOpen, Clock, Target, Play } from "lucide-react";
import type { AcademyCourse } from "./types";
import { PATH_META } from "./types";

const C = { purple: "#a855f7", cyan: "#06b6d4", green: "#22c55e", amber: "#f59e0b", pink: "#ec4899", blue: "#3b82f6" };

const PATH_ORDER = ["beginner", "intermediate", "advanced", "professional"];

function CourseCard({ course, onSelect }: { course: AcademyCourse; onSelect: (c: AcademyCourse) => void }) {
  const pct = course.lessonCount! > 0 ? Math.round(((course.completedLessons ?? 0) / course.lessonCount!) * 100) : 0;
  const completed = pct === 100;
  const meta = PATH_META[course.pathId];

  return (
    <div
      onClick={() => onSelect(course)}
      style={{
        background: "var(--card-bg)", border: "1px solid hsl(var(--border))",
        borderRadius: "12px", padding: "14px 16px", cursor: "pointer",
        transition: "all 0.15s ease", display: "flex", alignItems: "center", gap: "14px",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = meta.color + "50";
        (e.currentTarget as HTMLElement).style.transform = "translateX(3px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))";
        (e.currentTarget as HTMLElement).style.transform = "translateX(0)";
      }}
    >
      <div style={{
        width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "20px", background: `${meta.color}18`, border: `1px solid ${meta.color}30`,
      }}>
        {completed ? <CheckCircle2 style={{ height: "20px", width: "20px", color: C.green }} /> : course.thumbnailEmoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
          {course.title}
          {completed && (
            <span style={{ fontSize: "10px", color: C.green, background: `${C.green}18`, padding: "1px 7px", borderRadius: "10px", fontWeight: 600 }}>
              Complete
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", gap: "3px" }}>
            <BookOpen style={{ height: "10px", width: "10px" }} /> {course.lessonCount} lessons
          </span>
          <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", gap: "3px" }}>
            <Clock style={{ height: "10px", width: "10px" }} /> {course.estimatedMinutes}m
          </span>
          {course.quizScore !== null && course.quizScore !== undefined && (
            <span style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", gap: "3px" }}>
              <Target style={{ height: "10px", width: "10px" }} /> Quiz: {course.quizScore}%
            </span>
          )}
        </div>
        <div style={{ height: "4px", borderRadius: "2px", background: "hsl(var(--muted))", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: "2px", width: `${pct}%`,
            background: completed ? C.green : meta.color, transition: "width 0.5s ease",
          }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
        <span style={{ fontSize: "13px", fontWeight: 700, color: meta.color }}>{pct}%</span>
        <ChevronRight style={{ height: "14px", width: "14px", color: "hsl(var(--muted-foreground))" }} />
      </div>
    </div>
  );
}

function PathSection({
  pathId, courses, isLocked, defaultOpen, onSelectCourse,
}: {
  pathId: string;
  courses: AcademyCourse[];
  isLocked: boolean;
  defaultOpen: boolean;
  onSelectCourse: (c: AcademyCourse) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = PATH_META[pathId];
  const totalLessons = courses.reduce((s, c) => s + (c.lessonCount ?? 0), 0);
  const completedLessons = courses.reduce((s, c) => s + (c.completedLessons ?? 0), 0);
  const pct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const estHours = Math.round(courses.reduce((s, c) => s + c.estimatedMinutes, 0) / 60 * 10) / 10;

  return (
    <div style={{
      border: "1px solid hsl(var(--border))", borderRadius: "16px", overflow: "hidden",
      ...(isLocked ? { opacity: 0.6 } : {}),
    }}>
      <button
        onClick={() => !isLocked && setOpen(o => !o)}
        style={{
          width: "100%", padding: "20px 22px", display: "flex", alignItems: "center", gap: "16px",
          background: open ? `${meta.color}0a` : "var(--card-bg)",
          borderBottom: open ? "1px solid hsl(var(--border))" : "none",
          cursor: isLocked ? "not-allowed" : "pointer", textAlign: "left",
        }}
      >
        <div style={{ fontSize: "28px" }}>{meta.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span style={{ fontSize: "15px", fontWeight: 700, color: "hsl(var(--foreground))" }}>{meta.title}</span>
            {isLocked && (
              <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "hsl(var(--muted-foreground))", background: "hsl(var(--muted))", padding: "2px 8px", borderRadius: "10px" }}>
                <Lock style={{ height: "9px", width: "9px" }} /> Locked
              </span>
            )}
            {pct === 100 && (
              <span style={{ fontSize: "10px", color: C.green, background: `${C.green}18`, padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>
                ✓ Completed
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "10px" }}>
            <span style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>{courses.length} modules</span>
            <span style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>{totalLessons} lessons</span>
            <span style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>{estHours}h estimated</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ flex: 1, height: "5px", borderRadius: "3px", background: "hsl(var(--muted))", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "3px", width: `${pct}%`,
                background: meta.color, transition: "width 0.6s ease",
              }} />
            </div>
            <span style={{ fontSize: "12px", fontWeight: 700, color: meta.color, flexShrink: 0 }}>{pct}%</span>
          </div>
        </div>
        {!isLocked && (
          open
            ? <ChevronDown style={{ height: "16px", width: "16px", color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
            : <ChevronRight style={{ height: "16px", width: "16px", color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
        )}
        {isLocked && <Lock style={{ height: "16px", width: "16px", color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />}
      </button>

      {open && !isLocked && (
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px", background: "var(--card-bg)" }}>
          {courses.map(course => (
            <CourseCard key={course.id} course={course} onSelect={onSelectCourse} />
          ))}
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
  const byCourse = new Map<string, AcademyCourse[]>();
  for (const c of courses) {
    if (!byCourse.has(c.pathId)) byCourse.set(c.pathId, []);
    byCourse.get(c.pathId)!.push(c);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <p style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))", margin: 0 }}>
        Follow structured learning paths from Beginner to Professional. Complete each path to earn certificates and unlock the next level.
      </p>
      {PATH_ORDER.map((pathId, i) => (
        <PathSection
          key={pathId}
          pathId={pathId}
          courses={byCourse.get(pathId) ?? []}
          isLocked={false}
          defaultOpen={i === 0}
          onSelectCourse={onSelectCourse}
        />
      ))}
    </div>
  );
}
