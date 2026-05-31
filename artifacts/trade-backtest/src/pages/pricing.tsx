import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Crown, Check, Zap, Star, Shield, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSubscription, type SubscriptionPlan } from "@/lib/subscription-context";
import { AuthModal } from "@/components/auth-modal";

declare global {
  interface Window { Razorpay: new (opts: Record<string, unknown>) => { open(): void }; }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (document.getElementById("rzp-script")) { resolve(true); return; }
    const s = document.createElement("script");
    s.id = "rzp-script";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const FEATURE_LABELS: Record<string, string> = {
  maxBacktestsPerMonth: "Backtests / month",
  aiQueriesPerDay: "AI queries / day",
  maxLeverage: "Max leverage",
  communityPost: "Community posting",
  replayMode: "Chart replay mode",
  multiTfView: "Multi-timeframe view",
  dataExport: "Data export",
  priorityBadge: "Priority member badge",
  allIndicators: "All 11 indicators",
};

function featureValue(key: string, val: unknown): string {
  if (key === "maxBacktestsPerMonth") return val === -1 ? "Unlimited" : String(val);
  if (key === "aiQueriesPerDay") return val === -1 ? "Unlimited" : val === 0 ? "None" : `${val}/day`;
  if (key === "maxLeverage") return `${val}x`;
  if (typeof val === "boolean") return val ? "✓" : "—";
  return String(val);
}

export default function PricingPage() {
  const { user } = useAuth();
  const { plan: currentPlan, subscription, refresh } = useSubscription();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<number | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch("/api/subscription/plans")
      .then(r => r.json())
      .then(data => { setPlans(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSubscribe(plan: SubscriptionPlan) {
    if (!user) { setShowAuth(true); return; }
    if (plan.priceMonthly === 0) return;
    if (currentPlan?.slug === plan.slug && subscription?.status === "active") return;

    setSubscribing(plan.id);
    try {
      const token = localStorage.getItem("tt_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const orderRes = await fetch("/api/subscription/create-order", {
        method: "POST",
        headers,
        body: JSON.stringify({ planId: plan.id }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) { alert(order.error ?? "Failed to create order"); setSubscribing(null); return; }

      if (order.keyId === "rzp_test_placeholder") {
        alert("Razorpay credentials not configured yet. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables to enable payments.");
        setSubscribing(null);
        return;
      }

      await loadRazorpayScript();
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Trade Lab",
        description: `${order.planName} Plan – Monthly`,
        order_id: order.orderId,
        prefill: { name: user.name, email: user.email },
        theme: { color: "#8b5cf6" },
        handler: async (response: Record<string, string>) => {
          const verifyRes = await fetch("/api/subscription/verify", {
            method: "POST",
            headers,
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              planId: plan.id,
            }),
          });
          if (verifyRes.ok) {
            refresh();
            navigate("/billing");
          } else {
            alert("Payment verification failed. Contact support.");
          }
        },
      });
      rzp.open();
    } catch (err) {
      alert("Something went wrong. Please try again.");
    } finally {
      setSubscribing(null);
    }
  }

  const PLAN_ICONS: Record<string, React.ReactNode> = {
    free: <Shield className="h-5 w-5" style={{ color: "#888" }} />,
    pro: <Zap className="h-5 w-5" style={{ color: "hsl(265,89%,65%)" }} />,
    elite: <Crown className="h-5 w-5" style={{ color: "hsl(38,100%,60%)" }} />,
  };

  const PLAN_GRADIENTS: Record<string, string> = {
    free: "rgba(0,0,0,0.02)",
    pro: "rgba(139,92,246,0.06)",
    elite: "rgba(245,158,11,0.06)",
  };

  const PLAN_BORDER: Record<string, string> = {
    free: "rgba(0,0,0,0.08)",
    pro: "rgba(139,92,246,0.25)",
    elite: "rgba(245,158,11,0.3)",
  };

  const FEATURE_ORDER = [
    "maxBacktestsPerMonth", "aiQueriesPerDay", "maxLeverage",
    "allIndicators", "communityPost", "replayMode",
    "multiTfView", "dataExport", "priorityBadge",
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />

      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
          style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "hsl(265,89%,65%)" }}>
          <Crown className="h-3 w-3" /> Premium Plans
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#111" }}>Choose your plan</h1>
        <p className="text-sm" style={{ color: "#888" }}>
          Unlock advanced backtesting, AI analysis, and real-time tools to trade smarter.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "#aaa" }} /></div>
      ) : (
        <>
          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
            {plans.map(plan => {
              const isCurrentPlan = currentPlan?.slug === plan.slug;
              const isFree = plan.priceMonthly === 0;
              const isPopular = plan.slug === "pro";

              return (
                <div key={plan.id} className="relative rounded-2xl p-6 flex flex-col gap-5"
                  style={{ background: PLAN_GRADIENTS[plan.slug] ?? "#fff", border: `1px solid ${PLAN_BORDER[plan.slug] ?? "rgba(0,0,0,0.08)"}`, boxShadow: isPopular ? "0 8px 32px rgba(139,92,246,0.15)" : "none" }}>
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 rounded-full text-[10px] font-semibold"
                        style={{ background: "linear-gradient(135deg, hsl(265,89%,60%), hsl(285,89%,60%))", color: "#fff" }}>
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-9 w-9 rounded-xl flex items-center justify-center"
                        style={{ background: plan.slug === "elite" ? "rgba(245,158,11,0.1)" : plan.slug === "pro" ? "rgba(139,92,246,0.1)" : "#f5f5f5" }}>
                        {PLAN_ICONS[plan.slug]}
                      </span>
                      <div>
                        <p className="text-base font-bold" style={{ color: "#111" }}>{plan.name}</p>
                        <p className="text-[11px]" style={{ color: "#888" }}>{plan.description.slice(0, 40)}…</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    {isFree ? (
                      <p className="text-3xl font-bold" style={{ color: "#111" }}>₹0<span className="text-sm font-normal text-gray-400">/mo</span></p>
                    ) : (
                      <p className="text-3xl font-bold" style={{ color: "#111" }}>
                        ₹{(plan.priceMonthly / 100).toLocaleString("en-IN")}
                        <span className="text-sm font-normal" style={{ color: "#888" }}>/mo</span>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-1">
                    {FEATURE_ORDER.map(key => {
                      const val = (plan.features as unknown as Record<string, unknown>)[key];
                      const isEnabled = typeof val === "boolean" ? val : typeof val === "number" ? val !== 0 : false;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="h-4 w-4 flex-shrink-0 flex items-center justify-center rounded-full text-[9px] font-bold"
                            style={isEnabled
                              ? { background: plan.slug === "elite" ? "rgba(245,158,11,0.15)" : "rgba(139,92,246,0.12)", color: plan.slug === "elite" ? "hsl(38,100%,55%)" : "hsl(265,89%,60%)" }
                              : { background: "#f0f0f0", color: "#ccc" }}>
                            <Check className="h-2.5 w-2.5" />
                          </span>
                          <span className="text-[11px]" style={{ color: isEnabled ? "#444" : "#bbb" }}>
                            {FEATURE_LABELS[key] ?? key} — <span className="font-medium">{featureValue(key, val)}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => !isFree && handleSubscribe(plan)}
                    disabled={isCurrentPlan || isFree || subscribing === plan.id}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={isCurrentPlan
                      ? { background: "#f0f0f0", color: "#888", cursor: "default" }
                      : isFree
                        ? { background: "#f5f5f5", color: "#aaa", cursor: "default" }
                        : plan.slug === "elite"
                          ? { background: "linear-gradient(135deg, hsl(38,100%,50%), hsl(20,100%,55%))", color: "#fff", boxShadow: "0 4px 16px rgba(245,158,11,0.35)" }
                          : { background: "linear-gradient(135deg, hsl(265,89%,60%), hsl(285,89%,60%))", color: "#fff", boxShadow: "0 4px 16px rgba(139,92,246,0.35)" }
                    }
                  >
                    {subscribing === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrentPlan ? (
                      <><Check className="h-4 w-4" /> Current Plan</>
                    ) : isFree ? (
                      "Your Default Plan"
                    ) : (
                      <><ArrowRight className="h-4 w-4" /> Subscribe</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Feature comparison table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
            <div className="px-5 py-4" style={{ background: "#f9f9f9", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <p className="text-sm font-semibold" style={{ color: "#111" }}>Full Feature Comparison</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: "#888", width: "40%" }}>Feature</th>
                    {plans.map(p => (
                      <th key={p.id} className="text-center px-3 py-3 text-xs font-semibold" style={{ color: "#111" }}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_ORDER.map((key, i) => (
                    <tr key={key} style={{ borderBottom: i < FEATURE_ORDER.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none", background: i % 2 === 0 ? "transparent" : "#fafafa" }}>
                      <td className="px-5 py-3 text-xs" style={{ color: "#555" }}>{FEATURE_LABELS[key] ?? key}</td>
                      {plans.map(p => {
                        const val = (p.features as unknown as Record<string, unknown>)[key];
                        const isEnabled = typeof val === "boolean" ? val : typeof val === "number" ? val !== 0 : false;
                        return (
                          <td key={p.id} className="text-center px-3 py-3 text-xs font-medium" style={{ color: isEnabled ? "#111" : "#ccc" }}>
                            {featureValue(key, val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Note about Razorpay */}
          <p className="text-center text-xs mt-6" style={{ color: "#bbb" }}>
            Secure payments powered by Razorpay. All prices in INR. Cancel anytime.
          </p>
        </>
      )}
    </div>
  );
}
