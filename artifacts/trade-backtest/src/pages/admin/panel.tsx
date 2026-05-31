import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Shield, Users, FileText, LogOut, Ban, CheckCircle, RefreshCw, Save,
  ChevronDown, ChevronUp, UserCheck, UserX, Crown, CreditCard, Zap,
  Plus, Edit2, ToggleLeft, ToggleRight, Gift, Trash2, Star,
  X, Check, Package, AlertCircle, Calendar, Hash,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface AdminUser {
  id: number; email: string; name: string; banned: boolean; bannedReason: string | null; createdAt: string;
}
interface Policy {
  id: number; slug: string; title: string; content: string; updatedAt: string;
}
interface SubscriptionPlan {
  id: number; name: string; slug: string; description: string; priceMonthly: number;
  currency: string; features: Record<string, unknown>; isActive: boolean; isDefault: boolean; sortOrder: number;
  createdAt: string; updatedAt: string;
}
interface AdminSubscription {
  id: number; userId: number; planId: number; status: string; grantedByAdmin: boolean;
  currentPeriodEnd: string | null; createdAt: string; userName: string | null;
  userEmail: string | null; planName: string | null; planSlug: string | null;
}
interface AdminPayment {
  id: number; userId: number; planId: number; razorpayOrderId: string;
  razorpayPaymentId: string | null; amount: number; currency: string;
  status: string; createdAt: string; userName: string | null; userEmail: string | null; planName: string | null;
}

const FEATURE_LABELS: Record<string, string> = {
  maxBacktestsPerMonth: "Backtests/month",
  aiQueriesPerDay: "AI queries/day",
  maxLeverage: "Max leverage",
  communityPost: "Community posting",
  replayMode: "Replay mode",
  multiTfView: "Multi-TF view",
  dataExport: "Data export",
  priorityBadge: "Priority badge",
  allIndicators: "All indicators",
};
const FEATURE_TYPES: Record<string, "number" | "boolean"> = {
  maxBacktestsPerMonth: "number", aiQueriesPerDay: "number", maxLeverage: "number",
  communityPost: "boolean", replayMode: "boolean", multiTfView: "boolean",
  dataExport: "boolean", priorityBadge: "boolean", allIndicators: "boolean",
};

const SUBS_STAT_ICONS = {
  Total:          <Star style={{ height: "13px", width: "13px" }} />,
  Active:         <CheckCircle style={{ height: "13px", width: "13px" }} />,
  "Admin Grants": <Gift style={{ height: "13px", width: "13px" }} />,
};

const PLAN_ACCENT: Record<string, { color: string; bg: string; border: string }> = {
  free:  { color: "#666",               bg: "rgba(0,0,0,0.05)",          border: "rgba(0,0,0,0.12)" },
  pro:   { color: "hsl(265,89%,60%)",   bg: "rgba(139,92,246,0.08)",     border: "rgba(139,92,246,0.25)" },
  elite: { color: "hsl(38,100%,50%)",   bg: "rgba(245,158,11,0.08)",     border: "rgba(245,158,11,0.28)" },
};

function planAccent(slug: string) {
  return PLAN_ACCENT[slug] ?? PLAN_ACCENT.free;
}

