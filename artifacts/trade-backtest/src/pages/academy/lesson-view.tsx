import React, { useState, useRef } from "react";
import {
  ArrowLeft, CheckCircle2, Clock, BookOpen, ChevronRight,
  MessageSquare, X, Send, Loader2, Bot, User,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";
import type { AcademyLesson, AcademyCourse } from "./types";

const ACCENT = "#22D3EE";
const SUCCESS = "#84CC16";
const BORDER = "#262626";
const CARD = "#171717";
const TEXT = "#A1A1AA";

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, `<h3 style="font-size:14px;font-weight:700;margin:18px 0 8px;color:#FFFFFF">$1</h3>`)
    .replace(/^## (.+)$/gm, `<h2 style="font-size:16px;font-weight:700;margin:22px 0 10px;color:#FFFFFF">$1</h2>`)
    .replace(/^# (.+)$/gm, `<h1 style="font-size:20px;font-weight:800;margin:0 0 16px;color:#FFFFFF;letter-spacing:-0.03em">$1</h1>`)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="font-weight:700;color:#FFFFFF">$1</strong>`)
    .replace(/\*(.+?)\*/g, `<em>$1</em>`)
    .replace(/\`(.+?)\`/g, `<code style="font-family:monospace;font-size:12px;background:#111;padding:1px 6px;border-radius:4px;border:1px solid #262626;color:#E5E5E5">$1</code>`)
    .replace(/^> (.+)$/gm, `<blockquote style="border-left:2px solid ${ACCENT};padding:10px 16px;margin:14px 0;background:#111111;border-radius:0 6px 6px 0;font-style:italic;color:${TEXT}">$1</blockquote>`)
    .replace(/^\| (.+) \|$/gm, (line) => {
      if (line.includes("---")) return "";
      const cells = line.split("|").filter(c => c.trim()).map(c => `<td style="padding:7px 12px;border:1px solid #262626;font-size:12px;color:${TEXT}">${c.trim()}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, rows => `<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:12px">${rows}</table>`)
    .replace(/^✓ (.+)$/gm, `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13px"><span style="color:${SUCCESS}">✓</span>$1</div>`)
    .replace(/^⚠️ (.+)$/gm, `<div style="padding:10px 14px;background:#F59E0B15;border:1px solid #F59E0B30;border-radius:8px;margin:10px 0;font-size:12px;color:#F59E0B">⚠️ $1</div>`)
    .replace(/^- (.+)$/gm, `<div style="display:flex;align-items:flex-start;gap:8px;margin:4px 0;padding-left:8px;font-size:13px"><span style="color:${ACCENT};margin-top:2px;flex-shrink:0">·</span><span>$1</span></div>`)
    .replace(/^\d+\. (.+)$/gm, (_, content, offset, str) => {
      const num = (str.slice(0, offset).match(/^\d+\. /gm) ?? []).length + 1;
      return `<div style="display:flex;align-items:flex-start;gap:8px;margin:4px 0;padding-left:8px;font-size:13px"><span style="color:${ACCENT};font-weight:600;flex-shrink:0;min-width:16px">${num}.</span><span>${content}</span></div>`;
    })
    .replace(/```[\s\S]*?```/g, block => {
      const code = block.replace(/```\w*\n?/, "").replace(/```$/, "");
      return `<pre style="background:#111111;padding:14px 16px;border-radius:8px;font-family:monospace;font-size:11px;overflow-x:auto;margin:12px 0;border:1px solid #262626;white-space:pre-wrap;color:#E5E5E5">${code}</pre>`;
    })
    .replace(/\n\n/g, `<div style="height:10px"></div>`)
    .replace(/\n/g, "<br/>");
}

interface ChatMessage { role: "user" | "assistant"; content: string; }

function AiTutorPanel({ lesson, onClose, token }: {
  lesson: AcademyLesson; onClose: () => void; token: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hi — I'm your AI Tutor for **${lesson.title}**. Ask me anything about this lesson — I can explain concepts, give examples, or quiz you.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const QUICK_PROMPTS = ["Explain this simply", "Give me a real example", "Quiz me on this", "Summarize key points"];

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
      width: "340px", height: "500px",
      background: "#0A0A0A", border: `1px solid ${BORDER}`,
      borderRadius: "12px", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      display: "flex", flexDirection: "column", zIndex: 100,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${BORDER}`, background: CARD,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "7px",
            background: "#111111", border: `1px solid ${BORDER}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Bot style={{ height: "13px", width: "13px", color: ACCENT }} />
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#FFFFFF" }}>AI Tutor</div>
            <div style={{ fontSize: "10px", color: TEXT }}>Lesson-specific help</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: TEXT }}>
          <X style={{ height: "14px", width: "14px" }} />
        </button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "8px", background: "#0f0f0f" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: "7px", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && (
              <div style={{ width: "24px", height: "24px", borderRadius: "6px", flexShrink: 0, background: "#111111", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bot style={{ height: "11px", width: "11px", color: ACCENT }} />
              </div>
            )}
            <div style={{
              maxWidth: "80%", padding: "8px 11px",
              borderRadius: m.role === "user" ? "10px 10px 3px 10px" : "10px 10px 10px 3px",
              background: m.role === "user" ? "#1a1a1a" : CARD,
              border: `1px solid ${BORDER}`,
              color: "#FFFFFF", fontSize: "12px", lineHeight: "1.5",
            }}>
              {m.role === "assistant"
                ? <span dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#FFFFFF">$1</strong>') }} />
                : m.content
              }
            </div>
            {m.role === "user" && (
              <div style={{ width: "24px", height: "24px", borderRadius: "6px", flexShrink: 0, background: "#111111", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User style={{ height: "11px", width: "11px", color: TEXT }} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: "7px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "#111111", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot style={{ height: "11px", width: "11px", color: ACCENT }} />
            </div>
            <div style={{ padding: "8px 11px", borderRadius: "10px 10px 10px 3px", background: CARD, border: `1px solid ${BORDER}`, display: "flex", gap: "3px", alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: "4px", height: "4px", borderRadius: "50%", background: TEXT, animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "8px 10px", borderTop: `1px solid ${BORDER}`, background: CARD }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "6px" }}>
          {QUICK_PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              style={{
                padding: "3px 8px", borderRadius: "5px", fontSize: "10px", cursor: "pointer",
                background: "transparent", border: `1px solid ${BORDER}`, color: TEXT,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FFFFFF"; (e.currentTarget as HTMLElement).style.borderColor = "#3a3a3a"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = TEXT; (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
            >
              {p}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendMessage(input); } }}
            placeholder="Ask anything…"
            style={{
              flex: 1, padding: "7px 10px", borderRadius: "6px", fontSize: "12px",
              background: "#111111", border: `1px solid ${BORDER}`,
              color: "#FFFFFF", outline: "none",
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: "32px", height: "32px", borderRadius: "6px", flexShrink: 0,
              background: input.trim() ? ACCENT : "#111111",
              border: `1px solid ${input.trim() ? ACCENT : BORDER}`,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              opacity: !input.trim() || loading ? 0.5 : 1,
            }}
          >
            <Send style={{ height: "12px", width: "12px", color: input.trim() ? "#000" : TEXT }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function LessonView({ course, lesson, allLessons, onBack, onLessonSelect, onComplete }: {
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
    } catch { }
    setCompleting(false);
  }

  const currentIdx = allLessons.findIndex(l => l.id === lesson.id);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px",
            borderRadius: "8px", background: "transparent", border: `1px solid ${BORDER}`,
            cursor: "pointer", color: TEXT, fontSize: "12px",
            transition: "color 0.12s, border-color 0.12s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FFFFFF"; (e.currentTarget as HTMLElement).style.borderColor = "#3a3a3a"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = TEXT; (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
        >
          <ArrowLeft style={{ height: "12px", width: "12px" }} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: TEXT }}>
          <BookOpen style={{ height: "12px", width: "12px" }} />
          <span>{course.title}</span>
          <ChevronRight style={{ height: "10px", width: "10px" }} />
          <span style={{ color: "#FFFFFF", fontWeight: 500 }}>{lesson.title}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        {/* Sidebar */}
        <div style={{ width: "200px", flexShrink: 0, position: "sticky", top: "70px", display: "flex", flexDirection: "column", gap: "3px" }}>
          <div style={{ fontSize: "10px", fontWeight: 600, color: TEXT, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Lessons
          </div>
          {allLessons.map((l, i) => (
            <button
              key={l.id}
              onClick={() => onLessonSelect(l)}
              style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "7px 9px",
                borderRadius: "6px", cursor: "pointer", textAlign: "left", width: "100%",
                background: l.id === lesson.id ? "#111111" : "transparent",
                border: `1px solid ${l.id === lesson.id ? BORDER : "transparent"}`,
                color: l.id === lesson.id ? "#FFFFFF" : TEXT,
                transition: "all 0.1s",
              }}
              onMouseEnter={e => { if (l.id !== lesson.id) (e.currentTarget as HTMLElement).style.background = "#0d0d0d"; }}
              onMouseLeave={e => { if (l.id !== lesson.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {l.completed
                ? <CheckCircle2 style={{ height: "11px", width: "11px", color: SUCCESS, flexShrink: 0 }} />
                : <div style={{ width: "11px", height: "11px", borderRadius: "50%", border: `1.5px solid ${BORDER}`, flexShrink: 0 }} />
              }
              <span style={{ fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {i + 1}. {l.title.split(":").pop()?.trim() ?? l.title}
              </span>
            </button>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Meta */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: TEXT }}>
              <Clock style={{ height: "11px", width: "11px" }} /> {lesson.estimatedMinutes} min
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: TEXT }}>
              <BookOpen style={{ height: "11px", width: "11px" }} /> {currentIdx + 1} / {allLessons.length}
            </span>
            {lesson.completed && (
              <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: SUCCESS, padding: "2px 8px", borderRadius: "4px", background: "#111111", border: `1px solid ${SUCCESS}40` }}>
                <CheckCircle2 style={{ height: "10px", width: "10px" }} /> Completed
              </span>
            )}
          </div>

          {/* Content */}
          <div
            style={{
              background: CARD, border: `1px solid ${BORDER}`,
              borderRadius: "10px", padding: "28px 32px",
              fontSize: "14px", lineHeight: "1.8", color: TEXT,
              marginBottom: "18px",
            }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.content) }}
          />

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {prevLesson && (
              <button onClick={() => onLessonSelect(prevLesson)} style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px",
                borderRadius: "7px", background: "transparent", border: `1px solid ${BORDER}`,
                cursor: "pointer", color: TEXT, fontSize: "12px",
                transition: "color 0.12s, border-color 0.12s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FFFFFF"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = TEXT; }}
              >
                ← Prev
              </button>
            )}

            {!lesson.completed ? (
              <button
                onClick={handleComplete}
                disabled={completing}
                style={{
                  display: "flex", alignItems: "center", gap: "6px", padding: "8px 18px",
                  borderRadius: "7px", fontSize: "12px", fontWeight: 600,
                  background: "#111111", border: `1px solid ${SUCCESS}`,
                  cursor: "pointer", color: SUCCESS, opacity: completing ? 0.7 : 1,
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#0f1a0d")}
                onMouseLeave={e => (e.currentTarget.style.background = "#111111")}
              >
                {completing ? <Loader2 style={{ height: "12px", width: "12px", animation: "spin 1s linear infinite" }} /> : <CheckCircle2 style={{ height: "12px", width: "12px" }} />}
                Mark Complete
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: SUCCESS, padding: "8px 14px", border: `1px solid ${SUCCESS}40`, borderRadius: "7px", background: "#111111" }}>
                <CheckCircle2 style={{ height: "12px", width: "12px" }} /> Complete
              </div>
            )}

            {nextLesson && (
              <button onClick={() => onLessonSelect(nextLesson)} style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px",
                borderRadius: "7px", background: "transparent", border: `1px solid ${BORDER}`,
                cursor: "pointer", color: TEXT, fontSize: "12px",
                transition: "color 0.12s, border-color 0.12s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FFFFFF"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = TEXT; }}
              >
                Next →
              </button>
            )}

            <button
              onClick={() => setShowAiTutor(s => !s)}
              style={{
                marginLeft: "auto", display: "flex", alignItems: "center", gap: "5px",
                padding: "8px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 500,
                background: showAiTutor ? "#111111" : "transparent",
                border: `1px solid ${showAiTutor ? ACCENT : BORDER}`,
                cursor: "pointer", color: showAiTutor ? ACCENT : TEXT,
                transition: "all 0.12s",
              }}
            >
              <MessageSquare style={{ height: "12px", width: "12px" }} />
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
