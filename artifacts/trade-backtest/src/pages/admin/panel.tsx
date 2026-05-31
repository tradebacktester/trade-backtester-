import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Shield, Users, FileText, LogOut, Ban, CheckCircle, RefreshCw, Save,
  ChevronDown, ChevronUp, UserCheck, UserX, Crown, CreditCard, Zap,
  Plus, Edit2, ToggleLeft, ToggleRight, Gift, Trash2, Star,
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
  maxBacktestsPerMonth: "Backtests/month (-1=∞)", aiQueriesPerDay: "AI queries/day (-1=∞)",
  maxLeverage: "Max leverage", communityPost: "Community posting",
  replayMode: "Replay mode", multiTfView: "Multi-TF view",
  dataExport: "Data export", priorityBadge: "Priority badge", allIndicators: "All indicators",
};
const FEATURE_TYPES: Record<string, "number" | "boolean"> = {
  maxBacktestsPerMonth: "number", aiQueriesPerDay: "number", maxLeverage: "number",
  communityPost: "boolean", replayMode: "boolean", multiTfView: "boolean",
  dataExport: "boolean", priorityBadge: "boolean", allIndicators: "boolean",
};

type Tab = "users" | "policies" | "plans" | "subscribers" | "payments";

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { adminToken, setAdminToken } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  const headers = { "Content-Type": "application/json", "x-admin-token": adminToken ?? "" };

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
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: "", slug: "", description: "", priceMonthly: 0 });
  const [savingPlan, setSavingPlan] = useState<number | null>(null);

  // ── Subscribers ──
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [grantForm, setGrantForm] = useState({ userId: "", planId: "", months: "1" });
  const [granting, setGranting] = useState(false);

  // ── Payments ──
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  useEffect(() => { if (!adminToken) { setLocation("/admin"); return; } }, [adminToken]);

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
    } catch { }
    finally { setPoliciesLoading(false); }
  }, [adminToken]);

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const res = await fetch("/api/admin/plans", { headers });
      if (res.ok) setPlans(await res.json());
    } catch { }
    finally { setPlansLoading(false); }
  }, [adminToken]);

  const fetchSubs = useCallback(async () => {
    setSubsLoading(true);
    try {
      const res = await fetch("/api/admin/subscriptions", { headers });
      if (res.ok) setSubs(await res.json());
    } catch { }
    finally { setSubsLoading(false); }
  }, [adminToken]);

  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const res = await fetch("/api/admin/payments", { headers });
      if (res.ok) setPayments(await res.json());
    } catch { }
    finally { setPaymentsLoading(false); }
  }, [adminToken]);

  useEffect(() => {
    if (!adminToken) return;
    fetchUsers(); fetchPolicies(); fetchPlans(); fetchSubs(); fetchPayments();
  }, [adminToken]);

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

  async function savePlanEdit(plan: SubscriptionPlan) {
    setSavingPlan(plan.id);
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({
          name: plan.name, description: plan.description,
          priceMonthly: plan.priceMonthly, features: plan.features,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlans(ps => ps.map(p => p.id === plan.id ? updated : p));
        setEditingPlan(null);
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
    if (!grantForm.userId || !grantForm.planId) return;
    setGranting(true);
    try {
      const res = await fetch("/api/admin/grant-premium", {
        method: "POST", headers,
        body: JSON.stringify({ userId: parseInt(grantForm.userId), planId: parseInt(grantForm.planId), months: parseInt(grantForm.months) }),
      });
      if (res.ok) { fetchSubs(); setGrantForm({ userId: "", planId: "", months: "1" }); }
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
    ["plans", Crown, "Plans"],
    ["subscribers", Star, "Subscribers"],
    ["payments", CreditCard, "Payments"],
  ];

  return (
    <div>
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
        <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
          style={{ border: "1px solid rgba(0,0,0,0.1)", color: "#666", background: "#f5f5f5" }}>
          <LogOut style={{ height: "12px", width: "12px" }} /> Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(([key, Icon, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={tab === key ? { background: "#111", color: "#fff" } : { background: "#f5f5f5", color: "#666", border: "1px solid rgba(0,0,0,0.08)" }}>
            <Icon style={{ height: "13px", width: "13px" }} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Users ── */}
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
                        {user.banned ? <><UserCheck style={{ height: "11px", width: "11px" }} />Unban</> : <><UserX style={{ height: "11px", width: "11px" }} />Ban</>}
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
      {tab === "policies" && (
        <div className="flex flex-col gap-3">
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
                {expandedPolicy === policy.slug ? <ChevronUp style={{ height: "14px", width: "14px", color: "#aaa" }} /> : <ChevronDown style={{ height: "14px", width: "14px", color: "#aaa" }} />}
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
                    {savedSlug === policy.slug && <span className="flex items-center gap-1 text-xs" style={{ color: "#16a34a" }}><CheckCircle style={{ height: "11px", width: "11px" }} />Saved</span>}
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

      {/* ── Plans ── */}
      {tab === "plans" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "#111" }}>Subscription Plans</p>
            <button onClick={() => setShowNewPlan(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: "#111", color: "#fff" }}>
              <Plus style={{ height: "12px", width: "12px" }} /> New Plan
            </button>
          </div>

          {showNewPlan && (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ border: "1px solid rgba(0,0,0,0.09)", background: "#fff" }}>
              <p className="text-xs font-semibold" style={{ color: "#111" }}>Create New Plan</p>
              <div className="grid grid-cols-2 gap-3">
                {[["Name", "name", "text", newPlan.name], ["Slug (unique ID)", "slug", "text", newPlan.slug], ["Description", "description", "text", newPlan.description], ["Price (paise, e.g. 49900 = ₹499)", "priceMonthly", "number", newPlan.priceMonthly]].map(([label, field, type, val]) => (
                  <div key={field as string} className="flex flex-col gap-1">
                    <label className="text-[11px]" style={{ color: "#666" }}>{label as string}</label>
                    <input type={type as string} value={val as string | number}
                      onChange={e => setNewPlan(p => ({ ...p, [field as string]: type === "number" ? parseInt(e.target.value) || 0 : e.target.value }))}
                      className="text-xs px-3 py-2 rounded-lg outline-none"
                      style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fafafa" }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowNewPlan(false)} className="px-3 py-1.5 rounded-xl text-xs" style={{ background: "#f5f5f5", color: "#666" }}>Cancel</button>
                <button onClick={createPlan} disabled={savingPlan === -1} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium" style={{ background: "#111", color: "#fff" }}>
                  <Plus style={{ height: "12px", width: "12px" }} /> Create
                </button>
              </div>
            </div>
          )}

          {plansLoading ? (
            <div className="flex items-center justify-center py-12 text-sm" style={{ color: "#aaa" }}>Loading plans…</div>
          ) : plans.map(plan => (
            <div key={plan.id} className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.09)", background: "#fff" }}>
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: editingPlan?.id === plan.id ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
                <div className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: plan.slug === "elite" ? "rgba(245,158,11,0.1)" : plan.slug === "pro" ? "rgba(139,92,246,0.1)" : "#f5f5f5" }}>
                    {plan.slug === "elite" ? <Crown style={{ height: "14px", width: "14px", color: "hsl(38,100%,60%)" }} /> : plan.slug === "pro" ? <Zap style={{ height: "14px", width: "14px", color: "hsl(265,89%,65%)" }} /> : <Shield style={{ height: "14px", width: "14px", color: "#888" }} />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: "#111" }}>{plan.name}</p>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "#f0f0f0", color: "#888" }}>{plan.slug}</span>
                      {!plan.isActive && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#fee2e2", color: "#dc2626" }}>Disabled</span>}
                      {plan.isDefault && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#dcfce7", color: "#16a34a" }}>Default</span>}
                    </div>
                    <p className="text-[11px]" style={{ color: "#888" }}>
                      {plan.priceMonthly === 0 ? "Free" : `₹${(plan.priceMonthly / 100).toLocaleString("en-IN")}/mo`}
                      {" · "}{plan.description.slice(0, 45)}{plan.description.length > 45 ? "…" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => togglePlanActive(plan)} disabled={savingPlan === plan.id || plan.isDefault}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors"
                    style={plan.isActive ? { background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" } : { background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" }}>
                    {plan.isActive ? <ToggleRight style={{ height: "12px", width: "12px" }} /> : <ToggleLeft style={{ height: "12px", width: "12px" }} />}
                    {plan.isActive ? "Active" : "Disabled"}
                  </button>
                  <button onClick={() => setEditingPlan(editingPlan?.id === plan.id ? null : { ...plan })}
                    className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                    style={{ color: "#888" }}>
                    <Edit2 style={{ height: "13px", width: "13px" }} />
                  </button>
                </div>
              </div>

              {editingPlan?.id === plan.id && (
                <div className="px-5 pb-5 pt-4 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px]" style={{ color: "#666" }}>Plan Name</label>
                      <input value={editingPlan.name} onChange={e => setEditingPlan(p => p ? { ...p, name: e.target.value } : p)}
                        className="text-xs px-3 py-2 rounded-lg outline-none" style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fafafa" }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px]" style={{ color: "#666" }}>Price (paise)</label>
                      <input type="number" value={editingPlan.priceMonthly} onChange={e => setEditingPlan(p => p ? { ...p, priceMonthly: parseInt(e.target.value) || 0 } : p)}
                        className="text-xs px-3 py-2 rounded-lg outline-none" style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fafafa" }}
                      />
                    </div>
                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-[11px]" style={{ color: "#666" }}>Description</label>
                      <input value={editingPlan.description} onChange={e => setEditingPlan(p => p ? { ...p, description: e.target.value } : p)}
                        className="text-xs px-3 py-2 rounded-lg outline-none" style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fafafa" }}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold mb-2" style={{ color: "#666" }}>Feature Flags</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                        const featureType = FEATURE_TYPES[key];
                        const val = editingPlan.features[key];
                        return (
                          <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "#fafafa", border: "1px solid rgba(0,0,0,0.06)" }}>
                            <label className="text-[10px]" style={{ color: "#666" }}>{label}</label>
                            {featureType === "boolean" ? (
                              <button onClick={() => setEditingPlan(p => p ? { ...p, features: { ...p.features, [key]: !val } } : p)}
                                className="text-[10px] px-2 py-0.5 rounded font-medium"
                                style={val ? { background: "#dcfce7", color: "#16a34a" } : { background: "#f0f0f0", color: "#888" }}>
                                {val ? "Yes" : "No"}
                              </button>
                            ) : (
                              <input type="number" value={val as number ?? 0}
                                onChange={e => setEditingPlan(p => p ? { ...p, features: { ...p.features, [key]: parseInt(e.target.value) || 0 } } : p)}
                                className="text-[10px] px-2 py-1 rounded w-16 text-right outline-none"
                                style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fff" }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingPlan(null)} className="px-3 py-1.5 rounded-xl text-xs" style={{ background: "#f5f5f5", color: "#666" }}>Cancel</button>
                    <button onClick={() => savePlanEdit(editingPlan)} disabled={savingPlan === plan.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                      style={{ background: "#111", color: "#fff" }}>
                      <Save style={{ height: "11px", width: "11px" }} /> Save Changes
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Subscribers ── */}
      {tab === "subscribers" && (
        <div className="flex flex-col gap-4">
          {/* Grant premium panel */}
          <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.03)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Gift style={{ height: "14px", width: "14px", color: "hsl(265,89%,65%)" }} />
              <p className="text-sm font-semibold" style={{ color: "#111" }}>Grant Premium Access</p>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px]" style={{ color: "#666" }}>User ID</label>
                <input type="number" placeholder="e.g. 1" value={grantForm.userId}
                  onChange={e => setGrantForm(f => ({ ...f, userId: e.target.value }))}
                  className="text-xs px-3 py-2 rounded-lg outline-none" style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fff" }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px]" style={{ color: "#666" }}>Plan</label>
                <select value={grantForm.planId} onChange={e => setGrantForm(f => ({ ...f, planId: e.target.value }))}
                  className="text-xs px-3 py-2 rounded-lg outline-none" style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fff" }}>
                  <option value="">Select plan</option>
                  {plans.filter(p => !p.isDefault).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px]" style={{ color: "#666" }}>Duration (months)</label>
                <input type="number" min="1" max="24" value={grantForm.months}
                  onChange={e => setGrantForm(f => ({ ...f, months: e.target.value }))}
                  className="text-xs px-3 py-2 rounded-lg outline-none" style={{ border: "1px solid rgba(0,0,0,0.12)", background: "#fff" }}
                />
              </div>
            </div>
            <button onClick={grantPremium} disabled={granting || !grantForm.userId || !grantForm.planId}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-opacity"
              style={{ background: "linear-gradient(135deg, hsl(265,89%,60%), hsl(285,89%,60%))", color: "#fff", opacity: granting || !grantForm.userId || !grantForm.planId ? 0.6 : 1 }}>
              <Gift style={{ height: "12px", width: "12px" }} />
              {granting ? "Granting…" : "Grant Access"}
            </button>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.09)", background: "#fff" }}>
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <div className="flex items-center gap-2">
                <Star style={{ height: "14px", width: "14px", color: "#888" }} />
                <span className="text-sm font-semibold" style={{ color: "#111" }}>All Subscriptions</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0f0f0", color: "#666" }}>{subs.length}</span>
              </div>
              <button onClick={fetchSubs} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ color: "#888" }}>
                <RefreshCw style={{ height: "13px", width: "13px" }} />
              </button>
            </div>
            {subsLoading ? (
              <div className="flex items-center justify-center py-12 text-sm" style={{ color: "#aaa" }}>Loading…</div>
            ) : subs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Star style={{ height: "28px", width: "28px", color: "#ddd" }} />
                <p className="text-sm" style={{ color: "#aaa" }}>No subscriptions yet</p>
              </div>
            ) : (
              <div>
                {subs.map((sub, i) => (
                  <div key={sub.id} className="flex items-center justify-between px-5 py-3.5"
                    style={{ borderBottom: i < subs.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                        style={{ background: "#f0f0f0", color: "#555" }}>
                        {(sub.userName ?? "?").charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium" style={{ color: "#111" }}>{sub.userName ?? "Unknown"}</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                            style={sub.status === "active" ? { background: "#dcfce7", color: "#16a34a" } : { background: "#fee2e2", color: "#dc2626" }}>
                            {sub.status}
                          </span>
                          {sub.grantedByAdmin && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.1)", color: "hsl(265,89%,60%)" }}>Admin Grant</span>}
                        </div>
                        <p className="text-[10px]" style={{ color: "#888" }}>{sub.userEmail} · Plan: {sub.planName}</p>
                        {sub.currentPeriodEnd && (
                          <p className="text-[10px]" style={{ color: "#bbb" }}>
                            Expires {new Date(sub.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>
                    </div>
                    {sub.status === "active" && (
                      <button onClick={() => revokeSubscription(sub.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium"
                        style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" }}>
                        <Trash2 style={{ height: "10px", width: "10px" }} /> Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Payments ── */}
      {tab === "payments" && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.09)", background: "#fff" }}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
            <div className="flex items-center gap-2">
              <CreditCard style={{ height: "14px", width: "14px", color: "#666" }} />
              <span className="text-sm font-semibold" style={{ color: "#111" }}>All Payments</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0f0f0", color: "#666" }}>{payments.length}</span>
            </div>
            <button onClick={fetchPayments} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ color: "#888" }}>
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
                          style={p.status === "captured" ? { background: "#dcfce7", color: "#16a34a" } : p.status === "pending" ? { background: "#fef9c3", color: "#ca8a04" } : { background: "#fee2e2", color: "#dc2626" }}>
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