type Tab = "users" | "policies" | "plans" | "subscribers" | "payments";

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { adminToken, setAdminToken } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  // Once a tab has been visited its panel stays mounted (just hidden via CSS).
  // This prevents Chrome from needing to rasterize from scratch on every revisit.
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set<Tab>(["users"]));

  // Stable headers — recomputed only when adminToken changes, not on every render.
  // Computing inline in component body created a new object every render, causing
  // stale closures in all useCallback functions.
  const headers = useMemo(
    () => ({ "Content-Type": "application/json", "x-admin-token": adminToken ?? "" }),
    [adminToken]
  );

  // ── Users ──
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [banReason, setBanReason] = useState<Record<number, string>>({});

  // ── Policies ──
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<Record<string, string>>({});
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  // ── Plans ──
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<SubscriptionPlan | null>(null);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: "", slug: "", description: "", priceMonthly: 0 });
  const [savingPlan, setSavingPlan] = useState<number | null>(null);

  // ── Subscribers ──
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantPlanId, setGrantPlanId] = useState("");
  const [grantMonths, setGrantMonths] = useState("1");
  const [granting, setGranting] = useState(false);
  const [grantSuccess, setGrantSuccess] = useState(false);
  const [subsFilter, setSubsFilter] = useState<"all" | "active" | "cancelled">("all");

  // ── Payments ──
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  useEffect(() => { if (!adminToken) { setLocation("/admin"); return; } }, [adminToken]);

  // useCallback deps now include `headers` (stable useMemo reference) so closures
  // always have the current token without triggering unnecessary recreations.
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true); setUsersError("");
    try {
      const res = await fetch("/api/admin/users", { headers });
      if (res.status === 401) { setAdminToken(null); setLocation("/admin"); return; }
      setUsers(await res.json());
    } catch { setUsersError("Failed to load users"); }
    finally { setUsersLoading(false); }
  }, [headers, setAdminToken, setLocation]);

  const fetchPolicies = useCallback(async () => {
    setPoliciesLoading(true);
    try {
      const res = await fetch("/api/admin/policies", { headers });
      const data: Policy[] = await res.json();
      setPolicies(data);
      const init: Record<string, string> = {};
      data.forEach(p => { init[p.slug] = p.content; });
      setEditingContent(init);
    } catch { }
    finally { setPoliciesLoading(false); }
  }, [headers]);

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const res = await fetch("/api/admin/plans", { headers });
      if (res.ok) setPlans(await res.json());
    } catch { }
    finally { setPlansLoading(false); }
  }, [headers]);

  const fetchSubs = useCallback(async (silent = false) => {
    if (!silent) setSubsLoading(true);
    try {
      const res = await fetch("/api/admin/subscriptions", { headers });
      if (res.ok) setSubs(await res.json());
    } catch { }
    finally { if (!silent) setSubsLoading(false); }
  }, [headers]);

  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const res = await fetch("/api/admin/payments", { headers });
      if (res.ok) setPayments(await res.json());
    } catch { }
    finally { setPaymentsLoading(false); }
  }, [headers]);

  // All 5 fetch callbacks are stable (only change when `headers` changes = when
  // adminToken changes), so including them in the effect deps is safe and correct.
  useEffect(() => {
    if (!adminToken) return;
    fetchUsers(); fetchPolicies(); fetchPlans(); fetchSubs(); fetchPayments();
  }, [adminToken, fetchUsers, fetchPolicies, fetchPlans, fetchSubs, fetchPayments]);

  async function toggleBan(user: AdminUser) {
    const reason = !user.banned ? (banReason[user.id] || null) : null;
    const res = await fetch(`/api/admin/users/${user.id}/ban`, {
      method: "POST", headers, body: JSON.stringify({ banned: !user.banned, reason }),
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
        method: "PUT", headers, body: JSON.stringify({ content: editingContent[slug], title }),
      });
      if (res.ok) {
        const updated: Policy = await res.json();
        setPolicies(ps => ps.map(p => p.slug === slug ? updated : p));
        setSavedSlug(slug);
        setTimeout(() => setSavedSlug(null), 2000);
      }
    } finally { setSavingSlug(null); }
  }

  async function togglePlanActive(plan: SubscriptionPlan) {
    setSavingPlan(plan.id);
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ isActive: !plan.isActive }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlans(ps => ps.map(p => p.id === plan.id ? updated : p));
      }
    } finally { setSavingPlan(null); }
  }

  async function savePlanEdit() {
    if (!editDraft) return;
    setSavingPlan(editDraft.id);
    try {
      const res = await fetch(`/api/admin/plans/${editDraft.id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({
          name: editDraft.name,
          description: editDraft.description,
          priceMonthly: editDraft.priceMonthly,
          features: editDraft.features,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlans(ps => ps.map(p => p.id === editDraft.id ? updated : p));
        setEditingPlanId(null);
        setEditDraft(null);
      }
    } finally { setSavingPlan(null); }
  }

  async function createPlan() {
    if (!newPlan.name || !newPlan.slug) return;
    setSavingPlan(-1);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST", headers,
        body: JSON.stringify({ ...newPlan, features: {} }),
      });
      if (res.ok) {
        const created = await res.json();
        setPlans(ps => [...ps, created]);
        setShowNewPlan(false);
        setNewPlan({ name: "", slug: "", description: "", priceMonthly: 0 });
      }
    } finally { setSavingPlan(null); }
  }

  async function grantPremium() {
    if (!grantUserId || !grantPlanId) return;
    setGranting(true);
    try {
      const res = await fetch("/api/admin/grant-premium", {
        method: "POST", headers,
        body: JSON.stringify({ userId: parseInt(grantUserId), planId: parseInt(grantPlanId), months: parseInt(grantMonths) }),
      });
      if (res.ok) {
        fetchSubs(true);
        setGrantUserId(""); setGrantPlanId(""); setGrantMonths("1");
        setGrantSuccess(true);
        setTimeout(() => setGrantSuccess(false), 3000);
      }
    } finally { setGranting(false); }
  }

  async function revokeSubscription(id: number) {
    if (!confirm("Revoke this subscription?")) return;
    const res = await fetch(`/api/admin/subscriptions/${id}/revoke`, { method: "PATCH", headers });
    if (res.ok) setSubs(ss => ss.map(s => s.id === id ? { ...s, status: "cancelled" } : s));
  }

  function handleLogout() { setAdminToken(null); setLocation("/admin"); }

  const TABS: [Tab, React.ElementType, string][] = [
    ["users", Users, "Users"],
    ["policies", FileText, "Policies"],
    ["plans", Package, "Plans"],
    ["subscribers", Star, "Subscribers"],
    ["payments", CreditCard, "Payments"],
  ];

  // Memoized so these three array passes only re-run when subs or the filter changes,
  // not on every keystroke in the grant form or any other unrelated state update.
  const filteredSubs = useMemo(
    () => subsFilter === "all" ? subs : subs.filter(s => s.status === subsFilter),
    [subs, subsFilter]
  );
  const activeSubs = useMemo(() => subs.filter(s => s.status === "active").length, [subs]);
  const adminGrantedSubs = useMemo(
    () => subs.filter(s => s.grantedByAdmin && s.status === "active").length,
    [subs]
  );

  return (
    <div style={{ background: "#fff", borderRadius: "16px", padding: "4px 0 8px" }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "#f0f0f0" }}>
            <Shield style={{ height: "16px", width: "16px", color: "#111" }} />
          </span>
          <div>
            <h1 className="text-base font-semibold" style={{ color: "#111" }}>Admin Panel</h1>
            <p className="text-xs" style={{ color: "#888" }}>Manage users, policies, plans, and subscriptions</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
          style={{ border: "1px solid rgba(0,0,0,0.1)", color: "#666", background: "#f5f5f5" }}>
          <LogOut style={{ height: "12px", width: "12px" }} /> Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(([key, Icon, label]) => (
          <button key={key} onClick={() => { setVisitedTabs(prev => new Set([...prev, key])); setTab(key); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={tab === key
              ? { background: "#111", color: "#fff" }
              : { background: "#f5f5f5", color: "#666", border: "1px solid rgba(0,0,0,0.08)" }}>
            <Icon style={{ height: "13px", width: "13px" }} />
            {label}
            {key === "subscribers" && activeSubs > 0 && (
              <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={tab === key ? { background: "rgba(255,255,255,0.2)", color: "#fff" } : { background: "rgba(139,92,246,0.1)", color: "hsl(265,89%,60%)" }}>
                {activeSubs}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Users ── */}
      {visitedTabs.has("users") && (
        <div className={tab !== "users" ? "hidden" : "rounded-2xl overflow-hidden"} style={{ border: "1px solid rgba(0,0,0,0.09)", background: "#fff" }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
            <div className="flex items-center gap-2">
              <Users style={{ height: "14px", width: "14px", color: "#666" }} />
              <span className="text-sm font-semibold" style={{ color: "#111" }}>Registered Users</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0f0f0", color: "#666" }}>{users.length}</span>
            </div>
            <button onClick={fetchUsers} className="p-1.5 rounded-lg transition-colors" style={{ color: "#888" }}>
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
                <div key={user.id} className="px-5 py-4"
                  style={{ borderBottom: i < users.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none", background: user.banned ? "#fef9f9" : "transparent" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-9 w-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold"
                        style={{ background: user.banned ? "#fee2e2" : "#f0f0f0", color: user.banned ? "#dc2626" : "#555" }}>
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate" style={{ color: "#111" }}>{user.name}</span>
                          {user.banned && <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "#fee2e2", color: "#dc2626" }}>BANNED</span>}
                        </div>
                        <p className="text-xs truncate" style={{ color: "#888" }}>{user.email}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "#bbb" }}>
                          Joined {new Date(user.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · ID: {user.id}
                        </p>
                        {user.banned && user.bannedReason && <p className="text-[10px] mt-0.5" style={{ color: "#dc2626" }}>Reason: {user.bannedReason}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {!user.banned && (
                        <input type="text" placeholder="Ban reason (optional)"
                          value={banReason[user.id] ?? ""}
                          onChange={e => setBanReason(r => ({ ...r, [user.id]: e.target.value }))}
                          className="text-[11px] px-2 py-1 rounded-lg w-40"
                          style={{ border: "1px solid rgba(0,0,0,0.1)", background: "#f9f9f9", color: "#555" }}
                        />
                      )}
                      <button onClick={() => toggleBan(user)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                        style={user.banned
                          ? { background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" }
                          : { background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" }}>
                        {user.banned
                          ? <><UserCheck style={{ height: "11px", width: "11px" }} />Unban</>
                          : <><UserX style={{ height: "11px", width: "11px" }} />Ban</>}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Policies ── */}
      {visitedTabs.has("policies") && (
        <div className={tab !== "policies" ? "hidden" : "flex flex-col gap-3"}>
          {policiesLoading ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: "#aaa" }}>Loading policies…</div>
          ) : policies.map(policy => (
            <div key={policy.slug} className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.09)", background: "#fff" }}>
              <button onClick={() => setExpandedPolicy(v => v === policy.slug ? null : policy.slug)}
                className="w-full flex items-center justify-between px-5 py-4 text-left">
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
                  : <ChevronDown style={{ height: "14px", width: "14px", color: "#aaa" }} />}
              </button>
              {expandedPolicy === policy.slug && (
                <div className="px-5 pb-5" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  <p className="text-[11px] font-medium mt-4 mb-2" style={{ color: "#666" }}>Policy Content</p>
                  <textarea value={editingContent[policy.slug] ?? ""} onChange={e => setEditingContent(c => ({ ...c, [policy.slug]: e.target.value }))}
                    rows={8} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-y"
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
                    <button onClick={() => savePolicy(policy.slug, policy.title)} disabled={savingSlug === policy.slug}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-opacity"
                      style={{ background: "#111", color: "#fff", opacity: savingSlug === policy.slug ? 0.6 : 1 }}>
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

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── PLANS (rebuilt) ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {visitedTabs.has("plans") && (
        <div className={tab !== "plans" ? "hidden" : "flex flex-col gap-5"}>

          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: "#111" }}>Subscription Plans</p>
              <p className="text-xs mt-0.5" style={{ color: "#aaa" }}>{plans.length} plan{plans.length !== 1 ? "s" : ""} configured</p>
            </div>
            <button onClick={() => { setShowNewPlan(v => !v); setEditingPlanId(null); setEditDraft(null); }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
              style={showNewPlan ? { background: "#f0f0f0", color: "#666" } : { background: "#111", color: "#fff" }}>
              {showNewPlan ? <><X style={{ height: "12px", width: "12px" }} />Cancel</> : <><Plus style={{ height: "12px", width: "12px" }} />New Plan</>}
            </button>
          </div>

          {/* ── New plan form ── */}
          {showNewPlan && (
            <div className="rounded-2xl p-5" style={{ border: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.02)" }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.1)" }}>
                  <Package style={{ height: "13px", width: "13px", color: "hsl(265,89%,60%)" }} />
                </span>
                <p className="text-sm font-semibold" style={{ color: "#111" }}>Create New Plan</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {([
                  ["Plan Name", "name", "text", newPlan.name],
                  ["Slug (unique ID)", "slug", "text", newPlan.slug],
                  ["Description", "description", "text", newPlan.description],
                  ["Monthly Price (paise)", "priceMonthly", "number", newPlan.priceMonthly],
                ] as [string, string, string, string | number][]).map(([label, field, type, val]) => (
                  <div key={field} className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium" style={{ color: "#666" }}>{label}</label>
                    <input type={type} value={val}
                      onChange={e => setNewPlan(p => ({ ...p, [field]: type === "number" ? parseInt(e.target.value) || 0 : e.target.value }))}
                      className="text-xs px-3 py-2 rounded-xl outline-none transition-colors"
                      style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fff", color: "#111" }}
                    />
                  </div>
                ))}
              </div>
              {newPlan.priceMonthly > 0 && (
                <p className="text-[11px] mb-4" style={{ color: "#888" }}>
                  = ₹{(newPlan.priceMonthly / 100).toLocaleString("en-IN")}/month
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowNewPlan(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium"
                  style={{ background: "#f5f5f5", color: "#666" }}>Cancel</button>
                <button onClick={createPlan} disabled={!newPlan.name || !newPlan.slug || savingPlan === -1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-opacity"
                  style={{ background: "linear-gradient(135deg, hsl(265,89%,60%), hsl(285,89%,58%))", color: "#fff", opacity: !newPlan.name || !newPlan.slug ? 0.5 : 1 }}>
                  <Plus style={{ height: "12px", width: "12px" }} />
                  {savingPlan === -1 ? "Creating…" : "Create Plan"}
                </button>
              </div>
            </div>
          )}

          {/* ── Plan cards ── */}
          {plansLoading ? (
            <div className="flex items-center justify-center py-16 text-sm" style={{ color: "#aaa" }}>
              Loading plans…
            </div>
          ) : plans.map(plan => {
            const accent = planAccent(plan.slug);
            const isEditing = editingPlanId === plan.id;

            return (
              <div key={plan.id} className="rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${isEditing ? accent.border : "rgba(0,0,0,0.09)"}`, background: "#fff" }}>

                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: isEditing ? `1px solid ${accent.border}` : "1px solid transparent", background: isEditing ? accent.bg : "transparent" }}>
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: accent.bg, border: `1px solid ${accent.border}` }}>
                      {plan.slug === "elite"
                        ? <Crown style={{ height: "15px", width: "15px", color: accent.color }} />
                        : plan.slug === "pro"
                          ? <Zap style={{ height: "15px", width: "15px", color: accent.color }} />
                          : <Shield style={{ height: "15px", width: "15px", color: accent.color }} />}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold" style={{ color: "#111" }}>{plan.name}</p>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                          style={{ background: "#f0f0f0", color: "#888" }}>{plan.slug}</span>
                        {plan.isDefault && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "#dcfce7", color: "#16a34a" }}>Default</span>
                        )}
                        {!plan.isActive && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "#fee2e2", color: "#dc2626" }}>Disabled</span>
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: "#999" }}>
                        {plan.priceMonthly === 0 ? "Free" : `₹${(plan.priceMonthly / 100).toLocaleString("en-IN")}/mo`}
                        {" · "}{plan.description.slice(0, 50)}{plan.description.length > 50 ? "…" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Active/Inactive toggle */}
                    {!plan.isDefault && (
                      <button
                        onClick={() => togglePlanActive(plan)}
                        disabled={savingPlan === plan.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all"
                        style={plan.isActive
                          ? { background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" }
                          : { background: "#f0f0f0", color: "#999", border: "1px solid rgba(0,0,0,0.08)" }}>
                        {plan.isActive
                          ? <ToggleRight style={{ height: "12px", width: "12px" }} />
                          : <ToggleLeft style={{ height: "12px", width: "12px" }} />}
                        {plan.isActive ? "Active" : "Inactive"}
                      </button>
                    )}
                    {/* Edit toggle */}
                    <button
                      onClick={() => {
                        if (isEditing) { setEditingPlanId(null); setEditDraft(null); }
                        else { setEditingPlanId(plan.id); setEditDraft({ ...plan }); setShowNewPlan(false); }
                      }}
                      className="h-8 w-8 flex items-center justify-center rounded-xl transition-colors"
                      style={isEditing
                        ? { background: accent.bg, color: accent.color }
                        : { background: "#f5f5f5", color: "#666" }}>
                      <Edit2 style={{ height: "13px", width: "13px" }} />
                    </button>
                  </div>
                </div>

                {/* Feature pills (collapsed view) */}
                {!isEditing && (
                  <div className="px-5 py-3 flex flex-wrap gap-1.5">
                    {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                      const val = plan.features[key];
                      const enabled = typeof val === "boolean" ? val : typeof val === "number" ? val !== 0 : false;
                      return (
                        <span key={key}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={enabled
                            ? { background: accent.bg, color: accent.color, border: `1px solid ${accent.border}` }
                            : { background: "#f5f5f5", color: "#ccc", border: "1px solid transparent" }}>
                          {typeof val === "number" && val !== 0
                            ? `${val === -1 ? "∞" : val} ${label}`
                            : label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* ── Edit form ── */}
                {isEditing && editDraft && (
                  <div className="px-5 pb-5 pt-4">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-medium" style={{ color: "#666" }}>Plan Name</label>
                        <input value={editDraft.name}
                          onChange={e => setEditDraft(d => d ? { ...d, name: e.target.value } : d)}
                          className="text-xs px-3 py-2 rounded-xl outline-none"
                          style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fafafa" }}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-medium" style={{ color: "#666" }}>
                          Monthly Price (paise)
                          {editDraft.priceMonthly > 0 && (
                            <span className="ml-1.5 font-normal" style={{ color: "#aaa" }}>
                              = ₹{(editDraft.priceMonthly / 100).toLocaleString("en-IN")}
                            </span>
                          )}
                        </label>
                        <input type="number" value={editDraft.priceMonthly}
                          onChange={e => setEditDraft(d => d ? { ...d, priceMonthly: parseInt(e.target.value) || 0 } : d)}
                          className="text-xs px-3 py-2 rounded-xl outline-none"
                          style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fafafa" }}
                        />
                      </div>
                      <div className="col-span-2 flex flex-col gap-1.5">
                        <label className="text-[11px] font-medium" style={{ color: "#666" }}>Description</label>
                        <input value={editDraft.description}
                          onChange={e => setEditDraft(d => d ? { ...d, description: e.target.value } : d)}
                          className="text-xs px-3 py-2 rounded-xl outline-none"
                          style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fafafa" }}
                        />
                      </div>
                    </div>

                    <p className="text-[11px] font-semibold mb-2.5" style={{ color: "#555" }}>Feature Flags</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                      {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                        const ftype = FEATURE_TYPES[key];
                        const val = editDraft.features[key];
                        return (
                          <div key={key}
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                            style={{ background: "#fafafa", border: "1px solid rgba(0,0,0,0.07)" }}>
                            <span className="text-[11px]" style={{ color: "#555" }}>{label}</span>
                            {ftype === "boolean" ? (
                              <button
                                onClick={() => setEditDraft(d => d ? { ...d, features: { ...d.features, [key]: !val } } : d)}
                                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-all"
                                style={val
                                  ? { background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" }
                                  : { background: "#f0f0f0", color: "#999", border: "1px solid rgba(0,0,0,0.08)" }}>
                                {val ? <><Check style={{ height: "9px", width: "9px" }} />Yes</> : <><X style={{ height: "9px", width: "9px" }} />No</>}
                              </button>
                            ) : (
                              <input type="number" value={(val as number) ?? 0}
                                onChange={e => setEditDraft(d => d ? { ...d, features: { ...d.features, [key]: parseInt(e.target.value) || 0 } } : d)}
                                className="text-[11px] px-2 py-1 rounded-lg w-16 text-right outline-none font-semibold"
                                style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fff", color: "#111" }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] mb-4" style={{ color: "#bbb" }}>
                      For number fields: <span className="font-medium">-1</span> = Unlimited · <span className="font-medium">0</span> = Disabled
                    </p>

                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setEditingPlanId(null); setEditDraft(null); }}
                        className="px-4 py-2 rounded-xl text-xs font-medium"
                        style={{ background: "#f5f5f5", color: "#666" }}>Cancel</button>
                      <button onClick={savePlanEdit} disabled={savingPlan === editDraft.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-opacity"
                        style={{ background: "#111", color: "#fff", opacity: savingPlan === editDraft.id ? 0.6 : 1 }}>
                        <Save style={{ height: "11px", width: "11px" }} />
                        {savingPlan === editDraft.id ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── SUBSCRIBERS (rebuilt) ───────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {visitedTabs.has("subscribers") && (
        <div className={tab !== "subscribers" ? "hidden" : "flex flex-col gap-4"}>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total", value: subs.length, icon: <Star style={{ height: "13px", width: "13px" }} />, color: "#666", bg: "#f5f5f5" },
              { label: "Active", value: activeSubs, icon: <CheckCircle style={{ height: "13px", width: "13px" }} />, color: "#16a34a", bg: "#dcfce7" },
              { label: "Admin Grants", value: adminGrantedSubs, icon: <Gift style={{ height: "13px", width: "13px" }} />, color: "hsl(265,89%,60%)", bg: "rgba(139,92,246,0.08)" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{ border: "1px solid rgba(0,0,0,0.08)", background: "#fff" }}>
                <span className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: s.bg, color: s.color }}>{s.icon}</span>
                <div>
                  <p className="text-lg font-bold leading-none" style={{ color: "#111" }}>{s.value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#aaa" }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Grant premium card ── */}
          <div className="rounded-2xl p-5"
            style={{ border: "1px solid rgba(139,92,246,0.22)", background: "rgba(139,92,246,0.02)" }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="h-7 w-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(139,92,246,0.1)" }}>
                <Gift style={{ height: "13px", width: "13px", color: "hsl(265,89%,60%)" }} />
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#111" }}>Grant Premium Access</p>
                <p className="text-[11px]" style={{ color: "#aaa" }}>Assign a paid plan to any user without payment</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium flex items-center gap-1" style={{ color: "#666" }}>
                  <Hash style={{ height: "10px", width: "10px" }} /> User ID
                </label>
                <input type="number" placeholder="e.g. 4" value={grantUserId}
                  onChange={e => setGrantUserId(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl outline-none"
                  style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fff" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium flex items-center gap-1" style={{ color: "#666" }}>
                  <Package style={{ height: "10px", width: "10px" }} /> Plan
                </label>
                <select value={grantPlanId} onChange={e => setGrantPlanId(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl outline-none"
                  style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fff" }}>
                  <option value="">Select plan</option>
                  {plans.filter(p => !p.isDefault).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium flex items-center gap-1" style={{ color: "#666" }}>
                  <Calendar style={{ height: "10px", width: "10px" }} /> Months
                </label>
                <input type="number" min="1" max="24" value={grantMonths}
                  onChange={e => setGrantMonths(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl outline-none"
                  style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fff" }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={grantPremium}
                disabled={granting || !grantUserId || !grantPlanId}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-opacity"
                style={{
                  background: "linear-gradient(135deg, hsl(265,89%,60%), hsl(285,89%,58%))",
                  color: "#fff",
                  opacity: granting || !grantUserId || !grantPlanId ? 0.5 : 1,
                }}>
                <Gift style={{ height: "12px", width: "12px" }} />
                {granting ? "Granting…" : "Grant Access"}
              </button>
              {grantSuccess && (
                <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#16a34a" }}>
                  <CheckCircle style={{ height: "12px", width: "12px" }} /> Granted successfully
                </span>
              )}
            </div>
          </div>

          {/* ── Subscriptions list ── */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.09)", background: "#fff" }}>
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <div className="flex items-center gap-2">
                <Star style={{ height: "14px", width: "14px", color: "#888" }} />
                <span className="text-sm font-semibold" style={{ color: "#111" }}>Subscriptions</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Filter pills */}
                <div className="flex gap-1">
                  {(["all", "active", "cancelled"] as const).map(f => (
                    <button key={f} onClick={() => setSubsFilter(f)}
                      className="text-[10px] px-2.5 py-1 rounded-lg font-medium capitalize transition-all"
                      style={subsFilter === f
                        ? { background: "#111", color: "#fff" }
                        : { background: "#f5f5f5", color: "#888" }}>
                      {f}
                    </button>
                  ))}
                </div>
                <button onClick={fetchSubs} className="p-1.5 rounded-lg transition-colors" style={{ color: "#888" }}>
                  <RefreshCw style={{ height: "13px", width: "13px" }} />
                </button>
              </div>
            </div>

            {subsLoading ? (
              <div className="flex items-center justify-center py-12 text-sm" style={{ color: "#aaa" }}>
                Loading…
              </div>
            ) : filteredSubs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <AlertCircle style={{ height: "26px", width: "26px", color: "#e5e7eb" }} />
                <p className="text-sm" style={{ color: "#bbb" }}>
                  {subsFilter === "all" ? "No subscriptions yet" : `No ${subsFilter} subscriptions`}
                </p>
              </div>
            ) : (
              <div>
                {filteredSubs.map((sub, i) => {
                  const accent = planAccent(sub.planSlug ?? "free");
                  return (
                    <div key={sub.id}
                      className="flex items-center justify-between px-5 py-4"
                      style={{ borderBottom: i < filteredSubs.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <span className="h-9 w-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
                          style={{ background: accent.bg, color: accent.color }}>
                          {(sub.userName ?? "?").charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold" style={{ color: "#111" }}>
                              {sub.userName ?? "Unknown"}
                            </p>
                            {/* Status pill */}
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                              style={sub.status === "active"
                                ? { background: "#dcfce7", color: "#16a34a" }
                                : { background: "#f0f0f0", color: "#999" }}>
                              {sub.status}
                            </span>
                            {/* Plan pill */}
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: accent.bg, color: accent.color, border: `1px solid ${accent.border}` }}>
                              {sub.planName ?? "—"}
                            </span>
                            {sub.grantedByAdmin && (
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5"
                                style={{ background: "rgba(139,92,246,0.08)", color: "hsl(265,89%,60%)" }}>
                                <Gift style={{ height: "8px", width: "8px" }} /> Admin
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] mt-0.5 truncate" style={{ color: "#999" }}>
                            {sub.userEmail}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px]" style={{ color: "#bbb" }}>ID: {sub.id}</span>
                            {sub.currentPeriodEnd && (
                              <span className="text-[10px] flex items-center gap-1" style={{ color: "#bbb" }}>
                                <Calendar style={{ height: "9px", width: "9px" }} />
                                Expires {new Date(sub.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {sub.status === "active" && (
                        <button onClick={() => revokeSubscription(sub.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium flex-shrink-0 ml-3 transition-colors"
                          style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" }}>
                          <Trash2 style={{ height: "10px", width: "10px" }} /> Revoke
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Payments ── */}
      {visitedTabs.has("payments") && (
        <div className={tab !== "payments" ? "hidden" : "rounded-2xl overflow-hidden"} style={{ border: "1px solid rgba(0,0,0,0.09)", background: "#fff" }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
            <div className="flex items-center gap-2">
              <CreditCard style={{ height: "14px", width: "14px", color: "#666" }} />
              <span className="text-sm font-semibold" style={{ color: "#111" }}>All Payments</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0f0f0", color: "#666" }}>{payments.length}</span>
            </div>
            <button onClick={fetchPayments} className="p-1.5 rounded-lg transition-colors" style={{ color: "#888" }}>
              <RefreshCw style={{ height: "13px", width: "13px" }} />
            </button>
          </div>
          {paymentsLoading ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: "#aaa" }}>Loading…</div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <CreditCard style={{ height: "28px", width: "28px", color: "#ddd" }} />
              <p className="text-sm" style={{ color: "#aaa" }}>No payments recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    {["User", "Plan", "Amount", "Order ID", "Status", "Date"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-medium" style={{ color: "#888" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: i < payments.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: "#111" }}>{p.userName ?? "—"}</p>
                        <p className="text-[10px]" style={{ color: "#bbb" }}>{p.userEmail}</p>
                      </td>
                      <td className="px-4 py-3" style={{ color: "#555" }}>{p.planName ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "#111" }}>₹{(p.amount / 100).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 font-mono text-[10px]" style={{ color: "#888" }}>{p.razorpayOrderId.slice(0, 20)}…</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-medium"
                          style={p.status === "captured"
                            ? { background: "#dcfce7", color: "#16a34a" }
                            : p.status === "pending"
                              ? { background: "#fef9c3", color: "#ca8a04" }
                              : { background: "#fee2e2", color: "#dc2626" }}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: "#888" }}>
                        {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
