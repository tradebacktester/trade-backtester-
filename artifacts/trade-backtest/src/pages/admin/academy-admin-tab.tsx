import React, { useState, useEffect, useCallback } from "react";
import {
  GraduationCap, BookOpen, FileText, Users, CheckCircle, BarChart2,
  RefreshCw, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, ChevronDown,
  ChevronUp, Check, X, Image, Wand2, Save, AlertCircle, Eye, EyeOff,
  ChevronRight, Layers,
} from "lucide-react";
import { API_BASE } from "@/lib/api-config";

/* ── Types ───────────────────────────────────────────────────────── */
interface AcademyStats {
  totalCourses: number; totalLessons: number; totalUsers: number;
  totalCompletions: number; totalCertificates: number; totalXpAwarded: number;
  topCourses: Array<{ id: number; title: string; completions: number; thumbnailEmoji: string }>;
}
interface AdminCourse {
  id: number; title: string; description: string; category: string; difficulty: string;
  pathId: string; thumbnailEmoji: string | null; estimatedMinutes: number; sortOrder: number;
  published: boolean; lessonCount: number;
}
interface AdminLesson {
  id: number; courseId: number; title: string; type: string; content: string;
  videoUrl: string | null; imageUrls: string[]; estimatedMinutes: number;
  sortOrder: number; published: boolean;
}
interface GeneratedLesson { title: string; content: string; estimatedMinutes: number }
interface GeneratedQuiz { question: string; type: string; options: string[]; correctIndex: number; explanation: string }
interface GeneratedContent { lessons: GeneratedLesson[]; quizQuestions: GeneratedQuiz[] }

