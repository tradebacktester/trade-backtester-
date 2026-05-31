import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Crown, CreditCard, Calendar, AlertTriangle, CheckCircle, Loader2, ArrowRight, Shield, Zap, Star } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSubscription } from "@/lib/subscription-context";

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
  pro: <Zap className="h-5 w-5" style={{ color: "hsl(265,89%,65%)" }} />,
  elite: <Crown className="h-5 w-5" style={{ color: "hsl(38,100%,60%)" }} />,
};

export default function BillingPage() {
  const { user } = useAuth();
  const { plan, subscription, loading: subLoading, refresh, isPro, isElite } = useSubscription();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("tt_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch("/api/subscription/payments", { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setPayments(data); setPaymentsLoading(false); })
      .catch(() => setPaymentsLoading(false));
  }, [user]);

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel your subscription? You'll keep access until the end of the billing period.")) return;
    setCancelling(true);
    try {
      const token = localStorage.getItem("tt_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/subscription/cancel", { method: "POST", headers });
      if (res.ok) { refresh(); }
    } finally { setCancelling(false); }
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <CreditCard className="h-10 w-10" style={{ color: "#ddd" }} />
        <p className="text-sm" style={{ color: "#888" }}>Sign in to manage your billing</p>
        <button onClick={() => navigate("/dashboard")} className="text-sm px-4 py-2 rounded-xl" style={{ background: "#111", color: "#fff" }}>Go to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <span className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "#f0f0f0" }}>
          <CreditCard style={{ height: "16px", width: "16px", color: "#555" }} />
        </span>
        <div>
          <h1 className="text-base font-semibold" style={{ color: "#111" }}>Billing & Subscription</h1>
          <p className="text-xs" style={{ color: "#888" }}>Manage your plan and payment history</p>
        </div>
      </div>

      {/* Current plan */}
      <div className="rounded-2xl p-5 mb-5" style={{ border: "1px solid rgba(0,0,0,0.09)", background: "#fff" }}>
        <p className="text-xs font-medium mb-3" style={{ color: "#888" }}>CURRENT PLAN</p>
        {subLoading ? (
          <div className="flex items-center gap-2 py-2"><Loader2 className="h-4 w-4 animate-spin" style={{ color: "#aaa" }} /></div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{ background: plan?.slug === "elite" ? "rgba(245,158,11,0.1)" : plan?.slug === "pro" ? "rgba(139,92,246,0.1)" : "#f5f5f5" }}>
                {PLAN_ICONS[plan?.slug ?? "free"]}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold" style={{ color: "#111" }}>{plan?.name ?? "Free"}</p>
                  {subscription?.grantedByAdmin && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "#dcfce7", color: "#16a34a" }}>Admin Grant</span>
                  )}
                </div>
                <p className="text-xs" style={{ color: "#888" }}>
                  {plan?.priceMonthly === 0 ? "Free forever" : `₹${((plan?.priceMonthly ?? 0) / 100).toLocaleString("en-IN")}/month`}
                </p>
                {subscription?.currentPeriodEnd && (
                  <p className="text-[10px] mt-0.5" style={{ color: "#aaa" }}>
                    Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {(isPro || isElite) && subscription && !subscription.grantedByAdmin && (
                <button onClick={handleCancel} disabled={cancelling}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                  style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" }}>
                  {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                  Cancel
                </button>
              )}
              <button onClick={() => navigate("/pricing")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                style={{ background: "rgba(139,92,246,0.08)", color: "hsl(265,89%,60%)", border: "1px solid rgba(139,92,246,0.2)" }}>
                <ArrowRight className="h-3 w-3" />
                {(isPro || isElite) ? "Change Plan" : "Upgrade"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Plan features */}
      {plan && (
        <div className="rounded-2xl p-5 mb-5" style={{ border: "1px solid rgba(0,0,0,0.09)", background: "#fff" }}>
          <p className="text-xs font-medium mb-3" style={{ color: "#888" }}>YOUR FEATURES</p>
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
                style={{ background: "#fafafa", border: "1px solid rgba(0,0,0,0.05)" }}>
                <span className="text-[11px]" style={{ color: "#888" }}>{label}</span>
                <span className="text-[11px] font-semibold" style={{ color: value === "No" || value === "None" ? "#ccc" : "#111" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.09)", background: "#fff" }}>
        <div className="px-5 py-3.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <p className="text-xs font-medium" style={{ color: "#888" }}>PAYMENT HISTORY</p>
        </div>
        {paymentsLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "#ddd" }} /></div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <CreditCard className="h-7 w-7" style={{ color: "#ddd" }} />
            <p className="text-sm" style={{ color: "#bbb" }}>No payments yet</p>
          </div>
        ) : (
          <div>
            {payments.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: i < payments.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono" style={{ color: "#555" }}>{p.razorpayOrderId}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                      style={p.status === "captured" ? { background: "#dcfce7", color: "#16a34a" } : p.status === "pending" ? { background: "#fef9c3", color: "#ca8a04" } : { background: "#fee2e2", color: "#dc2626" }}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: "#aaa" }}>
                    {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <p className="text-sm font-semibold" style={{ color: "#111" }}>₹{(p.amount / 100).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
