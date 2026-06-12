import React, { useState, useRef } from "react";
import {
  CheckCircle2, XCircle, Clock, Trophy, Target, RotateCcw,
  ChevronRight, BookOpen, Loader2, Award,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";
import type { AcademyCourse, AcademyQuizQuestion, AcademyQuizAttempt } from "./types";
import { PATH_META } from "./types";

const C = { purple: "#a855f7", cyan: "#06b6d4", green: "#22c55e", amber: "#f59e0b", red: "#ef4444" };

interface QuizResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  results: Array<{ correct: boolean; correctIndex: number; explanation: string }>;
}

function QuizRunner({
  course,
  questions,
  onFinish,
  onBack,
}: {
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

  function handleSelect(idx: number) {
    if (selected !== null) return;
    setSelected(idx);
  }

  function handleNext() {
    if (selected === null) return;
    const newAnswers = [...answers, selected];

    if (currentQ < questions.length - 1) {
      setAnswers(newAnswers);
      setCurrentQ(q => q + 1);
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
      const result = await r.json() as QuizResult;
      onFinish(result, finalAnswers);
    } catch {
      onFinish({ score: 0, totalQuestions: questions.length, percentage: 0, results: [] }, finalAnswers);
    }
    setSubmitting(false);
  }

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>{course.thumbnailEmoji}</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "hsl(var(--foreground))" }}>{course.title}</div>
            <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>Question {currentQ + 1} of {questions.length}</div>
          </div>
        </div>
        <button onClick={onBack} style={{
          padding: "5px 12px", borderRadius: "8px", fontSize: "11px", cursor: "pointer",
          background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))",
        }}>
          Exit
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: "5px", borderRadius: "3px", background: "hsl(var(--muted))", marginBottom: "24px", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: "3px", width: `${progress}%`,
          background: `linear-gradient(90deg, ${C.purple}, ${C.cyan})`,
          transition: "width 0.4s ease",
        }} />
      </div>

      {/* Question */}
      <div style={{
        background: "var(--card-bg)", border: "1px solid hsl(var(--border))",
        borderRadius: "16px", padding: "24px", marginBottom: "16px",
      }}>
        <div style={{ fontSize: "15px", fontWeight: 600, color: "hsl(var(--foreground))", lineHeight: "1.5", marginBottom: "20px" }}>
          {q.question}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {q.options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrect = selected !== null && i === questions[currentQ].correctIndex;
            const isWrong = isSelected && i !== questions[currentQ].correctIndex;
            // We don't have correctIndex client-side yet (we stripped it), so show selected style only
            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "12px 16px", borderRadius: "12px", cursor: selected !== null ? "default" : "pointer",
                  textAlign: "left", width: "100%", transition: "all 0.15s ease",
                  background: isSelected ? `${C.purple}15` : "hsl(var(--muted))",
                  border: `1px solid ${isSelected ? C.purple + "50" : "hsl(var(--border))"}`,
                  color: "hsl(var(--foreground))",
                }}
              >
                <div style={{
                  width: "26px", height: "26px", borderRadius: "8px", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "11px", fontWeight: 700,
                  background: isSelected ? C.purple : "hsl(var(--border))",
                  color: isSelected ? "white" : "hsl(var(--muted-foreground))",
                }}>
                  {["A", "B", "C", "D"][i]}
                </div>
                <span style={{ fontSize: "13px" }}>{opt}</span>
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
          width: "100%", padding: "12px", borderRadius: "12px", fontSize: "13px", fontWeight: 600,
          cursor: selected !== null ? "pointer" : "not-allowed",
          background: selected !== null ? `linear-gradient(135deg, ${C.purple}, ${C.cyan})` : "hsl(var(--muted))",
          border: "none", color: selected !== null ? "white" : "hsl(var(--muted-foreground))",
          opacity: submitting ? 0.7 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
        }}
      >
        {submitting ? (
          <><Loader2 style={{ height: "13px", width: "13px", animation: "spin 1s linear infinite" }} /> Submitting...</>
        ) : currentQ < questions.length - 1 ? (
          <>Next Question <ChevronRight style={{ height: "13px", width: "13px" }} /></>
        ) : (
          <>Submit Quiz <CheckCircle2 style={{ height: "13px", width: "13px" }} /></>
        )}
      </button>
    </div>
  );
}

