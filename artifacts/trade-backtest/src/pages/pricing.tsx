import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Crown, Check, X, Zap, Shield, ArrowRight, Loader2,
  TrendingUp, Brain, BarChart2, RefreshCw, Download, Star,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSubscription, type SubscriptionPlan } from "@/lib/subscription-context";
import { AuthModal } from "@/components/auth-modal";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => { open(): void };
  }
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

const PLANS_META: Record<string, {
  icon: React.ReactNode;
  accent: string;
  accentBg: string;
  accentBorder: string;
  gradient: string;
  cardBg: string;
  cardBorder: string;
  shadow: string;
  badge?: string;
}> = {
  free: {
    icon: <Shield className="h-5 w-5" style={{ color: "#777" }} />,
    accent: "#555",
    accentBg: "rgba(0,0,0,0.06)",
    accentBorder: "rgba(0,0,0,0.12)",
    gradient: "linear-gradient(135deg, #555 0%, #333 100%)",
    cardBg: "#fff",
    cardBorder: "rgba(0,0,0,0.09)",
    shadow: "none",
  },
  pro: {
    icon: <Zap className="h-5 w-5" style={{ color: "hsl(265,89%,62%)" }} />,
    accent: "hsl(265,89%,60%)",
    accentBg: "rgba(139,92,246,0.1)",
    accentBorder: "rgba(139,92,246,0.28)",
    gradient: "linear-gradient(135deg, hsl(265,89%,60%) 0%, hsl(285,89%,58%) 100%)",
    cardBg: "#fff",
    cardBorder: "rgba(139,92,246,0.22)",
    shadow: "0 0 0 1px rgba(139,92,246,0.22), 0 12px 40px rgba(139,92,246,0.14)",
    badge: "Most Popular",
  },
  elite: {
    icon: <Crown className="h-5 w-5" style={{ color: "hsl(38,100%,52%)" }} />,
    accent: "hsl(38,100%,50%)",
    accentBg: "rgba(245,158,11,0.1)",
    accentBorder: "rgba(245,158,11,0.3)",
    gradient: "linear-gradient(135deg, hsl(38,100%,50%) 0%, hsl(20,100%,52%) 100%)",
    cardBg: "#fff",
    cardBorder: "rgba(245,158,11,0.25)",
    shadow: "0 0 0 1px rgba(245,158,11,0.22), 0 12px 40px rgba(245,158,11,0.12)",
  },
};

const FEATURES: Array<{
  key: string;
  label: string;
  icon: React.ReactNode;
  format: (val: unknown) => string | null;
}> = [
  {
    key: "maxBacktestsPerMonth",
    label: "Backtests / month",
    icon: <BarChart2 className="h-3.5 w-3.5" />,
    format: val => val === -1 ? "Unlimited" : String(val),
  },
  {
    key: "aiQueriesPerDay",
    label: "AI queries / day",
    icon: <Brain className="h-3.5 w-3.5" />,
    format: val => val === -1 ? "Unlimited" : val === 0 ? null : `${val}/day`,
  },
  {
    key: "maxLeverage",
    label: "Max leverage",
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    format: val => `${val}×`,
  },
  {
    key: "allIndicators",
    label: "All 11 indicators",
    icon: <BarChart2 className="h-3.5 w-3.5" />,
    format: val => typeof val === "boolean" ? (val ? "yes" : null) : null,
  },
  {
    key: "replayMode",
    label: "Chart replay mode",
    icon: <RefreshCw className="h-3.5 w-3.5" />,
    format: val => typeof val === "boolean" ? (val ? "yes" : null) : null,
  },
  {
    key: "multiTfView",
    label: "Multi-timeframe view",
    icon: <BarChart2 className="h-3.5 w-3.5" />,
    format: val => typeof val === "boolean" ? (val ? "yes" : null) : null,
  },
  {
    key: "communityPost",
    label: "Community posting",
    icon: <Star className="h-3.5 w-3.5" />,
    format: val => typeof val === "boolean" ? (val ? "yes" : null) : null,
  },
  {
    key: "dataExport",
    label: "Data export",
    icon: <Download className="h-3.5 w-3.5" />,
    format: val => typeof val === "boolean" ? (val ? "yes" : null) : null,
  },
  {
    key: "priorityBadge",
    label: "Priority member badge",
    icon: <Crown className="h-3.5 w-3.5" />,
    format: val => typeof val === "boolean" ? (val ? "yes" : null) : null,
  },
];

