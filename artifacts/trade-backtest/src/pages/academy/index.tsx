import React, { useState, useEffect, useCallback } from "react";
import {
  GraduationCap, LayoutDashboard, Library, Bot,
  FileText, Trophy, Award, LogIn,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { API_BASE } from "@/lib/api-config";
import type { AcademyCourse, AcademyDashboard, AcademyNote, AcademyQuizAttempt, AcademyCertificate, AcademyLesson } from "./types";
import { DashboardTab } from "./dashboard-tab";
import { LibraryTab } from "./library-tab";
import { AiTutorTab } from "./ai-tutor-tab";
import { NotesTab } from "./notes-tab";
import { QuizzesTab } from "./quiz-tab";
import { CertificatesTab } from "./certificates-tab";
import { LessonView } from "./lesson-view";

const ACCENT = "#22D3EE";
const BORDER = "#262626";
const CARD = "#171717";
const TEXT = "#A1A1AA";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "library", label: "Library", icon: Library },
  { id: "ai-tutor", label: "AI Tutor", icon: Bot },
  { id: "notes", label: "Notes", icon: FileText },
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
    } catch { }
    setLoadingInit(false);
  }, [token]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  async function openCourse(course: AcademyCourse) {
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE}/api/academy/courses/${course.id}/lessons`, { headers: authHeader });
      if (!r.ok) return;
      const data = await r.json() as { course: AcademyCourse; lessons: AcademyLesson[] };
      const lessons = data?.lessons ?? [];
      if (!lessons.length) return;
      const firstIncomplete = lessons.find(l => !l.completed) ?? lessons[0];
      setLessonCtx({ course: data.course ?? course, lesson: firstIncomplete, allLessons: lessons });
    } catch { }
  }

  async function openLessonById(lessonId: number) {
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE}/api/academy/lessons/${lessonId}`, { headers: authHeader });
      if (!r.ok) return;
      const lesson = await r.json() as AcademyLesson;
      const course = courses.find(c => c.id === lesson.courseId);
      if (!course) return;
      const r2 = await fetch(`${API_BASE}/api/academy/courses/${course.id}/lessons`, { headers: authHeader });
      if (!r2.ok) return;
      const data = await r2.json() as { course: AcademyCourse; lessons: AcademyLesson[] };
      const lessons = data?.lessons ?? [];
      setLessonCtx({ course: data.course ?? course, lesson, allLessons: lessons });
    } catch { }
  }

  function handleLessonComplete(lessonId: number) {
    if (!lessonCtx) return;
    const updated = lessonCtx.allLessons.map(l => l.id === lessonId ? { ...l, completed: true } : l);
    const updatedCourse = { ...lessonCtx.course, completedLessons: (lessonCtx.course.completedLessons ?? 0) + 1 };
    setLessonCtx({ ...lessonCtx, allLessons: updated, course: updatedCourse, lesson: { ...lessonCtx.lesson, completed: true } });
    setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
    setTimeout(() => { void loadAll(); }, 1000);
  }

  if (!user) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "80px 20px", textAlign: "center", gap: "32px", maxWidth: "480px", margin: "0 auto",
      }}>
        <div style={{
          width: "52px", height: "52px", borderRadius: "14px",
          background: "#111111", border: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <GraduationCap style={{ height: "22px", width: "22px", color: "#FFFFFF" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.03em", margin: 0 }}>
            Trade Lab Academy
          </h1>
          <p style={{ fontSize: "14px", color: TEXT, margin: 0, lineHeight: "1.6" }}>
            Professional trading education and skill development.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", maxWidth: "320px" }}>
          {[
            "Structured paths from Beginner to Professional",
            "AI Study Tutor available 24/7",
            "Quizzes, notes, and certificates",
          ].map(f => (
            <div key={f} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 14px", borderRadius: "8px",
              background: "#111111", border: `1px solid ${BORDER}`,
              fontSize: "13px", color: TEXT, textAlign: "left",
            }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: ACCENT, flexShrink: 0 }} />
              {f}
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowAuth(true)}
          style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "11px 28px",
            borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
            background: "#111111", border: "1px solid #FFFFFF",
            color: "#FFFFFF", transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#1a1a1a")}
          onMouseLeave={e => (e.currentTarget.style.background = "#111111")}
        >
          <LogIn style={{ height: "14px", width: "14px" }} />
          Sign In to Start Learning
        </button>

        {showAuth && <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

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
        marginBottom: "24px", flexWrap: "wrap", gap: "12px",
      }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#FFFFFF", margin: "0 0 2px", letterSpacing: "-0.02em" }}>
            Academy
          </h1>
          <p style={{ fontSize: "12px", color: TEXT, margin: 0 }}>
            Professional trading education
          </p>
        </div>
        {dashboard && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
              <span style={{ fontWeight: 600, color: "#FFFFFF" }}>{dashboard.xp.streakDays}</span>
              <span style={{ color: TEXT }}>day streak</span>
            </div>
            <div style={{
              padding: "4px 10px", borderRadius: "6px",
              background: "#111111", border: `1px solid ${BORDER}`,
              fontSize: "12px",
            }}>
              <span style={{ fontWeight: 600, color: "#FFFFFF" }}>Lv.{dashboard.xp.level}</span>
              <span style={{ color: TEXT }}> · {dashboard.xp.xp.toLocaleString()} XP</span>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: "flex", gap: "0", overflowX: "auto",
        borderBottom: `1px solid ${BORDER}`,
        marginBottom: "24px",
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
                padding: "10px 16px", cursor: "pointer",
                background: "transparent", border: "none",
                borderBottom: `2px solid ${active ? ACCENT : "transparent"}`,
                color: active ? "#FFFFFF" : TEXT,
                fontSize: "12px", fontWeight: active ? 600 : 400,
                flexShrink: 0, transition: "all 0.15s ease",
                whiteSpace: "nowrap", marginBottom: "-1px",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#FFFFFF"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = TEXT; }}
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
              if (dashboard?.lastLesson) void openLessonById(dashboard.lastLesson.id);
            }}
          />
        )}
        {activeTab === "library" && (
          <LibraryTab
            courses={courses}
            onSelectCourse={openCourse}
            onCourseAdded={course => setCourses(prev => [course, ...prev])}
          />
        )}
        {activeTab === "ai-tutor" && <AiTutorTab />}
        {activeTab === "notes" && <NotesTab notes={notes} onNotesChange={setNotes} />}
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