function QuizResults({
  course,
  result,
  answers,
  questions,
  onRetry,
  onBack,
}: {
  course: AcademyCourse;
  result: QuizResult;
  answers: number[];
  questions: AcademyQuizQuestion[];
  onRetry: () => void;
  onBack: () => void;
}) {
  const pct = result.percentage;
  const color = pct >= 80 ? C.green : pct >= 60 ? C.amber : C.red;

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Score card */}
      <div style={{
        border: `1px solid ${color}40`,
        borderRadius: "20px", padding: "30px", textAlign: "center",
        background: `linear-gradient(135deg, ${color}12, ${color}06)`,
      }}>
        <div style={{ fontSize: "52px", fontWeight: 800, color, letterSpacing: "-0.03em", marginBottom: "4px" }}>
          {pct}%
        </div>
        <div style={{ fontSize: "16px", fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: "8px" }}>
          {pct >= 80 ? "Excellent! 🎉" : pct >= 60 ? "Good job! 👍" : "Keep practicing! 💪"}
        </div>
        <div style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))" }}>
          {result.score} / {result.totalQuestions} correct answers
        </div>
        {pct >= 80 && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "12px",
            padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
            background: `${C.amber}20`, color: C.amber, border: `1px solid ${C.amber}40`,
          }}>
            <Award style={{ height: "13px", width: "13px" }} /> +100 XP earned
          </div>
        )}
      </div>

      {/* Answer review */}
      {result.results.length > 0 && (
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: "10px" }}>
            Review Answers
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {questions.map((q, i) => {
              const r = result.results[i];
              if (!r) return null;
              return (
                <div key={q.id} style={{
                  background: "var(--card-bg)", border: `1px solid ${r.correct ? C.green : C.red}30`,
                  borderRadius: "12px", padding: "14px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "6px" }}>
                    {r.correct
                      ? <CheckCircle2 style={{ height: "15px", width: "15px", color: C.green, flexShrink: 0, marginTop: "1px" }} />
                      : <XCircle style={{ height: "15px", width: "15px", color: C.red, flexShrink: 0, marginTop: "1px" }} />
                    }
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "hsl(var(--foreground))", lineHeight: "1.4" }}>{q.question}</div>
                  </div>
                  {!r.correct && (
                    <div style={{ fontSize: "12px", color: C.green, marginLeft: "23px", marginBottom: "4px" }}>
                      Correct: {q.options[r.correctIndex]}
                    </div>
                  )}
                  {r.explanation && (
                    <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginLeft: "23px", lineHeight: "1.5", background: "hsl(var(--muted))", padding: "6px 10px", borderRadius: "7px" }}>
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
          display: "flex", alignItems: "center", gap: "5px", padding: "9px 16px", borderRadius: "10px",
          fontSize: "12px", fontWeight: 600, cursor: "pointer",
          background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))",
        }}>
          <RotateCcw style={{ height: "12px", width: "12px" }} /> Retry
        </button>
        <button onClick={onBack} style={{
          flex: 1, padding: "9px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 600,
          cursor: "pointer", background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
          border: "none", color: "white",
        }}>
          Back to Quizzes
        </button>
      </div>
    </div>
  );
}

export function QuizzesTab({
  courses,
  attempts,
  onAttemptsChange,
}: {
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
      if (qs.length === 0) return;
      setQuestions(qs);
      setSelectedCourse(course);
      setQuizResult(null);
      setQuizAnswers([]);
    } catch { /* ignore */ }
    setLoadingQuiz(false);
  }

  function handleFinish(result: QuizResult, answers: number[]) {
    setQuizResult(result);
    setQuizAnswers(answers);
  }

  function handleBack() {
    setSelectedCourse(null);
    setQuestions([]);
    setQuizResult(null);
  }

  if (selectedCourse && questions.length > 0) {
    if (quizResult) {
      return (
        <QuizResults
          course={selectedCourse}
          result={quizResult}
          answers={quizAnswers}
          questions={questions}
          onRetry={() => { setQuizResult(null); }}
          onBack={handleBack}
        />
      );
    }
    return (
      <QuizRunner
        course={selectedCourse}
        questions={questions}
        onFinish={handleFinish}
        onBack={handleBack}
      />
    );
  }

  // Best score per course
  const bestScores = new Map<number, number>();
  for (const a of attempts) {
    const pct = Math.round((a.score / a.totalQuestions) * 100);
    if (!bestScores.has(a.courseId) || bestScores.get(a.courseId)! < pct) {
      bestScores.set(a.courseId, pct);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <p style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))", margin: 0 }}>
        Test your knowledge on any course. Score 80%+ to earn XP bonuses. Complete all quizzes in a path to unlock your certificate.
      </p>

      {/* Stats */}
      {attempts.length > 0 && (
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {[
            { label: "Quizzes Taken", value: attempts.length, color: C.purple },
            { label: "Best Score", value: `${Math.max(...attempts.map(a => Math.round(a.score / a.totalQuestions * 100)))}%`, color: C.green },
            { label: "Avg Score", value: `${Math.round(attempts.reduce((s, a) => s + (a.score / a.totalQuestions), 0) / attempts.length * 100)}%`, color: C.cyan },
          ].map(s => (
            <div key={s.label} style={{
              padding: "12px 18px", borderRadius: "12px", background: "var(--card-bg)",
              border: "1px solid hsl(var(--border))", textAlign: "center",
            }}>
              <div style={{ fontSize: "20px", fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Course quizzes grid */}
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: "12px" }}>
          Available Quizzes
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
          {courses.map(c => {
            const best = bestScores.get(c.id);
            const meta = PATH_META[c.pathId];
            return (
              <div
                key={c.id}
                style={{
                  background: "var(--card-bg)", border: "1px solid hsl(var(--border))",
                  borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "22px" }}>{c.thumbnailEmoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.title}
                    </div>
                    <div style={{ fontSize: "10px", color: meta.color }}>{meta.title}</div>
                  </div>
                  {best !== undefined && (
                    <div style={{
                      fontSize: "14px", fontWeight: 700,
                      color: best >= 80 ? C.green : best >= 60 ? C.amber : C.red,
                    }}>
                      {best}%
                    </div>
                  )}
                </div>
                <button
                  onClick={() => startQuiz(c)}
                  disabled={loadingQuiz}
                  style={{
                    width: "100%", padding: "8px", borderRadius: "9px", fontSize: "12px",
                    fontWeight: 600, cursor: "pointer",
                    background: best !== undefined ? "hsl(var(--muted))" : `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
                    border: `1px solid ${best !== undefined ? "hsl(var(--border))" : "none"}`,
                    color: best !== undefined ? "hsl(var(--muted-foreground))" : "white",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                  }}
                >
                  {loadingQuiz ? <Loader2 style={{ height: "12px", width: "12px", animation: "spin 1s linear infinite" }} /> : best !== undefined ? <RotateCcw style={{ height: "12px", width: "12px" }} /> : <Trophy style={{ height: "12px", width: "12px" }} />}
                  {best !== undefined ? "Retake Quiz" : "Start Quiz"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
