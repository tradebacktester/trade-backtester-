import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  Heart, Flag, Trash2, Send, X, AlertTriangle, CheckCircle,
  Users, MessageSquare, RefreshCw, Shield, Upload, Camera,
  Hash, Smile, Search, Lock, ChevronLeft, TrendingUp, Zap, Copy, CheckCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

/* ── Styles injected once ───────────────────────────────────────────────────── */
const ANIM_CSS = `
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes pulseGreen {
  0%, 100% { box-shadow: 0 0 0 0 rgba(52,199,89,0.4); }
  50%       { box-shadow: 0 0 0 4px rgba(52,199,89,0); }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.cm-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
}
.cm-card-elevated {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
}
.cm-pill {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
}
.cm-btn-ghost {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.5);
  border-radius: 10px;
  transition: all 0.15s ease;
  cursor: pointer;
}
.cm-btn-ghost:hover {
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.85);
}
.cm-btn-primary {
  background: rgba(255,255,255,0.92);
  color: #050505;
  border: none;
  border-radius: 10px;
  transition: all 0.15s ease;
  cursor: pointer;
  font-weight: 600;
}
.cm-btn-primary:hover:not(:disabled) {
  background: rgba(255,255,255,1);
  transform: scale(1.02);
}
.cm-btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.cm-input {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  color: rgba(255,255,255,0.9);
  outline: none;
  transition: border-color 0.15s ease;
}
.cm-input:focus {
  border-color: rgba(255,255,255,0.30);
}
.cm-post-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.cm-post-card:hover {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.12);
}
.cm-tab-btn {
  position: relative;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
  cursor: pointer;
  border: none;
  background: transparent;
}
.cm-conv-item {
  transition: background 0.12s ease;
  cursor: pointer;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
}
.cm-conv-item:hover { background: rgba(255,255,255,0.04); }
`;

function StyleInjector() {
  useEffect(() => {
    const id = "community-anim-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = ANIM_CSS;
      document.head.appendChild(el);
    }
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);
  return null;
}

/* ── Interfaces ─────────────────────────────────────────────────────────────── */
interface BacktestSummary {
  id: number;
  symbol: string;
  strategyName: string;
  totalReturn: number | null;
  sharpeRatio: number | null;
  maxDrawdown: number | null;
  winRate: number | null;
  totalTrades: number | null;
}

interface Post {
  id: number;
  userId: number | null;
  authorName: string;
  content: string;
  imageUrl: string | null;
  tag: string;
  likes: number;
  createdAt: string;
  parentId: number | null;
  backtestId: number | null;
  backtestSummary: BacktestSummary | null;
  replyCount: number;
}

const COMMUNITY_TAGS = ["All", "General", "Analysis", "Strategy", "Education", "Question", "Meme"] as const;
const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  Analysis:  { bg: "rgba(192,192,192,0.12)",  text: "#C0C0C0" },
  Strategy:  { bg: "rgba(167,139,250,0.12)", text: "#A78BFA" },
  Education: { bg: "rgba(132,204,22,0.12)",  text: "#84CC16" },
  Question:  { bg: "rgba(245,158,11,0.12)",  text: "#F59E0B" },
  Meme:      { bg: "rgba(249,115,22,0.12)",  text: "#F97316" },
  General:   { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.45)" },
};

function renderCommunityMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong style=\"font-weight:700;color:#fff\">$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code style=\"font-family:monospace;font-size:11px;background:rgba(255,255,255,0.07);padding:1px 5px;border-radius:3px\">$1</code>")
    .replace(/\n/g, "<br/>");
}

interface Report {
  id: number;
  postId: number;
  postContent: string;
  postAuthor: string;
  postDeleted: boolean;
  reporterName: string;
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
}

interface ChatMessage {
  id: number;
  userId: number | null;
  authorName: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  partnerId: number;
  partnerName: string;
  partnerUsername?: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

interface DM {
  id: number;
  fromUserId: number;
  fromName: string;
  toUserId: number;
  toName: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

/* ── Utils ──────────────────────────────────────────────────────────────────── */
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function chatTimeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return isToday ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_PALETTE = [
  "#1a3557", "#0d3d2b", "#3b1557", "#5a2d0c",
  "#141457", "#4d0f2e", "#0d4d4d", "#2d4d0d"
];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}

async function apiFetch(path: string, opts?: RequestInit, token?: string | null) {
  const r = await fetch(`${API_BASE}${path}` as string, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((opts?.headers as Record<string, string>) ?? {}),
    },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

/* ── Avatar ─────────────────────────────────────────────────────────────────── */
function Avatar({ name, size = 36, username, userId, onClick }: {
  name: string; size?: number;
  username?: string | null; userId?: number | null;
  onClick?: () => void;
}) {
  const [, navigate] = useLocation();
  const href = username ? `/u/${username}` : userId ? `/user/${userId}` : null;
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) { onClick(); return; }
    if (href) { e.stopPropagation(); navigate(href); }
  };
  return (
    <div
      onClick={href || onClick ? handleClick : undefined}
      title={href ? `View ${name}'s profile` : name}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: avatarColor(name), flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "rgba(255,255,255,0.9)", fontWeight: 600,
        fontSize: Math.max(10, size * 0.35),
        letterSpacing: "-0.02em",
        cursor: href || onClick ? "pointer" : "default",
        transition: "opacity 0.15s ease, transform 0.15s ease",
      }}
      onMouseEnter={href ? e => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; (e.currentTarget as HTMLElement).style.transform = "scale(1.06)"; } : undefined}
      onMouseLeave={href ? e => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.transform = "scale(1)"; } : undefined}
    >
      {initials(name)}
    </div>
  );
}

/* ── Emoji bar ──────────────────────────────────────────────────────────────── */
const QUICK_EMOJIS = ["🚀", "📈", "📉", "💎", "🔥", "👀", "💰", "⚡", "🎯", "😅", "🤔", "💪"];

