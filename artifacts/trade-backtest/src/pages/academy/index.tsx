import React, { useState, useEffect, useCallback } from "react";
import {
  GraduationCap, LayoutDashboard, Map, Library, Bot,
  FileText, Trophy, Award, LogIn,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { API_BASE } from "@/lib/api-config";
import type { AcademyCourse, AcademyDashboard, AcademyNote, AcademyQuizAttempt, AcademyCertificate, AcademyLesson } from "./types";
import { DashboardTab } from "./dashboard-tab";
import { PathsTab } from "./paths-tab";
import { LibraryTab } from "./library-tab";
import { AiTutorTab } from "./ai-tutor-tab";
import { NotesTab } from "./notes-tab";
import { QuizzesTab } from "./quiz-tab";
import { CertificatesTab } from "./certificates-tab";
import { LessonView } from "./lesson-view";

const C = { purple: "#a855f7", cyan: "#06b6d4", green: "#22c55e", amber: "#f59e0b" };

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "paths", label: "Learning Paths", icon: Map },
  { id: "library", label: "Topic Library", icon: Library },
  { id: "ai-tutor", label: "AI Tutor", icon: Bot },
  { id: "notes", label: "Notes Hub", icon: FileText },
  { id: "quizzes", label: "Quizzes", icon: Trophy },
  { id: "certificates", label: "Certificates", icon: Award },
] as const;

type TabId = typeof TABS[number]["id"];

interface LessonContext {
  course: AcademyCourse;
  lesson: AcademyLesson;
  allLessons: AcademyLesson[];
}

