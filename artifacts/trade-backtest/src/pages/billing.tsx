import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Crown, CreditCard, Calendar, AlertTriangle, CheckCircle, Loader2, ArrowRight, Shield, Zap, Tag, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSubscription } from "@/lib/subscription-context";
import { API_BASE } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";

interface Payment {
  id: number;
  planId: number;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Shield className="h-5 w-5" style={{ color: "#888" }} />,
  pro: <Zap className="h-5 w-5" style={{ color: "#c0c0c0" }} />,
  elite: <Crown className="h-5 w-5" style={{ color: "#e8e8e8" }} />,
};

export default function BillingPage() {
  const { user } = useAuth();
  const { plan, subscription, loading: subLoading, refresh, isPro, isElite } = useSubscription();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [validating, setValidating] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercent: number; planSlug: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("tt_pending_coupon");
    if (saved) {
      try { setAppliedCoupon(JSON.parse(saved)); } catch { localStorage.removeItem("tt_pending_coupon"); }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("tt_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(`${API_BASE}/api/subscription/payments`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setPayments(data); setPaymentsLoading(false); })
      .catch(() => setPaymentsLoading(false));
  }, [user]);

  async function validateCoupon() {
    if (!couponInput.trim()) return;
    setValidating(true);
    setCouponError("");
    try {
      const token = localStorage.getItem("tt_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/subscription/validate-coupon`, {
        method: "POST",
        headers,
        body: JSON.stringify({ code: couponInput.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        const coupon = { code: data.code, discountPercent: data.discountPercent, planSlug: data.planSlug };
        setAppliedCoupon(coupon);
        localStorage.setItem("tt_pending_coupon", JSON.stringify(coupon));
        setCouponInput("");
        toast({ title: "Coupon applied!", description: `${data.discountPercent}% discount saved for your next upgrade.` });
      } else {
        setCouponError(data.error ?? "Invalid coupon code");
      }
    } catch {
      setCouponError("Failed to validate. Please try again.");
    } finally {
      setValidating(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    localStorage.removeItem("tt_pending_coupon");
  }

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel your subscription? You'll keep access until the end of the billing period.")) return;
    setCancelling(true);
    try {
      const token = localStorage.getItem("tt_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/subscription/cancel`, { method: "POST", headers });
      if (res.ok) { refresh(); }
    } finally { setCancelling(false); }
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <CreditCard className="h-10 w-10" style={{ color: "hsl(var(--muted-foreground))" }} />
        <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Sign in to manage your billing</p>
        <button onClick={() => navigate("/dashboard")} className="text-sm px-4 py-2 rounded-xl"
          style={{ background: "#FFFFFF", color: "#050505" }}>Go to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <span className="h-9 w-9 rounded-xl flex items-center justify-center"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          <CreditCard style={{ height: "16px", width: "16px", color: "hsl(var(--foreground))" }} />
        </span>
        <div>
          <h1 className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>Billing & Subscription</h1>
          <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Manage your plan and payment history</p>
        </div>
      </div>

      {/* Current plan */}
      <div className="rounded-2xl p-5 mb-4 glass-card" style={{ border: "1px solid var(--glass-border)" }}>
        <p className="text-xs font-medium mb-3 tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>CURRENT PLAN</p>
        {subLoading ? (
          <div className="flex items-center gap-2 py-2"><Loader2 className="h-4 w-4 animate-spin" style={{ color: "hsl(var(--muted-foreground))" }} /></div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                {PLAN_ICONS[plan?.slug ?? "free"]}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>{plan?.name ?? "Free"}</p>
                  {subscription?.grantedByAdmin && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}>Admin Grant</span>
                  )}
                </div>
                <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {plan?.priceMonthly === 0 ? "Free forever" : `₹${((plan?.priceMonthly ?? 0) / 100).toLocaleString("en-IN")}/month`}
                </p>
                {subscription?.currentPeriodEnd && (
                  <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <Calendar className="h-2.5 w-2.5" />
                    Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {(isPro || isElite) && subscription && !subscription.grantedByAdmin && (
                <button onClick={handleCancel} disabled={cancelling}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                  style={{ background: "rgba(220,38,38,0.08)", color: "#f87171", border: "1px solid rgba(220,38,38,0.22)" }}>
                  {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                  Cancel
                </button>
              )}
              <button onClick={() => navigate("/pricing")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                style={{ background: "var(--glass-bg)", color: "hsl(var(--foreground))", border: "1px solid var(--glass-border)" }}>
                <ArrowRight className="h-3 w-3" />
                {(isPro || isElite) ? "Change Plan" : "Upgrade"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Coupon code */}
      <div className="rounded-2xl p-5 mb-4 glass-card" style={{ border: "1px solid var(--glass-border)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Tag className="h-3.5 w-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
          <p className="text-xs font-medium tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>COUPON CODE</p>
        </div>

        {appliedCoupon ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <div className="flex items-center gap-2.5">
                <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: "#4ade80" }} />
                <div>
                  <p className="text-sm font-semibold font-mono tracking-wider" style={{ color: "hsl(var(--foreground))" }}>{appliedCoupon.code}</p>
                  <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {appliedCoupon.discountPercent}% off · {appliedCoupon.planSlug === "all" ? "any plan" : `${appliedCoupon.planSlug} plan only`}
                  </p>
                </div>
              </div>
              <button onClick={removeCoupon} className="p-1.5 rounded-lg transition-colors"
                style={{ color: "hsl(var(--muted-foreground))" }}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={() => navigate("/pricing")}
              className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              style={{ background: "#FFFFFF", color: "#050505" }}>
              <ArrowRight className="h-4 w-4" />
              Upgrade with {appliedCoupon.discountPercent}% off
            </button>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                onKeyDown={e => e.key === "Enter" && validateCoupon()}
                placeholder="ENTER CODE"
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-mono tracking-widest outline-none"
                style={{
                  background: "var(--glass-bg)",
                  border: `1px solid ${couponError ? "rgba(248,113,113,0.45)" : "var(--glass-border)"}`,
                  color: "hsl(var(--foreground))",
                }}
              />
              <button
                onClick={validateCoupon}
                disabled={validating || !couponInput.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all"
                style={{
                  background: couponInput.trim() ? "#FFFFFF" : "var(--glass-bg)",
                  color: couponInput.trim() ? "#050505" : "hsl(var(--muted-foreground))",
                  border: "1px solid var(--glass-border)",
                  opacity: validating ? 0.7 : 1,
                }}>
                {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
              </button>
            </div>
            {couponError && (
              <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: "#f87171" }}>
                <AlertTriangle className="h-3 w-3 flex-shrink-0" /> {couponError}
              </p>
            )}
            <p className="text-[11px] mt-2" style={{ color: "hsl(var(--muted-foreground))" }}>
              Apply a coupon to get a discount on your next plan upgrade.
            </p>
          </>
        )}
      </div>

      {/* Plan features */}
      {plan && (
        <div className="rounded-2xl p-5 mb-4 glass-card" style={{ border: "1px solid var(--glass-border)" }}>
          <p className="text-xs font-medium mb-3 tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>YOUR FEATURES</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Backtests/month", plan.features.maxBacktestsPerMonth === -1 ? "Unlimited" : String(plan.features.maxBacktestsPerMonth)],
              ["AI queries/day", plan.features.aiQueriesPerDay === -1 ? "Unlimited" : plan.features.aiQueriesPerDay === 0 ? "None" : `${plan.features.aiQueriesPerDay}/day`],
              ["Max leverage", `${plan.features.maxLeverage}x`],
              ["Community posting", plan.features.communityPost ? "Yes" : "No"],
              ["Replay mode", plan.features.replayMode ? "Yes" : "No"],
              ["Multi-TF view", plan.features.multiTfView ? "Yes" : "No"],
              ["All indicators", plan.features.allIndicators ? "Yes" : "No"],
              ["Data export", plan.features.dataExport ? "Yes" : "No"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</span>
                <span className="text-[11px] font-semibold"
                  style={{ color: value === "No" || value === "None" ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="rounded-2xl overflow-hidden glass-card" style={{ border: "1px solid var(--glass-border)" }}>
        <div className="px-5 py-3.5" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <p className="text-xs font-medium tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>PAYMENT HISTORY</p>
        </div>
        {paymentsLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "hsl(var(--muted-foreground))" }} /></div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <CreditCard className="h-7 w-7" style={{ color: "hsl(var(--muted-foreground))" }} />
            <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>No payments yet</p>
          </div>
        ) : (
          <div>
            {payments.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: i < payments.length - 1 ? "1px solid var(--glass-border)" : "none" }}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{p.razorpayOrderId.slice(0, 24)}…</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                      style={p.status === "captured"
                        ? { background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }
                        : p.status === "pending"
                        ? { background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }
                        : { background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <p className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>₹{(p.amount / 100).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
