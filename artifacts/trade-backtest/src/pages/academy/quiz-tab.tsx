import React, { useState, useRef } from "react";
import {
  CheckCircle2, XCircle, Trophy, RotateCcw,
  ChevronRight, Loader2, Award, BookOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";
import type { AcademyCourse, AcademyQuizQuestion, AcademyQuizAttempt } from "./types";
import { PATH_META } from "./types";

const ACCENT = "#22D3EE";
const SUCCESS = "#84CC16";
const DANGER = "#EF4444";
const BORDER = "#262626";
const CARD = "#171717";
const TEXT = "#A1A1AA";

interface QuizResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  results: Array<{ correct: boolean; correctIndex: number; explanation: string }> | undefined;
}

function QuizRunner({ course, questions, onFinish, onBack }: {
  course: AcademyCourse;
  questions: AcademyQuizQuestion[];
  onFinish: (result: QuizResult, answers: number[]) => void;
  onBack: () => void;
}) {
  const { token } = useAuth();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startTime = useRef(Date.now());

  const q = questions[currentQ];
  if (!q) return null;

  const progress = ((currentQ) / questions.length) * 100;
  const isLast = currentQ === questions.length - 1;

  function handleNext() {
    if (selected === null) return;
    const newAnswers = [...answers, selected];
    if (!isLast) {
      setAnswers(newAnswers);
      setCurrentQ(qi => qi + 1);
      setSelected(null);
    } else {
      submitQuiz(newAnswers);
    }
  }

  async function submitQuiz(finalAnswers: number[]) {
    setSubmitting(true);
    const timeSpent = Math.round((Date.now() - startTime.current) / 1000);
    try {
      const r = await fetch(`${API_BASE}/api/academy/courses/${course.id}/quiz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers: finalAnswers, timeSpentSeconds: timeSpent }),
      });
      onFinish(await r.json() as QuizResult, finalAnswers);
    } catch {
      onFinish({ score: 0, totalQuestions: questions.length, percentage: 0, results: [] }, finalAnswers);
    }
    setSubmitting(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>{course.title}</div>
          <div style={{ fontSize: "12px", color: TEXT }}>Question {currentQ + 1} of {questions.length}</div>
        </div>
        <button onClick={onBack} style={{
          padding: "7px 14px", borderRadius: "8px", fontSize: "12px", cursor: "pointer",
          background: "transparent", border: `1px solid ${BORDER}`, color: TEXT,
        }}>
          Exit
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: "3px", borderRadius: "2px", background: "#262626", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: ACCENT, transition: "width 0.4s", borderRadius: "2px" }} />
      </div>

      {/* Question card */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "14px", padding: "20px 16px" }}>
        <div style={{ fontSize: "16px", fontWeight: 600, color: "#FFFFFF", lineHeight: "1.5", marginBottom: "18px" }}>
          {q.question}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {(q.options ?? []).map((opt, i) => {
            const isSelected = selected === i;
            return (
              <button
                key={i}
                onClick={() => setSelected(i)}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "13px 14px", borderRadius: "10px",
                  cursor: "pointer", textAlign: "left", width: "100%",
                  background: isSelected ? "#0d1a1a" : "transparent",
                  border: `2px solid ${isSelected ? ACCENT : BORDER}`,
                  color: "#FFFFFF", transition: "all 0.12s",
                }}
              >
                <div style={{
                  width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", fontWeight: 700,
                  background: isSelected ? ACCENT : "#111",
                  color: isSelected ? "#000000" : TEXT,
                  border: `1px solid ${isSelected ? ACCENT : BORDER}`,
                  transition: "all 0.12s",
                }}>
                  {["A", "B", "C", "D"][i]}
                </div>
                <span style={{ fontSize: "14px", lineHeight: "1.4" }}>{opt}</span>
                {isSelected && (
                  <CheckCircle2 style={{ height: "16px", width: "16px", color: ACCENT, marginLeft: "auto", flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Next button */}
      <button
        onClick={handleNext}
        disabled={selected === null || submitting}
        style={{
          width: "100%", padding: "14px", borderRadius: "12px", fontSize: "15px", fontWeight: 700,
          cursor: selected !== null ? "pointer" : "not-allowed",
          background: selected !== null ? "#111" : "transparent",
          border: `1px solid ${selected !== null ? "#FFFFFF" : BORDER}`,
          color: selected !== null ? "#FFFFFF" : TEXT,
          opacity: submitting ? 0.7 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
          transition: "all 0.15s",
        }}
      >
        {submitting
          ? <><Loader2 style={{ height: "15px", width: "15px", animation: "spin 1s linear infinite" }} /> Submitting…</>
          : isLast
            ? <><CheckCircle2 style={{ height: "15px", width: "15px" }} /> Submit Quiz</>
            : <>Next Question <ChevronRight style={{ height: "15px", width: "15px" }} /></>
        }
      </button>
    </div>
  );
}

function QuizResults({ course, result, answers, questions, onRetry, onBack }: {
  course: AcademyCourse;
  result: QuizResult;
  answers: number[];
  questions: AcademyQuizQuestion[];
  onRetry: () => void;
  onBack: () => void;
}) {
  const pct = result.percentage ?? 0;
  const color = pct >= 80 ? SUCCESS : pct >= 60 ? "#F59E0B" : DANGER;
  const resultsList = result.results ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Score card */}
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`,
        borderRadius: "14px", padding: "28px 20px", textAlign: "center",
      }}>
        <div style={{ fontSize: "56px", fontWeight: 800, color, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: "6px" }}>
          {pct}%
        </div>
        <div style={{ fontSize: "16px", fontWeight: 600, color: "#FFFFFF", marginBottom: "5px" }}>
          {pct >= 80 ? "Excellent result" : pct >= 60 ? "Good effort" : "Keep practising"}
        </div>
        <div style={{ fontSize: "13px", color: TEXT }}>
          {result.score} / {result.totalQuestions} correct
        </div>
        {pct >= 80 && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "5px", marginTop: "14px",
            padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
            background: "#111", color: "#F59E0B", border: "1px solid #F59E0B40",
          }}>
            <Award style={{ height: "12px", width: "12px" }} /> +100 XP earned
          </div>
        )}
      </div>

      {/* Review */}
      {resultsList.length > 0 && (
        <div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: TEXT, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Answer Review
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {questions.map((q, i) => {
              const r = resultsList[i];
              if (!r) return null;
              return (
                <div key={q.id} style={{
                  background: CARD, border: `1px solid ${r.correct ? SUCCESS + "30" : DANGER + "30"}`,
                  borderRadius: "10px", padding: "13px 14px",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: r.correct ? 0 : "6px" }}>
                    {r.correct
                      ? <CheckCircle2 style={{ height: "15px", width: "15px", color: SUCCESS, flexShrink: 0, marginTop: "1px" }} />
                      : <XCircle style={{ height: "15px", width: "15px", color: DANGER, flexShrink: 0, marginTop: "1px" }} />
                    }
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "#FFFFFF", lineHeight: "1.4" }}>{q.question}</div>
                  </div>
                  {!r.correct && (
                    <div style={{ fontSize: "12px", color: SUCCESS, marginLeft: "23px", marginBottom: "5px" }}>
                      ✓ {(q.options ?? [])[r.correctIndex]}
                    </div>
                  )}
                  {r.explanation && (
                    <div style={{ fontSize: "12px", color: TEXT, marginLeft: "23px", lineHeight: "1.5", padding: "8px 10px", borderRadius: "7px", background: "#0f0f0f", border: `1px solid ${BORDER}` }}>
                      {r.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={onRetry} style={{
          display: "flex", alignItems: "center", gap: "5px", padding: "11px 16px", borderRadius: "10px",
          fontSize: "13px", fontWeight: 600, cursor: "pointer",
          background: "transparent", border: `1px solid ${BORDER}`, color: TEXT,
        }}>
          <RotateCcw style={{ height: "12px", width: "12px" }} /> Retry
        </button>
        <button onClick={onBack} style={{
          flex: 1, padding: "11px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
          cursor: "pointer", background: "#111", border: "1px solid #FFFFFF", color: "#FFFFFF",
        }}>
          Back to Quizzes
        </button>
      </div>
    </div>
  );
}

export function QuizzesTab({ courses, attempts, onAttemptsChange }: {
  courses: AcademyCourse[];
  attempts: AcademyQuizAttempt[];
  onAttemptsChange: (attempts: AcademyQuizAttempt[]) => void;
}) {
  const { token } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState<AcademyCourse | null>(null);
  const [questions, setQuestions] = useState<AcademyQuizQuestion[]>([]);
  const [loadingQuiz, setLoadingQuiz] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);

  const safeAttempts = attempts ?? [];
  const safeCourses = courses ?? [];

  async function startQuiz(course: AcademyCourse) {
    setLoadingQuiz(course.id);
    try {
      const r = await fetch(`${API_BASE}/api/academy/courses/${course.id}/quiz`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const qs = await r.json() as AcademyQuizQuestion[];
      if (!qs?.length) { setLoadingQuiz(null); return; }
      setQuestions(qs);
      setSelectedCourse(course);
      setQuizResult(null);
      setQuizAnswers([]);
    } catch { }
    setLoadingQuiz(null);
  }

  if (selectedCourse && questions.length > 0) {
    if (quizResult) {
      return (
        <QuizResults
          course={selectedCourse} result={quizResult} answers={quizAnswers} questions={questions}
          onRetry={() => setQuizResult(null)}
          onBack={() => { setSelectedCourse(null); setQuestions([]); setQuizResult(null); }}
        />
      );
    }
    return (
      <QuizRunner
        course={selectedCourse} questions={questions}
        onFinish={(r, a) => { setQuizResult(r); setQuizAnswers(a); }}
        onBack={() => { setSelectedCourse(null); setQuestions([]); }}
      />
    );
  }

  const bestScores = new Map<number, number>();
  for (const a of safeAttempts) {
    const pct = a.totalQuestions > 0 ? Math.round((a.score / a.totalQuestions) * 100) : 0;
    if (!bestScores.has(a.courseId) || bestScores.get(a.courseId)! < pct) bestScores.set(a.courseId, pct);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {safeAttempts.length > 0 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[
            { label: "Taken", value: safeAttempts.length },
            { label: "Best", value: `${Math.max(...safeAttempts.map(a => a.totalQuestions > 0 ? Math.round(a.score / a.totalQuestions * 100) : 0))}%` },
            { label: "Avg", value: `${Math.round(safeAttempts.reduce((s, a) => s + (a.totalQuestions > 0 ? a.score / a.totalQuestions : 0), 0) / safeAttempts.length * 100)}%` },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, padding: "12px 10px", borderRadius: "10px", background: CARD,
              border: `1px solid ${BORDER}`, textAlign: "center",
            }}>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF" }}>{s.value}</div>
              <div style={{ fontSize: "11px", color: TEXT, marginTop: "2px" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div>
        <div style={{ fontSize: "11px", fontWeight: 600, color: TEXT, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Available Quizzes
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {safeCourses.map(c => {
            const best = bestScores.get(c.id);
            const bestColor = best === undefined ? TEXT : best >= 80 ? SUCCESS : best >= 60 ? "#F59E0B" : DANGER;
            return (
              <div key={c.id} style={{
                background: CARD, border: `1px solid ${BORDER}`,
                borderRadius: "12px", padding: "14px 16px",
                display: "flex", alignItems: "center", gap: "12px",
              }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                  background: "#111", border: `1px solid ${BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <BookOpen style={{ height: "15px", width: "15px", color: TEXT }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.title}
                  </div>
                  <div style={{ fontSize: "11px", color: TEXT }}>{PATH_META[c.pathId]?.title ?? c.pathId}</div>
                </div>
                {best !== undefined && (
                  <div style={{ fontSize: "16px", fontWeight: 800, color: bestColor, flexShrink: 0 }}>{best}%</div>
                )}
                <button
                  onClick={() => startQuiz(c)}
                  disabled={loadingQuiz === c.id}
                  style={{
                    padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                    cursor: "pointer", flexShrink: 0,
                    background: best !== undefined ? "transparent" : "#111",
                    border: `1px solid ${best !== undefined ? BORDER : "#FFFFFF"}`,
                    color: best !== undefined ? TEXT : "#FFFFFF",
                    display: "flex", alignItems: "center", gap: "5px",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#111"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = best !== undefined ? "transparent" : "#111"}
                >
                  {loadingQuiz === c.id
                    ? <Loader2 style={{ height: "12px", width: "12px", animation: "spin 1s linear infinite" }} />
                    : best !== undefined
                      ? <RotateCcw style={{ height: "12px", width: "12px" }} />
                      : <Trophy style={{ height: "12px", width: "12px" }} />
                  }
                  {best !== undefined ? "Retry" : "Start"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