export default function AcademyPage() {
  const { token, user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [lessonCtx, setLessonCtx] = useState<LessonContext | null>(null);

  // Data state
  const [dashboard, setDashboard] = useState<AcademyDashboard | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [notes, setNotes] = useState<AcademyNote[]>([]);
  const [attempts, setAttempts] = useState<AcademyQuizAttempt[]>([]);
  const [certs, setCerts] = useState<AcademyCertificate[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  const authHeader = { Authorization: `Bearer ${token}` };

  const loadAll = useCallback(async () => {
    if (!token) { setLoadingInit(false); return; }
    setLoadingInit(true);
    try {
      const [dashRes, coursesRes, notesRes, attemptsRes, certsRes] = await Promise.all([
        fetch(`${API_BASE}/api/academy/dashboard`, { headers: authHeader }),
        fetch(`${API_BASE}/api/academy/paths`, { headers: authHeader }),
        fetch(`${API_BASE}/api/academy/notes`, { headers: authHeader }),
        fetch(`${API_BASE}/api/academy/quiz/attempts`, { headers: authHeader }),
        fetch(`${API_BASE}/api/academy/certificates`, { headers: authHeader }),
      ]);
      if (dashRes.ok) setDashboard(await dashRes.json());
      if (coursesRes.ok) setCourses(await coursesRes.json());
      if (notesRes.ok) setNotes(await notesRes.json());
      if (attemptsRes.ok) setAttempts(await attemptsRes.json());
      if (certsRes.ok) setCerts(await certsRes.json());
    } catch { /* ignore */ }
    setLoadingInit(false);
  }, [token]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  async function openCourse(course: AcademyCourse) {
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE}/api/academy/courses/${course.id}/lessons`, { headers: authHeader });
      if (!r.ok) return;
      const data = await r.json() as { course: AcademyCourse; lessons: AcademyLesson[] };
      if (!data.lessons.length) return;
      const firstIncomplete = data.lessons.find(l => !l.completed) ?? data.lessons[0];
      setLessonCtx({ course: data.course, lesson: firstIncomplete, allLessons: data.lessons });
    } catch { /* ignore */ }
  }

  async function openLessonById(lessonId: number) {
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE}/api/academy/lessons/${lessonId}`, { headers: authHeader });
      if (!r.ok) return;
      const lesson = await r.json() as AcademyLesson;
      // Find the course
      const course = courses.find(c => c.id === lesson.courseId);
      if (!course) return;
      const r2 = await fetch(`${API_BASE}/api/academy/courses/${course.id}/lessons`, { headers: authHeader });
      if (!r2.ok) return;
      const data = await r2.json() as { course: AcademyCourse; lessons: AcademyLesson[] };
      setLessonCtx({ course: data.course, lesson, allLessons: data.lessons });
    } catch { /* ignore */ }
  }

  function handleLessonComplete(lessonId: number) {
    if (!lessonCtx) return;
    const updated = lessonCtx.allLessons.map(l => l.id === lessonId ? { ...l, completed: true } : l);
    const updatedCourse = { ...lessonCtx.course, completedLessons: (lessonCtx.course.completedLessons ?? 0) + 1 };
    setLessonCtx({ ...lessonCtx, allLessons: updated, course: updatedCourse, lesson: { ...lessonCtx.lesson, completed: true } });
    setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
    // Refresh dashboard after a delay
    setTimeout(() => { void loadAll(); }, 1000);
  }

  if (!user) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "80px 20px", textAlign: "center", gap: "20px",
      }}>
        <div style={{ fontSize: "56px" }}>📚</div>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "hsl(var(--foreground))", letterSpacing: "-0.03em", margin: "0 0 8px" }}>
            Trade Lab Academy
          </h1>
          <p style={{ fontSize: "14px", color: "hsl(var(--muted-foreground))", margin: 0, maxWidth: "400px" }}>
            A complete trading education platform — structured paths, AI tutor, quizzes, and certificates. Sign in to start learning.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", maxWidth: "480px" }}>
          {["📈 Beginner to Professional paths", "🧠 AI Study Tutor", "🃏 Quizzes & Flashcards", "📝 Private Notes Hub", "🏆 Earn Certificates", "🔥 Streak & XP System"].map(f => (
            <span key={f} style={{
              fontSize: "12px", padding: "5px 12px", borderRadius: "20px",
              background: `${C.purple}12`, border: `1px solid ${C.purple}25`, color: C.purple,
            }}>{f}</span>
          ))}
        </div>
        <button
          onClick={() => setShowAuth(true)}
          style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "12px 28px",
            borderRadius: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer",
            background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
            border: "none", color: "white",
            boxShadow: `0 8px 24px ${C.purple}40`,
          }}
        >
          <LogIn style={{ height: "15px", width: "15px" }} /> Sign In to Start Learning
        </button>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  // Lesson viewer
  if (lessonCtx) {
    return (
      <LessonView
        course={lessonCtx.course}
        lesson={lessonCtx.lesson}
        allLessons={lessonCtx.allLessons}
        onBack={() => setLessonCtx(null)}
        onLessonSelect={lesson => setLessonCtx({ ...lessonCtx, lesson })}
        onComplete={handleLessonComplete}
      />
    );
  }

  const pathProgress = dashboard?.pathProgress ?? {
    beginner: { total: 0, completed: 0, quizScore: null },
    intermediate: { total: 0, completed: 0, quizScore: null },
    advanced: { total: 0, completed: 0, quizScore: null },
    professional: { total: 0, completed: 0, quizScore: null },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {/* Page Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "20px", flexWrap: "wrap", gap: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "42px", height: "42px", borderRadius: "12px",
            background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 16px ${C.purple}40`,
          }}>
            <GraduationCap style={{ height: "20px", width: "20px", color: "white" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 800, color: "hsl(var(--foreground))", margin: 0, letterSpacing: "-0.03em" }}>
              Trade Lab Academy
            </h1>
            <p style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", margin: 0 }}>
              Professional trading education · Beginner to Professional
            </p>
          </div>
        </div>
        {dashboard && (
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
              <span style={{ fontSize: "16px" }}>🔥</span>
              <span style={{ fontWeight: 700, color: C.amber }}>{dashboard.xp.streakDays}</span>
              <span style={{ color: "hsl(var(--muted-foreground))" }}>day streak</span>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "5px 12px", borderRadius: "20px",
              background: `${C.purple}15`, border: `1px solid ${C.purple}30`,
              fontSize: "12px",
            }}>
              <span style={{ fontWeight: 700, color: C.purple }}>Lv.{dashboard.xp.level}</span>
              <span style={{ color: "hsl(var(--muted-foreground))" }}>{dashboard.xp.xp.toLocaleString()} XP</span>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: "flex", gap: "2px", overflowX: "auto", paddingBottom: "2px",
        marginBottom: "20px",
        scrollbarWidth: "none",
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 14px", borderRadius: "10px", cursor: "pointer",
                background: active ? `${C.purple}18` : "transparent",
                border: `1px solid ${active ? C.purple + "40" : "transparent"}`,
                color: active ? C.purple : "hsl(var(--muted-foreground))",
                fontSize: "12px", fontWeight: active ? 700 : 500,
                flexShrink: 0, transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "hsl(var(--muted))"; } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; } }}
            >
              <tab.icon style={{ height: "13px", width: "13px" }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "dashboard" && (
          <DashboardTab
            data={dashboard}
            onNavigate={tab => setActiveTab(tab as TabId)}
            onContinue={() => {
              if (dashboard?.lastLesson) {
                void openLessonById(dashboard.lastLesson.id);
              }
            }}
          />
        )}
        {activeTab === "paths" && (
          <PathsTab courses={courses} onSelectCourse={openCourse} />
        )}
        {activeTab === "library" && (
          <LibraryTab courses={courses} onSelectCourse={openCourse} />
        )}
        {activeTab === "ai-tutor" && <AiTutorTab />}
        {activeTab === "notes" && (
          <NotesTab notes={notes} onNotesChange={setNotes} />
        )}
        {activeTab === "quizzes" && (
          <QuizzesTab courses={courses} attempts={attempts} onAttemptsChange={setAttempts} />
        )}
        {activeTab === "certificates" && (
          <CertificatesTab certificates={certs} pathProgress={pathProgress} />
        )}
      </div>
    </div>
  );
}
