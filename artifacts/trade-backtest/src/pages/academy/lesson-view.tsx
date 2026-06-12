import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, CheckCircle2, Clock, BookOpen, ChevronRight,
  MessageSquare, X, Send, Loader2, Bot, User,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";
import type { AcademyLesson, AcademyCourse } from "./types";

const C = { purple: "#a855f7", cyan: "#06b6d4", green: "#22c55e", amber: "#f59e0b" };

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;margin:18px 0 8px;color:hsl(var(--foreground))">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:22px 0 10px;color:hsl(var(--foreground))">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:800;margin:0 0 16px;color:hsl(var(--foreground));letter-spacing:-0.03em">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700;color:hsl(var(--foreground))">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="font-family:monospace;font-size:12px;background:hsl(var(--muted));padding:1px 6px;border-radius:4px;color:hsl(var(--foreground))">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid ' + C.purple + ';padding:10px 16px;margin:14px 0;background:' + C.purple + '10;border-radius:0 8px 8px 0;font-style:italic;color:hsl(var(--foreground))">$1</blockquote>')
    .replace(/^\| (.+) \|$/gm, (line) => {
      if (line.includes('---')) return '';
      const cells = line.split('|').filter(c => c.trim()).map(c => `<td style="padding:7px 12px;border:1px solid hsl(var(--border));font-size:12px">${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, (rows) => `<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:12px">${rows}</table>`)
    .replace(/^✓ (.+)$/gm, '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13px"><span style="color:' + C.green + ';font-size:14px">✓</span>$1</div>')
    .replace(/^⚠️ (.+)$/gm, '<div style="padding:10px 14px;background:' + C.amber + '15;border:1px solid ' + C.amber + '30;border-radius:8px;margin:10px 0;font-size:12px;color:' + C.amber + '">⚠️ $1</div>')
    .replace(/^🔑 (.+)$/gm, '<div style="padding:12px 16px;background:' + C.purple + '12;border:1px solid ' + C.purple + '30;border-radius:10px;margin:14px 0;font-size:13px;font-weight:600;color:hsl(var(--foreground))">🔑 $1</div>')
    .replace(/^🎯 (.+)$/gm, '<div style="padding:12px 16px;background:' + C.cyan + '12;border:1px solid ' + C.cyan + '30;border-radius:10px;margin:14px 0;font-size:13px;font-weight:600;color:hsl(var(--foreground))">🎯 $1</div>')
    .replace(/^- (.+)$/gm, '<div style="display:flex;align-items:flex-start;gap:8px;margin:4px 0;padding-left:8px;font-size:13px"><span style="color:' + C.purple + ';margin-top:2px;flex-shrink:0">•</span><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm, (_, content, offset, str) => {
      const num = (str.slice(0, offset).match(/^\d+\. /gm) || []).length + 1;
      return `<div style="display:flex;align-items:flex-start;gap:8px;margin:4px 0;padding-left:8px;font-size:13px"><span style="color:${C.cyan};font-weight:600;flex-shrink:0;min-width:16px">${num}.</span><span>${content}</span></div>`;
    })
    .replace(/```[\s\S]*?```/g, (block) => {
      const code = block.replace(/```\w*\n?/, '').replace(/```$/, '');
      return `<pre style="background:hsl(var(--muted));padding:14px 16px;border-radius:10px;font-family:monospace;font-size:11px;overflow-x:auto;margin:12px 0;border:1px solid hsl(var(--border));white-space:pre-wrap">${code}</pre>`;
    })
    .replace(/\n\n/g, '<div style="height:10px"></div>')
    .replace(/\n/g, '<br/>');
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function AiTutorPanel({
  lesson, onClose, token,
}: { lesson: AcademyLesson; onClose: () => void; token: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hi! I'm your AI Tutor for **${lesson.title}**. Ask me anything about this lesson — I can explain concepts, give examples, quiz you, or summarize key points.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const QUICK_PROMPTS = [
    "Explain this simply",
    "Give me a real example",
    "Quiz me on this",
    "Summarize key points",
    "Common beginner mistakes?",
  ];

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/academy/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: userMsg,
          lessonContext: lesson.content.slice(0, 2000),
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await r.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? "Sorry, I couldn't respond." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", right: "20px", bottom: "20px",
      width: "360px", height: "520px",
      background: "var(--card-bg)", border: `1px solid ${C.purple}40`,
      borderRadius: "18px", boxShadow: `0 20px 60px rgba(0,0,0,0.4)`,
      display: "flex", flexDirection: "column", zIndex: 100,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid hsl(var(--border))",
        background: `linear-gradient(135deg, ${C.purple}15, ${C.cyan}08)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "30px", height: "30px", borderRadius: "9px",
            background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Bot style={{ height: "15px", width: "15px", color: "white" }} />
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "hsl(var(--foreground))" }}>AI Tutor</div>
            <div style={{ fontSize: "10px", color: C.purple }}>Lesson-specific help</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "hsl(var(--muted-foreground))" }}>
          <X style={{ height: "15px", width: "15px" }} />
        </button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && (
              <div style={{
                width: "24px", height: "24px", borderRadius: "7px", flexShrink: 0,
                background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Bot style={{ height: "12px", width: "12px", color: "white" }} />
              </div>
            )}
            <div style={{
              maxWidth: "80%", padding: "8px 12px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              background: m.role === "user" ? `linear-gradient(135deg, ${C.purple}, ${C.cyan})` : "hsl(var(--muted))",
              color: m.role === "user" ? "white" : "hsl(var(--foreground))",
              fontSize: "12px", lineHeight: "1.5",
            }}>
              {m.role === "assistant"
                ? <span dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                : m.content
              }
            </div>
            {m.role === "user" && (
              <div style={{
                width: "24px", height: "24px", borderRadius: "7px", flexShrink: 0,
                background: "hsl(var(--muted))", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <User style={{ height: "12px", width: "12px" }} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "7px", background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot style={{ height: "12px", width: "12px", color: "white" }} />
            </div>
            <div style={{ padding: "8px 12px", borderRadius: "14px 14px 14px 4px", background: "hsl(var(--muted))", display: "flex", gap: "4px", alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: "5px", height: "5px", borderRadius: "50%", background: C.purple,
                  animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "8px 12px", borderTop: "1px solid hsl(var(--border))" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
          {QUICK_PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              style={{
                padding: "3px 8px", borderRadius: "12px", fontSize: "10px", cursor: "pointer",
                background: `${C.purple}15`, border: `1px solid ${C.purple}30`,
                color: C.purple, fontWeight: 500,
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Ask anything..."
            style={{
              flex: 1, padding: "8px 12px", borderRadius: "10px", fontSize: "12px",
              background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))",
              color: "hsl(var(--foreground))", outline: "none",
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: "34px", height: "34px", borderRadius: "10px", flexShrink: 0,
              background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
              border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              opacity: !input.trim() || loading ? 0.5 : 1,
            }}
          >
            <Send style={{ height: "13px", width: "13px", color: "white" }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function LessonView({
  course,
  lesson,
  allLessons,
  onBack,
  onLessonSelect,
  onComplete,
}: {
  course: AcademyCourse;
  lesson: AcademyLesson;
  allLessons: AcademyLesson[];
  onBack: () => void;
  onLessonSelect: (l: AcademyLesson) => void;
  onComplete: (lessonId: number) => void;
}) {
  const { token } = useAuth();
  const [showAiTutor, setShowAiTutor] = useState(false);
  const [completing, setCompleting] = useState(false);
  const startRef = useRef(Date.now());

  async function handleComplete() {
    if (lesson.completed || completing) return;
    setCompleting(true);
    const mins = Math.round((Date.now() - startRef.current) / 60000);
    try {
      await fetch(`${API_BASE}/api/academy/lessons/${lesson.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ timeSpentMinutes: Math.max(1, mins) }),
      });
      onComplete(lesson.id);
    } catch { /* ignore */ }
    setCompleting(false);
  }

  const currentIdx = allLessons.findIndex(l => l.id === lesson.id);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px",
        flexWrap: "wrap",
      }}>
        <button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px",
            borderRadius: "10px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))",
            cursor: "pointer", color: "hsl(var(--muted-foreground))", fontSize: "12px",
          }}
        >
          <ArrowLeft style={{ height: "13px", width: "13px" }} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>
          <span style={{ fontSize: "16px" }}>{course.thumbnailEmoji}</span>
          <span>{course.title}</span>
          <ChevronRight style={{ height: "10px", width: "10px" }} />
          <span style={{ color: "hsl(var(--foreground))", fontWeight: 500 }}>{lesson.title}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        {/* Lesson list sidebar */}
        <div style={{
          width: "220px", flexShrink: 0,
          flexDirection: "column", gap: "4px",
          position: "sticky", top: "70px",
          display: "none", // hidden on mobile, shown on larger screens below
        }} className="lesson-sidebar">
          <div style={{ fontSize: "11px", fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Lessons
          </div>
          {allLessons.map((l, i) => (
            <button
              key={l.id}
              onClick={() => onLessonSelect(l)}
              style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px",
                borderRadius: "9px", cursor: "pointer", textAlign: "left", width: "100%",
                background: l.id === lesson.id ? `${C.purple}15` : "none",
                border: `1px solid ${l.id === lesson.id ? C.purple + "40" : "transparent"}`,
                color: l.id === lesson.id ? C.purple : "hsl(var(--muted-foreground))",
              }}
            >
              {l.completed
                ? <CheckCircle2 style={{ height: "12px", width: "12px", color: C.green, flexShrink: 0 }} />
                : <div style={{ width: "12px", height: "12px", borderRadius: "50%", border: "1.5px solid hsl(var(--border))", flexShrink: 0 }} />
              }
              <span style={{ fontSize: "11px", fontWeight: l.id === lesson.id ? 600 : 400 }}>{i + 1}. {l.title.split(":").pop()?.trim() ?? l.title}</span>
            </button>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Lesson meta */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>
              <Clock style={{ height: "11px", width: "11px" }} /> {lesson.estimatedMinutes} min read
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>
              <BookOpen style={{ height: "11px", width: "11px" }} /> Lesson {currentIdx + 1} of {allLessons.length}
            </span>
            {lesson.completed && (
              <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: C.green, background: `${C.green}15`, padding: "2px 8px", borderRadius: "10px" }}>
                <CheckCircle2 style={{ height: "10px", width: "10px" }} /> Completed
              </span>
            )}
          </div>

          {/* Content */}
          <div
            style={{
              background: "var(--card-bg)", border: "1px solid hsl(var(--border))",
              borderRadius: "16px", padding: "28px 32px",
              fontSize: "14px", lineHeight: "1.8", color: "hsl(var(--foreground))",
              marginBottom: "20px",
            }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.content) }}
          />

          {/* Action row */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {prevLesson && (
              <button onClick={() => onLessonSelect(prevLesson)} style={{
                display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px",
                borderRadius: "10px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))",
                cursor: "pointer", color: "hsl(var(--muted-foreground))", fontSize: "12px",
              }}>
                ← Previous
              </button>
            )}
            {!lesson.completed ? (
              <button
                onClick={handleComplete}
                disabled={completing}
                style={{
                  display: "flex", alignItems: "center", gap: "6px", padding: "9px 20px",
                  borderRadius: "10px", fontSize: "13px", fontWeight: 600,
                  background: `linear-gradient(135deg, ${C.green}, #16a34a)`,
                  border: "none", cursor: "pointer", color: "white",
                  opacity: completing ? 0.7 : 1,
                }}
              >
                {completing ? <Loader2 style={{ height: "13px", width: "13px", animation: "spin 1s linear infinite" }} /> : <CheckCircle2 style={{ height: "13px", width: "13px" }} />}
                Mark Complete & Continue
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: C.green, padding: "9px 16px", background: `${C.green}15`, borderRadius: "10px" }}>
                <CheckCircle2 style={{ height: "13px", width: "13px" }} /> Lesson Complete
              </div>
            )}
            {nextLesson && (
              <button onClick={() => onLessonSelect(nextLesson)} style={{
                display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px",
                borderRadius: "10px", background: `${C.purple}15`, border: `1px solid ${C.purple}30`,
                cursor: "pointer", color: C.purple, fontSize: "12px", fontWeight: 600,
              }}>
                Next → 
              </button>
            )}
            <button
              onClick={() => setShowAiTutor(s => !s)}
              style={{
                marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px",
                padding: "9px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 600,
                background: showAiTutor ? `${C.purple}20` : "hsl(var(--muted))",
                border: `1px solid ${showAiTutor ? C.purple + "40" : "hsl(var(--border))"}`,
                cursor: "pointer", color: showAiTutor ? C.purple : "hsl(var(--muted-foreground))",
              }}
            >
              <MessageSquare style={{ height: "13px", width: "13px" }} />
              AI Tutor
            </button>
          </div>
        </div>
      </div>

      {showAiTutor && (
        <AiTutorPanel lesson={lesson} onClose={() => setShowAiTutor(false)} token={token} />
      )}
    </div>
  );
}
