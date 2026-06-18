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
import { API_BASE } from "@/lib/api-config";

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
    icon: <Shield className="h-5 w-5" style={{ color: "hsl(var(--muted-foreground))" }} />,
    accent: "hsl(var(--muted-foreground))",
    accentBg: "var(--glass-bg)",
    accentBorder: "var(--glass-border)",
    gradient: "linear-gradient(135deg, hsl(var(--muted-foreground)) 0%, #444 100%)",
    cardBg: "var(--card-bg)",
    cardBorder: "var(--glass-border)",
    shadow: "none",
  },
  pro: {
    icon: <Zap className="h-5 w-5" style={{ color: "#c0c0c0" }} />,
    accent: "#c0c0c0",
    accentBg: "rgba(255,255,255,0.08)",
    accentBorder: "rgba(255,255,255,0.20)",
    gradient: "linear-gradient(135deg, #666 0%, #333 100%)",
    cardBg: "var(--card-bg)",
    cardBorder: "rgba(255,255,255,0.22)",
    shadow: "0 0 0 1px rgba(255,255,255,0.16), 0 12px 40px rgba(0,0,0,0.40)",
    badge: "Most Popular",
  },
  elite: {
    icon: <Crown className="h-5 w-5" style={{ color: "#e8e8e8" }} />,
    accent: "#e8e8e8",
    accentBg: "rgba(255,255,255,0.12)",
    accentBorder: "rgba(255,255,255,0.28)",
    gradient: "linear-gradient(135deg, #b0b0b0 0%, #666 100%)",
    cardBg: "var(--card-bg)",
    cardBorder: "rgba(255,255,255,0.28)",
    shadow: "0 0 0 1px rgba(255,255,255,0.22), 0 12px 40px rgba(0,0,0,0.50)",
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
        borderBottom: "1px solid var(--glass-border)",
      }}
    >
      <div className="flex items-center gap-2 pr-4">
        <span style={{ color: "hsl(var(--muted-foreground))" }}>{icon}</span>
        <span className="text-[12px]" style={{ color: "hsl(var(--foreground))" }}>{label}</span>
      </div>
      {values.map((val, i) => {
        const meta = PLANS_META[slugs[i]];
        if (val === null) {
          return (
            <div key={i} className="flex justify-center">
              <X className="h-3.5 w-3.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }} />
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
            <span className="text-[12px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{val}</span>
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
  const [plansError, setPlansError] = useState(false);
  const [subscribing, setSubscribing] = useState<number | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [, navigate] = useLocation();
  const [pendingCoupon, setPendingCoupon] = useState<{ code: string; discountPercent: number; planSlug: string } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/subscription/plans`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setPlans(data); setLoading(false); })
      .catch(() => { setPlansError(true); setLoading(false); });
    const saved = localStorage.getItem("tt_pending_coupon");
    if (saved) {
      try { setPendingCoupon(JSON.parse(saved)); } catch { localStorage.removeItem("tt_pending_coupon"); }
    }
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

      const applicableCoupon = pendingCoupon && (pendingCoupon.planSlug === "all" || pendingCoupon.planSlug === plan.slug) ? pendingCoupon : null;
      const orderRes = await fetch(`${API_BASE}/api/subscription/create-order`, {
        method: "POST",
        headers,
        body: JSON.stringify({ planId: plan.id, couponCode: applicableCoupon?.code }),
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

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        toast({ title: "Payment unavailable", description: "Could not load the payment gateway. Please try again.", variant: "destructive" });
        setSubscribing(null);
        return;
      }
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Trade Lab",
        description: `${order.planName} Plan – Monthly`,
        order_id: order.orderId,
        prefill: { name: user.name, email: user.email },
        theme: { color: "#C9A84C" },
        handler: async (response: Record<string, string>) => {
          const verifyRes = await fetch(`${API_BASE}/api/subscription/verify`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              planId: plan.id,
              couponCode: applicableCoupon?.code,
            }),
          });
          if (verifyRes.ok) { if (applicableCoupon) { localStorage.removeItem("tt_pending_coupon"); setPendingCoupon(null); } refresh(); navigate("/billing"); }
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
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          <Crown className="h-3 w-3" />
          Simple, transparent pricing
        </div>
        <h1 className="text-[28px] font-bold tracking-tight mb-3" style={{ color: "hsl(var(--foreground))" }}>
          Upgrade your trading edge
        </h1>
        <p className="text-[14px] max-w-md mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.6 }}>
          Pick the plan that fits your workflow. All plans include access to the backtesting engine and live charts.
        </p>
      </div>

      {/* ── Plan cards ───────────────────────────────────────────────── */}
      {plansError && (
        <div className="text-center py-10 mb-4 rounded-2xl" style={{ background: "var(--card-bg)", border: "1px solid hsl(var(--border))" }}>
          <p className="text-[14px] mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>Could not load plans. Please try again.</p>
          <button onClick={() => { setPlansError(false); setLoading(true); fetch(`${API_BASE}/api/subscription/plans`).then(r => r.json()).then(d => { setPlans(d); setLoading(false); }).catch(() => { setPlansError(true); setLoading(false); }); }}
            className="text-[13px] px-4 py-2 rounded-xl" style={{ background: "hsl(var(--muted))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      )}
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
                background: meta?.cardBg ?? "var(--card-bg)",
                border: `1px solid ${meta?.cardBorder ?? "var(--glass-border)"}`,
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
                  <p className="text-[15px] font-bold" style={{ color: "hsl(var(--foreground))" }}>{plan.name}</p>
                  <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{plan.description.split(",")[0]}</p>
                </div>
              </div>

              {/* Price */}
              {(() => {
                const coupon = pendingCoupon && !isFree && (pendingCoupon.planSlug === "all" || pendingCoupon.planSlug === plan.slug) ? pendingCoupon : null;
                const discounted = coupon ? Math.round(plan.priceMonthly * (1 - coupon.discountPercent / 100)) : null;
                return (
                  <div className="mb-6">
                    {isFree ? (
                      <p className="text-[32px] font-bold" style={{ color: "hsl(var(--foreground))" }}>
                        ₹0<span className="text-[13px] font-normal" style={{ color: "hsl(var(--muted-foreground))" }}>/mo</span>
                      </p>
                    ) : discounted !== null ? (
                      <div>
                        <p className="text-[32px] font-bold" style={{ color: "hsl(var(--foreground))" }}>
                          ₹{(discounted / 100).toLocaleString("en-IN")}
                          <span className="text-[13px] font-normal" style={{ color: "hsl(var(--muted-foreground))" }}>/mo</span>
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[12px] line-through" style={{ color: "hsl(var(--muted-foreground))" }}>₹{(plan.priceMonthly / 100).toLocaleString("en-IN")}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}>-{coupon!.discountPercent}%</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[32px] font-bold" style={{ color: "hsl(var(--foreground))" }}>
                        ₹{(plan.priceMonthly / 100).toLocaleString("en-IN")}
                        <span className="text-[13px] font-normal" style={{ color: "hsl(var(--muted-foreground))" }}>/mo</span>
                      </p>
                    )}
                  </div>
                );
              })()}

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
                            : { background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }
                        }
                      >
                        {enabled
                          ? <Check className="h-2.5 w-2.5" style={{ color: meta?.accent }} />
                          : <X className="h-2.5 w-2.5" style={{ color: "hsl(var(--muted-foreground))" }} />
                        }
                      </span>
                      <span
                        className="text-[12px]"
                        style={{ color: enabled ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))", opacity: enabled ? 1 : 0.5 }}
                      >
                        {val === "yes" || val === null
                          ? label
                          : <><span style={{ color: "hsl(var(--foreground))", fontWeight: 600 }}>{val}</span> {label}</>
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
                    ? { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", cursor: "default", border: "1px solid var(--glass-border)" }
                    : isFree
                      ? { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", cursor: "default", border: "1px solid var(--glass-border)", opacity: 0.7 }
                      : { background: meta?.gradient, color: "#fff", boxShadow: `0 4px 20px ${meta?.accentBorder}` }
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
      <p className="text-center text-[11px] mb-2 sm:hidden" style={{ color: "hsl(var(--muted-foreground))" }}>
        ← Scroll to compare plans →
      </p>
      <div className="overflow-x-auto -mx-4 px-4 pb-1">
      <div
        className="rounded-2xl overflow-hidden min-w-[480px]"
        style={{ border: "1px solid var(--glass-border)", background: "var(--card-bg)" }}
      >
        {/* Table header */}
        <div
          className="grid px-5 py-4"
          style={{
            gridTemplateColumns: "1fr repeat(3, minmax(80px,100px))",
            background: "var(--glass-bg)",
            borderBottom: "1px solid var(--glass-border)",
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>
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
                <span className="text-[11px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{p.name}</span>
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
      <p className="text-center text-[11px] mt-6" style={{ color: "hsl(var(--muted-foreground))" }}>
        Secure payments via Razorpay · All prices in INR · Cancel anytime
      </p>
    </div>
  );
}
