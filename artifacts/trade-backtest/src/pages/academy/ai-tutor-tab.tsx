import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, User, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

const ACCENT = "#22D3EE";
const BORDER = "#262626";
const CARD = "#171717";
const TEXT = "#A1A1AA";

interface Message { role: "user" | "assistant"; content: string; }

const SUGGESTED_PROMPTS = [
  "Explain what an Order Block is",
  "What is the difference between Support and Supply/Demand?",
  "How do I calculate position size correctly?",
  "What are the biggest beginner trading mistakes?",
  "Explain Fair Value Gaps and how to trade them",
  "What is a liquidity sweep?",
  "How do I identify market structure shifts?",
  "Explain the psychology behind revenge trading",
];

function formatMessage(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700;color:#FFFFFF">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, `<code style="font-family:monospace;font-size:11px;background:#222;padding:1px 5px;border-radius:4px">$1</code>`)
    .replace(/^• (.+)$/gm, `<div style="display:flex;gap:8px;margin:3px 0"><span style="color:${ACCENT};flex-shrink:0">·</span><span>$1</span></div>`)
    .replace(/^- (.+)$/gm, `<div style="display:flex;gap:8px;margin:3px 0"><span style="color:${ACCENT};flex-shrink:0">·</span><span>$1</span></div>`)
    .replace(/\n/g, "<br/>");
}

export function AiTutorTab() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello. I'm your Trade Lab AI Tutor.\n\nAsk me anything about trading — from the basics of candlestick patterns to advanced Smart Money Concepts.\n\nYou can ask me to:\n- **Explain** any concept clearly\n- **Give examples** from real markets\n- **Quiz you** on a topic\n- **Summarize** key takeaways from a lesson",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 220px)", minHeight: "480px" }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px", background: CARD, border: `1px solid ${BORDER}`,
        borderBottom: "none", borderRadius: "10px 10px 0 0",
        display: "flex", alignItems: "center", gap: "12px",
      }}>
        <div style={{
          width: "34px", height: "34px", borderRadius: "8px",
          background: "#111111", border: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Bot style={{ height: "16px", width: "16px", color: ACCENT }} />
        </div>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF" }}>AI Study Tutor</div>
          <div style={{ fontSize: "11px", color: TEXT }}>Expert in trading education</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#84CC16" }} />
          <span style={{ fontSize: "11px", color: TEXT }}>Online</span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflow: "auto", padding: "16px",
          background: "#0f0f0f", border: `1px solid ${BORDER}`, borderTop: "none", borderBottom: "none",
          display: "flex", flexDirection: "column", gap: "12px",
        }}
      >
        {messages.map((m, i) => (
          <div key={i} style={{
            display: "flex", gap: "10px",
            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            alignItems: "flex-end",
          }}>
            {m.role === "assistant" && (
              <div style={{
                width: "28px", height: "28px", borderRadius: "7px", flexShrink: 0,
                background: "#111111", border: `1px solid ${BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Bot style={{ height: "13px", width: "13px", color: ACCENT }} />
              </div>
            )}
            <div style={{
              maxWidth: "72%", padding: "11px 14px",
              borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
              background: m.role === "user" ? "#1a1a1a" : CARD,
              border: `1px solid ${m.role === "user" ? "#333" : BORDER}`,
              color: "#FFFFFF", fontSize: "13px", lineHeight: "1.6",
            }}>
              {m.role === "assistant"
                ? <span dangerouslySetInnerHTML={{ __html: formatMessage(m.content) }} />
                : m.content
              }
            </div>
            {m.role === "user" && (
              <div style={{
                width: "28px", height: "28px", borderRadius: "7px", flexShrink: 0,
                background: "#111111", border: `1px solid ${BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <User style={{ height: "13px", width: "13px", color: TEXT }} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "7px",
              background: "#111111", border: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Bot style={{ height: "13px", width: "13px", color: ACCENT }} />
            </div>
            <div style={{
              padding: "11px 14px", borderRadius: "12px 12px 12px 4px",
              background: CARD, border: `1px solid ${BORDER}`,
              display: "flex", gap: "4px", alignItems: "center",
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: "5px", height: "5px", borderRadius: "50%", background: TEXT,
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggested prompts */}
      {messages.length <= 2 && (
        <div style={{
          padding: "10px 16px", background: "#0f0f0f",
          border: `1px solid ${BORDER}`, borderTop: `1px solid ${BORDER}`, borderBottom: "none",
          display: "flex", flexWrap: "wrap", gap: "6px",
        }}>
          {SUGGESTED_PROMPTS.slice(0, 4).map(p => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              style={{
                padding: "5px 11px", borderRadius: "6px", fontSize: "11px",
                cursor: "pointer", background: "#111111", border: `1px solid ${BORDER}`,
                color: TEXT, transition: "border-color 0.12s, color 0.12s",
                whiteSpace: "nowrap",
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
              {p.length > 40 ? p.slice(0, 40) + "…" : p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: "12px 16px", borderRadius: "0 0 10px 10px",
        background: CARD, border: `1px solid ${BORDER}`, borderTop: "none",
        display: "flex", gap: "8px", alignItems: "flex-end",
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder="Ask anything about trading…"
          rows={2}
          style={{
            flex: 1, padding: "9px 12px", borderRadius: "8px", fontSize: "13px",
            background: "#111111", border: `1px solid ${BORDER}`,
            color: "#FFFFFF", outline: "none", resize: "none",
            lineHeight: "1.5", fontFamily: "inherit",
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          style={{
            width: "38px", height: "38px", borderRadius: "8px", flexShrink: 0,
            background: input.trim() && !loading ? ACCENT : "#111111",
            border: `1px solid ${input.trim() && !loading ? ACCENT : BORDER}`,
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}
        >
          {loading
            ? <Loader2 style={{ height: "14px", width: "14px", color: TEXT, animation: "spin 1s linear infinite" }} />
            : <Send style={{ height: "14px", width: "14px", color: input.trim() ? "#000000" : TEXT }} />
          }
        </button>
      </div>
    </div>
  );
}