/* ── Constants ───────────────────────────────────────────────────── */
const C = { purple: "#a855f7", cyan: "#06b6d4", green: "#22c55e", amber: "#f59e0b", red: "#ef4444", pink: "#ec4899" };
const PATH_ORDER = ["beginner", "intermediate", "advanced", "professional"];
const PATH_LABELS: Record<string, { label: string; color: string }> = {
  beginner:     { label: "Beginner",     color: C.green },
  intermediate: { label: "Intermediate", color: C.cyan },
  advanced:     { label: "Advanced",     color: C.purple },
  professional: { label: "Professional", color: C.amber },
};
const DIFFICULTY_OPTIONS = ["beginner", "intermediate", "advanced", "professional"];

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "7px", fontSize: "12px",
  background: "hsl(var(--background))", border: "1px solid hsl(var(--border))",
  color: "hsl(var(--foreground))", outline: "none", boxSizing: "border-box",
};
const taStyle: React.CSSProperties = {
  ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: "1.5", minHeight: "80px",
};
const btnBase: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "5px", borderRadius: "8px",
  fontSize: "12px", cursor: "pointer", fontWeight: 600, border: "none",
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
export function AcademyAdminTab({ headers }: { headers: Record<string, string> }) {
  /* ── Core state ── */
  const [stats, setStats] = useState<AcademyStats | null>(null);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /* ── Seed ── */
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  /* ── Path UI ── */
  const [expandedPath, setExpandedPath] = useState<string>("beginner");

  /* ── Course CRUD ── */
  const [confirmDelete, setConfirmDelete] = useState<AdminCourse | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ title: "", description: "", category: "", difficulty: "beginner", pathId: "beginner", estimatedMinutes: "30", thumbnailEmoji: "📚" });
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  /* ── Edit course modal ── */
  const [editCourse, setEditCourse] = useState<AdminCourse | null>(null);
  const [editForm, setEditForm] = useState<Partial<AdminCourse>>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);

  /* ── Lessons panel ── */
  const [expandedLessons, setExpandedLessons] = useState<number | null>(null);
  const [lessons, setLessons] = useState<Record<number, AdminLesson[]>>({});
  const [lessonsLoading, setLessonsLoading] = useState<number | null>(null);

  /* ── Add lesson form ── */
  const [showAddLesson, setShowAddLesson] = useState<number | null>(null);
  const [addLessonForm, setAddLessonForm] = useState({ title: "", type: "article", content: "", videoUrl: "", estimatedMinutes: "10", imageUrls: [] as string[] });
  const [addLessonLoading, setAddLessonLoading] = useState(false);
  const [addLessonMsg, setAddLessonMsg] = useState<string | null>(null);

  /* ── Edit lesson modal ── */
  const [editLesson, setEditLesson] = useState<AdminLesson | null>(null);
  const [editLessonForm, setEditLessonForm] = useState<Partial<AdminLesson> & { imageUrls: string[] }>({ imageUrls: [] });
  const [editLessonLoading, setEditLessonLoading] = useState(false);
  const [editLessonMsg, setEditLessonMsg] = useState<string | null>(null);
  const [confirmDeleteLesson, setConfirmDeleteLesson] = useState<AdminLesson | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<number | null>(null);

  /* ── AI generate ── */
  const [aiCourse, setAiCourse] = useState<AdminCourse | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState<GeneratedContent | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  /* ── Fetch ── */
  const fetchAll = useCallback(async () => {
    setLoading(true); setFetchError(null);
    try {
      const [sr, cr] = await Promise.all([
        fetch(`${API_BASE}/api/academy/admin/stats`, { headers }),
        fetch(`${API_BASE}/api/academy/admin/courses`, { headers }),
      ]);
      if (sr.status === 401 || cr.status === 401) {
        setFetchError("Authentication required. Please log in as admin.");
        setLoading(false); return;
      }
      if (sr.ok) setStats(await sr.json());
      if (cr.ok) setCourses(await cr.json());
    } catch { setFetchError("Failed to connect to server."); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const fetchLessons = useCallback(async (courseId: number) => {
    setLessonsLoading(courseId);
    try {
      const r = await fetch(`${API_BASE}/api/academy/admin/courses/${courseId}/lessons`, { headers });
      if (r.ok) setLessons(prev => ({ ...prev, [courseId]: await r.json() }));
    } catch { /* ignore */ }
    setLessonsLoading(null);
  }, [headers]);

  /* ── Seed ── */
  async function runSeed() {
    setSeedLoading(true); setSeedMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/academy/admin/seed`, { method: "POST", headers });
      const d = await r.json();
      setSeedMsg(r.ok ? `✓ ${d.message ?? "Seed complete"}` : `✗ ${d.error ?? "Failed"}`);
      if (r.ok) void fetchAll();
    } catch { setSeedMsg("✗ Request failed"); }
    setSeedLoading(false);
  }

  /* ── Toggle publish ── */
  async function togglePublish(course: AdminCourse) {
    setTogglingId(course.id);
    try {
      const r = await fetch(`${API_BASE}/api/academy/admin/courses/${course.id}/publish`, {
        method: "PATCH", headers, body: JSON.stringify({ published: !course.published }),
      });
      if (r.ok) setCourses(prev => prev.map(c => c.id === course.id ? { ...c, published: !course.published } : c));
    } catch { /* ignore */ }
    setTogglingId(null);
  }

  /* ── Delete course ── */
  async function deleteCourse(course: AdminCourse) {
    setDeletingId(course.id); setConfirmDelete(null);
    try {
      const r = await fetch(`${API_BASE}/api/academy/admin/courses/${course.id}`, { method: "DELETE", headers });
      if (r.ok) { setCourses(prev => prev.filter(c => c.id !== course.id)); void fetchAll(); }
    } catch { /* ignore */ }
    setDeletingId(null);
  }

  /* ── Add course ── */
  async function addCourse() {
    if (!addForm.title.trim() || !addForm.description.trim() || !addForm.category.trim()) {
      setAddMsg("Title, description and category are required."); return;
    }
    setAddLoading(true); setAddMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/academy/admin/courses`, {
        method: "POST", headers,
        body: JSON.stringify({ ...addForm, estimatedMinutes: Number(addForm.estimatedMinutes) || 30, sortOrder: courses.filter(c => c.pathId === addForm.pathId).length + 1 }),
      });
      if (r.ok) { setAddMsg("✓ Topic added"); setShowAddForm(null); setAddForm({ title: "", description: "", category: "", difficulty: "beginner", pathId: "beginner", estimatedMinutes: "30", thumbnailEmoji: "📚" }); void fetchAll(); }
      else { const d = await r.json(); setAddMsg(`✗ ${d.error ?? "Failed"}`); }
    } catch { setAddMsg("✗ Request failed"); }
    setAddLoading(false);
  }

  /* ── Save edit course ── */
  async function saveEditCourse() {
    if (!editCourse) return;
    setEditLoading(true); setEditMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/academy/admin/courses/${editCourse.id}`, {
        method: "PUT", headers,
        body: JSON.stringify({ ...editForm, estimatedMinutes: Number(editForm.estimatedMinutes) || editCourse.estimatedMinutes }),
      });
      if (r.ok) {
        const updated = await r.json();
        setCourses(prev => prev.map(c => c.id === editCourse.id ? { ...c, ...updated } : c));
        setEditMsg("✓ Saved"); setTimeout(() => { setEditCourse(null); setEditMsg(null); }, 800);
      } else { const d = await r.json(); setEditMsg(`✗ ${d.error ?? "Failed"}`); }
    } catch { setEditMsg("✗ Request failed"); }
    setEditLoading(false);
  }

  /* ── Toggle lessons panel ── */
  function toggleLessons(courseId: number) {
    if (expandedLessons === courseId) { setExpandedLessons(null); return; }
    setExpandedLessons(courseId);
    setShowAddLesson(null);
    setAddLessonMsg(null);
    if (!lessons[courseId]) void fetchLessons(courseId);
  }

  /* ── Add lesson ── */
  async function addLesson(courseId: number) {
    if (!addLessonForm.title.trim()) { setAddLessonMsg("Title required."); return; }
    setAddLessonLoading(true); setAddLessonMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/academy/admin/courses/${courseId}/lessons`, {
        method: "POST", headers,
        body: JSON.stringify({ ...addLessonForm, estimatedMinutes: Number(addLessonForm.estimatedMinutes) || 10, imageUrls: addLessonForm.imageUrls.filter(u => u.trim()), videoUrl: addLessonForm.videoUrl.trim() || null }),
      });
      if (r.ok) {
        setAddLessonMsg("✓ Lesson added");
        setShowAddLesson(null);
        setAddLessonForm({ title: "", type: "article", content: "", videoUrl: "", estimatedMinutes: "10", imageUrls: [] });
        void fetchLessons(courseId);
        setCourses(prev => prev.map(c => c.id === courseId ? { ...c, lessonCount: c.lessonCount + 1 } : c));
      } else { const d = await r.json(); setAddLessonMsg(`✗ ${d.error ?? "Failed"}`); }
    } catch { setAddLessonMsg("✗ Request failed"); }
    setAddLessonLoading(false);
  }

  /* ── Save edit lesson ── */
  async function saveEditLesson() {
    if (!editLesson) return;
    setEditLessonLoading(true); setEditLessonMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/academy/admin/lessons/${editLesson.id}`, {
        method: "PUT", headers,
        body: JSON.stringify({ ...editLessonForm, estimatedMinutes: Number(editLessonForm.estimatedMinutes) || editLesson.estimatedMinutes, imageUrls: editLessonForm.imageUrls.filter(u => u.trim()) }),
      });
      if (r.ok) {
        const updated = await r.json();
        setLessons(prev => {
          const arr = prev[editLesson.courseId] ?? [];
          return { ...prev, [editLesson.courseId]: arr.map(l => l.id === editLesson.id ? { ...l, ...updated } : l) };
        });
        setEditLessonMsg("✓ Saved"); setTimeout(() => { setEditLesson(null); setEditLessonMsg(null); }, 800);
      } else { const d = await r.json(); setEditLessonMsg(`✗ ${d.error ?? "Failed"}`); }
    } catch { setEditLessonMsg("✗ Request failed"); }
    setEditLessonLoading(false);
  }

  /* ── Delete lesson ── */
  async function deleteLesson(lesson: AdminLesson) {
    setDeletingLessonId(lesson.id); setConfirmDeleteLesson(null);
    try {
      const r = await fetch(`${API_BASE}/api/academy/admin/lessons/${lesson.id}`, { method: "DELETE", headers });
      if (r.ok) {
        setLessons(prev => ({ ...prev, [lesson.courseId]: (prev[lesson.courseId] ?? []).filter(l => l.id !== lesson.id) }));
        setCourses(prev => prev.map(c => c.id === lesson.courseId ? { ...c, lessonCount: Math.max(0, c.lessonCount - 1) } : c));
      }
    } catch { /* ignore */ }
    setDeletingLessonId(null);
  }

  /* ── AI generate ── */
  async function generateWithAi(course: AdminCourse) {
    setAiCourse(course); setAiGenerating(true); setAiGenerated(null); setAiMsg(null);
  }

  async function runAiGenerate() {
    if (!aiCourse) return;
    setAiGenerating(true); setAiGenerated(null); setAiMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/academy/admin/ai/generate-course`, {
        method: "POST", headers, body: JSON.stringify({ courseId: aiCourse.id }),
      });
      if (r.ok) { setAiGenerated(await r.json()); }
      else { const d = await r.json(); setAiMsg(`✗ ${d.error ?? "AI generation failed"}`); }
    } catch { setAiMsg("✗ Request failed"); }
    setAiGenerating(false);
  }

  async function saveAiContent() {
    if (!aiCourse || !aiGenerated) return;
    setAiSaving(true); setAiMsg(null);
    let saved = 0;
    try {
      for (let i = 0; i < aiGenerated.lessons.length; i++) {
        const l = aiGenerated.lessons[i]!;
        const r = await fetch(`${API_BASE}/api/academy/admin/courses/${aiCourse.id}/lessons`, {
          method: "POST", headers, body: JSON.stringify({ title: l.title, type: "article", content: l.content, estimatedMinutes: l.estimatedMinutes, sortOrder: (lessons[aiCourse.id]?.length ?? 0) + i + 1 }),
        });
        if (r.ok) saved++;
      }
      for (let i = 0; i < aiGenerated.quizQuestions.length; i++) {
        const q = aiGenerated.quizQuestions[i]!;
        await fetch(`${API_BASE}/api/academy/admin/courses/${aiCourse.id}/quiz`, {
          method: "POST", headers, body: JSON.stringify({ ...q, sortOrder: i + 1 }),
        });
      }
      setAiMsg(`✓ Saved ${saved} lessons and ${aiGenerated.quizQuestions.length} quiz questions`);
      void fetchLessons(aiCourse.id);
      void fetchAll();
      setTimeout(() => { setAiCourse(null); setAiGenerated(null); setAiMsg(null); }, 2000);
    } catch { setAiMsg("✗ Failed to save some content"); }
    setAiSaving(false);
  }

  /* ── Derived ── */
  const coursesByPath = PATH_ORDER.reduce((acc, p) => {
    acc[p] = courses.filter(c => c.pathId === p);
    return acc;
  }, {} as Record<string, AdminCourse[]>);

  const STAT_CARDS = stats ? [
    { label: "Courses", value: stats.totalCourses, color: C.purple, icon: <BookOpen style={{ height: "13px", width: "13px" }} /> },
    { label: "Lessons", value: stats.totalLessons, color: C.cyan, icon: <FileText style={{ height: "13px", width: "13px" }} /> },
    { label: "Learners", value: stats.totalUsers, color: C.green, icon: <Users style={{ height: "13px", width: "13px" }} /> },
    { label: "Completions", value: stats.totalCompletions, color: C.amber, icon: <CheckCircle style={{ height: "13px", width: "13px" }} /> },
    { label: "Certificates", value: stats.totalCertificates, color: C.pink, icon: <GraduationCap style={{ height: "13px", width: "13px" }} /> },
    { label: "XP Awarded", value: (stats.totalXpAwarded ?? 0).toLocaleString(), color: C.amber, icon: <BarChart2 style={{ height: "13px", width: "13px" }} /> },
  ] : [];

  /* ════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════ */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* ── Header card ── */}
      <div style={{ background: "var(--card-bg)", borderRadius: "16px", padding: "18px 22px", border: "1px solid var(--glass-border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <GraduationCap style={{ height: "18px", width: "18px", color: C.purple }} />
            <span style={{ fontSize: "15px", fontWeight: 700, color: "hsl(var(--foreground))" }}>Academy Management</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={fetchAll} style={{ ...btnBase, padding: "5px 12px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))", fontWeight: 400 }}>
              <RefreshCw style={{ height: "11px", width: "11px" }} /> Refresh
            </button>
            <button onClick={runSeed} disabled={seedLoading} style={{ ...btnBase, padding: "5px 12px", background: `${C.purple}18`, border: `1px solid ${C.purple}40`, color: C.purple }}>
              {seedLoading ? <RefreshCw style={{ height: "11px", width: "11px", animation: "spin 1s linear infinite" }} /> : <Plus style={{ height: "11px", width: "11px" }} />}
              Re-seed Content
            </button>
          </div>
        </div>

        {fetchError && (
          <div style={{ marginBottom: "14px", padding: "10px 14px", borderRadius: "9px", fontSize: "12px", background: "rgba(239,68,68,0.1)", color: C.red, border: `1px solid ${C.red}30`, display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle style={{ height: "14px", width: "14px", flexShrink: 0 }} /> {fetchError}
            <button onClick={fetchAll} style={{ marginLeft: "auto", ...btnBase, padding: "3px 10px", background: C.red, color: "#fff", fontSize: "11px" }}>Retry</button>
          </div>
        )}

        {seedMsg && (
          <div style={{ marginBottom: "14px", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", background: seedMsg.startsWith("✓") ? `${C.green}12` : "rgba(239,68,68,0.12)", color: seedMsg.startsWith("✓") ? C.green : C.red, border: `1px solid ${seedMsg.startsWith("✓") ? C.green : C.red}30` }}>
            {seedMsg}
          </div>
        )}
        {addMsg && (
          <div style={{ marginBottom: "14px", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", background: addMsg.startsWith("✓") ? `${C.green}12` : "rgba(239,68,68,0.12)", color: addMsg.startsWith("✓") ? C.green : C.red, border: `1px solid ${addMsg.startsWith("✓") ? C.green : C.red}30` }}>
            {addMsg}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>
            <RefreshCw style={{ height: "12px", width: "12px", animation: "spin 1s linear infinite" }} /> Loading...
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px" }}>
            {STAT_CARDS.map(s => (
              <div key={s.label} style={{ padding: "10px 12px", borderRadius: "10px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", color: s.color, marginBottom: "3px" }}>
                  {s.icon}
                  <span style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
                </div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "hsl(var(--foreground))" }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Path sections ── */}
      {PATH_ORDER.map(pathId => {
        const pathMeta = PATH_LABELS[pathId]!;
        const pathCourses = coursesByPath[pathId] ?? [];
        const isExpanded = expandedPath === pathId;
        const isAddingHere = showAddForm === pathId;

        return (
          <div key={pathId} style={{ background: "var(--card-bg)", borderRadius: "14px", border: "1px solid var(--glass-border)", overflow: "hidden" }}>
            {/* Path header */}
            <div onClick={() => setExpandedPath(isExpanded ? "" : pathId)}
              style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "hsl(var(--muted))"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}
            >
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: pathMeta.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: "13px", color: "hsl(var(--foreground))", flex: 1 }}>{pathMeta.label} Path</span>
              <span style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>{pathCourses.length} topics · {pathCourses.filter(c => c.published).length} published</span>
              {isExpanded ? <ChevronUp style={{ height: "14px", width: "14px", color: "hsl(var(--muted-foreground))" }} /> : <ChevronDown style={{ height: "14px", width: "14px", color: "hsl(var(--muted-foreground))" }} />}
            </div>

            {isExpanded && (
              <div style={{ borderTop: "1px solid hsl(var(--border))", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>

                {pathCourses.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", padding: "10px 4px" }}>No topics yet in this path.</div>
                ) : pathCourses.map(course => {
                  const isLessonsOpen = expandedLessons === course.id;
                  const courseLessons = lessons[course.id] ?? [];

                  return (
                    <div key={course.id} style={{ borderRadius: "10px", border: "1px solid hsl(var(--border))", overflow: "hidden" }}>
                      {/* Course row */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", background: "hsl(var(--muted))" }}>
                        <span style={{ fontSize: "16px", flexShrink: 0 }}>{course.thumbnailEmoji ?? "📚"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.title}</div>
                          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>
                            {course.category} · {course.lessonCount} lesson{course.lessonCount !== 1 ? "s" : ""} · {course.estimatedMinutes}m
                          </div>
                        </div>

                        {/* AI Generate button */}
                        <button onClick={() => generateWithAi(course)} title="AI Generate Content"
                          style={{ ...btnBase, padding: "4px 9px", background: `${C.purple}18`, border: `1px solid ${C.purple}40`, color: C.purple, fontSize: "11px" }}>
                          <Wand2 style={{ height: "11px", width: "11px" }} /> AI
                        </button>

                        {/* Manage Lessons button */}
                        <button onClick={() => toggleLessons(course.id)} title="Manage Lessons"
                          style={{ ...btnBase, padding: "4px 9px", background: isLessonsOpen ? `${C.cyan}20` : "hsl(var(--background))", border: `1px solid ${isLessonsOpen ? C.cyan : "hsl(var(--border))"}`, color: isLessonsOpen ? C.cyan : "hsl(var(--muted-foreground))", fontSize: "11px" }}>
                          {lessonsLoading === course.id ? <RefreshCw style={{ height: "11px", width: "11px", animation: "spin 1s linear infinite" }} /> : <Layers style={{ height: "11px", width: "11px" }} />}
                          Lessons
                        </button>

                        {/* Edit button */}
                        <button onClick={() => { setEditCourse(course); setEditForm({ title: course.title, description: course.description, category: course.category, difficulty: course.difficulty, pathId: course.pathId, thumbnailEmoji: course.thumbnailEmoji ?? "📚", estimatedMinutes: course.estimatedMinutes }); setEditMsg(null); }}
                          title="Edit topic" style={{ padding: "5px", borderRadius: "6px", background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center" }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = C.cyan}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "hsl(var(--muted-foreground))"}>
                          <Edit2 style={{ height: "13px", width: "13px" }} />
                        </button>

                        {/* Publish toggle */}
                        <button onClick={() => togglePublish(course)} disabled={togglingId === course.id}
                          style={{ ...btnBase, padding: "3px 8px", fontSize: "10px", background: course.published ? `${C.green}18` : "hsl(var(--background))", border: `1px solid ${course.published ? C.green : "hsl(var(--border))"}`, color: course.published ? C.green : "hsl(var(--muted-foreground))" }}>
                          {togglingId === course.id ? <RefreshCw style={{ height: "10px", width: "10px", animation: "spin 1s linear infinite" }} /> : course.published ? <><ToggleRight style={{ height: "11px", width: "11px" }} /> Live</> : <><ToggleLeft style={{ height: "11px", width: "11px" }} /> Hidden</>}
                        </button>

                        {/* Delete */}
                        <button onClick={() => setConfirmDelete(course)} disabled={deletingId === course.id}
                          style={{ padding: "5px", borderRadius: "6px", background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center" }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = C.red}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "hsl(var(--muted-foreground))"}>
                          {deletingId === course.id ? <RefreshCw style={{ height: "13px", width: "13px", animation: "spin 1s linear infinite" }} /> : <Trash2 style={{ height: "13px", width: "13px" }} />}
                        </button>
                      </div>

                      {/* Lessons panel */}
                      {isLessonsOpen && (
                        <div style={{ padding: "10px 12px", background: "hsl(var(--background))", borderTop: "1px solid hsl(var(--border))" }}>
                          {addLessonMsg && (
                            <div style={{ marginBottom: "8px", padding: "6px 10px", borderRadius: "7px", fontSize: "11px", background: addLessonMsg.startsWith("✓") ? `${C.green}12` : "rgba(239,68,68,0.12)", color: addLessonMsg.startsWith("✓") ? C.green : C.red }}>
                              {addLessonMsg}
                            </div>
                          )}

                          {lessonsLoading === course.id ? (
                            <div style={{ padding: "8px", fontSize: "12px", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", gap: "6px" }}>
                              <RefreshCw style={{ height: "11px", width: "11px", animation: "spin 1s linear infinite" }} /> Loading lessons...
                            </div>
                          ) : (
                            <>
                              {courseLessons.length === 0 && !showAddLesson ? (
                                <div style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", padding: "4px 0 8px" }}>No lessons yet.</div>
                              ) : courseLessons.map(lesson => (
                                <div key={lesson.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", borderRadius: "8px", background: "hsl(var(--muted))", marginBottom: "5px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", background: lesson.type === "video" ? `${C.amber}20` : `${C.cyan}20`, color: lesson.type === "video" ? C.amber : C.cyan }}>
                                    {lesson.type === "video" ? "▶" : "📄"}
                                  </span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: "12px", fontWeight: 600, color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lesson.title}</div>
                                    <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>
                                      {lesson.estimatedMinutes}m {lesson.imageUrls?.length ? `· ${lesson.imageUrls.length} slide${lesson.imageUrls.length !== 1 ? "s" : ""}` : ""}
                                    </div>
                                  </div>
                                  <button onClick={() => { setEditLesson(lesson); setEditLessonForm({ title: lesson.title, type: lesson.type, content: lesson.content, videoUrl: lesson.videoUrl ?? "", estimatedMinutes: lesson.estimatedMinutes, imageUrls: lesson.imageUrls ?? [], published: lesson.published }); setEditLessonMsg(null); }}
                                    style={{ padding: "4px", borderRadius: "5px", background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center" }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = C.cyan}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "hsl(var(--muted-foreground))"}>
                                    <Edit2 style={{ height: "12px", width: "12px" }} />
                                  </button>
                                  <button onClick={() => setConfirmDeleteLesson(lesson)}
                                    style={{ padding: "4px", borderRadius: "5px", background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center" }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = C.red}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "hsl(var(--muted-foreground))"}>
                                    {deletingLessonId === lesson.id ? <RefreshCw style={{ height: "12px", width: "12px", animation: "spin 1s linear infinite" }} /> : <Trash2 style={{ height: "12px", width: "12px" }} />}
                                  </button>
                                </div>
                              ))}

                              {/* Add lesson form */}
                              {showAddLesson === course.id ? (
                                <LessonForm
                                  form={addLessonForm}
                                  onChange={setAddLessonForm as (f: typeof addLessonForm) => void}
                                  onSave={() => addLesson(course.id)}
                                  onCancel={() => { setShowAddLesson(null); setAddLessonMsg(null); }}
                                  saving={addLessonLoading}
                                  title="Add New Lesson"
                                />
                              ) : (
                                <button onClick={() => { setShowAddLesson(course.id); setAddLessonForm({ title: "", type: "article", content: "", videoUrl: "", estimatedMinutes: "10", imageUrls: [] }); }}
                                  style={{ ...btnBase, padding: "6px 12px", background: `${C.cyan}12`, border: `1px dashed ${C.cyan}50`, color: C.cyan, fontSize: "12px", marginTop: "4px" }}>
                                  <Plus style={{ height: "12px", width: "12px" }} /> Add Lesson
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add topic form */}
                {isAddingHere ? (
                  <div style={{ marginTop: "6px", padding: "14px", borderRadius: "10px", background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: "12px" }}>Add Topic to {pathMeta.label} Path</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>Title *</div>
                          <input value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Fibonacci Retracements" style={inputStyle} />
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>Category *</div>
                          <input value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Price Action" style={inputStyle} />
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>Description *</div>
                        <textarea value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="What will students learn?" rows={2} style={taStyle} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>Difficulty</div>
                          <select value={addForm.difficulty} onChange={e => setAddForm(f => ({ ...f, difficulty: e.target.value }))} style={inputStyle}>
                            {DIFFICULTY_OPTIONS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>Est. Minutes</div>
                          <input type="number" value={addForm.estimatedMinutes} onChange={e => setAddForm(f => ({ ...f, estimatedMinutes: e.target.value }))} min={5} max={300} style={inputStyle} />
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>Emoji</div>
                          <input value={addForm.thumbnailEmoji} onChange={e => setAddForm(f => ({ ...f, thumbnailEmoji: e.target.value }))} placeholder="📚" maxLength={2} style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
                        <button onClick={() => { setShowAddForm(null); setAddMsg(null); }} style={{ ...btnBase, padding: "6px 14px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))", fontWeight: 400 }}>Cancel</button>
                        <button onClick={addCourse} disabled={addLoading} style={{ ...btnBase, padding: "6px 14px", background: pathMeta.color, color: "#000", opacity: addLoading ? 0.7 : 1 }}>
                          {addLoading ? <RefreshCw style={{ height: "11px", width: "11px", animation: "spin 1s linear infinite" }} /> : <Check style={{ height: "11px", width: "11px" }} />} Add Topic
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setShowAddForm(pathId); setAddForm(f => ({ ...f, pathId, difficulty: pathId as never })); setAddMsg(null); }}
                    style={{ ...btnBase, padding: "8px 12px", background: `${pathMeta.color}12`, border: `1px dashed ${pathMeta.color}50`, color: pathMeta.color, fontSize: "12px", marginTop: "4px" }}>
                    <Plus style={{ height: "12px", width: "12px" }} /> Add Topic to {pathMeta.label}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ════ MODALS ════ */}

      {/* Edit Course Modal */}
      {editCourse && (
        <Modal onClose={() => { setEditCourse(null); setEditMsg(null); }} title={`Edit: ${editCourse.title}`} icon={<Edit2 style={{ height: "15px", width: "15px", color: C.cyan }} />}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <FieldLabel>Title *</FieldLabel>
                <input value={editForm.title ?? ""} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <FieldLabel>Category *</FieldLabel>
                <input value={editForm.category ?? ""} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div>
              <FieldLabel>Description *</FieldLabel>
              <textarea value={editForm.description ?? ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} style={taStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              <div>
                <FieldLabel>Path</FieldLabel>
                <select value={editForm.pathId ?? ""} onChange={e => setEditForm(f => ({ ...f, pathId: e.target.value }))} style={inputStyle}>
                  {DIFFICULTY_OPTIONS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Est. Minutes</FieldLabel>
                <input type="number" value={editForm.estimatedMinutes ?? 30} onChange={e => setEditForm(f => ({ ...f, estimatedMinutes: Number(e.target.value) }))} min={5} style={inputStyle} />
              </div>
              <div>
                <FieldLabel>Emoji</FieldLabel>
                <input value={editForm.thumbnailEmoji ?? "📚"} onChange={e => setEditForm(f => ({ ...f, thumbnailEmoji: e.target.value }))} maxLength={2} style={inputStyle} />
              </div>
            </div>
            {editMsg && <StatusMsg msg={editMsg} />}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={() => { setEditCourse(null); setEditMsg(null); }} style={{ ...btnBase, padding: "7px 16px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))", fontWeight: 400 }}>Cancel</button>
              <button onClick={saveEditCourse} disabled={editLoading} style={{ ...btnBase, padding: "7px 16px", background: C.cyan, color: "#000", opacity: editLoading ? 0.7 : 1 }}>
                {editLoading ? <RefreshCw style={{ height: "11px", width: "11px", animation: "spin 1s linear infinite" }} /> : <Save style={{ height: "11px", width: "11px" }} />} Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Lesson Modal */}
      {editLesson && (
        <Modal onClose={() => { setEditLesson(null); setEditLessonMsg(null); }} title={`Edit Lesson: ${editLesson.title}`} icon={<FileText style={{ height: "15px", width: "15px", color: C.cyan }} />} wide>
          <LessonForm
            form={editLessonForm as Parameters<typeof LessonForm>[0]["form"]}
            onChange={f => setEditLessonForm(f as typeof editLessonForm)}
            onSave={saveEditLesson}
            onCancel={() => { setEditLesson(null); setEditLessonMsg(null); }}
            saving={editLessonLoading}
            title="Save Lesson"
            msg={editLessonMsg}
          />
        </Modal>
      )}

      {/* AI Generate Modal */}
      {aiCourse && (
        <Modal onClose={() => { setAiCourse(null); setAiGenerated(null); setAiMsg(null); setAiGenerating(false); }} title={`AI Generate: ${aiCourse.title}`} icon={<Wand2 style={{ height: "15px", width: "15px", color: C.purple }} />} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ padding: "10px 14px", borderRadius: "9px", background: `${C.purple}12`, border: `1px solid ${C.purple}25`, fontSize: "12px", color: "hsl(var(--muted-foreground))", lineHeight: "1.6" }}>
              <strong style={{ color: C.purple }}>Groq AI</strong> will generate <strong>3 comprehensive lesson articles</strong> and <strong>5 quiz questions</strong> tailored to "<em>{aiCourse.title}</em>" ({aiCourse.difficulty} level). Review the content before saving.
            </div>

            {!aiGenerated && !aiGenerating && !aiMsg && (
              <button onClick={runAiGenerate} style={{ ...btnBase, padding: "10px 20px", background: `linear-gradient(135deg, ${C.purple}, #7c3aed)`, color: "#fff", fontSize: "13px", justifyContent: "center", borderRadius: "10px" }}>
                <Wand2 style={{ height: "14px", width: "14px" }} /> Generate Course Content
              </button>
            )}

            {aiGenerating && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "24px" }}>
                <RefreshCw style={{ height: "28px", width: "28px", color: C.purple, animation: "spin 1s linear infinite" }} />
                <div style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))" }}>Groq AI is generating lesson content…</div>
              </div>
            )}

            {aiMsg && (
              <div style={{ padding: "8px 12px", borderRadius: "8px", fontSize: "12px", background: aiMsg.startsWith("✓") ? `${C.green}12` : "rgba(239,68,68,0.12)", color: aiMsg.startsWith("✓") ? C.green : C.red, border: `1px solid ${aiMsg.startsWith("✓") ? C.green : C.red}30` }}>
                {aiMsg}
              </div>
            )}

            {aiGenerated && (
              <>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: "8px" }}>
                    Generated {aiGenerated.lessons.length} Lessons
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {aiGenerated.lessons.map((l, i) => (
                      <div key={i} style={{ padding: "10px 12px", borderRadius: "8px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: C.cyan, background: `${C.cyan}18`, padding: "2px 6px", borderRadius: "4px" }}>Lesson {i + 1}</span>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "hsl(var(--foreground))" }}>{l.title}</span>
                          <span style={{ marginLeft: "auto", fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>{l.estimatedMinutes}m</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", maxHeight: "60px", overflow: "hidden", lineHeight: "1.4" }}>
                          {l.content.slice(0, 200)}…
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: "8px" }}>
                    Generated {aiGenerated.quizQuestions.length} Quiz Questions
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {aiGenerated.quizQuestions.map((q, i) => (
                      <div key={i} style={{ padding: "8px 12px", borderRadius: "8px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
                        <div style={{ fontSize: "11px", color: "hsl(var(--foreground))", fontWeight: 600 }}>Q{i + 1}: {q.question}</div>
                        <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "2px" }}>
                          {q.options.map((o, oi) => <span key={oi} style={{ marginRight: "8px", color: oi === q.correctIndex ? C.green : "hsl(var(--muted-foreground))", fontWeight: oi === q.correctIndex ? 700 : 400 }}>{oi === q.correctIndex ? "✓" : "○"} {o}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button onClick={() => { setAiGenerated(null); setAiMsg(null); }} style={{ ...btnBase, padding: "7px 16px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))", fontWeight: 400 }}>
                    Regenerate
                  </button>
                  <button onClick={saveAiContent} disabled={aiSaving} style={{ ...btnBase, padding: "7px 16px", background: `linear-gradient(135deg, ${C.purple}, #7c3aed)`, color: "#fff", opacity: aiSaving ? 0.7 : 1 }}>
                    {aiSaving ? <RefreshCw style={{ height: "11px", width: "11px", animation: "spin 1s linear infinite" }} /> : <Save style={{ height: "11px", width: "11px" }} />}
                    Save All Content
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Course Confirm */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} title="Delete Topic" icon={<Trash2 style={{ height: "15px", width: "15px", color: C.red }} />}>
          <div style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))", marginBottom: "18px", lineHeight: "1.5" }}>
            Permanently delete <strong style={{ color: "hsl(var(--foreground))" }}>{confirmDelete.title}</strong>? This will also remove all its lessons, quiz questions, and user progress.
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button onClick={() => setConfirmDelete(null)} style={{ ...btnBase, padding: "7px 16px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))", fontWeight: 400 }}>Cancel</button>
            <button onClick={() => deleteCourse(confirmDelete)} style={{ ...btnBase, padding: "7px 16px", background: C.red, color: "#fff" }}>
              <Trash2 style={{ height: "11px", width: "11px" }} /> Delete
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Lesson Confirm */}
      {confirmDeleteLesson && (
        <Modal onClose={() => setConfirmDeleteLesson(null)} title="Delete Lesson" icon={<Trash2 style={{ height: "15px", width: "15px", color: C.red }} />}>
          <div style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))", marginBottom: "18px", lineHeight: "1.5" }}>
            Permanently delete lesson <strong style={{ color: "hsl(var(--foreground))" }}>{confirmDeleteLesson.title}</strong>?
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button onClick={() => setConfirmDeleteLesson(null)} style={{ ...btnBase, padding: "7px 16px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))", fontWeight: 400 }}>Cancel</button>
            <button onClick={() => deleteLesson(confirmDeleteLesson)} style={{ ...btnBase, padding: "7px 16px", background: C.red, color: "#fff" }}>
              <Trash2 style={{ height: "11px", width: "11px" }} /> Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LESSON FORM — used for both Add and Edit
═══════════════════════════════════════════════════════════════════ */
interface LessonFormProps {
  form: { title: string; type: string; content: string; videoUrl: string | null | undefined; estimatedMinutes: string | number; imageUrls: string[]; published?: boolean };
  onChange: (f: LessonFormProps["form"]) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  title: string;
  msg?: string | null;
}

function LessonForm({ form, onChange, onSave, onCancel, saving, title, msg }: LessonFormProps) {
  function setField(k: string, v: unknown) { onChange({ ...form, [k]: v } as LessonFormProps["form"]); }

  function addImageUrl() { onChange({ ...form, imageUrls: [...(form.imageUrls ?? []), ""] }); }
  function setImageUrl(i: number, v: string) {
    const arr = [...(form.imageUrls ?? [])];
    arr[i] = v;
    onChange({ ...form, imageUrls: arr });
  }
  function removeImageUrl(i: number) {
    onChange({ ...form, imageUrls: (form.imageUrls ?? []).filter((_, idx) => idx !== i) });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "8px", alignItems: "end" }}>
        <div>
          <FieldLabel>Title *</FieldLabel>
          <input value={form.title} onChange={e => setField("title", e.target.value)} placeholder="Lesson title" style={inputStyle} />
        </div>
        <div>
          <FieldLabel>Type</FieldLabel>
          <select value={form.type} onChange={e => setField("type", e.target.value)} style={{ ...inputStyle, width: "90px" }}>
            <option value="article">Article</option>
            <option value="video">Video</option>
          </select>
        </div>
        <div>
          <FieldLabel>Minutes</FieldLabel>
          <input type="number" value={form.estimatedMinutes} onChange={e => setField("estimatedMinutes", e.target.value)} min={1} max={300} style={{ ...inputStyle, width: "70px" }} />
        </div>
      </div>

      {form.type === "video" && (
        <div>
          <FieldLabel>Video URL</FieldLabel>
          <input value={form.videoUrl ?? ""} onChange={e => setField("videoUrl", e.target.value)} placeholder="https://youtube.com/watch?v=..." style={inputStyle} />
        </div>
      )}

      <div>
        <FieldLabel>Content (Markdown)</FieldLabel>
        <textarea value={form.content} onChange={e => setField("content", e.target.value)} placeholder="# Lesson Title&#10;&#10;Write your lesson content in Markdown..." rows={10} style={{ ...taStyle, minHeight: "200px", fontFamily: "monospace", fontSize: "12px" }} />
      </div>

      {/* Image Slides */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <Image style={{ height: "13px", width: "13px", color: "hsl(var(--muted-foreground))" }} />
          <span style={{ fontSize: "12px", fontWeight: 600, color: "hsl(var(--foreground))" }}>Image Slides</span>
          <span style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>— shown as a visual carousel in the lesson</span>
        </div>
        {(form.imageUrls ?? []).length === 0 && (
          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginBottom: "8px" }}>No slides yet. Add image URLs below.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {(form.imageUrls ?? []).map((url, i) => (
            <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "6px", background: "hsl(var(--muted))", fontSize: "11px", fontWeight: 700, color: "hsl(var(--muted-foreground))", flexShrink: 0 }}>
                {i + 1}
              </div>
              {url && (
                <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "hsl(var(--muted))", overflow: "hidden", flexShrink: 0 }}>
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
              <input value={url} onChange={e => setImageUrl(i, e.target.value)} placeholder={`https://... (Slide ${i + 1} image URL)`} style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => removeImageUrl(i)} style={{ padding: "5px", borderRadius: "5px", background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ef4444"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "hsl(var(--muted-foreground))"}>
                <X style={{ height: "13px", width: "13px" }} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addImageUrl} style={{ ...btnBase, padding: "6px 12px", background: "hsl(var(--muted))", border: "1px dashed hsl(var(--border))", color: "hsl(var(--muted-foreground))", fontSize: "11px", marginTop: "6px", fontWeight: 400 }}>
          <Image style={{ height: "11px", width: "11px" }} /> Add Slide Image
        </button>
      </div>

      {msg && <StatusMsg msg={msg} />}

      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", borderTop: "1px solid hsl(var(--border))", paddingTop: "10px" }}>
        <button onClick={onCancel} style={{ ...btnBase, padding: "7px 16px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))", fontWeight: 400 }}>Cancel</button>
        <button onClick={onSave} disabled={saving} style={{ ...btnBase, padding: "7px 16px", background: "#06b6d4", color: "#000", opacity: saving ? 0.7 : 1 }}>
          {saving ? <RefreshCw style={{ height: "11px", width: "11px", animation: "spin 1s linear infinite" }} /> : <Save style={{ height: "11px", width: "11px" }} />} {title}
        </button>
      </div>
    </div>
  );
}

/* ── Shared helpers ── */
function Modal({ children, onClose, title, icon, wide }: { children: React.ReactNode; onClose: () => void; title: string; icon: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
      <div style={{ background: "hsl(var(--card))", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: wide ? "740px" : "460px", border: "1px solid hsl(var(--border))", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
          {icon}
          <span style={{ fontSize: "14px", fontWeight: 700, color: "hsl(var(--foreground))" }}>{title}</span>
          <button onClick={onClose} style={{ marginLeft: "auto", padding: "4px", borderRadius: "6px", background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", display: "flex" }}>
            <X style={{ height: "16px", width: "16px" }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginBottom: "4px", fontWeight: 500 }}>{children}</div>;
}

function StatusMsg({ msg }: { msg: string }) {
  const ok = msg.startsWith("✓");
  return (
    <div style={{ padding: "7px 12px", borderRadius: "8px", fontSize: "12px", background: ok ? `${C.green}12` : "rgba(239,68,68,0.12)", color: ok ? C.green : C.red, border: `1px solid ${ok ? C.green : C.red}30` }}>
      {msg}
    </div>
  );
}
