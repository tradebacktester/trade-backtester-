import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart, Flag, Trash2, Send, X, AlertTriangle, CheckCircle,
  Users, MessageSquare, RefreshCw, Shield, Upload, Camera,
  Hash, Smile, Search, Lock, ChevronLeft,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

interface Post {
  id: number;
  userId: number | null;
  authorName: string;
  content: string;
  imageUrl: string | null;
  likes: number;
  createdAt: string;
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

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
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

const AVATAR_PALETTE = ["#1e3a5f", "#1e4d3a", "#4a1e5f", "#5f3a1e", "#1e1e5f", "#5f1e3a", "#1e5f5f", "#3a5f1e"];
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

function Avatar({ name, size = 9 }: { name: string; size?: number }) {
  return (
    <div
      className={`h-${size} w-${size} rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0`}
      style={{ background: avatarColor(name), minWidth: size * 4, minHeight: size * 4, width: size * 4, height: size * 4, fontSize: size * 1.3 }}
    >
      {initials(name)}
    </div>
  );
}

// ── Chat quick-emoji bar ──────────────────────────────────────────────────────
const QUICK_EMOJIS = ["🚀", "📈", "📉", "💎", "🔥", "👀", "💰", "⚡", "🎯", "😅", "🤔", "💪"];

// ── ChatBox component ─────────────────────────────────────────────────────────
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
    } catch {
      /* silently ignore polling errors */
    }
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
    <div className="flex flex-col rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)", height: 520 }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--glass-border)" }}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>Live Chat</span>
        </div>
        <span className="text-[11px] font-mono ml-auto" style={{ color: "hsl(var(--muted-foreground))" }}>
          {onlineNames.length > 0 ? `${onlineNames.length} active` : "—"}
        </span>
        {onlineNames.slice(0, 5).map(n => (
          <Avatar key={n} name={n} size={6} />
        ))}
      </div>

      {/* Message list */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-0.5" style={{ scrollBehavior: "smooth" }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <MessageSquare style={{ height: 28, width: 28, color: "hsl(var(--muted-foreground))" }} />
            <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>No messages yet. Say something!</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = user && msg.authorName === user.name;
          const isNewAuthor = msg.authorName !== prevAuthor;
          prevAuthor = msg.authorName;
          const isRecent = new Date(msg.createdAt) > fiveMinAgo;

          return (
            <div key={msg.id} className={`flex items-end gap-2 group ${isMe ? "flex-row-reverse" : "flex-row"} ${isNewAuthor && i > 0 ? "mt-3" : "mt-0.5"}`}>
              {isNewAuthor && !isMe && (
                <Avatar name={msg.authorName} size={7} />
              )}
              {!isNewAuthor && !isMe && <div style={{ width: 28, flexShrink: 0 }} />}

              <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[75%]`}>
                {isNewAuthor && (
                  <span className="text-[10px] font-medium mb-0.5 px-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {isMe ? "You" : msg.authorName}
                    {isRecent && <span className="ml-1 text-green-400">●</span>}
                    <span className="ml-1.5 font-normal opacity-60">{chatTimeLabel(msg.createdAt)}</span>
                  </span>
                )}
                <div className="relative">
                  <div
                    className="px-3 py-1.5 rounded-2xl text-[13px] leading-relaxed break-words"
                    style={{
                      background: isMe ? "#2962FF" : "var(--glass-bg)",
                      color: isMe ? "#fff" : "hsl(var(--foreground))",
                      border: isMe ? "none" : "1px solid var(--glass-border)",
                      borderBottomRightRadius: isMe ? 4 : undefined,
                      borderBottomLeftRadius: !isMe ? 4 : undefined,
                      maxWidth: "100%",
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.content}
                  </div>
                  {adminToken && (
                    <button
                      onClick={() => deleteMsg(msg.id)}
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "rgba(239,83,80,0.9)", border: "1px solid #ef5350" }}
                    >
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
        <div className="flex gap-1 px-3 py-2 flex-wrap flex-shrink-0" style={{ borderTop: "1px solid var(--glass-border)", background: "var(--glass-bg)" }}>
          {QUICK_EMOJIS.map(em => (
            <button key={em} onClick={() => { setInput(v => v + em); setShowEmoji(false); inputRef.current?.focus(); }}
              className="text-[18px] hover:scale-125 transition-transform">{em}</button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2 px-3 py-3 flex-shrink-0" style={{ borderTop: "1px solid var(--glass-border)" }}>
        {!authToken ? (
          <p className="flex-1 text-[12px] text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
            Sign in to join the chat
          </p>
        ) : (
          <>
            <button
              onClick={() => setShowEmoji(v => !v)}
              className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-xl transition-colors"
              style={{ background: showEmoji ? "rgba(41,98,255,0.2)" : "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--muted-foreground))" }}
            >
              <Smile style={{ height: 14, width: 14 }} />
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); setError(""); }}
              onKeyDown={onKey}
              placeholder="Message the community…"
              maxLength={300}
              className="flex-1 px-3 py-1.5 rounded-xl text-[13px] outline-none"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))" }}
            />
            <span className="text-[10px] font-mono flex-shrink-0" style={{ color: input.length > 260 ? "#f87171" : "hsl(var(--muted-foreground))" }}>
              {input.length}/300
            </span>
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-xl transition-all disabled:opacity-40"
              style={{ background: "#2962FF", border: "none" }}
            >
              <Send style={{ height: 13, width: 13, color: "#fff" }} />
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-center pb-2 px-3" style={{ color: "#f87171" }}>{error}</p>
      )}
    </div>
  );
}

// ── DMBox component ───────────────────────────────────────────────────────────
interface Conversation {
  partnerId: number;
  partnerName: string;
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

function DMBox() {
  const { user, token: authToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activePartner, setActivePartner] = useState<{ id: number; name: string } | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: number; name: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
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

  function selectPartner(id: number, name: string) {
    setActivePartner({ id, name });
    setShowSearch(false);
    setSearchQ("");
    setSearchResults([]);
    loadMessages(id);
    // decrement unread
    setConversations(prev => prev.map(c => c.partnerId === id ? { ...c, unread: 0 } : c));
  }

  async function doSearch(q: string) {
    if (!authToken || q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await apiFetch(`/api/community/dm/search?q=${encodeURIComponent(q)}`, {}, authToken) as { id: number; name: string }[];
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
      // update conversation list
      setConversations(prev => {
        const existing = prev.find(c => c.partnerId === activePartner.id);
        if (existing) {
          return [{ ...existing, lastMessage: msg.content, lastAt: msg.createdAt, unread: 0 }, ...prev.filter(c => c.partnerId !== activePartner.id)];
        }
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
      <div className="rounded-2xl flex flex-col items-center justify-center gap-3 py-16" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", height: 480 }}>
        <Lock style={{ height: 28, width: 28, color: "hsl(var(--muted-foreground))" }} />
        <p className="text-[14px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>Sign in to use Direct Messages</p>
        <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>DMs are private and end-to-end stored securely.</p>
      </div>
    );
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <div className="flex rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)", height: 520 }}>

      {/* ── Sidebar ── */}
      <div className={`flex flex-col flex-shrink-0 ${activePartner ? "hidden sm:flex" : "flex"}`}
        style={{ width: 240, borderRight: "1px solid var(--glass-border)" }}>

        {/* Sidebar header */}
        <div className="flex items-center justify-between px-3 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <div className="flex items-center gap-2">
            <Lock style={{ height: 12, width: 12, color: "hsl(var(--muted-foreground))" }} />
            <span className="text-[12px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>
              Messages
              {totalUnread > 0 && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#2962FF", color: "#fff" }}>{totalUnread}</span>}
            </span>
          </div>
          <button onClick={() => { setShowSearch(v => !v); setSearchQ(""); setSearchResults([]); }}
            className="h-7 w-7 flex items-center justify-center rounded-xl transition-colors"
            style={{ background: showSearch ? "#2962FF" : "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <Search style={{ height: 11, width: 11, color: showSearch ? "#fff" : "hsl(var(--muted-foreground))" }} />
          </button>
        </div>

        {/* Search / new DM */}
        {showSearch && (
          <div className="px-2 py-2 flex-shrink-0" style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <input
              value={searchQ}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search traders…"
              autoFocus
              className="w-full px-2.5 py-1.5 rounded-xl text-[12px] outline-none"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))" }}
            />
            {searching && <p className="text-[11px] text-center py-1" style={{ color: "hsl(var(--muted-foreground))" }}>Searching…</p>}
            {searchResults.map(u => (
              <button key={u.id} onClick={() => selectPartner(u.id, u.name)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-xl mt-1 text-left transition-colors"
                style={{ background: "var(--glass-bg)" }}>
                <Avatar name={u.name} size={7} />
                <span className="text-[12px] font-medium" style={{ color: "hsl(var(--foreground))" }}>{u.name}</span>
              </button>
            ))}
            {searchQ.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-[11px] text-center py-1" style={{ color: "hsl(var(--muted-foreground))" }}>No users found</p>
            )}
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && !showSearch && (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-3">
              <MessageSquare style={{ height: 22, width: 22, color: "hsl(var(--muted-foreground))" }} />
              <p className="text-[11px] text-center" style={{ color: "hsl(var(--muted-foreground))" }}>No conversations yet. Tap 🔍 to find traders.</p>
            </div>
          )}
          {conversations.map(c => (
            <button key={c.partnerId} onClick={() => selectPartner(c.partnerId, c.partnerName)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 transition-colors text-left"
              style={activePartner?.id === c.partnerId
                ? { background: "rgba(41,98,255,0.12)", borderLeft: "2px solid #2962FF" }
                : { borderLeft: "2px solid transparent" }}>
              <Avatar name={c.partnerName} size={8} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[12px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>{c.partnerName}</span>
                  {c.unread > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "#2962FF", color: "#fff" }}>{c.unread}</span>
                  )}
                </div>
                <p className="text-[11px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{c.lastMessage}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Thread panel ── */}
      <div className={`flex-1 flex flex-col min-w-0 ${!activePartner && "hidden sm:flex"}`}>
        {!activePartner ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Lock style={{ height: 28, width: 28, color: "hsl(var(--muted-foreground))" }} />
            <p className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>Select a conversation</p>
            <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>or search for a trader to message</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-3 py-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--glass-border)" }}>
              <button onClick={() => setActivePartner(null)} className="sm:hidden h-7 w-7 flex items-center justify-center rounded-xl"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                <ChevronLeft style={{ height: 13, width: 13, color: "hsl(var(--muted-foreground))" }} />
              </button>
              <Avatar name={activePartner.name} size={8} />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{activePartner.name}</p>
                <div className="flex items-center gap-1">
                  <Lock style={{ height: 9, width: 9, color: "hsl(var(--muted-foreground))" }} />
                  <p className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>Private conversation</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1" style={{ scrollBehavior: "smooth" }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Start your private conversation with <strong>{activePartner.name}</strong>
                  </p>
                </div>
              )}
              {messages.map((msg) => {
                const isMe = user && msg.fromUserId === (user as { id: number }).id;
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    {!isMe && <Avatar name={msg.fromName} size={6} />}
                    <div
                      className="px-3 py-1.5 rounded-2xl text-[13px] leading-relaxed break-words max-w-[78%]"
                      style={{
                        background: isMe ? "#2962FF" : "var(--glass-bg)",
                        color: isMe ? "#fff" : "hsl(var(--foreground))",
                        border: isMe ? "none" : "1px solid var(--glass-border)",
                        borderBottomRightRadius: isMe ? 4 : undefined,
                        borderBottomLeftRadius: !isMe ? 4 : undefined,
                        wordBreak: "break-word",
                      }}
                    >
                      {msg.content}
                      <span className="block text-[9px] mt-0.5 opacity-60">{chatTimeLabel(msg.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-3 py-3 flex-shrink-0" style={{ borderTop: "1px solid var(--glass-border)" }}>
              <input
                value={input}
                onChange={e => { setInput(e.target.value); setError(""); }}
                onKeyDown={onKey}
                placeholder={`Message ${activePartner.name}…`}
                maxLength={500}
                className="flex-1 px-3 py-1.5 rounded-xl text-[13px] outline-none"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))" }}
              />
              <span className="text-[10px] font-mono flex-shrink-0" style={{ color: input.length > 450 ? "#f87171" : "hsl(var(--muted-foreground))" }}>
                {input.length}/500
              </span>
              <button onClick={send} disabled={sending || !input.trim()}
                className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-xl transition-all disabled:opacity-40"
                style={{ background: "#2962FF", border: "none" }}>
                <Send style={{ height: 13, width: 13, color: "#fff" }} />
              </button>
            </div>
            {error && <p className="text-[11px] text-center pb-2 px-3" style={{ color: "#f87171" }}>{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ── ReportModal ───────────────────────────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <div className="flex items-center gap-2">
            <Flag style={{ height: 14, width: 14, color: "#f87171" }} />
            <span className="text-[14px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>Report Post</span>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-full"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <X style={{ height: 12, width: 12, color: "hsl(var(--muted-foreground))" }} />
          </button>
        </div>

        {done ? (
          <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
            <CheckCircle style={{ height: 36, width: 36, color: "#4ade80" }} />
            <p className="text-[14px] font-medium" style={{ color: "hsl(var(--foreground))" }}>Report submitted</p>
            <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>Our team will review it shortly.</p>
          </div>
        ) : (
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="rounded-xl px-3 py-2.5 text-[12px] font-mono" style={{ background: "var(--glass-bg)", color: "hsl(var(--foreground))", border: "1px solid var(--glass-border)", maxHeight: 56, overflow: "hidden" }}>
              {post.content.slice(0, 100)}{post.content.length > 100 ? "…" : ""}
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>Your name</label>
              <input value={reporterName} onChange={e => setReporterName(e.target.value)} placeholder="Display name"
                className="mt-1.5 w-full px-3 py-2 rounded-xl text-[13px] outline-none transition-colors"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))" }} />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>Reason</label>
              <div className="mt-1.5 flex flex-col gap-1">
                {REASONS.map(r => (
                  <button key={r} onClick={() => setReason(r)}
                    className="text-left px-3 py-2 rounded-xl text-[12px] transition-all"
                    style={reason === r
                      ? { background: "#FFFFFF", color: "#050505", fontWeight: 600 }
                      : { background: "var(--glass-bg)", color: "hsl(var(--foreground))", border: "1px solid var(--glass-border)" }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-[12px]" style={{ color: "#f87171" }}>{error}</p>}

            <button onClick={submit} disabled={sending}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50 mt-1"
              style={{ background: "rgba(220,38,38,0.9)", color: "#fff", border: "1px solid rgba(220,38,38,0.4)" }}>
              {sending ? "Submitting…" : "Submit Report"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PostCard ──────────────────────────────────────────────────────────────────
function PostCard({ post, adminToken, onDelete, onReport, likedIds, onLike }: {
  post: Post; adminToken: string | null; onDelete: (id: number) => void;
  onReport: (post: Post) => void; likedIds: Set<number>; onLike: (id: number, liked: boolean) => void;
}) {
  const liked = likedIds.has(post.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <article className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <Avatar name={post.authorName} size={9} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{post.authorName}</span>
            <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{timeAgo(post.createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: "hsl(var(--foreground))" }}>{post.content}</p>
      </div>

      {post.imageUrl && (
        <div className="px-4 pb-3">
          <img src={post.imageUrl} alt="Post image" className="rounded-xl w-full object-cover"
            style={{ maxHeight: 300, border: "1px solid var(--glass-border)" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}

      <div className="flex items-center gap-1 px-3 pb-3 pt-2" style={{ borderTop: "1px solid var(--glass-border)" }}>
        <button onClick={() => onLike(post.id, liked)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all"
          style={liked
            ? { background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }
            : { color: "hsl(var(--muted-foreground))" }}>
          <Heart style={{ height: 12, width: 12, fill: liked ? "#f87171" : "none" }} />
          {post.likes > 0 ? post.likes : "Like"}
        </button>

        <button onClick={() => onReport(post)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] ml-auto transition-all"
          style={{ color: "hsl(var(--muted-foreground))" }}>
          <Flag style={{ height: 11, width: 11 }} />
          Report
        </button>

        {adminToken && (
          confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onDelete(post.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold"
                style={{ background: "rgba(220,38,38,0.1)", color: "#f87171", border: "1px solid rgba(220,38,38,0.25)" }}>
                <Trash2 style={{ height: 10, width: 10 }} /> Confirm
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1.5 text-[11px] rounded-xl"
                style={{ color: "hsl(var(--muted-foreground))" }}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px]"
              style={{ color: "#f87171" }}>
              <Shield style={{ height: 11, width: 11 }} />Delete
            </button>
          )
        )}
      </div>
    </article>
  );
}

// ── CreatePostForm ────────────────────────────────────────────────────────────
function CreatePostForm({ onCreated }: { onCreated: (post: Post) => void }) {
  const { user, token: authToken } = useAuth();
  const [content, setContent] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user?.name) setDisplayName(user.name); }, [user?.name]);

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
        body: JSON.stringify({ content: content.trim(), imageUrl: imagePreview ?? undefined }),
      }, authToken) as Post;
      onCreated(post);
      setContent(""); setImagePreview(null);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to post.");
    } finally { setSending(false); }
  }

  const charCount = content.length;
  const overLimit = charCount > 1200;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-3 px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--glass-border)" }}>
        <Avatar name={displayName || "?"} size={9} />
        <div className="flex-1 min-w-0">
          {!user ? (
            <input value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="Your display name…"
              className="w-full text-[13px] font-medium outline-none bg-transparent"
              style={{ color: "hsl(var(--foreground))" }} />
          ) : (
            <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{user.name}</span>
          )}
        </div>
      </div>

      <div className="px-4 pt-3">
        <textarea ref={textareaRef} value={content}
          onChange={e => { setContent(e.target.value); autoResize(); }}
          placeholder="Share a trading idea, insight, or chart pattern…"
          className="w-full resize-none outline-none text-[13px] leading-relaxed bg-transparent"
          style={{ color: "hsl(var(--foreground))", minHeight: 80 }}
          rows={3} />
      </div>

      {imagePreview && (
        <div className="px-4 pb-3 relative">
          <img src={imagePreview} alt="preview" className="rounded-xl w-full object-cover"
            style={{ maxHeight: 180, border: "1px solid var(--glass-border)" }} />
          <button onClick={() => { setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
            className="absolute top-2 right-6 h-6 w-6 flex items-center justify-center rounded-full"
            style={{ background: "rgba(0,0,0,0.6)" }}>
            <X style={{ height: 11, width: 11, color: "#fff" }} />
          </button>
        </div>
      )}

      {error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-xl text-[12px] flex items-center gap-2"
          style={{ background: "rgba(220,38,38,0.07)", color: "#f87171", border: "1px solid rgba(220,38,38,0.18)" }}>
          <AlertTriangle style={{ height: 11, width: 11, flexShrink: 0 }} />{error}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

      <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--glass-border)" }}>
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] transition-all"
          style={imagePreview
            ? { background: "var(--accent-cyan-dim)", color: "#FFFFFF", border: "1px solid var(--accent-cyan-border)" }
            : { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
          <Upload style={{ height: 11, width: 11 }} />
          {imagePreview ? "Change" : "Gallery"}
        </button>
        <button onClick={() => cameraInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] transition-all"
          style={{ background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
          <Camera style={{ height: 11, width: 11 }} />Camera
        </button>

        <span className="text-[11px] ml-auto font-mono" style={{ color: overLimit ? "#f87171" : "hsl(var(--muted-foreground))" }}>
          {charCount}/1200
        </span>

        <button onClick={submit} disabled={sending || overLimit || !content.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
          style={{ background: "#FFFFFF", color: "#050505" }}>
          <Send style={{ height: 12, width: 12 }} />
          {sending ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}

// ── AdminReportsPanel ─────────────────────────────────────────────────────────
function AdminReportsPanel({ adminToken }: { adminToken: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "resolved" | "dismissed">("pending");

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
    } catch { /* ignore */ }
  }

  async function deletePost(postId: number) {
    try {
      await apiFetch(`/api/community/${postId}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken, "Content-Type": "application/json" },
      });
      setReports(prev => prev.map(r => r.postId === postId ? { ...r, postDeleted: true } : r));
    } catch { /* ignore */ }
  }

  const filtered = reports.filter(r => filter === "all" ? true : r.status === filter);
  const pendingCount = reports.filter(r => r.status === "pending").length;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--glass-border)" }}>
        <div className="flex items-center gap-2">
          <Shield style={{ height: 13, width: 13, color: "hsl(var(--muted-foreground))" }} />
          <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>Reports</span>
          {pendingCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(220,38,38,0.1)", color: "#f87171", border: "1px solid rgba(220,38,38,0.22)" }}>
              {pendingCount}
            </span>
          )}
        </div>
        <button onClick={load} className="h-7 w-7 flex items-center justify-center rounded-full"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <RefreshCw style={{ height: 11, width: 11, color: "hsl(var(--muted-foreground))" }} />
        </button>
      </div>

      <div className="flex gap-1 p-2" style={{ borderBottom: "1px solid var(--glass-border)" }}>
        {(["pending", "all", "resolved", "dismissed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-lg text-[11px] font-medium capitalize transition-all"
            style={filter === f ? { background: "#FFFFFF", color: "#050505" } : { color: "hsl(var(--muted-foreground))" }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>No {filter === "all" ? "" : filter} reports.</div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
          {filtered.map(r => (
            <div key={r.id} className="px-4 py-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-[11px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>by {r.postAuthor}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      r.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                      r.status === "resolved" ? "bg-green-500/10 text-green-400" : "bg-white/5 text-white/30"}`}>
                      {r.status}
                    </span>
                    {r.postDeleted && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">deleted</span>}
                  </div>
                  <p className="text-[11px] rounded-lg px-2.5 py-1.5 font-mono" style={{ background: "var(--glass-bg)", color: "hsl(var(--foreground))", border: "1px solid var(--glass-border)" }}>
                    {r.postContent.slice(0, 90)}{r.postContent.length > 90 ? "…" : ""}
                  </p>
                  <p className="text-[11px] mt-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Reported by <strong>{r.reporterName}</strong>: {r.reason}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {!r.postDeleted && (
                  <button onClick={() => deletePost(r.postId)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium"
                    style={{ background: "rgba(220,38,38,0.07)", color: "#f87171", border: "1px solid rgba(220,38,38,0.2)" }}>
                    <Trash2 style={{ height: 9, width: 9 }} />Delete Post
                  </button>
                )}
                {r.status === "pending" && (
                  <>
                    <button onClick={() => updateStatus(r.id, "resolved")}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium"
                      style={{ background: "rgba(74,222,128,0.07)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
                      <CheckCircle style={{ height: 9, width: 9 }} />Resolve
                    </button>
                    <button onClick={() => updateStatus(r.id, "dismissed")}
                      className="px-2.5 py-1 rounded-lg text-[11px]"
                      style={{ color: "hsl(var(--muted-foreground))" }}>
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

// ── Main CommunityPage ────────────────────────────────────────────────────────
export default function CommunityPage() {
  const { adminToken, token: authToken } = useAuth();
  const [tab, setTab] = useState<"feed" | "chat" | "dm">("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 20;
  const [error, setError] = useState("");
  const [reportingPost, setReportingPost] = useState<Post | null>(null);
  const [likedIds, setLikedIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem("community_liked");
      return new Set(saved ? JSON.parse(saved) as number[] : []);
    } catch { return new Set(); }
  });
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true); setError(""); setOffset(0);
    try {
      const data = await apiFetch(`/api/community?limit=${PAGE_SIZE}&offset=0`) as { posts: Post[]; hasMore: boolean };
      setPosts(data.posts);
      setHasMore(data.hasMore);
      setOffset(PAGE_SIZE);
    } catch { setError("Could not load posts. Please try again."); }
    finally { setLoading(false); }
  }, []);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const data = await apiFetch(`/api/community?limit=${PAGE_SIZE}&offset=${offset}`) as { posts: Post[]; hasMore: boolean };
      setPosts(prev => [...prev, ...data.posts]);
      setHasMore(data.hasMore);
      setOffset(prev => prev + PAGE_SIZE);
    } catch { /* ignore */ }
    finally { setLoadingMore(false); }
  }, [offset]);

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

  async function handleAdminDelete(id: number) {
    try {
      await apiFetch(`/api/community/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken ?? "", "Content-Type": "application/json" },
      });
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch { /* ignore */ }
  }

  const stats = {
    posts: posts.length,
    members: new Set(posts.map(p => p.authorName)).size,
    likes: posts.reduce((s, p) => s + p.likes, 0),
  };

  return (
    <div className="flex flex-col gap-5 pb-10" style={{ isolation: "isolate" }}>

      {/* Header */}
      <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 80% at 0% 100%, rgba(255,255,255,0.03) 0%, transparent 60%)" }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare style={{ height: 18, width: 18, color: "#FFFFFF" }} />
              <h1 className="text-[20px] font-bold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>Community</h1>
            </div>
            <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>Share trading ideas, insights, and chart setups with fellow traders.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              {[
                { icon: MessageSquare, val: stats.posts, label: "Posts" },
                { icon: Users, val: stats.members, label: "Members" },
                { icon: Heart, val: stats.likes, label: "Likes" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <s.icon style={{ height: 11, width: 11, color: "hsl(var(--muted-foreground))" }} />
                  <span className="text-[12px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{s.val}</span>
                  <span className="text-[10px] hidden sm:inline" style={{ color: "hsl(var(--muted-foreground))" }}>{s.label}</span>
                </div>
              ))}
            </div>

            <button onClick={fetchPosts} className="h-9 w-9 flex items-center justify-center rounded-xl transition-colors"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
              <RefreshCw style={{ height: 13, width: 13, color: "hsl(var(--muted-foreground))" }} />
            </button>

            {adminToken && (
              <button onClick={() => setShowAdminPanel(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium"
                style={showAdminPanel
                  ? { background: "#FFFFFF", color: "#050505", border: "1px solid rgba(255,255,255,0.18)" }
                  : { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
                <Shield style={{ height: 12, width: 12 }} />Admin
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl px-4 py-3 flex items-start gap-3"
        style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <AlertTriangle style={{ height: 13, width: 13, color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
        <p className="text-[12px] leading-relaxed" style={{ color: "#fbbf24" }}>
          All content is for <strong>educational purposes only</strong> — not financial advice. Trading involves significant risk of loss.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
        <button
          onClick={() => setTab("feed")}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-medium transition-all"
          style={tab === "feed" ? { background: "#FFFFFF", color: "#050505" } : { color: "hsl(var(--muted-foreground))" }}
        >
          <Hash style={{ height: 13, width: 13 }} />Feed
        </button>
        <button
          onClick={() => setTab("chat")}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-medium transition-all"
          style={tab === "chat" ? { background: "#FFFFFF", color: "#050505" } : { color: "hsl(var(--muted-foreground))" }}
        >
          <MessageSquare style={{ height: 13, width: 13 }} />Live Chat
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>LIVE</span>
        </button>
        <button
          onClick={() => setTab("dm")}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-medium transition-all"
          style={tab === "dm" ? { background: "#FFFFFF", color: "#050505" } : { color: "hsl(var(--muted-foreground))" }}
        >
          <Lock style={{ height: 13, width: 13 }} />DMs
        </button>
      </div>

      {tab === "dm" ? (
        /* ── DM layout ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <DMBox />
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
              <p className="text-[10px] uppercase tracking-widest font-mono mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>About DMs</p>
              <ul className="flex flex-col gap-2">
                {[
                  "Messages are private between you and the recipient",
                  "Sign in to send or receive DMs",
                  "Use 🔍 to find traders by name",
                  "Max 500 characters per message",
                  "Conversations update every 3 seconds",
                  "Unread messages show a badge",
                ].map((g, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[12px]" style={{ color: "hsl(var(--foreground))" }}>
                    <span className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-px"
                      style={{ background: "rgba(41,98,255,0.15)", color: "#6ea8fe", border: "1px solid rgba(41,98,255,0.3)" }}>{i + 1}</span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : tab === "chat" ? (
        /* ── Chat layout ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <ChatBox adminToken={adminToken} />
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
              <p className="text-[10px] uppercase tracking-widest font-mono mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Chat Rules</p>
              <ul className="flex flex-col gap-2">
                {[
                  "Keep it trading-focused",
                  "No spam or repeated messages",
                  "Be kind and constructive",
                  "No pump & dump or financial advice",
                  "English preferred for clarity",
                  "Admins can remove messages",
                ].map((g, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[12px]" style={{ color: "hsl(var(--foreground))" }}>
                    <span className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-px"
                      style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>{i + 1}</span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
              <p className="text-[10px] uppercase tracking-widest font-mono mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Trending Topics</p>
              <div className="flex flex-wrap gap-1.5">
                {["#BTC", "#ETH", "#Options", "#SwingTrade", "#RSI", "#MACD", "#Fibonacci", "#DayTrading"].map(tag => (
                  <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full font-medium cursor-pointer"
                    style={{ background: "var(--accent-cyan-dim)", color: "#FFFFFF", border: "1px solid var(--accent-cyan-border)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            {adminToken && showAdminPanel && <AdminReportsPanel adminToken={adminToken} />}
          </div>
        </div>
      ) : (
        /* ── Feed layout ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <CreatePostForm onCreated={post => setPosts(prev => [post, ...prev])} />

            {loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-2xl p-4 animate-pulse"
                    style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-9 w-9 rounded-full" style={{ background: "var(--glass-border)" }} />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 rounded w-24" style={{ background: "var(--glass-border)" }} />
                        <div className="h-2.5 rounded w-16" style={{ background: "var(--glass-bg)" }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 rounded w-full" style={{ background: "var(--glass-bg)" }} />
                      <div className="h-3 rounded w-4/5" style={{ background: "var(--glass-bg)" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
                <AlertTriangle style={{ height: 28, width: 28, color: "#f59e0b", margin: "0 auto 12px" }} />
                <p className="text-[13px] mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>{error}</p>
                <button onClick={fetchPosts} className="px-4 py-2 rounded-xl text-[12px] font-medium"
                  style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))" }}>Retry</button>
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-2xl p-14 text-center" style={{ border: "1px dashed var(--glass-border)", background: "var(--card-bg)" }}>
                <MessageSquare style={{ height: 32, width: 32, color: "hsl(var(--muted-foreground))", margin: "0 auto 12px" }} />
                <p className="text-[15px] font-semibold mb-1" style={{ color: "hsl(var(--foreground))" }}>No posts yet</p>
                <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>Be the first to share a trading idea!</p>
              </div>
            ) : (
              <>
                {posts.map(post => (
                  <PostCard key={post.id} post={post} adminToken={adminToken} onDelete={handleAdminDelete}
                    onReport={setReportingPost} likedIds={likedIds} onLike={handleLike} />
                ))}
                {hasMore && (
                  <button onClick={loadMore} disabled={loadingMore}
                    className="w-full py-3 rounded-2xl text-[13px] font-medium transition-all flex items-center justify-center gap-2"
                    style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--muted-foreground))", opacity: loadingMore ? 0.6 : 1 }}>
                    {loadingMore ? (
                      <><RefreshCw style={{ height: 13, width: 13 }} className="animate-spin" />Loading…</>
                    ) : "Load more posts"}
                  </button>
                )}
                {!hasMore && posts.length > 0 && (
                  <p className="text-center text-[11px] py-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                    All {posts.length} posts loaded
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
              <p className="text-[10px] uppercase tracking-widest font-mono mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Community Guidelines</p>
              <ul className="flex flex-col gap-2">
                {[
                  "Be respectful and constructive",
                  "No financial advice or pump & dump",
                  "No offensive or abusive language",
                  "No spam or self-promotion links",
                  "Only post relevant trading content",
                  "Report posts that violate rules",
                ].map((g, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[12px]" style={{ color: "hsl(var(--foreground))" }}>
                    <span className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-px"
                      style={{ background: "var(--accent-cyan-dim)", color: "#FFFFFF", border: "1px solid var(--accent-cyan-border)" }}>{i + 1}</span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>

            {posts.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
                <p className="text-[10px] uppercase tracking-widest font-mono mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Top Contributors</p>
                <div className="flex flex-col gap-2.5">
                  {(() => {
                    const map: Record<string, number> = {};
                    posts.forEach(p => { map[p.authorName] = (map[p.authorName] ?? 0) + 1; });
                    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count], i) => (
                      <div key={name} className="flex items-center gap-2.5">
                        <span className="text-[10px] font-mono w-4 text-right flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{i + 1}</span>
                        <Avatar name={name} size={7} />
                        <span className="text-[12px] font-medium flex-1 truncate" style={{ color: "hsl(var(--foreground))" }}>{name}</span>
                        <span className="text-[10px] font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{count}p</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            <div className="rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
              <p className="text-[10px] uppercase tracking-widest font-mono mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Trending Topics</p>
              <div className="flex flex-wrap gap-1.5">
                {["#BTC", "#ETH", "#Options", "#SwingTrade", "#RSI", "#MACD", "#Fibonacci", "#DayTrading", "#RiskManagement", "#Crypto"].map(tag => (
                  <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full font-medium cursor-pointer"
                    style={{ background: "var(--accent-cyan-dim)", color: "#FFFFFF", border: "1px solid var(--accent-cyan-border)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {adminToken && showAdminPanel && <AdminReportsPanel adminToken={adminToken} />}
          </div>
        </div>
      )}

      {reportingPost && (
        <ReportModal post={reportingPost} onClose={() => setReportingPost(null)} onDone={() => setReportingPost(null)} />
      )}
    </div>
  );
}