/* ── ChatBox ────────────────────────────────────────────────────────────────── */
function ChatBox({ adminToken }: { adminToken: string | null }) {
  const { user, token: authToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [onlineNames, setOnlineNames] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const latestIdRef = useRef<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback((force = false) => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (force || near) el.scrollTop = el.scrollHeight;
  }, []);

  const loadMessages = useCallback(async (since?: string) => {
    try {
      const url = since ? `/api/community/chat?since=${encodeURIComponent(since)}` : "/api/community/chat";
      const data = await apiFetch(url) as { messages: ChatMessage[]; onlineNames: string[] };
      if (data.messages.length > 0) {
        if (since) {
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            const fresh = data.messages.filter(m => !ids.has(m.id));
            return [...prev, ...fresh].slice(-200);
          });
        } else {
          setMessages(data.messages);
          latestIdRef.current = data.messages[data.messages.length - 1]?.id ?? 0;
        }
        latestIdRef.current = data.messages[data.messages.length - 1]?.id ?? latestIdRef.current;
      }
      setOnlineNames(data.onlineNames ?? []);
    } catch { /* silently ignore polling errors */ }
  }, []);

  useEffect(() => {
    loadMessages().then(() => setTimeout(() => scrollToBottom(true), 100));
    pollRef.current = setInterval(() => {
      const latest = messages[messages.length - 1];
      loadMessages(latest?.createdAt);
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  async function send() {
    const text = input.trim();
    if (!text || !authToken) return;
    if (text.length > 300) { setError("Max 300 characters."); return; }
    setSending(true); setError("");
    try {
      const msg = await apiFetch("/api/community/chat", {
        method: "POST",
        body: JSON.stringify({ content: text }),
      }, authToken) as ChatMessage;
      setMessages(prev => [...prev, msg].slice(-200));
      setInput("");
      setShowEmoji(false);
      latestIdRef.current = msg.id;
      setTimeout(() => scrollToBottom(true), 50);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send.");
    } finally { setSending(false); }
  }

  async function deleteMsg(id: number) {
    try {
      await apiFetch(`/api/community/chat/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken ?? "" },
      });
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch { /* ignore */ }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);
  let prevAuthor = "";

  return (
    <div className="cm-card flex flex-col overflow-hidden" style={{ height: 540 }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2">
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#30D158", animation: "pulseGreen 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Live Chat</span>
        </div>
        {onlineNames.length > 0 && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontVariantNumeric: "tabular-nums" }}>
            {onlineNames.length} online
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          {onlineNames.slice(0, 4).map(n => <Avatar key={n} name={n} size={22} />)}
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-0.5"
        style={{ scrollBehavior: "smooth" }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <MessageSquare style={{ height: 26, width: 26, color: "rgba(255,255,255,0.2)" }} />
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>No messages yet — say hi!</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = user && msg.authorName === user.name;
          const isNewAuthor = msg.authorName !== prevAuthor;
          prevAuthor = msg.authorName;
          const isRecent = new Date(msg.createdAt) > fiveMinAgo;

          return (
            <div key={msg.id}
              style={{ animation: `fadeInUp 0.2s ease both`, animationDelay: `${Math.min(i, 10) * 0.01}s` }}
              className={`flex items-end gap-2 group ${isMe ? "flex-row-reverse" : "flex-row"} ${isNewAuthor && i > 0 ? "mt-3" : "mt-0.5"}`}>
              {isNewAuthor && !isMe && <Avatar name={msg.authorName} size={26} />}
              {!isNewAuthor && !isMe && <div style={{ width: 26, flexShrink: 0 }} />}

              <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                {isNewAuthor && (
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 3, paddingLeft: 4, paddingRight: 4 }}>
                    {isMe ? "You" : msg.authorName}
                    {isRecent && <span style={{ color: "#30D158", marginLeft: 4 }}>●</span>}
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>{chatTimeLabel(msg.createdAt)}</span>
                  </span>
                )}
                <div style={{ position: "relative" }}>
                  <div style={{
                    padding: "7px 12px",
                    borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    fontSize: 13, lineHeight: "1.45",
                    wordBreak: "break-word",
                    background: isMe ? "#0A84FF" : "rgba(255,255,255,0.07)",
                    color: isMe ? "#fff" : "rgba(255,255,255,0.88)",
                    border: isMe ? "none" : "1px solid rgba(255,255,255,0.08)",
                  }}>
                    {msg.content}
                  </div>
                  {adminToken && (
                    <button onClick={() => deleteMsg(msg.id)}
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "rgba(255,69,58,0.9)", border: "none", cursor: "pointer" }}>
                      <X style={{ height: 9, width: 9, color: "#fff" }} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Emoji bar */}
      {showEmoji && (
        <div className="flex gap-1 px-3 py-2 flex-wrap flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
          {QUICK_EMOJIS.map(em => (
            <button key={em} onClick={() => { setInput(v => v + em); setShowEmoji(false); inputRef.current?.focus(); }}
              style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", transition: "transform 0.1s ease" }}
              onMouseEnter={e => { (e.target as HTMLElement).style.transform = "scale(1.3)"; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.transform = "scale(1)"; }}>
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-3 flex-shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        {!authToken ? (
          <p className="flex-1 text-center" style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
            Sign in to join the chat
          </p>
        ) : (
          <>
            <button onClick={() => setShowEmoji(v => !v)}
              className="cm-btn-ghost flex-shrink-0"
              style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                background: showEmoji ? "rgba(10,132,255,0.2)" : undefined, borderColor: showEmoji ? "rgba(10,132,255,0.4)" : undefined }}>
              <Smile style={{ height: 14, width: 14 }} />
            </button>
            <input ref={inputRef} value={input}
              onChange={e => { setInput(e.target.value); setError(""); }}
              onKeyDown={onKey}
              placeholder="Message the community…"
              maxLength={300}
              className="cm-input flex-1 px-3 py-1.5"
              style={{ fontSize: 13 }} />
            <span style={{ fontSize: 10, color: input.length > 260 ? "#FF453A" : "rgba(255,255,255,0.25)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {input.length}/300
            </span>
            <button onClick={send} disabled={sending || !input.trim()}
              className="cm-btn-primary flex-shrink-0"
              style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Send style={{ height: 13, width: 13 }} />
            </button>
          </>
        )}
      </div>
      {error && <p style={{ fontSize: 11, color: "#FF453A", textAlign: "center", paddingBottom: 8, paddingLeft: 12, paddingRight: 12 }}>{error}</p>}
    </div>
  );
}

/* ── DMBox ──────────────────────────────────────────────────────────────────── */
function DMBox() {
  const { user, token: authToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activePartner, setActivePartner] = useState<{ id: number; name: string } | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: number; name: string; username: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const loadConversations = useCallback(async () => {
    if (!authToken) return;
    try {
      const data = await apiFetch("/api/community/dm/conversations", {}, authToken) as Conversation[];
      setConversations(data);
    } catch { /* ignore */ }
  }, [authToken]);

  const loadMessages = useCallback(async (partnerId: number) => {
    if (!authToken) return;
    try {
      const data = await apiFetch(`/api/community/dm/${partnerId}`, {}, authToken) as DM[];
      setMessages(data);
      setTimeout(scrollBottom, 50);
    } catch { /* ignore */ }
  }, [authToken, scrollBottom]);

  useEffect(() => {
    if (!authToken) return;
    loadConversations();
    pollRef.current = setInterval(() => {
      loadConversations();
      if (activePartner) loadMessages(activePartner.id);
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, activePartner?.id]);

  const [, navigate] = useLocation();

  function selectPartner(id: number, name: string) {
    setActivePartner({ id, name });
    setShowSearch(false);
    setSearchQ("");
    setSearchResults([]);
    loadMessages(id);
    setConversations(prev => prev.map(c => c.partnerId === id ? { ...c, unread: 0 } : c));
  }

  async function doSearch(q: string) {
    if (!authToken || q.length < 1) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(q)}`, {}, authToken) as { id: number; name: string; username: string | null }[];
      setSearchResults(res);
    } catch { /* ignore */ } finally { setSearching(false); }
  }

  function onSearchChange(q: string) {
    setSearchQ(q);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => doSearch(q), 350);
  }

  async function send() {
    const text = input.trim();
    if (!text || !authToken || !activePartner) return;
    setSending(true); setError("");
    try {
      const msg = await apiFetch(`/api/community/dm/${activePartner.id}`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
      }, authToken) as DM;
      setMessages(prev => [...prev, msg]);
      setInput("");
      setConversations(prev => {
        const existing = prev.find(c => c.partnerId === activePartner.id);
        if (existing)
          return [{ ...existing, lastMessage: msg.content, lastAt: msg.createdAt, unread: 0 }, ...prev.filter(c => c.partnerId !== activePartner.id)];
        return [{ partnerId: activePartner.id, partnerName: activePartner.name, lastMessage: msg.content, lastAt: msg.createdAt, unread: 0 }, ...prev];
      });
      setTimeout(scrollBottom, 50);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send.");
    } finally { setSending(false); }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  if (!authToken) {
    return (
      <div className="cm-card flex flex-col items-center justify-center gap-4 py-20">
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Lock style={{ height: 22, width: 22, color: "rgba(255,255,255,0.3)" }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: 6 }}>Sign in to use Direct Messages</p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>DMs are private and stored securely.</p>
        </div>
      </div>
    );
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <div className="cm-card flex overflow-hidden" style={{ minHeight: 440, height: "clamp(440px, 55vh, 620px)" }}>
      {/* Sidebar */}
      <div className={`flex flex-col flex-shrink-0 ${activePartner ? "hidden sm:flex" : "flex w-full"} sm:w-60`}
        style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}>

        <div className="flex items-center justify-between px-3 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
              Messages
              {totalUnread > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: "#0A84FF", color: "#fff" }}>
                  {totalUnread}
                </span>
              )}
            </span>
          </div>
          <button onClick={() => { setShowSearch(v => !v); setSearchQ(""); setSearchResults([]); }}
            className="cm-btn-ghost"
            style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
              background: showSearch ? "rgba(10,132,255,0.2)" : undefined }}>
            <Search style={{ height: 11, width: 11 }} />
          </button>
        </div>

        {showSearch && (
          <div className="px-2 py-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <input value={searchQ} onChange={e => onSearchChange(e.target.value)}
              placeholder="Search by username or name…" autoFocus
              className="cm-input w-full px-2.5 py-1.5"
              style={{ fontSize: 12 }} />
            {searching && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", paddingTop: 6 }}>Searching…</p>}
            {searchResults.map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <button onClick={() => selectPartner(u.id, u.name)}
                  className="cm-conv-item flex items-center gap-2 px-2 py-2 rounded-xl"
                  style={{ flex: 1 }}>
                  <Avatar name={u.name} size={28} />
                  <div style={{ textAlign: "left" }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.85)", margin: 0 }}>{u.name}</p>
                    {u.username && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0 }}>@{u.username}</p>}
                  </div>
                </button>
                <button onClick={() => navigate(u.username ? `/u/${u.username}` : `/user/${u.id}`)}
                  title="View profile"
                  style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 8, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}>
                  Profile
                </button>
              </div>
            ))}
            {searchQ.length >= 1 && !searching && searchResults.length === 0 && (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textAlign: "center", paddingTop: 6 }}>No users found</p>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && !showSearch && (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-3">
              <MessageSquare style={{ height: 20, width: 20, color: "rgba(255,255,255,0.2)" }} />
              <p style={{ fontSize: 11, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>No conversations yet. Search for a trader to start.</p>
            </div>
          )}
          {conversations.map(c => (
            <button key={c.partnerId} onClick={() => selectPartner(c.partnerId, c.partnerName)}
              className="cm-conv-item flex items-center gap-2.5 px-3 py-2.5"
              style={activePartner?.id === c.partnerId
                ? { background: "rgba(10,132,255,0.12)", borderLeft: "2px solid #0A84FF" }
                : { borderLeft: "2px solid transparent" }}>
              <Avatar name={c.partnerName} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center justify-between gap-1">
                  <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.88)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.partnerName}
                  </span>
                  {c.unread > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 8, background: "#0A84FF", color: "#fff", flexShrink: 0 }}>
                      {c.unread}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.lastMessage}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread panel */}
      <div className={`flex-1 flex flex-col min-w-0 ${!activePartner ? "hidden sm:flex" : "flex"}`}>
        {!activePartner ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Lock style={{ height: 26, width: 26, color: "rgba(255,255,255,0.2)" }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Select a conversation</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>or search for a trader to message</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-3 py-3 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <button onClick={() => setActivePartner(null)} className="sm:hidden cm-btn-ghost"
                style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronLeft style={{ height: 13, width: 13 }} />
              </button>
              <Avatar name={activePartner.name} size={30} userId={activePartner.id} />
              <div style={{ cursor: "pointer" }} onClick={() => navigate(`/user/${activePartner.id}`)}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}>
                  {activePartner.name}
                </p>
                <div className="flex items-center gap-1">
                  <Lock style={{ height: 9, width: 9, color: "rgba(255,255,255,0.3)" }} />
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Private</p>
                </div>
              </div>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1"
              style={{ scrollBehavior: "smooth" }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                    Start your private conversation with <strong style={{ color: "rgba(255,255,255,0.7)" }}>{activePartner.name}</strong>
                  </p>
                </div>
              )}
              {messages.map(msg => {
                const isMe = user && msg.fromUserId === (user as { id: number }).id;
                return (
                  <div key={msg.id} style={{ display: "flex", alignItems: "flex-end", gap: 8, flexDirection: isMe ? "row-reverse" : "row", animation: "fadeInUp 0.15s ease both" }}>
                    {!isMe && <Avatar name={msg.fromName} size={24} />}
                    <div style={{
                      padding: "7px 12px", borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      fontSize: 13, lineHeight: "1.45", wordBreak: "break-word", maxWidth: "78%",
                      background: isMe ? "#0A84FF" : "rgba(255,255,255,0.07)",
                      color: isMe ? "#fff" : "rgba(255,255,255,0.88)",
                      border: isMe ? "none" : "1px solid rgba(255,255,255,0.08)",
                    }}>
                      {msg.content}
                      <span style={{ display: "block", fontSize: 9, marginTop: 2, opacity: 0.55 }}>{chatTimeLabel(msg.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 px-3 py-3 flex-shrink-0"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <input value={input} onChange={e => { setInput(e.target.value); setError(""); }}
                onKeyDown={onKey}
                placeholder={`Message ${activePartner.name}…`}
                maxLength={500}
                className="cm-input flex-1 px-3 py-1.5"
                style={{ fontSize: 13 }} />
              <span style={{ fontSize: 10, color: input.length > 450 ? "#FF453A" : "rgba(255,255,255,0.25)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {input.length}/500
              </span>
              <button onClick={send} disabled={sending || !input.trim()}
                className="cm-btn-primary flex-shrink-0"
                style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Send style={{ height: 13, width: 13 }} />
              </button>
            </div>
            {error && <p style={{ fontSize: 11, color: "#FF453A", textAlign: "center", paddingBottom: 8 }}>{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/* ── ReportModal ────────────────────────────────────────────────────────────── */
function ReportModal({ post, onClose, onDone }: { post: Post; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const [reporterName, setReporterName] = useState(user?.name ?? "");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const REASONS = [
    "Abusive or offensive content",
    "Spam or misleading information",
    "Hate speech or discrimination",
    "Inappropriate image",
    "Misinformation about trading",
    "Other",
  ];

  async function submit() {
    if (!reporterName.trim()) { setError("Please enter your name."); return; }
    if (!reason.trim()) { setError("Please select a reason."); return; }
    setSending(true); setError("");
    try {
      await apiFetch(`/api/community/${post.id}/report`, {
        method: "POST",
        body: JSON.stringify({ reporterName: reporterName.trim(), reason: reason.trim() }),
      });
      setDone(true);
      setTimeout(() => { onDone(); onClose(); }, 1800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit report.");
    } finally { setSending(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.6)", animation: "fadeIn 0.15s ease" }}
      onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 380, background: "rgba(18,18,22,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.7)", animation: "scaleIn 0.2s ease" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2">
            <Flag style={{ height: 14, width: 14, color: "#FF453A" }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Report Post</span>
          </div>
          <button onClick={onClose} className="cm-btn-ghost"
            style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X style={{ height: 12, width: 12 }} />
          </button>
        </div>

        {done ? (
          <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(52,199,89,0.15)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(52,199,89,0.3)" }}>
              <CheckCircle style={{ height: 26, width: 26, color: "#30D158" }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Report submitted</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Our team will review it shortly.</p>
          </div>
        ) : (
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "monospace", overflow: "hidden", maxHeight: 52 }}>
              {post.content.slice(0, 100)}{post.content.length > 100 ? "…" : ""}
            </div>

            <div>
              <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>Your name</label>
              <input value={reporterName} onChange={e => setReporterName(e.target.value)} placeholder="Display name"
                className="cm-input w-full px-3 py-2"
                style={{ fontSize: 13, marginTop: 6 }} />
            </div>

            <div>
              <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>Reason</label>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                {REASONS.map(r => (
                  <button key={r} onClick={() => setReason(r)}
                    style={{
                      textAlign: "left", padding: "8px 12px", borderRadius: 10, fontSize: 12,
                      background: reason === r ? "#0A84FF" : "rgba(255,255,255,0.05)",
                      color: reason === r ? "#fff" : "rgba(255,255,255,0.75)",
                      border: reason === r ? "none" : "1px solid rgba(255,255,255,0.08)",
                      cursor: "pointer", transition: "all 0.12s ease",
                    }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {error && <p style={{ fontSize: 12, color: "#FF453A" }}>{error}</p>}

            <button onClick={submit} disabled={sending}
              style={{ width: "100%", padding: "11px 0", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "#FF453A", color: "#fff", border: "none", cursor: "pointer", opacity: sending ? 0.5 : 1, transition: "opacity 0.15s ease" }}>
              {sending ? "Submitting…" : "Submit Report"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── BacktestPreviewCard ────────────────────────────────────────────────────── */
function BacktestPreviewCard({ bt }: { bt: BacktestSummary }) {
  const ret = bt.totalReturn ?? 0;
  const retColor = ret > 0 ? "#30D158" : ret < 0 ? "#FF453A" : "rgba(255,255,255,0.5)";
  const { token: authToken, user } = useAuth();
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);

  async function handleClone() {
    if (!authToken) return;
    setCloning(true);
    try {
      const r = await fetch(`${API_BASE}/api/backtests/${bt.id}/clone-strategy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})) as { error?: string };
        alert(err.error ?? "Failed to clone strategy");
        return;
      }
      setCloned(true);
      setTimeout(() => setCloned(false), 3000);
    } catch {
      alert("Failed to clone strategy");
    } finally {
      setCloning(false);
    }
  }

  return (
    <div style={{ margin: "0 16px 12px", padding: "10px 14px", borderRadius: 12, background: "rgba(10,132,255,0.06)", border: "1px solid rgba(10,132,255,0.18)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <TrendingUp style={{ height: 11, width: 11, color: "#0A84FF" }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "#0A84FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Backtest Result</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: "auto" }}>{bt.symbol}</span>
      </div>
      <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>{bt.strategyName}</p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>Return</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: retColor }}>{ret >= 0 ? "+" : ""}{ret.toFixed(1)}%</div>
        </div>
        {bt.sharpeRatio != null && (
          <div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>Sharpe</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{bt.sharpeRatio.toFixed(2)}</div>
          </div>
        )}
        {bt.maxDrawdown != null && (
          <div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>Max DD</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#FF453A" }}>{bt.maxDrawdown.toFixed(1)}%</div>
          </div>
        )}
        {bt.winRate != null && (
          <div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>Win Rate</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{bt.winRate.toFixed(1)}%</div>
          </div>
        )}
        {bt.totalTrades != null && (
          <div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>Trades</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{bt.totalTrades}</div>
          </div>
        )}
      </div>
      {user && (
        <button
          onClick={handleClone}
          disabled={cloning || cloned}
          style={{
            marginTop: 10, display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
            borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: cloning || cloned ? "default" : "pointer",
            background: cloned ? "rgba(48,209,88,0.1)" : "rgba(10,132,255,0.1)",
            border: `1px solid ${cloned ? "rgba(48,209,88,0.3)" : "rgba(10,132,255,0.25)"}`,
            color: cloned ? "#30D158" : "#0A84FF", opacity: cloning ? 0.6 : 1, transition: "all 0.2s",
          }}
        >
          {cloned ? <CheckCheck style={{ height: 11, width: 11 }} /> : <Copy style={{ height: 11, width: 11 }} />}
          {cloned ? "Cloned to My Strategies!" : cloning ? "Cloning…" : "Clone Strategy"}
        </button>
      )}
    </div>
  );
}

/* ── PostCard ───────────────────────────────────────────────────────────────── */
function PostCard({
  post, adminToken, currentUserId, onDelete, onReport, likedIds, onLike, index,
}: {
  post: Post; adminToken: string | null; currentUserId?: number;
  onDelete: (id: number) => Promise<boolean>;
  onReport: (post: Post) => void; likedIds: Set<number>; onLike: (id: number, liked: boolean) => void;
  index: number;
}) {
  const liked = likedIds.has(post.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const { token: authToken } = useAuth();
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Post[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [localReplyCount, setLocalReplyCount] = useState(post.replyCount ?? 0);

  async function loadReplies() {
    if (replies.length > 0 && showReplies) return;
    setLoadingReplies(true);
    try {
      const data = await apiFetch(`/api/community/${post.id}/replies`) as { replies: Post[] };
      setReplies(data.replies ?? []);
    } catch { /* ignore */ } finally { setLoadingReplies(false); }
  }

  async function submitReply() {
    if (!replyContent.trim() || !authToken) return;
    setReplySending(true); setReplyError("");
    try {
      const reply = await apiFetch("/api/community", {
        method: "POST",
        body: JSON.stringify({ content: replyContent.trim(), parentId: post.id }),
      }, authToken) as Post;
      setReplies(prev => [...prev, reply]);
      setReplyContent(""); setShowReplyForm(false);
      setLocalReplyCount(c => c + 1);
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : "Failed to post reply.");
    } finally { setReplySending(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    const ok = await onDelete(post.id);
    if (!ok) {
      setDeleteError("Delete failed. Token may have expired.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <article className="cm-post-card overflow-hidden"
      style={{ animation: `fadeInUp 0.3s ease both`, animationDelay: `${Math.min(index, 12) * 0.04}s` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 16px 12px" }}>
        <Avatar name={post.authorName} size={36} userId={post.userId} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {post.userId ? (
              <Link href={`/user/${post.userId}`}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)", cursor: "pointer", textDecoration: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}>
                  {post.authorName}
                </span>
              </Link>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{post.authorName}</span>
            )}
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{timeAgo(post.createdAt)}</span>
            {post.tag && post.tag !== "General" && (() => {
              const tc = TAG_COLORS[post.tag] ?? TAG_COLORS.General!;
              return (
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600, background: tc.bg, color: tc.text }}>
                  {post.tag}
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 16px 12px" }}>
        <p style={{ fontSize: 13, lineHeight: "1.6", color: "rgba(255,255,255,0.82)", wordBreak: "break-word" }}
          dangerouslySetInnerHTML={{ __html: renderCommunityMarkdown(post.content) }} />
      </div>

      {post.imageUrl && (
        <div style={{ padding: "0 16px 12px" }}>
          <img src={post.imageUrl} alt="Post" style={{ borderRadius: 12, width: "100%", objectFit: "cover", maxHeight: 280, border: "1px solid rgba(255,255,255,0.08)" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}

      {post.backtestSummary && <BacktestPreviewCard bt={post.backtestSummary} />}

      {deleteError && (
        <div style={{ margin: "0 16px 8px", padding: "7px 12px", borderRadius: 10, background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.2)", fontSize: 11, color: "#FF453A", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle style={{ height: 11, width: 11, flexShrink: 0 }} />{deleteError}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => onLike(post.id, liked)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20,
            fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.12s ease",
            background: liked ? "rgba(255,69,58,0.12)" : "transparent",
            color: liked ? "#FF453A" : "rgba(255,255,255,0.4)",
            border: liked ? "1px solid rgba(255,69,58,0.25)" : "1px solid transparent",
          }}>
          <Heart style={{ height: 12, width: 12, fill: liked ? "#FF453A" : "none" }} />
          {post.likes > 0 ? post.likes : "Like"}
        </button>

        <button onClick={() => { if (!showReplies) loadReplies(); setShowReplies(v => !v); }}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20,
            fontSize: 12, cursor: "pointer", transition: "all 0.12s ease",
            background: showReplies ? "rgba(10,132,255,0.08)" : "transparent",
            color: showReplies ? "#0A84FF" : "rgba(255,255,255,0.4)",
            border: showReplies ? "1px solid rgba(10,132,255,0.25)" : "1px solid transparent",
          }}>
          <MessageSquare style={{ height: 12, width: 12 }} />
          {localReplyCount > 0 ? localReplyCount : "Reply"}
        </button>

        <button onClick={() => onReport(post)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer", background: "transparent", border: "1px solid transparent", color: "rgba(255,255,255,0.3)", marginLeft: "auto", transition: "color 0.12s ease" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)"; }}>
          <Flag style={{ height: 11, width: 11 }} />
          Report
        </button>

        {(adminToken || (currentUserId && currentUserId === post.userId)) && (
          confirmDelete ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={handleDelete} disabled={deleting}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", background: "rgba(255,69,58,0.12)", color: "#FF453A", border: "1px solid rgba(255,69,58,0.3)" }}>
                <Trash2 style={{ height: 9, width: 9 }} />
                {deleting ? "…" : "Confirm"}
              </button>
              <button onClick={() => { setConfirmDelete(false); setDeleteError(""); }}
                style={{ padding: "5px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer", background: "transparent", border: "none", color: "rgba(255,255,255,0.4)" }}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              title={adminToken ? "Admin: delete post" : "Delete your post"}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer", background: "transparent", border: "1px solid transparent", color: "rgba(255,69,58,0.6)", transition: "all 0.12s ease" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF453A"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,69,58,0.3)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,69,58,0.6)"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}>
              {adminToken ? <Shield style={{ height: 10, width: 10 }} /> : <Trash2 style={{ height: 10, width: 10 }} />}
              Delete
            </button>
          )
        )}
      </div>

      {showReplies && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {loadingReplies ? (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "8px 0" }}>Loading replies…</p>
          ) : (
            <>
              {replies.map(r => (
                <div key={r.id} style={{ display: "flex", gap: 10, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <Avatar name={r.authorName} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{r.authorName}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{timeAgo(r.createdAt)}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: "1.55", wordBreak: "break-word" }}>{r.content}</p>
                  </div>
                </div>
              ))}
              {authToken ? (
                showReplyForm ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 4 }}>
                    <textarea value={replyContent} onChange={e => setReplyContent(e.target.value)}
                      placeholder="Write a reply…" maxLength={400}
                      style={{ flex: 1, resize: "none", outline: "none", padding: "8px 12px", borderRadius: 10, fontSize: 12, lineHeight: "1.5", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.1)", minHeight: 52 }}
                      rows={2} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <button onClick={submitReply} disabled={replySending || !replyContent.trim()}
                        style={{ padding: "7px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "rgba(255,255,255,0.9)", color: "#050505", border: "none", opacity: (replySending || !replyContent.trim()) ? 0.4 : 1 }}>
                        {replySending ? "…" : "Send"}
                      </button>
                      <button onClick={() => { setShowReplyForm(false); setReplyContent(""); setReplyError(""); }}
                        style={{ padding: "7px 12px", borderRadius: 10, fontSize: 12, cursor: "pointer", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowReplyForm(true)}
                    style={{ alignSelf: "flex-start", fontSize: 12, color: "rgba(255,255,255,0.4)", cursor: "pointer", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "5px 12px", marginTop: 4 }}>
                    + Reply
                  </button>
                )
              ) : (
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Sign in to reply</p>
              )}
              {replyError && <p style={{ fontSize: 11, color: "#FF453A" }}>{replyError}</p>}
            </>
          )}
        </div>
      )}
    </article>
  );
}

/* ── CreatePostForm ─────────────────────────────────────────────────────────── */
function CreatePostForm({ onCreated, initialBacktestId, initialContent }: { onCreated: (post: Post) => void; initialBacktestId?: number | null; initialContent?: string }) {
  const { user, token: authToken } = useAuth();
  const [content, setContent] = useState(initialContent ?? "");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [postTag, setPostTag] = useState<string>("General");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedBtId, setSelectedBtId] = useState<number | null>(initialBacktestId ?? null);
  const [selectedBtInfo, setSelectedBtInfo] = useState<{ symbol: string; totalReturn: number | null } | null>(null);
  const [showBtPicker, setShowBtPicker] = useState(false);
  const [btOptions, setBtOptions] = useState<{ id: number; symbol: string; totalReturn: number | null }[]>([]);
  const [btLoading, setBtLoading] = useState(false);

  useEffect(() => { if (user?.name) setDisplayName(user.name); }, [user?.name]);

  // Auto-load backtest info if initialBacktestId provided
  useEffect(() => {
    if (!initialBacktestId || !authToken) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/backtests?limit=15`, { headers: { Authorization: `Bearer ${authToken}` } });
        if (r.ok) {
          const data = await r.json() as Array<{ id: number; symbol: string; totalReturn: string | null }>;
          const list = Array.isArray(data) ? data : [];
          const found = list.find(b => b.id === initialBacktestId);
          if (found) setSelectedBtInfo({ symbol: found.symbol, totalReturn: found.totalReturn != null ? Number(found.totalReturn) : null });
          setBtOptions(list.slice(0, 15).map(b => ({ id: b.id, symbol: b.symbol, totalReturn: b.totalReturn != null ? Number(b.totalReturn) : null })));
        }
      } catch { /* ignore */ }
    })();
  }, [initialBacktestId, authToken]);

  async function loadBacktests() {
    if (!authToken) return;
    setShowBtPicker(v => !v);
    if (btOptions.length > 0) return;
    setBtLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/backtests?limit=15`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (r.ok) {
        const data = await r.json() as Array<{ id: number; symbol: string; totalReturn: string | null }>;
        const list = Array.isArray(data) ? data : [];
        setBtOptions(list.slice(0, 15).map(b => ({
          id: b.id, symbol: b.symbol,
          totalReturn: b.totalReturn != null ? Number(b.totalReturn) : null,
        })));
      }
    } catch { /* ignore */ } finally { setBtLoading(false); }
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 700 * 1024) { setError("Image must be under 700 KB."); return; }
    const reader = new FileReader();
    reader.onload = ev => { setImagePreview(ev.target?.result as string); setError(""); };
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!displayName.trim()) { setError("Please enter your display name."); return; }
    if (!content.trim()) { setError("Please write something."); return; }
    setSending(true); setError("");
    try {
      const post = await apiFetch("/api/community", {
        method: "POST",
        body: JSON.stringify({ content: content.trim(), imageUrl: imagePreview ?? undefined, backtestId: selectedBtId ?? undefined, tag: postTag }),
      }, authToken) as Post;
      onCreated(post);
      setContent(""); setImagePreview(null); setSelectedBtId(null); setSelectedBtInfo(null);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to post.");
    } finally { setSending(false); }
  }

  const charCount = content.length;
  const overLimit = charCount > 1200;

  return (
    <div className="cm-card overflow-hidden" style={{ animation: "fadeInUp 0.25s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Avatar name={displayName || "?"} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {!user ? (
            <input value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="Your display name…"
              className="cm-input w-full px-3 py-1.5"
              style={{ fontSize: 13 }} />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{user.name}</span>
          )}
        </div>
      </div>

      {/* Tag selector */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px 0", flexWrap: "wrap" }}>
        {(["General", "Analysis", "Strategy", "Education", "Question", "Meme"] as const).map(t => {
          const tc = TAG_COLORS[t] ?? TAG_COLORS.General!;
          const active = postTag === t;
          return (
            <button key={t} onClick={() => setPostTag(t)}
              style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600, cursor: "pointer",
                background: active ? tc.bg : "transparent",
                color: active ? tc.text : "rgba(255,255,255,0.35)",
                border: `1px solid ${active ? tc.text + "50" : "rgba(255,255,255,0.1)"}`,
                transition: "all 0.12s",
              }}>
              {t}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "12px 16px 4px" }}>
        <textarea ref={textareaRef} value={content}
          onChange={e => { setContent(e.target.value); autoResize(); }}
          placeholder="Share a trading idea, insight, or chart pattern… (**bold**, *italic*, `code`)"
          style={{ width: "100%", resize: "none", outline: "none", fontSize: 13, lineHeight: "1.6", background: "transparent", color: "rgba(255,255,255,0.85)", minHeight: 72, border: "none" }}
          rows={3} />
      </div>

      {imagePreview && (
        <div style={{ padding: "0 16px 12px", position: "relative" }}>
          <img src={imagePreview} alt="preview" style={{ borderRadius: 12, width: "100%", objectFit: "cover", maxHeight: 180, border: "1px solid rgba(255,255,255,0.08)" }} />
          <button onClick={() => { setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
            style={{ position: "absolute", top: 6, right: 22, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>
            <X style={{ height: 11, width: 11, color: "#fff" }} />
          </button>
        </div>
      )}

      {error && (
        <div style={{ margin: "0 16px 8px", padding: "7px 12px", borderRadius: 10, background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.2)", fontSize: 12, color: "#FF453A", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle style={{ height: 11, width: 11, flexShrink: 0 }} />{error}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFileChange} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => fileInputRef.current?.click()}
          className="cm-btn-ghost"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 12, background: imagePreview ? "rgba(10,132,255,0.12)" : undefined, color: imagePreview ? "#0A84FF" : undefined, borderColor: imagePreview ? "rgba(10,132,255,0.3)" : undefined }}>
          <Upload style={{ height: 11, width: 11 }} />
          {imagePreview ? "Change" : "Photo"}
        </button>
        <button onClick={() => cameraInputRef.current?.click()}
          className="cm-btn-ghost"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 12 }}>
          <Camera style={{ height: 11, width: 11 }} />Camera
        </button>

        {authToken && (
          <div style={{ position: "relative" }}>
            <button onClick={loadBacktests}
              className="cm-btn-ghost"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 12, background: selectedBtId ? "rgba(10,132,255,0.12)" : undefined, color: selectedBtId ? "#0A84FF" : undefined, borderColor: selectedBtId ? "rgba(10,132,255,0.3)" : undefined }}>
              <TrendingUp style={{ height: 11, width: 11 }} />
              {selectedBtId ? (selectedBtInfo?.symbol ?? "Backtest") : "Backtest"}
            </button>
            {showBtPicker && (
              <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 100, minWidth: 230, background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                <div style={{ padding: "8px 12px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Attach Backtest</span>
                  <button onClick={() => setShowBtPicker(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex", padding: 2 }}>
                    <X style={{ height: 12, width: 12 }} />
                  </button>
                </div>
                {btLoading ? (
                  <p style={{ padding: "10px 12px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Loading…</p>
                ) : btOptions.length === 0 ? (
                  <p style={{ padding: "10px 12px", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>No backtests found</p>
                ) : (
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {selectedBtId && (
                      <button onClick={() => { setSelectedBtId(null); setSelectedBtInfo(null); setShowBtPicker(false); }}
                        style={{ width: "100%", textAlign: "left", padding: "7px 12px", fontSize: 11, cursor: "pointer", background: "rgba(255,69,58,0.06)", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#FF453A", display: "block" }}>
                        ✕ Remove backtest
                      </button>
                    )}
                    {btOptions.map(b => (
                      <button key={b.id} onClick={() => { setSelectedBtId(b.id); setSelectedBtInfo(b); setShowBtPicker(false); }}
                        style={{ width: "100%", textAlign: "left", padding: "7px 12px", fontSize: 12, cursor: "pointer", background: selectedBtId === b.id ? "rgba(10,132,255,0.1)" : "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 500 }}>{b.symbol}</span>
                        <span style={{ fontSize: 11, color: b.totalReturn != null && b.totalReturn > 0 ? "#30D158" : b.totalReturn != null && b.totalReturn < 0 ? "#FF453A" : "rgba(255,255,255,0.4)" }}>
                          {b.totalReturn != null ? `${b.totalReturn >= 0 ? "+" : ""}${b.totalReturn.toFixed(1)}%` : "—"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <span style={{ fontSize: 11, marginLeft: "auto", color: overLimit ? "#FF453A" : "rgba(255,255,255,0.25)", fontVariantNumeric: "tabular-nums" }}>
          {charCount}/1200
        </span>

        <button onClick={submit} disabled={sending || overLimit || !content.trim()}
          className="cm-btn-primary"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600 }}>
          <Send style={{ height: 12, width: 12 }} />
          {sending ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}

/* ── AdminReportsPanel ──────────────────────────────────────────────────────── */
function AdminReportsPanel({ adminToken }: { adminToken: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "resolved" | "dismissed">("pending");
  const [actionError, setActionError] = useState<Record<number, string>>({});

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/community/reports", {
        headers: { "x-admin-token": adminToken, "Content-Type": "application/json" },
      }) as Report[];
      setReports(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: number, status: string) {
    try {
      await apiFetch(`/api/admin/community/reports/${id}`, {
        method: "PATCH",
        headers: { "x-admin-token": adminToken, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: status as Report["status"] } : r));
    } catch (e) {
      setActionError(prev => ({ ...prev, [id]: e instanceof Error ? e.message : "Failed" }));
    }
  }

  async function deletePost(postId: number) {
    setActionError(prev => ({ ...prev, [postId]: "" }));
    try {
      await apiFetch(`/api/community/${postId}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken, "Content-Type": "application/json" },
      });
      setReports(prev => prev.map(r => r.postId === postId ? { ...r, postDeleted: true } : r));
    } catch (e) {
      setActionError(prev => ({ ...prev, [postId]: e instanceof Error ? e.message : "Delete failed — token may be expired." }));
    }
  }

  const filtered = reports.filter(r => filter === "all" ? true : r.status === filter);
  const pendingCount = reports.filter(r => r.status === "pending").length;

  return (
    <div className="cm-card overflow-hidden" style={{ animation: "fadeInUp 0.2s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Shield style={{ height: 13, width: 13, color: "#FF453A" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Reports</span>
          {pendingCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "rgba(255,69,58,0.12)", color: "#FF453A", border: "1px solid rgba(255,69,58,0.25)" }}>
              {pendingCount}
            </span>
          )}
        </div>
        <button onClick={load} className="cm-btn-ghost"
          style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RefreshCw style={{ height: 11, width: 11 }} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, padding: 8, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        {(["pending", "all", "resolved", "dismissed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: "pointer",
              background: filter === f ? "rgba(255,255,255,0.1)" : "transparent",
              color: filter === f ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
              border: "none", textTransform: "capitalize",
            }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>No {filter === "all" ? "" : filter} reports.</div>
      ) : (
        <div>
          {filtered.map(r => (
            <div key={r.id} style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>by {r.postAuthor}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 8,
                      background: r.status === "pending" ? "rgba(255,214,10,0.1)" : r.status === "resolved" ? "rgba(52,199,89,0.1)" : "rgba(255,255,255,0.06)",
                      color: r.status === "pending" ? "#FFD60A" : r.status === "resolved" ? "#30D158" : "rgba(255,255,255,0.3)",
                    }}>
                      {r.status}
                    </span>
                    {r.postDeleted && (
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: "rgba(255,69,58,0.1)", color: "#FF453A" }}>deleted</span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, fontFamily: "monospace", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "6px 10px", color: "rgba(255,255,255,0.75)" }}>
                    {r.postContent.slice(0, 90)}{r.postContent.length > 90 ? "…" : ""}
                  </p>
                  <p style={{ fontSize: 11, marginTop: 6, color: "rgba(255,255,255,0.4)" }}>
                    Reported by <strong style={{ color: "rgba(255,255,255,0.65)" }}>{r.reporterName}</strong>: {r.reason}
                  </p>
                </div>
              </div>

              {actionError[r.postId] && (
                <div style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.2)", fontSize: 11, color: "#FF453A", display: "flex", alignItems: "center", gap: 5 }}>
                  <AlertTriangle style={{ height: 10, width: 10, flexShrink: 0 }} />{actionError[r.postId]}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {!r.postDeleted && (
                  <button onClick={() => deletePost(r.postId)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: "pointer", background: "rgba(255,69,58,0.08)", color: "#FF453A", border: "1px solid rgba(255,69,58,0.2)" }}>
                    <Trash2 style={{ height: 9, width: 9 }} />Delete Post
                  </button>
                )}
                {r.status === "pending" && (
                  <>
                    <button onClick={() => updateStatus(r.id, "resolved")}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: "pointer", background: "rgba(52,199,89,0.08)", color: "#30D158", border: "1px solid rgba(52,199,89,0.2)" }}>
                      <CheckCircle style={{ height: 9, width: 9 }} />Resolve
                    </button>
                    <button onClick={() => updateStatus(r.id, "dismissed")}
                      style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", background: "transparent", border: "none", color: "rgba(255,255,255,0.35)" }}>
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── CommunityPage ──────────────────────────────────────────────────────────── */
export default function CommunityPage() {
  const { adminToken, token: authToken, user } = useAuth();
  const [tab, setTab] = useState<"feed" | "chat" | "dm">("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 20;
  const [error, setError] = useState("");
  const [reportingPost, setReportingPost] = useState<Post | null>(null);
  const [tagFilter, setTagFilter] = useState<string>("All");
  const [shareBacktestId, setShareBacktestId] = useState<number | null>(null);
  const [postDraft, setPostDraft] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem("community_liked");
      return new Set(saved ? JSON.parse(saved) as number[] : []);
    } catch { return new Set(); }
  });
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Handle shareBacktestId URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const btId = params.get("shareBacktestId");
    if (btId) {
      const id = parseInt(btId, 10);
      if (!isNaN(id)) setShareBacktestId(id);
    }
    const draft = params.get("postDraft");
    if (draft) setPostDraft(decodeURIComponent(draft));
  }, []);

  const tagParam = tagFilter !== "All" ? `&tag=${encodeURIComponent(tagFilter)}` : "";

  const fetchPosts = useCallback(async () => {
    setLoading(true); setError(""); setOffset(0);
    try {
      const data = await apiFetch(`/api/community?limit=${PAGE_SIZE}&offset=0${tagParam}`) as { posts: Post[]; hasMore: boolean };
      setPosts(data.posts);
      setHasMore(data.hasMore);
      setOffset(PAGE_SIZE);
    } catch { setError("Could not load posts. Please try again."); }
    finally { setLoading(false); }
  }, [tagParam]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const data = await apiFetch(`/api/community?limit=${PAGE_SIZE}&offset=${offset}${tagParam}`) as { posts: Post[]; hasMore: boolean };
      setPosts(prev => [...prev, ...data.posts]);
      setHasMore(data.hasMore);
      setOffset(prev => prev + PAGE_SIZE);
    } catch { /* ignore */ }
    finally { setLoadingMore(false); }
  }, [offset, tagParam]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  function saveLiked(ids: Set<number>) {
    localStorage.setItem("community_liked", JSON.stringify([...ids]));
  }

  async function handleLike(id: number, alreadyLiked: boolean) {
    try {
      const updated = await apiFetch(`/api/community/${id}/like`, {
        method: "POST",
        body: JSON.stringify({ action: alreadyLiked ? "unlike" : "like" }),
      }, authToken) as Post;
      setPosts(prev => prev.map(p => p.id === id ? { ...p, likes: updated.likes } : p));
      setLikedIds(prev => {
        const next = new Set(prev);
        if (alreadyLiked) next.delete(id); else next.add(id);
        saveLiked(next);
        return next;
      });
    } catch { /* ignore */ }
  }

  async function handleAdminDelete(id: number): Promise<boolean> {
    try {
      // Admin token takes priority; fall back to user auth token for author deletes
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminToken) headers["x-admin-token"] = adminToken;
      await apiFetch(`/api/community/${id}`, { method: "DELETE", headers }, authToken ?? undefined);
      setPosts(prev => prev.filter(p => p.id !== id));
      return true;
    } catch {
      return false;
    }
  }

  const stats = {
    posts: posts.length,
    members: new Set(posts.map(p => p.authorName)).size,
    likes: posts.reduce((s, p) => s + p.likes, 0),
  };

  const TABS = [
    { key: "feed" as const, label: "Feed", icon: Hash },
    { key: "chat" as const, label: "Live Chat", icon: MessageSquare, badge: "LIVE" },
    { key: "dm"   as const, label: "DMs", icon: Lock },
  ];

  return (
    <>
      <StyleInjector />
      <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 40, isolation: "isolate" }}>

        {/* ── Header ── */}
        <div className="cm-card relative overflow-hidden" style={{ padding: "20px 24px", animation: "fadeInUp 0.3s ease both" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 100% at 0% 100%, rgba(10,132,255,0.06) 0%, transparent 60%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 40% 60% at 100% 0%, rgba(52,199,89,0.04) 0%, transparent 60%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingUp style={{ height: 16, width: 16, color: "#0A84FF" }} />
                <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "rgba(255,255,255,0.95)" }}>Community</h1>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Share trading ideas, insights, and chart setups with fellow traders.</p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {[
                { icon: MessageSquare, val: stats.posts, label: "Posts" },
                { icon: Users, val: stats.members, label: "Members" },
                { icon: Heart, val: stats.likes, label: "Likes" },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <s.icon style={{ height: 10, width: 10, color: "rgba(255,255,255,0.35)" }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{s.val}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{s.label}</span>
                </div>
              ))}

              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={fetchPosts} className="cm-btn-ghost"
                  style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <RefreshCw style={{ height: 13, width: 13 }} />
                </button>
                {adminToken && (
                  <button onClick={() => setShowAdminPanel(v => !v)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer",
                      background: showAdminPanel ? "#FF453A" : "rgba(255,255,255,0.06)",
                      color: showAdminPanel ? "#fff" : "rgba(255,255,255,0.6)",
                      border: showAdminPanel ? "none" : "1px solid rgba(255,255,255,0.1)",
                      transition: "all 0.15s ease",
                    }}>
                    <Shield style={{ height: 12, width: 12 }} />Admin
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Disclaimer ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 12, background: "rgba(255,214,10,0.05)", border: "1px solid rgba(255,214,10,0.15)", animation: "fadeInUp 0.35s ease both" }}>
          <AlertTriangle style={{ height: 12, width: 12, color: "#FFD60A", flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 12, color: "rgba(255,214,10,0.85)", lineHeight: "1.5" }}>
            All content is for <strong>educational purposes only</strong> — not financial advice. Trading involves significant risk of loss.
          </p>
        </div>

        {/* ── Tab bar ── */}
        <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", animation: "fadeInUp 0.4s ease both" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className="cm-tab-btn flex-1"
              style={{ color: tab === t.key ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.4)", background: tab === t.key ? "rgba(255,255,255,0.09)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <t.icon style={{ height: 12, width: 12 }} />
              {t.label}
              {t.badge && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 5, background: "rgba(52,199,89,0.15)", color: "#30D158", border: "1px solid rgba(52,199,89,0.3)" }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {tab === "dm" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <DMBox />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="cm-card" style={{ padding: 16 }}>
                <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>About DMs</p>
                <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    "Messages are private between you and the recipient",
                    "Sign in to send or receive DMs",
                    "Use 🔍 to find traders by name",
                    "Max 500 characters per message",
                    "Conversations update every 3 seconds",
                    "Unread messages show a badge",
                  ].map((g, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                      <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(10,132,255,0.12)", border: "1px solid rgba(10,132,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#0A84FF", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : tab === "chat" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <ChatBox adminToken={adminToken} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="cm-card" style={{ padding: 16 }}>
                <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Chat Rules</p>
                <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    "Keep it trading-focused",
                    "No spam or repeated messages",
                    "Be kind and constructive",
                    "No pump & dump or financial advice",
                    "English preferred for clarity",
                    "Admins can remove messages",
                  ].map((g, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                      <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(52,199,89,0.1)", border: "1px solid rgba(52,199,89,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#30D158", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="cm-card" style={{ padding: 16 }}>
                <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Trending Topics</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {["#BTC", "#ETH", "#Options", "#SwingTrade", "#RSI", "#MACD", "#Fibonacci", "#DayTrading"].map(tag => (
                    <span key={tag} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, fontWeight: 500, background: "rgba(10,132,255,0.1)", color: "#0A84FF", border: "1px solid rgba(10,132,255,0.2)", cursor: "default" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              {adminToken && showAdminPanel && <AdminReportsPanel adminToken={adminToken} />}
            </div>
          </div>
        ) : (
          /* ── Feed ── */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Tag filter pills */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {COMMUNITY_TAGS.map(t => {
                  const active = tagFilter === t;
                  const tc = t !== "All" ? (TAG_COLORS[t] ?? TAG_COLORS.General!) : null;
                  return (
                    <button key={t} onClick={() => setTagFilter(t)}
                      style={{
                        fontSize: 12, padding: "5px 14px", borderRadius: 20, fontWeight: 600, cursor: "pointer",
                        background: active ? (tc ? tc.bg : "rgba(255,255,255,0.1)") : "transparent",
                        color: active ? (tc ? tc.text : "rgba(255,255,255,0.85)") : "rgba(255,255,255,0.35)",
                        border: `1px solid ${active ? (tc ? tc.text + "50" : "rgba(255,255,255,0.2)") : "rgba(255,255,255,0.1)"}`,
                        transition: "all 0.12s",
                      }}>
                      {t}
                    </button>
                  );
                })}
              </div>
              <CreatePostForm onCreated={post => setPosts(prev => [post, ...prev])} initialBacktestId={shareBacktestId} initialContent={postDraft ?? undefined} />

              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} className="cm-card" style={{ padding: 16, animation: "fadeIn 0.3s ease both" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ height: 12, width: 96, borderRadius: 6, background: "rgba(255,255,255,0.07)" }} />
                          <div style={{ height: 10, width: 60, borderRadius: 6, background: "rgba(255,255,255,0.04)" }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ height: 11, width: "100%", borderRadius: 6, background: "rgba(255,255,255,0.05)" }} />
                        <div style={{ height: 11, width: "75%", borderRadius: 6, background: "rgba(255,255,255,0.04)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="cm-card" style={{ padding: "40px 20px", textAlign: "center" }}>
                  <AlertTriangle style={{ height: 26, width: 26, color: "#FFD60A", margin: "0 auto 10px" }} />
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>{error}</p>
                  <button onClick={fetchPosts} className="cm-btn-ghost"
                    style={{ padding: "8px 20px", fontSize: 12 }}>Retry</button>
                </div>
              ) : posts.length === 0 ? (
                <div className="cm-card" style={{ padding: "56px 20px", textAlign: "center", animation: "fadeInUp 0.3s ease both" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <MessageSquare style={{ height: 22, width: 22, color: "rgba(255,255,255,0.2)" }} />
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>No posts yet</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>Be the first to share a trading idea!</p>
                </div>
              ) : (
                <>
                  {posts.map((post, i) => (
                    <PostCard key={post.id} post={post} index={i} adminToken={adminToken}
                      currentUserId={user?.id}
                      onDelete={handleAdminDelete} onReport={setReportingPost}
                      likedIds={likedIds} onLike={handleLike} />
                  ))}
                  {hasMore && (
                    <button onClick={loadMore} disabled={loadingMore}
                      className="cm-btn-ghost"
                      style={{ width: "100%", padding: "12px 0", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loadingMore ? 0.6 : 1, borderRadius: 14 }}>
                      {loadingMore ? <><RefreshCw style={{ height: 13, width: 13, animation: "spin 1s linear infinite" }} />Loading…</> : "Load more posts"}
                    </button>
                  )}
                  {!hasMore && posts.length > 0 && (
                    <p style={{ textAlign: "center", fontSize: 11, padding: "8px 0", color: "rgba(255,255,255,0.2)" }}>
                      All {posts.length} posts loaded
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="cm-card" style={{ padding: 16, animation: "fadeInUp 0.35s ease both" }}>
                <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Community Guidelines</p>
                <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    "Be respectful and constructive",
                    "No financial advice or pump & dump",
                    "No offensive or abusive language",
                    "No spam or self-promotion links",
                    "Only post relevant trading content",
                    "Report posts that violate rules",
                  ].map((g, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                      <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(10,132,255,0.1)", border: "1px solid rgba(10,132,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#0A84FF", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                      {g}
                    </li>
                  ))}
                </ul>
              </div>

              {posts.length > 0 && (
                <div className="cm-card" style={{ padding: 16, animation: "fadeInUp 0.4s ease both" }}>
                  <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Top Contributors</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(() => {
                      const map: Record<string, number> = {};
                      posts.forEach(p => { map[p.authorName] = (map[p.authorName] ?? 0) + 1; });
                      return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count], i) => (
                        <div key={name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 10, fontFamily: "monospace", width: 14, textAlign: "right", color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>{i + 1}</span>
                          <Avatar name={name} size={26} />
                          <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(255,255,255,0.8)" }}>{name}</span>
                          <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.3)" }}>{count}p</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              <div className="cm-card" style={{ padding: 16, animation: "fadeInUp 0.45s ease both" }}>
                <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Trending Topics</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {["#BTC", "#ETH", "#Options", "#SwingTrade", "#RSI", "#MACD", "#Fibonacci", "#DayTrading", "#RiskManagement", "#Crypto"].map(tag => (
                    <span key={tag} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, fontWeight: 500, background: "rgba(10,132,255,0.08)", color: "#4DA6FF", border: "1px solid rgba(10,132,255,0.18)", cursor: "default" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="cm-card" style={{ padding: 16, animation: "fadeInUp 0.5s ease both" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <Zap style={{ height: 12, width: 12, color: "#FFD60A" }} />
                  <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, color: "rgba(255,255,255,0.3)" }}>Pro Tips</p>
                </div>
                <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    "Include chart screenshots for better engagement",
                    "Tag your setup type (#Breakout, #Reversal)",
                    "Share your risk/reward before entry",
                  ].map((tip, i) => (
                    <li key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", paddingLeft: 12, borderLeft: "2px solid rgba(255,214,10,0.3)", lineHeight: 1.5 }}>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              {adminToken && showAdminPanel && <AdminReportsPanel adminToken={adminToken} />}
            </div>
          </div>
        )}

        {reportingPost && (
          <ReportModal post={reportingPost} onClose={() => setReportingPost(null)} onDone={() => setReportingPost(null)} />
        )}
      </div>
    </>
  );
}
