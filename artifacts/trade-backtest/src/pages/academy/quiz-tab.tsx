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
  results: Array<{ correct: boolean; correctIndex: number; explanation: string }>;
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

  const progress = (currentQ / questions.length) * 100;

  function handleNext() {
    if (selected === null) return;
    const newAnswers = [...answers, selected];
    if (currentQ < questions.length - 1) {
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
    <div style={{ maxWidth: "580px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF" }}>{course.title}</div>
          <div style={{ fontSize: "11px", color: TEXT }}>Question {currentQ + 1} of {questions.length}</div>
        </div>
        <button onClick={onBack} style={{
          padding: "5px 12px", borderRadius: "6px", fontSize: "11px", cursor: "pointer",
          background: "transparent", border: `1px solid ${BORDER}`, color: TEXT,
        }}>
          Exit
        </button>
      </div>

      {/* Progress */}
      <div style={{ height: "2px", borderRadius: "1px", background: "#262626", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: ACCENT, transition: "width 0.4s" }} />
      </div>

      {/* Question */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "22px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF", lineHeight: "1.5", marginBottom: "18px" }}>
          {q.question}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {q.options.map((opt, i) => {
            const isSelected = selected === i;
            return (
              <button
                key={i}
                onClick={() => { if (selected === null) setSelected(i); }}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "11px 14px", borderRadius: "8px",
                  cursor: selected !== null ? "default" : "pointer",
                  textAlign: "left", width: "100%", transition: "all 0.12s",
                  background: isSelected ? "#111111" : "transparent",
                  border: `1px solid ${isSelected ? ACCENT : BORDER}`,
                  color: "#FFFFFF",
                }}
                onMouseEnter={e => { if (selected === null) (e.currentTarget as HTMLElement).style.borderColor = "#3a3a3a"; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
              >
                <div style={{
                  width: "24px", height: "24px", borderRadius: "6px", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "11px", fontWeight: 700,
                  background: isSelected ? ACCENT : "#111111",
                  color: isSelected ? "#000000" : TEXT,
                  border: `1px solid ${isSelected ? ACCENT : BORDER}`,
                }}>
                  {["A", "B", "C", "D"][i]}
                </div>
                <span style={{ fontSize: "13px" }}>{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleNext}
        disabled={selected === null || submitting}
        style={{
          width: "100%", padding: "11px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
          cursor: selected !== null ? "pointer" : "not-allowed",
          background: selected !== null ? "#111111" : "transparent",
          border: `1px solid ${selected !== null ? "#FFFFFF" : BORDER}`,
          color: selected !== null ? "#FFFFFF" : TEXT,
          opacity: submitting ? 0.7 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          transition: "all 0.15s",
        }}
      >
        {submitting ? (
          <><Loader2 style={{ height: "13px", width: "13px", animation: "spin 1s linear infinite" }} /> Submitting…</>
        ) : currentQ < questions.length - 1 ? (
          <>Next Question <ChevronRight style={{ height: "13px", width: "13px" }} /></>
        ) : (
          <>Submit Quiz <CheckCircle2 style={{ height: "13px", width: "13px" }} /></>
        )}
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
  const pct = result.percentage;
  const color = pct >= 80 ? SUCCESS : pct >= 60 ? "#F59E0B" : DANGER;

  return (
    <div style={{ maxWidth: "580px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{
        border: `1px solid ${BORDER}`,
        borderRadius: "10px", padding: "28px", textAlign: "center",
        background: CARD,
      }}>
        <div style={{ fontSize: "48px", fontWeight: 800, color, letterSpacing: "-0.04em", marginBottom: "4px" }}>
          {pct}%
        </div>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF", marginBottom: "6px" }}>
          {pct >= 80 ? "Excellent result" : pct >= 60 ? "Good effort" : "Keep practising"}
        </div>
        <div style={{ fontSize: "12px", color: TEXT }}>
          {result.score} / {result.totalQuestions} correct
        </div>
        {pct >= 80 && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "5px", marginTop: "12px",
            padding: "5px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
            background: "#111111", color: "#F59E0B", border: "1px solid #F59E0B40",
          }}>
            <Award style={{ height: "11px", width: "11px" }} /> +100 XP earned
          </div>
        )}
      </div>

      {result.results.length > 0 && (
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: TEXT, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Review Answers
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {questions.map((q, i) => {
              const r = result.results[i];
              if (!r) return null;
              return (
                <div key={q.id} style={{
                  background: CARD, border: `1px solid ${r.correct ? SUCCESS + "30" : DANGER + "30"}`,
                  borderRadius: "8px", padding: "12px 14px",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
                    {r.correct
                      ? <CheckCircle2 style={{ height: "14px", width: "14px", color: SUCCESS, flexShrink: 0, marginTop: "1px" }} />
                      : <XCircle style={{ height: "14px", width: "14px", color: DANGER, flexShrink: 0, marginTop: "1px" }} />
                    }
                    <div style={{ fontSize: "12px", fontWeight: 500, color: "#FFFFFF", lineHeight: "1.4" }}>{q.question}</div>
                  </div>
                  {!r.correct && (
                    <div style={{ fontSize: "11px", color: SUCCESS, marginLeft: "22px", marginBottom: "4px" }}>
                      Correct: {q.options[r.correctIndex]}
                    </div>
                  )}
                  {r.explanation && (
                    <div style={{ fontSize: "11px", color: TEXT, marginLeft: "22px", lineHeight: "1.5", padding: "6px 10px", borderRadius: "6px", background: "#0f0f0f", border: `1px solid ${BORDER}` }}>
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
          display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "8px",
          fontSize: "12px", fontWeight: 600, cursor: "pointer",
          background: "transparent", border: `1px solid ${BORDER}`, color: TEXT,
        }}>
          <RotateCcw style={{ height: "11px", width: "11px" }} /> Retry
        </button>
        <button onClick={onBack} style={{
          flex: 1, padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
          cursor: "pointer", background: "#111111", border: "1px solid #FFFFFF", color: "#FFFFFF",
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
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);

  async function startQuiz(course: AcademyCourse) {
    setLoadingQuiz(true);
    try {
      const r = await fetch(`${API_BASE}/api/academy/courses/${course.id}/quiz`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const qs = await r.json() as AcademyQuizQuestion[];
      if (!qs.length) { setLoadingQuiz(false); return; }
      setQuestions(qs);
      setSelectedCourse(course);
      setQuizResult(null);
      setQuizAnswers([]);
    } catch { }
    setLoadingQuiz(false);
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
  for (const a of attempts) {
    const pct = Math.round((a.score / a.totalQuestions) * 100);
    if (!bestScores.has(a.courseId) || bestScores.get(a.courseId)! < pct) bestScores.set(a.courseId, pct);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {attempts.length > 0 && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            { label: "Quizzes Taken", value: attempts.length },
            { label: "Best Score", value: `${Math.max(...attempts.map(a => Math.round(a.score / a.totalQuestions * 100)))}%` },
            { label: "Avg Score", value: `${Math.round(attempts.reduce((s, a) => s + (a.score / a.totalQuestions), 0) / attempts.length * 100)}%` },
          ].map(s => (
            <div key={s.label} style={{
              padding: "12px 16px", borderRadius: "10px", background: CARD,
              border: `1px solid ${BORDER}`, textAlign: "center",
            }}>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#FFFFFF" }}>{s.value}</div>
              <div style={{ fontSize: "10px", color: TEXT, marginTop: "2px" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div>
        <div style={{ fontSize: "11px", fontWeight: 600, color: TEXT, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Available Quizzes
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "8px" }}>
          {courses.map(c => {
            const best = bestScores.get(c.id);
            const bestColor = best === undefined ? TEXT : best >= 80 ? SUCCESS : best >= 60 ? "#F59E0B" : DANGER;
            return (
              <div key={c.id} style={{
                background: CARD, border: `1px solid ${BORDER}`,
                borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "30px", height: "30px", borderRadius: "7px", flexShrink: 0,
                    background: "#111111", border: `1px solid ${BORDER}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <BookOpen style={{ height: "13px", width: "13px", color: TEXT }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.title}
                    </div>
                    <div style={{ fontSize: "10px", color: TEXT }}>{PATH_META[c.pathId]?.title ?? c.pathId}</div>
                  </div>
                  {best !== undefined && (
                    <div style={{ fontSize: "14px", fontWeight: 700, color: bestColor, flexShrink: 0 }}>
                      {best}%
                    </div>
                  )}
                </div>
                <button
                  onClick={() => startQuiz(c)}
                  disabled={loadingQuiz}
                  style={{
                    width: "100%", padding: "7px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                    background: "transparent",
                    border: `1px solid ${best !== undefined ? BORDER : "#FFFFFF"}`,
                    color: best !== undefined ? TEXT : "#FFFFFF",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#111111"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {loadingQuiz ? <Loader2 style={{ height: "11px", width: "11px", animation: "spin 1s linear infinite" }} /> : best !== undefined ? <RotateCcw style={{ height: "11px", width: "11px" }} /> : <Trophy style={{ height: "11px", width: "11px" }} />}
                  {best !== undefined ? "Retake" : "Start Quiz"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
