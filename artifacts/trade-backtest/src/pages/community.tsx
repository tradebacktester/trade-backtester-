import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart, Flag, Trash2, Send, ImageIcon, X,
  AlertTriangle, CheckCircle, Users,
  MessageSquare, RefreshCw, Shield, Upload, Camera,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "#111827", "#1e40af", "#065f46", "#7c3aed",
  "#b45309", "#be123c", "#0e7490", "#4d7c0f",
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

// ── API ──────────────────────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("tt_token");
  const r = await fetch(path, {
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

// ── Report Modal ─────────────────────────────────────────────────────────────

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
    if (!reason.trim()) { setError("Please select or enter a reason."); return; }
    setSending(true); setError("");
    try {
      await apiFetch(`/api/community/${post.id}/report`, {
        method: "POST",
        body: JSON.stringify({ reporterName: reporterName.trim(), reason: reason.trim() }),
      });
      setDone(true);
      setTimeout(() => { onDone(); onClose(); }, 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit report.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
          style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <div className="flex items-center gap-2">
            <Flag style={{ height: 15, width: 15, color: "#f87171" }} />
            <span className="text-[14px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>Report Post</span>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-full transition-colors"
            style={{ background: "var(--glass-bg)" }}>
            <X style={{ height: 13, width: 13, color: "hsl(var(--muted-foreground))" }} />
          </button>
        </div>

        {done ? (
          <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle style={{ height: 36, width: 36, color: "#4ade80" }} />
            <p className="text-[14px] font-medium" style={{ color: "hsl(var(--foreground))" }}>Report submitted</p>
            <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>Our admin will review it shortly.</p>
          </div>
        ) : (
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="rounded-xl p-3 text-[12px] font-mono"
              style={{ background: "var(--glass-bg)", color: "hsl(var(--foreground))", border: "1px solid var(--glass-border)", maxHeight: 60, overflow: "hidden" }}>
              {post.content.slice(0, 120)}{post.content.length > 120 ? "…" : ""}
            </div>

            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Your name</label>
              <input
                value={reporterName}
                onChange={e => setReporterName(e.target.value)}
                placeholder="Display name"
                className="mt-1 w-full px-3 py-2 rounded-xl text-[13px] outline-none transition-colors"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))" }}
              />
            </div>

            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Reason</label>
              <div className="mt-1 flex flex-col gap-1">
                {REASONS.map(r => (
                  <button key={r} onClick={() => setReason(r)}
                    className="text-left px-3 py-2 rounded-xl text-[13px] transition-all"
                    style={reason === r
                      ? { background: "#4DA3FF", color: "#050505" }
                      : { background: "var(--glass-bg)", color: "hsl(var(--foreground))", border: "1px solid var(--glass-border)" }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-[12px] text-red-500">{error}</p>}

            <button onClick={submit} disabled={sending}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50"
              style={{ background: "rgba(220,38,38,0.85)", color: "#fff", border: "1px solid rgba(220,38,38,0.5)" }}>
              {sending ? "Submitting…" : "Submit Report"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────────────

function PostCard({ post, adminToken, onDelete, onReport, likedIds, onLike }: {
  post: Post;
  adminToken: string | null;
  onDelete: (id: number) => void;
  onReport: (post: Post) => void;
  likedIds: Set<number>;
  onLike: (id: number, liked: boolean) => void;
}) {
  const liked = likedIds.has(post.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <article className="rounded-2xl overflow-hidden"
      style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>

      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
          style={{ background: avatarColor(post.authorName) }}>
          {initials(post.authorName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{post.authorName}</span>
            <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{timeAgo(post.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: "hsl(var(--foreground))" }}>{post.content}</p>
      </div>

      {/* Image */}
      {post.imageUrl && (
        <div className="px-4 pb-3">
          <img
            src={post.imageUrl}
            alt="Post image"
            className="rounded-xl w-full object-cover"
            style={{ maxHeight: 320, border: "1px solid rgba(0,0,0,0.06)" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 pb-3 pt-2.5 mt-1" style={{ borderTop: "1px solid var(--glass-border)" }}>
        <button
          onClick={() => onLike(post.id, liked)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all"
          style={liked
            ? { background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }
            : { background: "transparent", color: "hsl(var(--muted-foreground))" }}>
          <Heart style={{ height: 13, width: 13, fill: liked ? "#f87171" : "none" }} />
          {post.likes > 0 ? post.likes : "Like"}
        </button>

        <button
          onClick={() => onReport(post)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] transition-all ml-auto"
          style={{ color: "hsl(var(--muted-foreground))" }}
          title="Report this post">
          <Flag style={{ height: 12, width: 12 }} />
          Report
        </button>

        {adminToken && (
          confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onDelete(post.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
                style={{ background: "rgba(220,38,38,0.12)", color: "#f87171", border: "1px solid rgba(220,38,38,0.3)" }}>
                <Trash2 style={{ height: 11, width: 11 }} /> Confirm
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1.5 text-[11px] rounded-xl" style={{ color: "hsl(var(--muted-foreground))" }}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] transition-all"
              style={{ color: "#f87171" }}
              title="Admin: delete post">
              <Shield style={{ height: 12, width: 12 }} /> Delete
            </button>
          )
        )}
      </div>
    </article>
  );
}

// ── Create Post Form ──────────────────────────────────────────────────────────

function CreatePostForm({ onCreated }: { onCreated: (post: Post) => void }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.name) setDisplayName(user.name);
  }, [user?.name]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 700 * 1024) {
      setError("Image must be under 700 KB (required to fit within the upload limit).");
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      setImagePreview(ev.target?.result as string);
      setError("");
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit() {
    if (!displayName.trim()) { setError("Please enter your display name."); return; }
    if (!content.trim()) { setError("Please write something."); return; }
    setSending(true); setError("");
    try {
      const post = await apiFetch("/api/community", {
        method: "POST",
        body: JSON.stringify({
          content: content.trim(),
          imageUrl: imagePreview ?? undefined,
        }),
      }) as Post;
      onCreated(post);
      setContent(""); clearImage();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to post.");
    } finally {
      setSending(false);
    }
  }

  const charCount = content.length;
  const overLimit = charCount > 1200;

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>

      <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--glass-border)" }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
            style={{ background: avatarColor(displayName || "?") }}>
            {displayName ? initials(displayName) : "?"}
          </div>
          <div className="flex-1">
            {!user ? (
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your display name…"
                className="w-full text-[13px] font-medium outline-none bg-transparent"
                style={{ color: "hsl(var(--foreground))" }}
              />
            ) : (
              <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{user.name}</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => { setContent(e.target.value); autoResize(); }}
          placeholder="Share a trading idea, insight, or quote…"
          className="w-full resize-none outline-none text-[13px] leading-relaxed bg-transparent"
          style={{ color: "hsl(var(--foreground))", minHeight: 80, maxHeight: 300 }}
          rows={3}
        />
      </div>

      {imagePreview && (
        <div className="px-4 pb-3 relative">
          <img src={imagePreview} alt="preview" className="rounded-xl w-full object-cover"
            style={{ maxHeight: 200, border: "1px solid var(--glass-border)" }} />
          <button onClick={clearImage}
            className="absolute top-2 right-6 h-6 w-6 flex items-center justify-center rounded-full"
            style={{ background: "rgba(0,0,0,0.55)" }}>
            <X style={{ height: 11, width: 11, color: "#fff" }} />
          </button>
        </div>
      )}

      {error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-xl text-[12px] flex items-center gap-2"
          style={{ background: "rgba(220,38,38,0.08)", color: "#f87171", border: "1px solid rgba(220,38,38,0.2)" }}>
          <AlertTriangle style={{ height: 12, width: 12, flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

      <div className="flex items-center gap-2 px-4 py-3 border-t border-black/5">
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] transition-all"
          style={imagePreview
            ? { background: "rgba(77,163,255,0.1)", color: "#4DA3FF" }
            : { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
          <Upload style={{ height: 12, width: 12 }} />
          {imagePreview ? "Change" : "Gallery"}
        </button>
        <button onClick={() => cameraInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] transition-all"
          style={{ background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
          <Camera style={{ height: 12, width: 12 }} />
          Camera
        </button>

        <span className="text-[11px] ml-auto" style={{ color: overLimit ? "#f87171" : "hsl(var(--muted-foreground))" }}>
          {charCount}/1200
        </span>

        <button
          onClick={submit}
          disabled={sending || overLimit || !content.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
          style={{ background: "#4DA3FF", color: "#050505" }}>
          <Send style={{ height: 12, width: 12 }} />
          {sending ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}

// ── Admin Reports Panel ───────────────────────────────────────────────────────

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
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
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
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>

      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--glass-border)" }}>
        <div className="flex items-center gap-2">
          <Shield style={{ height: 14, width: 14, color: "hsl(var(--muted-foreground))" }} />
          <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>Reports</span>
          {pendingCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(220,38,38,0.1)", color: "#f87171", border: "1px solid rgba(220,38,38,0.25)" }}>
              {pendingCount} pending
            </span>
          )}
        </div>
        <button onClick={load} className="h-7 w-7 flex items-center justify-center rounded-full transition-colors"
          style={{ background: "var(--glass-bg)" }}>
          <RefreshCw style={{ height: 12, width: 12, color: "hsl(var(--muted-foreground))" }} />
        </button>
      </div>

      <div className="flex gap-1 p-2" style={{ borderBottom: "1px solid var(--glass-border)" }}>
        {(["pending", "all", "resolved", "dismissed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-lg text-[11px] font-medium capitalize transition-all"
            style={filter === f
              ? { background: "#4DA3FF", color: "#050505" }
              : { color: "hsl(var(--muted-foreground))" }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-[12px]" style={{ color: "#bbb" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-[12px]" style={{ color: "#bbb" }}>No {filter === "all" ? "" : filter} reports.</div>
      ) : (
        <div className="divide-y divide-black/5">
          {filtered.map(r => (
            <div key={r.id} className="px-4 py-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[11px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>by {r.postAuthor}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      r.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                      r.status === "resolved" ? "bg-green-500/10 text-green-400" :
                      "bg-white/5 text-white/40"
                    }`}>{r.status}</span>
                    {r.postDeleted && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">post deleted</span>}
                  </div>
                  <p className="text-[12px] rounded-lg px-2.5 py-2" style={{ background: "var(--glass-bg)", color: "hsl(var(--foreground))", fontFamily: "monospace", border: "1px solid var(--glass-border)" }}>
                    {r.postContent.slice(0, 100)}{r.postContent.length > 100 ? "…" : ""}
                  </p>
                  <p className="text-[11px] mt-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Reported by <strong>{r.reporterName}</strong>: {r.reason}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{timeAgo(r.createdAt)}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {!r.postDeleted && (
                  <button onClick={() => deletePost(r.postId)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                    style={{ background: "rgba(220,38,38,0.08)", color: "#f87171", border: "1px solid rgba(220,38,38,0.22)" }}>
                    <Trash2 style={{ height: 10, width: 10 }} /> Delete Post
                  </button>
                )}
                {r.status === "pending" && (
                  <>
                    <button onClick={() => updateStatus(r.id, "resolved")}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                      style={{ background: "rgba(74,222,128,0.08)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.22)" }}>
                      <CheckCircle style={{ height: 10, width: 10 }} /> Resolve
                    </button>
                    <button onClick={() => updateStatus(r.id, "dismissed")}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-all"
                      style={{ color: "#aaa" }}>
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const { user, adminToken } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true); setError("");
    try {
      const data = await apiFetch("/api/community") as Post[];
      setPosts(data);
    } catch {
      setError("Could not load posts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  function saveLiked(ids: Set<number>) {
    localStorage.setItem("community_liked", JSON.stringify([...ids]));
  }

  async function handleLike(id: number, alreadyLiked: boolean) {
    try {
      const updated = await apiFetch(`/api/community/${id}/like`, {
        method: "POST",
        body: JSON.stringify({ action: alreadyLiked ? "unlike" : "like" }),
      }) as Post;
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
    <div className="flex flex-col gap-6">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare style={{ height: 20, width: 20, color: "#4DA3FF" }} />
            <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "hsl(var(--foreground))" }}>Community</h1>
          </div>
          <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>Share trading ideas, insights, and quotes with fellow traders.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-4 px-4 py-2 rounded-xl"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            {[
              { icon: MessageSquare, value: stats.posts, label: "Posts" },
              { icon: Users, value: stats.members, label: "Members" },
              { icon: Heart, value: stats.likes, label: "Likes" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5 text-center">
                <s.icon style={{ height: 12, width: 12, color: "hsl(var(--muted-foreground))" }} />
                <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{s.value}</span>
                <span className="text-[11px] hidden sm:inline" style={{ color: "hsl(var(--muted-foreground))" }}>{s.label}</span>
              </div>
            ))}
          </div>

          <button onClick={fetchPosts}
            className="h-9 w-9 flex items-center justify-center rounded-xl transition-colors"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            <RefreshCw style={{ height: 14, width: 14, color: "hsl(var(--muted-foreground))" }} />
          </button>

          {adminToken && (
            <button onClick={() => setShowAdminPanel(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all"
              style={showAdminPanel
                ? { background: "#4DA3FF", color: "#050505", border: "1px solid rgba(77,163,255,0.4)" }
                : { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
              <Shield style={{ height: 13, width: 13 }} />
              Admin
            </button>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl px-4 py-3 flex items-start gap-3"
        style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.22)" }}>
        <AlertTriangle style={{ height: 14, width: 14, color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
        <p className="text-[12px] leading-relaxed" style={{ color: "#fbbf24" }}>
          <strong>Disclaimer:</strong> All content posted here is for educational and informational purposes only.
          Nothing on this page constitutes financial advice. Trading involves significant risk of loss. Past performance is not indicative of future results.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Feed */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <CreatePostForm onCreated={post => setPosts(prev => [post, ...prev])} />

          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl p-4 animate-pulse"
                  style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-9 w-9 rounded-full" style={{ background: "var(--glass-border)" }} />
                    <div className="flex-1">
                      <div className="h-3 rounded w-28 mb-1.5" style={{ background: "var(--glass-border)" }} />
                      <div className="h-2.5 rounded w-16" style={{ background: "var(--glass-bg)" }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 rounded w-full" style={{ background: "var(--glass-bg)" }} />
                    <div className="h-3 rounded w-4/5" style={{ background: "var(--glass-bg)" }} />
                    <div className="h-3 rounded w-3/5" style={{ background: "var(--glass-bg)" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl p-8 text-center"
              style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
              <AlertTriangle style={{ height: 28, width: 28, color: "#f59e0b", margin: "0 auto 12px" }} />
              <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>{error}</p>
              <button onClick={fetchPosts} className="mt-3 px-4 py-2 rounded-xl text-[12px] font-medium"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--foreground))" }}>Retry</button>
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl p-12 text-center"
              style={{ border: "1px dashed var(--glass-border)", background: "var(--card-bg)" }}>
              <MessageSquare style={{ height: 36, width: 36, color: "hsl(var(--muted-foreground))", margin: "0 auto 12px" }} />
              <p className="text-[15px] font-medium mb-1" style={{ color: "hsl(var(--foreground))" }}>No posts yet</p>
              <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>Be the first to share a trading idea!</p>
            </div>
          ) : (
            posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                adminToken={adminToken}
                onDelete={handleAdminDelete}
                onReport={setReportingPost}
                likedIds={likedIds}
                onLike={handleLike}
              />
            ))
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Guidelines */}
          <div className="rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Community Guidelines</p>
            <ul className="flex flex-col gap-2">
              {[
                "Be respectful and constructive",
                "No financial advice or pump & dump",
                "No offensive or abusive language",
                "No spam or self-promotion links",
                "Only post relevant trading content",
                "Report posts that violate rules",
              ].map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "hsl(var(--foreground))" }}>
                  <span className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-px"
                    style={{ background: "var(--accent-cyan-dim)", color: "#4DA3FF", border: "1px solid var(--accent-cyan-border)" }}>{i + 1}</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>

          {/* Top contributors */}
          {posts.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>
              <p className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Top Contributors</p>
              <div className="flex flex-col gap-2">
                {(() => {
                  const map: Record<string, number> = {};
                  posts.forEach(p => { map[p.authorName] = (map[p.authorName] ?? 0) + 1; });
                  return Object.entries(map)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([name, count], i) => (
                      <div key={name} className="flex items-center gap-2.5">
                        <span className="text-[11px] font-mono w-4 text-right flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{i + 1}</span>
                        <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background: avatarColor(name) }}>
                          {initials(name)}
                        </div>
                        <span className="text-[12px] font-medium flex-1 truncate" style={{ color: "hsl(var(--foreground))" }}>{name}</span>
                        <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{count} post{count !== 1 ? "s" : ""}</span>
                      </div>
                    ));
                })()}
              </div>
            </div>
          )}

          {/* Trending topics / tags placeholder */}
          <div className="rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Trending Topics</p>
            <div className="flex flex-wrap gap-1.5">
              {["#BTC", "#ETH", "#Options", "#SwingTrade", "#RSI", "#MACD", "#Fibonacci", "#DayTrading", "#Risk Management", "#Crypto"].map(tag => (
                <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full font-medium cursor-pointer transition-colors"
                  style={{ background: "var(--accent-cyan-dim)", color: "#4DA3FF", border: "1px solid var(--accent-cyan-border)" }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Admin reports panel */}
          {adminToken && showAdminPanel && (
            <AdminReportsPanel adminToken={adminToken} />
          )}
        </div>
      </div>

      {/* Report modal */}
      {reportingPost && (
        <ReportModal
          post={reportingPost}
          onClose={() => setReportingPost(null)}
          onDone={() => setReportingPost(null)}
        />
      )}
    </div>
  );
}
