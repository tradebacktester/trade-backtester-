import React, { useState, useRef } from "react";
import {
  ArrowLeft, CheckCircle2, Clock, BookOpen, ChevronDown,
  MessageSquare, X, Send, Loader2, Bot, User, Menu,
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
  if (!text) return "";
  return text
    .replace(/^### (.+)$/gm, `<h3 style="font-size:15px;font-weight:700;margin:18px 0 8px;color:#FFFFFF">$1</h3>`)
    .replace(/^## (.+)$/gm, `<h2 style="font-size:17px;font-weight:700;margin:22px 0 10px;color:#FFFFFF">$1</h2>`)
    .replace(/^# (.+)$/gm, `<h1 style="font-size:21px;font-weight:800;margin:0 0 16px;color:#FFFFFF;letter-spacing:-0.03em">$1</h1>`)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="font-weight:700;color:#FFFFFF">$1</strong>`)
    .replace(/\*(.+?)\*/g, `<em>$1</em>`)
    .replace(/`(.+?)`/g, `<code style="font-family:monospace;font-size:12px;background:#111;padding:1px 6px;border-radius:4px;border:1px solid #262626;color:#E5E5E5">$1</code>`)
    .replace(/^> (.+)$/gm, `<blockquote style="border-left:2px solid ${ACCENT};padding:10px 16px;margin:14px 0;background:#111111;border-radius:0 6px 6px 0;font-style:italic;color:${TEXT}">$1</blockquote>`)
    .replace(/^- (.+)$/gm, `<div style="display:flex;align-items:flex-start;gap:8px;margin:5px 0;padding-left:8px;font-size:14px"><span style="color:${ACCENT};margin-top:3px;flex-shrink:0">·</span><span>$1</span></div>`)
    .replace(/```[\s\S]*?```/g, block => {
      const code = block.replace(/```\w*\n?/, "").replace(/```$/, "");
      return `<pre style="background:#111111;padding:14px 16px;border-radius:8px;font-family:monospace;font-size:12px;overflow-x:auto;margin:12px 0;border:1px solid #262626;white-space:pre-wrap;color:#E5E5E5">${code}</pre>`;
    })
    .replace(/\n\n/g, `<div style="height:10px"></div>`)
    .replace(/\n/g, "<br/>");
}

interface ChatMsg { role: "user" | "assistant"; content: string; }

function AiTutorPanel({ lesson, onClose, token }: {
  lesson: AcademyLesson; onClose: () => void; token: string | null;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "assistant", content: `I'm your AI Tutor for **${lesson.title}**. Ask me anything — I can explain, give examples, or quiz you.` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  const QUICK = ["Explain simply", "Give example", "Quiz me", "Key points"];

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const msg = text.trim();
    setInput("");
    setMsgs(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/academy/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: msg,
          lessonContext: lesson.content?.slice(0, 2000) ?? "",
          history: msgs.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await r.json();
      setMsgs(prev => [...prev, { role: "assistant", content: data.reply ?? "Sorry, couldn't respond." }]);
    } catch {
      setMsgs(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    }
    setLoading(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      display: "flex", flexDirection: "column",
      background: "#0A0A0A",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px",
        borderBottom: `1px solid ${BORDER}`, background: CARD, flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", color: TEXT, display: "flex" }}>
          <ArrowLeft style={{ height: "18px", width: "18px" }} />
        </button>
        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#111", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bot style={{ height: "15px", width: "15px", color: ACCENT }} />
        </div>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>AI Tutor</div>
          <div style={{ fontSize: "11px", color: TEXT }}>{lesson.title}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "5px" }}>
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: SUCCESS }} />
          <span style={{ fontSize: "11px", color: TEXT }}>Online</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: "9px", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end" }}>
            {m.role === "assistant" && (
              <div style={{ width: "30px", height: "30px", borderRadius: "8px", flexShrink: 0, background: "#111", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bot style={{ height: "13px", width: "13px", color: ACCENT }} />
              </div>
            )}
            <div style={{
              maxWidth: "80%", padding: "11px 14px",
              borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: m.role === "user" ? "#1C1C1E" : CARD,
              border: `1px solid ${m.role === "user" ? "#333" : BORDER}`,
              color: "#FFFFFF", fontSize: "14px", lineHeight: "1.6",
            }}>
              {m.role === "assistant"
                ? <span dangerouslySetInnerHTML={{ __html: m.content.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#FFFFFF">$1</strong>').replace(/\n/g, "<br/>") }} />
                : m.content}
            </div>
            {m.role === "user" && (
              <div style={{ width: "30px", height: "30px", borderRadius: "8px", flexShrink: 0, background: "#111", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User style={{ height: "13px", width: "13px", color: TEXT }} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: "9px", alignItems: "flex-end" }}>
            <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "#111", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot style={{ height: "13px", width: "13px", color: ACCENT }} />
            </div>
            <div style={{ padding: "11px 16px", borderRadius: "16px 16px 16px 4px", background: CARD, border: `1px solid ${BORDER}`, display: "flex", gap: "5px", alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: TEXT, animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div style={{ padding: "8px 14px 0", display: "flex", gap: "6px", flexWrap: "wrap", flexShrink: 0 }}>
        {QUICK.map(p => (
          <button key={p} onClick={() => send(p)} style={{
            padding: "6px 12px", borderRadius: "20px", fontSize: "12px",
            background: "#111", border: `1px solid ${BORDER}`, color: TEXT, cursor: "pointer",
            transition: "border-color 0.12s",
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "#444")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: "10px 14px 20px", display: "flex", gap: "8px", alignItems: "flex-end", flexShrink: 0 }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "flex-end", gap: "8px",
          background: "#1C1C1E", border: `1px solid ${BORDER}`,
          borderRadius: "20px", padding: "8px 14px",
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Message AI Tutor…"
            rows={1}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "#FFFFFF", fontSize: "15px", resize: "none",
              lineHeight: "1.4", maxHeight: "100px", fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            style={{
              width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
              background: input.trim() && !loading ? ACCENT : "#333",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
          >
            {loading
              ? <Loader2 style={{ height: "14px", width: "14px", color: "#000", animation: "spin 1s linear infinite" }} />
              : <Send style={{ height: "14px", width: "14px", color: input.trim() ? "#000" : TEXT }} />
            }
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
  const [showLessonList, setShowLessonList] = useState(false);
  const [completing, setCompleting] = useState(false);
  const startRef = useRef(Date.now());

  const safeAllLessons = allLessons ?? [];
  const currentIdx = safeAllLessons.findIndex(l => l.id === lesson.id);
  const prevLesson = currentIdx > 0 ? safeAllLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < safeAllLessons.length - 1 ? safeAllLessons[currentIdx + 1] : null;

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

  if (showAiTutor) {
    return <AiTutorPanel lesson={lesson} onClose={() => setShowAiTutor(false)} token={token} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: "5px", padding: "8px 12px",
          borderRadius: "8px", background: "transparent", border: `1px solid ${BORDER}`,
          cursor: "pointer", color: TEXT, fontSize: "13px",
        }}>
          <ArrowLeft style={{ height: "13px", width: "13px" }} /> Back
        </button>

        <button onClick={() => setShowLessonList(s => !s)} style={{
          display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px",
          borderRadius: "8px", background: showLessonList ? "#111" : "transparent",
          border: `1px solid ${showLessonList ? ACCENT : BORDER}`,
          cursor: "pointer", color: showLessonList ? ACCENT : TEXT, fontSize: "13px",
        }}>
          <Menu style={{ height: "13px", width: "13px" }} />
          Lessons
          <span style={{ fontSize: "11px", color: TEXT }}>
            {currentIdx + 1}/{safeAllLessons.length}
          </span>
          <ChevronDown style={{
            height: "11px", width: "11px",
            transform: showLessonList ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: TEXT }}>
          <Clock style={{ height: "11px", width: "11px" }} /> {lesson.estimatedMinutes}m
        </div>

        {lesson.completed && (
          <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: SUCCESS, padding: "4px 10px", borderRadius: "6px", background: "#111", border: `1px solid ${SUCCESS}40` }}>
            <CheckCircle2 style={{ height: "10px", width: "10px" }} /> Done
          </span>
        )}

        <button onClick={() => setShowAiTutor(true)} style={{
          marginLeft: "auto", display: "flex", alignItems: "center", gap: "5px",
          padding: "8px 12px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
          background: "transparent", border: `1px solid ${BORDER}`, cursor: "pointer", color: TEXT,
        }}>
          <MessageSquare style={{ height: "12px", width: "12px" }} /> AI
        </button>
      </div>

      {/* Lesson list drawer */}
      {showLessonList && (
        <div style={{
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px",
          padding: "10px 12px", marginBottom: "14px",
          display: "flex", flexDirection: "column", gap: "4px",
          maxHeight: "240px", overflow: "auto",
        }}>
          {safeAllLessons.map((l, i) => (
            <button
              key={l.id}
              onClick={() => { onLessonSelect(l); setShowLessonList(false); }}
              style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px",
                borderRadius: "7px", cursor: "pointer", textAlign: "left", width: "100%",
                background: l.id === lesson.id ? "#111" : "transparent",
                border: `1px solid ${l.id === lesson.id ? BORDER : "transparent"}`,
                color: l.id === lesson.id ? "#FFFFFF" : TEXT,
                transition: "all 0.1s",
              }}
            >
              {l.completed
                ? <CheckCircle2 style={{ height: "13px", width: "13px", color: SUCCESS, flexShrink: 0 }} />
                : <div style={{ width: "13px", height: "13px", borderRadius: "50%", border: `1.5px solid ${BORDER}`, flexShrink: 0 }} />
              }
              <span style={{ fontSize: "13px", lineHeight: "1.3" }}>
                {i + 1}. {l.title.split(":").pop()?.trim() ?? l.title}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Lesson content */}
      <div
        style={{
          background: CARD, border: `1px solid ${BORDER}`,
          borderRadius: "12px", padding: "20px 18px",
          fontSize: "15px", lineHeight: "1.8", color: TEXT,
          marginBottom: "16px",
        }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.content ?? "") }}
      />

      {/* Nav actions */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {prevLesson && (
          <button onClick={() => onLessonSelect(prevLesson)} style={{
            display: "flex", alignItems: "center", gap: "5px", padding: "10px 14px",
            borderRadius: "8px", background: "transparent", border: `1px solid ${BORDER}`,
            cursor: "pointer", color: TEXT, fontSize: "13px", flex: 1,
            justifyContent: "center",
          }}>
            ← Prev
          </button>
        )}

        {!lesson.completed ? (
          <button onClick={handleComplete} disabled={completing} style={{
            flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            padding: "10px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 700,
            background: "#111", border: `1px solid ${SUCCESS}`,
            cursor: "pointer", color: SUCCESS, opacity: completing ? 0.7 : 1,
            minWidth: "140px",
          }}>
            {completing
              ? <Loader2 style={{ height: "13px", width: "13px", animation: "spin 1s linear infinite" }} />
              : <CheckCircle2 style={{ height: "13px", width: "13px" }} />
            }
            Mark Complete
          </button>
        ) : (
          <div style={{
            flex: 2, display: "flex", alignItems: "center", justifyContent: "center",
            gap: "5px", fontSize: "13px", color: SUCCESS, padding: "10px 14px",
            border: `1px solid ${SUCCESS}40`, borderRadius: "8px", background: "#111",
          }}>
            <CheckCircle2 style={{ height: "13px", width: "13px" }} /> Complete
          </div>
        )}

        {nextLesson && (
          <button onClick={() => onLessonSelect(nextLesson)} style={{
            display: "flex", alignItems: "center", gap: "5px", padding: "10px 14px",
            borderRadius: "8px", background: "#111", border: "1px solid #FFFFFF",
            cursor: "pointer", color: "#FFFFFF", fontSize: "13px", fontWeight: 600, flex: 1,
            justifyContent: "center",
          }}>
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
