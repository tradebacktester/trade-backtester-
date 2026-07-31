import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Crown, Check, X, Zap, Shield, ArrowRight, Loader2,
  TrendingUp, Brain, BarChart2, RefreshCw, Download, Star,
  QrCode, Upload, ImageIcon, CheckCircle2, Clock,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useSubscription, type SubscriptionPlan } from "@/lib/subscription-context";
import { AuthModal } from "@/components/auth-modal";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/lib/api-config";

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
  { key: "maxBacktestsPerMonth", label: "Backtests / month", icon: <BarChart2 className="h-3.5 w-3.5" />, format: val => val === -1 ? "Unlimited" : String(val) },
  { key: "aiQueriesPerDay", label: "AI queries / day", icon: <Brain className="h-3.5 w-3.5" />, format: val => val === -1 ? "Unlimited" : val === 0 ? null : `${val}/day` },
  { key: "maxLeverage", label: "Max leverage", icon: <TrendingUp className="h-3.5 w-3.5" />, format: val => `${val}×` },
  { key: "allIndicators", label: "All 11 indicators", icon: <BarChart2 className="h-3.5 w-3.5" />, format: val => typeof val === "boolean" ? (val ? "yes" : null) : null },
  { key: "replayMode", label: "Chart replay mode", icon: <RefreshCw className="h-3.5 w-3.5" />, format: val => typeof val === "boolean" ? (val ? "yes" : null) : null },
  { key: "multiTfView", label: "Multi-timeframe view", icon: <BarChart2 className="h-3.5 w-3.5" />, format: val => typeof val === "boolean" ? (val ? "yes" : null) : null },
  { key: "communityPost", label: "Community posting", icon: <Star className="h-3.5 w-3.5" />, format: val => typeof val === "boolean" ? (val ? "yes" : null) : null },
  { key: "dataExport", label: "Data export", icon: <Download className="h-3.5 w-3.5" />, format: val => typeof val === "boolean" ? (val ? "yes" : null) : null },
  { key: "priorityBadge", label: "Priority member badge", icon: <Crown className="h-3.5 w-3.5" />, format: val => typeof val === "boolean" ? (val ? "yes" : null) : null },
  { key: "maxHistoricalYears", label: "Historical data", icon: <BarChart2 className="h-3.5 w-3.5" />, format: val => val === -1 ? "Unlimited" : `${val} year${Number(val) === 1 ? "" : "s"}` },
  { key: "batchBacktest", label: "Batch backtesting", icon: <RefreshCw className="h-3.5 w-3.5" />, format: val => typeof val === "boolean" ? (val ? "yes" : null) : null },
  { key: "csvExport", label: "CSV export", icon: <Download className="h-3.5 w-3.5" />, format: val => typeof val === "boolean" ? (val ? "yes" : null) : null },
];

function FeatureRow({ label, icon, values, slugs }: { label: string; icon: React.ReactNode; values: Array<string | null>; slugs: string[] }) {
  return (
    <div className="grid items-center py-3" style={{ gridTemplateColumns: "1fr repeat(3, minmax(80px,100px))", borderBottom: "1px solid var(--glass-border)" }}>
      <div className="flex items-center gap-2 pr-4">
        <span style={{ color: "hsl(var(--muted-foreground))" }}>{icon}</span>
        <span className="text-[12px]" style={{ color: "hsl(var(--foreground))" }}>{label}</span>
      </div>
      {values.map((val, i) => {
        const meta = PLANS_META[slugs[i]];
        if (val === null) return <div key={i} className="flex justify-center"><X className="h-3.5 w-3.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }} /></div>;
        if (val === "yes") return (
          <div key={i} className="flex justify-center">
            <span className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: meta?.accentBg }}>
              <Check className="h-3 w-3" style={{ color: meta?.accent }} />
            </span>
          </div>
        );
        return <div key={i} className="flex justify-center"><span className="text-[12px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{val}</span></div>;
      })}
    </div>
  );
}

