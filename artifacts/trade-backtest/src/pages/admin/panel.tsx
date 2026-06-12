import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Shield, Users, FileText, LogOut, Ban, CheckCircle, RefreshCw, Save,
  ChevronDown, ChevronUp, UserCheck, UserX, Crown, CreditCard, Zap,
  Plus, Edit2, ToggleLeft, ToggleRight, Gift, Trash2, Star,
  X, Check, Package, AlertCircle, Calendar, Hash, KeyRound, Copy, Clock,
  GraduationCap, BookOpen, BarChart2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE } from "@/lib/api-config";

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
  free:  { color: "hsl(var(--muted-foreground))",               bg: "rgba(0,0,0,0.05)",          border: "rgba(0,0,0,0.12)" },
  pro:   { color: "hsl(265,89%,60%)",   bg: "rgba(139,92,246,0.08)",     border: "rgba(139,92,246,0.25)" },
  elite: { color: "hsl(38,100%,50%)",   bg: "rgba(245,158,11,0.08)",     border: "rgba(245,158,11,0.28)" },
};

function planAccent(slug: string) {
  return PLAN_ACCENT[slug] ?? PLAN_ACCENT.free;
}

interface PendingReset {
  id: number; token: string; expiresAt: string; createdAt: string;
  userId: number; userEmail: string | null; userName: string | null;
}

