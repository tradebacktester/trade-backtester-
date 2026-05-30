import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Shield, Users, FileText, LogOut, Ban, CheckCircle, RefreshCw, Save, ChevronDown, ChevronUp, UserCheck, UserX } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface AdminUser {
  id: number;
  email: string;
  name: string;
  banned: boolean;
  bannedReason: string | null;
  createdAt: string;
}

interface Policy {
  id: number;
  slug: string;
  title: string;
  content: string;
  updatedAt: string;
}

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { adminToken, setAdminToken } = useAuth();
  const [tab, setTab] = useState<"users" | "policies">("users");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<Record<string, string>>({});
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [banReason, setBanReason] = useState<Record<number, string>>({});

  const headers = { "Content-Type": "application/json", "x-admin-token": adminToken ?? "" };

  useEffect(() => {
    if (!adminToken) { setLocation("/admin"); return; }
  }, [adminToken]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true); setUsersError("");
    try {
      const res = await fetch("/api/admin/users", { headers });
      if (res.status === 401) { setAdminToken(null); setLocation("/admin"); return; }
      setUsers(await res.json());
    } catch { setUsersError("Failed to load users"); }
    finally { setUsersLoading(false); }
  }, [adminToken]);

  const fetchPolicies = useCallback(async () => {
    setPoliciesLoading(true);
    try {
      const res = await fetch("/api/admin/policies", { headers });
      const data: Policy[] = await res.json();
      setPolicies(data);
      const init: Record<string, string> = {};
      data.forEach(p => { init[p.slug] = p.content; });
      setEditingContent(init);
    } catch { /* ignore */ }
    finally { setPoliciesLoading(false); }
  }, [adminToken]);

  useEffect(() => { if (adminToken) { fetchUsers(); fetchPolicies(); } }, [adminToken]);

  async function toggleBan(user: AdminUser) {
    const reason = !user.banned ? (banReason[user.id] || null) : null;
    const res = await fetch(`/api/admin/users/${user.id}/ban`, {
      method: "POST",
      headers,
      body: JSON.stringify({ banned: !user.banned, reason }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers(us => us.map(u => u.id === user.id ? { ...u, banned: updated.banned, bannedReason: updated.bannedReason } : u));
    }
  }

  async function savePolicy(slug: string, title: string) {
    setSavingSlug(slug);
    try {
      const res = await fetch(`/api/admin/policies/${slug}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ content: editingContent[slug], title }),
      });
      if (res.ok) {
        const updated: Policy = await res.json();
        setPolicies(ps => ps.map(p => p.slug === slug ? updated : p));
        setSavedSlug(slug);
        setTimeout(() => setSavedSlug(null), 2000);
      }
    } finally { setSavingSlug(null); }
  }

  function handleLogout() {
    setAdminToken(null);
    setLocation("/admin");
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "#f0f0f0" }}>
            <Shield style={{ height: "16px", width: "16px", color: "#111" }} />
          </span>
          <div>
            <h1 className="text-base font-semibold" style={{ color: "#111" }}>Admin Panel</h1>
            <p className="text-xs" style={{ color: "#888" }}>Manage users and platform policies</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
          style={{ border: "1px solid rgba(0,0,0,0.1)", color: "#666", background: "#f5f5f5" }}
        >
          <LogOut style={{ height: "12px", width: "12px" }} />
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([["users", Users, "Users"], ["policies", FileText, "Policies"]] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={tab === key
              ? { background: "#111", color: "#fff" }
              : { background: "#f5f5f5", color: "#666", border: "1px solid rgba(0,0,0,0.08)" }
            }
          >
            <Icon style={{ height: "13px", width: "13px" }} />
            {label}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.09)", background: "#fff" }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
            <div className="flex items-center gap-2">
              <Users style={{ height: "14px", width: "14px", color: "#666" }} />
              <span className="text-sm font-semibold" style={{ color: "#111" }}>Registered Users</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0f0f0", color: "#666" }}>{users.length}</span>
            </div>
            <button onClick={fetchUsers} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: "#888" }}>
              <RefreshCw style={{ height: "13px", width: "13px" }} />
            </button>
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: "#aaa" }}>Loading users…</div>
          ) : usersError ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: "#dc2626" }}>{usersError}</div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Users style={{ height: "28px", width: "28px", color: "#ddd" }} />
              <p className="text-sm" style={{ color: "#aaa" }}>No users have signed up yet</p>
            </div>
          ) : (
            <div>
              {users.map((user, i) => (
                <div
                  key={user.id}
                  className="px-5 py-4"
                  style={{ borderBottom: i < users.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none", background: user.banned ? "#fef9f9" : "transparent" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="h-9 w-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold"
                        style={{ background: user.banned ? "#fee2e2" : "#f0f0f0", color: user.banned ? "#dc2626" : "#555" }}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate" style={{ color: "#111" }}>{user.name}</span>
                          {user.banned && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "#fee2e2", color: "#dc2626" }}>BANNED</span>
                          )}
                        </div>
                        <p className="text-xs truncate" style={{ color: "#888" }}>{user.email}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "#bbb" }}>
                          Joined {new Date(user.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        {user.banned && user.bannedReason && (
                          <p className="text-[10px] mt-0.5" style={{ color: "#dc2626" }}>Reason: {user.bannedReason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {!user.banned && (
                        <input
                          type="text"
                          placeholder="Ban reason (optional)"
                          value={banReason[user.id] ?? ""}
                          onChange={e => setBanReason(r => ({ ...r, [user.id]: e.target.value }))}
                          className="text-[11px] px-2 py-1 rounded-lg w-40"
                          style={{ border: "1px solid rgba(0,0,0,0.1)", background: "#f9f9f9", color: "#555" }}
                        />
                      )}
                      <button
                        onClick={() => toggleBan(user)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                        style={user.banned
                          ? { background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" }
                          : { background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" }
                        }
                      >
                        {user.banned
                          ? <><UserCheck style={{ height: "11px", width: "11px" }} />Unban</>
                          : <><UserX style={{ height: "11px", width: "11px" }} />Ban</>
                        }
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Policies tab */}
      {tab === "policies" && (
        <div className="flex flex-col gap-3">
          {policiesLoading ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: "#aaa" }}>Loading policies…</div>
          ) : policies.map(policy => (
            <div
              key={policy.slug}
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(0,0,0,0.09)", background: "#fff" }}
            >
              <button
                onClick={() => setExpandedPolicy(v => v === policy.slug ? null : policy.slug)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <FileText style={{ height: "14px", width: "14px", color: "#888" }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#111" }}>{policy.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#bbb" }}>
                      Last updated {new Date(policy.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                {expandedPolicy === policy.slug
                  ? <ChevronUp style={{ height: "14px", width: "14px", color: "#aaa" }} />
                  : <ChevronDown style={{ height: "14px", width: "14px", color: "#aaa" }} />
                }
              </button>

              {expandedPolicy === policy.slug && (
                <div className="px-5 pb-5" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  <p className="text-[11px] font-medium mt-4 mb-2" style={{ color: "#666" }}>Policy Content</p>
                  <textarea
                    value={editingContent[policy.slug] ?? ""}
                    onChange={e => setEditingContent(c => ({ ...c, [policy.slug]: e.target.value }))}
                    rows={8}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-y"
                    style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fafafa", color: "#333", lineHeight: 1.6 }}
                    onFocus={e => (e.target.style.borderColor = "rgba(0,0,0,0.3)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(0,0,0,0.12)")}
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    {savedSlug === policy.slug && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#16a34a" }}>
                        <CheckCircle style={{ height: "11px", width: "11px" }} />Saved
                      </span>
                    )}
                    <button
                      onClick={() => savePolicy(policy.slug, policy.title)}
                      disabled={savingSlug === policy.slug}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-opacity"
                      style={{ background: "#111", color: "#fff", opacity: savingSlug === policy.slug ? 0.6 : 1 }}
                    >
                      <Save style={{ height: "11px", width: "11px" }} />
                      {savingSlug === policy.slug ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
