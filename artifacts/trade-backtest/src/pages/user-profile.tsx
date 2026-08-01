import React, { useEffect, useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, BarChart2, Layers, Calendar, TrendingUp, TrendingDown,
  Users, UserPlus, UserCheck, MessageSquare, Edit2, Check, X,
  Award, Target, Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

interface PublicProfile {
  id: number;
  name: string;
  username: string | null;
  bio: string | null;
  tradingStyle: string | null;
  joinedAt: string;
  totalBacktests: number;
  totalStrategies: number;
  followerCount: number;
  followingCount: number;
  avgWinRate: number | null;
  avgReturn: number | null;
  isOwnProfile: boolean;
  isFollowing: boolean;
}

interface FollowUser {
  id: number;
  name: string;
  username: string | null;
}

const AVATAR_PALETTE = [
  "#1a3557", "#0d3d2b", "#3b1557", "#5a2d0c",
  "#141457", "#4d0f2e", "#0d4d4d", "#2d4d0d",
];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}
function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
function fmt(n: number | null, decimals = 1): string {
  if (n == null) return "—";
  return n.toFixed(decimals);
}
function fmtK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function StatPill({ label, value, color = "#818cf8" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      flex: "1 1 120px",
      padding: "14px 16px",
      borderRadius: 14,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
    </div>
  );
}