type Tab = "users" | "policies" | "plans" | "subscribers" | "payments" | "resets" | "academy";

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

  // ── Password Reset Requests ──
  const [resets, setResets] = useState<PendingReset[]>([]);
  const [resetsLoading, setResetsLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => { if (!adminToken) { setLocation("/admin"); return; } }, [adminToken]);

  // BUG-010: Show a spinner while unauthenticated — prevents the full admin UI
  // from flashing before the useEffect redirect fires on the first paint.
  if (!adminToken) return (
    <div className="min-h-screen flex items-center justify-center">
      <div style={{ height: 32, width: 32, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", opacity: 0.35 }} />
    </div>
  );

  // useCallback deps now include `headers` (stable useMemo reference) so closures
  // always have the current token without triggering unnecessary recreations.
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true); setUsersError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, { headers });
      if (res.status === 401) { setAdminToken(null); setLocation("/admin"); return; }
      setUsers(await res.json());
    } catch { setUsersError("Failed to load users"); }
    finally { setUsersLoading(false); }
  }, [headers, setAdminToken, setLocation]);

  const fetchPolicies = useCallback(async () => {
    setPoliciesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/policies`, { headers });
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
      const res = await fetch(`${API_BASE}/api/admin/plans`, { headers });
      if (res.ok) setPlans(await res.json());
    } catch { }
    finally { setPlansLoading(false); }
  }, [headers]);

  const fetchSubs = useCallback(async (silent = false) => {
    if (!silent) setSubsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/subscriptions`, { headers });
      if (res.ok) setSubs(await res.json());
    } catch { }
    finally { if (!silent) setSubsLoading(false); }
  }, [headers]);

  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/payments`, { headers });
      if (res.ok) setPayments(await res.json());
    } catch { }
    finally { setPaymentsLoading(false); }
  }, [headers]);

  const fetchResets = useCallback(async () => {
    setResetsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/password-resets`, { headers });
      if (res.ok) setResets(await res.json());
    } catch { }
    finally { setResetsLoading(false); }
  }, [headers]);

  useEffect(() => {
    if (!adminToken) return;
    fetchUsers(); fetchPolicies(); fetchPlans(); fetchSubs(); fetchPayments(); fetchResets();
  }, [adminToken, fetchUsers, fetchPolicies, fetchPlans, fetchSubs, fetchPayments, fetchResets]);

  async function toggleBan(user: AdminUser) {
    const reason = !user.banned ? (banReason[user.id] || null) : null;
    const res = await fetch(`${API_BASE}/api/admin/users/${user.id}/ban`, {
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
      const res = await fetch(`${API_BASE}/api/admin/policies/${slug}`, {
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
      const res = await fetch(`${API_BASE}/api/admin/plans/${plan.id}`, {
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
      const res = await fetch(`${API_BASE}/api/admin/plans/${editDraft.id}`, {
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
      const res = await fetch(`${API_BASE}/api/admin/plans`, {
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
      const res = await fetch(`${API_BASE}/api/admin/grant-premium`, {
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
    const res = await fetch(`${API_BASE}/api/admin/subscriptions/${id}/revoke`, { method: "PATCH", headers });
    if (res.ok) setSubs(ss => ss.map(s => s.id === id ? { ...s, status: "cancelled" } : s));
  }

  function handleLogout() { setAdminToken(null); setLocation("/admin"); }

  const TABS: [Tab, React.ElementType, string][] = [
    ["users", Users, "Users"],
    ["policies", FileText, "Policies"],
    ["plans", Package, "Plans"],
    ["subscribers", Star, "Subscribers"],
    ["payments", CreditCard, "Payments"],
    ["resets", KeyRound, "Resets"],
    ["academy", GraduationCap, "Academy"],
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
    <div style={{ background: "var(--card-bg)", borderRadius: "16px", padding: "4px 0 8px" }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "var(--glass-bg)" }}>
            <Shield style={{ height: "16px", width: "16px", color: "hsl(var(--foreground))" }} />
          </span>
          <div>
            <h1 className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>Admin Panel</h1>
            <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Manage users, policies, plans, and subscriptions</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
          style={{ border: "1px solid var(--glass-border)", color: "hsl(var(--muted-foreground))", background: "var(--glass-bg)" }}>
          <LogOut style={{ height: "12px", width: "12px" }} /> Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(([key, Icon, label]) => (
          <button key={key} onClick={() => { setVisitedTabs(prev => new Set([...prev, key])); setTab(key); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={tab === key
              ? { background: "#FFFFFF", color: "#050505" }
              : { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
            <Icon style={{ height: "13px", width: "13px" }} />
            {label}
            {key === "subscribers" && activeSubs > 0 && (
              <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={tab === key ? { background: "rgba(255,255,255,0.2)", color: "#fff" } : { background: "rgba(139,92,246,0.1)", color: "hsl(265,89%,60%)" }}>
                {activeSubs}
              </span>
            )}
            {key === "resets" && resets.length > 0 && (
              <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={tab === key ? { background: "rgba(255,255,255,0.2)", color: "#fff" } : { background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                {resets.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Users ── */}
      {visitedTabs.has("users") && (
        <div className={tab !== "users" ? "hidden" : "rounded-2xl overflow-hidden"} style={{ border: "1px solid var(--glass-border)", background: "var(--card-bg)" }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <div className="flex items-center gap-2">
              <Users style={{ height: "14px", width: "14px", color: "hsl(var(--muted-foreground))" }} />
              <span className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>Registered Users</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))" }}>{users.length}</span>
            </div>
            <button onClick={fetchUsers} className="p-1.5 rounded-lg transition-colors" style={{ color: "hsl(var(--muted-foreground))" }}>
              <RefreshCw style={{ height: "13px", width: "13px" }} />
            </button>
          </div>
          {usersLoading ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Loading users…</div>
          ) : usersError ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: "#f87171" }}>{usersError}</div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Users style={{ height: "28px", width: "28px", color: "hsl(var(--muted-foreground))" }} />
              <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>No users have signed up yet</p>
            </div>
          ) : (
            <div>
              {users.map((user, i) => (
                <div key={user.id} className="px-5 py-4"
                  style={{ borderBottom: i < users.length - 1 ? "1px solid var(--glass-border)" : "none", background: user.banned ? "rgba(220,38,38,0.05)" : "transparent" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-9 w-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold"
                        style={{ background: user.banned ? "rgba(220,38,38,0.15)" : "var(--glass-bg)", color: user.banned ? "#f87171" : "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate" style={{ color: "hsl(var(--foreground))" }}>{user.name}</span>
                          {user.banned && <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(220,38,38,0.12)", color: "#f87171" }}>BANNED</span>}
                        </div>
                        <p className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{user.email}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                          Joined {new Date(user.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · ID: {user.id}
                        </p>
                        {user.banned && user.bannedReason && <p className="text-[10px] mt-0.5" style={{ color: "#f87171" }}>Reason: {user.bannedReason}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {!user.banned && (
                        <input type="text" placeholder="Ban reason (optional)"
                          value={banReason[user.id] ?? ""}
                          onChange={e => setBanReason(r => ({ ...r, [user.id]: e.target.value }))}
                          className="text-[11px] px-2 py-1 rounded-lg w-40"
                          style={{ border: "1px solid var(--glass-border)", background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))" }}
                        />
                      )}
                      <button onClick={() => toggleBan(user)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                        style={user.banned
                          ? { background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid #bbf7d0" }
                          : { background: "rgba(220,38,38,0.12)", color: "#f87171", border: "1px solid #fecaca" }}>
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
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Loading policies…</div>
          ) : policies.map(policy => (
            <div key={policy.slug} className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--glass-border)", background: "var(--card-bg)" }}>
              <button onClick={() => setExpandedPolicy(v => v === policy.slug ? null : policy.slug)}
                className="w-full flex items-center justify-between px-5 py-4 text-left">
                <div className="flex items-center gap-3">
                  <FileText style={{ height: "14px", width: "14px", color: "hsl(var(--muted-foreground))" }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>{policy.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Last updated {new Date(policy.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                {expandedPolicy === policy.slug
                  ? <ChevronUp style={{ height: "14px", width: "14px", color: "hsl(var(--muted-foreground))" }} />
                  : <ChevronDown style={{ height: "14px", width: "14px", color: "hsl(var(--muted-foreground))" }} />}
              </button>
              {expandedPolicy === policy.slug && (
                <div className="px-5 pb-5" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  <p className="text-[11px] font-medium mt-4 mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>Policy Content</p>
                  <textarea value={editingContent[policy.slug] ?? ""} onChange={e => setEditingContent(c => ({ ...c, [policy.slug]: e.target.value }))}
                    rows={8} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-y"
                    style={{ border: "1px solid var(--glass-border)", background: "var(--glass-bg)", color: "hsl(var(--foreground))", lineHeight: 1.6 }}
                    onFocus={e => (e.target.style.borderColor = "rgba(0,0,0,0.3)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(0,0,0,0.12)")}
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    {savedSlug === policy.slug && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#4ade80" }}>
                        <CheckCircle style={{ height: "11px", width: "11px" }} />Saved
                      </span>
                    )}
                    <button onClick={() => savePolicy(policy.slug, policy.title)} disabled={savingSlug === policy.slug}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-opacity"
                      style={{ background: "#FFFFFF", color: "#050505", opacity: savingSlug === policy.slug ? 0.6 : 1 }}>
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
              <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>Subscription Plans</p>
              <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{plans.length} plan{plans.length !== 1 ? "s" : ""} configured</p>
            </div>
            <button onClick={() => { setShowNewPlan(v => !v); setEditingPlanId(null); setEditDraft(null); }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
              style={showNewPlan ? { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))" } : { background: "#FFFFFF", color: "#050505" }}>
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
                <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>Create New Plan</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {([
                  ["Plan Name", "name", "text", newPlan.name],
                  ["Slug (unique ID)", "slug", "text", newPlan.slug],
                  ["Description", "description", "text", newPlan.description],
                  ["Monthly Price (paise)", "priceMonthly", "number", newPlan.priceMonthly],
                ] as [string, string, string, string | number][]).map(([label, field, type, val]) => (
                  <div key={field} className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</label>
                    <input type={type} value={val}
                      onChange={e => setNewPlan(p => ({ ...p, [field]: type === "number" ? parseInt(e.target.value) || 0 : e.target.value }))}
                      className="text-xs px-3 py-2 rounded-xl outline-none transition-colors"
                      style={{ border: "1px solid var(--glass-border)", background: "var(--card-bg)", color: "hsl(var(--foreground))" }}
                    />
                  </div>
                ))}
              </div>
              {newPlan.priceMonthly > 0 && (
                <p className="text-[11px] mb-4" style={{ color: "hsl(var(--muted-foreground))" }}>
                  = ₹{(newPlan.priceMonthly / 100).toLocaleString("en-IN")}/month
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowNewPlan(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium"
                  style={{ background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))" }}>Cancel</button>
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
            <div className="flex items-center justify-center py-16 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Loading plans…
            </div>
          ) : plans.map(plan => {
            const accent = planAccent(plan.slug);
            const isEditing = editingPlanId === plan.id;

            return (
              <div key={plan.id} className="rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${isEditing ? accent.border : "rgba(0,0,0,0.09)"}`, background: "var(--card-bg)" }}>

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
                        <p className="text-sm font-bold" style={{ color: "hsl(var(--foreground))" }}>{plan.name}</p>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                          style={{ background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))" }}>{plan.slug}</span>
                        {plan.isDefault && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}>Default</span>
                        )}
                        {!plan.isActive && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "rgba(220,38,38,0.12)", color: "#f87171" }}>Disabled</span>
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
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
                          ? { background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid #bbf7d0" }
                          : { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
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
                        : { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))" }}>
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
                            : { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid transparent" }}>
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
                        <label className="text-[11px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>Plan Name</label>
                        <input value={editDraft.name}
                          onChange={e => setEditDraft(d => d ? { ...d, name: e.target.value } : d)}
                          className="text-xs px-3 py-2 rounded-xl outline-none"
                          style={{ border: "1px solid var(--glass-border)", background: "var(--glass-bg)" }}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
                          Monthly Price (paise)
                          {editDraft.priceMonthly > 0 && (
                            <span className="ml-1.5 font-normal" style={{ color: "hsl(var(--muted-foreground))" }}>
                              = ₹{(editDraft.priceMonthly / 100).toLocaleString("en-IN")}
                            </span>
                          )}
                        </label>
                        <input type="number" value={editDraft.priceMonthly}
                          onChange={e => setEditDraft(d => d ? { ...d, priceMonthly: parseInt(e.target.value) || 0 } : d)}
                          className="text-xs px-3 py-2 rounded-xl outline-none"
                          style={{ border: "1px solid var(--glass-border)", background: "var(--glass-bg)" }}
                        />
                      </div>
                      <div className="col-span-2 flex flex-col gap-1.5">
                        <label className="text-[11px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>Description</label>
                        <input value={editDraft.description}
                          onChange={e => setEditDraft(d => d ? { ...d, description: e.target.value } : d)}
                          className="text-xs px-3 py-2 rounded-xl outline-none"
                          style={{ border: "1px solid var(--glass-border)", background: "var(--glass-bg)" }}
                        />
                      </div>
                    </div>

                    <p className="text-[11px] font-semibold mb-2.5" style={{ color: "hsl(var(--muted-foreground))" }}>Feature Flags</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                      {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                        const ftype = FEATURE_TYPES[key];
                        const val = editDraft.features[key];
                        return (
                          <div key={key}
                            className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                            <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</span>
                            {ftype === "boolean" ? (
                              <button
                                onClick={() => setEditDraft(d => d ? { ...d, features: { ...d.features, [key]: !val } } : d)}
                                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-all"
                                style={val
                                  ? { background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid #bbf7d0" }
                                  : { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
                                {val ? <><Check style={{ height: "9px", width: "9px" }} />Yes</> : <><X style={{ height: "9px", width: "9px" }} />No</>}
                              </button>
                            ) : (
                              <input type="number" value={(val as number) ?? 0}
                                onChange={e => setEditDraft(d => d ? { ...d, features: { ...d.features, [key]: parseInt(e.target.value) || 0 } } : d)}
                                className="text-[11px] px-2 py-1 rounded-lg w-16 text-right outline-none font-semibold"
                                style={{ border: "1px solid var(--glass-border)", background: "var(--card-bg)", color: "hsl(var(--foreground))" }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] mb-4" style={{ color: "hsl(var(--muted-foreground))" }}>
                      For number fields: <span className="font-medium">-1</span> = Unlimited · <span className="font-medium">0</span> = Disabled
                    </p>

                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setEditingPlanId(null); setEditDraft(null); }}
                        className="px-4 py-2 rounded-xl text-xs font-medium"
                        style={{ background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))" }}>Cancel</button>
                      <button onClick={savePlanEdit} disabled={savingPlan === editDraft.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-opacity"
                        style={{ background: "#FFFFFF", color: "#050505", opacity: savingPlan === editDraft.id ? 0.6 : 1 }}>
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
              { label: "Total", value: subs.length, icon: <Star style={{ height: "13px", width: "13px" }} />, color: "hsl(var(--muted-foreground))", bg: "#f5f5f5" },
              { label: "Active", value: activeSubs, icon: <CheckCircle style={{ height: "13px", width: "13px" }} />, color: "#4ade80", bg: "#dcfce7" },
              { label: "Admin Grants", value: adminGrantedSubs, icon: <Gift style={{ height: "13px", width: "13px" }} />, color: "hsl(265,89%,60%)", bg: "rgba(139,92,246,0.08)" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{ border: "1px solid var(--glass-border)", background: "var(--card-bg)" }}>
                <span className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: s.bg, color: s.color }}>{s.icon}</span>
                <div>
                  <p className="text-lg font-bold leading-none" style={{ color: "hsl(var(--foreground))" }}>{s.value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>{s.label}</p>
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
                <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>Grant Premium Access</p>
                <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>Assign a paid plan to any user without payment</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium flex items-center gap-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <Hash style={{ height: "10px", width: "10px" }} /> User ID
                </label>
                <input type="number" placeholder="e.g. 4" value={grantUserId}
                  onChange={e => setGrantUserId(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl outline-none"
                  style={{ border: "1px solid var(--glass-border)", background: "var(--card-bg)" }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium flex items-center gap-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <Package style={{ height: "10px", width: "10px" }} /> Plan
                </label>
                <select value={grantPlanId} onChange={e => setGrantPlanId(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl outline-none"
                  style={{ border: "1px solid var(--glass-border)", background: "var(--card-bg)" }}>
                  <option value="">Select plan</option>
                  {plans.filter(p => !p.isDefault).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium flex items-center gap-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <Calendar style={{ height: "10px", width: "10px" }} /> Months
                </label>
                <input type="number" min="1" max="24" value={grantMonths}
                  onChange={e => setGrantMonths(e.target.value)}
                  className="text-xs px-3 py-2 rounded-xl outline-none"
                  style={{ border: "1px solid var(--glass-border)", background: "var(--card-bg)" }}
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
                <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#4ade80" }}>
                  <CheckCircle style={{ height: "12px", width: "12px" }} /> Granted successfully
                </span>
              )}
            </div>
          </div>

          {/* ── Subscriptions list ── */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--glass-border)", background: "var(--card-bg)" }}>
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: "1px solid var(--glass-border)" }}>
              <div className="flex items-center gap-2">
                <Star style={{ height: "14px", width: "14px", color: "hsl(var(--muted-foreground))" }} />
                <span className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>Subscriptions</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Filter pills */}
                <div className="flex gap-1">
                  {(["all", "active", "cancelled"] as const).map(f => (
                    <button key={f} onClick={() => setSubsFilter(f)}
                      className="text-[10px] px-2.5 py-1 rounded-lg font-medium capitalize transition-all"
                      style={subsFilter === f
                        ? { background: "#FFFFFF", color: "#050505" }
                        : { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))" }}>
                      {f}
                    </button>
                  ))}
                </div>
                <button onClick={() => fetchSubs()} className="p-1.5 rounded-lg transition-colors" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <RefreshCw style={{ height: "13px", width: "13px" }} />
                </button>
              </div>
            </div>

            {subsLoading ? (
              <div className="flex items-center justify-center py-12 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                Loading…
              </div>
            ) : filteredSubs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <AlertCircle style={{ height: "26px", width: "26px", color: "hsl(var(--muted-foreground))" }} />
                <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
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
                            <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                              {sub.userName ?? "Unknown"}
                            </p>
                            {/* Status pill */}
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                              style={sub.status === "active"
                                ? { background: "rgba(74,222,128,0.12)", color: "#4ade80" }
                                : { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))" }}>
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
                          <p className="text-[11px] mt-0.5 truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {sub.userEmail}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>ID: {sub.id}</span>
                            {sub.currentPeriodEnd && (
                              <span className="text-[10px] flex items-center gap-1" style={{ color: "hsl(var(--muted-foreground))" }}>
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
                          style={{ background: "rgba(220,38,38,0.12)", color: "#f87171", border: "1px solid #fecaca" }}>
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

      {/* ── Password Resets ── */}
      {visitedTabs.has("resets") && (
        <div className={tab !== "resets" ? "hidden" : "rounded-2xl overflow-hidden"} style={{ border: "1px solid var(--glass-border)", background: "var(--card-bg)" }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <div className="flex items-center gap-2">
              <KeyRound style={{ height: "14px", width: "14px", color: "hsl(var(--muted-foreground))" }} />
              <span className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>Pending Password Resets</span>
              {resets.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>{resets.length}</span>
              )}
            </div>
            <button onClick={fetchResets} className="p-1.5 rounded-lg transition-colors" style={{ color: "hsl(var(--muted-foreground))" }}>
              <RefreshCw style={{ height: "13px", width: "13px" }} />
            </button>
          </div>
          <div
            className="mx-5 my-3 rounded-xl px-4 py-3 text-xs flex items-start gap-2"
            style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", color: "hsl(var(--muted-foreground))", lineHeight: "1.6" }}
          >
            <AlertCircle style={{ height: "13px", width: "13px", color: "#818cf8", flexShrink: 0, marginTop: "1px" }} />
            <span>
              <strong style={{ color: "#818cf8" }}>How it works:</strong> When a user requests a password reset, a unique link appears here. Copy the link and share it with the user directly. Links expire after <strong style={{ color: "hsl(var(--foreground))" }}>1 hour</strong> and can only be used once.
            </span>
          </div>
          {resetsLoading ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Loading…</div>
          ) : resets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <KeyRound style={{ height: "28px", width: "28px", color: "hsl(var(--muted-foreground))" }} />
              <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>No pending reset requests</p>
            </div>
          ) : (
            <div>
              {resets.map((r, i) => {
                const resetUrl = `${window.location.origin}/reset-password?token=${r.token}`;
                const expiresIn = Math.max(0, Math.floor((new Date(r.expiresAt).getTime() - Date.now()) / 60_000));
                const copied = copiedToken === r.token;
                return (
                  <div key={r.id} className="px-5 py-4" style={{ borderBottom: i < resets.length - 1 ? "1px solid var(--glass-border)" : "none" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                            style={{ background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}>
                            {(r.userName ?? "?").charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <span className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>{r.userName ?? "Unknown"}</span>
                            <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{r.userEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Clock style={{ height: "11px", width: "11px", color: expiresIn < 15 ? "#f97316" : "#fbbf24", flexShrink: 0 }} />
                          <span className="text-[11px]" style={{ color: expiresIn < 15 ? "#f97316" : "hsl(var(--muted-foreground))" }}>
                            Expires in {expiresIn} min · Requested {new Date(r.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div
                          className="mt-2 px-3 py-2 rounded-lg font-mono text-[10px] truncate"
                          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "hsl(var(--muted-foreground))", maxWidth: "380px" }}
                          title={resetUrl}
                        >
                          {resetUrl}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(resetUrl).catch(() => {});
                          setCopiedToken(r.token);
                          setTimeout(() => setCopiedToken(null), 2000);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium flex-shrink-0 transition-all"
                        style={copied
                          ? { background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid #bbf7d0" }
                          : { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", border: "1px solid var(--glass-border)" }}
                      >
                        {copied ? <><Check style={{ height: "11px", width: "11px" }} />Copied!</> : <><Copy style={{ height: "11px", width: "11px" }} />Copy Link</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Payments ── */}
      {visitedTabs.has("payments") && (
        <div className={tab !== "payments" ? "hidden" : "rounded-2xl overflow-hidden"} style={{ border: "1px solid var(--glass-border)", background: "var(--card-bg)" }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <div className="flex items-center gap-2">
              <CreditCard style={{ height: "14px", width: "14px", color: "hsl(var(--muted-foreground))" }} />
              <span className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>All Payments</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))" }}>{payments.length}</span>
            </div>
            <button onClick={fetchPayments} className="p-1.5 rounded-lg transition-colors" style={{ color: "hsl(var(--muted-foreground))" }}>
              <RefreshCw style={{ height: "13px", width: "13px" }} />
            </button>
          </div>
          {paymentsLoading ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Loading…</div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <CreditCard style={{ height: "28px", width: "28px", color: "hsl(var(--muted-foreground))" }} />
              <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>No payments recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                    {["User", "Plan", "Amount", "Order ID", "Status", "Date"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: i < payments.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: "hsl(var(--foreground))" }}>{p.userName ?? "—"}</p>
                        <p className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>{p.userEmail}</p>
                      </td>
                      <td className="px-4 py-3" style={{ color: "hsl(var(--muted-foreground))" }}>{p.planName ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "hsl(var(--foreground))" }}>₹{(p.amount / 100).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 font-mono text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>{p.razorpayOrderId.slice(0, 20)}…</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-medium"
                          style={p.status === "captured"
                            ? { background: "rgba(74,222,128,0.12)", color: "#4ade80" }
                            : p.status === "pending"
                              ? { background: "rgba(251,191,36,0.12)", color: "#fbbf24" }
                              : { background: "rgba(220,38,38,0.12)", color: "#f87171" }}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: "hsl(var(--muted-foreground))" }}>
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

      {/* ── Academy tab ── */}
      {(tab === "academy" || visitedTabs.has("academy")) && (
        <div className={tab !== "academy" ? "hidden" : "flex flex-col gap-4"}>
          <AcademyAdminTab headers={headers} />
        </div>
      )}
    </div>
  );
}

/* ─── Academy Admin Tab ─────────────────────────────────────────── */
interface AcademyStats {
  totalCourses: number; totalLessons: number; totalUsers: number;
  totalCompletions: number; totalCertificates: number; totalXpAwarded: number;
  topCourses: Array<{ id: number; title: string; completions: number; thumbnailEmoji: string }>;
}
interface AdminCourse {
  id: number; title: string; description: string; category: string; difficulty: string;
  pathId: string; thumbnailEmoji: string | null; estimatedMinutes: number; sortOrder: number;
  published: boolean; lessonCount: number;
}

const PATH_ORDER = ["beginner", "intermediate", "advanced", "professional"];
const PATH_LABELS: Record<string, { label: string; color: string }> = {
  beginner:     { label: "Beginner",     color: "#22c55e" },
  intermediate: { label: "Intermediate", color: "#06b6d4" },
  advanced:     { label: "Advanced",     color: "#a855f7" },
  professional: { label: "Professional", color: "#f59e0b" },
};
const DIFFICULTY_OPTIONS = ["beginner", "intermediate", "advanced", "professional"];

interface NewCourseForm {
  title: string; description: string; category: string; difficulty: string;
  pathId: string; estimatedMinutes: string; thumbnailEmoji: string;
}

function AcademyAdminTab({ headers }: { headers: Record<string, string> }) {
  const C = { purple: "#a855f7", cyan: "#06b6d4", green: "#22c55e", amber: "#f59e0b" };

  const [stats, setStats] = useState<AcademyStats | null>(null);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [expandedPath, setExpandedPath] = useState<string>("beginner");
  const [showAddForm, setShowAddForm] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<NewCourseForm>({ title: "", description: "", category: "", difficulty: "beginner", pathId: "beginner", estimatedMinutes: "30", thumbnailEmoji: "📚" });
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminCourse | null>(null);

  useEffect(() => { void fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [sr, cr] = await Promise.all([
        fetch(`${API_BASE}/api/academy/admin/stats`, { headers }),
        fetch(`${API_BASE}/api/academy/admin/courses`, { headers }),
      ]);
      if (sr.ok) setStats(await sr.json());
      if (cr.ok) setCourses(await cr.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function runSeed() {
    setSeedLoading(true); setSeedMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/academy/admin/seed`, { method: "POST", headers });
      const data = await r.json();
      setSeedMsg(r.ok ? `✓ ${data.message ?? "Seed complete"}` : `✗ ${data.error ?? "Seed failed"}`);
      if (r.ok) void fetchAll();
    } catch { setSeedMsg("✗ Request failed"); }
    setSeedLoading(false);
  }

  async function togglePublish(course: AdminCourse) {
    setTogglingId(course.id);
    try {
      const r = await fetch(`${API_BASE}/api/academy/admin/courses/${course.id}/publish`, {
        method: "PATCH", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ published: !course.published }),
      });
      if (r.ok) setCourses(prev => prev.map(c => c.id === course.id ? { ...c, published: !course.published } : c));
    } catch { /* ignore */ }
    setTogglingId(null);
  }

  async function deleteCourse(course: AdminCourse) {
    setDeletingId(course.id); setConfirmDelete(null);
    try {
      const r = await fetch(`${API_BASE}/api/academy/admin/courses/${course.id}`, { method: "DELETE", headers });
      if (r.ok) { setCourses(prev => prev.filter(c => c.id !== course.id)); void fetchAll(); }
    } catch { /* ignore */ }
    setDeletingId(null);
  }

  async function addCourse() {
    if (!addForm.title.trim() || !addForm.description.trim() || !addForm.category.trim()) {
      setAddMsg("Title, description and category are required."); return;
    }
    setAddLoading(true); setAddMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/academy/admin/courses`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addForm.title.trim(),
          description: addForm.description.trim(),
          category: addForm.category.trim(),
          difficulty: addForm.difficulty,
          pathId: addForm.pathId,
          thumbnailEmoji: addForm.thumbnailEmoji || "📚",
          estimatedMinutes: Number(addForm.estimatedMinutes) || 30,
          sortOrder: courses.filter(c => c.pathId === addForm.pathId).length + 1,
        }),
      });
      if (r.ok) {
        setAddMsg("✓ Topic added");
        setShowAddForm(null);
        setAddForm({ title: "", description: "", category: "", difficulty: "beginner", pathId: "beginner", estimatedMinutes: "30", thumbnailEmoji: "📚" });
        void fetchAll();
      } else {
        const d = await r.json();
        setAddMsg(`✗ ${d.error ?? "Failed"}`);
      }
    } catch { setAddMsg("✗ Request failed"); }
    setAddLoading(false);
  }

  const coursesByPath = PATH_ORDER.reduce((acc, p) => {
    acc[p] = courses.filter(c => c.pathId === p);
    return acc;
  }, {} as Record<string, AdminCourse[]>);

  const STAT_CARDS = stats ? [
    { label: "Courses", value: stats.totalCourses, color: C.purple, icon: <BookOpen style={{ height: "13px", width: "13px" }} /> },
    { label: "Lessons", value: stats.totalLessons, color: C.cyan, icon: <FileText style={{ height: "13px", width: "13px" }} /> },
    { label: "Learners", value: stats.totalUsers, color: C.green, icon: <Users style={{ height: "13px", width: "13px" }} /> },
    { label: "Completions", value: stats.totalCompletions, color: C.amber, icon: <CheckCircle style={{ height: "13px", width: "13px" }} /> },
    { label: "Certificates", value: stats.totalCertificates, color: "#ec4899", icon: <GraduationCap style={{ height: "13px", width: "13px" }} /> },
    { label: "XP Awarded", value: (stats.totalXpAwarded ?? 0).toLocaleString(), color: C.amber, icon: <BarChart2 style={{ height: "13px", width: "13px" }} /> },
  ] : [];

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: "7px", fontSize: "12px",
    background: "hsl(var(--background))", border: "1px solid hsl(var(--border))",
    color: "hsl(var(--foreground))", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Header card */}
      <div style={{ background: "var(--card-bg)", borderRadius: "16px", padding: "18px 22px", border: "1px solid var(--glass-border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <GraduationCap style={{ height: "18px", width: "18px", color: C.purple }} />
            <span style={{ fontSize: "15px", fontWeight: 700, color: "hsl(var(--foreground))" }}>Academy Management</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={fetchAll} style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "11px", cursor: "pointer", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", gap: "4px" }}>
              <RefreshCw style={{ height: "11px", width: "11px" }} /> Refresh
            </button>
            <button onClick={runSeed} disabled={seedLoading} style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "11px", cursor: "pointer", background: `${C.purple}18`, border: `1px solid ${C.purple}40`, color: C.purple, fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
              {seedLoading ? <RefreshCw style={{ height: "11px", width: "11px", animation: "spin 1s linear infinite" }} /> : <Plus style={{ height: "11px", width: "11px" }} />}
              Re-seed Content
            </button>
          </div>
        </div>

        {seedMsg && (
          <div style={{ marginBottom: "14px", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", background: seedMsg.startsWith("✓") ? `${C.green}12` : "rgba(239,68,68,0.12)", color: seedMsg.startsWith("✓") ? C.green : "#ef4444", border: `1px solid ${seedMsg.startsWith("✓") ? C.green : "#ef4444"}30` }}>
            {seedMsg}
          </div>
        )}

        {addMsg && (
          <div style={{ marginBottom: "14px", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", background: addMsg.startsWith("✓") ? `${C.green}12` : "rgba(239,68,68,0.12)", color: addMsg.startsWith("✓") ? C.green : "#ef4444", border: `1px solid ${addMsg.startsWith("✓") ? C.green : "#ef4444"}30` }}>
            {addMsg}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>
            <RefreshCw style={{ height: "12px", width: "12px", animation: "spin 1s linear infinite" }} /> Loading...
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px" }}>
            {STAT_CARDS.map(s => (
              <div key={s.label} style={{ padding: "10px 12px", borderRadius: "10px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", color: s.color, marginBottom: "3px" }}>
                  {s.icon}
                  <span style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
                </div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "hsl(var(--foreground))" }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Course management — one section per path */}
      {PATH_ORDER.map(pathId => {
        const pathMeta = PATH_LABELS[pathId]!;
        const pathCourses = coursesByPath[pathId] ?? [];
        const isExpanded = expandedPath === pathId;
        const isAddingHere = showAddForm === pathId;

        return (
          <div key={pathId} style={{ background: "var(--card-bg)", borderRadius: "14px", border: "1px solid var(--glass-border)", overflow: "hidden" }}>
            {/* Path header */}
            <div
              onClick={() => setExpandedPath(isExpanded ? "" : pathId)}
              style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", cursor: "pointer", transition: "background 0.12s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "hsl(var(--muted))"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}
            >
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: pathMeta.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: "13px", color: "hsl(var(--foreground))", flex: 1 }}>{pathMeta.label} Path</span>
              <span style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>{pathCourses.length} topics · {pathCourses.filter(c => c.published).length} published</span>
              {isExpanded
                ? <ChevronUp style={{ height: "14px", width: "14px", color: "hsl(var(--muted-foreground))" }} />
                : <ChevronDown style={{ height: "14px", width: "14px", color: "hsl(var(--muted-foreground))" }} />}
            </div>

            {isExpanded && (
              <div style={{ borderTop: "1px solid hsl(var(--border))", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>

                {/* Course rows */}
                {pathCourses.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", padding: "10px 4px" }}>No topics yet in this path.</div>
                ) : pathCourses.map(course => (
                  <div key={course.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "9px", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
                    <span style={{ fontSize: "16px", flexShrink: 0 }}>{course.thumbnailEmoji ?? "📚"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {course.title}
                      </div>
                      <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>
                        {course.category} · {course.lessonCount} lesson{course.lessonCount !== 1 ? "s" : ""} · {course.estimatedMinutes}m
                      </div>
                    </div>

                    {/* Published badge */}
                    <button
                      onClick={() => togglePublish(course)}
                      disabled={togglingId === course.id}
                      style={{
                        display: "flex", alignItems: "center", gap: "4px",
                        padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 600,
                        cursor: "pointer", border: "none", transition: "all 0.12s",
                        background: course.published ? `${C.green}18` : "hsl(var(--muted))",
                        color: course.published ? C.green : "hsl(var(--muted-foreground))",
                      }}
                      title={course.published ? "Click to unpublish" : "Click to publish"}
                    >
                      {togglingId === course.id
                        ? <RefreshCw style={{ height: "10px", width: "10px", animation: "spin 1s linear infinite" }} />
                        : course.published
                          ? <><ToggleRight style={{ height: "11px", width: "11px" }} /> Live</>
                          : <><ToggleLeft style={{ height: "11px", width: "11px" }} /> Hidden</>
                      }
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => setConfirmDelete(course)}
                      disabled={deletingId === course.id}
                      style={{ padding: "5px", borderRadius: "6px", background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#ef4444"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "hsl(var(--muted-foreground))"}
                    >
                      {deletingId === course.id
                        ? <RefreshCw style={{ height: "13px", width: "13px", animation: "spin 1s linear infinite" }} />
                        : <Trash2 style={{ height: "13px", width: "13px" }} />}
                    </button>
                  </div>
                ))}

                {/* Add topic form */}
                {isAddingHere ? (
                  <div style={{ marginTop: "6px", padding: "14px", borderRadius: "10px", background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: "12px" }}>
                      Add Topic to {pathMeta.label} Path
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>Title *</div>
                          <input value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Fibonacci Retracements" style={inputStyle} />
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>Category *</div>
                          <input value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Price Action" style={inputStyle} />
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>Description *</div>
                        <textarea value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="What will students learn?" rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>Difficulty</div>
                          <select value={addForm.difficulty} onChange={e => setAddForm(f => ({ ...f, difficulty: e.target.value }))} style={inputStyle}>
                            {DIFFICULTY_OPTIONS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>Est. Minutes</div>
                          <input type="number" value={addForm.estimatedMinutes} onChange={e => setAddForm(f => ({ ...f, estimatedMinutes: e.target.value }))} min={5} max={300} style={inputStyle} />
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>Emoji</div>
                          <input value={addForm.thumbnailEmoji} onChange={e => setAddForm(f => ({ ...f, thumbnailEmoji: e.target.value }))} placeholder="📚" maxLength={2} style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
                        <button onClick={() => { setShowAddForm(null); setAddMsg(null); }} style={{ padding: "6px 14px", borderRadius: "7px", fontSize: "12px", cursor: "pointer", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                          Cancel
                        </button>
                        <button onClick={addCourse} disabled={addLoading} style={{ padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600, cursor: "pointer", background: pathMeta.color, border: "none", color: "#000", display: "flex", alignItems: "center", gap: "4px", opacity: addLoading ? 0.7 : 1 }}>
                          {addLoading ? <RefreshCw style={{ height: "11px", width: "11px", animation: "spin 1s linear infinite" }} /> : <Check style={{ height: "11px", width: "11px" }} />}
                          Add Topic
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setShowAddForm(pathId); setAddForm(f => ({ ...f, pathId, difficulty: pathId as never })); setAddMsg(null); }}
                    style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", background: `${pathMeta.color}12`, border: `1px dashed ${pathMeta.color}50`, color: pathMeta.color, marginTop: "4px" }}
                  >
                    <Plus style={{ height: "12px", width: "12px" }} /> Add Topic to {pathMeta.label}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ background: "hsl(var(--card))", borderRadius: "14px", padding: "24px", maxWidth: "360px", width: "100%", border: "1px solid hsl(var(--border))" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <Trash2 style={{ height: "16px", width: "16px", color: "#ef4444" }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "hsl(var(--foreground))" }}>Delete Topic</span>
            </div>
            <div style={{ fontSize: "13px", color: "hsl(var(--muted-foreground))", marginBottom: "18px", lineHeight: "1.5" }}>
              Permanently delete <strong style={{ color: "hsl(var(--foreground))" }}>{confirmDelete.title}</strong>? This will also remove all its lessons, quiz questions, and user progress.
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "7px 16px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                Cancel
              </button>
              <button onClick={() => deleteCourse(confirmDelete)} style={{ padding: "7px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", background: "#ef4444", border: "none", color: "#fff", display: "flex", alignItems: "center", gap: "4px" }}>
                <Trash2 style={{ height: "11px", width: "11px" }} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
