import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, User, Loader2, Sparkles, BookOpen, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

const C = { purple: "#a855f7", cyan: "#06b6d4", green: "#22c55e", amber: "#f59e0b" };

interface Message { role: "user" | "assistant"; content: string; }

const SUGGESTED_PROMPTS = [
  "Explain what an Order Block is in simple terms",
  "What is the difference between Support/Resistance and Supply/Demand?",
  "How do I calculate position size correctly?",
  "What are the biggest mistakes beginner traders make?",
  "Explain Fair Value Gaps and how to trade them",
  "What is a liquidity sweep and why does it happen?",
  "How do I identify market structure shifts?",
  "What is the ICT concept of 'inducement'?",
  "Explain the psychology behind revenge trading",
  "What makes a valid Order Block different from any candle?",
];

export function AiTutorTab() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your Trade Lab AI Tutor 📚\n\nI'm here to help you learn trading — from beginner basics to advanced Smart Money Concepts. Ask me anything!\n\nYou can ask me to:\n• **Explain** any concept simply\n• **Give examples** from real markets\n• **Quiz you** on a topic\n• **Summarize** key takeaways\n• **Clarify** anything from the lessons",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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
      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? "Sorry, I couldn't respond. Please try again." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Please check your connection and try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function formatMessage(text: string) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, `<code style="font-family:monospace;font-size:11px;background:rgba(168,85,247,0.15);padding:1px 5px;border-radius:4px">$1</code>`)
      .replace(/^• (.+)$/gm, `<div style="display:flex;align-items:flex-start;gap:6px;margin:2px 0"><span style="color:${C.purple};flex-shrink:0;margin-top:1px">•</span><span>$1</span></div>`)
      .replace(/\n/g, "<br/>");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", minHeight: "500px", gap: "0" }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px", borderRadius: "16px 16px 0 0",
        background: `linear-gradient(135deg, ${C.purple}15, ${C.cyan}08)`,
        border: "1px solid hsl(var(--border))", borderBottom: "none",
        display: "flex", alignItems: "center", gap: "12px",
      }}>
        <div style={{
          width: "38px", height: "38px", borderRadius: "11px",
          background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 4px 12px ${C.purple}40`,
        }}>
          <Bot style={{ height: "18px", width: "18px", color: "white" }} />
        </div>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "hsl(var(--foreground))" }}>AI Study Tutor</div>
          <div style={{ fontSize: "11px", color: C.purple }}>Expert in trading education · Available 24/7</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "5px" }}>
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
          <span style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>Online</span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflow: "auto", padding: "16px 20px",
          background: "var(--card-bg)", border: "1px solid hsl(var(--border))", borderTop: "none", borderBottom: "none",
          display: "flex", flexDirection: "column", gap: "14px",
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
                width: "30px", height: "30px", borderRadius: "9px", flexShrink: 0,
                background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Bot style={{ height: "14px", width: "14px", color: "white" }} />
              </div>
            )}
            <div style={{
              maxWidth: "72%",
              padding: "12px 16px",
              borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: m.role === "user"
                ? `linear-gradient(135deg, ${C.purple}, ${C.cyan})`
                : "hsl(var(--muted))",
              color: m.role === "user" ? "white" : "hsl(var(--foreground))",
              fontSize: "13px", lineHeight: "1.6",
            }}>
              {m.role === "assistant"
                ? <span dangerouslySetInnerHTML={{ __html: formatMessage(m.content) }} />
                : m.content
              }
            </div>
            {m.role === "user" && (
              <div style={{
                width: "30px", height: "30px", borderRadius: "9px", flexShrink: 0,
                background: "hsl(var(--muted))", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <User style={{ height: "14px", width: "14px", color: "hsl(var(--muted-foreground))" }} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
            <div style={{
              width: "30px", height: "30px", borderRadius: "9px",
              background: `linear-gradient(135deg, ${C.purple}, ${C.cyan})`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Bot style={{ height: "14px", width: "14px", color: "white" }} />
            </div>
            <div style={{
              padding: "12px 16px", borderRadius: "16px 16px 16px 4px",
              background: "hsl(var(--muted))", display: "flex", alignItems: "center", gap: "5px",
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: "6px", height: "6px", borderRadius: "50%", background: C.purple,
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
          padding: "10px 20px", background: "var(--card-bg)",
          border: "1px solid hsl(var(--border))", borderTop: "none", borderBottom: "none",
          display: "flex", flexWrap: "wrap", gap: "6px",
        }}>
          {SUGGESTED_PROMPTS.slice(0, 5).map(p => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              style={{
                padding: "5px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: 500,
                cursor: "pointer", background: `${C.purple}10`, border: `1px solid ${C.purple}25`,
                color: C.purple, transition: "all 0.12s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${C.purple}20`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${C.purple}10`; }}
            >
              {p.length > 40 ? p.slice(0, 40) + "..." : p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: "14px 20px", borderRadius: "0 0 16px 16px",
        background: "var(--card-bg)", border: "1px solid hsl(var(--border))", borderTop: "none",
        display: "flex", gap: "8px", alignItems: "flex-end",
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder="Ask me anything about trading — Order Blocks, risk management, psychology, charts..."
          rows={2}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: "12px", fontSize: "13px",
            background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))",
            color: "hsl(var(--foreground))", outline: "none", resize: "none",
            lineHeight: "1.5", fontFamily: "inherit",
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          style={{
            width: "40px", height: "40px", borderRadius: "12px", flexShrink: 0,
            background: input.trim() && !loading
              ? `linear-gradient(135deg, ${C.purple}, ${C.cyan})`
              : "hsl(var(--muted))",
            border: "none", cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: input.trim() && !loading ? `0 4px 12px ${C.purple}40` : "none",
            transition: "all 0.15s ease",
          }}
        >
          {loading
            ? <Loader2 style={{ height: "15px", width: "15px", color: "hsl(var(--muted-foreground))", animation: "spin 1s linear infinite" }} />
            : <Send style={{ height: "15px", width: "15px", color: input.trim() ? "white" : "hsl(var(--muted-foreground))" }} />
          }
        </button>
      </div>
    </div>
  );
}