// ── UPI QR Payment Modal ──────────────────────────────────────────────────────
function UpiPaymentModal({
  plan,
  onClose,
  onSuccess,
  token,
}: {
  plan: SubscriptionPlan;
  onClose: () => void;
  onSuccess: () => void;
  token: string | null;
}) {
  const [phase, setPhase] = useState<"qr" | "upload" | "submitting" | "done">("qr");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotMime, setScreenshotMime] = useState("image/jpeg");
  const [utrNote, setUtrNote] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const priceRs = (plan.priceMonthly / 100).toLocaleString("en-IN");

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Image must be smaller than 5 MB"); return; }
    setError("");
    setScreenshotMime(file.type);
    const reader = new FileReader();
    reader.onload = e => {
      const base64 = (e.target?.result as string).split(",")[1] ?? "";
      setScreenshot(base64);
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  async function handleSubmit() {
    if (!screenshot) { setError("Please attach a payment screenshot"); return; }
    setPhase("submitting");
    setError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/subscription/manual-payment`, {
        method: "POST", headers,
        body: JSON.stringify({ planId: plan.id, screenshotData: screenshot, screenshotMime, utrNote: utrNote.trim() || undefined }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) { setError(data.error ?? "Submission failed"); setPhase("upload"); return; }
      setPhase("done");
    } catch {
      setError("Network error. Please try again.");
      setPhase("upload");
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={e => { if (e.target === e.currentTarget && phase !== "submitting") onClose(); }}>
      <div className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{ background: "var(--glass-bg-strong)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-modal)", maxHeight: "92dvh", overflowY: "auto" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <div className="flex items-center gap-2">
            <QrCode style={{ height: 16, width: 16, color: "#22d3ee" }} />
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>Pay via UPI</h3>
              <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{plan.name} Plan — ₹{priceRs}/month</p>
            </div>
          </div>
          {phase !== "submitting" && (
            <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-full"
              style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>
              <X style={{ height: 13, width: 13 }} />
            </button>
          )}
        </div>

        {/* QR Phase */}
        {phase === "qr" && (
          <div className="px-5 py-5 flex flex-col gap-4">
            <div className="rounded-xl overflow-hidden flex items-center justify-center p-3"
              style={{ background: "#fff", border: "2px solid rgba(99,102,241,0.3)" }}>
              <img src="/upi-qr.jpg" alt="UPI QR Code" className="w-full max-w-[220px]" style={{ borderRadius: 8 }} />
            </div>
            <div className="rounded-xl px-4 py-3 text-center" style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)" }}>
              <p className="text-[11px] font-mono" style={{ color: "#22d3ee" }}>9837046271@ptyes</p>
              <p className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>Paytm / UPI</p>
            </div>
            <div className="rounded-xl px-3 py-2.5 flex items-start gap-2"
              style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)" }}>
              <Clock style={{ height: 11, width: 11, color: "#eab308", flexShrink: 0, marginTop: 1 }} />
              <p className="text-[11px]" style={{ color: "#eab308" }}>
                Pay exactly <strong>₹{priceRs}</strong> and take a screenshot of the payment confirmation screen.
              </p>
            </div>
            <button onClick={() => setPhase("upload")}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)", color: "#fff", boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}>
              <CheckCircle2 style={{ height: 15, width: 15 }} />
              I Have Paid — Upload Screenshot
            </button>
          </div>
        )}

        {/* Upload Phase */}
        {(phase === "upload" || phase === "submitting") && (
          <div className="px-5 py-5 flex flex-col gap-4">
            {/* Drop zone */}
            <div
              onDragOver={e => e.preventDefault()} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl flex flex-col items-center justify-center gap-3 py-6 cursor-pointer transition-all"
              style={{
                border: `2px dashed ${screenshot ? "rgba(34,197,94,0.5)" : "var(--glass-border)"}`,
                background: screenshot ? "rgba(34,197,94,0.05)" : "var(--glass-bg)",
              }}>
              {screenshot ? (
                <>
                  <img src={`data:${screenshotMime};base64,${screenshot}`} alt="Screenshot preview"
                    className="max-h-32 rounded-lg object-contain" />
                  <p className="text-[11px]" style={{ color: "#22c55e" }}>Screenshot attached ✓</p>
                </>
              ) : (
                <>
                  <ImageIcon style={{ height: 28, width: 28, color: "hsl(var(--muted-foreground))" }} />
                  <p className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>Upload payment screenshot</p>
                  <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>Click or drag & drop · JPG, PNG</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>

            {screenshot && (
              <button onClick={() => { setScreenshot(null); }} className="text-[11px] text-center transition-colors"
                style={{ color: "hsl(var(--muted-foreground))" }}>
                Remove & re-upload
              </button>
            )}

            {/* UTR note */}
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: "hsl(var(--muted-foreground))" }}>
                UTR / Transaction ID <span style={{ opacity: 0.6 }}>(optional)</span>
              </label>
              <input type="text" placeholder="e.g. 423891765432"
                value={utrNote} onChange={e => setUtrNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ border: "1px solid var(--glass-border)", background: "hsl(var(--input))", color: "hsl(var(--foreground))" }} />
            </div>

            {error && (
              <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={phase === "submitting" || !screenshot}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{
                background: phase === "submitting" || !screenshot ? "hsl(var(--muted))" : "linear-gradient(135deg, #7c3aed, #06b6d4)",
                color: phase === "submitting" || !screenshot ? "hsl(var(--muted-foreground))" : "#fff",
                cursor: phase === "submitting" || !screenshot ? "not-allowed" : "pointer",
              }}>
              {phase === "submitting" ? (
                <><Loader2 style={{ height: 14, width: 14 }} className="animate-spin" />Submitting…</>
              ) : (
                <><Upload style={{ height: 14, width: 14 }} />Submit Payment</>
              )}
            </button>

            <button onClick={() => setPhase("qr")} className="text-[11px] text-center transition-colors"
              style={{ color: "hsl(var(--muted-foreground))" }}>
              ← Show QR Code again
            </button>
          </div>
        )}

        {/* Done Phase */}
        {phase === "done" && (
          <div className="px-5 py-8 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full flex items-center justify-center"
              style={{ background: "rgba(34,197,94,0.12)", border: "2px solid #22c55e" }}>
              <CheckCircle2 style={{ height: 32, width: 32, color: "#22c55e" }} />
            </div>
            <div className="text-center">
              <p className="text-base font-bold mb-1" style={{ color: "hsl(var(--foreground))" }}>Payment Submitted!</p>
              <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                Your payment screenshot has been sent to the admin. Your {plan.name} plan will be activated within <strong>24 hours</strong> once verified.
              </p>
            </div>
            <button onClick={() => { onSuccess(); onClose(); }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const { user, token } = useAuth();
  const { plan: currentPlan, subscription, refresh } = useSubscription();
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [, navigate] = useLocation();
  const [pendingCoupon, setPendingCoupon] = useState<{ code: string; discountPercent: number; planSlug: string } | null>(null);
  const [upiPlan, setUpiPlan] = useState<SubscriptionPlan | null>(null);

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

  function handleSubscribe(plan: SubscriptionPlan) {
    if (!user) { setShowAuth(true); return; }
    if (plan.priceMonthly === 0) return;
    if (currentPlan?.slug === plan.slug && subscription?.status === "active") return;
    setUpiPlan(plan);
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
      {upiPlan && (
        <UpiPaymentModal
          plan={upiPlan}
          token={token}
          onClose={() => setUpiPlan(null)}
          onSuccess={() => {
            if (pendingCoupon) { localStorage.removeItem("tt_pending_coupon"); setPendingCoupon(null); }
            refresh();
            toast({ title: "Payment submitted!", description: "Admin will activate your plan within 24 hours." });
            navigate("/billing");
          }}
        />
      )}

      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium mb-5"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "hsl(var(--muted-foreground))" }}>
          <Crown className="h-3 w-3" />
          Simple, transparent pricing
        </div>
        <h1 className="text-[28px] font-bold tracking-tight mb-3" style={{ color: "hsl(var(--foreground))" }}>
          Upgrade your trading edge
        </h1>
        <p className="text-[14px] max-w-md mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.6 }}>
          Pick the plan that fits your workflow. All plans include access to the backtesting engine and live charts.
        </p>

        {/* UPI payment badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl mt-4"
          style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)" }}>
          <QrCode style={{ height: 13, width: 13, color: "#22d3ee" }} />
          <span className="text-[12px]" style={{ color: "#22d3ee" }}>Pay instantly via UPI / Paytm QR · Manual activation within 24h</span>
        </div>
      </div>

      {/* Plan cards */}
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

          const coupon = pendingCoupon && !isFree && (pendingCoupon.planSlug === "all" || pendingCoupon.planSlug === plan.slug) ? pendingCoupon : null;
          const discounted = coupon ? Math.round(plan.priceMonthly * (1 - coupon.discountPercent / 100)) : null;

          return (
            <div key={plan.id} className="relative flex flex-col rounded-2xl p-6"
              style={{ background: meta?.cardBg ?? "var(--card-bg)", border: `1px solid ${meta?.cardBorder ?? "var(--glass-border)"}`, boxShadow: meta?.shadow ?? "none" }}>
              {meta?.badge && (
                <div className="absolute -top-3 left-0 right-0 flex justify-center">
                  <span className="px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide text-white" style={{ background: meta.gradient }}>{meta.badge}</span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-5">
                <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta?.accentBg }}>{meta?.icon}</span>
                <div>
                  <p className="text-[15px] font-bold" style={{ color: "hsl(var(--foreground))" }}>{plan.name}</p>
                  <p className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{plan.description.split(",")[0]}</p>
                </div>
              </div>

              <div className="mb-6">
                {isFree ? (
                  <p className="text-[32px] font-bold" style={{ color: "hsl(var(--foreground))" }}>₹0<span className="text-[13px] font-normal" style={{ color: "hsl(var(--muted-foreground))" }}>/mo</span></p>
                ) : discounted !== null ? (
                  <div>
                    <p className="text-[32px] font-bold" style={{ color: "hsl(var(--foreground))" }}>₹{(discounted / 100).toLocaleString("en-IN")}<span className="text-[13px] font-normal" style={{ color: "hsl(var(--muted-foreground))" }}>/mo</span></p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[12px] line-through" style={{ color: "hsl(var(--muted-foreground))" }}>₹{(plan.priceMonthly / 100).toLocaleString("en-IN")}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}>-{coupon!.discountPercent}%</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[32px] font-bold" style={{ color: "hsl(var(--foreground))" }}>₹{(plan.priceMonthly / 100).toLocaleString("en-IN")}<span className="text-[13px] font-normal" style={{ color: "hsl(var(--muted-foreground))" }}>/mo</span></p>
                )}
              </div>

              <div className="flex flex-col gap-2.5 flex-1 mb-6">
                {FEATURES.map(({ key, label, format }) => {
                  const raw = (plan.features as unknown as Record<string, unknown>)[key];
                  const val = format(raw);
                  const enabled = val !== null;
                  return (
                    <div key={key} className="flex items-center gap-2.5">
                      <span className="h-4 w-4 flex-shrink-0 rounded-full flex items-center justify-center"
                        style={enabled ? { background: meta?.accentBg } : { background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                        {enabled ? <Check className="h-2.5 w-2.5" style={{ color: meta?.accent }} /> : <X className="h-2.5 w-2.5" style={{ color: "hsl(var(--muted-foreground))" }} />}
                      </span>
                      <span className="text-[12px]" style={{ color: enabled ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))", opacity: enabled ? 1 : 0.5 }}>
                        {val === "yes" || val === null ? label : <><span style={{ color: "hsl(var(--foreground))", fontWeight: 600 }}>{val}</span> {label}</>}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => !isFree && !isActive && handleSubscribe(plan)}
                disabled={isFree || isActive}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-opacity"
                style={
                  isActive ? { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", cursor: "default", border: "1px solid var(--glass-border)" }
                  : isFree ? { background: "var(--glass-bg)", color: "hsl(var(--muted-foreground))", cursor: "default", border: "1px solid var(--glass-border)", opacity: 0.7 }
                  : { background: meta?.gradient, color: "#fff", boxShadow: `0 4px 20px ${meta?.accentBorder}` }
                }>
                {isActive ? (
                  <><Check className="h-4 w-4" /> Current plan</>
                ) : isCurrentPlan ? (
                  <><ArrowRight className="h-4 w-4" /> Switch back</>
                ) : isFree ? "Free forever" : (
                  <><QrCode className="h-4 w-4" /> Pay via UPI</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Feature comparison table */}
      <p className="text-center text-[11px] mb-2 sm:hidden" style={{ color: "hsl(var(--muted-foreground))" }}>← Scroll to compare plans →</p>
      <div className="overflow-x-auto -mx-4 px-4 pb-1">
        <div className="rounded-2xl overflow-hidden min-w-[480px]" style={{ border: "1px solid var(--glass-border)", background: "var(--card-bg)" }}>
          <div className="grid px-5 py-4" style={{ gridTemplateColumns: "1fr repeat(3, minmax(80px,100px))", background: "var(--glass-bg)", borderBottom: "1px solid var(--glass-border)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Feature</p>
            {plans.map(p => {
              const meta = PLANS_META[p.slug];
              return (
                <div key={p.id} className="flex flex-col items-center gap-0.5">
                  <span className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ background: meta?.accentBg }}>
                    {meta?.icon && React.cloneElement(meta.icon as React.ReactElement<{ className?: string }>, { className: "h-3.5 w-3.5" })}
                  </span>
                  <span className="text-[11px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{p.name}</span>
                </div>
              );
            })}
          </div>
          <div className="px-5">
            {FEATURES.map(({ key, label, icon, format }) => {
              const values = plans.map(p => format((p.features as unknown as Record<string, unknown>)[key]));
              const slugs = plans.map(p => p.slug);
              return <FeatureRow key={key} label={label} icon={icon} values={values} slugs={slugs} />;
            })}
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] mt-6" style={{ color: "hsl(var(--muted-foreground))" }}>
        Secure payments via UPI · All prices in INR · Plan activated within 24 hours after admin approval
      </p>
    </div>
  );
}