function FeatureRow({
  label,
  icon,
  values,
  slugs,
}: {
  label: string;
  icon: React.ReactNode;
  values: Array<string | null>;
  slugs: string[];
}) {
  return (
    <div
      className="grid items-center py-3"
      style={{
        gridTemplateColumns: "1fr repeat(3, minmax(80px,100px))",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex items-center gap-2 pr-4">
        <span style={{ color: "#aaa" }}>{icon}</span>
        <span className="text-[12px]" style={{ color: "#555" }}>{label}</span>
      </div>
      {values.map((val, i) => {
        const meta = PLANS_META[slugs[i]];
        if (val === null) {
          return (
            <div key={i} className="flex justify-center">
              <X className="h-3.5 w-3.5" style={{ color: "#ddd" }} />
            </div>
          );
        }
        if (val === "yes") {
          return (
            <div key={i} className="flex justify-center">
              <span
                className="h-5 w-5 rounded-full flex items-center justify-center"
                style={{ background: meta?.accentBg }}
              >
                <Check className="h-3 w-3" style={{ color: meta?.accent }} />
              </span>
            </div>
          );
        }
        return (
          <div key={i} className="flex justify-center">
            <span className="text-[12px] font-semibold" style={{ color: "#222" }}>{val}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function PricingPage() {
  const { user } = useAuth();
  const { plan: currentPlan, subscription, refresh } = useSubscription();
  const { toast } = useToast();
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
      if (!orderRes.ok) {
        toast({ title: "Order failed", description: order.error ?? "Failed to create order", variant: "destructive" });
        setSubscribing(null);
        return;
      }

      if (order.keyId === "rzp_test_placeholder") {
        toast({
          title: "Subscriptions coming soon",
          description: "Online payments are not yet enabled for this platform. Please contact the administrator to upgrade your plan.",
        });
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
          if (verifyRes.ok) { refresh(); navigate("/billing"); }
          else { toast({ title: "Verification failed", description: "Payment could not be verified. Please contact support.", variant: "destructive" }); }
        },
      });
      rzp.open();
    } catch {
      toast({ title: "Unexpected error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setSubscribing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#ccc" }} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="text-center mb-12">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium mb-5"
          style={{
            background: "rgba(139,92,246,0.08)",
            border: "1px solid rgba(139,92,246,0.18)",
            color: "hsl(265,89%,60%)",
          }}
        >
          <Crown className="h-3 w-3" />
          Simple, transparent pricing
        </div>
        <h1 className="text-[28px] font-bold tracking-tight mb-3" style={{ color: "#111" }}>
          Upgrade your trading edge
        </h1>
        <p className="text-[14px] max-w-md mx-auto" style={{ color: "#888", lineHeight: 1.6 }}>
          Pick the plan that fits your workflow. All plans include access to the backtesting engine and live charts.
        </p>
      </div>

      {/* ── Plan cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {plans.map(plan => {
          const meta = PLANS_META[plan.slug];
          const isFree = plan.priceMonthly === 0;
          const isCurrentPlan = currentPlan?.slug === plan.slug;
          const isActive = isCurrentPlan && subscription?.status === "active";
          const isBusy = subscribing === plan.id;

          return (
            <div
              key={plan.id}
              className="relative flex flex-col rounded-2xl p-6"
              style={{
                background: meta?.cardBg ?? "#fff",
                border: `1px solid ${meta?.cardBorder ?? "rgba(0,0,0,0.09)"}`,
                boxShadow: meta?.shadow ?? "none",
              }}
            >
              {/* Popular badge */}
              {meta?.badge && (
                <div className="absolute -top-3 left-0 right-0 flex justify-center">
                  <span
                    className="px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide text-white"
                    style={{ background: meta.gradient }}
                  >
                    {meta.badge}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="flex items-center gap-3 mb-5">
                <span
                  className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: meta?.accentBg }}
                >
                  {meta?.icon}
                </span>
                <div>
                  <p className="text-[15px] font-bold" style={{ color: "#111" }}>{plan.name}</p>
                  <p className="text-[11px]" style={{ color: "#999" }}>{plan.description.split(",")[0]}</p>
                </div>
              </div>

              {/* Price */}
              <div className="mb-6">
                {isFree ? (
                  <p className="text-[32px] font-bold" style={{ color: "#111" }}>
                    ₹0
                    <span className="text-[13px] font-normal" style={{ color: "#aaa" }}>/mo</span>
                  </p>
                ) : (
                  <p className="text-[32px] font-bold" style={{ color: "#111" }}>
                    ₹{(plan.priceMonthly / 100).toLocaleString("en-IN")}
                    <span className="text-[13px] font-normal" style={{ color: "#aaa" }}>/mo</span>
                  </p>
                )}
              </div>

              {/* Feature list */}
              <div className="flex flex-col gap-2.5 flex-1 mb-6">
                {FEATURES.map(({ key, label, format }) => {
                  const raw = (plan.features as unknown as Record<string, unknown>)[key];
                  const val = format(raw);
                  const enabled = val !== null;

                  return (
                    <div key={key} className="flex items-center gap-2.5">
                      <span
                        className="h-4 w-4 flex-shrink-0 rounded-full flex items-center justify-center"
                        style={
                          enabled
                            ? { background: meta?.accentBg }
                            : { background: "#f0f0f0" }
                        }
                      >
                        {enabled
                          ? <Check className="h-2.5 w-2.5" style={{ color: meta?.accent }} />
                          : <X className="h-2.5 w-2.5" style={{ color: "#ccc" }} />
                        }
                      </span>
                      <span
                        className="text-[12px]"
                        style={{ color: enabled ? "#444" : "#ccc" }}
                      >
                        {val === "yes" || val === null
                          ? label
                          : <><span style={{ color: enabled ? "#111" : "#ccc", fontWeight: 600 }}>{val}</span> {label}</>
                        }
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* CTA */}
              <button
                onClick={() => !isFree && !isActive && handleSubscribe(plan)}
                disabled={isFree || isActive || isBusy}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-opacity"
                style={
                  isActive
                    ? { background: "#f0f0f0", color: "#888", cursor: "default" }
                    : isFree
                      ? { background: "#f5f5f5", color: "#bbb", cursor: "default" }
                      : { background: meta?.gradient, color: "#fff", boxShadow: `0 4px 16px ${meta?.accentBorder}` }
                }
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isActive ? (
                  <><Check className="h-4 w-4" /> Current plan</>
                ) : isCurrentPlan ? (
                  <><ArrowRight className="h-4 w-4" /> Switch back</>
                ) : isFree ? (
                  "Free forever"
                ) : (
                  <><ArrowRight className="h-4 w-4" /> Get {plan.name}</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Feature comparison table ──────────────────────────────────── */}
      <div className="overflow-x-auto -mx-1 px-1">
      <div
        className="rounded-2xl overflow-hidden min-w-[480px]"
        style={{ border: "1px solid rgba(0,0,0,0.08)" }}
      >
        {/* Table header */}
        <div
          className="grid px-5 py-4"
          style={{
            gridTemplateColumns: "1fr repeat(3, minmax(80px,100px))",
            background: "#fafafa",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#aaa" }}>
            Feature
          </p>
          {plans.map(p => {
            const meta = PLANS_META[p.slug];
            return (
              <div key={p.id} className="flex flex-col items-center gap-0.5">
                <span
                  className="h-6 w-6 rounded-lg flex items-center justify-center"
                  style={{ background: meta?.accentBg }}
                >
                  {meta?.icon && React.cloneElement(meta.icon as React.ReactElement<{ className?: string }>, {
                    className: "h-3.5 w-3.5",
                  })}
                </span>
                <span className="text-[11px] font-semibold" style={{ color: "#333" }}>{p.name}</span>
              </div>
            );
          })}
        </div>

        {/* Table rows */}
        <div className="px-5">
          {FEATURES.map(({ key, label, icon, format }) => {
            const values = plans.map(p => format((p.features as unknown as Record<string, unknown>)[key]));
            const slugs = plans.map(p => p.slug);
            return (
              <FeatureRow key={key} label={label} icon={icon} values={values} slugs={slugs} />
            );
          })}
        </div>
      </div>
      </div>

      {/* ── Footer note ───────────────────────────────────────────────── */}
      <p className="text-center text-[11px] mt-6" style={{ color: "#ccc" }}>
        Secure payments via Razorpay · All prices in INR · Cancel anytime
      </p>
    </div>
  );
}
