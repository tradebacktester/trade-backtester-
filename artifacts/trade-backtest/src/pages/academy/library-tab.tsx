import React, { useState, useMemo } from "react";
import { Search, BookOpen, Clock, Filter, X, CheckCircle2, Wand2, Loader2, ChevronDown } from "lucide-react";
import type { AcademyCourse } from "./types";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

const ACCENT = "#22D3EE";
const SUCCESS = "#84CC16";
const BORDER = "#262626";
const CARD = "#171717";
const TEXT = "#A1A1AA";
const PURPLE = "#a855f7";

const DIFFICULTIES = ["beginner", "intermediate", "advanced", "professional"];
const DIFF_COLORS: Record<string, string> = {
  beginner: SUCCESS,
  intermediate: ACCENT,
  advanced: "#A78BFA",
  professional: "#F59E0B",
};
const DIFF_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  professional: "Professional",
};

/* ── Course card ──────────────────────────────────────────────────── */
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
          {course.thumbnailEmoji && <span style={{ marginRight: "6px" }}>{course.thumbnailEmoji}</span>}
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

/* ── Request Topic Modal ──────────────────────────────────────────── */
function RequestTopicModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (course: AcademyCourse) => void;
}) {
  const { token } = useAuth();
  const [topicName, setTopicName] = useState("");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<AcademyCourse | null>(null);

  async function handleGenerate() {
    if (!topicName.trim()) { setError("Please enter a topic name."); return; }
    setGenerating(true); setError(null);
    try {
      const r = await fetch(`${API_BASE}/api/academy/request-topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topicName: topicName.trim(), difficulty }),
      });
      const data = await r.json();
      if (r.ok) {
        const course = data as AcademyCourse;
        setSuccess(course);
        onCreated(course);
      } else {
        setError((data as { error?: string }).error ?? "Failed to generate topic. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setGenerating(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: "20px",
    }}>
      <div style={{
        background: "#111111", borderRadius: "16px", padding: "28px",
        width: "100%", maxWidth: "480px", border: `1px solid ${BORDER}`,
        display: "flex", flexDirection: "column", gap: "18px",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "34px", height: "34px", borderRadius: "8px",
            background: `${PURPLE}18`, border: `1px solid ${PURPLE}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Wand2 style={{ height: "16px", width: "16px", color: PURPLE }} />
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>Request a Topic</div>
            <div style={{ fontSize: "11px", color: TEXT }}>AI will generate a full lesson for you</div>
          </div>
          <button
            onClick={onClose}
            style={{ marginLeft: "auto", padding: "6px", borderRadius: "6px", background: "none", border: "none", cursor: "pointer", color: TEXT, display: "flex" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#FFFFFF")}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT)}
          >
            <X style={{ height: "16px", width: "16px" }} />
          </button>
        </div>

        {/* Description */}
        <div style={{
          padding: "12px 14px", borderRadius: "9px", fontSize: "12px",
          background: `${PURPLE}10`, border: `1px solid ${PURPLE}25`,
          color: TEXT, lineHeight: "1.6",
        }}>
          Type any trading topic and AI will generate <strong style={{ color: "#FFFFFF" }}>a complete lesson with 2 in-depth articles</strong> using the same format as existing content.
        </div>

        {success ? (
          /* Success state */
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", alignItems: "center", textAlign: "center", padding: "8px 0" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              background: `${SUCCESS}18`, border: `1px solid ${SUCCESS}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "24px",
            }}>
              {success.thumbnailEmoji ?? "✅"}
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>Topic Created!</div>
              <div style={{ fontSize: "12px", color: TEXT }}>{success.title} has been added to the Library.</div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={onClose}
                style={{
                  padding: "8px 20px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                  cursor: "pointer", background: "#111111", border: `1px solid ${BORDER}`,
                  color: TEXT, transition: "all 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "#FFFFFF")}
                onMouseLeave={e => (e.currentTarget.style.color = TEXT)}
              >
                Close
              </button>
              <button
                onClick={() => { setSuccess(null); setTopicName(""); setError(null); }}
                style={{
                  padding: "8px 20px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                  cursor: "pointer", background: `${PURPLE}18`,
                  border: `1px solid ${PURPLE}40`, color: PURPLE,
                }}
              >
                Request Another
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <div style={{ fontSize: "11px", color: TEXT, marginBottom: "6px", fontWeight: 500 }}>Topic Name *</div>
              <input
                value={topicName}
                onChange={e => { setTopicName(e.target.value); setError(null); }}
                onKeyDown={e => { if (e.key === "Enter" && !generating) void handleGenerate(); }}
                placeholder="e.g. Fibonacci Retracements, Scalping Strategies, ATR Indicator…"
                disabled={generating}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: "8px",
                  background: CARD, border: `1px solid ${error ? "#ef4444" : BORDER}`,
                  color: "#FFFFFF", fontSize: "13px", outline: "none",
                  boxSizing: "border-box", opacity: generating ? 0.6 : 1,
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: "11px", color: TEXT, marginBottom: "6px", fontWeight: 500 }}>Difficulty Level</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    disabled={generating}
                    style={{
                      padding: "5px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 500,
                      cursor: "pointer",
                      border: `1px solid ${difficulty === d ? DIFF_COLORS[d]! + "60" : BORDER}`,
                      background: difficulty === d ? "#111111" : "transparent",
                      color: difficulty === d ? DIFF_COLORS[d] : TEXT,
                      opacity: generating ? 0.6 : 1,
                    }}
                  >
                    {DIFF_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ padding: "8px 12px", borderRadius: "7px", fontSize: "12px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={onClose}
                disabled={generating}
                style={{
                  padding: "9px 18px", borderRadius: "8px", fontSize: "12px", fontWeight: 500,
                  cursor: "pointer", background: "transparent", border: `1px solid ${BORDER}`,
                  color: TEXT, opacity: generating ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleGenerate()}
                disabled={generating || !topicName.trim()}
                style={{
                  display: "flex", alignItems: "center", gap: "7px",
                  padding: "9px 20px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                  cursor: generating || !topicName.trim() ? "not-allowed" : "pointer",
                  background: generating || !topicName.trim()
                    ? `${PURPLE}40`
                    : `linear-gradient(135deg, ${PURPLE}, #7c3aed)`,
                  border: "none", color: "#FFFFFF",
                  opacity: generating || !topicName.trim() ? 0.7 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {generating
                  ? <><Loader2 style={{ height: "13px", width: "13px", animation: "spin 1s linear infinite" }} />Generating…</>
                  : <><Wand2 style={{ height: "13px", width: "13px" }} />Generate Topic</>
                }
              </button>
            </div>

            {generating && (
              <div style={{ textAlign: "center", fontSize: "11px", color: TEXT, opacity: 0.7 }}>
                AI is writing your lesson… this takes about 10–20 seconds.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main LibraryTab ──────────────────────────────────────────────── */
export function LibraryTab({
  courses,
  onSelectCourse,
  onCourseAdded,
}: {
  courses: AcademyCourse[];
  onSelectCourse: (c: AcademyCourse) => void;
  onCourseAdded?: (course: AcademyCourse) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [newTopics, setNewTopics] = useState<AcademyCourse[]>([]);

  function handleCourseAdded(course: AcademyCourse) {
    setNewTopics(prev => [course, ...prev]);
    onCourseAdded?.(course);
  }

  const allCourses = useMemo(() => {
    const existingIds = new Set(courses.map(c => c.id));
    const deduped = newTopics.filter(c => !existingIds.has(c.id));
    return [...deduped, ...courses];
  }, [courses, newTopics]);

  const filtered = useMemo(() => {
    let result = allCourses;
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
  }, [allCourses, query, selectedDiff]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
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

        {/* Request Topic button */}
        <button
          onClick={() => setShowRequestModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: "7px",
            padding: "10px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
            cursor: "pointer", border: `1px solid ${PURPLE}50`,
            background: `${PURPLE}15`, color: PURPLE,
            flexShrink: 0, transition: "all 0.15s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${PURPLE}25`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${PURPLE}15`; }}
        >
          <Wand2 style={{ height: "13px", width: "13px" }} />
          Request a Topic
        </button>
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
                border: `1px solid ${active ? DIFF_COLORS[d]! + "60" : BORDER}`,
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
          <div style={{ fontSize: "11px", marginTop: "4px", opacity: 0.7 }}>
            Try "RSI", "candle", or{" "}
            <button
              onClick={() => setShowRequestModal(true)}
              style={{ background: "none", border: "none", color: PURPLE, cursor: "pointer", fontSize: "11px", padding: 0, fontWeight: 600 }}
            >
              request it from AI
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
          {filtered.map(c => <CourseCard key={c.id} course={c} onSelect={onSelectCourse} />)}
        </div>
      )}

      {/* Request Topic Modal */}
      {showRequestModal && (
        <RequestTopicModal
          onClose={() => setShowRequestModal(false)}
          onCreated={handleCourseAdded}
        />
      )}
    </div>
  );
}
