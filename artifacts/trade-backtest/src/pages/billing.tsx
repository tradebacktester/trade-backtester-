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
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <CreditCard style={{ height: "16px", width: "16px", color: "#FFFFFF" }} />
        </span>
        <div>
          <h1 className="text-base font-semibold" style={{ color: "hsl(var(--foreground))" }}>Billing & Subscription</h1>
          <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Manage your plan and payment history</p>
        </div>
      </div>

      {/* Current plan */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
        <p className="text-xs font-medium mb-3 tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>CURRENT PLAN</p>
        {subLoading ? (
          <div className="flex items-center gap-2 py-2"><Loader2 className="h-4 w-4 animate-spin" style={{ color: "hsl(var(--muted-foreground))" }} /></div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{ background: plan?.slug === "elite" ? "rgba(245,158,11,0.1)" : plan?.slug === "pro" ? "rgba(139,92,246,0.1)" : "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
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
                  <p className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
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
                style={{ background: "rgba(139,92,246,0.1)", color: "hsl(265,89%,70%)", border: "1px solid rgba(139,92,246,0.25)" }}>
                <ArrowRight className="h-3 w-3" />
                {(isPro || isElite) ? "Change Plan" : "Upgrade"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Plan features */}
      {plan && (
        <div className="rounded-2xl p-5 mb-5" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
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
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--glass-border)" }}>
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
                    <span className="text-xs font-mono" style={{ color: "hsl(var(--muted-foreground))" }}>{p.razorpayOrderId}</span>
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
