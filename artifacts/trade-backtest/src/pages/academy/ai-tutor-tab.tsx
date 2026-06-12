import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, User, Loader2, ArrowUp } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

const ACCENT = "#22D3EE";
const SUCCESS = "#84CC16";
const BORDER = "#262626";
const CARD = "#171717";
const TEXT = "#A1A1AA";

interface Message { role: "user" | "assistant"; content: string; }

const SUGGESTED_PROMPTS = [
  "Explain Order Blocks",
  "What is a Fair Value Gap?",
  "How to size positions correctly?",
  "What is a liquidity sweep?",
  "Explain market structure shifts",
  "ICT vs Smart Money Concepts",
  "Psychology of losing trades",
  "Beginner mistakes to avoid",
];

function formatMessage(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700;color:#FFFFFF">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, `<code style="font-family:monospace;font-size:12px;background:#222;padding:2px 6px;border-radius:4px">$1</code>`)
    .replace(/^[-•] (.+)$/gm, `<div style="display:flex;gap:8px;margin:3px 0"><span style="color:${ACCENT};flex-shrink:0">·</span><span>$1</span></div>`)
    .replace(/\n/g, "<br/>");
}

export function AiTutorTab() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setInput("");
    setStarted(true);
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    setTimeout(() => inputRef.current?.focus(), 50);
    try {
      const r = await fetch(`${API_BASE}/api/academy/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: userMsg,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await r.json() as { reply: string };
      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? "Sorry, I couldn't respond." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 180px)", minHeight: "500px" }}>

      {/* Messages area */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", paddingBottom: "8px" }}>
        {!started ? (
          /* Welcome state */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "300px", padding: "20px 16px", textAlign: "center" }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "16px",
              background: "#111", border: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "16px",
            }}>
              <Bot style={{ height: "24px", width: "24px", color: ACCENT }} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#FFFFFF", marginBottom: "6px" }}>Trade Lab AI Tutor</div>
            <div style={{ fontSize: "14px", color: TEXT, marginBottom: "28px", lineHeight: "1.5", maxWidth: "320px" }}>
              Ask me anything about trading — from chart patterns to advanced Smart Money Concepts.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", width: "100%", maxWidth: "400px" }}>
              {SUGGESTED_PROMPTS.slice(0, 6).map(p => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  style={{
                    padding: "10px 12px", borderRadius: "10px", fontSize: "13px",
                    cursor: "pointer", background: CARD, border: `1px solid ${BORDER}`,
                    color: TEXT, textAlign: "left", lineHeight: "1.3",
                    transition: "border-color 0.12s, color 0.12s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#3a3a3a";
                    (e.currentTarget as HTMLElement).style.color = "#FFFFFF";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = BORDER;
                    (e.currentTarget as HTMLElement).style.color = TEXT;
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 4px" }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: "flex",
                flexDirection: m.role === "user" ? "row-reverse" : "row",
                gap: "10px", alignItems: "flex-end",
              }}>
                <div style={{
                  width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0,
                  background: m.role === "user" ? "#1C1C1E" : "#111",
                  border: `1px solid ${BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {m.role === "assistant"
                    ? <Bot style={{ height: "14px", width: "14px", color: ACCENT }} />
                    : <User style={{ height: "14px", width: "14px", color: TEXT }} />
                  }
                </div>
                <div style={{
                  maxWidth: "78%", padding: "12px 15px",
                  borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: m.role === "user" ? "#1C1C1E" : CARD,
                  border: `1px solid ${m.role === "user" ? "#333" : BORDER}`,
                  color: "#FFFFFF", fontSize: "14px", lineHeight: "1.65",
                }}>
                  {m.role === "assistant"
                    ? <span dangerouslySetInnerHTML={{ __html: formatMessage(m.content) }} />
                    : m.content
                  }
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#111", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bot style={{ height: "14px", width: "14px", color: ACCENT }} />
                </div>
                <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: CARD, border: `1px solid ${BORDER}`, display: "flex", gap: "5px", alignItems: "center" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", background: TEXT, animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick prompts row (after first message sent) */}
      {started && (
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "8px", flexShrink: 0 }}>
          {SUGGESTED_PROMPTS.slice(0, 5).map(p => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              style={{
                padding: "6px 12px", borderRadius: "16px", fontSize: "12px", whiteSpace: "nowrap",
                cursor: "pointer", background: "#111", border: `1px solid ${BORDER}`, color: TEXT,
                flexShrink: 0, transition: "border-color 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "#444"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = BORDER}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div style={{
        display: "flex", gap: "10px", alignItems: "flex-end",
        background: "#1C1C1E", border: `1px solid ${BORDER}`,
        borderRadius: "16px", padding: "10px 12px",
        flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); autoResize(e.target); }}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about trading…"
          rows={1}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: "#FFFFFF", fontSize: "15px", resize: "none",
            lineHeight: "1.5", fontFamily: "inherit",
            minHeight: "24px", maxHeight: "120px",
            padding: 0,
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          style={{
            width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
            background: input.trim() && !loading ? ACCENT : "#333",
            border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s",
          }}
        >
          {loading
            ? <Loader2 style={{ height: "15px", width: "15px", color: "#000", animation: "spin 1s linear infinite" }} />
            : <ArrowUp style={{ height: "16px", width: "16px", color: input.trim() ? "#000" : TEXT }} />
          }
        </button>
      </div>
    </div>
  );
}