function FollowList({ userId, type, onClose }: { userId: number; type: "followers" | "following"; onClose: () => void }) {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(`${API_BASE}/api/users/${userId}/${type}`, { headers })
      .then(r => r.json())
      .then((data: FollowUser[]) => setUsers(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, type, token]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div style={{
        width: "min(420px, 92vw)",
        maxHeight: "70vh",
        background: "#111",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 20,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
            {type === "followers" ? "Followers" : "Following"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", padding: 4 }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading && <p style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 13, padding: 24 }}>Loading…</p>}
          {!loading && users.length === 0 && (
            <p style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 13, padding: 24 }}>None yet.</p>
          )}
          {users.map(u => (
            <button key={u.id} onClick={() => { onClose(); navigate(u.username ? `/u/${u.username}` : `/user/${u.id}`); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "12px 20px", background: "none", border: "none",
                cursor: "pointer", textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <div style={{
                width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                background: avatarColor(u.name),
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.9)", fontWeight: 600, fontSize: 14,
              }}>{initials(u.name)}</div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)", margin: 0 }}>{u.name}</p>
                {u.username && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0 }}>@{u.username}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  // Support both /u/:username and /user/:id routes
  const [, uParams] = useRoute("/u/:username");
  const [, idParams] = useRoute("/user/:id");
  const { token, user: me } = useAuth();
  const [, navigate] = useLocation();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showList, setShowList] = useState<"followers" | "following" | null>(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editStyle, setEditStyle] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const apiUrl = uParams?.username
    ? `${API_BASE}/api/users/by-username/${encodeURIComponent(uParams.username)}`
    : idParams?.id
      ? `${API_BASE}/api/users/${idParams.id}`
      : null;

  const load = useCallback(() => {
    if (!apiUrl) { setError("Invalid profile URL"); setLoading(false); return; }
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(apiUrl, { headers })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "Not found");
        return r.json() as Promise<PublicProfile>;
      })
      .then(data => {
        setProfile(data);
        setFollowing(data.isFollowing);
        setEditBio(data.bio ?? "");
        setEditStyle(data.tradingStyle ?? "");
        setEditUsername(data.username ?? "");
        setEditName(data.name);
      })
      .catch(e => setError((e as Error).message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [apiUrl, token]);

  useEffect(() => { load(); }, [load]);

  async function toggleFollow() {
    if (!token || !profile) return;
    setFollowLoading(true);
    try {
      const method = following ? "DELETE" : "POST";
      const r = await fetch(`${API_BASE}/api/users/${profile.id}/follow`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setFollowing(!following);
        setProfile(p => p ? { ...p, followerCount: p.followerCount + (following ? -1 : 1) } : p);
      }
    } finally { setFollowLoading(false); }
  }

  async function saveEdit() {
    if (!token) return;
    setSaving(true); setEditError("");
    try {
      const r = await fetch(`${API_BASE}/api/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editName,
          username: editUsername,
          bio: editBio,
          tradingStyle: editStyle,
        }),
      });
      const data = await r.json() as { error?: string; username?: string };
      if (!r.ok) { setEditError(data.error ?? "Save failed"); return; }
      setEditing(false);
      // If username changed, navigate to new URL
      if (data.username && data.username !== profile?.username) {
        navigate(`/u/${data.username}`, { replace: true });
      } else {
        load();
      }
    } catch { setEditError("Save failed"); }
    finally { setSaving(false); }
  }

  function goToDM() {
    navigate("/community");
  }

  if (loading) return (
    <div style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(255,255,255,0.07)", animation: "pulse 1.5s ease infinite" }} />
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Loading profile…</p>
      </div>
    </div>
  );

  if (error || !profile) return (
    <div style={{ minHeight: "50vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Users style={{ width: 44, height: 44, color: "rgba(255,255,255,0.12)" }} />
      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)" }}>{error || "User not found"}</p>
      <button onClick={() => navigate("/community")} style={{
        display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 16px",
        borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)",
        border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
      }}>
        <ArrowLeft style={{ width: 13, height: 13 }} /> Community
      </button>
    </div>
  );

  const joinedDate = new Date(profile.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 60 }}>
      {showList && (
        <FollowList userId={profile.id} type={showList} onClose={() => setShowList(null)} />
      )}

      {/* Back */}
      <button onClick={() => navigate(-1 as unknown as string)}
        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", marginBottom: 20, padding: 0 }}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> Back
      </button>

      {/* Profile card */}
      <div style={{ borderRadius: 24, overflow: "hidden", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {/* Banner */}
        <div style={{ height: 100, background: `linear-gradient(135deg, ${avatarColor(profile.name)}cc, ${avatarColor(profile.name)}44)` }} />

        {/* Avatar + Actions row */}
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: -28, marginBottom: 16 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20,
              background: avatarColor(profile.name),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, fontWeight: 700, color: "rgba(255,255,255,0.95)",
              border: "4px solid #080808", flexShrink: 0,
            }}>{initials(profile.name)}</div>

            <div style={{ display: "flex", gap: 8 }}>
              {profile.isOwnProfile ? (
                editing ? (
                  <>
                    <button onClick={saveEdit} disabled={saving} style={{
                      display: "flex", alignItems: "center", gap: 5, fontSize: 12,
                      padding: "7px 14px", borderRadius: 10, cursor: "pointer",
                      background: "rgba(255,255,255,0.9)", color: "#050505",
                      border: "none", fontWeight: 600, opacity: saving ? 0.6 : 1,
                    }}>
                      <Check style={{ width: 12, height: 12 }} /> {saving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => { setEditing(false); setEditError(""); }} style={{
                      display: "flex", alignItems: "center", gap: 5, fontSize: 12,
                      padding: "7px 14px", borderRadius: 10, cursor: "pointer",
                      background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}>
                      <X style={{ width: 12, height: 12 }} /> Cancel
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditing(true)} style={{
                    display: "flex", alignItems: "center", gap: 5, fontSize: 12,
                    padding: "7px 14px", borderRadius: 10, cursor: "pointer",
                    background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}>
                    <Edit2 style={{ width: 12, height: 12 }} /> Edit Profile
                  </button>
                )
              ) : token ? (
                <>
                  <button onClick={goToDM} style={{
                    display: "flex", alignItems: "center", gap: 5, fontSize: 12,
                    padding: "7px 14px", borderRadius: 10, cursor: "pointer",
                    background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}>
                    <MessageSquare style={{ width: 12, height: 12 }} /> Message
                  </button>
                  <button onClick={toggleFollow} disabled={followLoading} style={{
                    display: "flex", alignItems: "center", gap: 5, fontSize: 12,
                    padding: "7px 14px", borderRadius: 10, cursor: "pointer",
                    background: following ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.92)",
                    color: following ? "rgba(255,255,255,0.7)" : "#050505",
                    border: following ? "1px solid rgba(255,255,255,0.15)" : "none",
                    fontWeight: 600, opacity: followLoading ? 0.6 : 1,
                  }}>
                    {following
                      ? <><UserCheck style={{ width: 12, height: 12 }} /> Following</>
                      : <><UserPlus style={{ width: 12, height: 12 }} /> Follow</>}
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {/* Edit form */}
          {editing && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16, padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {editError && <p style={{ fontSize: 12, color: "#FF453A", margin: 0 }}>{editError}</p>}
              <div>
                <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 4 }}>Display Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} maxLength={60}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.9)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 4 }}>Username</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>@</span>
                  <input value={editUsername} onChange={e => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} maxLength={30}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.9)", fontSize: 13, outline: "none" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 4 }}>Bio <span style={{ opacity: 0.5 }}>(max 300 chars)</span></label>
                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} maxLength={300} rows={3}
                  placeholder="Tell traders about yourself…"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.9)", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 4 }}>Trading Style</label>
                <input value={editStyle} onChange={e => setEditStyle(e.target.value)} maxLength={60}
                  placeholder="e.g. Swing trader, Scalper, Long-term…"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.9)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
          )}

          {/* Name + username + bio */}
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.95)", margin: "0 0 2px" }}>{profile.name}</h1>
          {profile.username && (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 8px", fontFamily: "'JetBrains Mono', monospace" }}>@{profile.username}</p>
          )}
          {profile.bio && (
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", margin: "0 0 10px", lineHeight: 1.5 }}>{profile.bio}</p>
          )}

          {/* Badges row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {profile.tradingStyle && (
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(135,134,129,0.15)", color: "#C0C0C0", border: "1px solid rgba(135,134,129,0.2)", fontWeight: 500 }}>
                <Zap style={{ width: 9, height: 9, display: "inline", marginRight: 4 }} />{profile.tradingStyle}
              </span>
            )}
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Calendar style={{ width: 9, height: 9, display: "inline", marginRight: 4 }} />Joined {joinedDate}
            </span>
          </div>

          {/* Follower / following counts */}
          <div style={{ display: "flex", gap: 20 }}>
            <button onClick={() => setShowList("followers")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>{fmtK(profile.followerCount)}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>Followers</span>
            </button>
            <button onClick={() => setShowList("following")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>{fmtK(profile.followingCount)}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>Following</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        <StatPill label="Backtests" value={String(profile.totalBacktests)} color="#818cf8" />
        <StatPill label="Strategies" value={String(profile.totalStrategies)} color="#C0C0C0" />
        <StatPill
          label="Avg Win Rate"
          value={profile.avgWinRate != null ? `${fmt(profile.avgWinRate, 1)}%` : "—"}
          color={profile.avgWinRate != null && profile.avgWinRate >= 50 ? "#34C759" : "#FF453A"}
        />
        <StatPill
          label="Avg Return"
          value={profile.avgReturn != null ? `${profile.avgReturn >= 0 ? "+" : ""}${fmt(profile.avgReturn, 1)}%` : "—"}
          color={profile.avgReturn != null && profile.avgReturn >= 0 ? "#34C759" : "#FF453A"}
        />
      </div>

      {/* Activity summary */}
      <div style={{ marginTop: 16, padding: "18px 20px", borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px" }}>Activity</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BarChart2 style={{ width: 15, height: 15, color: "#818cf8" }} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              <strong style={{ color: "rgba(255,255,255,0.85)" }}>{profile.totalBacktests}</strong> backtests run
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Layers style={{ width: 15, height: 15, color: "#C0C0C0" }} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              <strong style={{ color: "rgba(255,255,255,0.85)" }}>{profile.totalStrategies}</strong> strategies created
            </span>
          </div>
          {profile.avgWinRate != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Target style={{ width: 15, height: 15, color: "#34C759" }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                <strong style={{ color: "rgba(255,255,255,0.85)" }}>{fmt(profile.avgWinRate, 1)}%</strong> average win rate across completed backtests
              </span>
            </div>
          )}
          {profile.avgReturn != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {profile.avgReturn >= 0
                ? <TrendingUp style={{ width: 15, height: 15, color: "#34C759" }} />
                : <TrendingDown style={{ width: 15, height: 15, color: "#FF453A" }} />}
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                <strong style={{ color: profile.avgReturn >= 0 ? "#34C759" : "#FF453A" }}>
                  {profile.avgReturn >= 0 ? "+" : ""}{fmt(profile.avgReturn, 2)}%
                </strong> average backtest return
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Achievements */}
      <div style={{ marginTop: 16, padding: "18px 20px", borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px" }}>Achievements</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {profile.totalBacktests >= 1 && (
            <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "rgba(192,192,192,0.12)", color: "#C0C0C0", border: "1px solid rgba(192,192,192,0.2)", display: "flex", alignItems: "center", gap: 5 }}>
              <Award style={{ width: 10, height: 10 }} /> First Backtest
            </span>
          )}
          {profile.totalBacktests >= 10 && (
            <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "rgba(192,192,192,0.12)", color: "#C0C0C0", border: "1px solid rgba(192,192,192,0.2)", display: "flex", alignItems: "center", gap: 5 }}>
              <Award style={{ width: 10, height: 10 }} /> 10 Backtests
            </span>
          )}
          {profile.totalStrategies >= 5 && (
            <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "rgba(135,134,129,0.12)", color: "#C0C0C0", border: "1px solid rgba(135,134,129,0.2)", display: "flex", alignItems: "center", gap: 5 }}>
              <Layers style={{ width: 10, height: 10 }} /> Strategy Builder
            </span>
          )}
          {profile.followerCount >= 5 && (
            <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "rgba(52,199,89,0.12)", color: "#34C759", border: "1px solid rgba(52,199,89,0.2)", display: "flex", alignItems: "center", gap: 5 }}>
              <Users style={{ width: 10, height: 10 }} /> Rising Trader
            </span>
          )}
          {profile.avgWinRate != null && profile.avgWinRate >= 60 && (
            <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "rgba(52,199,89,0.12)", color: "#34C759", border: "1px solid rgba(52,199,89,0.2)", display: "flex", alignItems: "center", gap: 5 }}>
              <TrendingUp style={{ width: 10, height: 10 }} /> High Win Rate
            </span>
          )}
          {profile.totalBacktests === 0 && profile.totalStrategies === 0 && (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", margin: 0 }}>No achievements yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
