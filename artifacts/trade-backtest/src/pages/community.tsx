import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart, Flag, Trash2, Send, ImageIcon, X,
  AlertTriangle, CheckCircle, Users,
  MessageSquare, RefreshCw, Shield, Upload,
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
  const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
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
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-black/8 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/6">
          <div className="flex items-center gap-2">
            <Flag style={{ height: 15, width: 15, color: "#ef4444" }} />
            <span className="text-[14px] font-semibold" style={{ color: "#111" }}>Report Post</span>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors">
            <X style={{ height: 13, width: 13, color: "#888" }} />
          </button>
        </div>

        {done ? (
          <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle style={{ height: 36, width: 36, color: "#16a34a" }} />
            <p className="text-[14px] font-medium" style={{ color: "#111" }}>Report submitted</p>
            <p className="text-[12px]" style={{ color: "#888" }}>Our admin will review it shortly.</p>
          </div>
        ) : (
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="rounded-xl p-3 text-[12px] font-mono" style={{ background: "#f7f7f7", color: "#555", maxHeight: 60, overflow: "hidden" }}>
              {post.content.slice(0, 120)}{post.content.length > 120 ? "…" : ""}
            </div>

            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#888" }}>Your name</label>
              <input
                value={reporterName}
                onChange={e => setReporterName(e.target.value)}
                placeholder="Display name"
                className="mt-1 w-full px-3 py-2 rounded-xl text-[13px] border outline-none focus:border-black/30 transition-colors"
                style={{ background: "#fafafa", border: "1px solid #e5e5e5", color: "#111" }}
              />
            </div>

            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#888" }}>Reason</label>
              <div className="mt-1 flex flex-col gap-1">
                {REASONS.map(r => (
                  <button key={r} onClick={() => setReason(r)}
                    className="text-left px-3 py-2 rounded-xl text-[13px] transition-all"
                    style={reason === r
                      ? { background: "#111", color: "#fff" }
                      : { background: "#f5f5f5", color: "#444", border: "1px solid transparent" }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-[12px] text-red-500">{error}</p>}

            <button onClick={submit} disabled={sending}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50"
              style={{ background: "#ef4444", color: "#fff" }}>
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
    <article className="rounded-2xl border bg-white overflow-hidden transition-shadow hover:shadow-sm"
      style={{ border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
          style={{ background: avatarColor(post.authorName) }}>
          {initials(post.authorName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold" style={{ color: "#111" }}>{post.authorName}</span>
            <span className="text-[11px]" style={{ color: "#bbb" }}>{timeAgo(post.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: "#333" }}>{post.content}</p>
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
      <div className="flex items-center gap-1 px-3 pb-3 border-t border-black/4 pt-2.5 mt-1">
        <button
          onClick={() => onLike(post.id, liked)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all"
          style={liked
            ? { background: "#fef2f2", color: "#ef4444" }
            : { background: "transparent", color: "#888" }}>
          <Heart style={{ height: 13, width: 13, fill: liked ? "#ef4444" : "none" }} />
          {post.likes > 0 ? post.likes : "Like"}
        </button>

        <button
          onClick={() => onReport(post)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] transition-all ml-auto"
          style={{ color: "#bbb" }}
          title="Report this post">
          <Flag style={{ height: 12, width: 12 }} />
          Report
        </button>

        {adminToken && (
          confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onDelete(post.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" }}>
                <Trash2 style={{ height: 11, width: 11 }} /> Confirm
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1.5 text-[11px] rounded-xl" style={{ color: "#888" }}>
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
    if (file.size > 4 * 1024 * 1024) {
      setError("Image must be under 4 MB.");
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
          authorName: displayName.trim(),
          content: content.trim(),
          imageUrl: imagePreview ?? undefined,
          userId: user?.id ?? undefined,
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
    <div className="rounded-2xl border bg-white overflow-hidden"
      style={{ border: "1px solid rgba(0,0,0,0.09)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>

      <div className="px-4 pt-4 pb-3 border-b border-black/5">
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
                style={{ color: "#111" }}
              />
            ) : (
              <span className="text-[13px] font-semibold" style={{ color: "#111" }}>{user.name}</span>
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
          style={{ color: "#222", minHeight: 80, maxHeight: 300 }}
          rows={3}
        />
      </div>

      {imagePreview && (
        <div className="px-4 pb-3 relative">
          <img src={imagePreview} alt="preview" className="rounded-xl w-full object-cover"
            style={{ maxHeight: 200, border: "1px solid rgba(0,0,0,0.06)" }} />
          <button onClick={clearImage}
            className="absolute top-2 right-6 h-6 w-6 flex items-center justify-center rounded-full"
            style={{ background: "rgba(0,0,0,0.55)" }}>
            <X style={{ height: 11, width: 11, color: "#fff" }} />
          </button>
        </div>
      )}

      {error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-xl text-[12px] flex items-center gap-2"
          style={{ background: "#fef2f2", color: "#dc2626" }}>
          <AlertTriangle style={{ height: 12, width: 12, flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <div className="flex items-center gap-2 px-4 py-3 border-t border-black/5">
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] transition-all"
          style={imagePreview
            ? { background: "#eff6ff", color: "#3b82f6" }
            : { background: "#f5f5f5", color: "#666" }}>
          <Upload style={{ height: 12, width: 12 }} />
          {imagePreview ? "Change" : "Photo"}
        </button>

        <span className="text-[11px] ml-auto" style={{ color: overLimit ? "#ef4444" : "#ccc" }}>
          {charCount}/1200
        </span>

        <button
          onClick={submit}
          disabled={sending || overLimit || !content.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
          style={{ background: "#111", color: "#fff" }}>
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
    <div className="rounded-2xl border bg-white overflow-hidden"
      style={{ border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>

      <div className="flex items-center justify-between px-4 py-3 border-b border-black/6">
        <div className="flex items-center gap-2">
          <Shield style={{ height: 14, width: 14, color: "#888" }} />
          <span className="text-[13px] font-semibold" style={{ color: "#111" }}>Reports</span>
          {pendingCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#fef2f2", color: "#dc2626" }}>
              {pendingCount} pending
            </span>
          )}
        </div>
        <button onClick={load} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors">
          <RefreshCw style={{ height: 12, width: 12, color: "#888" }} />
        </button>
      </div>

      <div className="flex gap-1 p-2 border-b border-black/5">
        {(["pending", "all", "resolved", "dismissed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-lg text-[11px] font-medium capitalize transition-all"
            style={filter === f ? { background: "#111", color: "#fff" } : { color: "#888" }}>
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
                    <span className="text-[11px] font-medium" style={{ color: "#555" }}>by {r.postAuthor}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      r.status === "pending" ? "bg-amber-50 text-amber-600" :
                      r.status === "resolved" ? "bg-green-50 text-green-600" :
                      "bg-gray-100 text-gray-500"
                    }`}>{r.status}</span>
                    {r.postDeleted && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500">post deleted</span>}
                  </div>
                  <p className="text-[12px] rounded-lg px-2.5 py-2" style={{ background: "#f7f7f7", color: "#444", fontFamily: "monospace" }}>
                    {r.postContent.slice(0, 100)}{r.postContent.length > 100 ? "…" : ""}
                  </p>
                  <p className="text-[11px] mt-1.5" style={{ color: "#777" }}>
                    Reported by <strong>{r.reporterName}</strong>: {r.reason}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#ccc" }}>{timeAgo(r.createdAt)}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {!r.postDeleted && (
                  <button onClick={() => deletePost(r.postId)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                    style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" }}>
                    <Trash2 style={{ height: 10, width: 10 }} /> Delete Post
                  </button>
                )}
                {r.status === "pending" && (
                  <>
                    <button onClick={() => updateStatus(r.id, "resolved")}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                      style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
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
            <MessageSquare style={{ height: 20, width: 20, color: "#111" }} />
            <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "#111" }}>Community</h1>
          </div>
          <p className="text-[13px]" style={{ color: "#888" }}>Share trading ideas, insights, and quotes with fellow traders.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-4 px-4 py-2 rounded-xl border" style={{ background: "#f9fafb", border: "1px solid rgba(0,0,0,0.08)" }}>
            {[
              { icon: MessageSquare, value: stats.posts, label: "Posts" },
              { icon: Users, value: stats.members, label: "Members" },
              { icon: Heart, value: stats.likes, label: "Likes" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5 text-center">
                <s.icon style={{ height: 12, width: 12, color: "#aaa" }} />
                <span className="text-[13px] font-semibold" style={{ color: "#111" }}>{s.value}</span>
                <span className="text-[11px] hidden sm:inline" style={{ color: "#aaa" }}>{s.label}</span>
              </div>
            ))}
          </div>

          <button onClick={fetchPosts}
            className="h-9 w-9 flex items-center justify-center rounded-xl border transition-colors hover:bg-black/5"
            style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
            <RefreshCw style={{ height: 14, width: 14, color: "#666" }} />
          </button>

          {adminToken && (
            <button onClick={() => setShowAdminPanel(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium border transition-all"
              style={showAdminPanel
                ? { background: "#111", color: "#fff", border: "1px solid #111" }
                : { background: "#f5f5f5", color: "#444", border: "1px solid rgba(0,0,0,0.09)" }}>
              <Shield style={{ height: 13, width: 13 }} />
              Admin
            </button>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl px-4 py-3 border flex items-start gap-3"
        style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
        <AlertTriangle style={{ height: 14, width: 14, color: "#d97706", flexShrink: 0, marginTop: 1 }} />
        <p className="text-[12px] leading-relaxed" style={{ color: "#92400e" }}>
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
                <div key={i} className="rounded-2xl border bg-white p-4 animate-pulse" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-9 w-9 rounded-full" style={{ background: "#f0f0f0" }} />
                    <div className="flex-1">
                      <div className="h-3 rounded w-28 mb-1.5" style={{ background: "#f0f0f0" }} />
                      <div className="h-2.5 rounded w-16" style={{ background: "#f5f5f5" }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 rounded w-full" style={{ background: "#f5f5f5" }} />
                    <div className="h-3 rounded w-4/5" style={{ background: "#f5f5f5" }} />
                    <div className="h-3 rounded w-3/5" style={{ background: "#f5f5f5" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border p-8 text-center" style={{ border: "1px solid rgba(0,0,0,0.07)" }}>
              <AlertTriangle style={{ height: 28, width: 28, color: "#f59e0b", margin: "0 auto 12px" }} />
              <p className="text-[13px]" style={{ color: "#666" }}>{error}</p>
              <button onClick={fetchPosts} className="mt-3 px-4 py-2 rounded-xl text-[12px] font-medium" style={{ background: "#f5f5f5" }}>Retry</button>
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border p-12 text-center" style={{ border: "1px dashed rgba(0,0,0,0.12)" }}>
              <MessageSquare style={{ height: 36, width: 36, color: "#ddd", margin: "0 auto 12px" }} />
              <p className="text-[15px] font-medium mb-1" style={{ color: "#333" }}>No posts yet</p>
              <p className="text-[13px]" style={{ color: "#aaa" }}>Be the first to share a trading idea!</p>
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
          <div className="rounded-2xl border bg-white p-4" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
            <p className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: "#aaa" }}>Community Guidelines</p>
            <ul className="flex flex-col gap-2">
              {[
                "Be respectful and constructive",
                "No financial advice or pump & dump",
                "No offensive or abusive language",
                "No spam or self-promotion links",
                "Only post relevant trading content",
                "Report posts that violate rules",
              ].map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "#555" }}>
                  <span className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-px"
                    style={{ background: "#f0f0f0", color: "#888" }}>{i + 1}</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>

          {/* Top contributors */}
          {posts.length > 0 && (
            <div className="rounded-2xl border bg-white p-4" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
              <p className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: "#aaa" }}>Top Contributors</p>
              <div className="flex flex-col gap-2">
                {(() => {
                  const map: Record<string, number> = {};
                  posts.forEach(p => { map[p.authorName] = (map[p.authorName] ?? 0) + 1; });
                  return Object.entries(map)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([name, count], i) => (
                      <div key={name} className="flex items-center gap-2.5">
                        <span className="text-[11px] font-mono w-4 text-right flex-shrink-0" style={{ color: "#ccc" }}>{i + 1}</span>
                        <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background: avatarColor(name) }}>
                          {initials(name)}
                        </div>
                        <span className="text-[12px] font-medium flex-1 truncate" style={{ color: "#333" }}>{name}</span>
                        <span className="text-[11px]" style={{ color: "#bbb" }}>{count} post{count !== 1 ? "s" : ""}</span>
                      </div>
                    ));
                })()}
              </div>
            </div>
          )}

          {/* Trending topics / tags placeholder */}
          <div className="rounded-2xl border bg-white p-4" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
            <p className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: "#aaa" }}>Trending Topics</p>
            <div className="flex flex-wrap gap-1.5">
              {["#BTC", "#ETH", "#Options", "#SwingTrade", "#RSI", "#MACD", "#Fibonacci", "#DayTrading", "#Risk Management", "#Crypto"].map(tag => (
                <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full font-medium cursor-pointer transition-colors hover:bg-black/5"
                  style={{ background: "#f4f4f5", color: "#555" }}>
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
